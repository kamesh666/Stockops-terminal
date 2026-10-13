"""Market structure, regime, support/resistance and classical chart patterns.

* Swing pivots -> higher-high / higher-low structure (Dow theory, Rayner Teo)
* Market stage: accumulation / advancing / distribution / declining (Rayner Teo)
* Regime + "tool kit" rules (NSE TA workbook 4.4.5 - 4.4.11)
* RSI regime zones: bull 40/70, bear 30/60 (NSE TA workbook 4.3.1.8)
* S/R zones from clustered pivots (NSE TA workbook 3.1, "zones not lines")
* Double top/bottom, head & shoulders, MBEE build-up, gap theory (NSE TA ch.3)
* Fibonacci retracement of the last swing (NSE TA ch.6, Elliott wave rules)
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd


@dataclass
class Pivot:
    idx: int
    time: str
    price: float
    kind: str  # "H" or "L"


def find_pivots(df: pd.DataFrame, order: int = 5, lookback: int = 300) -> list[Pivot]:
    """Fractal pivots: a high/low that is the extreme of +/- ``order`` bars."""
    d = df.iloc[-lookback:]
    off = len(df) - len(d)
    highs, lows = d["high"].to_numpy(), d["low"].to_numpy()
    piv: list[Pivot] = []
    for i in range(order, len(d) - order):
        h_win = highs[i - order:i + order + 1]
        l_win = lows[i - order:i + order + 1]
        if highs[i] == h_win.max() and (h_win == highs[i]).sum() == 1:
            piv.append(Pivot(off + i, str(d.index[i]), float(highs[i]), "H"))
        if lows[i] == l_win.min() and (l_win == lows[i]).sum() == 1:
            piv.append(Pivot(off + i, str(d.index[i]), float(lows[i]), "L"))
    piv.sort(key=lambda p: p.idx)
    # enforce alternation H/L/H/L keeping the more extreme of consecutive duplicates
    alt: list[Pivot] = []
    for p in piv:
        if alt and alt[-1].kind == p.kind:
            if (p.kind == "H" and p.price >= alt[-1].price) or (p.kind == "L" and p.price <= alt[-1].price):
                alt[-1] = p
        else:
            alt.append(p)
    return alt


def swing_structure(pivots: list[Pivot]) -> dict:
    """Label the last swings HH/LH and HL/LL and summarise the trend."""
    hs = [p for p in pivots if p.kind == "H"][-3:]
    ls = [p for p in pivots if p.kind == "L"][-3:]
    labels = []
    hh = sum(1 for a, b in zip(hs, hs[1:]) if b.price > a.price)
    lh = sum(1 for a, b in zip(hs, hs[1:]) if b.price < a.price)
    hl = sum(1 for a, b in zip(ls, ls[1:]) if b.price > a.price)
    ll = sum(1 for a, b in zip(ls, ls[1:]) if b.price < a.price)
    for a, b in zip(hs, hs[1:]):
        labels.append({"time": b.time, "price": b.price, "label": "HH" if b.price > a.price else "LH"})
    for a, b in zip(ls, ls[1:]):
        labels.append({"time": b.time, "price": b.price, "label": "HL" if b.price > a.price else "LL"})
    labels.sort(key=lambda x: x["time"])
    if hh >= 1 and hl >= 1 and lh == 0 and ll == 0:
        trend = "uptrend"
    elif lh >= 1 and ll >= 1 and hh == 0 and hl == 0:
        trend = "downtrend"
    else:
        trend = "sideways"
    last_high = hs[-1].price if hs else None
    last_low = ls[-1].price if ls else None
    return {"trend": trend, "labels": labels[-6:], "lastSwingHigh": last_high, "lastSwingLow": last_low}


def _slope(s: pd.Series, n: int = 10) -> float:
    s = s.dropna()
    if len(s) < n + 1:
        return 0.0
    return float((s.iloc[-1] - s.iloc[-n - 1]) / s.iloc[-n - 1])


def dow_trends(ind: pd.DataFrame) -> dict:
    """Primary (200), secondary (50) and minor (20) trends as in Dow theory."""
    c = float(ind["close"].iloc[-1])

    def lvl(ma_col: str) -> str:
        ma = ind[ma_col]
        if ma.dropna().empty:
            return "n/a"
        m = float(ma.iloc[-1])
        sl = _slope(ma, 10)
        if c > m and sl > 0:
            return "up"
        if c < m and sl < 0:
            return "down"
        return "sideways"

    return {"primary": lvl("sma200"), "secondary": lvl("sma50"), "minor": lvl("ema20")}


def _base_regime(ind: pd.DataFrame, at: int) -> str:
    row = ind.iloc[at]
    adx_v = row.get("adx", np.nan)
    c, s50, s200 = row["close"], row.get("sma50", np.nan), row.get("sma200", np.nan)
    if np.isnan(s200):
        s200 = s50
    if np.isnan(adx_v) or np.isnan(s50):
        return "trading"
    if adx_v >= 20 and c > s50 and s50 >= s200 and row["plus_di"] > row["minus_di"]:
        return "bull"
    if adx_v >= 20 and c < s50 and s50 <= s200 and row["minus_di"] > row["plus_di"]:
        return "bear"
    return "trading"


TOOLKIT = {
    "trading": [
        "Moving averages: fade breakouts - MA signals whipsaw in a range.",
        "RSI / oscillators: sell overbought, buy oversold (30/70 zones).",
        "Stochastic: sell down-crossovers, buy up-crossovers.",
        "OBV: confirming only, not a forecasting tool.",
    ],
    "bull": [
        "Moving averages: buy the upside crossovers.",
        "RSI: buy oversold readings near 40; ignore overbought signals.",
        "Stochastic: buy up-crossovers, do not sell down-crossovers.",
        "Breakouts of previous highs are buy signals.",
    ],
    "bear": [
        "Moving averages: sell the downside crossovers.",
        "RSI: sell overbought readings near 60; ignore oversold signals.",
        "Stochastic: sell down-crossovers, do not buy up-crossovers.",
        "Breakdowns of previous lows are sell signals.",
    ],
    "trading->bull": [
        "A losing short on a 'false breakout' is the first warning the range is ending.",
        "Buy all stochastic crossovers from oversold; skip overbought signals.",
        "Watch OBV for accumulation - it forecasts upside breakouts well here.",
        "Buy cautiously inside the range, aggressively above the range high.",
    ],
    "trading->bear": [
        "Do not fade breakdowns after a long run-up - the last fade can be a large loss.",
        "Growing count of oversold readings warns of a bear phase.",
        "Stochastic down-crossovers from overbought are more valid than up-crossovers.",
        "OBV gives little warning - respect price breakdowns.",
    ],
    "bull->trading": [
        "Stop buying breakouts; start fading upside breakouts and downside breakdowns carefully.",
        "Overbought and oversold signals become equally valid as the range forms.",
        "Stochastic crossovers from either side can now be traded.",
    ],
    "bear->trading": [
        "Stop selling breakdowns - sell breakouts, buy breakdowns inside the new range.",
        "When overbought and oversold counts equalise, trade both sides.",
        "OBV flattening confirms the down-move has ended (after the fact).",
    ],
}

RSI_ZONES = {"bull": (40, 70), "bear": (30, 60), "trading": (30, 70)}


def regime(ind: pd.DataFrame) -> dict:
    now = _base_regime(ind, -1)
    past = _base_regime(ind, -21) if len(ind) > 25 else now
    key = now if now == past else f"{past}->{now}"
    if key not in TOOLKIT:
        key = now
    lo, hi = RSI_ZONES[now]
    adx_v = float(ind["adx"].iloc[-1]) if not np.isnan(ind["adx"].iloc[-1]) else None
    label = {
        "bull": "Bull market", "bear": "Bear market", "trading": "Trading (range) market",
    }
    title = label[now] if "->" not in key else f"{label[past]} changing to {label[now].lower()}"
    return {
        "key": key,
        "current": now,
        "previous": past,
        "title": title,
        "adx": adx_v,
        "trendStrength": "strong" if adx_v and adx_v >= 30 else "moderate" if adx_v and adx_v >= 20 else "weak/none",
        "rsiZones": {"oversold": lo, "overbought": hi},
        "toolkit": TOOLKIT[key],
    }


def market_stage(ind: pd.DataFrame, struct: dict) -> dict:
    """Rayner Teo's 4 stages: accumulation, advancing, distribution, declining."""
    s50 = ind["sma50"]
    c = ind["close"]
    if s50.dropna().empty:
        return {"stage": "unknown", "explanation": "Not enough history."}
    slope_now = _slope(s50, 10)
    prior_move = float(c.iloc[-21] / c.iloc[-81] - 1) if len(c) > 81 else 0.0
    flat = abs(slope_now) < 0.01
    if struct["trend"] == "uptrend" and slope_now > 0 and c.iloc[-1] > s50.iloc[-1]:
        st, ex = "advancing", "Higher highs and higher lows above a rising 50-MA. Buy pullbacks to value areas."
    elif struct["trend"] == "downtrend" and slope_now < 0 and c.iloc[-1] < s50.iloc[-1]:
        st, ex = "declining", "Lower highs and lower lows below a falling 50-MA. Sell rallies into resistance."
    elif flat and prior_move < -0.05:
        st, ex = "accumulation", "Range after a decline with a flattening 50-MA. Watch for a breakout and higher low."
    elif flat and prior_move > 0.05:
        st, ex = "distribution", "Range after an advance with a flattening 50-MA. Watch for a breakdown and lower high."
    else:
        st, ex = "transition", "Structure is mixed - no clear stage. Rayner Teo: don't force analysis; wait."
    return {"stage": st, "explanation": ex, "ma50Slope10": round(slope_now * 100, 2)}


