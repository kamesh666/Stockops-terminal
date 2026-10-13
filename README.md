# StockOps Terminal

Indian market & options trading terminal (React + Vite) with a **Python analysis engine** that runs on real NSE/BSE price history.

The engine turns the rules from the reference PDFs in the parent folder into code: candlestick criteria, chart patterns, indicator "tool kits", Volume Spread Analysis, Varsity volatility maths and the NSE 22-strategy menu. It produces one scored, risk-sized trade plan per instrument and backtests rule-based strategies on years of data.

## Run it

Two terminals, both opened in this folder.

**1. Python engine (port 8000)**

```bash
npm run api:install        # once: pip install -r backend/requirements.txt
npm run api                # python -m uvicorn stockops.api:app --reload --port 8000
```

**2. Web app (port 3000)**

```bash
npm install
npm run dev
```

Open http://localhost:3000. The top-right badge shows where the data comes from. If the engine isn't running, the app falls back to its built-in simulator, and the badge says *Data: Simulated*.

Run the engine tests with `npm run api:test`.

## Where the data comes from

| Order | Source | Notes |
|---|---|---|
| 1 | **Yahoo Finance** via `yfinance` | Automatic. `RELIANCE.NS`, `^NSEI`, `^NSEBANK`, `^BSESN`… Daily 5 years, hourly 2 years, 5/15-min last 60 days. Delayed, not real-time. |
| 2 | `backend/cache/` | The last good download, so the app still works offline. |
| 3 | `backend/data_import/` | **Your own CSVs, e.g. from Google Finance** (see below). |
| 4 | Synthetic | Deterministic demo data, clearly labelled *Synthetic (offline)* in the UI. |

Force a source with an environment variable: `STOCKOPS_DATA_SOURCE=yahoo|csv|synthetic` (default `auto`).

### Using Google Finance data

Google Finance has no download API, but Google Sheets can pull its history:

1. In a new Google Sheet, cell A1: `=GOOGLEFINANCE("NSE:RELIANCE","all",DATE(2021,1,1),TODAY())`
2. *File → Download → Comma-separated values (.csv)*
3. Save it as `backend/data_import/RELIANCE.csv` (the app symbol, e.g. `NIFTY_50.csv` for NIFTY 50). For intraday data, use `RELIANCE_15m.csv`.

The loader accepts `Date, Open, High, Low, Close, Volume` columns in any letter case. Set `STOCKOPS_DATA_SOURCE=csv` to prefer your CSVs over Yahoo.

> Yahoo returns **no volume for indices** (NIFTY, BANKNIFTY…). The engine detects this and switches off VSA and MFI for those, with a note in the UI. Analyse a constituent stock for volume-based reads.

## What the upgrade adds

### Deep Analysis tab (new)
- **Universe scan**: runs the full analysis on all 14 instruments and ranks them by confluence score.
- **Confluence score (−100…+100)** built from 15 weighted factors. Each one shows its value and the book rule behind it:
  Dow primary/secondary trend · swing structure (HH/HL) · ADX/DMI · MACD · regime-aware RSI · stochastic tool-kit crossovers · Bollinger %B/squeeze · candlestick trigger · VSA background · relative strength vs parent index · MFI+OBV · Elder impulse · RSI/MACD divergence · chart patterns.
- **Regime and tool kit** (NSE TA 4.4.5–4.4.11): bull, bear, trading, and the four transition phases, with the matching indicator rules. RSI zones shift to 40/70 in bulls and 30/60 in bears.
- **Market stage** (accumulation / advancing / distribution / declining) and Dow theory primary/secondary/minor trends.
- **Price chart**: EMA20/SMA50/SMA200, Bollinger bands, clustered S/R zones, trade-plan levels, candlestick ▲▼ and VSA ● markers, RSI panel with regime zones, MACD panel.
- **Trade plan**:
  - Structure stop (zone ± 1 ATR, Rayner Teo) vs volatility stop (1-SD move over the holding period, Varsity ch.18). The wider one is used, capped at 3 ATR, and moved off round numbers (Tom Williams).
  - Targets at the next opposing zones ("don't trade into traffic"), then 2R/3R.
  - Size = risk % ÷ per-share risk, plus a lot-size check.
  - The 10-point *Master the Markets* long/short checklist, giving an A–D grade.
