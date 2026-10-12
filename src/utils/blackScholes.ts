/**
 * Black-Scholes European Option Pricing & Greeks Calculator
 * Normalized for Indian Index & Equity Options (European style).
 */

// Cumulative Normal Distribution approximation
function cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));

  return 0.5 * (1.0 + sign * y);
}

// Standard Normal Probability Density Function
function pdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // 1-day theta decay in ₹
  vega: number;  // 1% IV shift impact in ₹
}

/**
 * Calculate Black-Scholes Option Price and Greeks
 * @param S Current Spot Price
 * @param K Strike Price
 * @param T Time to expiry in years (e.g., 7 days / 365)
 * @param r Risk-free rate (e.g. 0.07 for India 7% RBI rate)
 * @param sigma Implied Volatility (e.g., 0.15 for 15%)
 * @param type 'CE' or 'PE'
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number = 0.07,
  sigma: number = 0.15,
  type: 'CE' | 'PE'
): BSResult {
  if (T <= 0.0001) {
    const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
    return {
      price: intrinsic,
      delta: type === 'CE' ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0),
      gamma: 0,
      theta: 0,
      vega: 0,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = cdf(d1);
  const nd2 = cdf(d2);
  const npd1 = pdf(d1);

  let price = 0;
  let delta = 0;
  let theta = 0;

  if (type === 'CE') {
    price = S * nd1 - K * Math.exp(-r * T) * nd2;
    delta = nd1;
    // Daily theta
    theta = -( (S * npd1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * nd2 ) / 365;
  } else {
    const n_minus_d1 = cdf(-d1);
    const n_minus_d2 = cdf(-d2);
    price = K * Math.exp(-r * T) * n_minus_d2 - S * n_minus_d1;
    delta = nd1 - 1;
    // Daily theta
    theta = -( (S * npd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * n_minus_d2 ) / 365;
  }

  const gamma = npd1 / (S * sigma * sqrtT);
  // Vega per 1 percentage point change in volatility
  const vega = (S * sqrtT * npd1) / 100;

  return {
    price: Math.max(0.05, Math.round(price * 100) / 100),
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}
