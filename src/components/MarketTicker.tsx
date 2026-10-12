import React from 'react';
import { StockQuote } from '../types/market';

interface MarketTickerProps {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectInstrument: (symbol: string) => void;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({
  instruments,
  selectedSymbol,
  onSelectInstrument,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-3 min-w-max">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 pr-2 border-r border-slate-800">
          NSE Watchlist
        </span>
        {instruments.map((inst) => {
          const isSelected = inst.symbol === selectedSymbol;
          const isUp = inst.change >= 0;
          return (
            <button
              key={inst.symbol}
              onClick={() => onSelectInstrument(inst.symbol)}
              className={`flex items-center gap-2.5 px-3 py-1 rounded text-xs transition-colors whitespace-nowrap shrink-0 border ${
                isSelected
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="font-bold">{inst.symbol}</span>
              <span className="font-mono tabular-nums text-slate-200">
                ₹{inst.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={`font-mono tabular-nums text-[11px] font-semibold ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? '+' : ''}
                {inst.changePercent.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
