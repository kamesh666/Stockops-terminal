"""FastAPI server for the StockOps terminal.

Run (from the ``backend`` folder):
    python -m uvicorn stockops.api:app --reload --port 8000
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, analysis, backtest, data, options, scanner, universe
from . import indicators as ta
from .analysis import clean

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="StockOps Analysis Engine", version=__version__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"],
)


def _interval(v: str) -> str:
    if v not in data.INTERVALS:
        raise HTTPException(400, f"interval must be one of {list(data.INTERVALS)}")
    return v


@app.get("/api/health")
def health() -> dict:
    try:
        import yfinance  # noqa: F401
        yf_ok = True
    except ImportError:
        yf_ok = False
    probe = data.get_history("NIFTY 50", "1D")
    return {"status": "ok", "version": __version__, "dataSourceMode": data.DATA_SOURCE,
            "yfinanceInstalled": yf_ok, "liveSource": probe.source, "lastBar": probe.df.index[-1].isoformat()}


@app.get("/api/universe")
def get_universe() -> list[dict]:
    return [{"symbol": i.symbol, "name": i.name, "segment": i.segment, "exchange": i.exchange, "lotSize": i.lot_size,
             "yahoo": list(i.yahoo), "google": i.google, "parent": i.parent} for i in universe.UNIVERSE]


@app.get("/api/quotes")
def quotes() -> list[dict]:
    with ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(lambda s: _safe_quote(s), [i.symbol for i in universe.UNIVERSE]))
    return [r for r in rows if r]


def _safe_quote(sym: str) -> dict | None:
    try:
        return analysis.quote_summary(sym)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger("stockops.api").warning("quote %s failed: %s", sym, exc)
        return None


@app.get("/api/history/{symbol}")
def history(symbol: str, interval: str = "1D", bars: int = Query(200, ge=20, le=2000)) -> dict:
    h = data.get_history(symbol, _interval(interval))
    ind = ta.compute_all(h.df)
    return clean({"symbol": symbol, "interval": interval, "dataSource": h.source, "ticker": h.ticker,
                  "candles": analysis.chart_payload(ind, bars)})


@app.get("/api/analysis/{symbol}")
def get_analysis(symbol: str, interval: str = "1D", capital: float = 100000, risk_pct: float = 1.0,
                 holding_days: int = 5, iv: float | None = None, chart_bars: int = Query(120, ge=20, le=600)) -> dict:
    try:
        return analysis.analyse(symbol, _interval(interval), capital, risk_pct, holding_days, iv, chart_bars)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/scan")
def scan(interval: str = "1D", capital: float = 100000, risk_pct: float = 1.0) -> list[dict]:
    return clean(scanner.scan(_interval(interval), capital, risk_pct))


@app.get("/api/strategies")
def strategies() -> dict:
    return {"backtest": [{"id": k, **v} for k, v in backtest.STRATEGIES.items()],
            "options": [{"id": k, **v} for k, v in options.STRATEGY_LIBRARY.items()]}


def _params(capital: float, risk_pct: float, stop_atr: float, trail_atr: float | None, target_r: float | None,
            cost_pct: float, allow_short: bool, sizing: str, max_bars: int | None) -> backtest.Params:
    return backtest.Params(capital=capital, risk_pct=risk_pct, stop_atr=stop_atr,
                           trail_atr=trail_atr if trail_atr and trail_atr > 0 else None,
                           target_r=target_r if target_r and target_r > 0 else None,
                           cost_pct=cost_pct, allow_short=allow_short, sizing=sizing, max_bars=max_bars)


@app.get("/api/backtest/{symbol}")
def run_backtest(symbol: str, strategy: str = "golden-cross", interval: str = "1D", capital: float = 100000,
                 risk_pct: float = 1.0, stop_atr: float = 2.0, trail_atr: float | None = 3.0, target_r: float | None = None,
                 cost_pct: float = 0.1, allow_short: bool = False, sizing: str = "risk", max_bars: int | None = None,
                 start: str | None = None, end: str | None = None) -> dict:
    if strategy not in backtest.STRATEGIES:
        raise HTTPException(400, f"strategy must be one of {list(backtest.STRATEGIES)}")
    p = _params(capital, risk_pct, stop_atr, trail_atr, target_r, cost_pct, allow_short, sizing, max_bars)
    return clean(backtest.run(symbol, strategy, _interval(interval), p, start, end))


@app.get("/api/backtest/{symbol}/compare")
def compare_backtests(symbol: str, interval: str = "1D", capital: float = 100000, risk_pct: float = 1.0,
                      stop_atr: float = 2.0, trail_atr: float | None = 3.0, cost_pct: float = 0.1,
                      allow_short: bool = False, sizing: str = "risk") -> list[dict]:
    p = _params(capital, risk_pct, stop_atr, trail_atr, None, cost_pct, allow_short, sizing, None)
    return clean(backtest.compare(symbol, _interval(interval), p))


@app.get("/api/options/{symbol}")
def option_ideas(symbol: str, view: str = "neutral", iv: float | None = None) -> dict:
    h = data.get_history(symbol, "1D")
    return clean(options.recommend(symbol, h.df["close"], view, iv))
