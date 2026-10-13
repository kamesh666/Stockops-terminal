"""Instrument universe: app symbols -> data-provider tickers and F&O metadata."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Instrument:
    symbol: str                 # symbol used by the React app
    name: str
    segment: str                # INDICES | LARGE_CAP | MID_CAP | FNO_HEAVYWEIGHTS
    exchange: str               # NSE | BSE
    lot_size: int
    yahoo: tuple[str, ...]      # candidate Yahoo Finance tickers, tried in order
    google: str = ""            # Google Finance code (for GOOGLEFINANCE() sheet import)
    parent: str = "NIFTY 50"    # parent index for relative-strength comparison
    is_index: bool = False
    tags: tuple[str, ...] = field(default_factory=tuple)


# Lot sizes mirror the React app. NSE revises lot sizes periodically -
# check the latest NSE F&O lot-size circular before trading real money.
UNIVERSE: list[Instrument] = [
    Instrument("NIFTY 50", "NIFTY 50 Index", "INDICES", "NSE", 25, ("^NSEI",), "INDEXNSE:NIFTY_50", "NIFTY 50", True),
    Instrument("BANKNIFTY", "Nifty Bank Index", "INDICES", "NSE", 15, ("^NSEBANK",), "INDEXNSE:NIFTY_BANK", "NIFTY 50", True),
    Instrument("FINNIFTY", "Nifty Financial Services", "INDICES", "NSE", 25, ("NIFTY_FIN_SERVICE.NS", "^CNXFIN"), "INDEXNSE:NIFTY_FIN_SERVICE", "NIFTY 50", True),
    Instrument("SENSEX", "BSE Sensex Index", "INDICES", "BSE", 10, ("^BSESN",), "INDEXBOM:SENSEX", "NIFTY 50", True),
    Instrument("RELIANCE", "Reliance Industries Ltd", "FNO_HEAVYWEIGHTS", "NSE", 250, ("RELIANCE.NS",), "NSE:RELIANCE"),
    Instrument("HDFCBANK", "HDFC Bank Ltd", "FNO_HEAVYWEIGHTS", "NSE", 550, ("HDFCBANK.NS",), "NSE:HDFCBANK", "BANKNIFTY"),
    Instrument("TCS", "Tata Consultancy Services", "FNO_HEAVYWEIGHTS", "NSE", 175, ("TCS.NS",), "NSE:TCS"),
    Instrument("INFY", "Infosys Ltd", "LARGE_CAP", "NSE", 400, ("INFY.NS",), "NSE:INFY"),
    Instrument("ICICIBANK", "ICICI Bank Ltd", "FNO_HEAVYWEIGHTS", "NSE", 700, ("ICICIBANK.NS",), "NSE:ICICIBANK", "BANKNIFTY"),
    # Tata Motors demerged in 2025; the passenger-vehicle entity trades as TMPV.
    Instrument("TATAMOTORS", "Tata Motors (Passenger Vehicles)", "LARGE_CAP", "NSE", 550, ("TMPV.NS", "TATAMOTORS.NS"), "NSE:TMPV"),
    Instrument("SBIN", "State Bank of India", "LARGE_CAP", "NSE", 750, ("SBIN.NS",), "NSE:SBIN", "BANKNIFTY"),
    Instrument("ITC", "ITC Ltd", "LARGE_CAP", "NSE", 1600, ("ITC.NS",), "NSE:ITC"),
    Instrument("BHARTIARTL", "Bharti Airtel Ltd", "LARGE_CAP", "NSE", 475, ("BHARTIARTL.NS",), "NSE:BHARTIARTL"),
    Instrument("LT", "Larsen & Toubro Ltd", "LARGE_CAP", "NSE", 150, ("LT.NS",), "NSE:LT"),
]

BY_SYMBOL: dict[str, Instrument] = {i.symbol: i for i in UNIVERSE}

# NSE weekly/monthly strike intervals for the indices in the app.
_INDEX_STRIKE_STEP = {"NIFTY 50": 50, "BANKNIFTY": 100, "FINNIFTY": 50, "SENSEX": 100}


def get(symbol: str) -> Instrument:
    """Return a known instrument, or build an ad-hoc NSE equity for any other symbol."""
    sym = symbol.strip().upper()
    if sym in BY_SYMBOL:
        return BY_SYMBOL[sym]
    if symbol in BY_SYMBOL:
        return BY_SYMBOL[symbol]
    # Any NSE cash symbol works (e.g. "ASIANPAINT") - lot size unknown, use 1.
    return Instrument(sym, sym, "LARGE_CAP", "NSE", 1, (f"{sym}.NS",), f"NSE:{sym}")


def strike_step(symbol: str, price: float) -> float:
    if symbol in _INDEX_STRIKE_STEP:
        return _INDEX_STRIKE_STEP[symbol]
    if price > 4000:
        return 50
    if price > 2000:
        return 20
    if price > 1000:
        return 10
    if price > 500:
        return 5
    return 2.5
