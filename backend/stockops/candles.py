"""Japanese candlestick recognition (NSE NCFM TA workbook chapter 2 + CFI pin bar).

Every pattern is checked against its *criteria* (shape) and its required *trend
context* (a hammer only counts after a decline, a hanging man after a rise...),
then scored with the workbook's *signal enhancements* (volume, gaps, long
shadows) and Rayner Teo's "strong rejection" / "area of value" rules.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RELIABILITY = {
    "Hammer": 2, "Hanging Man": 2, "Inverted Hammer": 1, "Shooting Star": 2,
    "Bullish Engulfing": 3, "Bearish Engulfing": 3, "Piercing Line": 2, "Dark Cloud Cover": 2,
    "Bullish Harami": 1, "Bearish Harami": 1, "Morning Star": 3, "Evening Star": 3,
    "Doji": 1, "Bullish Pin Bar": 2, "Bearish Pin Bar": 2,
}

DESCRIPTIONS = {
    "Hammer": "Long lower shadow (>=2x body) after a decline - bulls rejected lower prices. Needs a strong up day to confirm.",
    "Hanging Man": "Hammer shape after a rise - potential top; needs a weak next day to confirm.",
    "Inverted Hammer": "Long upper shadow at the bottom of a decline - bulls stepping in; confirm with a higher open next day.",
    "Shooting Star": "Long upper shadow after an uptrend - sellers stepped in at the highs; confirm with a lower close.",
    "Bullish Engulfing": "Large white body engulfs the prior black body after a decline - buyers overwhelm sellers.",
    "Bearish Engulfing": "Large black body engulfs the prior white body after a rise - sellers overwhelm buyers.",
    "Piercing Line": "Opens below the prior low and closes above the midpoint of the prior long black candle.",
    "Dark Cloud Cover": "Opens above the prior high and closes below the midpoint of the prior long white candle.",
    "Bullish Harami": "Small body inside the prior long black body - downtrend losing force; needs confirmation.",
    "Bearish Harami": "Small body inside the prior long white body - uptrend losing force; needs confirmation.",
    "Morning Star": "Long black, small 'star', then a white candle closing well into the first body - bottom reversal.",
    "Evening Star": "Long white, small 'star', then a black candle closing well into the first body - top reversal.",
    "Doji": "Open ~= close - indecision. Meaningful at extremes after a trend.",
    "Bullish Pin Bar": "Tail >= 2.5x body rejecting lower prices, away from the 10/21 EMAs - stop just below the tail.",
    "Bearish Pin Bar": "Tail >= 2.5x body rejecting higher prices, away from the 10/21 EMAs - stop just above the tail.",
}


def _trend_before(close: np.ndarray, i: int, n: int = 6) -> int:
    """+1 rising, -1 falling, 0 flat into bar i (exclusive)."""
    if i - n < 0:
        return 0
    chg = close[i - 1] / close[i - n] - 1
    seg = close[i - n:i]
    slope = np.polyfit(np.arange(n), seg, 1)[0] / seg.mean()
    if chg < -0.01 and slope < 0:
        return -1
    if chg > 0.01 and slope > 0:
        return 1
    return 0


def detect(ind: pd.DataFrame, lookback: int = 30, zones: list[dict] | None = None) -> list[dict]:
    o, h, l, c = (ind[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close"))
    v = ind["volume"].to_numpy(dtype=float)
    vavg = ind["vol_sma20"].to_numpy(dtype=float) if "vol_sma20" in ind else np.full(len(c), np.nan)
    atr = ind["atr"].to_numpy(dtype=float) if "atr" in ind else np.full(len(c), np.nan)
    ema10 = ind["close"].ewm(span=10, adjust=False).mean().to_numpy()
    ema21 = ind["close"].ewm(span=21, adjust=False).mean().to_numpy()
    body = np.abs(c - o)
    rng = np.maximum(h - l, 1e-9)
    upper = h - np.maximum(o, c)
    lower = np.minimum(o, c) - l
    avg_body = pd.Series(body).rolling(14, min_periods=5).mean().to_numpy()
    bull = c > o
    bear = c < o

    n = len(c)
    found: list[dict] = []
    start = max(3, n - lookback)
    for i in range(start, n):
        tr = _trend_before(c, i)
        hits: list[tuple[str, str]] = []
        long_body = lambda j: body[j] >= max(avg_body[j] if not np.isnan(avg_body[j]) else 0, 0.5 * rng[j])  # noqa: E731

        # --- single-candle
        hammer_shape = lower[i] >= 2 * body[i] and upper[i] <= 0.15 * rng[i] and body[i] > 0.02 * rng[i]
        inv_shape = upper[i] >= 2 * body[i] and lower[i] <= 0.15 * rng[i] and body[i] > 0.02 * rng[i]
        if hammer_shape and tr == -1:
            hits.append(("Hammer", "bullish"))
        elif hammer_shape and tr == 1:
            hits.append(("Hanging Man", "bearish"))
        if inv_shape and tr == 1:
            hits.append(("Shooting Star", "bearish"))
        elif inv_shape and tr == -1:
            hits.append(("Inverted Hammer", "bullish"))
        if body[i] <= 0.1 * rng[i] and tr != 0 and rng[i] > 0.5 * (atr[i] if not np.isnan(atr[i]) else 0):
            hits.append(("Doji", "bearish" if tr == 1 else "bullish"))
        # pin bar (CFI): long tail, price stretched away from both EMAs
        if lower[i] >= 2.5 * body[i] and lower[i] >= 0.6 * rng[i] and upper[i] <= 0.2 * rng[i] and h[i] < min(ema10[i], ema21[i]):
            if not any(x[0] == "Hammer" for x in hits):
                hits.append(("Bullish Pin Bar", "bullish"))
        if upper[i] >= 2.5 * body[i] and upper[i] >= 0.6 * rng[i] and lower[i] <= 0.2 * rng[i] and l[i] > max(ema10[i], ema21[i]):
            if not any(x[0] == "Shooting Star" for x in hits):
                hits.append(("Bearish Pin Bar", "bearish"))

        # --- two-candle
        p = i - 1
        if tr == -1 and bear[p] and bull[i] and o[i] <= c[p] and c[i] >= o[p] and body[i] > body[p]:
            hits.append(("Bullish Engulfing", "bullish"))
        if tr == 1 and bull[p] and bear[i] and o[i] >= c[p] and c[i] <= o[p] and body[i] > body[p]:
            hits.append(("Bearish Engulfing", "bearish"))
        mid_p = (o[p] + c[p]) / 2
        if tr == -1 and bear[p] and long_body(p) and bull[i] and o[i] < l[p] * 1.002 and mid_p < c[i] < o[p]:
            hits.append(("Piercing Line", "bullish"))
        if tr == 1 and bull[p] and long_body(p) and bear[i] and o[i] > h[p] * 0.998 and o[p] < c[i] < mid_p:
            hits.append(("Dark Cloud Cover", "bearish"))
        if tr == -1 and bear[p] and long_body(p) and max(o[i], c[i]) < o[p] and min(o[i], c[i]) > c[p] and body[i] < 0.6 * body[p]:
            hits.append(("Bullish Harami", "bullish"))
        if tr == 1 and bull[p] and long_body(p) and max(o[i], c[i]) < c[p] and min(o[i], c[i]) > o[p] and body[i] < 0.6 * body[p]:
            hits.append(("Bearish Harami", "bearish"))

        # --- three-candle
        a, s = i - 2, i - 1
        trs = _trend_before(c, a)
        if trs == -1 and bear[a] and long_body(a) and body[s] <= 0.35 * body[a] and max(o[s], c[s]) <= c[a] * 1.003 and bull[i] and c[i] > (o[a] + c[a]) / 2:
            hits.append(("Morning Star", "bullish"))
        if trs == 1 and bull[a] and long_body(a) and body[s] <= 0.35 * body[a] and min(o[s], c[s]) >= c[a] * 0.997 and bear[i] and c[i] < (o[a] + c[a]) / 2:
            hits.append(("Evening Star", "bearish"))

        for name, bias in hits:
            score = RELIABILITY[name]
            enh = []
            vr = v[i] / vavg[i] if vavg[i] and not np.isnan(vavg[i]) and vavg[i] > 0 else None
            if vr and vr >= 1.5:
                score += 1
                enh.append(f"volume {vr:.1f}x average")
            if not np.isnan(atr[i]) and rng[i] >= 1.5 * atr[i]:
                score += 1
                enh.append("wide range - strong rejection")
            if zones:
                lvl = l[i] if bias == "bullish" else h[i]
                tol = atr[i] if not np.isnan(atr[i]) else rng[i]
                hit = [z for z in zones if z["low"] - tol <= lvl <= z["high"] + tol]
                if hit:
                    score += 1
                    enh.append(f"at {'support' if bias == 'bullish' else 'resistance'} zone {hit[0]['mid']}")
            confirmed = None
            if i + 1 < n:
                confirmed = bool(c[i + 1] > c[i]) if bias == "bullish" else bool(c[i + 1] < c[i])
                if confirmed:
                    score += 1
            found.append({
                "index": int(i), "time": str(ind.index[i]), "name": name, "bias": bias,
                "score": int(score), "confirmed": confirmed, "barsAgo": int(n - 1 - i),
                "enhancements": enh, "description": DESCRIPTIONS[name],
                "high": round(float(h[i]), 2), "low": round(float(l[i]), 2), "close": round(float(c[i]), 2),
            })
    return found
