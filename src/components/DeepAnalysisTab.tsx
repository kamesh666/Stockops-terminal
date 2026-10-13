import React, { useCallback, useEffect, useState } from 'react';
import { StockQuote } from '../types/market';
import { Analysis, ScanRow, SOURCE_LABEL, api } from '../api/stockopsApi';
import { AnalysisChart } from './AnalysisChart';

interface Props {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (s: string) => void;
  userCapital: number;
  riskPercent: number;
  backendOnline: boolean;
  onLogPlan: (a: Analysis) => void;
  onOpenStrategy: (strategyId: string, symbol: string) => void;
}

const INTERVALS = [
  { v: '1D', l: 'Daily' },
  { v: '1W', l: 'Weekly' },
  { v: '1h', l: '1 hour' },
  { v: '15m', l: '15 min' },
  { v: '5m', l: '5 min' },
];

const inr = (v?: number | null, d = 2) =>
  v == null ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

const biasColor = (b?: string) =>
  b === 'bullish' || b === 'up' || b === 'uptrend' || b === 'long'
    ? 'text-emerald-400'
    : b === 'bearish' || b === 'down' || b === 'downtrend' || b === 'short'
      ? 'text-rose-400'
      : 'text-slate-300';

const Card: React.FC<{ title: string; kicker?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title, kicker, right, children, className = '',
}) => (
  <section className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        {kicker && <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">{kicker}</div>}
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </section>
);

const ScoreBar: React.FC<{ score: number; compact?: boolean }> = ({ score, compact }) => {
  const pct = Math.min(100, Math.abs(score));
  const pos = score >= 0;
  return (
    <div className={`relative ${compact ? 'h-1.5 w-20' : 'h-2.5 w-full'} bg-slate-800 rounded-full overflow-hidden`} aria-label={`score ${score}`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
      <div
        className={`absolute inset-y-0 rounded-full ${pos ? 'bg-emerald-400' : 'bg-rose-400'}`}
        style={pos ? { left: '50%', width: `${pct / 2}%` } : { right: '50%', width: `${pct / 2}%` }}
      />
    </div>
  );
};

const Pass: React.FC<{ v: boolean | null }> = ({ v }) =>
  v === true ? <span className="text-emerald-400 font-bold">✓</span> : v === false ? <span className="text-rose-400 font-bold">✕</span> : <span className="text-slate-500">–</span>;

export const DeepAnalysisTab: React.FC<Props> = ({
  instruments, selectedSymbol, onSelectSymbol, userCapital, riskPercent, backendOnline, onLogPlan, onOpenStrategy,
}) => {
  const [interval, setInterval_] = useState('1D');
  const [holdingDays, setHoldingDays] = useState(5);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanRow[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showAllFactors, setShowAllFactors] = useState(false);

  const load = useCallback(async () => {
    if (!backendOnline) return;
    setLoading(true);
    setError(null);
    try {
      const a = await api.analysis(selectedSymbol, { interval, capital: userCapital, risk_pct: riskPercent, holding_days: holdingDays });
      setAnalysis(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [backendOnline, selectedSymbol, interval, userCapital, riskPercent, holdingDays]);

  useEffect(() => {
    load();
  }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      setScan(await api.scan({ interval, capital: userCapital, risk_pct: riskPercent }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  if (!backendOnline) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 space-y-3">
        <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Analysis engine offline</div>
        <h2 className="text-lg font-bold text-white">Start the Python engine to unlock Deep Analysis</h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          Deep Analysis, the real-data scanner and historical backtests run on the Python engine in <code className="text-slate-200">backend/</code>.
          It downloads NSE history from Yahoo Finance, or uses your Google-Sheets CSV exports. Open a second terminal in the project folder and run:
        </p>
        <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto">
{`cd backend
pip install -r requirements.txt
python -m uvicorn stockops.api:app --reload --port 8000`}
        </pre>
        <p className="text-xs text-slate-500">The terminal checks again every 15 seconds. Until then the other tabs keep using the built-in simulator.</p>
      </div>
    );
  }

  const a = analysis;
  const plan = a?.tradePlan;
  const factors = a ? [...a.confluence.factors].sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution)) : [];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Python engine · real historical data</div>
          <h2 className="text-lg font-bold text-white tracking-tight">Deep Technical Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dow theory, regime tool kits, candlesticks, chart patterns, Volume Spread Analysis, volatility ranges and SD-based option strikes, combined into one scored trade plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={selectedSymbol} onChange={(e) => onSelectSymbol(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500">
            {instruments.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
          </select>
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {INTERVALS.map((it) => (
              <button key={it.v} onClick={() => setInterval_(it.v)}
                className={`px-2.5 py-1 rounded-md font-semibold ${interval === it.v ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                {it.l}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-slate-400">
            Hold
            <input type="number" min={1} max={60} value={holdingDays} onChange={(e) => setHoldingDays(Math.max(1, Number(e.target.value)))}
              className="w-14 bg-slate-950 border border-slate-700 text-white font-mono px-2 py-1 rounded" />
            days
          </label>
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50">
            {loading ? 'Analysing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Scanner */}
      <Card title="Universe scan" kicker="Rank every instrument by confluence"
        right={
          <button onClick={runScan} disabled={scanning}
            className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/10 disabled:opacity-50">
            {scanning ? 'Scanning 14 instruments…' : scan ? 'Re-scan' : 'Run scan'}
          </button>
        }>
        {!scan ? (
          <p className="text-xs text-slate-500">Runs the full analysis on all 14 instruments and sorts them by the strength of the signal, bullish or bearish.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 text-[10px] uppercase tracking-wider">
                <tr className="border-b border-slate-800">
                  {['Symbol', 'Price', 'Chg %', 'Score', 'Verdict', 'Regime / stage', 'Trigger', 'VSA', 'vs index', 'Plan', 'R:R'].map((h) => (
                    <th key={h} className="text-left font-semibold py-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scan.map((r) => (
                  <tr key={r.symbol} onClick={() => onSelectSymbol(r.symbol)}
                    className={`border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/40 ${r.symbol === selectedSymbol ? 'bg-slate-800/60' : ''}`}>
                    <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">{r.symbol}</td>
                    {r.error ? (
                      <td colSpan={10} className="text-rose-400">{r.error}</td>
                    ) : (
                      <>
                        <td className="pr-3 font-mono tabular-nums text-slate-200">{inr(r.price)}</td>
                        <td className={`pr-3 font-mono tabular-nums ${(r.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(r.changePercent ?? 0) >= 0 ? '+' : ''}{r.changePercent?.toFixed(2)}
                        </td>
                        <td className="pr-3"><div className="flex items-center gap-2"><ScoreBar score={r.score ?? 0} compact /><span className="font-mono tabular-nums text-slate-200 w-10">{r.score?.toFixed(0)}</span></div></td>
                        <td className="pr-3 whitespace-nowrap text-slate-200">{r.verdict}</td>
                        <td className="pr-3 whitespace-nowrap text-slate-400">{r.regime} · {r.stage}</td>
                        <td className={`pr-3 whitespace-nowrap ${biasColor(r.candle?.bias)}`}>{r.candle ? `${r.candle.name}` : '—'}</td>
                        <td className="pr-3 whitespace-nowrap text-slate-400">{r.vsaBias === 'n/a' ? '—' : r.vsaBias?.replace(' in background', '')}</td>
                        <td className="pr-3 whitespace-nowrap text-slate-400">{r.relativeStrength?.replace(' than index', '').replace('in line with index', 'in line') ?? '—'}</td>
                        <td className={`pr-3 whitespace-nowrap font-semibold ${biasColor(r.plan?.direction)}`}>
                          {r.plan?.direction === 'none' ? 'no edge' : `${r.plan?.direction} · ${r.plan?.grade}`}
                        </td>
                        <td className="pr-3 font-mono tabular-nums text-slate-300">{r.plan?.rewardRiskT1 != null ? r.plan.rewardRiskT1.toFixed(1) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-3">{error}</div>}
      {!a && loading && <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Running analysis on {selectedSymbol}…</div>}

      {a && (
        <>
          {/* Verdict row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title={`${a.symbol} · ${a.quote.name}`} kicker={`${SOURCE_LABEL[a.dataSource]} · ${a.bars} bars · last ${new Date(a.quote.lastBarTime).toLocaleString('en-IN', { dateStyle: 'medium' })}`}>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono tabular-nums text-white">₹{inr(a.quote.price)}</span>
                <span className={`font-mono tabular-nums text-sm font-semibold ${a.quote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {a.quote.change >= 0 ? '+' : ''}{inr(a.quote.change)} ({a.quote.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-slate-400">Confluence score</span>
                  <span className={`font-mono font-bold ${a.confluence.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {a.confluence.score > 0 ? '+' : ''}{a.confluence.score.toFixed(1)}
                  </span>
                </div>
                <ScoreBar score={a.confluence.score} />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>-100 bearish</span><span>+100 bullish</span></div>
                <div className="mt-3 text-base font-bold text-white">{a.confluence.verdict}</div>
                <div className="text-xs text-slate-400">
                  {a.confluence.bullishFactors} bullish vs {a.confluence.bearishFactors} bearish factors · {a.confluence.agreementPct}% agreement
                </div>
              </div>
              {a.dataSource === 'synthetic' && (
                <div className="mt-3 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                  Yahoo Finance was unreachable, so this is synthetic demo data. Connect to the internet, or drop a CSV in backend/data_import.
                </div>
              )}
            </Card>

            <Card title={a.regime.title} kicker="Regime & tool kit (NSE TA 4.4)">
              <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">ADX {a.regime.adx?.toFixed(1) ?? '—'} · {a.regime.trendStrength}</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">RSI zones {a.regime.rsiZones.oversold}/{a.regime.rsiZones.overbought}</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {a.regime.toolkit.map((t) => <li key={t} className="flex gap-2"><span className="text-emerald-500">›</span>{t}</li>)}
              </ul>
            </Card>

            <Card title={`Stage: ${a.stage.stage}`} kicker="Dow theory & market structure">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(['primary', 'secondary', 'minor'] as const).map((k) => (
                  <div key={k} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-slate-500 uppercase">{k}</div>
                    <div className={`text-sm font-bold ${biasColor(a.dow[k])}`}>{a.dow[k]}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">{a.stage.explanation}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {a.structure.labels.map((l) => (
                  <span key={l.time + l.label} className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 ${l.label.startsWith('H') && l.label !== 'LH' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {l.label} {inr(l.price, 0)}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <AnalysisChart analysis={a} />

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* Trade plan */}
            <Card className="xl:col-span-2" title={plan?.direction === 'none' ? 'No trade' : `Trade plan: ${plan?.direction.toUpperCase()} · grade ${plan?.grade}`}
              kicker="Risk-sized plan (Rayner Teo + Varsity)"
              right={plan && plan.direction !== 'none' ? (
                <button onClick={() => onLogPlan(a)} className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-bold hover:bg-emerald-400">
                  Log to Playbook
                </button>
              ) : undefined}>
              {plan && plan.direction !== 'none' ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: 'Entry', v: plan.entry, c: 'text-white' },
                      { l: 'Stop', v: plan.stop, c: 'text-rose-400' },
                      { l: 'Risk / share', v: plan.riskPerShare, c: 'text-slate-200' },
                      { l: 'Target 1', v: plan.targets?.[0], c: 'text-emerald-400' },
                      { l: 'Target 2', v: plan.targets?.[1], c: 'text-emerald-400' },
                      { l: 'R:R to T1', v: plan.rewardRiskT1, c: (plan.rewardRiskT1 ?? 0) >= 1.5 ? 'text-emerald-400' : 'text-amber-400' },
                    ].map((m) => (
                      <div key={m.l} className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 uppercase">{m.l}</div>
                        <div className={`font-mono tabular-nums font-bold ${m.c}`}>{inr(m.v)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-slate-400 leading-relaxed">
                    <div><span className="text-slate-300 font-semibold">Entry trigger:</span> {plan.entryTrigger}</div>
                    <div>
                      <span className="text-slate-300 font-semibold">Stop logic:</span> structure stop {inr(plan.structureStop)} (zone ± 1 ATR) vs
                      volatility stop {inr(plan.volatilityStop)} (1-SD move over {holdingDays} days). The wider one is used, capped at 3 ATR, and kept off round numbers.
                    </div>
                    <div>
                      <span className="text-slate-300 font-semibold">Size:</span> risk ₹{inr(plan.riskAmount, 0)} ({riskPercent}% of ₹{inr(userCapital, 0)}) → {plan.quantity} qty
                      {plan.lots != null && ` · ${plan.lots} lot(s) of ${plan.lotSize}`} · notional ₹{inr(plan.notional, 0)}
                    </div>
                    {plan.lotNote && <div className="text-amber-300 mt-1">{plan.lotNote}</div>}
                    {plan.skip && <div className="text-amber-300 mt-1">Reward:risk is below 1.5 to the first target. Skip this trade or wait for a better entry.</div>}
                    <div className="mt-1"><span className="text-slate-300 font-semibold">Exit when right:</span> {plan.trailing}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5">
                      Master the Markets checklist · {plan.checklistPassed} passed / {plan.checklistFailed} failed
                    </div>
                    <ul className="space-y-1">
                      {plan.checklist.map((c) => (
                        <li key={c.item} className="flex gap-2 items-start"><Pass v={c.pass} /><span className="text-slate-300">{c.item}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">{plan?.reason}</p>
              )}
            </Card>

            {/* Confluence factors */}
            <Card className="xl:col-span-3" title="Why: confluence factors" kicker="Each factor is weighted and scored from -1 to +1"
              right={<button onClick={() => setShowAllFactors((s) => !s)} className="text-[11px] text-slate-400 hover:text-white">{showAllFactors ? 'Top 8' : `All ${factors.length}`}</button>}>
              <div className="space-y-2">
                {(showAllFactors ? factors : factors.slice(0, 8)).map((f) => (
                  <div key={f.factor} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-4">
                      <div className="text-slate-200 font-semibold">{f.factor}</div>
                      <div className="text-[10px] text-slate-500">{f.group} · weight {f.weight}</div>
                    </div>
                    <div className="col-span-2"><ScoreBar score={f.score * 100} compact /></div>
                    <div className="col-span-6">
                      <div className="text-slate-300 font-mono text-[11px]">{f.value}</div>
                      <div className="text-[10px] text-slate-500">{f.reading}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Setups */}
            <Card title="Named setups" kicker="Strategy formulas from the books">
              <ul className="space-y-2.5">
                {a.setups.map((s) => (
                  <li key={s.name} className={`text-xs ${s.active ? '' : 'opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.active ? (s.bias === 'bullish' ? 'bg-emerald-400' : s.bias === 'bearish' ? 'bg-rose-400' : 'bg-slate-400') : 'bg-slate-700'}`} />
                      <span className="font-semibold text-slate-200">{s.name}</span>
                      <span className={`ml-auto ${biasColor(s.bias)}`}>{s.bias}</span>
                    </div>
                    <div className="text-slate-400 pl-3.5">{s.detail}</div>
                    <div className="text-[10px] text-slate-600 pl-3.5">{s.source}</div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Price action */}
            <Card title="Price action" kicker="Candles · patterns · gaps · levels">
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Recent candlestick patterns</div>
                  {a.candlesticks.length === 0 && <div className="text-slate-500">None in the last 30 bars.</div>}
                  <ul className="space-y-1">
                    {[...a.candlesticks].reverse().slice(0, 6).map((c) => (
                      <li key={c.time + c.name} title={c.description} className="flex items-center gap-2">
                        <span className={biasColor(c.bias)}>{c.bias === 'bullish' ? '▲' : '▼'}</span>
                        <span className="text-slate-200">{c.name}</span>
                        <span className="text-slate-500">{c.barsAgo === 0 ? 'today' : `${c.barsAgo} bars ago`}</span>
                        <span className="ml-auto font-mono text-slate-400">score {c.score}{c.confirmed ? ' ✓' : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {(a.chartPatterns.length > 0 || a.buildup) && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Chart patterns</div>
                    {a.chartPatterns.map((p) => (
                      <div key={p.name} className="mb-1">
                        <span className={`font-semibold ${biasColor(p.bias)}`}>{p.name}</span>
                        <span className="text-slate-400"> · {p.status} · neckline {inr(p.neckline)} · target {inr(p.target)}</span>
                      </div>
                    ))}
                    {a.buildup && (
                      <div><span className={`font-semibold ${biasColor(a.buildup.bias)}`}>Build-up</span>
                        <span className="text-slate-400"> {inr(a.buildup.boxLow)}–{inr(a.buildup.boxHigh)} · {a.buildup.trigger}</span></div>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Nearest levels</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Support</span>
                    <span className="font-mono text-emerald-400">{a.nearestSupport ? `${inr(a.nearestSupport.low)}–${inr(a.nearestSupport.high)} (×${a.nearestSupport.touches})` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resistance</span>
                    <span className="font-mono text-rose-400">{a.nearestResistance ? `${inr(a.nearestResistance.low)}–${inr(a.nearestResistance.high)} (×${a.nearestResistance.touches})` : 'none overhead'}</span>
                  </div>
                </div>
                {a.fibonacci && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Fibonacci of last swing ({a.fibonacci.direction})</div>
                    <div className="grid grid-cols-5 gap-1 font-mono text-[10px]">
                      {Object.entries(a.fibonacci.levels).map(([k, v]) => (
                        <div key={k} className="bg-slate-950 rounded p-1 text-center"><div className="text-slate-500">{(Number(k) * 100).toFixed(1)}%</div><div className="text-slate-200">{inr(v, 0)}</div></div>
                      ))}
                    </div>
                  </div>
                )}
                {a.gaps.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Gaps (gap theory)</div>
                    {a.gaps.slice(-3).map((g) => (
                      <div key={g.time} className="text-slate-400">
                        <span className={g.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{g.direction === 'up' ? '↑' : '↓'} {g.kind}</span>
                        {' '}{inr(g.from)}→{inr(g.to)} · {g.filled ? 'filled' : 'open'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* VSA */}
            <Card title="Volume Spread Analysis" kicker="Tom Williams · Master the Markets">
              {!a.vsa.available ? (
                <p className="text-xs text-slate-400">{a.vsa.note}</p>
              ) : (
                <div className="text-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>Weakness {a.vsa.weaknessScore}</span><span>Strength {a.vsa.strengthScore}</span></div>
                      <ScoreBar score={Math.max(-100, Math.min(100, (a.vsa.strengthScore - a.vsa.weaknessScore) * 25))} />
                    </div>
                  </div>
                  <div className="font-semibold text-slate-200 capitalize">{a.vsa.bias}</div>
                  <ul className="space-y-1.5">
                    {[...a.vsa.signals].reverse().slice(0, 7).map((s) => (
                      <li key={s.time + s.name} title={s.description}>
                        <span className={s.kind === 'strength' ? 'text-cyan-400' : 'text-amber-400'}>●</span>{' '}
                        <span className="text-slate-200">{s.name}</span>
                        <span className="text-slate-500"> · {s.barsAgo === 0 ? 'today' : `${s.barsAgo}b ago`} · vol {s.volumeRatio}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {a.relativeStrength?.available && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Relative strength vs {a.parentIndex} (20 bars)</div>
                  <div className="font-semibold text-slate-200 capitalize">{a.relativeStrength.verdict}</div>
                  <div className="text-slate-400">
                    {a.symbol} {a.relativeStrength.stockReturnPct}% vs index {a.relativeStrength.parentReturnPct}%. {a.relativeStrength.note}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Volatility & options */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Volatility & expected ranges" kicker="Varsity ch.16–17 · normal distribution">
              <div className="grid grid-cols-4 gap-2 text-xs mb-4">
                {[
                  { l: 'HV 10d', v: a.volatility.hv10 },
                  { l: 'HV 20d', v: a.volatility.hv20 },
                  { l: 'HV 60d', v: a.volatility.hv60 },
                ].map((m) => (
                  <div key={m.l} className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500 uppercase">{m.l}</div>
                    <div className="font-mono font-bold text-slate-200">{m.v != null ? (m.v * 100).toFixed(1) + '%' : '—'}</div>
                  </div>
                ))}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] text-slate-500 uppercase">HV rank 1y</div>
                  <div className="font-mono font-bold text-slate-200">{a.volatility.hvRank ?? '—'}</div>
                </div>
              </div>
              <table className="w-full text-xs mb-3">
                <thead className="text-[10px] text-slate-500 uppercase">
                  <tr className="border-b border-slate-800"><th className="text-left py-1.5">Horizon</th><th className="text-right">68% range (1 SD)</th><th className="text-right">95% range (2 SD)</th></tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {Object.entries(a.volatility.expected.ranges).map(([k, r]) => (
                    <tr key={k} className="border-b border-slate-800/60">
                      <td className="py-1.5 text-slate-300 font-sans">{k}</td>
                      <td className="text-right text-slate-200">{inr(r.sd1[0], 0)} – {inr(r.sd1[1], 0)}</td>
                      <td className="text-right text-slate-400">{inr(r.sd2[0], 0)} – {inr(r.sd2[1], 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {a.volatility.cone.length > 0 && (
                <>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Volatility cone (current HV vs its 1-year range)</div>
                  <div className="space-y-1.5">
                    {a.volatility.cone.map((c) => {
                      const span = c.max - c.min || 1;
                      return (
                        <div key={c.window} className="grid grid-cols-12 items-center gap-2 text-[11px]">
                          <span className="col-span-2 text-slate-400">{c.window}d</span>
                          <div className="col-span-7 relative h-2 bg-slate-800 rounded-full" title={`min ${c.min}% · median ${c.median}% · max ${c.max}%`}>
                            <div className="absolute top-0 bottom-0 w-px bg-slate-500" style={{ left: `${((c.median - c.min) / span) * 100}%` }} />
                            <div className="absolute -top-0.5 w-3 h-3 rounded-full bg-violet-400 border-2 border-slate-900" style={{ left: `calc(${((c.current - c.min) / span) * 100}% - 6px)` }} />
                          </div>
                          <span className="col-span-3 text-right font-mono text-slate-300">{c.current}% · p{c.percentile}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>

            <Card title={`Options: ${a.options.view} view · ${a.options.volRegime} volatility`} kicker="NSE 22-strategy menu · SD strike selection">
              <div className="text-xs space-y-3">
                <div className="text-slate-400">
                  Next expiry <span className="text-slate-200 font-mono">{a.options.expiry.date}</span> ({a.options.expiry.kind}, {a.options.expiry.daysToExpiry} days) ·
                  σ used {a.options.sigmaUsedPct}% · ATM {inr(a.options.atmStrike, 0)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-500 uppercase">Call to write (+{a.options.sdMultiple} SD)</div>
                    <div className="font-mono font-bold text-rose-300">{inr(a.options.sdStrikes.callToWrite.strike, 0)} CE</div>
                    <div className="text-slate-400 font-mono text-[11px]">≈₹{a.options.sdStrikes.callToWrite.price} · Δ {a.options.sdStrikes.callToWrite.delta} · P(ITM) {((a.options.sdStrikes.callToWrite.probITM ?? 0) * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-500 uppercase">Put to write (−{a.options.sdMultiple} SD)</div>
                    <div className="font-mono font-bold text-emerald-300">{inr(a.options.sdStrikes.putToWrite.strike, 0)} PE</div>
                    <div className="text-slate-400 font-mono text-[11px]">≈₹{a.options.sdStrikes.putToWrite.price} · Δ {a.options.sdStrikes.putToWrite.delta} · P(ITM) {((a.options.sdStrikes.putToWrite.probITM ?? 0) * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5">Suggested strategies</div>
                  <div className="space-y-1.5">
                    {a.options.strategies.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <div className="flex-1">
                          <div className="text-slate-200 font-semibold">{s.name}</div>
                          <div className="text-[10px] text-slate-500">{s.legs} · risk {s.risk}</div>
                        </div>
                        <button onClick={() => onOpenStrategy(s.id, a.symbol)}
                          className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/10 whitespace-nowrap">
                          Open payoff →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <ul className="text-[11px] text-slate-500 space-y-0.5">
                  {a.options.notes.map((n) => <li key={n}>• {n}</li>)}
                </ul>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
