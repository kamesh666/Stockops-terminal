"""Event-driven backtester on real historical bars.

* Signals are computed on bar *t*'s close and filled at bar *t+1*'s open (no look-ahead).
* Initial stop = entry -/+ ``stop_atr`` x ATR; optional ATR trailing (chandelier) stop;
  stops are checked intrabar and gaps through the stop fill at the open.
* Position size = ``risk_pct`` of current equity / per-share risk (Rayner Teo's
  formula), capped at 100% of equity - no leverage.
* Costs: ``cost_pct`` per side (brokerage + STT + exchange + stamp, approx.) plus slippage.
* Reports CAGR, Sharpe, Sortino, max drawdown, Calmar, win rate, profit factor,
  expectancy in R, exposure, buy-and-hold benchmark, monthly returns and an
  in-sample / out-of-sample split to expose curve-fitting.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import candles as candle_mod
from . import data as data_mod
from . import indicators as ta
from . import vsa as vsa_mod

STRATEGIES: dict[str, dict] = {
    "golden-cross": {"name": "Golden Cross (50/200 SMA)", "source": "CFI - trend following #1", "style": "trend"},
    "ema-5-8-13": {"name": "5/8/13 EMA Fibonacci ribbon", "source": "CFI - trend following #2", "style": "trend"},
    "adx-trend": {"name": "Simple ADX > 25 trend", "source": "CFI - trend following #3", "style": "trend"},
    "macd-cross": {"name": "MACD signal-line crossover", "source": "NSE TA workbook 4.3.2", "style": "momentum"},
    "rsi-regime": {"name": "RSI 40/70 bull-regime pullback", "source": "NSE TA workbook 4.3.1.8", "style": "pullback"},
    "bollinger-reversion": {"name": "Bollinger mean reversion (range only)", "source": "NSE TA workbook 4.3.2.5 + tool kit", "style": "mean-reversion"},
    "donchian-breakout": {"name": "20-bar breakout / 10-bar exit", "source": "MBEE breakout / Dow theory", "style": "breakout"},
    "elder-impulse": {"name": "Elder impulse system", "source": "NSE TA workbook 5.2.2", "style": "momentum"},
    "candle-reversal": {"name": "Candlestick reversal at value (MAEE)", "source": "Rayner Teo MAEE + NSE TA ch.2", "style": "price action"},
    "vsa-strength": {"name": "VSA test / no-supply in uptrend", "source": "Tom Williams - Master the Markets", "style": "volume"},
}


@dataclass
class Params:
    capital: float = 100000.0
    risk_pct: float = 1.0
    stop_atr: float = 2.0
    trail_atr: float | None = 3.0
    target_r: float | None = None
    cost_pct: float = 0.10       # per side
    slippage_pct: float = 0.02   # per side
    allow_short: bool = False
    max_bars: int | None = None  # time stop
    sizing: str = "risk"         # "risk" = risk_pct of equity per trade; "full" = all-in (compare with buy & hold)


def _cross_up(a: pd.Series, b: pd.Series | float) -> pd.Series:
    b_prev = b.shift() if isinstance(b, pd.Series) else b
    return (a > b) & (a.shift() <= b_prev)


def _cross_dn(a: pd.Series, b: pd.Series | float) -> pd.Series:
    b_prev = b.shift() if isinstance(b, pd.Series) else b
    return (a < b) & (a.shift() >= b_prev)


def signals(strategy: str, ind: pd.DataFrame) -> pd.DataFrame:
    c = ind["close"]
    f = pd.Series(False, index=ind.index)
    el, xl, es, xs = f.copy(), f.copy(), f.copy(), f.copy()
    if strategy == "golden-cross":
        # "be a buyer as long as the 50 MA is above the 200 MA" - state based, re-enter on a close above the 50
        gold = ind["sma50"] > ind["sma200"]
        el = gold & (c > ind["sma50"])
        xl = ~gold
        es = ~gold & (c < ind["sma50"])
        xs = gold
    elif strategy == "ema-5-8-13":
        el, xl = _cross_up(ind["ema5"], ind["ema13"]), _cross_dn(ind["ema5"], ind["ema13"])
        es, xs = xl.copy(), el.copy()
    elif strategy == "adx-trend":
        trend = ind["adx"] > 25
        el = trend & (ind["plus_di"] > ind["minus_di"]) & ~(trend.shift(fill_value=False) & (ind["plus_di"].shift() > ind["minus_di"].shift()))
        xl = (ind["adx"] < 20) | (ind["minus_di"] > ind["plus_di"])
        es = trend & (ind["minus_di"] > ind["plus_di"]) & ~(trend.shift(fill_value=False) & (ind["minus_di"].shift() > ind["plus_di"].shift()))
        xs = (ind["adx"] < 20) | (ind["plus_di"] > ind["minus_di"])
    elif strategy == "macd-cross":
        el, xl = _cross_up(ind["macd"], ind["macd_signal"]), _cross_dn(ind["macd"], ind["macd_signal"])
        es, xs = xl.copy(), el.copy()
    elif strategy == "rsi-regime":
        bull = c > ind["sma200"]
        bear = c < ind["sma200"]
        el = bull & _cross_up(ind["rsi"], 40)
        xl = (ind["rsi"] > 70) | (c < ind["sma200"])
        es = bear & _cross_dn(ind["rsi"], 60)
        xs = (ind["rsi"] < 30) | (c > ind["sma200"])
    elif strategy == "bollinger-reversion":
        rng = ind["adx"] < 20
        el = rng & (c < ind["bb_lower"])
        xl = c >= ind["bb_mid"]
        es = rng & (c > ind["bb_upper"])
        xs = c <= ind["bb_mid"]
    elif strategy == "donchian-breakout":
        hh = ind["high"].rolling(20).max().shift()
        ll = ind["low"].rolling(20).min().shift()
        el = c > hh
        xl = c < ind["low"].rolling(10).min().shift()
        es = c < ll
        xs = c > ind["high"].rolling(10).max().shift()
    elif strategy == "elder-impulse":
        g = ind["impulse"] == 1
        r = ind["impulse"] == -1
        el = g & ~g.shift(fill_value=False)
        xl = ind["impulse"] != 1
        es = r & ~r.shift(fill_value=False)
        xs = ind["impulse"] != -1
    elif strategy == "candle-reversal":
        found = candle_mod.detect(ind, lookback=len(ind))
        near_value = (c - ind["ema50"]).abs() <= ind["atr"] * 1.0
        up = c > ind["sma200"]
        dn = c < ind["sma200"]
        bull_idx = {x["index"] for x in found if x["bias"] == "bullish" and x["name"] in ("Hammer", "Bullish Engulfing", "Morning Star", "Piercing Line", "Bullish Pin Bar")}
        bear_idx = {x["index"] for x in found if x["bias"] == "bearish" and x["name"] in ("Shooting Star", "Bearish Engulfing", "Evening Star", "Dark Cloud Cover", "Bearish Pin Bar")}
        pos = pd.Series(np.arange(len(ind)), index=ind.index)
        el = pos.isin(bull_idx) & near_value & up
        es = pos.isin(bear_idx) & near_value & dn
        xl = f.copy()
        xs = f.copy()
    elif strategy == "vsa-strength":
        res = vsa_mod.analyse(ind, lookback=len(ind))
        if res.get("available"):
            pos = pd.Series(np.arange(len(ind)), index=ind.index)
            sigs = res["all"]
            strong = {s["index"] for s in sigs if s["name"] in ("Test", "No Supply", "Stopping Volume")}
            weak = {s["index"] for s in sigs if s["name"] in ("No Demand", "Up-thrust")}
            el = pos.isin(strong) & (c > ind["sma50"])
            es = pos.isin(weak) & (c < ind["sma50"])
        xl = f.copy()
        xs = f.copy()
    else:
        raise ValueError(f"unknown strategy '{strategy}'")
    return pd.DataFrame({"el": el.fillna(False), "xl": xl.fillna(False), "es": es.fillna(False), "xs": xs.fillna(False)})


def _metrics(equity: pd.Series, trades: list[dict], bars_per_year: float, capital: float) -> dict:
    if len(equity) < 2:
        return {}
    rets = equity.pct_change().dropna()
    years = len(equity) / bars_per_year
    total = equity.iloc[-1] / equity.iloc[0] - 1
    cagr = (equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1 if years > 0 and equity.iloc[-1] > 0 else -1
    peak = equity.cummax()
    dd = equity / peak - 1
    mdd = float(dd.min())
    sd = rets.std(ddof=1)
    sharpe = float(rets.mean() / sd * math.sqrt(bars_per_year)) if sd > 0 else 0.0
    dsd = rets[rets < 0].std(ddof=1)
    sortino = float(rets.mean() / dsd * math.sqrt(bars_per_year)) if dsd and dsd > 0 else 0.0
    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    gp = sum(t["pnl"] for t in wins)
    gl = -sum(t["pnl"] for t in losses)
    return {
        "totalReturnPct": round(total * 100, 2), "cagrPct": round(cagr * 100, 2),
        "maxDrawdownPct": round(mdd * 100, 2), "sharpe": round(sharpe, 2), "sortino": round(sortino, 2),
        "calmar": round(cagr / abs(mdd), 2) if mdd < 0 else None,
        "trades": len(trades), "winRatePct": round(100 * len(wins) / len(trades), 1) if trades else 0.0,
        "profitFactor": round(gp / gl, 2) if gl > 0 else (None if gp == 0 else 99.0),
        "avgWin": round(gp / len(wins), 2) if wins else 0.0, "avgLoss": round(-gl / len(losses), 2) if losses else 0.0,
        "expectancyR": round(float(np.mean([t["r"] for t in trades])), 3) if trades else 0.0,
        "avgBarsHeld": round(float(np.mean([t["bars"] for t in trades])), 1) if trades else 0.0,
        "finalEquity": round(float(equity.iloc[-1]), 2), "netProfit": round(float(equity.iloc[-1] - capital), 2),
    }


def run(symbol: str, strategy: str, interval: str = "1D", params: Params | None = None,
        start: str | None = None, end: str | None = None, oos_split: float = 0.7) -> dict:
    p = params or Params()
    hist = data_mod.get_history(symbol, interval)
    df = hist.df
    if start:
        df = df[df.index >= pd.Timestamp(start, tz="Asia/Kolkata")]
    if end:
        df = df[df.index <= pd.Timestamp(end, tz="Asia/Kolkata")]
    ind = ta.compute_all(df)
    sig = signals(strategy, ind)
    per_day = data_mod.INTERVALS[interval][3]
    bars_per_year = 52 if interval == "1W" else 252 * per_day

    o, h, l, c = (ind[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close"))
    atr = ind["atr"].to_numpy(dtype=float)
    el, xl, es, xs = (sig[k].to_numpy() for k in ("el", "xl", "es", "xs"))
    n = len(ind)
    friction = (p.cost_pct + p.slippage_pct) / 100

    cash = p.capital
    pos = 0          # +qty long, -qty short
    entry_px = stop = target = best = 0.0
    entry_i = 0
    risk_ps = 0.0
    trades: list[dict] = []
    equity = np.empty(n)
    exposure = 0

    def close_pos(i: int, px: float, reason: str) -> None:
        nonlocal cash, pos
        qty = abs(pos)
        if pos > 0:
            proceeds = qty * px * (1 - friction)
            pnl = proceeds - qty * entry_px * (1 + friction)
            cash += proceeds
        else:
            cost = qty * px * (1 + friction)
            pnl = qty * entry_px * (1 - friction) - cost
            cash -= cost
        trades.append({
            "entryTime": ind.index[entry_i].isoformat(), "exitTime": ind.index[i].isoformat(),
            "side": "long" if pos > 0 else "short", "qty": int(qty), "entry": round(entry_px, 2), "exit": round(px, 2),
            "pnl": round(pnl, 2), "returnPct": round(pnl / (qty * entry_px) * 100, 2),
            "r": round(pnl / (qty * risk_ps), 2) if risk_ps > 0 else 0.0, "bars": int(i - entry_i), "exitReason": reason,
        })
        pos = 0

    start_i = int(np.argmax(~np.isnan(atr))) + 1
    for i in range(n):
        # 1) manage open position on this bar (stops checked intrabar)
        if pos != 0 and i > entry_i:
            if pos > 0:
                if o[i] <= stop:
                    close_pos(i, o[i], "stop (gap)")
                elif l[i] <= stop:
                    close_pos(i, stop, "stop")
                elif target and h[i] >= target:
                    close_pos(i, max(target, o[i]), "target")
            else:
                if o[i] >= stop:
                    close_pos(i, o[i], "stop (gap)")
                elif h[i] >= stop:
                    close_pos(i, stop, "stop")
                elif target and l[i] <= target:
                    close_pos(i, min(target, o[i]), "target")
        # 2) execute signals from the previous bar at this bar's open
        if i >= start_i and i > 0:
            j = i - 1
            if pos > 0 and (xl[j] or (p.max_bars and i - entry_i >= p.max_bars)):
                close_pos(i, o[i], "signal exit" if xl[j] else "time stop")
            elif pos < 0 and (xs[j] or (p.max_bars and i - entry_i >= p.max_bars)):
                close_pos(i, o[i], "signal exit" if xs[j] else "time stop")
            if pos == 0 and not np.isnan(atr[j]):
                side = 1 if el[j] else (-1 if (es[j] and p.allow_short) else 0)
                if side:
                    px = o[i]
                    risk_ps = p.stop_atr * atr[j]
                    eq_now = cash
                    max_qty = int(eq_now // (px * (1 + friction)))
                    if p.sizing == "full":
                        qty = max_qty
                    else:
                        qty = int((eq_now * p.risk_pct / 100) // risk_ps) if risk_ps > 0 else 0
                        qty = min(qty, max_qty)
                    if qty > 0:
                        entry_px, entry_i, best = px, i, px
                        stop = px - side * risk_ps
                        target = px + side * p.target_r * risk_ps if p.target_r else 0.0
                        if side > 0:
                            cash -= qty * px * (1 + friction)
                            pos = qty
                        else:
                            cash += qty * px * (1 - friction)
                            pos = -qty
                        # same-bar stop check after entry
                        if side > 0 and l[i] <= stop:
                            close_pos(i, stop, "stop")
                        elif side < 0 and h[i] >= stop:
                            close_pos(i, stop, "stop")
        # 3) trail stop on close
        if pos != 0 and p.trail_atr and not np.isnan(atr[i]):
            if pos > 0:
                best = max(best, c[i])
                stop = max(stop, best - p.trail_atr * atr[i])
            else:
                best = min(best, c[i])
                stop = min(stop, best + p.trail_atr * atr[i])
        if pos != 0:
            exposure += 1
        equity[i] = cash + (pos * c[i] if pos > 0 else (pos * c[i] if pos < 0 else 0))
    if pos != 0:
        close_pos(n - 1, c[-1], "end of data")
        equity[-1] = cash

    eq = pd.Series(equity, index=ind.index)
    bench = p.capital * c / c[start_i]
    bench_s = pd.Series(bench, index=ind.index).iloc[start_i:]
    eq_s = eq.iloc[start_i:]
    m = _metrics(eq_s, trades, bars_per_year, p.capital)
    m["exposurePct"] = round(100 * exposure / max(1, n - start_i), 1)
    bm = _metrics(bench_s, [], bars_per_year, p.capital)

    split_i = start_i + int((n - start_i) * oos_split)
    split_t = ind.index[min(split_i, n - 1)]
    is_tr = [t for t in trades if pd.Timestamp(t["entryTime"]) < split_t]
    oos_tr = [t for t in trades if pd.Timestamp(t["entryTime"]) >= split_t]
    in_s = _metrics(eq.iloc[start_i:split_i], is_tr, bars_per_year, float(eq.iloc[start_i]))
    out_s = _metrics(eq.iloc[split_i:], oos_tr, bars_per_year, float(eq.iloc[split_i])) if split_i < n - 5 else {}

    # monthly returns (daily/weekly data only)
    monthly: list[dict] = []
    if interval in ("1D", "1W"):
        try:
            me = eq_s.resample("ME").last()
        except ValueError:  # pandas < 2.2
            me = eq_s.resample("M").last()
        mr = me.pct_change().dropna()
        for t, v in mr.items():
            monthly.append({"year": t.year, "month": t.month, "returnPct": round(float(v) * 100, 2)})

    step = max(1, len(eq_s) // 400)
    curve = [{"time": t.isoformat(), "equity": round(float(v), 2), "benchmark": round(float(b), 2),
              "drawdownPct": round(float(d) * 100, 2)}
             for (t, v), b, d in zip(eq_s.iloc[::step].items(), bench_s.iloc[::step], (eq_s / eq_s.cummax() - 1).iloc[::step])]
    verdict = []
    if m.get("trades", 0) < 15:
        verdict.append("Fewer than 15 trades - results are not statistically meaningful.")
    if m.get("cagrPct", 0) < bm.get("cagrPct", 0):
        verdict.append("Underperformed buy-and-hold on CAGR.")
    if m.get("maxDrawdownPct", 0) > bm.get("maxDrawdownPct", -100):
        verdict.append("Smaller drawdown than buy-and-hold.")
    if out_s and in_s and out_s.get("sharpe", 0) < 0.5 * in_s.get("sharpe", 0) and in_s.get("sharpe", 0) > 0:
        verdict.append("Out-of-sample Sharpe fell by more than half - possible curve-fitting.")
    return {
        "symbol": symbol, "strategy": strategy, "strategyInfo": STRATEGIES[strategy], "interval": interval,
        "dataSource": hist.source, "from": ind.index[start_i].isoformat(), "to": ind.index[-1].isoformat(),
        "bars": int(n - start_i), "params": p.__dict__,
        "metrics": m, "benchmark": bm, "inSample": in_s, "outOfSample": out_s, "splitDate": split_t.isoformat(),
        "equityCurve": curve, "trades": trades[-150:], "monthly": monthly, "notes": verdict,
    }


def compare(symbol: str, interval: str = "1D", params: Params | None = None) -> list[dict]:
    rows = []
    for sid in STRATEGIES:
        try:
            r = run(symbol, sid, interval, params)
            m = r["metrics"]
            rows.append({"strategy": sid, **STRATEGIES[sid], **{k: m.get(k) for k in (
                "cagrPct", "sharpe", "maxDrawdownPct", "winRatePct", "profitFactor", "trades", "expectancyR", "exposurePct")},
                "oosSharpe": r["outOfSample"].get("sharpe") if r["outOfSample"] else None,
                "benchmarkCagrPct": r["benchmark"].get("cagrPct")})
        except Exception as exc:  # noqa: BLE001
            rows.append({"strategy": sid, **STRATEGIES[sid], "error": str(exc)})
    rows.sort(key=lambda x: -(x.get("sharpe") or -99))
    return rows
