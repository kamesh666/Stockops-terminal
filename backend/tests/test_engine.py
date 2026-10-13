import math
import os

os.environ.setdefault("STOCKOPS_DATA_SOURCE", "synthetic")

import numpy as np
import pandas as pd
import pytest

from stockops import analysis, backtest, candles, data, indicators as ta, options, structure, vsa


def _frame(rows):
    idx = pd.date_range("2024-01-01", periods=len(rows), freq="B", tz="Asia/Kolkata")
    return pd.DataFrame(rows, columns=["open", "high", "low", "close", "volume"], index=idx)


def _downtrend(n=20, start=200.0, step=2.0, vol=1000):
    rows = []
    p = start
    for _ in range(n):
        rows.append([p, p + 0.5, p - step - 0.5, p - step, vol])
        p -= step
    return rows


def _uptrend(n=20, start=100.0, step=2.0, vol=1000):
    rows = []
    p = start
    for _ in range(n):
        rows.append([p, p + step + 0.5, p - 0.5, p + step, vol])
        p += step
    return rows


# ------------------------------------------------------------ indicators
def test_rsi_bounds_and_extremes():
    up = pd.Series(np.arange(1, 60, dtype=float))
    assert ta.rsi(up).iloc[-1] == pytest.approx(100.0)
    rnd = pd.Series(np.random.default_rng(1).normal(0, 1, 300).cumsum() + 100)
    r = ta.rsi(rnd).dropna()
    assert r.between(0, 100).all()


def test_macd_is_ema_difference():
    s = pd.Series(np.linspace(100, 130, 80))
    line, sig, hist = ta.macd(s)
    assert line.iloc[-1] == pytest.approx(ta.ema(s, 12).iloc[-1] - ta.ema(s, 26).iloc[-1])
    assert hist.iloc[-1] == pytest.approx(line.iloc[-1] - sig.iloc[-1])


def test_atr_constant_range():
    df = _frame([[100, 102, 98, 100, 10]] * 40)
    assert ta.atr(df).iloc[-1] == pytest.approx(4.0)


def test_bollinger_contains_mean():
    s = pd.Series(np.random.default_rng(2).normal(100, 2, 100))
    up, mid, lo, _ = ta.bollinger(s)
    assert (up.dropna() >= mid.dropna()).all() and (lo.dropna() <= mid.dropna()).all()


# ------------------------------------------------------------ candlesticks
def _detect(rows):
    ind = ta.compute_all(_frame(rows))
    return {c["name"] for c in candles.detect(ind, lookback=3)}


def test_hammer_after_decline():
    rows = _downtrend()
    p = rows[-1][3]
    rows.append([p - 0.2, p + 0.3, p - 6, p + 0.1, 1000])  # long lower shadow, close near high
    assert "Hammer" in _detect(rows)


def test_hanging_man_needs_uptrend():
    rows = _uptrend()
    p = rows[-1][3]
    rows.append([p + 0.2, p + 0.5, p - 6, p + 0.4, 1000])
    names = _detect(rows)
    assert "Hanging Man" in names and "Hammer" not in names


def test_bullish_engulfing():
    rows = _downtrend()
    p = rows[-1][3]
    rows.append([p, p + 0.3, p - 2.2, p - 2, 1000])         # small black
    rows.append([p - 2.5, p + 1.5, p - 2.6, p + 1.2, 3000])  # large white engulfing
    assert "Bullish Engulfing" in _detect(rows)


def test_shooting_star():
    rows = _uptrend()
    p = rows[-1][3]
    rows.append([p + 0.5, p + 7, p + 0.3, p + 0.8, 1000])
    assert "Shooting Star" in _detect(rows)


# ------------------------------------------------------------ VSA
def test_vsa_no_demand_and_test():
    rows = _uptrend(30, vol=1000)
    p = rows[-1][3]
    rows.append([p, p + 0.6, p - 0.2, p + 0.4, 400])          # up-bar, narrow, low vol -> No Demand
    res = vsa.analyse(ta.compute_all(_frame(rows)), lookback=3)
    assert any(s["name"] == "No Demand" for s in res["signals"])
    rows = _uptrend(30, vol=1000)
    p = rows[-1][3]
    rows.append([p, p + 0.5, p - 3, p + 0.4, 300])             # dips below prior low, closes on high, low vol -> Test
    res = vsa.analyse(ta.compute_all(_frame(rows)), lookback=3)
    assert any(s["name"] == "Test" for s in res["signals"])


def test_vsa_disabled_without_volume():
    rows = [[r[0], r[1], r[2], r[3], 0] for r in _uptrend(40)]
    assert vsa.analyse(ta.compute_all(_frame(rows)))["available"] is False


# ------------------------------------------------------------ options / volatility
def test_varsity_expected_range_example():
    # Varsity ch.17: CMP 8337, daily mean 0.04%, SD 1.046%, 30 days -> ~7963 to ~8930 (1SD)
    m, s = 0.0004 * 30, 0.01046 * math.sqrt(30)
    assert 8337 * math.exp(m + s) == pytest.approx(8930, rel=0.003)
    assert 8337 * math.exp(m - s) == pytest.approx(7963, rel=0.003)


