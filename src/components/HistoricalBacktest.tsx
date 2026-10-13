import React, { useMemo, useState } from 'react';
import { StockQuote } from '../types/market';
import { BacktestResult, CompareRow, SOURCE_LABEL, api } from '../api/stockopsApi';

interface Props {
  instruments: StockQuote[];
  selectedSymbol: string;
  onSelectSymbol: (s: string) => void;
  userCapital: number;
}

const STRATS = [
  { id: 'golden-cross', name: 'Golden Cross (50/200)' },
  { id: 'ema-5-8-13', name: '5/8/13 EMA ribbon' },
  { id: 'adx-trend', name: 'Simple ADX > 25' },
  { id: 'macd-cross', name: 'MACD crossover' },
  { id: 'rsi-regime', name: 'RSI 40/70 regime pullback' },
  { id: 'bollinger-reversion', name: 'Bollinger mean reversion' },
  { id: 'donchian-breakout', name: '20-bar breakout' },
  { id: 'elder-impulse', name: 'Elder impulse' },
  { id: 'candle-reversal', name: 'Candlestick reversal (MAEE)' },
  { id: 'vsa-strength', name: 'VSA test / no supply' },
];

const pct = (v?: number | null, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);
const num = (v?: number | null, d = 2) => (v == null ? '—' : v.toFixed(d));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EquityChart: React.FC<{ r: BacktestResult }> = ({ r }) => {
  const [hover, setHover] = useState<number | null>(null);
  const pts = r.equityCurve;
  const W = 900, H = 220, DD_H = 70, PL = 8, PR = 70;
  const vals = pts.flatMap((p) => [p.equity, p.benchmark]);
  const lo = Math.min(...vals) * 0.98, hi = Math.max(...vals) * 1.02;
  const x = (i: number) => PL + (i / Math.max(1, pts.length - 1)) * (W - PL - PR);
  const y = (v: number) => 6 + ((hi - v) / (hi - lo || 1)) * (H - 12);
  const ddMin = Math.min(-1, ...pts.map((p) => p.drawdownPct));
  const yd = (v: number) => H + 18 + (v / ddMin) * DD_H;
  const path = (k: 'equity' | 'benchmark') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const ddPath = `M${x(0)},${yd(0)}` + pts.map((p, i) => `L${x(i).toFixed(1)},${yd(p.drawdownPct).toFixed(1)}`).join('') + `L${x(pts.length - 1)},${yd(0)}Z`;
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * (k + 0.5)) / 4);
  const hp = hover != null ? pts[hover] : pts[pts.length - 1];
  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] mb-2">
        <span className="flex items-center gap-1.5 text-slate-300"><i className="w-4 h-0.5 bg-emerald-400 inline-block" /> Strategy</span>
        <span className="flex items-center gap-1.5 text-slate-300"><i className="w-4 border-t border-dashed border-slate-400 inline-block" /> Buy &amp; hold</span>
        <span className="ml-auto font-mono text-slate-400 tabular-nums">
          {new Date(hp.time).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · strategy <span className="text-slate-200">{fmt(hp.equity)}</span> · B&amp;H{' '}
          <span className="text-slate-200">{fmt(hp.benchmark)}</span> · DD <span className="text-slate-200">{hp.drawdownPct.toFixed(1)}%</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + DD_H + 36}`} className="w-full h-auto" role="img" aria-label="Equity curve versus buy and hold, with drawdown panel"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PL) / (W - PL - PR)) * (pts.length - 1));
          setHover(i >= 0 && i < pts.length ? i : null);
        }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#1e293b" />
            <text x={W - PR + 6} y={y(t) + 3} fill="#64748b" fontSize={10} fontFamily="JetBrains Mono, monospace">{(t / 1000).toFixed(0)}k</text>
          </g>
        ))}
        <path d={path('benchmark')} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={path('equity')} fill="none" stroke="#34d399" strokeWidth={2} />
        <text x={PL} y={H + 12} fill="#64748b" fontSize={10}>Strategy drawdown</text>
        <path d={ddPath} fill="#fb7185" opacity={0.35} />
        <line x1={PL} x2={W - PR} y1={yd(0)} y2={yd(0)} stroke="#334155" />
        <text x={W - PR + 6} y={yd(ddMin) + 3} fill="#64748b" fontSize={10} fontFamily="JetBrains Mono, monospace">{ddMin.toFixed(0)}%</text>
        {hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H + DD_H + 20} stroke="#64748b" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hp.equity)} r={4} fill="#34d399" stroke="#0f172a" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(hp.benchmark)} r={4} fill="#94a3b8" stroke="#0f172a" strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  );
};

const MonthlyGrid: React.FC<{ rows: BacktestResult['monthly'] }> = ({ rows }) => {
  const years = Array.from(new Set(rows.map((r) => r.year))).sort();
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.returnPct)));
  const cell = (v?: number) => {
    if (v == null) return { background: 'transparent' };
    if (Math.abs(v) < 0.05) return { background: '#1e293b' }; // flat month (no position)
    const a = Math.min(1, Math.abs(v) / maxAbs);
    return { background: v >= 0 ? `rgba(52,211,153,${0.12 + a * 0.6})` : `rgba(251,113,133,${0.12 + a * 0.6})` };
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] font-mono tabular-nums border-separate" style={{ borderSpacing: 2 }}>
        <thead><tr><th className="text-slate-500 pr-2" />{MONTHS.map((m) => <th key={m} className="text-slate-500 font-semibold w-12">{m}</th>)}</tr></thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <td className="text-slate-400 pr-2">{y}</td>
              {MONTHS.map((_, mi) => {
                const r = rows.find((x) => x.year === y && x.month === mi + 1);
                return (
                  <td key={mi} style={cell(r?.returnPct)} className="text-center rounded py-1 text-slate-100" title={r ? `${MONTHS[mi]} ${y}: ${pct(r.returnPct, 2)}` : ''}>
                    {r ? (Math.abs(r.returnPct) < 0.05 ? '·' : r.returnPct.toFixed(1)) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const HistoricalBacktest: React.FC<Props> = ({ instruments, selectedSymbol, onSelectSymbol, userCapital }) => {
  const [strategy, setStrategy] = useState('golden-cross');
  const [interval, setInterval_] = useState('1D');
  const [capital, setCapital] = useState(userCapital);
  const [riskPct, setRiskPct] = useState(1);
  const [stopAtr, setStopAtr] = useState(2);
  const [trailAtr, setTrailAtr] = useState(3);
  const [targetR, setTargetR] = useState(0);
  const [costPct, setCostPct] = useState(0.1);
  const [sizing, setSizing] = useState<'risk' | 'full'>('risk');
  const [allowShort, setAllowShort] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [compare, setCompare] = useState<CompareRow[] | null>(null);
  const [busy, setBusy] = useState<'run' | 'compare' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opts = useMemo(() => ({
    interval, capital, risk_pct: riskPct, stop_atr: stopAtr, trail_atr: trailAtr, target_r: targetR || undefined,
    cost_pct: costPct, sizing, allow_short: allowShort,
  }), [interval, capital, riskPct, stopAtr, trailAtr, targetR, costPct, sizing, allowShort]);

  const run = async (sid = strategy) => {
    setBusy('run');
    setError(null);
    try {
      setResult(await api.backtest(selectedSymbol, { strategy: sid, ...opts }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const runCompare = async () => {
    setBusy('compare');
    setError(null);
    try {
      setCompare(await api.compare(selectedSymbol, opts));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const m = result?.metrics;
  const b = result?.benchmark;
  const field = 'bg-slate-950 border border-slate-700 text-white font-mono px-2 py-1 rounded w-16';

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Python engine · real price history</div>
            <h2 className="text-lg font-bold text-white tracking-tight">Historical Strategy Backtest</h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Signals on the close, fills on the next open, ATR stops checked intrabar, Indian trading costs, risk-based sizing, and an in-sample vs out-of-sample split to catch curve-fitting.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => run()} disabled={!!busy} className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50">
              {busy === 'run' ? 'Running…' : 'Run backtest'}
            </button>
            <button onClick={runCompare} disabled={!!busy} className="px-4 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/10 disabled:opacity-50">
              {busy === 'compare' ? 'Comparing…' : 'Compare all 10'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 pt-4 text-xs text-slate-400">
          <label className="flex flex-col gap-1">Instrument
            <select value={selectedSymbol} onChange={(e) => onSelectSymbol(e.target.value)} className="bg-slate-950 border border-slate-700 text-white font-semibold px-2 py-1 rounded">
              {instruments.map((i) => <option key={i.symbol}>{i.symbol}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Strategy
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="bg-slate-950 border border-slate-700 text-white font-semibold px-2 py-1 rounded">
              {STRATS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Timeframe
            <select value={interval} onChange={(e) => setInterval_(e.target.value)} className="bg-slate-950 border border-slate-700 text-white font-semibold px-2 py-1 rounded">
              <option value="1D">Daily (5y)</option><option value="1W">Weekly (10y)</option><option value="1h">1 hour (2y)</option>
              <option value="15m">15 min (60d)</option><option value="5m">5 min (60d)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">Capital ₹<input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} className={`${field} w-24`} /></label>
          <label className="flex flex-col gap-1">Sizing
            <select value={sizing} onChange={(e) => setSizing(e.target.value as 'risk' | 'full')} className="bg-slate-950 border border-slate-700 text-white font-semibold px-2 py-1 rounded">
              <option value="risk">Risk % per trade</option><option value="full">All-in (vs B&amp;H)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">Risk %<input type="number" step={0.25} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} className={field} disabled={sizing === 'full'} /></label>
          <label className="flex flex-col gap-1">Stop ATR×<input type="number" step={0.5} value={stopAtr} onChange={(e) => setStopAtr(Number(e.target.value))} className={field} /></label>
          <label className="flex flex-col gap-1">Trail ATR× <input type="number" step={0.5} value={trailAtr} onChange={(e) => setTrailAtr(Number(e.target.value))} className={field} title="0 = no trailing stop" /></label>
          <label className="flex flex-col gap-1">Target R<input type="number" step={0.5} value={targetR} onChange={(e) => setTargetR(Number(e.target.value))} className={field} title="0 = no fixed target" /></label>
          <label className="flex flex-col gap-1">Cost %/side<input type="number" step={0.01} value={costPct} onChange={(e) => setCostPct(Number(e.target.value))} className={field} /></label>
          <label className="flex items-center gap-1.5 pb-1"><input type="checkbox" checked={allowShort} onChange={(e) => setAllowShort(e.target.checked)} className="accent-emerald-500" /> Allow shorts (F&amp;O)</label>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-3">{error}</div>}

      {compare && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Strategy league table: {selectedSymbol}</h3>
            <span className="text-[11px] text-slate-500">Sorted by Sharpe · click a row to open it</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-slate-500 uppercase">
                <tr className="border-b border-slate-800">
                  {['Strategy', 'Source', 'CAGR', 'B&H CAGR', 'Sharpe', 'OOS Sharpe', 'Max DD', 'Win %', 'PF', 'Exp. R', 'Trades', 'Exposure'].map((h) => (
                    <th key={h} className="text-left py-2 pr-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {compare.map((r) => (
                  <tr key={r.strategy} onClick={() => { setStrategy(r.strategy); run(r.strategy); }}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer">
                    <td className="py-2 pr-3 font-sans font-semibold text-slate-200 whitespace-nowrap">{r.name}</td>
                    <td className="pr-3 font-sans text-slate-500 whitespace-nowrap">{r.source}</td>
                    {r.error ? <td colSpan={10} className="text-rose-400 font-sans">{r.error}</td> : (
                      <>
                        <td className={`pr-3 ${(r.cagrPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pct(r.cagrPct)}</td>
                        <td className="pr-3 text-slate-400">{pct(r.benchmarkCagrPct)}</td>
                        <td className="pr-3 text-slate-200">{num(r.sharpe)}</td>
                        <td className={`pr-3 ${r.oosSharpe != null && r.sharpe != null && r.oosSharpe < r.sharpe * 0.5 ? 'text-amber-400' : 'text-slate-300'}`}>{num(r.oosSharpe)}</td>
                        <td className="pr-3 text-rose-300">{pct(r.maxDrawdownPct)}</td>
                        <td className="pr-3 text-slate-300">{num(r.winRatePct, 0)}</td>
                        <td className="pr-3 text-slate-300">{num(r.profitFactor)}</td>
                        <td className="pr-3 text-slate-300">{num(r.expectancyR)}</td>
                        <td className={`pr-3 ${(r.trades ?? 0) < 15 ? 'text-amber-400' : 'text-slate-300'}`}>{r.trades}</td>
                        <td className="pr-3 text-slate-400">{num(r.exposurePct, 0)}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Amber = fewer than 15 trades, or out-of-sample Sharpe less than half of the full-period Sharpe. Treat those with suspicion.</p>
        </div>
      )}

      {result && m && b && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-white">{result.strategyInfo.name} on {result.symbol} · {result.interval}</h3>
              <span className="text-[11px] text-slate-500">
                {SOURCE_LABEL[result.dataSource]} · {new Date(result.from).toLocaleDateString('en-IN')} → {new Date(result.to).toLocaleDateString('en-IN')} · {result.bars} bars
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
              {[
                { l: 'CAGR', v: pct(m.cagrPct), s: `B&H ${pct(b.cagrPct)}`, good: m.cagrPct >= 0 },
                { l: 'Net profit', v: '₹' + Math.round(m.netProfit).toLocaleString('en-IN'), s: pct(m.totalReturnPct), good: m.netProfit >= 0 },
                { l: 'Sharpe', v: num(m.sharpe), s: `B&H ${num(b.sharpe)}`, good: m.sharpe >= 1 },
                { l: 'Max drawdown', v: pct(m.maxDrawdownPct), s: `B&H ${pct(b.maxDrawdownPct)}`, good: m.maxDrawdownPct > b.maxDrawdownPct },
                { l: 'Win rate', v: `${num(m.winRatePct, 1)}%`, s: `${m.trades} trades`, good: m.winRatePct >= 50 },
                { l: 'Profit factor', v: num(m.profitFactor), s: `avg win ₹${Math.round(m.avgWin)}`, good: (m.profitFactor ?? 0) >= 1.5 },
                { l: 'Expectancy', v: `${num(m.expectancyR)} R`, s: `${num(m.avgBarsHeld, 0)} bars avg`, good: m.expectancyR > 0 },
                { l: 'Exposure', v: `${num(m.exposurePct, 0)}%`, s: `Sortino ${num(m.sortino)}`, good: true },
              ].map((t) => (
                <div key={t.l} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-500 uppercase">{t.l}</div>
                  <div className={`font-mono font-bold tabular-nums ${t.good ? 'text-emerald-400' : 'text-rose-400'}`}>{t.v}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{t.s}</div>
                </div>
              ))}
            </div>
            <EquityChart r={result} />
            {result.notes.length > 0 && (
              <ul className="mt-3 text-[11px] text-amber-300 space-y-0.5">{result.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-1">Robustness: in-sample vs out-of-sample</h3>
              <p className="text-[11px] text-slate-500 mb-3">Split at {new Date(result.splitDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })} (70/30). A robust rule keeps working on the unseen 30%.</p>
              <table className="w-full text-xs font-mono tabular-nums">
                <thead className="text-[10px] text-slate-500 uppercase font-sans"><tr className="border-b border-slate-800"><th className="text-left py-1.5">Metric</th><th className="text-right">In-sample</th><th className="text-right">Out-of-sample</th></tr></thead>
                <tbody>
                  {([['CAGR', 'cagrPct', true], ['Sharpe', 'sharpe', false], ['Max DD', 'maxDrawdownPct', true], ['Win rate', 'winRatePct', true], ['Profit factor', 'profitFactor', false], ['Trades', 'trades', false]] as const).map(([l, k, isPct]) => {
                    const iv = (result.inSample as any)?.[k];
                    const ov = (result.outOfSample as any)?.[k];
                    return (
                      <tr key={k} className="border-b border-slate-800/60">
                        <td className="py-1.5 font-sans text-slate-400">{l}</td>
                        <td className="text-right text-slate-200">{isPct ? pct(iv) : num(iv, k === 'trades' ? 0 : 2)}</td>
                        <td className="text-right text-slate-200">{isPct ? pct(ov) : num(ov, k === 'trades' ? 0 : 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Monthly returns (%)</h3>
              {result.monthly.length ? <MonthlyGrid rows={result.monthly} /> : <p className="text-xs text-slate-500">Available for daily and weekly backtests.</p>}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Trade log (latest {Math.min(30, result.trades.length)} of {m.trades})</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs font-mono tabular-nums">
                <thead className="text-[10px] text-slate-500 uppercase font-sans sticky top-0 bg-slate-900">
                  <tr className="border-b border-slate-800">{['Entry', 'Exit', 'Side', 'Qty', 'Entry ₹', 'Exit ₹', 'P&L ₹', 'Return', 'R', 'Bars', 'Exit reason'].map((h) => <th key={h} className="text-left py-1.5 pr-3">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[...result.trades].reverse().slice(0, 30).map((t) => (
                    <tr key={t.entryTime} className="border-b border-slate-800/60">
                      <td className="py-1.5 pr-3 text-slate-400">{new Date(t.entryTime).toLocaleDateString('en-IN')}</td>
                      <td className="pr-3 text-slate-400">{new Date(t.exitTime).toLocaleDateString('en-IN')}</td>
                      <td className={`pr-3 font-sans ${t.side === 'long' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.side}</td>
                      <td className="pr-3 text-slate-300">{t.qty}</td>
                      <td className="pr-3 text-slate-300">{t.entry.toFixed(2)}</td>
                      <td className="pr-3 text-slate-300">{t.exit.toFixed(2)}</td>
                      <td className={`pr-3 ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.round(t.pnl).toLocaleString('en-IN')}</td>
                      <td className={`pr-3 ${t.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pct(t.returnPct, 2)}</td>
                      <td className="pr-3 text-slate-300">{t.r.toFixed(2)}</td>
                      <td className="pr-3 text-slate-400">{t.bars}</td>
                      <td className="pr-3 font-sans text-slate-500">{t.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
