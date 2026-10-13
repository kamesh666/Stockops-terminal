"""Full technical report for one instrument: indicators, structure, candles, VSA,
volatility, a transparent confluence score, named setups and a risk-sized trade plan."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from . import candles as candle_mod
from . import data as data_mod
from . import indicators as ta
from . import options as opt
from . import structure as st
from . import universe
from . import vsa as vsa_mod


# ---------------------------------------------------------------- utils
def clean(o: Any) -> Any:
    """Make numpy / NaN values JSON-safe."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return o.isoformat()
    return o


def _f(x) -> float | None:
    try:
        v = float(x)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def _round_number_step(price: float, is_index: bool) -> float:
    if is_index:
        return 100.0
    return 50.0 if price > 2000 else 10.0 if price > 500 else 5.0 if price > 100 else 1.0


def avoid_round_number(stop: float, direction: str, price: float, is_index: bool) -> float:
    """Master the Markets: 'avoid even numbers when placing your stops'."""
    step = _round_number_step(price, is_index)
    nearest = round(stop / step) * step
    if abs(stop - nearest) <= step * 0.15:
        buffer = step * 0.2
        return round(nearest - buffer, 2) if direction == "long" else round(nearest + buffer, 2)
    return round(stop, 2)


# ---------------------------------------------------------------- scoring
def _factor(name: str, weight: float, score: float, value: str, why: str, group: str) -> dict:
    score = max(-1.0, min(1.0, score))
    return {"factor": name, "group": group, "weight": weight, "score": round(score, 2),
            "contribution": round(weight * score, 2), "value": value, "reading": why}


