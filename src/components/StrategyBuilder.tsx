import React, { useState } from 'react';
import { StockQuote, StrategyLeg, OptionType } from '../types/market';
import { PRESET_STRATEGIES, calculatePayoff } from '../utils/strategyEngine';
import { PayoffChart } from './PayoffChart';
import { getStrikeStep } from '../data/indianMarketData';

interface StrategyBuilderProps {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  legs: StrategyLeg[];
  onUpdateLegs: (legs: StrategyLeg[]) => void;
  onExecutePaperTrade: (name: string, legs: StrategyLeg[], spotPrice: number) => void;
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({
  instruments,
  selectedSymbol,
  onSelectSymbol,
  legs,
  onUpdateLegs,
  onExecutePaperTrade,
}) => {
  const currentInstrument = instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];
  const [daysToExpiry, setDaysToExpiry] = useState<number>(5);
  const [adjustedIV, setAdjustedIV] = useState<number>(currentInstrument.iv || 16);
  const [strategyTitle, setStrategyTitle] = useState<string>('Custom Multi-Leg Strategy');

  const step = getStrikeStep(currentInstrument.symbol, currentInstrument.price);
  const atmStrike = Math.round(currentInstrument.price / step) * step;

  // Load a preset strategy
  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_STRATEGIES.find((p) => p.id === presetId);
    if (!preset) return;
    const newLegs = preset.legsGenerator(
      currentInstrument.price,
      currentInstrument.lotSize,
      atmStrike,
      step,
      '24-OCT-2024'
    );
    setStrategyTitle(preset.name);
    onUpdateLegs(newLegs);
  };

  // Modify individual leg
  const handleModifyLeg = (index: number, updates: Partial<StrategyLeg>) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], ...updates };
    onUpdateLegs(updated);
  };

  // Remove leg
  const handleRemoveLeg = (index: number) => {
    const updated = legs.filter((_, i) => i !== index);
    onUpdateLegs(updated);
  };

  // Add new blank leg
  const handleAddLeg = () => {
    const newLeg: StrategyLeg = {
      id: `leg-${Date.now()}`,
      type: 'CE',
      action: 'BUY',
      strike: atmStrike,
      expiry: '24-OCT-2024',
      premium: 85.0,
      lots: 1,
      lotSize: currentInstrument.lotSize,
    };
    onUpdateLegs([...legs, newLeg]);
  };

  // Calculate Payoff
  const analysis = calculatePayoff(legs, currentInstrument.price, daysToExpiry, adjustedIV);

  return (
    <div className="space-y-6">
      {/* Top Selector & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Advanced Options Strategy & Payoff Visualizer
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Construct worldwide option combinations, simulate time decay (Theta) and IV shifts with Black-Scholes Greeks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-semibold">Instrument:</label>
            <select
              value={selectedSymbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              {instruments.map((inst) => (
                <option key={inst.symbol} value={inst.symbol}>
                  {inst.symbol} (₹{inst.price.toFixed(1)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Worldwide Preset Strategies Selector */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Preset Worldwide Strategies (From StockOps Decision Framework: Market View → Volatility → Time → Strategy):
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_STRATEGIES.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:text-emerald-300 text-slate-300 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Time Decay & IV Sliders */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Days to Expiry (Theta Decay Simulation):</span>
              <span className="font-mono text-emerald-400 font-bold">{daysToExpiry} Day(s)</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysToExpiry}
              onChange={(e) => setDaysToExpiry(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Implied Volatility (IV Stress Test):</span>
              <span className="font-mono text-purple-400 font-bold">{adjustedIV.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="8"
              max="60"
              step="0.5"
              value={adjustedIV}
              onChange={(e) => setAdjustedIV(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Interactive Payoff Chart */}
      <PayoffChart
        analysis={analysis}
        spotPrice={currentInstrument.price}
        strategyName={strategyTitle}
      />

      {/* Multi-Legs Configurator Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">Strategy Legs ({legs.length})</h3>
            <span className="text-xs text-slate-400">
              Underlying Spot: ₹{currentInstrument.price.toFixed(2)} · Lot Size: {currentInstrument.lotSize}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddLeg}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            >
              + Add Custom Leg
            </button>
            <button
              onClick={() => onExecutePaperTrade(strategyTitle, legs, currentInstrument.price)}
              disabled={legs.length === 0}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-50"
            >
              Execute In Playbook
            </button>
          </div>
        </div>

        {legs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No legs added. Choose a preset strategy above or pick strikes from the Option Chain.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Strike (₹)</th>
                  <th className="py-2.5 px-4">Premium (LTP ₹)</th>
                  <th className="py-2.5 px-4">Lots</th>
                  <th className="py-2.5 px-4">Total Qty</th>
                  <th className="py-2.5 px-4">Total Cost / Credit</th>
                  <th className="py-2.5 px-4 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {legs.map((leg, idx) => {
                  const qty = leg.lots * leg.lotSize;
                  const total = leg.premium * qty;

                  return (
                    <tr key={leg.id} className="hover:bg-slate-800/40">
                      {/* BUY / SELL Action */}
                      <td className="py-2.5 px-4 font-sans">
                        <button
                          onClick={() => handleModifyLeg(idx, { action: leg.action === 'BUY' ? 'SELL' : 'BUY' })}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                            leg.action === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {leg.action}
                        </button>
                      </td>

                      {/* CALL / PUT Type */}
                      <td className="py-2.5 px-4 font-sans">
                        <select
                          value={leg.type}
                          onChange={(e) => handleModifyLeg(idx, { type: e.target.value as OptionType })}
                          className="bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                        >
                          <option value="CE">Call (CE)</option>
                          <option value="PE">Put (PE)</option>
                        </select>
                      </td>

                      {/* Strike */}
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step={step}
                          value={leg.strike}
                          onChange={(e) => handleModifyLeg(idx, { strike: Number(e.target.value) })}
                          className="w-24 bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                        />
                      </td>

                      {/* Premium */}
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="0.5"
                          value={leg.premium}
                          onChange={(e) => handleModifyLeg(idx, { premium: Number(e.target.value) })}
                          className="w-20 bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                        />
                      </td>

                      {/* Lots */}
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={leg.lots}
                          onChange={(e) => handleModifyLeg(idx, { lots: Math.max(1, Number(e.target.value)) })}
                          className="w-16 bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-xs"
                        />
                      </td>

                      {/* Total Qty */}
                      <td className="py-2.5 px-4 text-slate-400">
                        {qty} shares
                      </td>

                      {/* Total Cashflow */}
                      <td className="py-2.5 px-4 font-semibold">
                        <span className={leg.action === 'BUY' ? 'text-rose-400' : 'text-emerald-400'}>
                          {leg.action === 'BUY' ? '-' : '+'}₹{total.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </td>

                      {/* Remove Button */}
                      <td className="py-2.5 px-4 text-center font-sans">
                        <button
                          onClick={() => handleRemoveLeg(idx)}
                          className="text-slate-500 hover:text-rose-400 text-sm font-bold"
                          title="Delete leg"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
