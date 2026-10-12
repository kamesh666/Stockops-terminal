import React, { useState } from 'react';
import { StockQuote } from '../types/market';

interface CapitalRiskCalculatorProps {
  instruments: StockQuote[];
  initialCapital?: number;
}

export const CapitalRiskCalculator: React.FC<CapitalRiskCalculatorProps> = ({
  instruments,
  initialCapital = 100000,
}) => {
  const [totalCapital, setTotalCapital] = useState<number>(initialCapital);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [entryPrice, setEntryPrice] = useState<number>(25145);
  const [stopLossPrice, setStopLossPrice] = useState<number>(25045);
  const [targetPrice, setTargetPrice] = useState<number>(25345);

  const selectedStock = instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];

  const riskPerShare = Math.max(0.1, Math.abs(entryPrice - stopLossPrice));
  const rewardPerShare = Math.max(0.1, Math.abs(targetPrice - entryPrice));
  const maxRiskAmount = (totalCapital * riskPercent) / 100;

  // Max lots based on risk
  const riskPerLot = riskPerShare * selectedStock.lotSize;
  const recommendedLots = Math.max(1, Math.floor(maxRiskAmount / riskPerLot));
  const totalShares = recommendedLots * selectedStock.lotSize;
  const totalActualRisk = Math.round(recommendedLots * riskPerLot);
  const totalTargetReward = Math.round(recommendedLots * rewardPerShare * selectedStock.lotSize);
  const rrRatio = (rewardPerShare / riskPerShare).toFixed(2);

  // Maximum Daily Loss rule from StockOps PDF (typically 3% of capital)
  const maxDailyLoss = Math.round(totalCapital * 0.03);

  const handleStockChange = (sym: string) => {
    setSelectedSymbol(sym);
    const s = instruments.find((i) => i.symbol === sym);
    if (s) {
      setEntryPrice(s.price);
      setStopLossPrice(Math.round((s.price - (s.atr || s.price * 0.01)) * 10) / 10);
      setTargetPrice(Math.round((s.price + (s.atr || s.price * 0.01) * 2) * 10) / 10);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="pb-4 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Systematic Capital & Position Size Calculator</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Based on StockOps Week 7 Risk Rules: &quot;Risk per trade → Position sizing → Max daily loss → Capital preservation&quot;
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {/* Input Parameters */}
        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Total Account Capital (₹)</label>
            <input
              type="number"
              step="10000"
              value={totalCapital}
              onChange={(e) => setTotalCapital(Number(e.target.value) || 10000)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Risk Tolerance Per Trade ({riskPercent}%)
            </label>
            <div className="flex items-center gap-2">
              {[1, 1.5, 2, 3].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPercent(pct)}
                  className={`flex-1 py-1 rounded border text-xs font-mono transition-colors ${
                    riskPercent === pct
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Instrument</label>
            <select
              value={selectedSymbol}
              onChange={(e) => handleStockChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} (Lot: {i.lotSize})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Trade Price Points */}
        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Entry Price (₹)</label>
            <input
              type="number"
              step="0.5"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Stop Loss / Invalidation (₹)</label>
            <input
              type="number"
              step="0.5"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-rose-300 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Distance: ₹{riskPerShare.toFixed(1)} per share
            </span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Target Price (₹)</label>
            <input
              type="number"
              step="0.5"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-emerald-300 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Reward: ₹{rewardPerShare.toFixed(1)} per share
            </span>
          </div>
        </div>

        {/* Calculated Sizing Outputs */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono tabular-nums">
          <span className="text-[11px] font-sans font-bold text-slate-300 uppercase tracking-wider block">
            Position Sizing Output
          </span>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-sans">Risk Capital Allowed:</span>
            <span className="text-amber-400 font-bold">₹{maxRiskAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-sans">Recommended Size:</span>
            <span className="text-emerald-400 font-bold text-sm">
              {recommendedLots} Lot(s) ({totalShares} shares)
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-sans">Total Actual Risk:</span>
            <span className="text-rose-400 font-bold">₹{totalActualRisk.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-sans">Expected Reward:</span>
            <span className="text-emerald-400 font-bold">₹{totalTargetReward.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800">
            <span className="text-slate-400 font-sans">Risk : Reward Ratio:</span>
            <span className="text-white font-bold text-sm">1 : {rrRatio}</span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800">
            <span className="text-slate-400 font-sans">Max Daily Loss Ceiling:</span>
            <span className="text-rose-400 font-bold">₹{maxDailyLoss.toLocaleString('en-IN')} (3%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
