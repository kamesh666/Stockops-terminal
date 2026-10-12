import React, { useState, useMemo } from 'react';
import { StockQuote, AlgoSignal } from '../types/market';
import { generateAlgoSignals } from '../utils/algoEngine';

interface AlgoSignalsTabProps {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  userCapital: number;
  onSelectSignalForChart: (signal: AlgoSignal) => void;
  onExecuteAlgoTrade: (signal: AlgoSignal) => void;
  onBacktestSignal: (signal: AlgoSignal) => void;
}

export const AlgoSignalsTab: React.FC<AlgoSignalsTabProps> = ({
  instruments,
  selectedSymbol,
  onSelectSymbol,
  userCapital,
  onSelectSignalForChart,
  onExecuteAlgoTrade,
  onBacktestSignal,
}) => {
  const [filterMode, setFilterMode] = useState<'SELECTED_ONLY' | 'ALL_STOCKS'>('ALL_STOCKS');
  const [minThreshold, setMinThreshold] = useState<number>(80);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ALL');

  // Compute algorithmic signals
  const allSignals = useMemo(() => {
    return generateAlgoSignals(instruments, userCapital, 70);
  }, [instruments, userCapital]);

  // Filtered signals based on user selection
  const filteredSignals = useMemo(() => {
    return allSignals.filter((sig) => {
      if (filterMode === 'SELECTED_ONLY' && sig.symbol !== selectedSymbol) return false;
      if (sig.algoConfidenceScore < minThreshold) return false;
      if (selectedTimeframe !== 'ALL' && !sig.timeframe.includes(selectedTimeframe)) return false;
      return true;
    });
  }, [allSignals, filterMode, selectedSymbol, minThreshold, selectedTimeframe]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              Institutional Algo Radar · High Probability Engine
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              80%+ Strong Technique Stock &amp; Options Algo Scanner
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Evaluates all quantitative patterns, moving average alignments, institutional VWAP flow, option Greeks, and PCR. Displays fully specified algo orders with entry, stop loss, targets, and sizing.
            </p>
          </div>

          {/* Quick Filter Configuration */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Instrument Selection Mode */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setFilterMode('ALL_STOCKS')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  filterMode === 'ALL_STOCKS'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Scan All NSE (80%+)
              </button>
              <button
                onClick={() => setFilterMode('SELECTED_ONLY')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  filterMode === 'SELECTED_ONLY'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Focus {selectedSymbol}
              </button>
            </div>

            {/* Pick Specific Instrument */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedSymbol}
                onChange={(e) => onSelectSymbol(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol} (₹{i.price.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Algo Filters Strip */}
        <div className="mt-4 pt-1 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Technique Strength:</span>
            {[80, 85, 90].map((th) => (
              <button
                key={th}
                onClick={() => setMinThreshold(th)}
                className={`px-3 py-1 rounded-md font-mono font-semibold transition-colors border ${
                  minThreshold === th
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                &ge;{th}% Score {th === 80 ? '(Strong)' : '(Elite Conviction)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Timeframe:</span>
            {['ALL', '5m', '15m', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
            <span className="text-slate-500 ml-1">({filteredSignals.length} Active Algo Signals)</span>
          </div>
        </div>
      </div>

      {/* Algo Signal Cards Grid */}
      {filteredSignals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
          No signals currently meeting the &ge;{minThreshold}% algorithmic threshold. Lower the threshold to 80% or switch to &quot;Scan All NSE&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredSignals.map((signal) => {
            const isCall = signal.contractCallOrPut === 'CE';
            const isHighGrade = signal.algoConfidenceScore >= 85;

            return (
              <div
                key={signal.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Action & Score */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white tracking-tight">
                          {signal.actionLabel}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                          {signal.timeframe}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>Underlying Spot: <strong className="text-white font-mono">₹{signal.underlyingSpot.toFixed(1)}</strong></span>
                        <span>·</span>
                        <span>Expiry: <strong className="text-slate-300">{signal.expiryDate}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-black font-mono px-2.5 py-1 rounded border inline-block ${
                          isHighGrade
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {signal.algoConfidenceScore}% ALGO SCORE
                      </div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">
                        Strong Technique Validated
                      </span>
                    </div>
                  </div>

                  {/* Pattern & Institutional Trigger */}
                  <div className="my-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-medium">Technique:</span>
                      <span className="text-emerald-400 font-semibold">{signal.patternName}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/70 p-2.5 rounded border border-slate-800/70 font-mono text-[11px]">
                      {signal.executionTrigger}
                    </p>
                  </div>

                  {/* Algo Execution Pricing Grid (Entry, Stop Loss, Targets) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono tabular-nums">
                    <div>
                      <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                        ENTRY PRICE
                      </span>
                      <span className="text-cyan-400 font-bold text-sm">₹{signal.entryPrice.toFixed(1)}</span>
                      <span className="block text-[9px] text-slate-500 font-sans">Premium</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                        STOP LOSS
                      </span>
                      <span className="text-rose-400 font-bold text-sm">₹{signal.stopLossPrice.toFixed(1)}</span>
                      <span className="block text-[9px] text-slate-500 font-sans">Strict Exit</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                        TARGET 1 (1:2)
                      </span>
                      <span className="text-emerald-400 font-bold text-sm">₹{signal.target1.toFixed(1)}</span>
                      <span className="block text-[9px] text-slate-500 font-sans">Book 50%</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-sans text-slate-500 font-semibold">
                        TARGET 2 (1:3)
                      </span>
                      <span className="text-emerald-400 font-bold text-sm">₹{signal.target2.toFixed(1)}</span>
                      <span className="block text-[9px] text-slate-500 font-sans">Runner T3: ₹{signal.target3.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Invalidation Rule */}
                  <div className="mt-2.5 text-[11px] text-slate-400">
                    <span className="font-semibold text-rose-300">Invalidation Trigger:</span>{' '}
                    <span className="text-slate-300">{signal.invalidationTrigger}</span>
                  </div>

                  {/* 4-Pillar Algorithmic Verification Checklist */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/70">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Algorithmic Verification Checklist:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {signal.checklist.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-2 py-1 bg-slate-950/60 rounded border border-slate-800/60"
                        >
                          <span className="text-slate-300 truncate max-w-[180px]">{item.factor}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {item.score}/{item.weight} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Capital & Position Sizing Strip */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">CAPITAL REQ</span>
                        <span className="text-white font-bold">₹{signal.capitalRequired.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">MAX RISK</span>
                        <span className="text-rose-400 font-bold">₹{signal.maxRiskAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">SIZED LOTS</span>
                        <span className="text-amber-300 font-bold">{signal.recommendedLots} Lot(s)</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-sans text-slate-500 block">PROJECTED PROFIT</span>
                      <span className="text-emerald-400 font-bold">+₹{signal.projectedProfit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Controls */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectSignalForChart(signal)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    View Chart Levels
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onBacktestSignal(signal)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
                    >
                      Backtest 30D
                    </button>

                    <button
                      onClick={() => onExecuteAlgoTrade(signal)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
                    >
                      Algo Auto-Execute
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
