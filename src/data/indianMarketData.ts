import { StockQuote, Candle, OptionChainRow, OptionContract } from '../types/market';
import { calculateBlackScholes } from '../utils/blackScholes';

export const INDIAN_INSTRUMENTS: StockQuote[] = [
  {
    symbol: 'NIFTY 50',
    name: 'NIFTY 50 Index',
    segment: 'INDICES',
    exchange: 'NSE',
    price: 25145.20,
    change: 142.80,
    changePercent: 0.57,
    open: 25030.00,
    high: 25180.40,
    low: 24995.10,
    previousClose: 25002.40,
    volume: 182400000,
    lotSize: 25,
    iv: 13.8,
    ivRank: 38,
    pcr: 1.15,
    vwap: 25110.50,
    ema20: 24980.20,
    sma50: 24820.00,
    sma200: 24200.00,
    rsi: 61.4,
    atr: 165.0,
    support: 24950.00,
    resistance: 25250.00,
  },
  {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    segment: 'INDICES',
    exchange: 'NSE',
    price: 54320.75,
    change: 385.50,
    changePercent: 0.71,
    open: 54010.00,
    high: 54450.00,
    low: 53960.20,
    previousClose: 53935.25,
    volume: 94500000,
    lotSize: 15,
    iv: 16.2,
    ivRank: 44,
    pcr: 1.28,
    vwap: 54240.00,
    ema20: 53890.00,
    sma50: 53400.00,
    sma200: 51800.00,
    rsi: 65.2,
    atr: 410.0,
    support: 53800.00,
    resistance: 54600.00,
  },
  {
    symbol: 'FINNIFTY',
    name: 'Nifty Financial Services',
    segment: 'INDICES',
    exchange: 'NSE',
    price: 24390.40,
    change: 110.20,
    changePercent: 0.45,
    open: 24300.00,
    high: 24425.00,
    low: 24260.00,
    previousClose: 24280.20,
    volume: 48000000,
    lotSize: 25,
    iv: 14.5,
    ivRank: 40,
    pcr: 1.08,
    vwap: 24360.00,
    ema20: 24220.00,
    sma50: 23980.00,
    sma200: 23400.00,
    rsi: 58.7,
    atr: 180.0,
    support: 24200.00,
    resistance: 24500.00,
  },
  {
    symbol: 'SENSEX',
    name: 'BSE Sensex Index',
    segment: 'INDICES',
    exchange: 'BSE',
    price: 82410.60,
    change: 460.10,
    changePercent: 0.56,
    open: 82020.00,
    high: 82510.00,
    low: 81950.00,
    previousClose: 81950.50,
    volume: 62000000,
    lotSize: 10,
    iv: 13.5,
    ivRank: 35,
    pcr: 1.12,
    vwap: 82320.00,
    ema20: 81900.00,
    sma50: 81200.00,
    sma200: 79500.00,
    rsi: 62.0,
    atr: 540.0,
    support: 81800.00,
    resistance: 82800.00,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    segment: 'FNO_HEAVYWEIGHTS',
    exchange: 'NSE',
    price: 2985.40,
    change: 32.60,
    changePercent: 1.10,
    open: 2960.00,
    high: 2998.00,
    low: 2952.10,
    previousClose: 2952.80,
    volume: 8420000,
    lotSize: 250,
    iv: 19.4,
    ivRank: 52,
    pcr: 1.34,
    vwap: 2980.10,
    ema20: 2940.00,
    sma50: 2910.00,
    sma200: 2840.00,
    rsi: 67.5,
    atr: 38.0,
    support: 2940.00,
    resistance: 3020.00,
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    segment: 'FNO_HEAVYWEIGHTS',
    exchange: 'NSE',
    price: 1682.30,
    change: -8.40,
    changePercent: -0.50,
    open: 1695.00,
    high: 1702.00,
    low: 1675.20,
    previousClose: 1690.70,
    volume: 12500000,
    lotSize: 550,
    iv: 17.1,
    ivRank: 42,
    pcr: 0.88,
    vwap: 1686.00,
    ema20: 1678.00,
    sma50: 1660.00,
    sma200: 1610.00,
    rsi: 51.3,
    atr: 22.0,
    support: 1660.00,
    resistance: 1715.00,
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    segment: 'FNO_HEAVYWEIGHTS',
    exchange: 'NSE',
    price: 4245.80,
    change: 48.20,
    changePercent: 1.15,
    open: 4205.00,
    high: 4260.00,
    low: 4195.00,
    previousClose: 4197.60,
    volume: 2150000,
    lotSize: 175,
    iv: 18.0,
    ivRank: 48,
    pcr: 1.22,
    vwap: 4238.00,
    ema20: 4180.00,
    sma50: 4120.00,
    sma200: 3980.00,
    rsi: 64.8,
    atr: 55.0,
    support: 4160.00,
    resistance: 4280.00,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 1914.50,
    change: 22.10,
    changePercent: 1.17,
    open: 1898.00,
    high: 1922.00,
    low: 1892.00,
    previousClose: 1892.40,
    volume: 6400000,
    lotSize: 400,
    iv: 21.2,
    ivRank: 59,
    pcr: 1.18,
    vwap: 1910.00,
    ema20: 1880.00,
    sma50: 1840.00,
    sma200: 1690.00,
    rsi: 63.5,
    atr: 28.0,
    support: 1880.00,
    resistance: 1940.00,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    segment: 'FNO_HEAVYWEIGHTS',
    exchange: 'NSE',
    price: 1284.10,
    change: 14.30,
    changePercent: 1.13,
    open: 1272.00,
    high: 1290.00,
    low: 1269.00,
    previousClose: 1269.80,
    volume: 8900000,
    lotSize: 700,
    iv: 16.8,
    ivRank: 39,
    pcr: 1.31,
    vwap: 1281.00,
    ema20: 1265.00,
    sma50: 1240.00,
    sma200: 1180.00,
    rsi: 66.1,
    atr: 18.0,
    support: 1260.00,
    resistance: 1300.00,
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 986.70,
    change: -12.40,
    changePercent: -1.24,
    open: 1002.00,
    high: 1005.00,
    low: 982.50,
    previousClose: 999.10,
    volume: 11200000,
    lotSize: 550,
    iv: 24.5,
    ivRank: 68,
    pcr: 0.74,
    vwap: 991.00,
    ema20: 995.00,
    sma50: 1010.00,
    sma200: 960.00,
    rsi: 44.2,
    atr: 21.0,
    support: 975.00,
    resistance: 1015.00,
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 836.40,
    change: 7.20,
    changePercent: 0.87,
    open: 830.00,
    high: 841.00,
    low: 828.50,
    previousClose: 829.20,
    volume: 14200000,
    lotSize: 750,
    iv: 19.8,
    ivRank: 45,
    pcr: 1.10,
    vwap: 834.50,
    ema20: 828.00,
    sma50: 818.00,
    sma200: 785.00,
    rsi: 59.3,
    atr: 14.5,
    support: 825.00,
    resistance: 845.00,
  },
  {
    symbol: 'ITC',
    name: 'ITC Limited',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 504.60,
    change: 1.80,
    changePercent: 0.36,
    open: 503.00,
    high: 506.50,
    low: 501.80,
    previousClose: 502.80,
    volume: 7800000,
    lotSize: 1600,
    iv: 14.2,
    ivRank: 28,
    pcr: 1.05,
    vwap: 504.10,
    ema20: 502.00,
    sma50: 498.00,
    sma200: 460.00,
    rsi: 54.0,
    atr: 6.2,
    support: 498.00,
    resistance: 512.00,
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 1654.20,
    change: 28.50,
    changePercent: 1.75,
    open: 1630.00,
    high: 1662.00,
    low: 1628.00,
    previousClose: 1625.70,
    volume: 5300000,
    lotSize: 475,
    iv: 20.1,
    ivRank: 55,
    pcr: 1.45,
    vwap: 1648.00,
    ema20: 1618.00,
    sma50: 1570.00,
    sma200: 1420.00,
    rsi: 69.8,
    atr: 26.0,
    support: 1620.00,
    resistance: 1680.00,
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd',
    segment: 'LARGE_CAP',
    exchange: 'NSE',
    price: 3780.00,
    change: -18.00,
    changePercent: -0.47,
    open: 3805.00,
    high: 3815.00,
    low: 3765.00,
    previousClose: 3798.00,
    volume: 1650000,
    lotSize: 150,
    iv: 18.5,
    ivRank: 41,
    pcr: 0.94,
    vwap: 3788.00,
    ema20: 3770.00,
    sma50: 3720.00,
    sma200: 3580.00,
    rsi: 52.4,
    atr: 48.0,
    support: 3730.00,
    resistance: 3840.00,
  }
];