def sr_zones(df: pd.DataFrame, pivots: list[Pivot], atr_now: float, max_zones: int = 8) -> list[dict]:
    """Cluster pivot prices into zones within 0.6*ATR, scored by touches & recency."""
    if not pivots:
        return []
    tol = max(atr_now * 0.6, float(df["close"].iloc[-1]) * 0.003)
    pts = sorted(pivots, key=lambda p: p.price)
    clusters: list[list[Pivot]] = [[pts[0]]]
    for p in pts[1:]:
        if p.price - clusters[-1][-1].price <= tol:
            clusters[-1].append(p)
        else:
            clusters.append([p])
    n = len(df)
    price = float(df["close"].iloc[-1])
    zones = []
    for cl in clusters:
        prices = [p.price for p in cl]
        recency = max(p.idx for p in cl) / n
        touches = len(cl)
        strength = touches * (0.5 + recency)
        mid = float(np.mean(prices))
        zones.append({
            "low": round(min(prices) - tol * 0.25, 2),
            "high": round(max(prices) + tol * 0.25, 2),
            "mid": round(mid, 2),
            "touches": touches,
            "strength": round(strength, 2),
            "type": "support" if mid < price else "resistance",
            "flipped": any(p.kind == "H" for p in cl) and any(p.kind == "L" for p in cl),
        })
    zones.sort(key=lambda z: -z["strength"])
    zones = zones[:max_zones]
    zones.sort(key=lambda z: z["mid"])
    return zones