def test_put_call_parity():
    S, K, T, r, v = 25000, 25100, 10 / 365, 0.065, 0.14
    c = options.black_scholes(S, K, T, v, "CE", r)["price"]
    p = options.black_scholes(S, K, T, v, "PE", r)["price"]
    assert c - p == pytest.approx(S - K * math.exp(-r * T), abs=0.05)


def test_sd_strikes_bracket_price():
    close = data.synthetic_history("NIFTY 50", "1D")["close"]
    rec = options.recommend("NIFTY 50", close, "neutral")
    sd = rec["sdStrikes"]
    assert sd["putToWrite"]["strike"] < close.iloc[-1] < sd["callToWrite"]["strike"]
    assert rec["strategies"]


def test_volatility_stop_direction():
    close = data.synthetic_history("TCS", "1D")["close"]
    e = float(close.iloc[-1])
    assert options.volatility_stop(close, e, "long") < e < options.volatility_stop(close, e, "short")


# ------------------------------------------------------------ structure / analysis
def test_pivots_alternate():
    df = data.synthetic_history("RELIANCE", "1D")
    piv = structure.find_pivots(df)
    assert all(a.kind != b.kind for a, b in zip(piv, piv[1:]))


@pytest.mark.parametrize("sym", ["NIFTY 50", "RELIANCE", "SBIN"])
def test_full_analysis_is_json_safe(sym):
    import json
    r = analysis.analyse(sym)
    json.dumps(r)
    assert -100 <= r["confluence"]["score"] <= 100
    plan = r["tradePlan"]
    if plan["direction"] == "long":
        assert plan["stop"] < plan["entry"] < plan["targets"][0]
    elif plan["direction"] == "short":
        assert plan["stop"] > plan["entry"] > plan["targets"][0]


def test_round_number_stop_avoidance():
    assert analysis.avoid_round_number(2500.2, "long", 2600, False) < 2500
    assert analysis.avoid_round_number(24999.0, "short", 24800, True) > 25000


# ------------------------------------------------------------ backtest
@pytest.mark.parametrize("strategy", list(backtest.STRATEGIES))
def test_every_strategy_runs(strategy):
    r = backtest.run("RELIANCE", strategy)
    assert r["metrics"]["finalEquity"] > 0
    for t in r["trades"]:
        assert t["exitTime"] >= t["entryTime"]


def test_no_lookahead_last_bar_signal():
    """A signal on the final bar must not create a trade (it would fill on a bar that doesn't exist)."""
    ind = ta.compute_all(data.synthetic_history("ITC", "1D"))
    sig = backtest.signals("macd-cross", ind)
    assert len(sig) == len(ind)
    r = backtest.run("ITC", "macd-cross")
    last_bar = ind.index[-1].isoformat()
    assert all(t["entryTime"] != last_bar for t in r["trades"])


# ------------------------------------------------------------ CSV import (Google Sheets export)
def test_google_sheets_csv_import(tmp_path, monkeypatch):
    csv = tmp_path / "MYSTOCK.csv"
    dates = pd.bdate_range("2024-01-01", periods=120)
    closes = np.linspace(100, 150, 120)
    pd.DataFrame({"Date": dates.strftime("%m/%d/%Y 15:30:00"), "Open": closes, "High": closes + 1,
                  "Low": closes - 1, "Close": closes, "Volume": 1000}).to_csv(csv, index=False)
    monkeypatch.setattr(data, "IMPORT_DIR", tmp_path)
    monkeypatch.setattr(data, "DATA_SOURCE", "csv")
    data.clear_memory_cache()
    h = data.get_history("MYSTOCK", "1D")
    assert h.source == "csv" and len(h.df) == 120 and h.df["close"].iloc[-1] == pytest.approx(150)
    data.clear_memory_cache()


# ------------------------------------------------------------ API
def test_api_endpoints():
    from fastapi.testclient import TestClient
    from stockops.api import app
    c = TestClient(app)
    assert c.get("/api/health").json()["status"] == "ok"
    q = c.get("/api/quotes").json()
    assert len(q) == 14 and {"price", "rsi", "support", "resistance"} <= set(q[0])
    a = c.get("/api/analysis/NIFTY%2050").json()
    assert a["symbol"] == "NIFTY 50" and a["chart"]
    assert c.get("/api/history/TCS?interval=15m&bars=50").json()["candles"]
    b = c.get("/api/backtest/RELIANCE?strategy=donchian-breakout").json()
    assert "metrics" in b and b["equityCurve"]
    assert len(c.get("/api/backtest/RELIANCE/compare").json()) == len(backtest.STRATEGIES)
    assert len(c.get("/api/scan").json()) == 14
    assert c.get("/api/options/BANKNIFTY?view=bullish").json()["strategies"]
    assert c.get("/api/backtest/RELIANCE?strategy=nope").status_code == 400