def confluence(ind: pd.DataFrame, reg: dict, struct: dict, dow: dict, cndl: list[dict], vsa: dict,
               rs: dict | None, patterns: list[dict]) -> dict:
    last = ind.iloc[-1]
    prev = ind.iloc[-2]
    f: list[dict] = []
    c = float(last["close"])

    # 1-2 Dow trends
    m = {"up": 1, "down": -1, "sideways": 0, "n/a": 0}
    f.append(_factor("Primary trend (200-SMA)", 14, m[dow["primary"]], dow["primary"], "Dow theory primary trend - trade with it.", "trend"))
    f.append(_factor("Secondary trend (50-SMA)", 9, m[dow["secondary"]], dow["secondary"], "Intermediate trend.", "trend"))
    # 3 structure
    sm = {"uptrend": 1, "downtrend": -1, "sideways": 0}[struct["trend"]]
    f.append(_factor("Market structure", 10, sm, struct["trend"], "Higher highs/lows = uptrend; lower highs/lows = downtrend.", "trend"))
    # 4 ADX / DMI
    adx_v, pdi, mdi = _f(last["adx"]), _f(last["plus_di"]), _f(last["minus_di"])
    if adx_v is not None:
        dirn = 1 if pdi > mdi else -1
        strength = min(1.0, max(0.0, (adx_v - 15) / 20))
        f.append(_factor("ADX / DMI", 9, dirn * strength, f"ADX {adx_v:.1f}, +DI {pdi:.1f} / -DI {mdi:.1f}",
                         "ADX > 25 = trending (CFI); below 20 = no trend.", "trend"))
    # 5 MACD
    mac, sig = _f(last["macd"]), _f(last["macd_signal"])
    if mac is not None and sig is not None:
        s = (0.6 if mac > sig else -0.6) + (0.4 if mac > 0 else -0.4)
        cross = ""
        if prev["macd"] <= prev["macd_signal"] and mac > sig:
            cross = " - fresh bullish crossover"
        elif prev["macd"] >= prev["macd_signal"] and mac < sig:
            cross = " - fresh bearish crossover"
        if reg["current"] == "trading":
            s *= 0.4  # "MACD should be avoided in trading markets"
        f.append(_factor("MACD (12,26,9)", 7, s, f"{mac:.2f} vs signal {sig:.2f}{cross}",
                         "Fast above slow and above zero = bullish momentum; weak in ranges.", "momentum"))
    # 6 RSI, regime-aware zones
    r = _f(last["rsi"])
    if r is not None:
        lo, hi = reg["rsiZones"]["oversold"], reg["rsiZones"]["overbought"]
        if reg["current"] == "bull":
            s = 1.0 if r <= lo + 5 else 0.5 if r < hi else 0.2
            why = f"Bull regime zones {lo}/{hi}: dips to ~{lo} are buys, overbought is ignored."
        elif reg["current"] == "bear":
            s = -1.0 if r >= hi - 5 else -0.5 if r > lo else -0.2
            why = f"Bear regime zones {lo}/{hi}: rallies to ~{hi} are sells, oversold is ignored."
        else:
            s = 1.0 if r <= lo else -1.0 if r >= hi else (50 - r) / 40
            why = "Range regime: buy oversold (<30), sell overbought (>70)."
        f.append(_factor("RSI (14)", 8, s, f"{r:.1f}", why, "momentum"))
    # 7 Stochastic crossover per tool kit
    k, d = _f(last["stoch_k"]), _f(last["stoch_d"])
    if k is not None and d is not None:
        up_x = prev["stoch_k"] <= prev["stoch_d"] and k > d
        dn_x = prev["stoch_k"] >= prev["stoch_d"] and k < d
        s = 0.0
        if up_x and reg["current"] != "bear":
            s = 1.0 if k < 30 else 0.5
        elif dn_x and reg["current"] != "bull":
            s = -1.0 if k > 70 else -0.5
        else:
            s = 0.3 if k > d else -0.3
        f.append(_factor("Stochastic (14,3,3)", 5, s, f"%K {k:.1f} / %D {d:.1f}" + (" up-cross" if up_x else " down-cross" if dn_x else ""),
                         "Tool kit: in bulls buy up-crosses only; in bears sell down-crosses only.", "momentum"))
    # 8 Bollinger
    bu, bl, bw = _f(last["bb_upper"]), _f(last["bb_lower"]), ind["bb_width"].dropna()
    if bu is not None and bl is not None and len(bw) > 120:
        pct_b = (c - bl) / (bu - bl) if bu > bl else 0.5
        squeeze = float((bw.iloc[-126:] < bw.iloc[-1]).mean()) < 0.1
        if reg["current"] == "trading":
            s = (0.5 - pct_b) * 2
            why = "Range: upper band resists, lower band supports."
        else:
            s = (pct_b - 0.5) * 1.2
            why = "Trend: closes outside the band signal continuation."
        f.append(_factor("Bollinger %B", 5, s, f"%B {pct_b:.2f}" + (" | SQUEEZE" if squeeze else ""), why, "volatility"))
    # 9 candlesticks (last 3 bars)
    recent = [x for x in cndl if x["barsAgo"] <= 2]
    if recent:
        best = max(recent, key=lambda x: x["score"])
        s = (1 if best["bias"] == "bullish" else -1) * min(1.0, best["score"] / 5)
        f.append(_factor("Candlestick trigger", 10, s, f"{best['name']} ({best['barsAgo']} bars ago, score {best['score']})",
                         best["description"], "price action"))
    else:
        f.append(_factor("Candlestick trigger", 10, 0, "none in last 3 bars", "No entry trigger yet.", "price action"))
    # 10 VSA
    if vsa.get("available"):
        diff = vsa["strengthScore"] - vsa["weaknessScore"]
        f.append(_factor("Volume Spread Analysis", 10, math.tanh(diff / 2), vsa["bias"],
                         "Strength appears on down-bars, weakness on up-bars (Tom Williams).", "volume"))
    # 11 relative strength
    if rs and rs.get("available"):
        s = {"stronger than index": 1, "weaker than index": -1}.get(rs["verdict"], 0)
        f.append(_factor("Relative strength vs parent", 5, s, rs["verdict"], rs["note"], "volume"))
    # 12 MFI / OBV
    mf = _f(last["mfi"])
    if mf is not None:
        obv = ind["obv"]
        obv_slope = float(obv.iloc[-1] - obv.iloc[-21]) if len(obv) > 21 else 0
        s = (0.5 if obv_slope > 0 else -0.5) + (0.5 if mf <= 20 else -0.5 if mf >= 80 else 0)
        f.append(_factor("Money flow (MFI + OBV)", 4, s, f"MFI {mf:.0f}, OBV {'rising' if obv_slope > 0 else 'falling'}",
                         "MFI >80 overbought / <20 oversold; OBV shows accumulation.", "volume"))
    # 13 Elder impulse
    imp = int(last["impulse"])
    f.append(_factor("Elder impulse", 5, imp, {1: "green", -1: "red", 0: "blue"}[imp],
                     "EMA13 and MACD-histogram rising together = bulls in control.", "momentum"))
    # 14 divergences
    div_r = ta.divergence(ind["close"], ind["rsi"])
    div_m = ta.divergence(ind["close"], ind["macd"])
    divs = [x for x in (div_r, div_m) if x]
    if divs:
        s = sum(1 if x == "bullish" else -1 for x in divs) / 2
        f.append(_factor("Divergence (RSI/MACD)", 8, s, ", ".join(sorted(set(divs))),
                         "Price/oscillator disagreement warns of a trend change.", "momentum"))
    # 15 chart patterns
    if patterns:
        s = sum((1 if p["bias"] == "bullish" else -1) * (1 if p["status"] == "confirmed" else 0.4) for p in patterns)
        f.append(_factor("Chart patterns", 8, s, "; ".join(f"{p['name']} ({p['status']})" for p in patterns),
                         "Classical reversal patterns confirm on a neckline break.", "price action"))

    total_w = sum(x["weight"] for x in f)
    raw = sum(x["contribution"] for x in f)
    score = round(100 * raw / total_w, 1) if total_w else 0.0
    bulls = sum(1 for x in f if x["score"] > 0.15)
    bears = sum(1 for x in f if x["score"] < -0.15)
    if score >= 35:
        verdict = "Strong bullish"
    elif score >= 15:
        verdict = "Bullish"
    elif score <= -35:
        verdict = "Strong bearish"
    elif score <= -15:
        verdict = "Bearish"
    else:
        verdict = "Neutral / no edge"
    return {"score": score, "verdict": verdict, "bullishFactors": bulls, "bearishFactors": bears,
            "agreementPct": round(100 * max(bulls, bears) / max(1, bulls + bears), 1), "factors": f}


