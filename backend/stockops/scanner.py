"""Universe scanner: run the full analysis on every instrument and rank the results."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from . import analysis, universe


def _row(symbol: str, interval: str, capital: float, risk_pct: float) -> dict:
    try:
        a = analysis.analyse(symbol, interval, capital, risk_pct, chart_bars=1)
    except Exception as exc:  # noqa: BLE001
        return {"symbol": symbol, "error": str(exc)}
    plan = a["tradePlan"]
    recent_candles = [c for c in a["candlesticks"] if c["barsAgo"] <= 2]
    top_candle = max(recent_candles, key=lambda c: c["score"]) if recent_candles else None
    recent_vsa = [s for s in a["vsa"].get("signals", []) if s["barsAgo"] <= 3]
    return {
        "symbol": symbol, "name": a["quote"]["name"], "segment": a["quote"]["segment"],
        "price": a["quote"]["price"], "changePercent": a["quote"]["changePercent"],
        "dataSource": a["dataSource"], "lastBarTime": a["quote"]["lastBarTime"],
        "score": a["confluence"]["score"], "verdict": a["confluence"]["verdict"],
        "agreementPct": a["confluence"]["agreementPct"],
        "regime": a["regime"]["title"], "stage": a["stage"]["stage"], "trend": a["structure"]["trend"],
        "rsi": a["indicators"]["rsi"], "adx": a["indicators"]["adx"],
        "candle": {"name": top_candle["name"], "bias": top_candle["bias"], "barsAgo": top_candle["barsAgo"]} if top_candle else None,
        "vsaBias": a["vsa"].get("bias"), "vsaRecent": [s["name"] for s in recent_vsa],
        "relativeStrength": (a["relativeStrength"] or {}).get("verdict"),
        "hvRank": a["volatility"]["hvRank"], "hv20": a["volatility"]["hv20"],
        "activeSetups": [s["name"] for s in a["setups"] if s.get("active") and s.get("bias") != "neutral"],
        "plan": {k: plan.get(k) for k in ("direction", "entry", "stop", "targets", "rewardRiskT1", "grade", "quantity", "lots", "skip", "entryTrigger")},
        "optionIdeas": [s["name"] for s in a["options"]["strategies"]][:2],
        "volRegime": a["options"]["volRegime"],
    }


def scan(interval: str = "1D", capital: float = 100000, risk_pct: float = 1.0, symbols: list[str] | None = None) -> list[dict]:
    syms = symbols or [i.symbol for i in universe.UNIVERSE]
    with ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(lambda s: _row(s, interval, capital, risk_pct), syms))
    rows.sort(key=lambda r: -abs(r.get("score") or 0))
    return rows
