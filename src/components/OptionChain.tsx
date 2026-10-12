import React, { useState } from 'react';
import { StockQuote, OptionChainRow, StrategyLeg, OptionType } from '../types/market';

interface OptionChainProps {
  instrument: StockQuote;
  chain: OptionChainRow[];
  onAddLeg: (leg: StrategyLeg) => void;
}

export const OptionChain: React.FC<OptionChainProps> = ({
  instrument,
  chain,
  onAddLeg,
}) => {
  const [showGreeks, setShowGreeks] = useState(true);

  // Compute Total Call OI and Put OI
  const totalCallOI = chain.reduce((acc, row) => acc + row.call.openInterest, 0);
  const totalPutOI = chain.reduce((acc, row) => acc + row.put.openInterest, 0);
  const calculatedPCR = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '1.00';

  // Max Pain approximation (strike with minimal payout to option buyers)
  let minPainValue = Infinity;
  let maxPainStrike = instrument.price;

  for (const testRow of chain) {
    const testStrike = testRow.strike;
    let totalPayout = 0;
    for (const row of chain) {
      if (testStrike > row.strike) {
        totalPayout += (testStrike - row.strike) * row.call.openInterest;
      }
      if (testStrike < row.strike) {
        totalPayout += (row.strike - testStrike) * row.put.openInterest;
      }
    }
    if (totalPayout < minPainValue) {
      minPainValue = totalPayout;
      maxPainStrike = testStrike;
    }
  }

  const handleLegAdd = (type: OptionType, action: 'BUY' | 'SELL', strike: number, ltp: number, delta: number, theta: number) => {
    const newLeg: StrategyLeg = {
      id: `leg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      action,
      strike,
      expiry: '24-OCT-2024',
      premium: ltp,
      lots: 1,
      lotSize: instrument.lotSize,
      delta,
      theta,
    };
    onAddLeg(newLeg);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Top Chain Header & Metrics */}
      <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{instrument.symbol} Option Chain</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Lot: {instrument.lotSize}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live NSE Expiry 24-OCT-2024 · Spot: ₹{instrument.price.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">PCR (PUT/CALL)</span>
            <span className={`font-bold ${Number(calculatedPCR) >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {calculatedPCR} {Number(calculatedPCR) >= 1 ? '(Bullish)' : '(Bearish)'}
            </span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">MAX PAIN STRIKE</span>
            <span className="text-amber-400 font-bold">₹{maxPainStrike.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px] font-sans">IMPLIED VOL (IV)</span>
            <span className="text-purple-400 font-bold">{instrument.iv.toFixed(1)}%</span>
          </div>

          <button
            onClick={() => setShowGreeks(!showGreeks)}
            className={`px-3 py-1.5 rounded text-xs font-sans font-semibold border transition-colors ${
              showGreeks
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {showGreeks ? 'Hide Greeks' : 'Show Greeks'}
          </button>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            {/* Multi-header */}
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase text-[11px]">
              <th colSpan={showGreeks ? 6 : 4} className="py-2.5 px-3 text-center text-emerald-400 border-r border-slate-800">
                CALLS (CE)
              </th>
              <th className="py-2.5 px-4 text-center bg-slate-900 text-white font-bold">
                STRIKE
              </th>
              <th colSpan={showGreeks ? 6 : 4} className="py-2.5 px-3 text-center text-rose-400 border-l border-slate-800">
                PUTS (PE)
              </th>
            </tr>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[10px]">
              {/* Call Columns */}
              <th className="py-2 px-2.5 text-right">OI</th>
              <th className="py-2 px-2 text-right">Vol</th>
              {showGreeks && <th className="py-2 px-2 text-right">IV%</th>}
              {showGreeks && <th className="py-2 px-2 text-right">Delta</th>}
              <th className="py-2 px-2.5 text-right font-bold text-slate-200">LTP (₹)</th>
              <th className="py-2 px-2 text-center border-r border-slate-800">Action</th>

              {/* Center Strike */}
              <th className="py-2 px-4 text-center font-bold text-slate-200 bg-slate-900">Strike</th>

              {/* Put Columns */}
              <th className="py-2 px-2 text-center border-l border-slate-800">Action</th>
              <th className="py-2 px-2.5 text-left font-bold text-slate-200">LTP (₹)</th>
              {showGreeks && <th className="py-2 px-2 text-left">Delta</th>}
              {showGreeks && <th className="py-2 px-2 text-left">IV%</th>}
              <th className="py-2 px-2 text-left">Vol</th>
              <th className="py-2 px-2.5 text-left">OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {chain.map((row) => {
              const isAtm = row.isAtm;
              const isCallITM = row.strike < instrument.price;
              const isPutITM = row.strike > instrument.price;

              return (
                <tr
                  key={row.strike}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    isAtm ? 'bg-amber-500/10 font-medium' : ''
                  }`}
                >
                  {/* CALLS */}
                  <td className={`py-1.5 px-2.5 text-right text-slate-400 ${isCallITM ? 'bg-emerald-950/20' : ''}`}>
                    {(row.call.openInterest / 1000).toFixed(1)}k
                  </td>
                  <td className={`py-1.5 px-2 text-right text-slate-500 ${isCallITM ? 'bg-emerald-950/20' : ''}`}>
                    {(row.call.volume / 1000).toFixed(0)}k
                  </td>
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-right text-purple-300 ${isCallITM ? 'bg-emerald-950/20' : ''}`}>
                      {row.call.iv.toFixed(1)}
                    </td>
                  )}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-right text-emerald-400 ${isCallITM ? 'bg-emerald-950/20' : ''}`}>
                      {row.call.delta.toFixed(2)}
                    </td>
                  )}
                  <td className={`py-1.5 px-2.5 text-right font-bold text-emerald-300 ${isCallITM ? 'bg-emerald-950/20' : ''}`}>
                    ₹{row.call.ltp.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-800">
                    <div className="flex items-center justify-center gap-1 font-sans">
                      <button
                        onClick={() => handleLegAdd('CE', 'BUY', row.strike, row.call.ltp, row.call.delta, row.call.theta)}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 text-[10px] font-bold"
                        title="Add Buy Call to Strategy"
                      >
                        B
                      </button>
                      <button
                        onClick={() => handleLegAdd('CE', 'SELL', row.strike, row.call.ltp, row.call.delta, row.call.theta)}
                        className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-slate-950 text-[10px] font-bold"
                        title="Add Sell Call to Strategy"
                      >
                        S
                      </button>
                    </div>
                  </td>

                  {/* STRIKE */}
                  <td
                    className={`py-1.5 px-4 text-center font-bold text-white bg-slate-950 border-x border-slate-800 ${
                      isAtm ? 'text-amber-300 bg-amber-950/40' : ''
                    }`}
                  >
                    {row.strike.toLocaleString('en-IN')}
                    {isAtm && <span className="block text-[9px] text-amber-400 font-sans uppercase">ATM</span>}
                  </td>

                  {/* PUTS */}
                  <td className="py-1.5 px-2 text-center border-l border-slate-800">
                    <div className="flex items-center justify-center gap-1 font-sans">
                      <button
                        onClick={() => handleLegAdd('PE', 'BUY', row.strike, row.put.ltp, row.put.delta, row.put.theta)}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 text-[10px] font-bold"
                        title="Add Buy Put to Strategy"
                      >
                        B
                      </button>
                      <button
                        onClick={() => handleLegAdd('PE', 'SELL', row.strike, row.put.ltp, row.put.delta, row.put.theta)}
                        className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-slate-950 text-[10px] font-bold"
                        title="Add Sell Put to Strategy"
                      >
                        S
                      </button>
                    </div>
                  </td>
                  <td className={`py-1.5 px-2.5 text-left font-bold text-rose-300 ${isPutITM ? 'bg-rose-950/20' : ''}`}>
                    ₹{row.put.ltp.toFixed(2)}
                  </td>
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-left text-rose-400 ${isPutITM ? 'bg-rose-950/20' : ''}`}>
                      {row.put.delta.toFixed(2)}
                    </td>
                  )}
                  {showGreeks && (
                    <td className={`py-1.5 px-2 text-left text-purple-300 ${isPutITM ? 'bg-rose-950/20' : ''}`}>
                      {row.put.iv.toFixed(1)}
                    </td>
                  )}
                  <td className={`py-1.5 px-2 text-left text-slate-500 ${isPutITM ? 'bg-rose-950/20' : ''}`}>
                    {(row.put.volume / 1000).toFixed(0)}k
                  </td>
                  <td className={`py-1.5 px-2.5 text-left text-slate-400 ${isPutITM ? 'bg-rose-950/20' : ''}`}>
                    {(row.put.openInterest / 1000).toFixed(1)}k
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