- **Named setups**: MAEE reversal, MBEE build-up breakout, golden/death cross, simple ADX trend, 5/8/13 EMA ribbon, Elder impulse, Bollinger squeeze.
- **VSA** signs of strength and weakness: test, no supply, stopping volume, selling climax, shake-out, up-thrust, no demand, buying climax, effort-without-result.
- **Volatility**: HV 10/20/60, 1-year HV rank, volatility cone, and 1-day/1-week/1-month expected ranges at 1 SD and 2 SD (Varsity ch.16–17).
- **Options**: next expiry, strikes to write at ±1 SD (±2 SD when more than 15 days remain), Black-Scholes premiums and greeks, and strategy picks from market view × volatility regime. *Open payoff* loads any pick into the Strategy Builder.
- **Log to Playbook** stores the plan in the 90-day journal.

### Backtest tab: historical backtest (new, above the old simulator)
- 10 strategies on real history: golden cross, 5/8/13 EMA, ADX > 25, MACD cross, RSI 40/70 regime pullback, Bollinger mean reversion (ranges only), 20-bar breakout, Elder impulse, candlestick reversal at value (MAEE), VSA test/no-supply.
- Signals on the close, fills at the next open (no look-ahead). ATR stops are checked intrabar, gaps fill at the open, and an optional ATR trailing stop or R-target can be added.
- Costs per side, risk-% or all-in sizing, optional shorts.
- Results: CAGR, Sharpe, Sortino, max drawdown, Calmar, win rate, profit factor, expectancy in R, exposure, and a buy-and-hold benchmark.
- Also: equity and drawdown chart, monthly heatmap, trade log, **in-sample vs out-of-sample** split, and a *Compare all 10* league table.

### Other changes
- Prices, RSI, EMA/SMA, ATR, VWAP, support/resistance and IV (HV-based proxy) in every tab come from the engine when it's running. The random tick simulator only runs offline.
- The Interactive Charts tab shows real candles.
- The Strategy Builder now has all 22 NSE strategies, plus collar and protective put.
- `package.json`: fixed the `esbuild` / Vite 8 peer-dependency conflict that made `npm install` fail.

## Engine layout (`backend/stockops/`)

| Module | Contents |
|---|---|
| `data.py` | Yahoo → cache → CSV → synthetic fallback chain, IST timestamps, circuit breaker when offline |
| `indicators.py` | SMA/EMA, Wilder RSI, ATR, stochastic, Williams %R, MACD, MFI, Bollinger, ADX/DMI, OBV, VWAP, Donchian, Elder impulse, divergence |
| `structure.py` | pivots, HH/HL structure, Dow trends, regime + tool kits, market stage, S/R zones, double top/bottom, H&S, build-up, gap theory, Fibonacci |
| `candles.py` | 15 candlestick patterns with trend context, enhancements and confirmation |
| `vsa.py` | Volume Spread Analysis + relative strength vs parent index |
| `options.py` | HV, HV rank, vol cone, expected ranges, volatility stop, expiry calendar, Black-Scholes, strategy selector |
| `analysis.py` | confluence score, setups, trade plan, checklist, JSON report |
| `backtest.py` | event-driven backtester and metrics |
| `scanner.py` / `api.py` | universe scan, FastAPI endpoints (`/api/analysis/{symbol}`, `/api/scan`, `/api/backtest/{symbol}`, `/api/backtest/{symbol}/compare`, `/api/quotes`, `/api/history/{symbol}`, `/api/options/{symbol}`) |

Interactive API docs: http://127.0.0.1:8000/docs

## Caveats

- Data is end-of-day or delayed. This is an analysis and education tool, not an execution system or investment advice.
- No live option chain or PCR feed: option premiums are theoretical, using HV as the IV proxy. Enter a real IV (the `iv` API parameter) for better premiums.
- Lot sizes and expiry days (NSE Tuesday since Sep 2025, SENSEX Thursday) change by circular. Verify them on the exchange website before trading. Exchange holidays aren't modelled.
- Backtests with fewer than 15 trades, or a big in-sample → out-of-sample drop, are flagged. Don't trust them.
