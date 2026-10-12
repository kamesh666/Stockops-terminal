import { StrategyDefinition, StrategyLeg } from '../types/market';
import { calculateBlackScholes } from './blackScholes';

export interface PayoffPoint {
  underlyingPrice: number;
  expiryPnL: number;
  currentPnL: number;
}

export interface StrategyPayoffAnalysis {
  points: PayoffPoint[];
  maxProfit: number | 'Unlimited';
  maxLoss: number | 'Unlimited';
  breakevens: number[];
  netPremium: number; // positive = net credit, negative = net debit
  totalDelta: number;
  totalTheta: number;
  totalGamma: number;
  totalVega: number;
  riskRewardRatio: string;
  probabilityOfProfit: number; // %
}

export const PRESET_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread (Debit)',
    category: 'Bullish',
    outlook: 'Moderately Bullish with defined risk & lower theta decay',
    description: 'Buy ATM Call and Sell OTM Call. Protects against time decay while capping upside at the sold strike.',
    maxProfit: 'Difference between strikes - Net debit paid',
    maxLoss: 'Net premium paid (strictly capped)',
    idealIV: 'Low',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'CE',
        action: 'SELL',
        strike: atmStrike + step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'bull-put-spread',
    name: 'Bull Put Spread (Credit)',
    category: 'Bullish',
    outlook: 'Mildly Bullish to Neutral; harvest theta above support',
    description: 'Sell OTM Put and Buy further OTM Put as hedge. Earns credit if price stays above sold strike.',
    maxProfit: 'Net premium received (Credit)',
    maxLoss: 'Strike difference - Credit received',
    idealIV: 'High',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'PE',
        action: 'SELL',
        strike: atmStrike - step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike - 2 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - 2 * step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread (Debit)',
    category: 'Bearish',
    outlook: 'Moderately Bearish; profit from downside breakdown',
    description: 'Buy ATM Put and Sell lower OTM Put. Defined risk breakdown strategy with discounted premium.',
    maxProfit: 'Strike difference - Net debit paid',
    maxLoss: 'Net premium paid (capped)',
    idealIV: 'Low',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'PE',
        action: 'SELL',
        strike: atmStrike - step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'bear-call-spread',
    name: 'Bear Call Spread (Credit)',
    category: 'Bearish',
    outlook: 'Bearish to Neutral; harvest premium below resistance',
    description: 'Sell OTM Call and Buy higher OTM Call for safety. Generates income when stock remains subdued.',
    maxProfit: 'Net credit received',
    maxLoss: 'Strike difference - Credit received',
    idealIV: 'High',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'CE',
        action: 'SELL',
        strike: atmStrike + step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike + 2 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + 2 * step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'iron-condor',
    name: 'Iron Condor (4-Leg Neutral)',
    category: 'Neutral / Rangebound',
    outlook: 'Rangebound market with high IV crush & theta decay',
    description: 'Combines an OTM Bull Put Spread and an OTM Bear Call Spread. Wins if market stays inside range.',
    maxProfit: 'Total credit received from both wings',
    maxLoss: 'Wing width - Net credit received',
    idealIV: 'High',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike - 3 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - 3 * step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'PE',
        action: 'SELL',
        strike: atmStrike - step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-3',
        type: 'CE',
        action: 'SELL',
        strike: atmStrike + step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-4',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike + 3 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + 3 * step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'iron-butterfly',
    name: 'Iron Butterfly',
    category: 'Neutral / Rangebound',
    outlook: 'High conviction pin at ATM strike by expiry date',
    description: 'Sell ATM Straddle (ATM Call + ATM Put) and buy protective OTM Call and OTM Put wings.',
    maxProfit: 'Net credit received (achieved exactly at ATM strike)',
    maxLoss: 'Wing width - Net credit received',
    idealIV: 'High',
    legsGenerator: (spot, lotSize, atmStrike, step, expiry) => [
      {
        id: 'leg-1',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike - 2 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike - 2 * step, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'PE',
        action: 'SELL',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-3',
        type: 'CE',
        action: 'SELL',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-4',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike + 2 * step,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike + 2 * step, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'long-straddle',
    name: 'Long Straddle',
    category: 'High Volatility',
    outlook: 'Explosive directional breakout in either direction',
    description: 'Buy ATM Call and Buy ATM Put simultaneously. Wins if market moves drastically more than premium paid.',
    maxProfit: 'Unlimited in both directions',
    maxLoss: 'Total combined premium paid',
    idealIV: 'Low',
    legsGenerator: (spot, lotSize, atmStrike, _, expiry) => [
      {
        id: 'leg-1',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
      {
        id: 'leg-2',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'long-call',
    name: 'Long Call (Directional Momentum)',
    category: 'Bullish',
    outlook: 'Aggressive bullish momentum breakout above key resistance',
    description: 'Buy single ATM or slightly OTM Call. High leverage, rapid capital growth on fast trending moves.',
    maxProfit: 'Unlimited',
    maxLoss: 'Premium paid (100% of debit)',
    idealIV: 'Low',
    legsGenerator: (spot, lotSize, atmStrike, _, expiry) => [
      {
        id: 'leg-1',
        type: 'CE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'CE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
  {
    id: 'long-put',
    name: 'Long Put (Directional Momentum)',
    category: 'Bearish',
    outlook: 'Aggressive bearish momentum breakdown below key support',
    description: 'Buy single ATM or slightly OTM Put. Capitalizes on sudden panics and sharp downward plunges.',
    maxProfit: 'Strike price * Lot Size - Premium',
    maxLoss: 'Premium paid (100% of debit)',
    idealIV: 'Low',
    legsGenerator: (spot, lotSize, atmStrike, _, expiry) => [
      {
        id: 'leg-1',
        type: 'PE',
        action: 'BUY',
        strike: atmStrike,
        expiry,
        premium: calculateBlackScholes(spot, atmStrike, 5 / 365, 0.07, 0.16, 'PE').price,
        lots: 1,
        lotSize,
      },
    ],
  },
];

/**
 * Calculate multi-leg payoff matrix across underlying prices
 */
export function calculatePayoff(
  legs: StrategyLeg[],
  spotPrice: number,
  daysToExpiry: number = 5,
  iv: number = 16
): StrategyPayoffAnalysis {
  if (legs.length === 0) {
    return {
      points: [],
      maxProfit: 0,
      maxLoss: 0,
      breakevens: [],
      netPremium: 0,
      totalDelta: 0,
      totalTheta: 0,
      totalGamma: 0,
      totalVega: 0,
      riskRewardRatio: '0:0',
      probabilityOfProfit: 50,
    };
  }

  // Range of calculation: -8% to +8% of current spot
  const lowerBound = Math.round(spotPrice * 0.92);
  const upperBound = Math.round(spotPrice * 1.08);
  const step = Math.max(1, Math.round((upperBound - lowerBound) / 60));

  const points: PayoffPoint[] = [];
  let minExpiryPnL = Infinity;
  let maxExpiryPnL = -Infinity;
  let netPremium = 0;
  let totalDelta = 0;
  let totalTheta = 0;
  let totalGamma = 0;
  let totalVega = 0;

  // Calculate Net Cashflow / Premium & Initial Greeks
  for (const leg of legs) {
    const qty = leg.lots * leg.lotSize;
    const legPremiumTotal = leg.premium * qty;
    if (leg.action === 'BUY') {
      netPremium -= legPremiumTotal; // debit
    } else {
      netPremium += legPremiumTotal; // credit
    }

    if (leg.type !== 'EQUITY') {
      const bs = calculateBlackScholes(spotPrice, leg.strike, daysToExpiry / 365, 0.07, iv / 100, leg.type);
      const mult = leg.action === 'BUY' ? 1 : -1;
      totalDelta += bs.delta * mult * qty;
      totalTheta += bs.theta * mult * qty;
      totalGamma += bs.gamma * mult * qty;
      totalVega += bs.vega * mult * qty;
    }
  }

  const t0Years = daysToExpiry / 365;

  for (let p = lowerBound; p <= upperBound; p += step) {
    let pnlAtExpiry = 0;
    let pnlCurrent = 0;

    for (const leg of legs) {
      const qty = leg.lots * leg.lotSize;

      if (leg.type === 'EQUITY') {
        const change = p - spotPrice;
        const pnl = leg.action === 'BUY' ? change * qty : -change * qty;
        pnlAtExpiry += pnl;
        pnlCurrent += pnl;
      } else {
        // Expiry intrinsic value
        let intrinsic = 0;
        if (leg.type === 'CE') {
          intrinsic = Math.max(0, p - leg.strike);
        } else {
          intrinsic = Math.max(0, leg.strike - p);
        }

        const legExpiryValue = intrinsic * qty;
        const legCost = leg.premium * qty;

        if (leg.action === 'BUY') {
          pnlAtExpiry += (legExpiryValue - legCost);
        } else {
          pnlAtExpiry += (legCost - legExpiryValue);
        }

        // T+0 theoretical current price using BS
        const currentOptionPrice = calculateBlackScholes(p, leg.strike, t0Years, 0.07, iv / 100, leg.type).price;
        const currentLegValue = currentOptionPrice * qty;
        if (leg.action === 'BUY') {
          pnlCurrent += (currentLegValue - legCost);
        } else {
          pnlCurrent += (legCost - currentLegValue);
        }
      }
    }

    points.push({
      underlyingPrice: p,
      expiryPnL: Math.round(pnlAtExpiry),
      currentPnL: Math.round(pnlCurrent),
    });

    if (pnlAtExpiry < minExpiryPnL) minExpiryPnL = pnlAtExpiry;
    if (pnlAtExpiry > maxExpiryPnL) maxExpiryPnL = pnlAtExpiry;
  }

  // Find Breakevens (where expiryPnL crosses zero)
  const breakevens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if ((prev.expiryPnL <= 0 && curr.expiryPnL >= 0) || (prev.expiryPnL >= 0 && curr.expiryPnL <= 0)) {
      // Linear interpolation
      const fraction = Math.abs(prev.expiryPnL) / (Math.abs(prev.expiryPnL) + Math.abs(curr.expiryPnL) || 1);
      const crossPrice = Math.round(prev.underlyingPrice + fraction * (curr.underlyingPrice - prev.underlyingPrice));
      if (!breakevens.includes(crossPrice)) {
        breakevens.push(crossPrice);
      }
    }
  }

  // Determine Max Profit & Max Loss
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  let maxProfitResult: number | 'Unlimited' = Math.round(maxExpiryPnL);
  if (lastPoint.expiryPnL > 100000 || firstPoint.expiryPnL > 100000) {
    maxProfitResult = 'Unlimited';
  }

  let maxLossResult: number | 'Unlimited' = Math.abs(Math.round(minExpiryPnL));
  if (minExpiryPnL < -100000) {
    maxLossResult = 'Unlimited';
  }

  // Risk to reward calculation
  let rrStr = '1:2.0';
  if (typeof maxProfitResult === 'number' && typeof maxLossResult === 'number' && maxLossResult > 0) {
    rrStr = `1:${(maxProfitResult / maxLossResult).toFixed(1)}`;
  } else if (maxProfitResult === 'Unlimited') {
    rrStr = '1:∞ (Defined Risk)';
  }

  // Estimate Probability of Profit
  let pop = 50;
  if (breakevens.length === 1) {
    const dist = Math.abs(breakevens[0] - spotPrice) / spotPrice;
    pop = totalDelta > 0 ? (spotPrice < breakevens[0] ? Math.max(25, 50 - dist * 150) : Math.min(85, 50 + dist * 150)) : 50;
  } else if (breakevens.length >= 2) {
    // Range inside breakevens
    const rangeSpan = (breakevens[1] - breakevens[0]) / spotPrice;
    pop = Math.min(85, Math.max(35, Math.round(rangeSpan * 400)));
  }

  return {
    points,
    maxProfit: maxProfitResult,
    maxLoss: maxLossResult,
    breakevens,
    netPremium: Math.round(netPremium),
    totalDelta: Math.round(totalDelta * 10) / 10,
    totalTheta: Math.round(totalTheta),
    totalGamma: Math.round(totalGamma * 1000) / 1000,
    totalVega: Math.round(totalVega),
    riskRewardRatio: rrStr,
    probabilityOfProfit: Math.round(pop),
  };
}
