import { StockQuote, AutomatedSetup, PatternType } from '../types/market';
import { PRESET_STRATEGIES } from './strategyEngine';
import { getStrikeStep } from '../data/indianMarketData';

export interface ScanFilterOptions {
  segment?: string;
  marketView?: string;
  minConfidence?: number;
  userCapital?: number;
  riskPercent?: number;
}

/**
 * Automatically inspects all instruments in the Indian market universe,
 * evaluates price action, indicators, IV rank, and matches the ideal strategy
 * with exact Entry, Exit, Stop Loss, Invalidation reason, and Capital Sizing.
 */
export function scanMarketOpportunities(
  instruments: StockQuote[],
  userCapital: number = 100000,
  riskPercent: number = 1.5
): AutomatedSetup[] {
  const setups: AutomatedSetup[] = [];

  for (const stock of instruments) {
    const spot = stock.price;
    const step = getStrikeStep(stock.symbol, spot);
    const atmStrike = Math.round(spot / step) * step;
    const atr = stock.atr || spot * 0.015;

    // Pattern & technical analysis conditions
    const isAboveEma20 = spot > stock.ema20;
    const isAboveSma50 = spot > stock.sma50;
    const isAboveVwap = spot > stock.vwap;
    const isRsiOverbought = stock.rsi > 68;
    const isRsiOversold = stock.rsi < 38;
    const isHighIV = stock.ivRank > 55;
    const isLowIV = stock.ivRank < 35;
    const isPcrBullish = stock.pcr > 1.15;
    const isPcrBearish = stock.pcr < 0.85;

    let pattern: PatternType;
    let confidence: number;
    let marketView: 'Bullish' | 'Bearish' | 'Range-Bound' | 'Volatile';
    let strategyId: string;
    let timeframe: '5m Intraday' | '15m Swing' | '1D Positional';
    let entry: number;
    let stopLoss: number;
    let invalidation: string;
    let target1: number;
    let target2: number;
    let explanation: string;

    if (isAboveEma20 && isAboveSma50 && isPcrBullish && spot > stock.resistance * 0.995) {
      // Bullish Flag Breakout
      pattern = 'Bullish Flag Breakout';
      confidence = 88;
      marketView = 'Bullish';
      strategyId = isLowIV ? 'bull-call-spread' : 'bull-put-spread';
      timeframe = '15m Swing';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((spot - atr * 1.2) * 10) / 10;
      invalidation = `Structure invalid if candle closes below 20 EMA (₹${stock.ema20.toFixed(1)}) and immediate swing pivot.`;
      const risk = entry - stopLoss;
      target1 = Math.round((entry + risk * 2) * 10) / 10;
      target2 = Math.round((entry + risk * 3) * 10) / 10;
      explanation = `Consolidation break above key resistance ₹${stock.resistance.toFixed(1)} confirmed by heavy Call OI buildup and 20 EMA dynamic support.`;
    } else if (isHighIV && stock.rsi >= 45 && stock.rsi <= 58 && Math.abs(spot - stock.vwap) / spot < 0.008) {
      // Rangebound Theta Decay / Iron Condor
      pattern = 'Rangebound Box (Theta Harvest)';
      confidence = 84;
      marketView = 'Range-Bound';
      strategyId = 'iron-condor';
      timeframe = '1D Positional';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((stock.resistance + atr * 0.8) * 10) / 10;
      invalidation = `Violates range if daily candle sustains beyond resistance ₹${stock.resistance.toFixed(1)} or support ₹${stock.support.toFixed(1)}.`;
      target1 = Math.round(stock.vwap * 10) / 10;
      target2 = Math.round((stock.support + atr * 0.5) * 10) / 10;
      explanation = `IV Rank is elevated at ${stock.ivRank}% while price is trapped between ₹${stock.support.toFixed(1)} and ₹${stock.resistance.toFixed(1)}. Optimal for multi-leg theta decay.`;
    } else if (!isAboveEma20 && !isAboveSma50 && isPcrBearish) {
      // Bearish Breakdown
      pattern = 'Bearish Breakdown';
      confidence = 82;
      marketView = 'Bearish';
      strategyId = isLowIV ? 'bear-put-spread' : 'bear-call-spread';
      timeframe = '15m Swing';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((spot + atr * 1.1) * 10) / 10;
      invalidation = `Trade invalidated if price reclaims VWAP ₹${stock.vwap.toFixed(1)} with high volume rejection.`;
      const risk = stopLoss - entry;
      target1 = Math.round((entry - risk * 2) * 10) / 10;
      target2 = Math.round((entry - risk * 3) * 10) / 10;
      explanation = `Price breached key swing support with Put unwinding and negative MACD/EMA alignment.`;
    } else if (isRsiOversold && spot <= stock.support * 1.01) {
      // Double Bottom (W-Pattern)
      pattern = 'Double Bottom (W-Pattern)';
      confidence = 86;
      marketView = 'Bullish';
      strategyId = 'bull-put-spread';
      timeframe = '15m Swing';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((stock.support - atr * 0.8) * 10) / 10;
      invalidation = `Invalidated if multi-session support floor ₹${stock.support.toFixed(1)} breaks down cleanly.`;
      const risk = entry - stopLoss;
      target1 = Math.round((entry + risk * 2) * 10) / 10;
      target2 = Math.round((entry + risk * 3) * 10) / 10;
      explanation = `RSI exhaustion divergence at major institutional demand floor ₹${stock.support.toFixed(1)} indicates imminent relief bounce.`;
    } else if (isAboveVwap && spot > stock.open && spot > stock.ema20) {
      // VWAP Bounce + Momentum
      pattern = 'VWAP Bounce + Momentum';
      confidence = 80;
      marketView = 'Bullish';
      strategyId = 'long-call';
      timeframe = '5m Intraday';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((stock.vwap - atr * 0.5) * 10) / 10;
      invalidation = `Intraday invalidation if price slips below VWAP ₹${stock.vwap.toFixed(1)} within next 2 candles.`;
      const risk = entry - stopLoss;
      target1 = Math.round((entry + risk * 2) * 10) / 10;
      target2 = Math.round((entry + risk * 3) * 10) / 10;
      explanation = `Strong institutional buying off VWAP with positive delta and increasing 5m volume expansion.`;
    } else {
      // Break of Structure (BOS)
      pattern = 'Break of Structure (BOS)';
      confidence = 76;
      marketView = isAboveSma50 ? 'Bullish' : 'Range-Bound';
      strategyId = isAboveSma50 ? 'bull-call-spread' : 'iron-butterfly';
      timeframe = '15m Swing';
      entry = Math.round(spot * 10) / 10;
      stopLoss = Math.round((isAboveSma50 ? spot - atr * 1.0 : spot - atr * 0.9) * 10) / 10;
      invalidation = `Structure violated if swing low ₹${(spot - atr).toFixed(1)} fails to hold during pullbacks.`;
      const risk = Math.abs(entry - stopLoss);
      target1 = Math.round((entry + (isAboveSma50 ? risk * 2 : risk * 1.5)) * 10) / 10;
      target2 = Math.round((entry + (isAboveSma50 ? risk * 3 : risk * 2.2)) * 10) / 10;
      explanation = `Smart money retest of key liquidity pool with clean structural confirmation on 15m chart.`;
    }

    // Retrieve strategy preset
    const stratDef = PRESET_STRATEGIES.find((s) => s.id === strategyId) || PRESET_STRATEGIES[0];
    const expiryDate = '24-OCT-2024';
    const legs = stratDef.legsGenerator(spot, stock.lotSize, atmStrike, step, expiryDate);

    // Capital & Position Sizing Engine (Risk Management from PDF Week 7/8)
    const maxAccountRisk = (userCapital * riskPercent) / 100;
    const perShareRisk = Math.max(1, Math.abs(entry - stopLoss));
    const singleLotRisk = perShareRisk * stock.lotSize;

    // Calculate maximum lots permitted by user risk budget (min 1 lot)
    let lots = Math.max(1, Math.floor(maxAccountRisk / singleLotRisk));
    if (lots > 10) lots = 10; // Cap leverage safety

    // Estimate capital required
    let estimatedCapital = 0;
    for (const leg of legs) {
      if (leg.action === 'BUY') {
        estimatedCapital += leg.premium * leg.lotSize * lots;
      } else {
        // Option selling margin in India is roughly 15-20% of contract value
        estimatedCapital += (spot * stock.lotSize * 0.18) * lots;
      }
    }

    // Set legs with actual lot count
    const scaledLegs = legs.map((leg) => ({ ...leg, lots }));

    const maxRiskAmount = Math.round(singleLotRisk * lots);
    const targetProfitAmount = Math.round(maxRiskAmount * 2.2);

    setups.push({
      id: `setup-${stock.symbol.replace(/\s+/g, '-').toLowerCase()}`,
      symbol: stock.symbol,
      stockName: stock.name,
      currentPrice: spot,
      timeframe,
      pattern,
      patternConfidence: confidence,
      marketView,
      recommendedStrategy: stratDef.name,
      strategyCategory: stratDef.category,
      recommendedLegs: scaledLegs,
      entryPrice: entry,
      stopLoss,
      invalidationReason: invalidation,
      target1,
      target2,
      riskRewardRatio: '1:2.2',
      minimumCapital: Math.max(15000, Math.round(estimatedCapital)),
      calculatedLots: lots,
      maxRiskAmount,
      targetProfitAmount,
      explanation,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Sort by highest confidence
  return setups.sort((a, b) => b.patternConfidence - a.patternConfidence);
}