def nearest_levels(zones: list[dict], price: float) -> tuple[dict | None, dict | None]:
    sup = [z for z in zones if z["high"] < price or (z["low"] <= price <= z["high"] and z["mid"] <= price)]
    res = [z for z in zones if z["low"] > price or (z["low"] <= price <= z["high"] and z["mid"] > price)]
    s = max(sup, key=lambda z: z["mid"]) if sup else None
    r = min(res, key=lambda z: z["mid"]) if res else None
    return s, r


def chart_patterns(df: pd.DataFrame, pivots: list[Pivot], atr_now: float) -> list[dict]:
    out: list[dict] = []
    price = float(df["close"].iloc[-1])
    n = len(df)
    hs = [p for p in pivots if p.kind == "H"]
    ls = [p for p in pivots if p.kind == "L"]
    tol = max(atr_now * 0.8, price * 0.012)

    # Double top / bottom (NSE TA 3.3): two similar peaks/troughs, >=8 bars apart
    if len(hs) >= 2:
        a, b = hs[-2], hs[-1]
        between = [p for p in ls if a.idx < p.idx < b.idx]
        if between and abs(a.price - b.price) <= tol and b.idx - a.idx >= 8 and n - b.idx <= 40:
            neck = min(p.price for p in between)
            if (min(a.price, b.price) - neck) >= 1.5 * atr_now:
                confirmed = price < neck
                out.append({
                    "name": "Double Top (M)", "bias": "bearish",
                    "status": "confirmed" if confirmed else "forming",
                    "neckline": round(neck, 2),
                    "target": round(neck - (max(a.price, b.price) - neck), 2),
                    "invalidation": round(max(a.price, b.price) + 0.5 * atr_now, 2),
                    "note": "Bearish reversal once price closes below the neckline (the trough between the peaks).",
                })
    if len(ls) >= 2:
        a, b = ls[-2], ls[-1]
        between = [p for p in hs if a.idx < p.idx < b.idx]
        if between and abs(a.price - b.price) <= tol and b.idx - a.idx >= 8 and n - b.idx <= 40:
            neck = max(p.price for p in between)
            if (neck - max(a.price, b.price)) >= 1.5 * atr_now:
                confirmed = price > neck
                out.append({
                    "name": "Double Bottom (W)", "bias": "bullish",
                    "status": "confirmed" if confirmed else "forming",
                    "neckline": round(neck, 2),
                    "target": round(neck + (neck - min(a.price, b.price)), 2),
                    "invalidation": round(min(a.price, b.price) - 0.5 * atr_now, 2),
                    "note": "Bullish reversal once price closes above the neckline (the peak between the troughs).",
                })

    # Head & shoulders / inverse (NSE TA 3.2) on the last 5 alternating pivots
    if len(pivots) >= 5:
        p5 = pivots[-5:]
        kinds = "".join(p.kind for p in p5)
        if kinds == "HLHLH":
            l_sh, l1, head, l2, r_sh = p5
            if head.price > l_sh.price and head.price > r_sh.price and abs(l_sh.price - r_sh.price) <= tol * 1.5 and n - r_sh.idx <= 30:
                neck = (l1.price + l2.price) / 2
                out.append({
                    "name": "Head & Shoulders Top", "bias": "bearish",
                    "status": "confirmed" if price < neck else "forming",
                    "neckline": round(neck, 2), "target": round(neck - (head.price - neck), 2),
                    "invalidation": round(r_sh.price + 0.5 * atr_now, 2),
                    "note": "Major top reversal; sell on a close below the neckline, target = head-to-neckline height.",
                })
        if kinds == "LHLHL":
            l_sh, h1, head, h2, r_sh = p5
            if head.price < l_sh.price and head.price < r_sh.price and abs(l_sh.price - r_sh.price) <= tol * 1.5 and n - r_sh.idx <= 30:
                neck = (h1.price + h2.price) / 2
                out.append({
                    "name": "Inverse Head & Shoulders", "bias": "bullish",
                    "status": "confirmed" if price > neck else "forming",
                    "neckline": round(neck, 2), "target": round(neck + (neck - head.price), 2),
                    "invalidation": round(r_sh.price - 0.5 * atr_now, 2),
                    "note": "Bottom reversal; buy on a close above the neckline with rising volume.",
                })
    return out


