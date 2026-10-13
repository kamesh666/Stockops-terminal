"""Historical OHLCV data layer.

Source order (``STOCKOPS_DATA_SOURCE=auto``, the default):

1. In-memory TTL cache
2. Yahoo Finance via ``yfinance`` (NSE ``.NS`` / index ``^NSEI`` tickers)
3. Last good download on disk (``backend/cache``) - lets the app work offline
4. A CSV you drop in ``backend/data_import`` - e.g. exported from a Google
   Sheet using ``=GOOGLEFINANCE("NSE:RELIANCE","all",DATE(2020,1,1),TODAY())``
5. Deterministic synthetic data (clearly flagged ``source="synthetic"``)

Google Finance has no public API, so the Google route is the Sheets export in
step 4; ``yfinance`` is used for automatic downloads.
"""
from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from . import universe

log = logging.getLogger("stockops.data")

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(os.environ.get("STOCKOPS_CACHE_DIR", BASE_DIR / "cache"))
IMPORT_DIR = Path(os.environ.get("STOCKOPS_IMPORT_DIR", BASE_DIR / "data_import"))
DATA_SOURCE = os.environ.get("STOCKOPS_DATA_SOURCE", "auto").lower()  # auto|yahoo|csv|synthetic

# app interval -> (yfinance interval, default lookback, memory TTL seconds, bars per trading day)
INTERVALS: dict[str, tuple[str, str, int, int]] = {
    "5m": ("5m", "60d", 60, 75),
    "15m": ("15m", "60d", 120, 25),
    "1h": ("60m", "730d", 300, 7),
    "1D": ("1d", "5y", 900, 1),
    "1W": ("1wk", "10y", 3600, 1),
}

# Anchor prices for synthetic data so the offline demo looks like the app's universe.
_SYNTH_ANCHOR = {
    "NIFTY 50": 25145.2, "BANKNIFTY": 54320.75, "FINNIFTY": 24390.4, "SENSEX": 82410.6,
    "RELIANCE": 2985.4, "HDFCBANK": 1672.3, "TCS": 4215.6, "INFY": 1920.4, "ICICIBANK": 1248.6,
    "TATAMOTORS": 945.2, "SBIN": 812.4, "ITC": 498.3, "BHARTIARTL": 1680.5, "LT": 3620.8,
}


@dataclass
class History:
    symbol: str
    interval: str
    df: pd.DataFrame          # index: DatetimeIndex (IST); cols: open high low close volume
    source: str               # yahoo | cache | csv | synthetic
    ticker: str = ""
    fetched_at: float = 0.0

    @property
    def has_volume(self) -> bool:
        v = self.df["volume"]
        return bool(len(v)) and float((v > 0).mean()) > 0.8


_mem: dict[tuple[str, str], History] = {}
_lock = threading.Lock()

# Circuit breaker: after repeated Yahoo failures (no internet, rate-limit) skip it
# for a few minutes instead of waiting on timeouts for every symbol.
_yahoo_fail_count = 0
_yahoo_skip_until = 0.0


