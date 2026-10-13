import React, { useMemo, useState } from 'react';
import { Analysis } from '../api/stockopsApi';

interface Props {
  analysis: Analysis;
  showBands?: boolean;
}

/**
 * Real-data price chart: candles + EMA20/SMA50/SMA200 + Bollinger, S/R zones,
 * trade-plan levels, candlestick / VSA markers, with RSI (regime zones) and MACD panels.
 * Three stacked panels share the x-axis; each has its own single y-axis.
 */
export const AnalysisChart: React.FC<Props> = ({ analysis, showBands = true }) => {
  const bars = analysis.chart;
  const [hover, setHover] = useState<number | null>(null);
  const [layers, setLayers] = useState({ ma: true, bb: showBands, zones: true, plan: true, marks: true });

  const W = 960;
  const PRICE_H = 320;
  const RSI_H = 80;
  const MACD_H = 80;
  const GAP = 14;
  const PAD_L = 8;
  const PAD_R = 96;
  const H = PRICE_H + RSI_H + MACD_H + GAP * 2 + 18;
  const n = bars.length;
  const slot = (W - PAD_L - PAD_R) / Math.max(1, n);
  const bw = Math.max(2, slot * 0.62);
  const x = (i: number) => PAD_L + i * slot + slot / 2;

  const plan = analysis.tradePlan;
  const { lo, hi } = useMemo(() => {
    const vals: number[] = [];
    bars.forEach((b) => vals.push(b.high, b.low));
    const minP = Math.min(...vals);
    const maxP = Math.max(...vals);
    const extra: number[] = [];
    if (plan.direction !== 'none' && plan.stop && plan.targets) extra.push(plan.stop, plan.targets[0]);
    const span = maxP - minP;
    const within = extra.filter((v) => v > minP - span * 0.25 && v < maxP + span * 0.25);
    return { lo: Math.min(minP, ...within) - span * 0.03, hi: Math.max(maxP, ...within) + span * 0.03 };
  }, [bars, plan]);
  const y = (p: number) => 8 + ((hi - p) / (hi - lo || 1)) * (PRICE_H - 16);

  const rsiTop = PRICE_H + GAP;
  const yr = (v: number) => rsiTop + ((100 - v) / 100) * RSI_H;
  const macdTop = rsiTop + RSI_H + GAP;
  const macdMax = Math.max(1e-9, ...bars.map((b) => Math.max(Math.abs(b.macd ?? 0), Math.abs(b.macdSignal ?? 0), Math.abs(b.macdHist ?? 0))));
  const ym = (v: number) => macdTop + MACD_H / 2 - (v / macdMax) * (MACD_H / 2 - 4);

  const line = (key: 'ema20' | 'sma50' | 'sma200' | 'bbUpper' | 'bbLower') => {
    let d = '';
    bars.forEach((b, i) => {
      const v = b[key];
      if (v == null) return;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };
  const rsiPath = bars.reduce((d, b, i) => (b.rsi == null ? d : d + `${d ? 'L' : 'M'}${x(i).toFixed(1)},${yr(b.rsi).toFixed(1)}`), '');
  const macdPath = bars.reduce((d, b, i) => (b.macd == null ? d : d + `${d ? 'L' : 'M'}${x(i).toFixed(1)},${ym(b.macd).toFixed(1)}`), '');
  const sigPath = bars.reduce((d, b, i) => (b.macdSignal == null ? d : d + `${d ? 'L' : 'M'}${x(i).toFixed(1)},${ym(b.macdSignal).toFixed(1)}`), '');

  // map signal timestamps to bar index
  const idxByTime = useMemo(() => new Map(bars.map((b, i) => [b.time, i])), [bars]);
  const candleMarks = analysis.candlesticks.filter((c) => idxByTime.has(c.time));
  const vsaMarks = analysis.vsa.available ? analysis.vsa.signals.filter((s) => idxByTime.has(s.time)) : [];

  const ticks = 5;
  const priceTicks = Array.from({ length: ticks }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / ticks);
  const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: v > 1000 ? 0 : 2 });

  const hb = hover != null ? bars[hover] : bars[n - 1];
  const hoverCandles = hover != null ? candleMarks.filter((c) => idxByTime.get(c.time) === hover) : [];
  const hoverVsa = hover != null ? vsaMarks.filter((s) => idxByTime.get(s.time) === hover) : [];
  const { rsiZones } = analysis.regime;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - PAD_L) / slot);
    setHover(i >= 0 && i < n ? i : null);
  };

  const Toggle = ({ k, label, swatch }: { k: keyof typeof layers; label: string; swatch: React.ReactNode }) => (
    <button
      onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
      className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-semibold transition-colors ${
        layers[k] ? 'border-slate-600 text-slate-200 bg-slate-800' : 'border-slate-800 text-slate-500'
      }`}
    >
      {swatch}
      {label}
    </button>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <Toggle k="ma" label="EMA20 · SMA50 · SMA200" swatch={<span className="flex gap-0.5"><i className="w-3 h-0.5 bg-amber-400 inline-block" /><i className="w-3 h-0.5 bg-sky-400 inline-block" /><i className="w-3 h-0.5 bg-fuchsia-400 inline-block" /></span>} />
          <Toggle k="bb" label="Bollinger" swatch={<i className="w-3 h-0.5 bg-slate-400 inline-block" />} />
          <Toggle k="zones" label="S/R zones" swatch={<i className="w-3 h-2 bg-slate-600/60 inline-block rounded-sm" />} />
          <Toggle k="plan" label="Trade plan" swatch={<i className="w-3 h-0.5 bg-emerald-400 inline-block" />} />
          <Toggle k="marks" label="Candle & VSA marks" swatch={<i className="w-2 h-2 bg-cyan-400 inline-block rounded-full" />} />
        </div>
        <div className="font-mono text-[11px] text-slate-400 tabular-nums">
          {new Date(hb.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: analysis.interval === '1D' || analysis.interval === '1W' ? undefined : 'short' })}
          {'  '}O <span className="text-slate-200">{fmt(hb.open)}</span> H <span className="text-slate-200">{fmt(hb.high)}</span> L{' '}
          <span className="text-slate-200">{fmt(hb.low)}</span> C <span className="text-slate-200">{fmt(hb.close)}</span>
          {hb.rsi != null && <> · RSI <span className="text-slate-200">{hb.rsi.toFixed(1)}</span></>}
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
          aria-label={`${analysis.symbol} price chart with indicators`}>
          {/* grid + price axis */}
          {priceTicks.map((p) => (
            <g key={p}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(p)} y2={y(p)} stroke="#1e293b" strokeWidth={1} />
              <text x={W - PAD_R + 6} y={y(p) + 3} fill="#64748b" fontSize={10} fontFamily="JetBrains Mono, monospace">{fmt(p)}</text>
            </g>
          ))}

          {/* S/R zones */}
          {layers.zones &&
            analysis.zones
              .filter((z) => z.high >= lo && z.low <= hi)
              .map((z) => (
                <g key={z.mid}>
                  <rect x={PAD_L} width={W - PAD_L - PAD_R} y={y(Math.min(z.high, hi))} height={Math.max(2, y(Math.max(z.low, lo)) - y(Math.min(z.high, hi)))}
                    fill={z.type === 'support' ? '#10b981' : '#f43f5e'} opacity={0.07 + Math.min(0.1, z.strength * 0.015)} />
                  <text x={PAD_L + 4} y={y(z.mid) + 3} fill="#64748b" fontSize={9}>{z.type === 'support' ? 'S' : 'R'} ×{z.touches}</text>
                </g>
              ))}

          {/* Bollinger + MAs */}
          {layers.bb && (
            <>
              <path d={line('bbUpper')} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <path d={line('bbLower')} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            </>
          )}
          {layers.ma && (
            <>
              <path d={line('sma200')} fill="none" stroke="#e879f9" strokeWidth={1.5} />
              <path d={line('sma50')} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
              <path d={line('ema20')} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
            </>
          )}

          {/* candles */}
          {bars.map((b, i) => {
            const up = b.close >= b.open;
            const col = up ? '#34d399' : '#fb7185';
            const top = y(Math.max(b.open, b.close));
            const h = Math.max(1, y(Math.min(b.open, b.close)) - top);
            return (
              <g key={b.time} opacity={hover == null || hover === i ? 1 : 0.75}>
                <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={col} strokeWidth={1} />
                <rect x={x(i) - bw / 2} y={top} width={bw} height={h} fill={up ? '#0f172a' : col} stroke={col} strokeWidth={1} rx={1} />
              </g>
            );
          })}

          {/* trade plan levels */}
          {layers.plan && plan.direction !== 'none' && plan.entry && plan.stop && plan.targets && (
            <g fontSize={10} fontFamily="JetBrains Mono, monospace">
              {[
                { v: plan.entry, c: '#e2e8f0', l: 'Entry' },
                { v: plan.stop, c: '#fb7185', l: 'Stop' },
                { v: plan.targets[0], c: '#34d399', l: 'T1' },
                { v: plan.targets[1], c: '#34d399', l: 'T2' },
              ]
                .filter((lv) => lv.v >= lo && lv.v <= hi)
                .sort((p1, p2) => y(p1.v) - y(p2.v))
                .reduce<{ v: number; c: string; l: string; ty: number }[]>((acc, lv) => {
                  // push price tags apart so they never overlap (16px minimum)
                  const ty = acc.length ? Math.max(y(lv.v), acc[acc.length - 1].ty + 16) : y(lv.v);
                  return [...acc, { ...lv, ty }];
                }, [])
                .map((lv) => (
                  <g key={lv.l}>
                    <line x1={x(Math.max(0, n - 25))} x2={W - PAD_R} y1={y(lv.v)} y2={y(lv.v)} stroke={lv.c} strokeWidth={1.25} strokeDasharray={lv.l === 'Entry' ? undefined : '5 3'} />
                    <line x1={W - PAD_R} x2={W - PAD_R + 3} y1={y(lv.v)} y2={lv.ty} stroke={lv.c} strokeWidth={1} />
                    <rect x={W - PAD_R + 3} y={lv.ty - 7} width={PAD_R - 5} height={14} rx={3} fill="#020617" stroke={lv.c} strokeWidth={1} />
                    <text x={W - PAD_R + 7} y={lv.ty + 3.5} fill={lv.c}>{lv.l} {fmt(lv.v)}</text>
                  </g>
                ))}
            </g>
          )}

          {/* candlestick + VSA markers */}
          {layers.marks &&
            candleMarks.map((c) => {
              const i = idxByTime.get(c.time)!;
              const b = bars[i];
              const bull = c.bias === 'bullish';
              const yy = bull ? y(b.low) + 10 : y(b.high) - 10;
              const pts = bull ? `${x(i)},${yy - 5} ${x(i) - 5},${yy + 4} ${x(i) + 5},${yy + 4}` : `${x(i)},${yy + 5} ${x(i) - 5},${yy - 4} ${x(i) + 5},${yy - 4}`;
              return <polygon key={c.time + c.name} points={pts} fill={bull ? '#34d399' : '#fb7185'} stroke="#0f172a" strokeWidth={1.5} />;
            })}
          {layers.marks &&
            vsaMarks.map((s) => {
              const i = idxByTime.get(s.time)!;
              return <circle key={s.time + s.name} cx={x(i)} cy={PRICE_H - 4} r={4} fill={s.kind === 'strength' ? '#22d3ee' : '#f59e0b'} stroke="#0f172a" strokeWidth={1.5} />;
            })}

          {/* RSI panel */}
          <text x={PAD_L} y={rsiTop - 3} fill="#64748b" fontSize={10}>RSI 14 · {analysis.regime.current} zones {rsiZones.oversold}/{rsiZones.overbought}</text>
          <rect x={PAD_L} y={yr(rsiZones.overbought)} width={W - PAD_L - PAD_R} height={yr(rsiZones.oversold) - yr(rsiZones.overbought)} fill="#334155" opacity={0.25} />
          {[rsiZones.oversold, rsiZones.overbought].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yr(v)} y2={yr(v)} stroke="#475569" strokeDasharray="2 3" />
              <text x={W - PAD_R + 6} y={yr(v) + 3} fill="#64748b" fontSize={10} fontFamily="JetBrains Mono, monospace">{v}</text>
            </g>
          ))}
          <path d={rsiPath} fill="none" stroke="#a78bfa" strokeWidth={1.5} />

          {/* MACD panel */}
          <text x={PAD_L} y={macdTop - 3} fill="#64748b" fontSize={10}>MACD 12/26/9</text>
          <line x1={PAD_L} x2={W - PAD_R} y1={ym(0)} y2={ym(0)} stroke="#334155" />
          {bars.map((b, i) =>
            b.macdHist == null ? null : (
              <rect key={b.time} x={x(i) - bw / 2} width={bw} y={Math.min(ym(0), ym(b.macdHist))} height={Math.max(1, Math.abs(ym(b.macdHist) - ym(0)))}
                fill={b.macdHist >= 0 ? '#34d399' : '#fb7185'} opacity={0.55} />
            ),
          )}
          <path d={macdPath} fill="none" stroke="#38bdf8" strokeWidth={1.25} />
          <path d={sigPath} fill="none" stroke="#fbbf24" strokeWidth={1.25} />

          {/* crosshair */}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H - 18} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          )}
          {/* x labels */}
          {bars.map((b, i) =>
            i % Math.ceil(n / 8) === 0 ? (
              <text key={b.time} x={x(i)} y={H - 4} fill="#64748b" fontSize={10} textAnchor="middle">
                {new Date(b.time).toLocaleDateString('en-IN', analysis.interval === '1D' || analysis.interval === '1W' ? { month: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' })}
              </text>
            ) : null,
          )}
        </svg>

        {hover != null && (hoverCandles.length > 0 || hoverVsa.length > 0) && (
          <div className="absolute top-10 left-3 max-w-xs bg-slate-950/95 border border-slate-700 rounded-lg p-2.5 text-[11px] shadow-xl pointer-events-none space-y-1.5">
            {hoverCandles.map((c) => (
              <div key={c.name}>
                <span className={`font-bold ${c.bias === 'bullish' ? 'text-emerald-400' : 'text-rose-400'}`}>{c.bias === 'bullish' ? '▲' : '▼'} {c.name}</span>
                <span className="text-slate-400"> · score {c.score}{c.confirmed ? ' · confirmed' : ''}</span>
              </div>
            ))}
            {hoverVsa.map((s) => (
              <div key={s.name}>
                <span className={`font-bold ${s.kind === 'strength' ? 'text-cyan-400' : 'text-amber-400'}`}>● VSA {s.name}</span>
                <span className="text-slate-400"> · vol {s.volumeRatio}× · spread {s.spreadRatio}×</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-400">
        <span><span className="text-emerald-400">▲</span>/<span className="text-rose-400">▼</span> candlestick pattern</span>
        <span><span className="text-cyan-400">●</span> VSA strength · <span className="text-amber-400">●</span> VSA weakness</span>
        <span>Shaded bands = support (green) / resistance (red) zones, darker = more touches</span>
      </div>
    </div>
  );
};
