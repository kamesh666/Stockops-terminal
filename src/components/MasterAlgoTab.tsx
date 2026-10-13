import React, { useState, useMemo } from 'react';
import { StockQuote, MasterAlgoSignal } from '../types/market';
import { runMasterAlgorithm } from '../utils/masterAlgoEngine';

interface MasterAlgoTabProps {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  userCapital: number;
  onSelectSignalForChart: (signal: MasterAlgoSignal) => void;
  onExecuteMasterTrade: (signal: MasterAlgoSignal) => void;
  onBacktestSignal: (signal: MasterAlgoSignal) => void;
}

export const MasterAlgoTab: React.FC<MasterAlgoTabProps> = ({
  instruments,
  selectedSymbol,
  onSelectSymbol,
  userCapital,
  onSelectSignalForChart,
  onExecuteMasterTrade,
  onBacktestSignal,
}) => {
  const [minScore, setMinScore] = useState<number>(80);
  const [activeFilterSymbol, setActiveFilterSymbol] = useState<string>('ALL');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  // Generate Master Algo signals
  const allMasterSignals = useMemo(() => {
    return runMasterAlgorithm(instruments, userCapital, 1.5);
  }, [instruments, userCapital]);

  // Filter signals
  const filteredSignals = useMemo(() => {
    return allMasterSignals.filter((sig) => {
      if (activeFilterSymbol !== 'ALL' && sig.symbol !== activeFilterSymbol) return false;
      if (sig.masterConfidenceScore < minScore) return false;
      return true;
    });
  }, [allMasterSignals, activeFilterSymbol, minScore]);

  // Active signal for deep-dive panel
  const activeSignal = useMemo(() => {
    if (selectedSignalId) {
      const found = filteredSignals.find((s) => s.id === selectedSignalId);
      if (found) return found;
    }
    return filteredSignals[0] || allMasterSignals[0] || null;
  }, [filteredSignals, selectedSignalId, allMasterSignals]);

  return (
    <div className="space-y-6">
      {/* Top Authority & Concept Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              Institutional Master Confluence Algorithm
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Advanced Multi-Pillar Quantitative Execution Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Synthesizes algorithmic principles from leading technical authorities: <strong>TrendSpider</strong> (Anchored VWAP, TTM Squeeze), <strong>CMC Markets</strong> (Ichimoku Cloud Equilibrium, Fibonacci Extensions), <strong>TradingComputers</strong> (Volume Profile POC), and <strong>Investopedia</strong> (Derivatives Gamma Scalping).
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveFilterSymbol('ALL')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  activeFilterSymbol === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Scan Entire NSE
              </button>
              <button
                onClick={() => setActiveFilterSymbol(selectedSymbol)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  activeFilterSymbol === selectedSymbol
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Focus {selectedSymbol}
              </button>
            </div>

            <select
              value={selectedSymbol}
              onChange={(e) => {
                onSelectSymbol(e.target.value);
                setActiveFilterSymbol(e.target.value);
              }}
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

        {/* 4 Source Authorities Badges & Score Threshold */}
        <div className="mt-4 pt-1 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Authorities:</span>
            <span className="px-2.5 py-1 rounded bg-slate-950 text-cyan-300 border border-slate-800 text-[11px]">
              TrendSpider (AVWAP + Squeeze)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-950 text-purple-300 border border-slate-800 text-[11px]">
              CMC Markets (Ichimoku + Fib)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-950 text-amber-300 border border-slate-800 text-[11px]">
              TradingComputers (Volume POC)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-950 text-emerald-300 border border-slate-800 text-[11px]">
              Investopedia (Greeks &amp; Gamma)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Min Score:</span>
            {[80, 85, 90].map((sc) => (
              <button
                key={sc}
                onClick={() => setMinScore(sc)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                  minScore === sc
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                &ge;{sc}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Deep-Dive: Active Master Signal */}
      {activeSignal ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-extrabold text-white tracking-tight">
                  {activeSignal.tradeAction}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                  {activeSignal.masterConfidenceScore}% MASTER SCORE
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  {activeSignal.timeframe}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Underlying {activeSignal.symbol} Spot: <strong className="text-white font-mono">₹{activeSignal.underlyingSpot.toFixed(1)}</strong> · Expiry: {activeSignal.expiry}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectSignalForChart(activeSignal)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                View Chart
              </button>
              <button
                onClick={() => onBacktestSignal(activeSignal)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
              >
                Backtest 30D
              </button>
              <button
                onClick={() => onExecuteMasterTrade(activeSignal)}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                Auto-Execute in Playbook
              </button>
            </div>
          </div>

          {/* Execution Parameter Strip (Algo Trading Specifications) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono tabular-nums text-xs">
            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                ENTRY PREMIUM
              </span>
              <span className="text-cyan-400 font-bold text-sm">₹{activeSignal.entryPrice.toFixed(1)}</span>
              <span className="text-[9px] font-sans text-slate-500 block">Limit/Market Fill</span>
            </div>

            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                HARD STOP LOSS
              </span>
              <span className="text-rose-400 font-bold text-sm">₹{activeSignal.hardStopLoss.toFixed(1)}</span>
              <span className="text-[9px] font-sans text-slate-500 block">Trail SL: ₹{activeSignal.trailingAtrStop.toFixed(1)}</span>
            </div>

            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                TARGET 1 (1:2)
              </span>
              <span className="text-emerald-400 font-bold text-sm">₹{activeSignal.target1.toFixed(1)}</span>
              <span className="text-[9px] font-sans text-slate-500 block">Take 50% Profit</span>
            </div>

            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                TARGET 2 (FIB 161.8%)
              </span>
              <span className="text-emerald-400 font-bold text-sm">₹{activeSignal.target2.toFixed(1)}</span>
              <span className="text-[9px] font-sans text-slate-500 block">Golden Projection</span>
            </div>

            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                RUNNER TARGET 3
              </span>
              <span className="text-emerald-400 font-bold text-sm">₹{activeSignal.target3.toFixed(1)}</span>
              <span className="text-[9px] font-sans text-slate-500 block">Extended Move</span>
            </div>

            <div>
              <span className="text-[10px] font-sans text-slate-500 block font-semibold">
                SIZED LOTS / RISK
              </span>
              <span className="text-amber-300 font-bold text-sm">{activeSignal.capitalSizing.recommendedLots} Lot(s)</span>
              <span className="text-[9px] font-sans text-slate-500 block">Max Risk: ₹{activeSignal.capitalSizing.maxRiskAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Invalidation Trigger */}
          <div className="text-xs text-slate-400 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <span className="font-semibold text-rose-300">Algorithmic Invalidation Rule:</span>{' '}
            <span className="text-slate-300">{activeSignal.invalidationLevel}</span>
          </div>

          {/* 6 Institutional Pillars Confluence Grid */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              The 6 Institutional Confluence Pillars (Live Telemetry):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSignal.pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div>
                        <span className="text-xs font-bold text-white block">{pillar.pillarName}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{pillar.sourceAuthority}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {pillar.score}%
                      </span>
                    </div>

                    <div className="mt-3 text-xs">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span className="font-sans text-[11px]">{pillar.metricLabel}:</span>
                        <span className="font-mono text-white font-semibold">{pillar.metricValue}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-2 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                        {pillar.insight}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 uppercase font-semibold">Pillar Signal</span>
                    <span className="text-emerald-400 font-bold uppercase">{pillar.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Grid of All Detected Master Algo Signals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">
            All High-Conviction Institutional Signals ({filteredSignals.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Filtered &ge;{minScore}% Composite Score
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSignals.map((sig) => {
            const isSelected = activeSignal?.id === sig.id;
            return (
              <div
                key={sig.id}
                onClick={() => setSelectedSignalId(sig.id)}
                className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-emerald-500/60 shadow-md bg-slate-900/90'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between pb-2.5 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sig.tradeAction}</h4>
                    <span className="text-xs text-slate-400">
                      Spot ₹{sig.underlyingSpot.toFixed(1)} · {sig.timeframe}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                    {sig.masterConfidenceScore}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 my-3 text-xs font-mono tabular-nums bg-slate-950 p-2 rounded border border-slate-800">
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">ENTRY</span>
                    <span className="text-cyan-400 font-bold">₹{sig.entryPrice.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">STOP LOSS</span>
                    <span className="text-rose-400 font-bold">₹{sig.hardStopLoss.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">TARGET</span>
                    <span className="text-emerald-400 font-bold">₹{sig.target1.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">
                    Lots: <strong className="text-amber-300">{sig.capitalSizing.recommendedLots}</strong> · Risk: ₹{sig.capitalSizing.maxRiskAmount.toLocaleString('en-IN')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecuteMasterTrade(sig);
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors"
                  >
                    Execute
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