# --------------------------------------------------------------------------- helpers
def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Lower-case OHLCV columns, IST tz-aware index, drop bad rows."""
    if df is None or df.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    df = df.copy()
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    rename = {"adj_close": "adj_close", "vol": "volume", "price": "close"}
    df = df.rename(columns=rename)
    for col in ("open", "high", "low", "close"):
        if col not in df.columns:
            raise ValueError(f"missing column '{col}'")
    if "volume" not in df.columns:
        df["volume"] = 0.0
    df = df[["open", "high", "low", "close", "volume"]].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close"])
    df["volume"] = df["volume"].fillna(0.0)
    idx = pd.DatetimeIndex(df.index)
    if idx.tz is None:
        idx = idx.tz_localize("Asia/Kolkata")
    else:
        idx = idx.tz_convert("Asia/Kolkata")
    df.index = idx
    df = df[~df.index.duplicated(keep="last")].sort_index()
    # repair inconsistent bars (provider glitches)
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"] = df[["open", "low", "close"]].min(axis=1)
    return df


def _cache_path(symbol: str, interval: str) -> Path:
    safe = symbol.replace(" ", "_").replace("^", "")
    return CACHE_DIR / f"{safe}_{interval}.csv"


def _save_cache(h: History) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        h.df.to_csv(_cache_path(h.symbol, h.interval), index_label="datetime")
    except OSError as exc:  # pragma: no cover - disk issues are non-fatal
        log.warning("could not write cache: %s", exc)


def _load_csv(path: Path) -> pd.DataFrame:
    raw = pd.read_csv(path)
    date_col = next((c for c in raw.columns if str(c).strip().lower() in ("datetime", "date", "time", "timestamp")), raw.columns[0])
    raw[date_col] = pd.to_datetime(raw[date_col], utc=False, errors="coerce", dayfirst=False)
    raw = raw.dropna(subset=[date_col]).set_index(date_col)
    return _normalize(raw)


def _from_disk_cache(symbol: str, interval: str) -> History | None:
    p = _cache_path(symbol, interval)
    if not p.exists():
        return None
    try:
        df = _load_csv(p)
        return History(symbol, interval, df, "cache", fetched_at=p.stat().st_mtime) if len(df) else None
    except Exception as exc:  # noqa: BLE001
        log.warning("bad cache file %s: %s", p, exc)
        return None


def _from_import_csv(symbol: str, interval: str) -> History | None:
    if not IMPORT_DIR.exists():
        return None
    safe = symbol.replace(" ", "_")
    candidates = [IMPORT_DIR / f"{safe}_{interval}.csv", IMPORT_DIR / f"{safe}.csv"] if interval == "1D" else [IMPORT_DIR / f"{safe}_{interval}.csv"]
    for p in candidates:
        if p.exists():
            try:
                df = _load_csv(p)
                if len(df):
                    return History(symbol, interval, df, "csv", ticker=p.name, fetched_at=p.stat().st_mtime)
            except Exception as exc:  # noqa: BLE001
                log.warning("could not parse %s: %s", p, exc)
    return None


def _from_yahoo(symbol: str, interval: str, period: str | None) -> History | None:
    global _yahoo_fail_count, _yahoo_skip_until
    if time.time() < _yahoo_skip_until:
        return None
    try:
        import yfinance as yf  # imported lazily so tests run without network
    except ImportError:  # pragma: no cover
        return None
    inst = universe.get(symbol)
    yf_interval, default_period, _, _ = INTERVALS[interval]
    for ticker in inst.yahoo:
        try:
            raw = yf.Ticker(ticker).history(period=period or default_period, interval=yf_interval, auto_adjust=False, actions=False)
            df = _normalize(raw)
            if len(df) >= 30:
                _yahoo_fail_count = 0
                return History(symbol, interval, df, "yahoo", ticker=ticker, fetched_at=time.time())
        except Exception as exc:  # noqa: BLE001 - network/provider errors
            log.info("yahoo %s %s failed: %s", ticker, interval, exc)
    _yahoo_fail_count += 1
    if _yahoo_fail_count >= 3:
        log.warning("Yahoo Finance unreachable - using cache/CSV/synthetic data for 5 minutes")
        _yahoo_skip_until = time.time() + 300
        _yahoo_fail_count = 0
    return None


def synthetic_history(symbol: str, interval: str = "1D", bars: int | None = None) -> pd.DataFrame:
    """Deterministic regime-switching GBM so offline demos/tests are reproducible."""
    _, _, _, per_day = INTERVALS[interval]
    if bars is None:
        bars = {"5m": 75 * 40, "15m": 25 * 60, "1h": 7 * 250, "1D": 1250, "1W": 520}[interval]
    seed = int(hashlib.md5(f"{symbol}|{interval}".encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    anchor = _SYNTH_ANCHOR.get(symbol, 1000.0)
    is_index = universe.get(symbol).is_index

    ann_vol = 0.14 if is_index else 0.26
    bar_vol = ann_vol / np.sqrt(252 * per_day) if interval != "1W" else ann_vol / np.sqrt(52)
    # regimes: trending up / down / ranging, switching every ~60-120 bars
    rets = np.empty(bars)
    i = 0
    while i < bars:
        length = int(rng.integers(60, 140))
        regime = rng.choice(["up", "down", "range"], p=[0.45, 0.25, 0.30])
        drift = {"up": 0.6, "down": -0.6, "range": 0.0}[regime] * bar_vol / 3
        vol = bar_vol * {"up": 0.9, "down": 1.3, "range": 0.75}[regime]
        n = min(length, bars - i)
        # fat tails via student-t
        rets[i:i + n] = drift + vol * rng.standard_t(5, n) / np.sqrt(5 / 3)
        i += n
    closes = np.exp(np.cumsum(rets))
    closes = closes / closes[-1] * anchor
    opens = np.empty(bars)
    opens[0] = closes[0] * (1 - rets[0] / 2)
    gap = rng.normal(0, bar_vol * 0.25, bars)
    opens[1:] = closes[:-1] * (1 + gap[1:])
    span = np.abs(rng.normal(0, bar_vol, bars)) * closes
    highs = np.maximum(opens, closes) + span * rng.uniform(0.1, 0.8, bars)
    lows = np.minimum(opens, closes) - span * rng.uniform(0.1, 0.8, bars)
    base_vol = 2.0e8 / per_day if is_index else 8.0e6 / per_day
    volume = base_vol * rng.lognormal(0, 0.35, bars) * (1 + 25 * np.abs(rets))

    end = pd.Timestamp.now(tz="Asia/Kolkata").normalize()
    if interval in ("1D", "1W"):
        freq = "B" if interval == "1D" else "W-FRI"
        idx = pd.date_range(end=end, periods=bars, freq=freq) + pd.Timedelta(hours=15, minutes=30)
    else:
        minutes = {"5m": 5, "15m": 15, "1h": 60}[interval]
        days = int(np.ceil(bars / per_day)) + 1
        sessions = pd.bdate_range(end=end, periods=days)
        stamps = []
        for d in sessions:
            start = d + pd.Timedelta(hours=9, minutes=15)
            stamps.extend(start + pd.Timedelta(minutes=minutes * k) for k in range(per_day))
        idx = pd.DatetimeIndex(stamps[-bars:])
    df = pd.DataFrame({"open": opens, "high": highs, "low": lows, "close": closes, "volume": volume.round()}, index=idx)
    return _normalize(df.round(2))


# --------------------------------------------------------------------------- public
def get_history(symbol: str, interval: str = "1D", period: str | None = None, use_cache: bool = True) -> History:
    if interval not in INTERVALS:
        raise ValueError(f"interval must be one of {list(INTERVALS)}")
    key = (symbol, interval)
    ttl = INTERVALS[interval][2]
    now = time.time()
    with _lock:
        cached = _mem.get(key)
    if use_cache and cached and now - cached.fetched_at < ttl and period is None:
        return cached

    h: History | None = None
    if DATA_SOURCE in ("auto", "yahoo"):
        h = _from_yahoo(symbol, interval, period)
        if h:
            _save_cache(h)
        else:
            h = _from_disk_cache(symbol, interval)
    if h is None and DATA_SOURCE in ("auto", "csv"):
        h = _from_import_csv(symbol, interval)
    if h is None and DATA_SOURCE in ("auto", "synthetic", "csv", "yahoo"):
        h = History(symbol, interval, synthetic_history(symbol, interval), "synthetic", fetched_at=now)
    assert h is not None
    if h.source != "yahoo":
        h.fetched_at = now  # TTL applies to fallbacks too, so we don't hammer Yahoo when offline
    with _lock:
        _mem[key] = h
    return h


def clear_memory_cache() -> None:
    with _lock:
        _mem.clear()
