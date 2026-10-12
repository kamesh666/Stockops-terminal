export type MarketSegment = 'INDICES' | 'LARGE_CAP' | 'MID_CAP' | 'FNO_HEAVYWEIGHTS';

export interface StockQuote {
  symbol: string;
  name: string;
  segment: MarketSegment;
  exchange: 'NSE' | 'BSE';
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  lotSize: number;
  iv: number; // Implied Volatility %
  ivRank: number; // 0 - 100%
  pcr: number; // Put Call Ratio
  vwap: number;
  ema20: number;
  sma50: number;
  sma200: number;
  rsi: number;
  atr: number;
  support: number;
  resistance: number;
}

export interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  ema20?: number;
  sma50?: number;
}

export type OptionType = 'CE' | 'PE'; // Call European, Put European (NSE standard)

export interface OptionContract {
  strike: number;
  type: OptionType;
  expiry: string;
  ltp: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  changeInOI: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionChainRow {
  strike: number;
  call: OptionContract;
  put: OptionContract;
  isAtm?: boolean;
}

export type PatternType =
  | 'Bullish Flag Breakout'
  | 'Double Bottom (W-Pattern)'
  | 'Break of Structure (BOS)'
  | 'VWAP Bounce + Momentum'
  | 'Rangebound Box (Theta Harvest)'
  | 'Ascending Triangle'
  | 'Bearish Breakdown'
  | 'High IV Crush Setup'
  | 'Oversold RSI Mean Reversion';

export type StrategyCategory =
  | 'Bullish'
  | 'Bearish'
  | 'Neutral / Rangebound'
  | 'High Volatility'
  | 'Low Volatility / Income';

export interface StrategyLeg {
  id: string;
  type: OptionType | 'EQUITY';
  action: 'BUY' | 'SELL';
  strike: number;
  expiry: string;
  premium: number;
  lots: number;
  lotSize: number;
  delta?: number;
  theta?: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  category: StrategyCategory;
  outlook: string;
  description: string;
  maxProfit: string | number;
  maxLoss: string | number;
  idealIV: 'Low' | 'High' | 'Neutral' | 'Any';
  legsGenerator: (spot: number, lotSize: number, atmStrike: number, strikeStep: number, expiry: string) => StrategyLeg[];
}

export interface AutomatedSetup {
  id: string;
  symbol: string;
  stockName: string;
  currentPrice: number;
  timeframe: '5m Intraday' | '15m Swing' | '1D Positional';
  pattern: PatternType;
  patternConfidence: number; // 0 - 100
  marketView: 'Bullish' | 'Bearish' | 'Range-Bound' | 'Volatile';
  recommendedStrategy: string;
  strategyCategory: StrategyCategory;
  recommendedLegs: StrategyLeg[];
  entryPrice: number;
  stopLoss: number;
  invalidationReason: string;
  target1: number;
  target2: number;
  riskRewardRatio: string;
  minimumCapital: number;
  calculatedLots: number;
  maxRiskAmount: number;
  targetProfitAmount: number;
  explanation: string;
  timestamp: string;
}

export interface TradePlaybookEntry {
  id: string;
  symbol: string;
  strategyName: string;
  entryDate: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  positionSize: string;
  capitalDeployed: number;
  riskAmount: number;
  status: 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'CLOSED';
  currentPnL: number;
  emotion: 'Disciplined' | 'Cautious' | 'Aggressive' | 'Neutral';
  lesson: string;
}