// Helper to determine standard strike step size for Indian instruments
export function getStrikeStep(symbol: string, price: number): number {
  if (symbol === 'NIFTY 50') return 50;
  if (symbol === 'BANKNIFTY') return 100;
  if (symbol === 'FINNIFTY') return 50;
  if (symbol === 'SENSEX') return 100;
  if (price > 4000) return 50;
  if (price > 2000) return 20;
  if (price > 1000) return 10;
  if (price > 500) return 5;
  return 2.5;
}

// Generate realistic candles for the chosen instrument and timeframe
export function generateCandles(instrument: StockQuote, timeframe: string, count = 40): Candle[] {
  const candles: Candle[] = [];
  const basePrice = instrument.price;
  const volatility = (instrument.atr || basePrice * 0.015) / Math.sqrt(timeframe === '5m' ? 75 : timeframe === '15m' ? 25 : 1);
  
  let currentClose = basePrice - (instrument.change || 0) * 0.9;
  const now = Date.now();
  const stepMs = timeframe === '5m' ? 5 * 60 * 1000 : timeframe === '15m' ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * stepMs;
    const date = new Date(timestamp);
    const timeStr = timeframe === '1D' 
      ? date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Last candle is close to current price
    if (i === 0) {
      currentClose = instrument.price;
    } else {
      const drift = (Math.random() - 0.48) * volatility * 0.6;
      currentClose = Math.max(10, currentClose + drift);
    }

    const candleRange = volatility * (0.6 + Math.random() * 0.8);
    const open = Math.round((currentClose + (Math.random() - 0.5) * candleRange * 0.5) * 100) / 100;
    const high = Math.round((Math.max(open, currentClose) + Math.random() * candleRange * 0.4) * 100) / 100;
    const low = Math.round((Math.min(open, currentClose) - Math.random() * candleRange * 0.4) * 100) / 100;
    const close = Math.round(currentClose * 100) / 100;
    const volume = Math.floor((instrument.volume / (count * 2)) * (0.6 + Math.random() * 0.8));

    candles.push({
      time: timeStr,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      vwap: Math.round(((high + low + close) / 3) * 100) / 100,
    });
  }

  // Calculate EMA20 & SMA50 overlay
  let ema = candles[0].close;
  const k = 2 / (20 + 1);
  for (let i = 0; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    candles[i].ema20 = Math.round(ema * 100) / 100;

    if (i >= 9) {
      const slice = candles.slice(Math.max(0, i - 14), i + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      candles[i].sma50 = Math.round((sum / slice.length) * 100) / 100;
    }
  }

  return candles;
}