# ---------------------------------------------------------------- setups
def setups(ind: pd.DataFrame, stage: dict, struct: dict, zones: list[dict], cndl: list[dict], build: dict | None) -> list[dict]:
    out = []
    last = ind.iloc[-1]
    c, atr_v = float(last["close"]), float(last["atr"])
    sup, res = st.nearest_levels(zones, c)
    trig = [x for x in cndl if x["barsAgo"] <= 2]

    # MAEE reversal: Market structure, Area of value, Entry trigger, Exits
    bull_trig = [x for x in trig if x["bias"] == "bullish"]
    bear_trig = [x for x in trig if x["bias"] == "bearish"]
    at_sup = sup and (c - sup["high"]) <= atr_v
    at_res = res and (res["low"] - c) <= atr_v
    ema50 = _f(last["ema50"])
    at_ma = ema50 is not None and abs(c - ema50) <= 0.6 * atr_v
    if bull_trig and (at_sup or at_ma) and stage["stage"] in ("advancing", "accumulation", "transition"):
        t = max(bull_trig, key=lambda x: x["score"])
        area = f"support {sup['low']}-{sup['high']}" if at_sup else f"50-EMA {ema50:.2f}"
        stop = (sup["low"] if at_sup else t["low"]) - atr_v
        out.append({"name": "MAEE Reversal (long)", "bias": "bullish", "active": True,
                    "detail": f"{stage['stage']} stage, price at {area}, trigger {t['name']}.",
                    "entry": round(c, 2), "stop": round(stop, 2), "target": res["low"] if res else None,
                    "source": "Rayner Teo - MAEE formula"})
    if bear_trig and (at_res or at_ma) and stage["stage"] in ("declining", "distribution", "transition"):
        t = max(bear_trig, key=lambda x: x["score"])
        area = f"resistance {res['low']}-{res['high']}" if at_res else f"50-EMA {ema50:.2f}"
        stop = (res["high"] if at_res else t["high"]) + atr_v
        out.append({"name": "MAEE Reversal (short)", "bias": "bearish", "active": True,
                    "detail": f"{stage['stage']} stage, price at {area}, trigger {t['name']}.",
                    "entry": round(c, 2), "stop": round(stop, 2), "target": sup["high"] if sup else None,
                    "source": "Rayner Teo - MAEE formula"})
    # MBEE breakout
    if build:
        out.append({"name": "MBEE Breakout", "bias": build["bias"], "active": True,
                    "detail": f"Build-up {build['boxLow']}-{build['boxHigh']} ({build['tightness']}x ATR). {build['trigger']}."
                              + (" 20-MA has caught up." if build["ma20CaughtUp"] else ""),
                    "entry": build["boxHigh"] if build["bias"] == "bullish" else build["boxLow"],
                    "stop": build["stop"], "target": None, "source": "Rayner Teo - MBEE formula"})
    # Golden / death cross
    s50, s200 = ind["sma50"], ind["sma200"]
    if s200.notna().iloc[-1]:
        above = s50 > s200
        cross_idx = np.where(above.astype(int).diff().fillna(0).to_numpy() != 0)[0]
        bars_since = len(ind) - 1 - cross_idx[-1] if len(cross_idx) else None
        state = "Golden cross (50 > 200)" if above.iloc[-1] else "Death cross (50 < 200)"
        out.append({"name": state, "bias": "bullish" if above.iloc[-1] else "bearish",
                    "active": bars_since is not None and bars_since <= 20,
                    "detail": f"Long-term trend filter. Last cross {bars_since} bars ago." if bars_since is not None else "Long-term trend filter.",
                    "source": "CFI - Golden cross strategy"})
    # Simple ADX
    adx_v = _f(last["adx"])
    if adx_v is not None:
        trending = adx_v >= 25
        dirn = "bullish" if last["plus_di"] > last["minus_di"] else "bearish"
        out.append({"name": "Simple ADX trend", "bias": dirn if trending else "neutral", "active": trending,
                    "detail": f"ADX {adx_v:.1f} {'>= 25: trend - hold in direction of price' if trending else '< 25: range - stand aside from trend trades'}.",
                    "source": "CFI - Simple ADX strategy"})
    # 5-8-13 ribbon
    e5, e8, e13 = _f(last["ema5"]), _f(last["ema8"]), _f(last["ema13"])
    if None not in (e5, e8, e13):
        if e5 > e8 > e13 and c > e5:
            rb, det = "bullish", "EMAs fanned out upward, closes above the 5-EMA - strong uptrend."
        elif e5 < e8 < e13 and c < e5:
            rb, det = "bearish", "EMAs fanned out downward, closes below the 5-EMA - strong downtrend."
        else:
            rb, det = "neutral", "EMAs tangled/flat - consolidation."
        out.append({"name": "5/8/13 EMA ribbon", "bias": rb, "active": rb != "neutral", "detail": det,
                    "source": "CFI - 5,8,13 Fibonacci strategy"})
    # Elder impulse
    imp = int(last["impulse"])
    out.append({"name": "Elder impulse system", "bias": {1: "bullish", -1: "bearish", 0: "neutral"}[imp], "active": imp != 0,
                "detail": {1: "Green bar: EMA13 & MACD-hist both rising - longs allowed, exit when either turns down.",
                           -1: "Red bar: both falling - shorts allowed.",
                           0: "Blue bar: indicators disagree - no new momentum entries."}[imp],
                "source": "NSE TA workbook 5.2.2 - Elder impulse"})
    # Bollinger squeeze
    bw = ind["bb_width"].dropna()
    if len(bw) > 126:
        pct = float((bw.iloc[-126:] < bw.iloc[-1]).mean())
        if pct < 0.1:
            out.append({"name": "Bollinger squeeze", "bias": "neutral", "active": True,
                        "detail": "Band-width at a 6-month low - a big move usually follows the contraction.",
                        "source": "NSE TA workbook 4.3.2.5"})
    return out


