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

export type PresetTradeTag =
  | 'Earnings'
  | 'Breakout'
  | 'Reversal'
  | 'Momentum'
  | 'VWAP Bounce'
  | 'Theta Decay'
  | 'Golden Cross'
  | 'Squeeze Fired'
  | 'Support Retest'
  | 'AVWAP Defense'
  | 'Gap Fill'
  | 'Expiry Play';

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
  tags?: string[];
}

export interface BacktestTrade {
  id: string;
  tradeNumber: number;
  entryDate: string;
  exitDate: string;
  entrySpot: number;
  exitSpot: number;
  legsDescription: string;
  capitalCommitted: number;
  realizedPnL: number;
  roiPercent: number;
  exitReason: 'TARGET_HIT' | 'SL_HIT' | 'EXPIRED';
}

export interface BacktestDailyPoint {
  day: number;
  date: string;
  spotPrice: number;
  cumulativePnL: number;
  portfolioEquity: number;
  drawdownPercent: number;
}

export interface BacktestReport {
  symbol: string;
  strategyId: string;
  strategyName: string;
  periodDays: number;
  initialCapital: number;
  finalEquity: number;
  totalPnL: number;
  roiPercent: number;
  benchmarkReturnPercent: number;
  winRate: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  sharpeRatio: number;
  dailyPoints: BacktestDailyPoint[];
  trades: BacktestTrade[];
}

export interface AlgoFactorCheck {
  factor: string;
  weight: number;
  score: number;
  passed: boolean;
  value: string;
}

export interface AlgoSignal {
  id: string;
  symbol: string;
  instrumentName: string;
  isOptionContract: boolean;
  contractCallOrPut?: 'CE' | 'PE';
  strike?: number;
  expiryDate?: string;
  optionLtp?: number;
  underlyingSpot: number;
  signalType: 'STRONG_BUY_CALL' | 'STRONG_BUY_PUT' | 'STRONG_BULL_SPREAD' | 'STRONG_BEAR_SPREAD' | 'STRONG_IRON_CONDOR';
  actionLabel: string;
  patternName: string;
  algoConfidenceScore: number; // 0 - 100
  timeframe: '5m Intraday' | '15m Swing' | '1D Positional';
  entryPrice: number;
  stopLossPrice: number;
  target1: number;
  target2: number;
  target3: number;
  riskReward: string;
  invalidationTrigger: string;
  capitalRequired: number;
  recommendedLots: number;
  maxRiskAmount: number;
  projectedProfit: number;
  executionTrigger: string;
  checklist: AlgoFactorCheck[];
  timestamp: string;
}

export interface InstitutionalPillarState {
  pillarName: string;
  sourceAuthority: 'TrendSpider' | 'CMC Markets' | 'TradingComputers' | 'Investopedia';
  metricLabel: string;
  metricValue: string;
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SQUEEZE_ALERT';
  score: number; // 0 - 100
  insight: string;
}

export interface MasterAlgoSignal {
  id: string;
  symbol: string;
  stockName: string;
  underlyingSpot: number;
  tradeAction: string;
  optionType: 'CE' | 'PE';
  strike: number;
  expiry: string;
  optionLtp: number;
  timeframe: '5m Scalp' | '15m Momentum' | '1D Positional';
  masterConfidenceScore: number;
  entryPrice: number;
  hardStopLoss: number;
  trailingAtrStop: number;
  target1: number;
  target2: number;
  target3: number;
  riskReward: string;
  avwapValue: number;
  squeezeStatus: 'FIRING_LONG' | 'FIRING_SHORT' | 'SQUEEZE_COMPRESSION' | 'NO_SQUEEZE';
  ichimokuState: 'KUMO_BREAKOUT_BULL' | 'KUMO_BREAKDOWN_BEAR' | 'INSIDE_CLOUD';
  fibRetestLevel: number;
  volumePoc: number;
  gammaRiskFactor: 'HIGH_GAMMA_SURGE' | 'STABLE_DELTA' | 'THETA_DOMINANT';
  invalidationLevel: string;
  capitalSizing: {
    recommendedLots: number;
    shares: number;
    capitalRequired: number;
    maxRiskAmount: number;
    expectedGain: number;
  };
  pillars: InstitutionalPillarState[];
  timestamp: string;
}



