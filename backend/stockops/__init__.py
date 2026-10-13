"""StockOps analysis engine.

Real-data technical, volume-spread, volatility and options analytics for the
StockOps terminal. Knowledge sources the rules are drawn from:

* NSE NCFM Technical Analysis Module (candlesticks, patterns, indicators,
  regime "tool kits", Dow theory, risk management)
* Zerodha Varsity Module 5, Options Theory (Black-Scholes greeks, historical
  volatility, normal-distribution ranges, SD-based strike selection,
  volatility-based stop-loss)
* NSE Options Trading Strategies module and IJNRD 2022 paper (strategy menu by
  market view and volatility)
* Tom Williams, *Master the Markets* (Volume Spread Analysis: no demand / no
  supply, tests, up-thrusts, climaxes, stopping volume, relative strength vs
  the parent index)
* Rayner Teo, *Price Action Trading Secrets* (market structure, area of value,
  MAEE and MBEE trade formulas, ATR-buffered stops, 1% risk sizing)
* CFI, *The Complete Guide to Trading* (ADX, MACD, pin bars, golden cross,
  5/8/13 EMA, simple ADX trend strategy)
"""

__version__ = "1.0.0"
