/**
 * Client for the Python analysis engine (backend/stockops/api.py).
 * Vite proxies /api -> http://127.0.0.1:8000 in dev (see vite.config.ts).
 * Every call fails fast so the terminal can fall back to its built-in simulator.
 */
import { Candle, StockQuote } from '../types/market';

const BASE = (import.meta as any).env?.VITE_STOCKOPS_API ?? '';

async function get<T>(path: string, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const enc = (s: string) => encodeURIComponent(s);
const qs = (o: Record<string, string | number | boolean | undefined | null>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${enc(String(v))}`)
    .join('&');

export type DataSource = 'yahoo' | 'cache' | 'csv' | 'synthetic';

export interface Health {
  status: string;
  version: string;
  dataSourceMode: string;
  yfinanceInstalled: boolean;
  liveSource: DataSource;
  lastBar: string;
}

export interface BackendQuote extends Partial<StockQuote> {
  symbol: string;
  price: number;
  dataSource: DataSource;
  lastBarTime: string;
  ivIsHvProxy?: boolean;
}

export interface ChartBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number | null;
  sma50: number | null;
  sma200: number | null;
  vwap: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  adx: number | null;
}

export interface Zone {
  low: number;
  high: number;
  mid: number;
  touches: number;
  strength: number;
  type: 'support' | 'resistance';
  flipped: boolean;
}

export interface Factor {
  factor: string;
  group: string;
  weight: number;
  score: number;
  contribution: number;
  value: string;
  reading: string;
}

export interface CandleSignal {
  index: number;
  time: string;
  name: string;
  bias: 'bullish' | 'bearish';
  score: number;
  confirmed: boolean | null;
  barsAgo: number;
  enhancements: string[];
  description: string;
}

export interface VsaSignal {
  time: string;
  barsAgo: number;
  name: string;
  kind: 'strength' | 'weakness';
  description: string;
  volumeRatio: number;
  spreadRatio: number;
  closePosition: number;
}

export interface Setup {
  name: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  active: boolean;
  detail: string;
  source: string;
  entry?: number;
  stop?: number;
  target?: number | null;
}

export interface TradePlan {
  direction: 'long' | 'short' | 'none';
  reason?: string;
  entry?: number;
  stop?: number;
  structureStop?: number;
  volatilityStop?: number;
  targets?: number[];
  riskPerShare?: number;
  rewardRiskT1?: number;
  riskAmount?: number;
  quantity?: number;
  lots?: number | null;
  lotSize?: number;
  notional?: number;
  oneLotRisk?: number | null;
  lotNote?: string;
  entryTrigger?: string;
  trailing?: string;
  checklist: { item: string; pass: boolean | null }[];
  checklistPassed?: number;
  checklistFailed?: number;
  grade?: string;
  skip?: boolean;
}

export interface OptionGreeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  probITM?: number;
}

export interface OptionsIdea {
  view: string;
  volRegime: 'low' | 'normal' | 'high';
  hv20Pct: number;
  hvRank: number | null;
  sigmaUsedPct: number;
  expiry: { date: string; kind: string; daysToExpiry: number; tradingDaysToExpiry: number };
  atmStrike: number;
  strikeStep: number;
  sdMultiple: number;
  sdStrikes: {
    callToWrite: OptionGreeks & { strike: number };
    putToWrite: OptionGreeks & { strike: number };
    upperRange: number;
    lowerRange: number;
  };
  atmCall: OptionGreeks;
  atmPut: OptionGreeks;
  strategies: { id: string; name: string; view: string; vol: string; risk: string; legs: string }[];
  notes: string[];
}

export interface Analysis {
  symbol: string;
  interval: string;
  dataSource: DataSource;
  ticker: string;
  bars: number;
  quote: { price: number; change: number; changePercent: number; name: string; lastBarTime: string; previousClose: number };
  indicators: Record<string, number | null>;
  regime: {
    key: string;
    current: string;
    title: string;
    adx: number | null;
    trendStrength: string;
    rsiZones: { oversold: number; overbought: number };
    toolkit: string[];
  };
  dow: { primary: string; secondary: string; minor: string };
  structure: { trend: string; labels: { time: string; price: number; label: string }[]; lastSwingHigh: number | null; lastSwingLow: number | null };
  stage: { stage: string; explanation: string };
  zones: Zone[];
  nearestSupport: Zone | null;
  nearestResistance: Zone | null;
  fibonacci: { swingFrom: number; swingTo: number; direction: string; levels: Record<string, number> } | null;
  chartPatterns: { name: string; bias: string; status: string; neckline: number; target: number; invalidation: number; note: string }[];
  buildup: { boxHigh: number; boxLow: number; bias: string; trigger: string; stop: number; tightness: number; note: string } | null;
  gaps: { time: string; direction: string; kind: string; from: number; to: number; filled: boolean; volumeRatio: number }[];
  candlesticks: CandleSignal[];
  vsa: {
    available: boolean;
    note?: string;
    signals: VsaSignal[];
    bias: string;
    strengthScore: number;
    weaknessScore: number;
  };
  relativeStrength: {
    available: boolean;
    verdict?: string;
    note?: string;
    stockReturnPct?: number;
    parentReturnPct?: number;
    rsLineChangePct?: number;
  } | null;
  parentIndex: string;
  parentTrend: string | null;
  volatility: {
    hv10: number | null;
    hv20: number | null;
    hv60: number | null;
    hvRank: number | null;
    atr: number;
    atrPct: number;
    cone: { window: number; current: number; min: number; median: number; max: number; percentile: number }[];
    expected: {
      dailySdPct: number;
      annualVolPct: number;
      ranges: Record<string, { days: number; sd1: [number, number]; sd2: [number, number]; sd3: [number, number] }>;
    };
  };
  confluence: { score: number; verdict: string; bullishFactors: number; bearishFactors: number; agreementPct: number; factors: Factor[] };
  setups: Setup[];
  tradePlan: TradePlan;
  options: OptionsIdea;
  chart: ChartBar[];
}

export interface ScanRow {
  symbol: string;
  name?: string;
  price?: number;
  changePercent?: number;
  dataSource?: DataSource;
  score?: number;
  verdict?: string;
  agreementPct?: number;
  regime?: string;
  stage?: string;
  trend?: string;
  rsi?: number;
  adx?: number;
  candle?: { name: string; bias: string; barsAgo: number } | null;
  vsaBias?: string;
  vsaRecent?: string[];
  relativeStrength?: string | null;
  hvRank?: number | null;
  activeSetups?: string[];
  plan?: Partial<TradePlan>;
  optionIdeas?: string[];
  volRegime?: string;
  error?: string;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  calmar: number | null;
  trades: number;
  winRatePct: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  expectancyR: number;
  avgBarsHeld: number;
  finalEquity: number;
  netProfit: number;
  exposurePct?: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  strategyInfo: { name: string; source: string; style: string };
  interval: string;
  dataSource: DataSource;
  from: string;
  to: string;
  bars: number;
  metrics: BacktestMetrics;
  benchmark: BacktestMetrics;
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics | Record<string, never>;
  splitDate: string;
  equityCurve: { time: string; equity: number; benchmark: number; drawdownPct: number }[];
  trades: { entryTime: string; exitTime: string; side: string; qty: number; entry: number; exit: number; pnl: number; returnPct: number; r: number; bars: number; exitReason: string }[];
  monthly: { year: number; month: number; returnPct: number }[];
  notes: string[];
}

export interface CompareRow {
  strategy: string;
  name: string;
  source: string;
  style: string;
  cagrPct?: number;
  sharpe?: number;
  maxDrawdownPct?: number;
  winRatePct?: number;
  profitFactor?: number | null;
  trades?: number;
  expectancyR?: number;
  exposurePct?: number;
  oosSharpe?: number | null;
  benchmarkCagrPct?: number;
  error?: string;
}

export interface BacktestOptions {
  strategy: string;
  interval?: string;
  capital?: number;
  risk_pct?: number;
  stop_atr?: number;
  trail_atr?: number;
  target_r?: number;
  cost_pct?: number;
  allow_short?: boolean;
  sizing?: 'risk' | 'full';
}

export const api = {
  health: () => get<Health>('/api/health', 6000),
  quotes: () => get<BackendQuote[]>('/api/quotes', 60000),
  history: (symbol: string, interval: string, bars = 120) =>
    get<{ dataSource: DataSource; candles: ChartBar[] }>(`/api/history/${enc(symbol)}?${qs({ interval, bars })}`),
  analysis: (symbol: string, o: { interval?: string; capital?: number; risk_pct?: number; holding_days?: number; iv?: number } = {}) =>
    get<Analysis>(`/api/analysis/${enc(symbol)}?${qs(o)}`, 60000),
  scan: (o: { interval?: string; capital?: number; risk_pct?: number } = {}) => get<ScanRow[]>(`/api/scan?${qs(o)}`, 120000),
  backtest: (symbol: string, o: BacktestOptions) => get<BacktestResult>(`/api/backtest/${enc(symbol)}?${qs({ ...o })}`, 120000),
  compare: (symbol: string, o: Omit<BacktestOptions, 'strategy'> = {}) =>
    get<CompareRow[]>(`/api/backtest/${enc(symbol)}/compare?${qs({ ...o })}`, 180000),
  strategies: () => get<{ backtest: { id: string; name: string; source: string; style: string }[] }>('/api/strategies'),
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  yahoo: 'Yahoo Finance (delayed)',
  cache: 'Cached download',
  csv: 'Imported CSV',
  synthetic: 'Synthetic (offline)',
};

/** Convert backend bars into the app's Candle shape for the existing CandlestickChart. */
export function toAppCandles(bars: ChartBar[], timeframe: string): Candle[] {
  return bars.map((b) => {
    const d = new Date(b.time);
    const time =
      timeframe === '1D'
        ? d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return {
      time,
      timestamp: d.getTime(),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      vwap: b.vwap ?? undefined,
      ema20: b.ema20 ?? undefined,
      sma50: b.sma50 ?? undefined,
    };
  });
}

/** Overlay real prices/indicators onto the app's instrument list (keeps PCR etc. that Yahoo doesn't supply). */
export function mergeQuotes(base: StockQuote[], live: BackendQuote[]): StockQuote[] {
  const bySym = new Map(live.map((q) => [q.symbol, q]));
  return base.map((inst) => {
    const q = bySym.get(inst.symbol);
    if (!q) return inst;
    const pick = (v: number | null | undefined, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);
    return {
      ...inst,
      price: pick(q.price, inst.price),
      change: pick(q.change, inst.change),
      changePercent: pick(q.changePercent, inst.changePercent),
      open: pick(q.open, inst.open),
      high: pick(q.high, inst.high),
      low: pick(q.low, inst.low),
      previousClose: pick(q.previousClose, inst.previousClose),
      volume: pick(q.volume, inst.volume),
      iv: pick(q.iv, inst.iv),
      ivRank: pick(q.ivRank, inst.ivRank),
      vwap: pick(q.vwap, inst.vwap),
      ema20: pick(q.ema20, inst.ema20),
      sma50: pick(q.sma50, inst.sma50),
      sma200: pick(q.sma200, inst.sma200),
      rsi: pick(q.rsi, inst.rsi),
      atr: pick(q.atr, inst.atr),
      support: pick(q.support, inst.support),
      resistance: pick(q.resistance, inst.resistance),
    };
  });
}