def buildup(ind: pd.DataFrame, zones: list[dict], bars: int = 8) -> dict | None:
    """MBEE 'build-up': a tight cluster of narrow candles pressed against a level."""
    if len(ind) < 40:
        return None
    w = ind.iloc[-bars:]
    atr_now = float(ind["atr"].iloc[-1])
    rng = float(w["high"].max() - w["low"].min())
    avg_spread = float(w["spread"].mean())
    if rng > 1.8 * atr_now or avg_spread > 0.85 * float(ind["spread_sma20"].iloc[-bars - 1]):
        return None
    top, bot = float(w["high"].max()), float(w["low"].min())
    near_res = any(abs(z["mid"] - top) <= atr_now and z["mid"] >= bot for z in zones)
    near_sup = any(abs(z["mid"] - bot) <= atr_now and z["mid"] <= top for z in zones)
    ma20 = float(ind["ema20"].iloc[-1])
    if near_res and not near_sup:
        bias, trig = "bullish", f"Buy-stop above {top:.2f}"
        stop = bot - atr_now
    elif near_sup and not near_res:
        bias, trig = "bearish", f"Sell-stop below {bot:.2f}"
        stop = top + atr_now
    else:
        bias = "bullish" if ind["close"].iloc[-1] > ma20 else "bearish"
        trig = f"Breakout of {bot:.2f} - {top:.2f} box"
        stop = bot - atr_now if bias == "bullish" else top + atr_now
    return {
        "name": "Build-up (MBEE)", "bias": bias, "boxHigh": round(top, 2), "boxLow": round(bot, 2),
        "tightness": round(rng / atr_now, 2), "trigger": trig, "stop": round(stop, 2),
        "ma20CaughtUp": bool(bot <= ma20 <= top),
        "note": "Tight consolidation stores energy; trade the breakout with a stop 1 ATR beyond the box. Best when the 20-MA has caught up with the box.",
    }