# ---------------------------------------------------------------- plan
def trade_plan(sym: universe.Instrument, ind: pd.DataFrame, score: dict, zones: list[dict], close: pd.Series,
               capital: float, risk_pct: float, holding_days: int, vsa: dict, rs: dict | None,
               parent_trend: str | None, struct: dict) -> dict:
    last = ind.iloc[-1]
    c, atr_v = float(last["close"]), float(last["atr"])
    sc = score["score"]
    if abs(sc) < 15:
        return {"direction": "none", "reason": "Confluence score inside +/-15 - no directional edge. Consider a neutral options strategy or wait.",
                "checklist": []}
    direction = "long" if sc > 0 else "short"
    sup, res = st.nearest_levels(zones, c)

    # structure stop: beyond the area of value + 1 ATR buffer (Rayner Teo)
    if direction == "long":
        struct_stop = (sup["low"] - atr_v) if sup and c - sup["low"] <= 3 * atr_v else c - 1.5 * atr_v
    else:
        struct_stop = (res["high"] + atr_v) if res and res["high"] - c <= 3 * atr_v else c + 1.5 * atr_v
    vol_stop = opt.volatility_stop(close, c, direction, holding_days)
    # use the wider of the two so noise doesn't take us out, capped at 3 ATR
    if direction == "long":
        stop = max(min(struct_stop, vol_stop), c - 3 * atr_v)
    else:
        stop = min(max(struct_stop, vol_stop), c + 3 * atr_v)
    stop = avoid_round_number(stop, direction, c, sym.is_index)
    risk_ps = abs(c - stop)

    # targets: nearest opposing zone (don't trade into traffic), 2R, next zone
    # a zone price is already testing (within 0.5 ATR) is the hurdle, not the target
    hurdle = None
    if direction == "long":
        hurdle = next((z for z in zones if z["low"] - 0.5 * atr_v <= c <= z["high"] and z["mid"] >= c - 0.25 * atr_v), None)
        opp = [z for z in zones if z["low"] > c + 0.5 * atr_v]
    else:
        hurdle = next((z for z in zones if z["low"] <= c <= z["high"] + 0.5 * atr_v and z["mid"] <= c + 0.25 * atr_v), None)
        opp = [z for z in zones if z["high"] < c - 0.5 * atr_v]
    opp.sort(key=lambda z: abs(z["mid"] - c))
    # targets: nearest opposing zones first (don't trade into traffic), then 2R / 3R
    sgn = 1 if direction == "long" else -1
    cands = [(z["low"] if direction == "long" else z["high"]) for z in opp[:3]]
    cands += [c + sgn * 2 * risk_ps, c + sgn * 3 * risk_ps]
    cands = sorted({round(x, 2) for x in cands}, key=lambda x: sgn * (x - c))
    targets: list[float] = []
    for x in cands:
        if not targets or abs(x - targets[-1]) >= 0.25 * risk_ps:
            targets.append(x)
    t1, t2, t3 = (targets + [targets[-1]] * 3)[:3]
    rr1 = abs(t1 - c) / risk_ps if risk_ps else 0

    risk_amt = capital * risk_pct / 100
    qty = int(risk_amt // risk_ps) if risk_ps > 0 else 0
    lots = qty // sym.lot_size if sym.lot_size > 1 else None
    one_lot_risk = round(risk_ps * sym.lot_size, 2) if sym.lot_size > 1 else None
    notional = qty * c

    # Master the Markets checklist
    lows = ind["low"].iloc[-4:].to_numpy()
    highs = ind["high"].iloc[-4:].to_numpy()
    persistent = bool(np.all(np.diff(lows) > 0)) if direction == "long" else bool(np.all(np.diff(highs) < 0))
    chasing = (c - float(last["ema20"])) > 2 * atr_v if direction == "long" else (float(last["ema20"]) - c) > 2 * atr_v
    obstacle = (res and (res["low"] - c) < atr_v) if direction == "long" else (sup and (c - sup["high"]) < atr_v)
    mid_range = bool(sup and res and (c - sup["high"]) > atr_v and (res["low"] - c) > atr_v)
    bg_ok = (vsa.get("bias") == "strength in background") if direction == "long" else (vsa.get("bias") == "weakness in background")
    parent_ok = parent_trend is None or parent_trend == ("up" if direction == "long" else "down")
    rs_ok = None
    if rs and rs.get("available"):
        rs_ok = rs["verdict"] == ("stronger than index" if direction == "long" else "weaker than index")
    trend_ok = struct["trend"] == ("uptrend" if direction == "long" else "downtrend")
    checklist = [
        {"item": "Trend structure agrees (higher lows for longs / lower highs for shorts)", "pass": trend_ok},
        {"item": "Persistent support / no support (lows rising, or highs falling, for 3 bars)", "pass": persistent},
        {"item": "Not chasing - price within 2 ATR of the 20-EMA", "pass": not chasing},
        {"item": "Signs of " + ("strength" if direction == "long" else "weakness") + " in the background (VSA)", "pass": bg_ok if vsa.get("available") else None},
        {"item": "No " + ("resistance" if direction == "long" else "support") + " within 1 ATR (don't trade into traffic)", "pass": not obstacle},
        {"item": "Not in the middle of a trading range", "pass": not mid_range},
        {"item": "In harmony with the parent index", "pass": parent_ok if parent_trend else None},
        {"item": "Acting " + ("stronger" if direction == "long" else "weaker") + " than the parent index", "pass": rs_ok},
        {"item": "Reward:risk to first target >= 1.5", "pass": rr1 >= 1.5},
        {"item": "Stop outside the 1-SD expected move and away from round numbers", "pass": True},
    ]
    passed = sum(1 for x in checklist if x["pass"] is True)
    failed = sum(1 for x in checklist if x["pass"] is False)
    grade = "A" if failed == 0 else "B" if failed <= 1 else "C" if failed <= 3 else "D"
    return {
        "direction": direction,
        "entry": round(c, 2), "stop": round(stop, 2),
        "structureStop": round(struct_stop, 2), "volatilityStop": vol_stop,
        "targets": [round(t1, 2), round(t2, 2), round(t3, 2)],
        "riskPerShare": round(risk_ps, 2), "rewardRiskT1": round(rr1, 2),
        "riskAmount": round(risk_amt, 2), "quantity": qty, "lots": lots, "lotSize": sym.lot_size,
        "notional": round(notional, 2), "oneLotRisk": one_lot_risk,
        "lotNote": (f"1 lot risks Rs {one_lot_risk:,.0f} at this stop - more than your {risk_pct}% budget; trade equity or a defined-risk spread instead."
                    if one_lot_risk and lots == 0 else ""),
        "hurdle": hurdle,
        "entryTrigger": (f"Price is testing {'resistance' if direction == 'long' else 'support'} {hurdle['low']}-{hurdle['high']} - "
                         f"enter only on a close {'above ' + str(hurdle['high']) if direction == 'long' else 'below ' + str(hurdle['low'])}.") if hurdle else "Enter at market / on the next bar's open.",
        "trailing": "Trail the stop under each new swing low (long) / above each swing high (short), or under the 20-EMA once T1 is hit.",
        "checklist": checklist, "checklistPassed": passed, "checklistFailed": failed, "grade": grade,
        "skip": rr1 < 1.5,
        "reason": ("Reward:risk below 1.5 to the nearest " + ("resistance" if direction == "long" else "support") + " - skip or wait for a better entry.") if rr1 < 1.5 else "",
    }


# ---------------------------------------------------------------- main
def chart_payload(ind: pd.DataFrame, bars: int) -> list[dict]:
    d = ind.iloc[-bars:]
    rows = []
    for t, r in d.iterrows():
        rows.append({
            "time": t.isoformat(), "open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"],
            "volume": r["volume"], "ema20": r["ema20"], "sma50": r["sma50"], "sma200": r["sma200"], "vwap": r["vwap"],
            "bbUpper": r["bb_upper"], "bbLower": r["bb_lower"], "rsi": r["rsi"], "macd": r["macd"],
            "macdSignal": r["macd_signal"], "macdHist": r["macd_hist"], "adx": r["adx"],
        })
    return rows


