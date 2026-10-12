import React, { useState } from 'react';
import { AutomatedSetup, StockQuote } from '../types/market';

interface AutomatedScreenerProps {
  setups: AutomatedSetup[];
  instruments: StockQuote[];
  userCapital: number;
  riskPercent: number;
  onCapitalChange: (val: number) => void;
  onRiskChange: (val: number) => void;
  onSelectSetup: (setup: AutomatedSetup) => void;
  onOpenPayoff: (setup: AutomatedSetup) => void;
  onExecutePaperTrade: (setup: AutomatedSetup) => void;
  onBacktestSetup?: (setup: AutomatedSetup) => void;
}

export const AutomatedScreener: React.FC<AutomatedScreenerProps> = ({
  setups,
  userCapital,
  riskPercent,
  onCapitalChange,
  onRiskChange,
  onSelectSetup,
  onOpenPayoff,
  onExecutePaperTrade,
  onBacktestSetup,
}) => {
  const [filterView, setFilterView] = useState<string>('ALL');
  const [filterTimeframe, setFilterTimeframe] = useState<string>('ALL');

  const filteredSetups = setups.filter((s) => {
    if (filterView !== 'ALL' && s.marketView !== filterView) return false;
    if (filterTimeframe !== 'ALL' && !s.timeframe.includes(filterTimeframe)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Configuration & Philosophy Banner (from StockOps PDF) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              StockOps Automated Engine · 90-Day Systematic Framework
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Real-Time Stock & Options Strategy Scanner
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Scans Indian NSE/BSE securities, detects price action patterns, aligns market volatility with multi-leg options strategies, and calculates strict capital sizing, entry, stop loss, and invalidation criteria.
            </p>
          </div>

          {/* Capital & Risk Management Settings */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                TRADING CAPITAL (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="10000"
                  min="20000"
                  max="5000000"
                  value={userCapital}
                  onChange={(e) => onCapitalChange(Number(e.target.value) || 50000)}
                  className="w-32 bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1">
                  {[50000, 100000, 250000, 500000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => onCapitalChange(amt)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        userCapital === amt
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ₹{(amt / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-l border-slate-800 pl-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                RISK PER TRADE (%)
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 1.5, 2, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => onRiskChange(r)}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border transition-colors ${
                      riskPercent === r
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}% (₹{((userCapital * r) / 100).toLocaleString('en-IN')})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Market Bias:</span>
            {['ALL', 'Bullish', 'Bearish', 'Range-Bound'].map((bias) => (
              <button
                key={bias}
                onClick={() => setFilterView(bias)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  filterView === bias
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {bias}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Timeframe:</span>
            {['ALL', '5m', '15m', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setFilterTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterTimeframe === tf
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
            <span className="text-slate-500 ml-2">({filteredSetups.length} setups found)</span>
          </div>
        </div>
      </div>

      {/* Setups List / Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSetups.map((setup) => {
          const isBullish = setup.marketView === 'Bullish';
          const isBearish = setup.marketView === 'Bearish';
          const isRange = setup.marketView === 'Range-Bound';

          return (
            <div
              key={setup.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between"
            >
              <div>
                {/* Header: Instrument & Strategy */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {setup.symbol}
                      </h3>
                      <span className="text-xs text-slate-400">{setup.stockName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span>Spot: <strong className="font-mono text-white">₹{setup.currentPrice.toFixed(2)}</strong></span>
                      <span>·</span>
                      <span className="text-slate-300 font-medium">{setup.timeframe}</span>
                    </div>
                  </div>

                  {/* Market View & Strategy Badge */}
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold ${
                        isBullish
                          ? 'text-emerald-400'
                          : isBearish
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {setup.marketView.toUpperCase()} ({setup.patternConfidence}% Conf.)
                    </div>
                    <div className="text-xs text-slate-300 font-semibold mt-0.5">
                      {setup.recommendedStrategy}
                    </div>
                  </div>
                </div>

                {/* Pattern & Technical Rationale */}
                <div className="my-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">Setup Pattern:</span>
                    <span className="text-emerald-300 font-semibold">{setup.pattern}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                    {setup.explanation}
                  </p>
                </div>

                {/* Execution Playbook Matrix (Setup -> Entry -> Stop -> Target -> Position Size -> Exit) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono tabular-nums">
                  <div>
                    <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                      ENTRY
                    </span>
                    <span className="text-cyan-400 font-bold">₹{setup.entryPrice.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                      STOP LOSS
                    </span>
                    <span className="text-rose-400 font-bold">₹{setup.stopLoss.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                      TARGET 1 (1:2)
                    </span>
                    <span className="text-emerald-400 font-bold">₹{setup.target1.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                      TARGET 2 (1:3)
                    </span>
                    <span className="text-emerald-400 font-bold">₹{setup.target2.toFixed(1)}</span>
                  </div>
                </div>

                {/* Invalidation Reason (from PDF Week 12: "Where is your trade invalidated?") */}
                <div className="mt-2.5 text-[11px] text-slate-400">
                  <span className="font-semibold text-rose-300">Invalidation Rule:</span>{' '}
                  <span className="text-slate-300">{setup.invalidationReason}</span>
                </div>

                {/* Capital & Position Sizing Summary */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] font-sans text-slate-500 block">CAPITAL REQ</span>
                      <span className="text-white font-bold">₹{setup.minimumCapital.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-500 block">MAX RISK</span>
                      <span className="text-rose-400 font-bold">₹{setup.maxRiskAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-500 block">SIZED LOTS</span>
                      <span className="text-amber-300 font-bold">{setup.calculatedLots} Lot(s)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-sans text-slate-500 block">TARGET GAIN</span>
                    <span className="text-emerald-400 font-bold">+₹{setup.targetProfitAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectSetup(setup)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>Chart View</span>
                </button>

                <div className="flex items-center gap-2">
                  {onBacktestSetup && (
                    <button
                      onClick={() => onBacktestSetup(setup)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
                      title="Backtest this setup against historical volatility"
                    >
                      Backtest 30D
                    </button>
                  )}

                  <button
                    onClick={() => onOpenPayoff(setup)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors"
                  >
                    Payoff Graph
                  </button>

                  <button
                    onClick={() => onExecutePaperTrade(setup)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
                  >
                    Simulate Trade
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