def gaps(ind: pd.DataFrame, lookback: int = 60) -> list[dict]:
    """Gap theory (NSE TA 3.4): common, breakaway, runaway, exhaustion; filled or not."""
    out = []
    d = ind.iloc[-lookback - 1:]
    for i in range(1, len(d)):
        prev, cur = d.iloc[i - 1], d.iloc[i]
        up = cur["low"] > prev["high"]
        dn = cur["high"] < prev["low"]
        if not (up or dn):
            continue
        size = (cur["low"] - prev["high"]) if up else (prev["low"] - cur["high"])
        if size < 0.15 * (cur["atr"] if not np.isnan(cur["atr"]) else size):
            continue
        after = d.iloc[i + 1:]
        filled = bool((after["low"] <= prev["high"]).any()) if up else bool((after["high"] >= prev["low"]).any())
        vol_ratio = cur["volume"] / cur["vol_sma20"] if cur.get("vol_sma20") and cur["vol_sma20"] > 0 else 1.0
        adx_v = prev["adx"] if not np.isnan(prev["adx"]) else 15
        ext = abs(cur["close"] - cur["sma50"]) / cur["atr"] if not np.isnan(cur["sma50"]) and cur["atr"] > 0 else 0
        rsi_v = cur["rsi"]
        if adx_v < 20 and vol_ratio >= 1.3:
            kind = "breakaway"
        elif ext > 4 and ((up and rsi_v > 72) or (dn and rsi_v < 28)):
            kind = "exhaustion"
        elif adx_v >= 25 and ((up and cur["plus_di"] > cur["minus_di"]) or (dn and cur["minus_di"] > cur["plus_di"])):
            kind = "runaway"
        else:
            kind = "common"
        out.append({
            "time": str(d.index[i]), "direction": "up" if up else "down", "kind": kind,
            "from": round(float(prev["high"] if up else prev["low"]), 2),
            "to": round(float(cur["low"] if up else cur["high"]), 2),
            "filled": filled, "volumeRatio": round(float(vol_ratio), 2),
        })
    # island reversal: opposite unfilled gaps within 10 bars
    for a, b in zip(out, out[1:]):
        if a["direction"] != b["direction"]:
            ta, tb = pd.Timestamp(a["time"]), pd.Timestamp(b["time"])
            ia, ib = ind.index.get_loc(ta), ind.index.get_loc(tb)
            if 0 < ib - ia <= 10:
                b["kind"] = "island reversal"
    return out[-6:]


def fibonacci(struct_pivots: list[Pivot]) -> dict | None:
    if len(struct_pivots) < 2:
        return None
    a, b = struct_pivots[-2], struct_pivots[-1]
    lo, hi = min(a.price, b.price), max(a.price, b.price)
    up_leg = b.kind == "H"
    levels = {}
    for r in (0.236, 0.382, 0.5, 0.618, 0.786):
        levels[str(r)] = round(hi - (hi - lo) * r, 2) if up_leg else round(lo + (hi - lo) * r, 2)
    return {"swingFrom": round(a.price, 2), "swingTo": round(b.price, 2), "direction": "up" if up_leg else "down", "levels": levels}


def pivots_to_dicts(p: list[Pivot]) -> list[dict]:
    return [asdict(x) for x in p]