def analyse(symbol: str, interval: str = "1D", capital: float = 100000, risk_pct: float = 1.0,
            holding_days: int = 5, iv_pct: float | None = None, chart_bars: int = 120) -> dict:
    sym = universe.get(symbol)
    hist = data_mod.get_history(symbol, interval)
    df = hist.df
    if len(df) < 60:
        raise ValueError(f"Not enough history for {symbol} ({len(df)} bars)")
    ind = ta.compute_all(df)
    atr_now = float(ind["atr"].iloc[-1])
    pivots = st.find_pivots(ind, order=5 if interval in ("1D", "1W") else 4)
    struct = st.swing_structure(pivots)
    dow = st.dow_trends(ind)
    reg = st.regime(ind)
    stage = st.market_stage(ind, struct)
    zones = st.sr_zones(ind, pivots, atr_now)
    sup, res = st.nearest_levels(zones, float(ind["close"].iloc[-1]))
    patterns = st.chart_patterns(ind, pivots, atr_now)
    build = st.buildup(ind, zones)
    gp = st.gaps(ind)
    fib = st.fibonacci(pivots)
    cndl = candle_mod.detect(ind, lookback=30, zones=zones)
    vsa = vsa_mod.analyse(ind)
    vsa.pop("all", None)

    rs = None
    parent_trend = None
    if sym.symbol != sym.parent:
        try:
            ph = data_mod.get_history(sym.parent, interval)
            rs = vsa_mod.relative_strength(df["close"], ph.df["close"])
            pind = ta.compute_all(ph.df)
            parent_trend = st.dow_trends(pind)["secondary"]
        except Exception:  # noqa: BLE001
            rs = None

    score = confluence(ind, reg, struct, dow, cndl, vsa, rs, patterns)
    sets = setups(ind, stage, struct, zones, cndl, build)
    close_daily = df["close"] if interval in ("1D",) else data_mod.get_history(symbol, "1D").df["close"]
    vol = {
        "hv10": opt.hv(close_daily, 10), "hv20": opt.hv(close_daily, 20), "hv60": opt.hv(close_daily, 60),
        "hvRank": opt.hv_rank(close_daily), "cone": opt.vol_cone(close_daily),
        "expected": opt.expected_ranges(close_daily),
        "atr": atr_now, "atrPct": atr_now / float(df["close"].iloc[-1]) * 100,
    }
    view = ("bullish" if score["score"] >= 15 else "bearish" if score["score"] <= -15
            else ("volatile" if any(s["name"] == "Bollinger squeeze" for s in sets) else "neutral"))
    opts = opt.recommend(sym.symbol, close_daily, view, iv_pct)
    plan = trade_plan(sym, ind, score, zones, close_daily if interval == "1D" else df["close"], capital, risk_pct,
                      holding_days, vsa, rs, parent_trend, struct)

    last = ind.iloc[-1]
    prev_close = float(ind["close"].iloc[-2])
    quote = {
        "symbol": sym.symbol, "name": sym.name, "exchange": sym.exchange, "segment": sym.segment,
        "price": float(last["close"]), "previousClose": prev_close,
        "change": float(last["close"]) - prev_close, "changePercent": (float(last["close"]) / prev_close - 1) * 100,
        "open": float(last["open"]), "high": float(last["high"]), "low": float(last["low"]), "volume": float(last["volume"]),
        "lastBarTime": ind.index[-1].isoformat(),
    }
    indicators = {k: _f(last[k]) for k in ("rsi", "macd", "macd_signal", "macd_hist", "stoch_k", "stoch_d", "willr", "mfi",
                                            "adx", "plus_di", "minus_di", "atr", "ema20", "ema50", "sma20", "sma50", "sma200",
                                            "bb_upper", "bb_mid", "bb_lower", "vwap")}
    indicators["impulse"] = int(last["impulse"])
    return clean({
        "symbol": sym.symbol, "interval": interval, "dataSource": hist.source, "ticker": hist.ticker,
        "bars": len(df), "quote": quote, "indicators": indicators,
        "regime": reg, "dow": dow, "structure": struct, "stage": stage,
        "zones": zones, "nearestSupport": sup, "nearestResistance": res,
        "fibonacci": fib, "chartPatterns": patterns, "buildup": build, "gaps": gp,
        "candlesticks": cndl, "vsa": vsa, "relativeStrength": rs, "parentIndex": sym.parent, "parentTrend": parent_trend,
        "volatility": vol, "confluence": score, "setups": sets, "tradePlan": plan, "options": opts,
        "chart": chart_payload(ind, chart_bars),
    })


