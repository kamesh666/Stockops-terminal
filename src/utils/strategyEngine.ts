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

// ---------------------------------------------------------------------------
// Remaining strategies from the NSE "Options Trading Strategies" module (22 total)
// so every recommendation from the Python engine can be opened as a payoff.
// ---------------------------------------------------------------------------
const mkLeg = (
  id: string,
  type: 'CE' | 'PE' | 'EQUITY',
  action: 'BUY' | 'SELL',
  strike: number,
  spot: number,
  lotSize: number,
  expiry: string,
  lots = 1,
): StrategyLeg => ({
  id,
  type,
  action,
  strike,
  expiry,
  premium: type === 'EQUITY' ? 0 : calculateBlackScholes(spot, strike, 5 / 365, 0.07, 0.16, type).price,
  lots,
  lotSize,
});

PRESET_STRATEGIES.push(
  {
    id: 'short-put', name: 'Short Put', category: 'Bullish',
    outlook: 'Neutral to bullish; collect premium', description: 'Sell an OTM put. Varsity cautions against naked put writing.',
    maxProfit: 'Premium received', maxLoss: 'Strike - premium (large)', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'PE', 'SELL', atm - st, spot, lot, exp)],
  },
  {
    id: 'short-call', name: 'Short Call', category: 'Bearish',
    outlook: 'Neutral to bearish; collect premium', description: 'Sell an OTM call. Unlimited upside risk.',
    maxProfit: 'Premium received', maxLoss: 'Unlimited', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'CE', 'SELL', atm + st, spot, lot, exp)],
  },
  {
    id: 'synthetic-long-call', name: 'Synthetic Long Call', category: 'Bullish',
    outlook: 'Bullish but want downside insurance', description: 'Long stock plus a long ATM put: call-like payoff.',
    maxProfit: 'Unlimited', maxLoss: 'Put premium + (spot - strike)', idealIV: 'Low',
    legsGenerator: (spot, lot, atm, _st, exp) => [mkLeg('leg-1', 'EQUITY', 'BUY', spot, spot, lot, exp), mkLeg('leg-2', 'PE', 'BUY', atm, spot, lot, exp)],
  },
  {
    id: 'protective-put', name: 'Protective Put', category: 'Bullish',
    outlook: 'Own the stock, insure against a fall', description: 'Long stock plus a slightly OTM put.',
    maxProfit: 'Unlimited', maxLoss: 'Spot - strike + premium', idealIV: 'Low',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'EQUITY', 'BUY', spot, spot, lot, exp), mkLeg('leg-2', 'PE', 'BUY', atm - st, spot, lot, exp)],
  },
  {
    id: 'covered-call', name: 'Covered Call', category: 'Low Volatility / Income',
    outlook: 'Mildly bullish; earn income on holdings', description: 'Long stock plus a short OTM call.',
    maxProfit: '(Strike - spot) + premium', maxLoss: 'Stock downside less premium', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'EQUITY', 'BUY', spot, spot, lot, exp), mkLeg('leg-2', 'CE', 'SELL', atm + st, spot, lot, exp)],
  },
  {
    id: 'collar', name: 'Collar', category: 'Low Volatility / Income',
    outlook: 'Protect holdings cheaply', description: 'Long stock, long OTM put, short OTM call. Risk and reward both capped.',
    maxProfit: 'Call strike - spot + net premium', maxLoss: 'Spot - put strike - net premium', idealIV: 'Any',
    legsGenerator: (spot, lot, atm, st, exp) => [
      mkLeg('leg-1', 'EQUITY', 'BUY', spot, spot, lot, exp), mkLeg('leg-2', 'PE', 'BUY', atm - st, spot, lot, exp), mkLeg('leg-3', 'CE', 'SELL', atm + 2 * st, spot, lot, exp),
    ],
  },
  {
    id: 'covered-put', name: 'Covered Put', category: 'Bearish',
    outlook: 'Mildly bearish on a shorted stock', description: 'Short stock plus a short OTM put.',
    maxProfit: '(Spot - strike) + premium', maxLoss: 'Unlimited', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'EQUITY', 'SELL', spot, spot, lot, exp), mkLeg('leg-2', 'PE', 'SELL', atm - st, spot, lot, exp)],
  },
  {
    id: 'protective-call', name: 'Protective Call', category: 'Bearish',
    outlook: 'Short the stock, insure against a rally', description: 'Short stock plus a long ATM call.',
    maxProfit: 'Spot - premium', maxLoss: 'Strike - spot + premium', idealIV: 'Low',
    legsGenerator: (spot, lot, atm, _st, exp) => [mkLeg('leg-1', 'EQUITY', 'SELL', spot, spot, lot, exp), mkLeg('leg-2', 'CE', 'BUY', atm, spot, lot, exp)],
  },
  {
    id: 'long-combo', name: 'Long Combo', category: 'Bullish',
    outlook: 'Bullish, low-cost entry', description: 'Sell an OTM put, buy an OTM call. Futures-like payoff between the strikes.',
    maxProfit: 'Unlimited', maxLoss: 'Large (put strike - net premium)', idealIV: 'Any',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'PE', 'SELL', atm - st, spot, lot, exp), mkLeg('leg-2', 'CE', 'BUY', atm + st, spot, lot, exp)],
  },
  {
    id: 'long-strangle', name: 'Long Strangle', category: 'High Volatility',
    outlook: 'Big move expected, direction unknown', description: 'Buy an OTM call and an OTM put. Cheaper than a straddle; needs a bigger move.',
    maxProfit: 'Unlimited', maxLoss: 'Net premium paid', idealIV: 'Low',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'CE', 'BUY', atm + 2 * st, spot, lot, exp), mkLeg('leg-2', 'PE', 'BUY', atm - 2 * st, spot, lot, exp)],
  },
  {
    id: 'short-straddle', name: 'Short Straddle', category: 'Neutral / Rangebound',
    outlook: 'Price pinned near ATM, IV falling', description: 'Sell the ATM call and ATM put. Maximum theta, unlimited risk.',
    maxProfit: 'Net premium received', maxLoss: 'Unlimited', idealIV: 'High',
    legsGenerator: (spot, lot, atm, _st, exp) => [mkLeg('leg-1', 'CE', 'SELL', atm, spot, lot, exp), mkLeg('leg-2', 'PE', 'SELL', atm, spot, lot, exp)],
  },
  {
    id: 'short-strangle', name: 'Short Strangle', category: 'Neutral / Rangebound',
    outlook: 'Rangebound inside the 1-SD band', description: 'Sell an OTM call and an OTM put (Varsity: strikes outside 1 SD).',
    maxProfit: 'Net premium received', maxLoss: 'Unlimited', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [mkLeg('leg-1', 'CE', 'SELL', atm + 3 * st, spot, lot, exp), mkLeg('leg-2', 'PE', 'SELL', atm - 3 * st, spot, lot, exp)],
  },
  {
    id: 'long-call-butterfly', name: 'Long Call Butterfly', category: 'Neutral / Rangebound',
    outlook: 'Expiry close to ATM', description: 'Buy ITM call, sell 2 ATM calls, buy OTM call. Cheap, defined risk.',
    maxProfit: 'Wing width - net debit', maxLoss: 'Net debit', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [
      mkLeg('leg-1', 'CE', 'BUY', atm - 2 * st, spot, lot, exp), mkLeg('leg-2', 'CE', 'SELL', atm, spot, lot, exp, 2), mkLeg('leg-3', 'CE', 'BUY', atm + 2 * st, spot, lot, exp),
    ],
  },
  {
    id: 'short-call-butterfly', name: 'Short Call Butterfly', category: 'High Volatility',
    outlook: 'Breakout either way', description: 'Sell ITM call, buy 2 ATM calls, sell OTM call. Profits from a move away from ATM.',
    maxProfit: 'Net credit', maxLoss: 'Wing width - net credit', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [
      mkLeg('leg-1', 'CE', 'SELL', atm - 2 * st, spot, lot, exp), mkLeg('leg-2', 'CE', 'BUY', atm, spot, lot, exp, 2), mkLeg('leg-3', 'CE', 'SELL', atm + 2 * st, spot, lot, exp),
    ],
  },
  {
    id: 'long-call-condor', name: 'Long Call Condor', category: 'Neutral / Rangebound',
    outlook: 'Expiry inside a band', description: 'Buy ITM call, sell two middle calls, buy far OTM call. Wider sweet spot than a butterfly.',
    maxProfit: 'Middle width - net debit', maxLoss: 'Net debit', idealIV: 'High',
    legsGenerator: (spot, lot, atm, st, exp) => [
      mkLeg('leg-1', 'CE', 'BUY', atm - 2 * st, spot, lot, exp), mkLeg('leg-2', 'CE', 'SELL', atm - st, spot, lot, exp),
      mkLeg('leg-3', 'CE', 'SELL', atm + st, spot, lot, exp), mkLeg('leg-4', 'CE', 'BUY', atm + 2 * st, spot, lot, exp),
    ],
  },
  {
    id: 'short-call-condor', name: 'Short Call Condor', category: 'High Volatility',
    outlook: 'Move out of a band, either way', description: 'Sell ITM call, buy two middle calls, sell far OTM call.',
    maxProfit: 'Net credit', maxLoss: 'Middle width - net credit', idealIV: 'Low',
    legsGenerator: (spot, lot, atm, st, exp) => [
      mkLeg('leg-1', 'CE', 'SELL', atm - 2 * st, spot, lot, exp), mkLeg('leg-2', 'CE', 'BUY', atm - st, spot, lot, exp),
      mkLeg('leg-3', 'CE', 'BUY', atm + st, spot, lot, exp), mkLeg('leg-4', 'CE', 'SELL', atm + 2 * st, spot, lot, exp),
    ],
  },
);

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