// Generate realistic Option Chain for instrument
export function generateOptionChain(instrument: StockQuote, expiryDate = '24-OCT-2024'): OptionChainRow[] {
  const spot = instrument.price;
  const step = getStrikeStep(instrument.symbol, spot);
  const atmStrike = Math.round(spot / step) * step;

  const rows: OptionChainRow[] = [];
  const strikeRange = 8; // 8 strikes above & 8 strikes below ATM = 17 strikes
  const timeToExpiryYears = 5 / 365; // ~5 days to weekly expiry
  const sigma = instrument.iv / 100;

  for (let i = -strikeRange; i <= strikeRange; i++) {
    const strike = atmStrike + i * step;
    const isAtm = strike === atmStrike;

    // Black-Scholes call & put calculation
    const bsCall = calculateBlackScholes(spot, strike, timeToExpiryYears, 0.07, sigma, 'CE');
    const bsPut = calculateBlackScholes(spot, strike, timeToExpiryYears, 0.07, sigma, 'PE');

    // OI and Volume distribution - higher OI near ATM/OTM round numbers
    const distFromAtm = Math.abs(i);
    const oiBase = Math.floor((120000 - distFromAtm * 9000) * (0.8 + Math.random() * 0.4));
    const callOI = Math.max(1500, Math.floor(oiBase * (1 / (instrument.pcr || 1))));
    const putOI = Math.max(1500, Math.floor(oiBase * (instrument.pcr || 1)));

    const callContract: OptionContract = {
      strike,
      type: 'CE',
      expiry: expiryDate,
      ltp: bsCall.price,
      change: Math.round(((Math.random() - 0.45) * bsCall.price * 0.12) * 100) / 100,
      changePercent: Math.round(((Math.random() - 0.45) * 15) * 10) / 10,
      bid: Math.max(0.05, Math.round((bsCall.price - 0.4) * 100) / 100),
      ask: Math.round((bsCall.price + 0.4) * 100) / 100,
      volume: Math.floor(callOI * (0.4 + Math.random() * 0.6)),
      openInterest: callOI,
      changeInOI: Math.floor((Math.random() - 0.35) * 8500),
      iv: Math.round((instrument.iv + (i * 0.2)) * 10) / 10,
      delta: bsCall.delta,
      gamma: bsCall.gamma,
      theta: bsCall.theta,
      vega: bsCall.vega,
    };

    const putContract: OptionContract = {
      strike,
      type: 'PE',
      expiry: expiryDate,
      ltp: bsPut.price,
      change: Math.round(((Math.random() - 0.55) * bsPut.price * 0.12) * 100) / 100,
      changePercent: Math.round(((Math.random() - 0.55) * 15) * 10) / 10,
      bid: Math.max(0.05, Math.round((bsPut.price - 0.4) * 100) / 100),
      ask: Math.round((bsPut.price + 0.4) * 100) / 100,
      volume: Math.floor(putOI * (0.4 + Math.random() * 0.6)),
      openInterest: putOI,
      changeInOI: Math.floor((Math.random() - 0.35) * 8500),
      iv: Math.round((instrument.iv - (i * 0.15)) * 10) / 10,
      delta: bsPut.delta,
      gamma: bsPut.gamma,
      theta: bsPut.theta,
      vega: bsPut.vega,
    };

    rows.push({
      strike,
      call: callContract,
      put: putContract,
      isAtm,
    });
  }

  return rows;
}
