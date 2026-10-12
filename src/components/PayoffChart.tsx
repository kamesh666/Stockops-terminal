import React, { useState } from 'react';
import { StrategyPayoffAnalysis } from '../utils/strategyEngine';

interface PayoffChartProps {
  analysis: StrategyPayoffAnalysis;
  spotPrice: number;
  strategyName: string;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  analysis,
  spotPrice,
  strategyName,
}) => {
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const { points, breakevens, maxProfit, maxLoss, probabilityOfProfit, riskRewardRatio, netPremium, totalDelta, totalTheta } = analysis;

  if (!points || points.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
        Add options legs to view the payoff diagram.
      </div>
    );
  }

  // Chart coordinates
  const width = 860;
  const height = 360;
  const paddingX = 40;
  const paddingY = 40;

  const minPrice = points[0].underlyingPrice;
  const maxPrice = points[points.length - 1].underlyingPrice;
  const priceRange = maxPrice - minPrice || 1;

  // Find min and max PnL for scaling Y axis
  const allPnLs = points.flatMap((p) => [p.expiryPnL, p.currentPnL]);
  const minPnL = Math.min(...allPnLs, -500);
  const maxPnL = Math.max(...allPnLs, 500);
  const pnlRange = maxPnL - minPnL || 1;

  const getX = (price: number) => {
    return paddingX + ((price - minPrice) / priceRange) * (width - paddingX * 2);
  };

  const getY = (pnl: number) => {
    return height - paddingY - ((pnl - minPnL) / pnlRange) * (height - paddingY * 2);
  };

  const zeroY = getY(0);
  const spotX = getX(spotPrice);

  // SVG Paths
  const expiryPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.underlyingPrice)} ${getY(p.expiryPnL)}`)
    .join(' ');

  const currentPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.underlyingPrice)} ${getY(p.currentPnL)}`)
    .join(' ');

  // Shaded Profit & Loss polygon for expiry curve
  const areaPath = `${expiryPath} L ${getX(maxPrice)} ${zeroY} L ${getX(minPrice)} ${zeroY} Z`;

  // Hovered point data
  const hoveredPoint = hoverPrice !== null
    ? points.reduce((prev, curr) => (Math.abs(curr.underlyingPrice - hoverPrice) < Math.abs(prev.underlyingPrice - hoverPrice) ? curr : prev), points[0])
    : points.reduce((prev, curr) => (Math.abs(curr.underlyingPrice - spotPrice) < Math.abs(prev.underlyingPrice - spotPrice) ? curr : prev), points[0]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header & Metrics Strip */}
      <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Strategy Payoff: {strategyName}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive Multi-Leg P&L curve across underlying price variations
          </p>
        </div>

        {/* Quick Strategy Stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">MAX PROFIT</span>
            <span className="text-emerald-400 font-bold">
              {typeof maxProfit === 'number' ? `₹${maxProfit.toLocaleString('en-IN')}` : maxProfit}
            </span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">MAX LOSS</span>
            <span className="text-rose-400 font-bold">
              {typeof maxLoss === 'number' ? `₹${maxLoss.toLocaleString('en-IN')}` : maxLoss}
            </span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">NET PREMIUM</span>
            <span className={netPremium >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {netPremium >= 0 ? `Credit ₹${netPremium.toLocaleString('en-IN')}` : `Debit ₹${Math.abs(netPremium).toLocaleString('en-IN')}`}
            </span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">POP (WIN RATE)</span>
            <span className="text-cyan-400 font-bold">{probabilityOfProfit}%</span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">R:R RATIO</span>
            <span className="text-white font-bold">{riskRewardRatio}</span>
          </div>
        </div>
      </div>

      {/* SVG Payoff Curve Canvas */}
      <div
        className="relative w-full aspect-[21/9] min-h-[300px] max-h-[420px] bg-slate-950/90 select-none cursor-crosshair"
        onMouseLeave={() => setHoverPrice(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const price = minPrice + relX * priceRange;
            setHoverPrice(price);
          }}
        >
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
            <clipPath id="profitClip">
              <rect x="0" y="0" width={width} height={zeroY} />
            </clipPath>
            <clipPath id="lossClip">
              <rect x="0" y={zeroY} width={width} height={height - zeroY} />
            </clipPath>
          </defs>

          {/* Shaded Profit and Loss areas */}
          <path d={areaPath} fill="url(#profitGrad)" clipPath="url(#profitClip)" />
          <path d={areaPath} fill="url(#lossGrad)" clipPath="url(#lossClip)" />

          {/* Zero P&L baseline */}
          <line
            x1={paddingX}
            y1={zeroY}
            x2={width - paddingX}
            y2={zeroY}
            stroke="#475569"
            strokeWidth="1.5"
          />
          <text x={paddingX - 6} y={zeroY + 4} fill="#94a3b8" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
            ₹0
          </text>

          {/* Horizontal PnL reference gridlines */}
          {[maxPnL * 0.5, minPnL * 0.5].map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                <text x={paddingX - 6} y={y + 4} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">
                  ₹{Math.round(val).toLocaleString('en-IN')}
                </text>
              </g>
            );
          })}

          {/* Breakeven lines */}
          {breakevens.map((be) => {
            const x = getX(be);
            return (
              <g key={be}>
                <line
                  x1={x}
                  y1={paddingY}
                  x2={x}
                  y2={height - paddingY}
                  stroke="#fbbf24"
                  strokeDasharray="4 3"
                  strokeWidth="1.2"
                />
                <rect x={x - 42} y={paddingY - 22} width="84" height="18" fill="#451a03" rx="3" />
                <text x={x} y={paddingY - 9} fill="#fde68a" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                  BE: ₹{be.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Spot Price marker */}
          <line
            x1={spotX}
            y1={paddingY}
            x2={spotX}
            y2={height - paddingY}
            stroke="#38bdf8"
            strokeWidth="1.5"
          />
          <rect x={spotX - 45} y={height - paddingY + 6} width="90" height="18" fill="#0c4a6e" rx="3" />
          <text x={spotX} y={height - paddingY + 19} fill="#7dd3fc" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
            Spot: ₹{spotPrice.toFixed(1)}
          </text>

          {/* T+0 Curve (Dashed Amber) */}
          <path d={currentPath} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 3" opacity="0.9" />

          {/* Expiry Curve (Solid Emerald/Cyan) */}
          <path d={expiryPath} fill="none" stroke="#10b981" strokeWidth="2.5" />

          {/* Hover Crosshair & Data Callout */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.underlyingPrice)}
                y1={paddingY}
                x2={getX(hoveredPoint.underlyingPrice)}
                y2={height - paddingY}
                stroke="#e2e8f0"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoveredPoint.underlyingPrice)}
                cy={getY(hoveredPoint.expiryPnL)}
                r="4.5"
                fill="#10b981"
              />
              <circle
                cx={getX(hoveredPoint.underlyingPrice)}
                cy={getY(hoveredPoint.currentPnL)}
                r="4"
                fill="#fbbf24"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Payoff Footer Legend & Hover Dynamic Readout */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-emerald-500 rounded-sm"></span>
            <span className="text-slate-300 font-medium">Expiry P&L</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-amber-400 border-b border-dashed border-amber-400"></span>
            <span className="text-slate-300 font-medium">T+0 (Current Day P&L)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Delta: <strong className="text-slate-200 font-mono">{totalDelta}</strong></span>
            <span>·</span>
            <span>Theta: <strong className="text-slate-200 font-mono">₹{totalTheta}/day</strong></span>
          </div>
        </div>

        {hoveredPoint && (
          <div className="flex items-center gap-3 font-mono tabular-nums bg-slate-900 px-3 py-1 rounded border border-slate-800">
            <span className="text-slate-400 font-sans text-[11px]">At Price ₹{hoveredPoint.underlyingPrice.toFixed(0)}:</span>
            <span>
              Expiry:{' '}
              <strong className={hoveredPoint.expiryPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {hoveredPoint.expiryPnL >= 0 ? '+' : ''}₹{hoveredPoint.expiryPnL.toLocaleString('en-IN')}
              </strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              T+0:{' '}
              <strong className={hoveredPoint.currentPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {hoveredPoint.currentPnL >= 0 ? '+' : ''}₹{hoveredPoint.currentPnL.toLocaleString('en-IN')}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