def quote_summary(symbol: str) -> dict:
    """Light-weight quote + key indicators, shaped like the app's StockQuote."""
    sym = universe.get(symbol)
    h = data_mod.get_history(symbol, "1D")
    ind = ta.compute_all(h.df)
    last = ind.iloc[-1]
    prev = float(ind["close"].iloc[-2])
    c = float(last["close"])
    pivots = st.find_pivots(ind)
    zones = st.sr_zones(ind, pivots, float(last["atr"]))
    sup, res = st.nearest_levels(zones, c)
    hv20 = opt.hv(ind["close"], 20) or 0.0
    rank = opt.hv_rank(ind["close"]) or 50.0
    return clean({
        "symbol": sym.symbol, "name": sym.name, "segment": sym.segment, "exchange": sym.exchange,
        "price": c, "change": c - prev, "changePercent": (c / prev - 1) * 100,
        "open": float(last["open"]), "high": float(last["high"]), "low": float(last["low"]), "previousClose": prev,
        "volume": float(last["volume"]), "lotSize": sym.lot_size,
        "iv": round(hv20 * 100, 2), "ivRank": rank, "ivIsHvProxy": True,
        "vwap": _f(last["vwap"]), "ema20": _f(last["ema20"]), "sma50": _f(last["sma50"]), "sma200": _f(last["sma200"]),
        "rsi": _f(last["rsi"]), "atr": _f(last["atr"]),
        "support": sup["mid"] if sup else c - 2 * float(last["atr"]),
        "resistance": res["mid"] if res else c + 2 * float(last["atr"]),
        "dataSource": h.source, "lastBarTime": ind.index[-1].isoformat(),
    })
