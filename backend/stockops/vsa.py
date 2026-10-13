"""Volume Spread Analysis (Tom Williams, *Master the Markets*).

Each bar is described by three facts - volume (vs its 20-bar average), spread
(high-low vs its average) and where it closed inside the bar - and read against
the background trend. "Strength appears on down-bars, weakness on up-bars."
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SIGNS = {
    # signs of weakness
    "Up-thrust": ("weakness", "Pushed to new highs then closed on the low on high volume - more selling than buying inside the volume."),
    "Up-thrust (trap)": ("weakness", "Low-volume up-thrust after a decline - a stop-hunting trap for short sellers and breakout buyers."),
    "No Demand": ("weakness", "Up-bar, narrow spread, volume lower than the previous two bars - professionals are not interested in higher prices."),
    "Buying Climax": ("weakness", "Ultra-high volume, wide up-bar into new highs closing off the top - strong holders distributing to the crowd."),
    "Effort, No Result (up)": ("weakness", "High volume on a narrow up-bar into new ground - supply is absorbing the buying."),
    "High Volume Up-bar Failed": ("weakness", "High-volume up-bar followed by a down-bar - selling was hidden in the volume."),
    # signs of strength
    "No Supply": ("strength", "Down-bar, narrow spread, volume lower than the previous two bars - selling pressure has dried up."),
    "Test": ("strength", "Marked down then closed on the high on low volume - supply has disappeared. One of the best buy signals."),
    "Stopping Volume": ("strength", "Very high volume on a down-bar closing off the lows - large buy orders absorbing the selling."),
    "Selling Climax": ("strength", "Ultra-high volume, wide down-bar to new lows closing off the bottom - panic selling bought by professionals."),
    "Shake-out": ("strength", "Sharp mark-down after a decline immediately reversed - weak holders flushed before an up-move."),
    "Absorption (down)": ("strength", "Narrow-spread down-bar on high volume closing on the lows - buying is absorbing supply."),
}


def analyse(ind: pd.DataFrame, lookback: int = 40) -> dict:
    vol = ind["volume"].astype(float)
    if (vol > 0).mean() < 0.8:
        return {
            "available": False,
            "note": "No reliable volume for this instrument (index quotes from Yahoo carry no volume). Run VSA on a constituent or the futures contract.",
            "signals": [], "bias": "n/a", "strengthScore": 0, "weaknessScore": 0,
        }
    o, h, l, c = (ind[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close"))
    v = vol.to_numpy()
    vavg = vol.rolling(20, min_periods=10).mean().to_numpy()
    spread = h - l
    savg = pd.Series(spread).rolling(20, min_periods=10).mean().to_numpy()
    pos = np.where(spread > 0, (c - l) / np.where(spread > 0, spread, 1), 0.5)
    hi20 = pd.Series(h).rolling(20, min_periods=10).max().shift(1).to_numpy()
    lo20 = pd.Series(l).rolling(20, min_periods=10).min().shift(1).to_numpy()
    close = pd.Series(c)
    trend10 = (close / close.shift(10) - 1).to_numpy()

    n = len(c)
    signals: list[dict] = []
    for i in range(max(3, n - lookback), n):
        if np.isnan(vavg[i]) or np.isnan(savg[i]) or vavg[i] <= 0:
            continue
        vr = v[i] / vavg[i]
        sr = spread[i] / savg[i] if savg[i] > 0 else 1
        up_bar = c[i] > c[i - 1]
        down_bar = c[i] < c[i - 1]
        lower_than_two = v[i] < v[i - 1] and v[i] < v[i - 2]
        after_decline = trend10[i] < -0.03 if not np.isnan(trend10[i]) else False
        after_advance = trend10[i] > 0.03 if not np.isnan(trend10[i]) else False
        found: list[str] = []

        new_high = not np.isnan(hi20[i]) and h[i] > hi20[i]
        new_low = not np.isnan(lo20[i]) and l[i] < lo20[i]

        if h[i] > max(h[i - 1], h[i - 2]) and pos[i] <= 0.3 and sr >= 1.0:
            found.append("Up-thrust" if vr >= 1.2 else ("Up-thrust (trap)" if after_decline else "Up-thrust"))
        if up_bar and sr <= 0.75 and lower_than_two:
            found.append("No Demand")
        if up_bar and new_high and vr >= 2.0 and sr >= 1.3 and pos[i] < 0.75 and after_advance:
            found.append("Buying Climax")
        elif up_bar and new_high and vr >= 1.6 and sr <= 0.8:
            found.append("Effort, No Result (up)")
        if i + 1 < n and up_bar and vr >= 1.6 and c[i + 1] < c[i] and h[i + 1] <= h[i]:
            found.append("High Volume Up-bar Failed")

        if down_bar and sr <= 0.75 and lower_than_two:
            found.append("No Supply")
        if l[i] < l[i - 1] and pos[i] >= 0.7 and lower_than_two and vr < 1.0:
            found.append("Test")
        if (down_bar or l[i] < l[i - 1]) and vr >= 1.8 and pos[i] >= 0.5 and after_decline:
            found.append("Stopping Volume")
        if down_bar and new_low and vr >= 2.2 and sr >= 1.3 and pos[i] >= 0.35 and after_decline:
            found.append("Selling Climax")
        if i + 1 < n and down_bar and sr >= 1.4 and after_decline and o[i + 1] > c[i] and c[i + 1] > o[i]:
            found.append("Shake-out")
        if down_bar and sr <= 0.7 and vr >= 1.6 and pos[i] <= 0.25:
            found.append("Absorption (down)")

        for name in dict.fromkeys(found):
            kind, desc = SIGNS[name]
            signals.append({
                "index": int(i), "time": str(ind.index[i]), "barsAgo": int(n - 1 - i),
                "name": name, "kind": kind, "description": desc,
                "volumeRatio": round(float(vr), 2), "spreadRatio": round(float(sr), 2),
                "closePosition": round(float(pos[i]), 2),
            })

    # recency-weighted background (signals fade over ~20 bars)
    strength = sum(max(0.0, 1 - s["barsAgo"] / 20) * (2 if s["name"] in ("Selling Climax", "Stopping Volume", "Test") else 1)
                   for s in signals if s["kind"] == "strength")
    weakness = sum(max(0.0, 1 - s["barsAgo"] / 20) * (2 if s["name"] in ("Buying Climax", "Up-thrust") else 1)
                   for s in signals if s["kind"] == "weakness")
    if strength - weakness >= 1.0:
        bias = "strength in background"
    elif weakness - strength >= 1.0:
        bias = "weakness in background"
    else:
        bias = "balanced"
    last = n - 1
    lr = v[last] / vavg[last] if vavg[last] and vavg[last] > 0 else None
    return {
        "available": True,
        "signals": signals[-15:],
        "all": signals,
        "bias": bias,
        "strengthScore": round(strength, 2),
        "weaknessScore": round(weakness, 2),
        "lastBar": {
            "volumeRatio": round(float(lr), 2) if lr else None,
            "spreadRatio": round(float(spread[last] / savg[last]), 2) if savg[last] else None,
            "closePosition": round(float(pos[last]), 2),
        },
    }


def relative_strength(stock: pd.Series, parent: pd.Series, window: int = 20) -> dict:
    """Master the Markets stock selection: is the stock resisting the index's down days?"""
    df = pd.concat([stock.rename("s"), parent.rename("p")], axis=1, join="inner").dropna()
    if len(df) < window + 5:
        return {"available": False}
    r = df.pct_change().dropna().iloc[-window:]
    down_days = r[r["p"] < 0]
    up_days = r[r["p"] > 0]
    resist = float((down_days["s"] - down_days["p"]).mean()) if len(down_days) else 0.0
    lag = float((up_days["s"] - up_days["p"]).mean()) if len(up_days) else 0.0
    perf_s = float(df["s"].iloc[-1] / df["s"].iloc[-window - 1] - 1)
    perf_p = float(df["p"].iloc[-1] / df["p"].iloc[-window - 1] - 1)
    rs_line = df["s"] / df["p"]
    rs_slope = float(rs_line.iloc[-1] / rs_line.iloc[-window - 1] - 1)
    if resist > 0.001 and rs_slope > 0:
        verdict = "stronger than index"
        note = "Refuses to fall on the index's down days - professional buying (Master the Markets stock selection)."
    elif resist < -0.001 and rs_slope < 0:
        verdict = "weaker than index"
        note = "Falls harder than the index and lags on rallies - candidate for the bearish side."
    else:
        verdict = "in line with index"
        note = "Moving with the parent index."
    return {
        "available": True, "window": window, "verdict": verdict, "note": note,
        "stockReturnPct": round(perf_s * 100, 2), "parentReturnPct": round(perf_p * 100, 2),
        "excessOnDownDaysPct": round(resist * 100, 3), "excessOnUpDaysPct": round(lag * 100, 3),
        "rsLineChangePct": round(rs_slope * 100, 2),
    }
