"""Technical indicators (vectorised pandas).

Formulas follow the NSE NCFM Technical Analysis workbook, chapter 4, and the CFI
trading guide: SMA/EMA, Wilder RSI, Stochastic, Williams %R, MACD (12/26/9),
Money Flow Index, Bollinger Bands (20, 2), ATR, ADX/DMI, OBV, VWAP, the Elder
impulse system and the 5/8/13 EMA ribbon.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def wilder(s: pd.Series, n: int) -> pd.Series:
    """Wilder's smoothing (RMA) used by RSI, ATR and ADX."""
    return s.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    d = close.diff()
    gain = wilder(d.clip(lower=0), n)
    loss = wilder(-d.clip(upper=0), n)
    rs = gain / loss.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    return out.where(loss != 0, 100.0)


def true_range(df: pd.DataFrame) -> pd.Series:
    pc = df["close"].shift()
    return pd.concat([df["high"] - df["low"], (df["high"] - pc).abs(), (df["low"] - pc).abs()], axis=1).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return wilder(true_range(df), n)


def stochastic(df: pd.DataFrame, k: int = 14, d: int = 3, smooth: int = 3) -> tuple[pd.Series, pd.Series]:
    ll = df["low"].rolling(k).min()
    hh = df["high"].rolling(k).max()
    raw = 100 * (df["close"] - ll) / (hh - ll).replace(0, np.nan)
    k_line = raw.rolling(smooth).mean()
    return k_line, k_line.rolling(d).mean()


def williams_r(df: pd.DataFrame, n: int = 14) -> pd.Series:
    hh = df["high"].rolling(n).max()
    ll = df["low"].rolling(n).min()
    return -100 * (hh - df["close"]) / (hh - ll).replace(0, np.nan)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return line, sig, line - sig


def mfi(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """Money Flow Index = 100 - 100 / (1 + positive flow / negative flow)."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    flow = tp * df["volume"]
    up = flow.where(tp > tp.shift(), 0.0).rolling(n).sum()
    dn = flow.where(tp < tp.shift(), 0.0).rolling(n).sum()
    ratio = up / dn.replace(0, np.nan)
    out = 100 - 100 / (1 + ratio)
    return out.where(df["volume"].rolling(n).sum() > 0)


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    mid = sma(close, n)
    sd = close.rolling(n).std(ddof=0)
    upper, lower = mid + k * sd, mid - k * sd
    bandwidth = (upper - lower) / mid
    return upper, mid, lower, bandwidth


def adx(df: pd.DataFrame, n: int = 14) -> tuple[pd.Series, pd.Series, pd.Series]:
    up = df["high"].diff()
    dn = -df["low"].diff()
    plus_dm = up.where((up > dn) & (up > 0), 0.0)
    minus_dm = dn.where((dn > up) & (dn > 0), 0.0)
    tr = wilder(true_range(df), n)
    plus_di = 100 * wilder(plus_dm, n) / tr
    minus_di = 100 * wilder(minus_dm, n) / tr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return wilder(dx, n), plus_di, minus_di


def obv(df: pd.DataFrame) -> pd.Series:
    direction = np.sign(df["close"].diff()).fillna(0)
    return (direction * df["volume"]).cumsum()


def session_vwap(df: pd.DataFrame) -> pd.Series:
    """Intraday VWAP resetting each session (for daily bars: rolling 20-bar VWAP)."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    vol = df["volume"].replace(0, np.nan)
    if len(df) > 1 and (df.index[1] - df.index[0]) < pd.Timedelta(days=1):
        day = df.index.date
        pv = (tp * vol).groupby(day).cumsum()
        vv = vol.groupby(day).cumsum()
        out = pv / vv
    else:
        out = (tp * vol).rolling(20).sum() / vol.rolling(20).sum()
    return out.fillna(tp)


def donchian(df: pd.DataFrame, n: int = 20) -> tuple[pd.Series, pd.Series]:
    return df["high"].rolling(n).max(), df["low"].rolling(n).min()


def elder_impulse(close: pd.Series) -> pd.Series:
    """+1 green (EMA13 rising & MACD-hist rising), -1 red (both falling), 0 blue."""
    e = ema(close, 13)
    _, _, hist = macd(close)
    up = (e.diff() > 0) & (hist.diff() > 0)
    dn = (e.diff() < 0) & (hist.diff() < 0)
    return pd.Series(np.where(up, 1, np.where(dn, -1, 0)), index=close.index)


def compute_all(df: pd.DataFrame) -> pd.DataFrame:
    """Return df with every indicator column appended."""
    out = df.copy()
    c = out["close"]
    out["sma20"], out["sma50"], out["sma200"] = sma(c, 20), sma(c, 50), sma(c, 200)
    out["ema5"], out["ema8"], out["ema13"] = ema(c, 5), ema(c, 8), ema(c, 13)
    out["ema20"], out["ema50"] = ema(c, 20), ema(c, 50)
    out["rsi"] = rsi(c)
    out["atr"] = atr(out)
    out["stoch_k"], out["stoch_d"] = stochastic(out)
    out["willr"] = williams_r(out)
    out["macd"], out["macd_signal"], out["macd_hist"] = macd(c)
    out["mfi"] = mfi(out)
    out["bb_upper"], out["bb_mid"], out["bb_lower"], out["bb_width"] = bollinger(c)
    out["adx"], out["plus_di"], out["minus_di"] = adx(out)
    out["obv"] = obv(out)
    out["vwap"] = session_vwap(out)
    out["dc_high"], out["dc_low"] = donchian(out)
    out["impulse"] = elder_impulse(c)
    out["vol_sma20"] = sma(out["volume"], 20)
    out["spread"] = out["high"] - out["low"]
    out["spread_sma20"] = sma(out["spread"], 20)
    return out


def divergence(price: pd.Series, osc: pd.Series, lookback: int = 40, order: int = 3) -> str | None:
    """Detect regular bullish/bearish divergence over the last ``lookback`` bars.

    Bullish: price makes a lower low while the oscillator makes a higher low.
    Bearish: price makes a higher high while the oscillator makes a lower high.
    """
    p = price.iloc[-lookback:]
    o = osc.iloc[-lookback:]
    if o.isna().sum() > lookback // 2:
        return None
    lows, highs = [], []
    for i in range(order, len(p) - order):
        win = p.iloc[i - order:i + order + 1]
        if p.iloc[i] == win.min():
            lows.append(i)
        if p.iloc[i] == win.max():
            highs.append(i)
    # include the latest bar as a provisional pivot
    last = len(p) - 1
    if p.iloc[last] <= p.iloc[-order - 1:].min():
        lows.append(last)
    if p.iloc[last] >= p.iloc[-order - 1:].max():
        highs.append(last)
    if len(lows) >= 2:
        a, b = lows[-2], lows[-1]
        if b - a >= order and p.iloc[b] < p.iloc[a] and o.iloc[b] > o.iloc[a]:
            return "bullish"
    if len(highs) >= 2:
        a, b = highs[-2], highs[-1]
        if b - a >= order and p.iloc[b] > p.iloc[a] and o.iloc[b] < o.iloc[a]:
            return "bearish"
    return None
