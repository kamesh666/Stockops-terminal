import React, { useState, useMemo } from 'react';
import { StockQuote } from '../types/market';
import { PRESET_STRATEGIES } from '../utils/strategyEngine';
import { runStrategyBacktest } from '../utils/backtestEngine';

interface BacktestTabProps {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  userCapital: number;
}

export const BacktestTab: React.FC<BacktestTabProps> = ({
  instruments,
  selectedSymbol,
  onSelectSymbol,
  userCapital,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('bull-call-spread');
  const [lotMultiplier, setLotMultiplier] = useState<number>(1);
  const [testCapital, setTestCapital] = useState<number>(userCapital || 100000);
  const [hoverDayIndex, setHoverDayIndex] = useState<number | null>(null);

  const currentInstrument = useMemo(() => {
    return instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];
  }, [instruments, selectedSymbol]);

  // Compute 30-day backtest report
  const report = useMemo(() => {
    return runStrategyBacktest(currentInstrument, selectedStrategyId, testCapital, lotMultiplier);
  }, [currentInstrument, selectedStrategyId, testCapital, lotMultiplier]);

  // SVG Chart Dimensions
  const width = 900;
  const height = 340;
  const paddingX = 45;
  const paddingY = 35;

  const dailyPoints = report.dailyPoints;
  const minEquity = Math.min(...dailyPoints.map((d) => d.portfolioEquity)) * 0.985;
  const maxEquity = Math.max(...dailyPoints.map((d) => d.portfolioEquity)) * 1.015;
  const equityRange = maxEquity - minEquity || 1;

  const minSpot = Math.min(...dailyPoints.map((d) => d.spotPrice)) * 0.99;
  const maxSpot = Math.max(...dailyPoints.map((d) => d.spotPrice)) * 1.01;
  const spotRange = maxSpot - minSpot || 1;

  const getX = (index: number) => {
    return paddingX + (index / (dailyPoints.length - 1)) * (width - paddingX * 2);
  };

  const getEquityY = (equity: number) => {
    return height - paddingY - ((equity - minEquity) / equityRange) * (height - paddingY * 2);
  };

  const getSpotY = (spot: number) => {
    return height - paddingY - ((spot - minSpot) / spotRange) * (height - paddingY * 2);
  };

  // Paths
  const equityPath = dailyPoints
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getEquityY(d.portfolioEquity)}`)
    .join(' ');

  const spotPath = dailyPoints
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getSpotY(d.spotPrice)}`)
    .join(' ');

  const baselineY = getEquityY(testCapital);
  const equityAreaPath = `${equityPath} L ${getX(dailyPoints.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

  const activePoint = hoverDayIndex !== null && dailyPoints[hoverDayIndex]
    ? dailyPoints[hoverDayIndex]
    : dailyPoints[dailyPoints.length - 1];

  const isNetProfit = report.totalPnL >= 0;

  return (
    <div className="space-y-6">
      {/* Top Configuration & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
              StockOps 30-Day Historical Volatility Backtester
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Strategy PnL Simulation & Risk Validation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates real options contracts, time decay, and historical volatility across the last 30 market sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Instrument Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Instrument:</span>
              <select
                value={selectedSymbol}
                onChange={(e) => onSelectSymbol(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Sizing Lots */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Lots:</span>
              <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
                {[1, 2, 4].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLotMultiplier(l)}
                    className={`px-2 py-0.5 rounded font-mono ${
                      lotMultiplier === l
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {l}x
                  </button>
                ))}
              </div>
            </div>

            {/* Initial Capital */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Capital:</span>
              <input
                type="number"
                step="25000"
                value={testCapital}
                onChange={(e) => setTestCapital(Math.max(25000, Number(e.target.value)))}
                className="w-24 bg-slate-950 border border-slate-700 text-white font-mono px-2 py-1 rounded text-xs"
              />
            </div>
          </div>
        </div>

        {/* Strategy Selector Chips */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Select Strategy to Backtest:
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_STRATEGIES.filter((st) => !st.legsGenerator(100, 1, 100, 1, 'X').some((l) => l.type === 'EQUITY')).map((strat) => (
              <button
                key={strat.id}
                onClick={() => setSelectedStrategyId(strat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  selectedStrategyId === strat.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {strat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Performance Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Net Strategy P&amp;L
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className={`text-base font-bold ${isNetProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isNetProfit ? '+' : ''}₹{report.totalPnL.toLocaleString('en-IN')}
            </span>
            <span className={`block text-[11px] ${isNetProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({report.roiPercent >= 0 ? '+' : ''}{report.roiPercent}%)
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Benchmark Return
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className="text-base font-bold text-slate-200">
              {report.benchmarkReturnPercent >= 0 ? '+' : ''}{report.benchmarkReturnPercent}%
            </span>
            <span className="block text-[11px] text-slate-500">
              Buy &amp; Hold Spot
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Win Rate
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className="text-base font-bold text-cyan-400">
              {report.winRate}%
            </span>
            <span className="block text-[11px] text-slate-500">
              {report.winTrades}W / {report.lossTrades}L ({report.totalTrades} Total)
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Profit Factor
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className="text-base font-bold text-amber-400">
              {report.profitFactor}
            </span>
            <span className="block text-[11px] text-slate-500">
              Gross Win/Loss Ratio
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Max Drawdown
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className="text-base font-bold text-rose-400">
              {report.maxDrawdownPercent}%
            </span>
            <span className="block text-[11px] text-rose-500">
              -₹{report.maxDrawdown.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
            Sharpe Ratio
          </span>
          <div className="mt-1 font-mono tabular-nums">
            <span className="text-base font-bold text-purple-400">
              {report.sharpeRatio}
            </span>
            <span className="block text-[11px] text-slate-500">
              Risk-Adjusted Alpha
            </span>
          </div>
        </div>
      </div>

      {/* Interactive 30-Day Equity Curve Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>30-Day Cumulative Strategy Equity vs Benchmark</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Solid curve traces portfolio equity growth; dashed line tracks underlying {report.symbol} spot price.
            </p>
          </div>

          {activePoint && (
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400 font-sans">{activePoint.date}:</span>
              <span>
                Equity:{' '}
                <strong className="text-emerald-400">₹{activePoint.portfolioEquity.toLocaleString('en-IN')}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Cum. P&amp;L:{' '}
                <strong className={activePoint.cumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {activePoint.cumulativePnL >= 0 ? '+' : ''}₹{activePoint.cumulativePnL.toLocaleString('en-IN')}
                </strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Spot: <strong className="text-slate-300">₹{activePoint.spotPrice.toFixed(1)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* SVG Equity Chart */}
        <div
          className="relative w-full aspect-[21/8] min-h-[280px] max-h-[380px] bg-slate-950/90 select-none cursor-crosshair"
          onMouseLeave={() => setHoverDayIndex(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / rect.width;
              const idx = Math.min(
                dailyPoints.length - 1,
                Math.max(0, Math.floor(relX * dailyPoints.length))
              );
              setHoverDayIndex(idx);
            }}
          >
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Shaded Area */}
            <path d={equityAreaPath} fill="url(#equityGrad)" />

            {/* Capital Baseline */}
            <line
              x1={paddingX}
              y1={baselineY}
              x2={width - paddingX}
              y2={baselineY}
              stroke="#334155"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text x={paddingX - 6} y={baselineY + 4} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">
              ₹{(testCapital / 1000).toFixed(0)}k
            </text>

            {/* Benchmark Spot Price Path (Dashed Slate) */}
            <path d={spotPath} fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.75" />

            {/* Cumulative Equity Curve (Solid Emerald) */}
            <path d={equityPath} fill="none" stroke="#10b981" strokeWidth="2.5" />

            {/* Hover Indicator */}
            {hoverDayIndex !== null && (
              <g>
                <line
                  x1={getX(hoverDayIndex)}
                  y1={paddingY}
                  x2={getX(hoverDayIndex)}
                  y2={height - paddingY}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <circle
                  cx={getX(hoverDayIndex)}
                  cy={getEquityY(dailyPoints[hoverDayIndex].portfolioEquity)}
                  r="4"
                  fill="#10b981"
                />
                <circle
                  cx={getX(hoverDayIndex)}
                  cy={getSpotY(dailyPoints[hoverDayIndex].spotPrice)}
                  r="3"
                  fill="#94a3b8"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Chart Legend */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-emerald-500 rounded-sm"></span>
              <span className="text-slate-300 font-medium">Strategy Portfolio Equity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-slate-500 border-b border-dashed border-slate-500"></span>
              <span className="text-slate-400 font-medium">Underlying Spot Price (Benchmark)</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500">
            30 Daily Sessions Simulated with Black-Scholes Greeks
          </span>
        </div>
      </div>

      {/* Historical Trades Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Historical Backtest Trades Ledger ({report.trades.length} Cycles Completed)
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Lot Size: {currentInstrument.lotSize * lotMultiplier} Shares
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Entry Date</th>
                <th className="py-2.5 px-3">Exit Date</th>
                <th className="py-2.5 px-3">Entry Spot</th>
                <th className="py-2.5 px-3">Exit Spot</th>
                <th className="py-2.5 px-3">Option Legs Executed</th>
                <th className="py-2.5 px-3">Capital Sized</th>
                <th className="py-2.5 px-3">Exit Reason</th>
                <th className="py-2.5 px-3 text-right">Realized P&amp;L (₹)</th>
                <th className="py-2.5 px-3 text-right">Return %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {report.trades.map((trade) => {
                const isWin = trade.realizedPnL > 0;
                return (
                  <tr key={trade.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-500">{trade.tradeNumber}</td>
                    <td className="py-2 px-3 text-slate-300">{trade.entryDate}</td>
                    <td className="py-2 px-3 text-slate-300">{trade.exitDate}</td>
                    <td className="py-2 px-3 text-slate-300">₹{trade.entrySpot.toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-300">₹{trade.exitSpot.toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                      {trade.legsDescription}
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      ₹{trade.capitalCommitted.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          trade.exitReason === 'TARGET_HIT'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : trade.exitReason === 'SL_HIT'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {trade.exitReason}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isWin ? '+' : ''}₹{trade.realizedPnL.toLocaleString('en-IN')}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trade.roiPercent >= 0 ? '+' : ''}{trade.roiPercent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
