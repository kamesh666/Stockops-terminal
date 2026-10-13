"""Volatility analytics and option-strategy selection.

Zerodha Varsity Module 5:
* ch.16 historical volatility = stdev(log returns) * sqrt(252)
* ch.17 expected range = price * exp(mean*t +/- k * sd * sqrt(t)) at 1SD (68%) / 2SD (95%)
* ch.18 write calls above +1SD / puts below -1SD (2SD when far from expiry),
        avoid writing with >15 days to expiry or around events,
        volatility-based stop-loss outside the expected 1SD move
* ch.19 IV vs HV (volatility types) - here HV-rank is the IV-rank proxy when no IV feed

NSE Options Trading Strategies module (22 strategies) / IJNRD 2022: pick the
strategy from market view x volatility.
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pandas as pd

from . import universe

TRADING_DAYS = 252
RISK_FREE = 0.065  # approx. Indian 91-day T-bill; override via API param


# ---------------------------------------------------------------- volatility
def log_returns(close: pd.Series) -> pd.Series:
    return np.log(close / close.shift()).dropna()


def hv(close: pd.Series, window: int = 20) -> float | None:
    r = log_returns(close).iloc[-window:]
    if len(r) < max(5, window // 2):
        return None
    return float(r.std(ddof=1) * math.sqrt(TRADING_DAYS))


def hv_series(close: pd.Series, window: int = 20) -> pd.Series:
    return log_returns(close).rolling(window).std(ddof=1) * math.sqrt(TRADING_DAYS)


def vol_cone(close: pd.Series) -> list[dict]:
    """Percentile of current HV for several windows vs. its own 1-year history."""
    out = []
    for w in (10, 20, 60, 120):
        s = hv_series(close, w).dropna()
        if len(s) < 60:
            continue
        hist = s.iloc[-TRADING_DAYS:]
        cur = float(s.iloc[-1])
        out.append({
            "window": w, "current": round(cur * 100, 2),
            "min": round(float(hist.min()) * 100, 2), "median": round(float(hist.median()) * 100, 2),
            "max": round(float(hist.max()) * 100, 2),
            "percentile": round(float((hist < cur).mean()) * 100, 1),
        })
    return out


def hv_rank(close: pd.Series, window: int = 20) -> float | None:
    s = hv_series(close, window).dropna().iloc[-TRADING_DAYS:]
    if len(s) < 60:
        return None
    lo, hi, cur = float(s.min()), float(s.max()), float(s.iloc[-1])
    return round(100 * (cur - lo) / (hi - lo), 1) if hi > lo else 50.0


def expected_ranges(close: pd.Series, horizons: dict[str, int] | None = None) -> dict:
    """Varsity ch.17 normal-distribution price ranges from daily log returns."""
    r = log_returns(close).iloc[-TRADING_DAYS:]
    mean_d, sd_d = float(r.mean()), float(r.std(ddof=1))
    price = float(close.iloc[-1])
    horizons = horizons or {"1 day": 1, "1 week": 5, "1 month": 21}
    out = {}
    for label, days in horizons.items():
        m, s = mean_d * days, sd_d * math.sqrt(days)
        out[label] = {
            "days": days,
            "sd1": [round(price * math.exp(m - s), 2), round(price * math.exp(m + s), 2)],
            "sd2": [round(price * math.exp(m - 2 * s), 2), round(price * math.exp(m + 2 * s), 2)],
            "sd3": [round(price * math.exp(m - 3 * s), 2), round(price * math.exp(m + 3 * s), 2)],
        }
    return {"dailyMeanPct": round(mean_d * 100, 4), "dailySdPct": round(sd_d * 100, 4),
            "annualVolPct": round(sd_d * math.sqrt(TRADING_DAYS) * 100, 2), "ranges": out}


def volatility_stop(close: pd.Series, entry: float, direction: str, holding_days: int = 5, k: float = 1.0) -> float:
    """Varsity ch.18: a stop inside the expected 1SD move will be hit by noise."""
    sd_d = float(log_returns(close).iloc[-TRADING_DAYS:].std(ddof=1))
    move = k * sd_d * math.sqrt(holding_days)
    return round(entry * math.exp(-move), 2) if direction == "long" else round(entry * math.exp(move), 2)


# ---------------------------------------------------------------- expiries
def _last_weekday(year: int, month: int, weekday: int) -> date:
    d = date(year + (month == 12), (month % 12) + 1, 1) - timedelta(days=1)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def next_expiry(symbol: str, today: date | None = None) -> dict:
    """Approximate next expiry. NSE moved F&O expiries to Tuesday (Sep 2025); NIFTY keeps
    a weekly, other NSE contracts are monthly (last Tuesday); SENSEX weekly on Thursday.
    Exchange holidays are not modelled - verify on the exchange calendar."""
    today = today or date.today()
    if symbol == "SENSEX":
        wd, weekly = 3, True
    else:
        wd, weekly = 1, symbol == "NIFTY 50"
    if weekly:
        d = today + timedelta(days=(wd - today.weekday()) % 7)
        kind = "weekly"
    else:
        d = _last_weekday(today.year, today.month, wd)
        if d < today:
            nm = today.month % 12 + 1
            ny = today.year + (today.month == 12)
            d = _last_weekday(ny, nm, wd)
        kind = "monthly"
    dte = max((d - today).days, 0)
    return {"date": d.isoformat(), "kind": kind, "daysToExpiry": dte,
            "tradingDaysToExpiry": int(np.busday_count(today, d)) if d > today else 0}


# ---------------------------------------------------------------- Black-Scholes
def _ncdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _npdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)


def black_scholes(S: float, K: float, T: float, sigma: float, kind: str, r: float = RISK_FREE) -> dict:
    if T <= 1e-6 or sigma <= 0:
        intrinsic = max(0.0, S - K) if kind == "CE" else max(0.0, K - S)
        return {"price": intrinsic, "delta": (1.0 if S > K else 0.0) if kind == "CE" else (-1.0 if S < K else 0.0),
                "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    sq = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
    d2 = d1 - sigma * sq
    if kind == "CE":
        price = S * _ncdf(d1) - K * math.exp(-r * T) * _ncdf(d2)
        delta = _ncdf(d1)
        theta = (-(S * _npdf(d1) * sigma) / (2 * sq) - r * K * math.exp(-r * T) * _ncdf(d2)) / 365
    else:
        price = K * math.exp(-r * T) * _ncdf(-d2) - S * _ncdf(-d1)
        delta = _ncdf(d1) - 1
        theta = (-(S * _npdf(d1) * sigma) / (2 * sq) + r * K * math.exp(-r * T) * _ncdf(-d2)) / 365
    return {"price": round(max(price, 0.05), 2), "delta": round(delta, 3),
            "gamma": round(_npdf(d1) / (S * sigma * sq), 5), "theta": round(theta, 2),
            "vega": round(S * sq * _npdf(d1) / 100, 2), "probITM": round(_ncdf(d2) if kind == "CE" else _ncdf(-d2), 3)}


# ---------------------------------------------------------------- strategies
STRATEGY_LIBRARY: dict[str, dict] = {
    # id: name, view, vol preference, risk, legs (descriptive)
    "long-call": {"name": "Long Call", "view": "bullish", "vol": "low", "risk": "limited", "legs": "Buy ATM/OTM CE"},
    "short-put": {"name": "Short Put", "view": "bullish", "vol": "high", "risk": "large", "legs": "Sell OTM PE (Varsity: avoid naked put writing)"},
    "synthetic-long-call": {"name": "Synthetic Long Call", "view": "bullish", "vol": "any", "risk": "limited", "legs": "Long stock + buy ATM PE"},
    "covered-call": {"name": "Covered Call", "view": "mildly bullish", "vol": "high", "risk": "stock downside", "legs": "Long stock + sell OTM CE"},
    "long-combo": {"name": "Long Combo", "view": "bullish", "vol": "any", "risk": "large", "legs": "Sell OTM PE + buy OTM CE"},
    "bull-call-spread": {"name": "Bull Call Spread", "view": "moderately bullish", "vol": "low", "risk": "limited", "legs": "Buy ATM CE, sell OTM CE"},
    "bull-put-spread": {"name": "Bull Put Spread", "view": "moderately bullish", "vol": "high", "risk": "limited", "legs": "Sell ATM/OTM PE, buy lower PE"},
    "long-put": {"name": "Long Put", "view": "bearish", "vol": "low", "risk": "limited", "legs": "Buy ATM/OTM PE"},
    "short-call": {"name": "Short Call", "view": "bearish", "vol": "high", "risk": "unlimited", "legs": "Sell OTM CE"},
    "covered-put": {"name": "Covered Put", "view": "mildly bearish", "vol": "high", "risk": "unlimited", "legs": "Short stock + sell OTM PE"},
    "protective-call": {"name": "Protective Call", "view": "bearish (hedged short)", "vol": "low", "risk": "limited", "legs": "Short stock + buy ATM CE"},
    "bear-put-spread": {"name": "Bear Put Spread", "view": "moderately bearish", "vol": "low", "risk": "limited", "legs": "Buy ATM PE, sell OTM PE"},
    "bear-call-spread": {"name": "Bear Call Spread", "view": "moderately bearish", "vol": "high", "risk": "limited", "legs": "Sell ATM/OTM CE, buy higher CE"},
    "long-straddle": {"name": "Long Straddle", "view": "volatile", "vol": "low", "risk": "limited", "legs": "Buy ATM CE + ATM PE"},
    "long-strangle": {"name": "Long Strangle", "view": "volatile", "vol": "low", "risk": "limited", "legs": "Buy OTM CE + OTM PE"},
    "short-call-butterfly": {"name": "Short Call Butterfly", "view": "volatile", "vol": "high", "risk": "limited", "legs": "Sell ITM CE, buy 2 ATM CE, sell OTM CE"},
    "short-call-condor": {"name": "Short Call Condor", "view": "volatile", "vol": "low", "risk": "limited", "legs": "Sell ITM CE, buy 2 middle CE, sell far OTM CE"},
    "short-straddle": {"name": "Short Straddle", "view": "neutral", "vol": "high", "risk": "unlimited", "legs": "Sell ATM CE + ATM PE"},
    "short-strangle": {"name": "Short Strangle", "view": "neutral", "vol": "high", "risk": "unlimited", "legs": "Sell OTM CE (+1SD) + OTM PE (-1SD)"},
    "iron-condor": {"name": "Iron Condor", "view": "neutral", "vol": "high", "risk": "limited", "legs": "Short strangle + long wings"},
    "iron-butterfly": {"name": "Iron Butterfly", "view": "neutral", "vol": "high", "risk": "limited", "legs": "Short straddle + long wings"},
    "long-call-butterfly": {"name": "Long Call Butterfly", "view": "neutral", "vol": "high", "risk": "limited", "legs": "Buy ITM CE, sell 2 ATM CE, buy OTM CE"},
    "long-call-condor": {"name": "Long Call Condor", "view": "neutral", "vol": "high", "risk": "limited", "legs": "Buy ITM CE, sell 2 middle CE, buy far OTM CE"},
    "collar": {"name": "Collar", "view": "hedge long stock", "vol": "any", "risk": "limited", "legs": "Long stock + buy OTM PE + sell OTM CE"},
    "protective-put": {"name": "Protective Put", "view": "hedge long stock", "vol": "low", "risk": "limited", "legs": "Long stock + buy ATM/OTM PE"},
}

# view x volatility regime -> ordered preferences
_MATRIX = {
    ("bullish", "low"): ["bull-call-spread", "long-call", "synthetic-long-call"],
    ("bullish", "normal"): ["bull-call-spread", "bull-put-spread", "long-call"],
    ("bullish", "high"): ["bull-put-spread", "covered-call", "bull-call-spread"],
    ("bearish", "low"): ["bear-put-spread", "long-put", "protective-call"],
    ("bearish", "normal"): ["bear-put-spread", "bear-call-spread", "long-put"],
    ("bearish", "high"): ["bear-call-spread", "bear-put-spread", "covered-put"],
    ("neutral", "low"): ["long-call-butterfly", "iron-butterfly", "long-call-condor"],
    ("neutral", "normal"): ["iron-condor", "long-call-butterfly", "short-strangle"],
    ("neutral", "high"): ["iron-condor", "short-strangle", "iron-butterfly"],
    ("volatile", "low"): ["long-straddle", "long-strangle", "short-call-condor"],
    ("volatile", "normal"): ["long-strangle", "long-straddle", "short-call-butterfly"],
    ("volatile", "high"): ["short-call-butterfly", "long-strangle", "iron-condor"],
}


def vol_regime(hv_rank_v: float | None, iv: float | None = None, hv20: float | None = None) -> str:
    if iv and hv20:
        ratio = iv / hv20
        if ratio >= 1.25:
            return "high"
        if ratio <= 0.85:
            return "low"
    if hv_rank_v is None:
        return "normal"
    return "low" if hv_rank_v < 30 else "high" if hv_rank_v > 60 else "normal"


def recommend(symbol: str, close: pd.Series, view: str, iv_pct: float | None = None, r: float = RISK_FREE) -> dict:
    view = view if view in ("bullish", "bearish", "neutral", "volatile") else "neutral"
    price = float(close.iloc[-1])
    hv20 = hv(close, 20)
    rank = hv_rank(close, 20)
    regime = vol_regime(rank, iv_pct / 100 if iv_pct else None, hv20)
    sigma = (iv_pct / 100) if iv_pct else (hv20 or 0.2)
    exp = next_expiry(symbol)
    dte = max(exp["daysToExpiry"], 1)
    T = dte / 365
    step = universe.strike_step(symbol, price)
    atm = round(price / step) * step

    # SD strikes (Varsity ch.18) over the trading days to expiry
    r_d = log_returns(close).iloc[-TRADING_DAYS:]
    sd_d = float(r_d.std(ddof=1))
    t_days = max(exp["tradingDaysToExpiry"], 1)
    k = 1.0 if dte <= 15 else 2.0
    up = price * math.exp(k * sd_d * math.sqrt(t_days))
    dn = price * math.exp(-k * sd_d * math.sqrt(t_days))
    call_strike = math.ceil(up / step) * step
    put_strike = math.floor(dn / step) * step
    sell_call = black_scholes(price, call_strike, T, sigma, "CE", r)
    sell_put = black_scholes(price, put_strike, T, sigma, "PE", r)

    picks = []
    for sid in _MATRIX[(view, regime)]:
        info = STRATEGY_LIBRARY[sid]
        picks.append({"id": sid, **info})
    notes = []
    if dte > 15:
        notes.append("More than 15 days to expiry - Varsity: avoid writing options this early, or use 2SD strikes.")
    if any(p["risk"] in ("unlimited", "large") for p in picks):
        notes.append("Strategies marked unlimited/large risk need hard stops and position limits (<= 9% of capital per idea).")
    notes.append("Avoid writing options ahead of RBI policy, results or other scheduled events.")
    notes.append("Premiums are theoretical Black-Scholes values using " + ("the IV you supplied." if iv_pct else "20-day historical volatility as the IV proxy."))
    return {
        "view": view, "volRegime": regime, "hv20Pct": round((hv20 or 0) * 100, 2), "hvRank": rank,
        "sigmaUsedPct": round(sigma * 100, 2), "expiry": exp, "atmStrike": atm, "strikeStep": step,
        "sdMultiple": k,
        "sdStrikes": {
            "callToWrite": {"strike": call_strike, **sell_call},
            "putToWrite": {"strike": put_strike, **sell_put},
            "upperRange": round(up, 2), "lowerRange": round(dn, 2),
        },
        "atmCall": black_scholes(price, atm, T, sigma, "CE", r),
        "atmPut": black_scholes(price, atm, T, sigma, "PE", r),
        "strategies": picks,
        "notes": notes,
    }
