import React, { useState, useRef } from 'react';
import { StockQuote, Candle, AutomatedSetup } from '../types/market';

interface CandlestickChartProps {
  instrument: StockQuote;
  candles: Candle[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  activeSetup?: AutomatedSetup | null;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  instrument,
  candles,
  timeframe,
  onTimeframeChange,
  activeSetup,
}) => {
  const [showEma, setShowEma] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  if (!candles || candles.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
        Loading chart candles...
      </div>
    );
  }

  // Calculate scales
  const prices = candles.flatMap((c) => [c.high, c.low]);
  if (activeSetup && showLevels) {
    prices.push(activeSetup.entryPrice, activeSetup.stopLoss, activeSetup.target1, activeSetup.target2);
  }
  const minPrice = Math.min(...prices) * 0.997;
  const maxPrice = Math.max(...prices) * 1.003;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = Math.max(...candles.map((c) => c.volume)) || 1;

  // Chart dimensions inside SVG viewBox
  const width = 900;
  const height = 440;
  const priceAreaHeight = 330;
  const volumeAreaHeight = 90;
  const candlePadding = 14;
  const candleWidth = Math.max(3, (width - candlePadding * 2) / candles.length - 4);

  const getX = (index: number) => {
    return candlePadding + index * ((width - candlePadding * 2) / candles.length) + candleWidth / 2;
  };

  const getY = (price: number) => {
    return priceAreaHeight - ((price - minPrice) / priceRange) * priceAreaHeight;
  };

  const getVolY = (vol: number) => {
    const volHeight = (vol / maxVolume) * volumeAreaHeight;
    return height - volHeight;
  };

  // Generate path string for EMA20
  const emaPath = candles
    .map((c, i) => (c.ema20 ? `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.ema20)}` : ''))
    .filter(Boolean)
    .join(' ');

  // Generate path string for VWAP
  const vwapPath = candles
    .map((c, i) => (c.vwap ? `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.vwap)}` : ''))
    .filter(Boolean)
    .join(' ');

  const activeCandle = hoverIndex !== null && candles[hoverIndex] ? candles[hoverIndex] : candles[candles.length - 1];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-base">{instrument.symbol}</span>
            <span className="text-xs text-slate-400">({instrument.exchange})</span>
          </div>

          <span className="text-slate-600">|</span>

          {/* Timeframe selector (From StockOps Week 4/8: Multiple Timeframe Analysis) */}
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            {['5m', '15m', '1h', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span className="text-slate-600">|</span>

          {/* Indicator toggles */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowEma(!showEma)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                showEma
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-transparent border-slate-800 text-slate-500'
              }`}
            >
              EMA 20
            </button>
            <button
              onClick={() => setShowVwap(!showVwap)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                showVwap
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'bg-transparent border-slate-800 text-slate-500'
              }`}
            >
              VWAP
            </button>
            <button
              onClick={() => setShowLevels(!showLevels)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                showLevels
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-transparent border-slate-800 text-slate-500'
              }`}
            >
              Setup Levels
            </button>
          </div>
        </div>

        {/* Live Candle OHLC Readout */}
        {activeCandle && (
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
            <span>
              O: <strong className="text-white">₹{activeCandle.open.toFixed(1)}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">₹{activeCandle.high.toFixed(1)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">₹{activeCandle.low.toFixed(1)}</strong>
            </span>
            <span>
              C: <strong className="text-white">₹{activeCandle.close.toFixed(1)}</strong>
            </span>
            <span>
              Vol: <strong className="text-slate-400">{(activeCandle.volume / 1000).toFixed(0)}k</strong>
            </span>
          </div>
        )}
      </div>

      {/* SVG Interactive Canvas */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[16/9] min-h-[380px] max-h-[500px] select-none bg-slate-950/80 cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const idx = Math.min(
              candles.length - 1,
              Math.max(0, Math.floor(relX * candles.length))
            );
            setHoverIndex(idx);
          }}
        >
          <defs>
            <linearGradient id="volGradUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="volGradDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0.2, 0.4, 0.6, 0.8].map((pct) => {
            const price = minPrice + (1 - pct) * priceRange;
            const y = pct * priceAreaHeight;
            return (
              <g key={pct}>
                <line x1={0} y1={y} x2={width} y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                <text x={width - 8} y={y - 4} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
                  ₹{price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Support and Resistance Horizontal Zones */}
          <line
            x1={0}
            y1={getY(instrument.resistance)}
            x2={width}
            y2={getY(instrument.resistance)}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text x={16} y={getY(instrument.resistance) - 4} fill="#f59e0b" fontSize="10" fontWeight="bold">
            Resistance ₹{instrument.resistance.toFixed(1)}
          </text>

          <line
            x1={0}
            y1={getY(instrument.support)}
            x2={width}
            y2={getY(instrument.support)}
            stroke="#38bdf8"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text x={16} y={getY(instrument.support) + 12} fill="#38bdf8" fontSize="10" fontWeight="bold">
            Support ₹{instrument.support.toFixed(1)}
          </text>

          {/* Volume bars */}
          {candles.map((c, i) => {
            const x = getX(i);
            const isBullish = c.close >= c.open;
            const y = getVolY(c.volume);
            const h = height - y;
            return (
              <rect
                key={`vol-${i}`}
                x={x - candleWidth / 2}
                y={y}
                width={candleWidth}
                height={Math.max(1, h)}
                fill={isBullish ? 'url(#volGradUp)' : 'url(#volGradDown)'}
              />
            );
          })}

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const x = getX(i);
            const isBullish = c.close >= c.open;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

            const strokeColor = isBullish ? '#10b981' : '#f43f5e';
            const fillColor = isBullish ? '#10b981' : '#f43f5e';

            return (
              <g key={`candle-${i}`}>
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="0.8"
                  rx="1"
                />
              </g>
            );
          })}

          {/* Overlays: EMA20 & VWAP */}
          {showEma && emaPath && (
            <path d={emaPath} fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.85" />
          )}
          {showVwap && vwapPath && (
            <path d={vwapPath} fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.85" />
          )}

          {/* Automated Trade Levels Overlay (Entry, Stop Loss, Target 1, Target 2) */}
          {showLevels && activeSetup && (
            <g>
              {/* Entry Level */}
              <line
                x1={0}
                y1={getY(activeSetup.entryPrice)}
                x2={width}
                y2={getY(activeSetup.entryPrice)}
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <rect x={width - 150} y={getY(activeSetup.entryPrice) - 10} width="140" height="20" fill="#083344" rx="4" />
              <text x={width - 80} y={getY(activeSetup.entryPrice) + 4} fill="#22d3ee" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                ENTRY: ₹{activeSetup.entryPrice.toFixed(1)}
              </text>

              {/* Stop Loss Level */}
              <line
                x1={0}
                y1={getY(activeSetup.stopLoss)}
                x2={width}
                y2={getY(activeSetup.stopLoss)}
                stroke="#f43f5e"
                strokeWidth="1.8"
              />
              <rect x={width - 165} y={getY(activeSetup.stopLoss) - 10} width="155" height="20" fill="#4c0519" rx="4" />
              <text x={width - 87} y={getY(activeSetup.stopLoss) + 4} fill="#fb7185" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                STOP LOSS: ₹{activeSetup.stopLoss.toFixed(1)}
              </text>

              {/* Target 1 Level */}
              <line
                x1={0}
                y1={getY(activeSetup.target1)}
                x2={width}
                y2={getY(activeSetup.target1)}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <rect x={width - 150} y={getY(activeSetup.target1) - 10} width="140" height="20" fill="#064e3b" rx="4" />
              <text x={width - 80} y={getY(activeSetup.target1) + 4} fill="#34d399" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                TARGET 1: ₹{activeSetup.target1.toFixed(1)}
              </text>

              {/* Target 2 Level */}
              <line
                x1={0}
                y1={getY(activeSetup.target2)}
                x2={width}
                y2={getY(activeSetup.target2)}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <rect x={width - 150} y={getY(activeSetup.target2) - 10} width="140" height="20" fill="#064e3b" rx="4" />
              <text x={width - 80} y={getY(activeSetup.target2) + 4} fill="#34d399" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="bold">
                TARGET 2: ₹{activeSetup.target2.toFixed(1)}
              </text>
            </g>
          )}

          {/* Crosshair on hover */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={0}
                x2={getX(hoverIndex)}
                y2={height}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(candles[hoverIndex].close)}
                r="3.5"
                fill="#38bdf8"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Pattern & Strategy Banner below chart (From PDF: "Trend -> Structure -> Key Level -> Trigger -> Invalidity") */}
      {activeSetup && (
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Detected Pattern:</span>
            <span className="font-bold text-emerald-400">{activeSetup.pattern}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Confidence:</span>
            <span className="font-mono text-emerald-300 font-bold">{activeSetup.patternConfidence}%</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Timeframe:</span>
            <span className="font-semibold text-slate-200">{activeSetup.timeframe}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-slate-400">
              Invalidation Rule: <span className="text-rose-300 italic">{activeSetup.invalidationReason}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
