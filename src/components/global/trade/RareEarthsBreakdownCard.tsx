import { useMemo, useState } from 'react';
import { Atom, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  RARE_EARTH_ELEMENTS, REE_CLASS_LABEL,
  type ReeClass, type ReeApplication, type RareEarthElement,
} from '@/data/rareEarthsBreakdown';
import { cn } from '@/lib/utils';

// ── View modes ─────────────────────────────────────────────────────────────────
type ViewMode = 'elements' | 'matrix' | 'supply';

// ── Application sector styles ──────────────────────────────────────────────────
const APP_STYLE: Record<ReeApplication, { label: string; cls: string }> = {
  magnets:       { label: 'Magnets',      cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30'    },
  'clean-energy':{ label: 'Clean Energy', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  defense:       { label: 'Defense',      cls: 'bg-red-500/15    text-red-400    border-red-500/30'     },
  catalysts:     { label: 'Catalysts',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30'  },
  phosphors:     { label: 'Phosphors',    cls: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30'  },
  electronics:   { label: 'Electronics',  cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30'  },
  medical:       { label: 'Medical',      cls: 'bg-rose-500/15   text-rose-400   border-rose-500/30'    },
  industrial:    { label: 'Industrial',   cls: 'bg-slate-500/15  text-slate-400  border-slate-500/30'   },
};

// ── REE class colours (shared across all sub-views) ────────────────────────────
const CLASS_STYLE: Record<ReeClass, { text: string; bg: string; border: string; svgColor: string }> = {
  light: { text: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  svgColor: '#f59e0b' },
  heavy: { text: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    svgColor: '#ef4444' },
  other: { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', svgColor: '#8b5cf6' },
};

const SUBST_STYLE = {
  none:      { label: 'No substitute',  cls: 'bg-red-500/15    text-red-400' },
  difficult: { label: 'Hard to replace',cls: 'bg-amber-500/15  text-amber-400' },
  possible:  { label: 'Alt. possible',  cls: 'bg-emerald-500/15 text-emerald-400' },
} as const;

// ── Supply chain stage data ────────────────────────────────────────────────────
const SUPPLY_CHAIN_STAGES = [
  {
    id: 'mine', stage: 'Mining', note: 'Ore extracted from deposit',
    lreeChinaPct: 60, hreeChinaPct: 80, isChokepoint: false,
    lreeDetail: 'US 14% (Mountain Pass, CA) · AU 6% (Mt Weld) · Myanmar 4.5%',
    hreeDetail: 'Myanmar 15% (Wa State ion-adsorption clays) · AU 1.2% · rest <4%',
  },
  {
    id: 'concentrate', stage: 'Concentrate', note: 'Crushing, flotation & acid leaching',
    lreeChinaPct: 68, hreeChinaPct: 84, isChokepoint: false,
    lreeDetail: 'US ore processed in-country; AU Lynas ships concentrate to Malaysia',
    hreeDetail: 'Myanmar ore largely trucked to China for processing',
  },
  {
    id: 'separate', stage: 'Separation', note: 'Solvent extraction — isolates individual elements',
    lreeChinaPct: 85, hreeChinaPct: 92, isChokepoint: true,
    lreeDetail: 'Lynas (Malaysia → AU Eneabba) is only major ex-China LREE separator',
    hreeDetail: 'Lynas Eneabba HREE circuit online ~2026 — first ex-China HREE separator ever',
  },
  {
    id: 'metal', stage: 'Metal / Alloy', note: 'Chemical reduction to usable metal form',
    lreeChinaPct: 88, hreeChinaPct: 93, isChokepoint: false,
    lreeDetail: 'NdPr metal production outside China is near-zero commercially',
    hreeDetail: 'Dy/Tb metal making is ~100% Chinese controlled as of 2024',
  },
  {
    id: 'product', stage: 'End Product', note: 'Magnets, phosphors, catalysts',
    lreeChinaPct: 90, hreeChinaPct: 93, isChokepoint: false,
    lreeDetail: 'Japan (TDK, Shin-Etsu) hold ~10% global NdFeB magnet capacity',
    hreeDetail: 'Dy/Tb-enhanced magnet making ≈95% China + Japan combined',
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtPrice = (p: [number, number] | null) =>
  p ? `$${p[0].toLocaleString()}–${p[1].toLocaleString()}/kg` : '—';

// ── ChainBar ───────────────────────────────────────────────────────────────────
function ChainBar({
  label, pct, barCls, isChokepoint,
}: {
  label: string;
  pct: number;
  barCls: string;
  isChokepoint?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground/70 w-[4.5rem] shrink-0 leading-none">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        'text-[9px] tabular-nums font-mono w-7 text-right shrink-0',
        isChokepoint ? 'text-red-400 font-semibold' : 'text-muted-foreground/70',
      )}>
        {pct}%
      </span>
    </div>
  );
}

// ── CriticalityMatrix ──────────────────────────────────────────────────────────
/**
 * SVG scatter plot.
 * X = China mining %  (proxy for supply concentration at extraction)
 * Y = price/kg oxide  (log scale — spans $1–$5 000)
 * Bubble size = sqrt(valueSharePct) · scale factor  (economic importance)
 * Color = REE class
 * Top-right corner = highest strategic risk.
 */
function CriticalityMatrix({ elements }: { elements: RareEarthElement[] }) {
  const plotEls = elements.filter(e => e.priceRangeUsd !== null && e.miningChinaPct > 0);

  // SVG coordinate system
  const W = 300, H = 210;
  const PAD = { top: 18, right: 15, bottom: 32, left: 38 };
  const PW = W - PAD.left - PAD.right;   // plot width
  const PH = H - PAD.top - PAD.bottom;   // plot height

  // X axis: China mining % [55, 90]
  const X_MIN = 55, X_MAX = 90;
  const xPos = (pct: number) => PAD.left + ((pct - X_MIN) / (X_MAX - X_MIN)) * PW;

  // Y axis: log scale [$1, $5000]
  const LOG_MIN = 0, LOG_MAX = Math.log(5000); // log(1)=0
  const yPos = (price: number) => {
    const lp = Math.log(Math.max(price, 1));
    return PAD.top + (1 - (lp - LOG_MIN) / (LOG_MAX - LOG_MIN)) * PH;
  };

  const midPrice = (p: [number, number]) => (p[0] + p[1]) / 2;
  const rScale   = (v: number) => Math.max(3.5, Math.min(13, Math.sqrt(Math.max(v, 0.05)) * 3.2));

  const xTicks = [60, 70, 80, 90];
  const yTicks = [1, 10, 100, 1000, 5000];

  return (
    <div>
      <p className="text-[10px] text-muted-foreground/80 leading-snug mb-2">
        X = China mining share · Y = price/kg (log scale) · bubble size ∝ market value share.
        {' '}<span className="text-red-400 font-semibold">Top-right = highest strategic risk.</span>
        {' '}Hover a bubble for details.
      </p>

      {/* Legend */}
      <div className="flex gap-3 mb-2 flex-wrap">
        {(['light', 'heavy', 'other'] as const).map(c => (
          <span key={c} className="flex items-center gap-1 text-[9px]">
            <svg width="8" height="8">
              <circle cx="4" cy="4" r="3.5" fill={CLASS_STYLE[c].svgColor + '80'} stroke={CLASS_STYLE[c].svgColor} strokeWidth="1" />
            </svg>
            <span className={CLASS_STYLE[c].text}>{REE_CLASS_LABEL[c]}</span>
          </span>
        ))}
        <span className="text-[9px] text-muted-foreground/60 ml-auto italic">Sep% is always higher than mining%</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        {/* Plot background */}
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="rgba(255,255,255,0.03)" rx={3} />

        {/* "Danger zone" tint: high concentration, high price */}
        <rect
          x={xPos(80)} y={PAD.top}
          width={PW - (xPos(80) - PAD.left)} height={PH * 0.42}
          fill="rgba(239,68,68,0.07)"
        />
        <text x={(xPos(80) + PW + PAD.left) / 2} y={PAD.top + 9}
          fontSize={6.5} fill="rgba(239,68,68,0.55)" textAnchor="middle">
          strategic risk zone
        </text>

        {/* X gridlines + ticks */}
        {xTicks.map(t => (
          <g key={t}>
            <line x1={xPos(t)} y1={PAD.top} x2={xPos(t)} y2={PAD.top + PH}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={xPos(t)} y={PAD.top + PH + 11} fontSize={7}
              fill="rgba(255,255,255,0.38)" textAnchor="middle">{t}%</text>
          </g>
        ))}

        {/* Y gridlines + ticks */}
        {yTicks.map(p => (
          <g key={p}>
            <line x1={PAD.left} y1={yPos(p)} x2={PAD.left + PW} y2={yPos(p)}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={PAD.left - 4} y={yPos(p) + 2.5} fontSize={6.5}
              fill="rgba(255,255,255,0.38)" textAnchor="end">
              {p >= 1000 ? `$${p / 1000}k` : `$${p}`}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={PAD.left + PW / 2} y={H - 4} fontSize={7.5}
          fill="rgba(255,255,255,0.45)" textAnchor="middle">
          China mining share →
        </text>
        <text
          x={9} y={PAD.top + PH / 2}
          fontSize={7.5} fill="rgba(255,255,255,0.45)" textAnchor="middle"
          transform={`rotate(-90, 9, ${PAD.top + PH / 2})`}>
          Price / kg (log) →
        </text>

        {/* Bubbles */}
        {plotEls.map(e => {
          const cx  = xPos(e.miningChinaPct);
          const cy  = yPos(midPrice(e.priceRangeUsd!));
          const r   = rScale(e.valueSharePct);
          const col = CLASS_STYLE[e.class].svgColor;
          return (
            <g key={e.symbol}>
              <title>{`${e.symbol} — ${e.name}\nMining: ${e.miningChinaPct}%  Sep: ${e.separationChinaPct}%\nPrice: ${fmtPrice(e.priceRangeUsd)}\nValue: ${e.valueSharePct}% of bloc\n${e.primaryUse}`}</title>
              <circle cx={cx} cy={cy} r={r}
                fill={col + '50'} stroke={col} strokeWidth={1.2}
                className="cursor-default" />
              <text x={cx} y={cy - r - 2} fontSize={6.5}
                fill={col} textAnchor="middle" fontWeight="700">
                {e.symbol}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-[9px] text-muted-foreground/60 italic leading-snug mt-1">
        Note: separation % (always higher than mining %) is the sharper risk lever but isn't shown on this axis.
        Elements sharing an X coordinate (e.g. Nd/Pr at 60%) are co-mined and move together geopolitically.
      </p>
    </div>
  );
}

// ── SupplyChainView ────────────────────────────────────────────────────────────
function SupplyChainView() {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/80 leading-snug mb-3">
        From ore in the ground to a finished magnet, REEs pass through five processing stages.
        China's control <em>increases</em> at every step — most sharply at{' '}
        <span className="text-red-400 font-semibold">separation</span>, where ore is chemically split
        into individual elements. Ore mined in the US or Australia is still often shipped to China
        to be separated, giving Beijing leverage at a point most Western governments can't bypass.
      </p>

      {/* Pipeline */}
      <div className="space-y-2 mb-3">
        {SUPPLY_CHAIN_STAGES.map((stage, i) => (
          <div key={stage.id} className={cn(
            'rounded border p-2.5',
            stage.isChokepoint
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-border/40 bg-card/30',
          )}>
            {/* Stage header */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className={cn(
                'text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                stage.isChokepoint ? 'bg-red-500/20 text-red-400' : 'bg-muted/40 text-muted-foreground',
              )}>
                {i + 1}
              </span>
              <span className={cn('text-[11px] font-semibold', stage.isChokepoint ? 'text-red-400' : 'text-foreground')}>
                {stage.stage}
              </span>
              {stage.isChokepoint && (
                <span className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-px rounded font-semibold uppercase tracking-wide">
                  ⚠ Chokepoint
                </span>
              )}
              <span className="ml-auto text-[9px] text-muted-foreground/60 italic">
                {stage.note}
              </span>
            </div>

            {/* China % bars — LREE vs HREE */}
            <div className="space-y-1 mb-1.5">
              <ChainBar
                label="LREE (Nd/Pr)"
                pct={stage.lreeChinaPct}
                barCls={stage.isChokepoint ? 'bg-red-500/80' : 'bg-amber-500/70'}
                isChokepoint={stage.isChokepoint}
              />
              <ChainBar
                label="HREE (Dy/Tb)"
                pct={stage.hreeChinaPct}
                barCls={stage.isChokepoint ? 'bg-red-500' : 'bg-red-400/70'}
                isChokepoint={stage.isChokepoint}
              />
            </div>

            {/* Country notes */}
            <p className="text-[9px] text-muted-foreground/70 leading-snug">
              <span className="text-amber-400/80 font-medium">LREE</span>
              {' · '}{stage.lreeDetail}
            </p>
            <p className="text-[9px] text-muted-foreground/70 leading-snug">
              <span className="text-red-400/80 font-medium">HREE</span>
              {' · '}{stage.hreeDetail}
            </p>
          </div>
        ))}
      </div>

      {/* Key insight callout */}
      <div className="p-2.5 rounded border border-amber-500/25 bg-amber-500/5 text-[10px] text-amber-400/90 leading-snug">
        <span className="font-semibold">Key insight — </span>
        China's refining/separation monopoly (85–93%) is a more powerful lever than its mining share (60–80%).
        A trade dispute could block access to separated REE oxides even if ore were mined elsewhere — the West
        currently has almost no separation capacity for heavy REEs like Dy and Tb.
      </div>
    </div>
  );
}

// ── RareEarthsBreakdownCard (main export) ──────────────────────────────────────
/**
 * Three-tab deep dive into the 17 rare-earth elements:
 *
 *  Elements    — filterable list with expandable detail panels (applications,
 *                criticality flags, mining vs. separation China %, key sources)
 *  Risk Matrix — SVG scatter plot: China mining % vs price/kg (log scale)
 *  Supply Chain — visual 5-stage pipeline showing where China's leverage accumulates
 */
export function RareEarthsBreakdownCard() {
  const [view,        setView]        = useState<ViewMode>('elements');
  const [classFilter, setClassFilter] = useState<ReeClass | 'all'>('all');
  const [appFilter,   setAppFilter]   = useState<ReeApplication | 'all'>('all');
  const [expanded,    setExpanded]    = useState<string | null>(null);

  // Stable sorted-by-value list
  const sorted = useMemo(
    () => [...RARE_EARTH_ELEMENTS].sort((a, b) => b.valueSharePct - a.valueSharePct),
    [],
  );

  // Filtered list (elements view)
  const filtered = useMemo(() => {
    let els = sorted;
    if (classFilter !== 'all') els = els.filter(e => e.class === classFilter);
    if (appFilter   !== 'all') els = els.filter(e => e.applications.includes(appFilter));
    return els;
  }, [sorted, classFilter, appFilter]);

  // Aggregate header stats
  const stats = useMemo(() => {
    const magnetValue = sorted
      .filter(e => ['Nd', 'Pr', 'Dy', 'Tb'].includes(e.symbol))
      .reduce((s, e) => s + e.valueSharePct, 0);
    const usCrit  = sorted.filter(e => e.usCritical).length;
    const euCrit  = sorted.filter(e => e.euCritical).length;
    const light   = sorted.filter(e => e.class === 'light').length;
    const heavy   = sorted.filter(e => e.class === 'heavy').length;
    const other   = sorted.filter(e => e.class === 'other').length;
    return { magnetValue, usCrit, euCrit, light, heavy, other };
  }, [sorted]);

  return (
    <div className="px-4 py-3 border-t border-border">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-2">
        <Atom className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Rare Earths — 17-element breakdown</span>
        <span className="ml-auto text-[9px] text-muted-foreground/60 uppercase tracking-wide">
          Behind the bloc
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/80 leading-snug mb-2.5">
        "Rare earths" is 17 chemically similar elements spanning price ranges of $2–$5,000/kg.
        Magnet REEs (<span className="text-foreground">Nd · Pr · Dy · Tb</span>) carry
        ≈<span className="text-foreground font-semibold">{stats.magnetValue.toFixed(0)}%</span> of
        total value.{' '}<span className="text-foreground">{stats.usCrit}</span> are US-critical,{' '}
        <span className="text-foreground">{stats.euCrit}</span> EU-critical.
        China dominates <em>separation</em> (85–93%) far more than mining (60–80%) — the real chokepoint.
      </p>

      {/* ── View tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-3 text-[10px]">
        {([
          { id: 'elements' as const, label: 'Elements'     },
          { id: 'matrix'   as const, label: 'Risk Matrix'  },
          { id: 'supply'   as const, label: 'Supply Chain' },
        ]).map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              'px-2.5 py-0.5 rounded border transition-colors',
              view === v.id
                ? 'bg-primary/15 border-primary/50 text-foreground font-semibold'
                : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ELEMENTS VIEW                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'elements' && (
        <>
          {/* Class filter */}
          <div className="flex gap-1 mb-2 text-[10px] flex-wrap">
            {(['all', 'light', 'heavy', 'other'] as const).map(c => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                className={cn(
                  'px-2 py-0.5 rounded border transition-colors',
                  classFilter === c
                    ? 'bg-primary/15 border-primary/50 text-foreground font-semibold'
                    : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30',
                )}
              >
                {c === 'all'   ? `All (${sorted.length})` :
                 c === 'light' ? `${REE_CLASS_LABEL.light} · ${stats.light}` :
                 c === 'heavy' ? `${REE_CLASS_LABEL.heavy} · ${stats.heavy}` :
                                 `${REE_CLASS_LABEL.other} · ${stats.other}`}
              </button>
            ))}
          </div>

          {/* Application filter */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button
              onClick={() => setAppFilter('all')}
              className={cn(
                'px-1.5 py-0.5 rounded border text-[9px] transition-colors',
                appFilter === 'all'
                  ? 'bg-primary/15 border-primary/50 text-foreground font-semibold'
                  : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30',
              )}
            >
              All uses
            </button>
            {(Object.keys(APP_STYLE) as ReeApplication[]).map(id => {
              const s = APP_STYLE[id];
              return (
                <button
                  key={id}
                  onClick={() => setAppFilter(appFilter === id ? 'all' : id)}
                  className={cn(
                    'px-1.5 py-0.5 rounded border text-[9px] transition-colors',
                    appFilter === id
                      ? cn(s.cls, 'font-semibold')
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Element rows */}
          <div className="space-y-1">
            {filtered.map(e => {
              const cs         = CLASS_STYLE[e.class];
              const isExpanded = expanded === e.symbol;
              return (
                <div
                  key={e.symbol}
                  className="rounded border border-border/40 bg-card/30 overflow-hidden"
                >
                  {/* ── Clickable summary row ─────────────────────────────── */}
                  <button
                    className="w-full text-left px-2.5 py-2 hover:bg-muted/20 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : e.symbol)}
                  >
                    <div className="flex items-start gap-2">
                      {/* Periodic-table badge */}
                      <span className={cn(
                        'inline-flex flex-col items-center justify-center rounded font-mono shrink-0',
                        'text-[11px] font-bold w-9 h-9 leading-tight border',
                        cs.text, cs.bg, cs.border,
                      )}>
                        <span>{e.symbol}</span>
                        <span className="text-[7px] opacity-60 -mt-0.5">{e.atomicNumber}</span>
                      </span>

                      {/* Name + metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[12px] font-semibold leading-none">{e.name}</span>
                          <span className={cn(
                            'text-[8px] uppercase tracking-wide px-1 py-px rounded',
                            cs.text, cs.bg,
                          )}>
                            {REE_CLASS_LABEL[e.class]}
                          </span>
                          {/* Criticality flags */}
                          {e.usCritical && (
                            <span title="US DoE 2023 Critical Materials List" className="text-[10px] leading-none">🇺🇸</span>
                          )}
                          {e.euCritical && (
                            <span title="EU Critical Raw Materials Act 2023" className="text-[10px] leading-none">🇪🇺</span>
                          )}
                          {/* Demand trend */}
                          {e.demandTrend === 'rising'   && <TrendingUp   className="w-3 h-3 text-emerald-400" />}
                          {e.demandTrend === 'declining' && <TrendingDown className="w-3 h-3 text-amber-400" />}
                          {e.demandTrend === 'stable'   && <Minus        className="w-3 h-3 text-muted-foreground/50" />}
                          {/* Value share (right-aligned) */}
                          {e.valueSharePct >= 1 && (
                            <span className="text-[9px] text-muted-foreground/55 tabular-nums ml-auto shrink-0">
                              {e.valueSharePct}% bloc value
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-muted-foreground/85 leading-snug mb-1">
                          {e.primaryUse}
                        </p>

                        {/* Application chips + substitutability */}
                        {e.applications.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 items-center">
                            {e.applications.map(app => (
                              <span
                                key={app}
                                className={cn('text-[8px] px-1 py-px rounded border', APP_STYLE[app].cls)}
                              >
                                {APP_STYLE[app].label}
                              </span>
                            ))}
                            <span className={cn(
                              'text-[8px] px-1 py-px rounded ml-1',
                              SUBST_STYLE[e.substitutability].cls,
                            )}>
                              {SUBST_STYLE[e.substitutability].label}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Price + chevron */}
                      <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                        <p className="text-[10px] font-mono tabular-nums text-foreground leading-none">
                          {fmtPrice(e.priceRangeUsd)}
                        </p>
                        <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wide leading-none">
                          oxide/kg
                        </p>
                        {isExpanded
                          ? <ChevronUp   className="w-3 h-3 text-muted-foreground/50" />
                          : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                        }
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded detail panel ────────────────────────────── */}
                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 pt-2 border-t border-border/30 bg-muted/10 space-y-2.5">

                      {/* Mining vs Separation China % */}
                      {e.miningChinaPct > 0 && (
                        <div>
                          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold mb-1">
                            China supply-chain control
                          </p>
                          <div className="space-y-1">
                            <ChainBar
                              label="Mining"
                              pct={e.miningChinaPct}
                              barCls="bg-amber-500/70"
                            />
                            <ChainBar
                              label="Separation"
                              pct={e.separationChinaPct}
                              barCls="bg-red-500/80"
                              isChokepoint
                            />
                          </div>
                          {(e.separationChinaPct - e.miningChinaPct) >= 15 && (
                            <p className="text-[9px] text-amber-400/80 leading-snug mt-1">
                              ↑ Sep. share is{' '}
                              <strong>{e.separationChinaPct - e.miningChinaPct}pp</strong>{' '}
                              above mining — ore from non-Chinese mines still flows to Chinese separators.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Key sources */}
                      <div>
                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold mb-0.5">
                          Key sources / projects
                        </p>
                        <p className="text-[10px] text-muted-foreground/85 leading-snug">
                          {e.keySource}
                        </p>
                      </div>

                      {/* Supply risk note */}
                      <div>
                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold mb-0.5">
                          Supply risk
                        </p>
                        <p className="text-[10px] text-muted-foreground/85 leading-snug">
                          {e.supplyNote}
                        </p>
                      </div>

                      {/* Tradable proxy */}
                      {e.proxy ? (
                        <div className="flex items-center gap-1.5">
                          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-semibold">
                            Tradable proxy
                          </p>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">
                            {e.proxy}
                          </span>
                        </div>
                      ) : e.valueSharePct > 0 ? (
                        <p className="text-[9px] text-muted-foreground/55 italic">
                          No individual equity proxy — use <span className="font-mono not-italic">REMX.US</span> for REE bloc exposure.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RISK MATRIX VIEW                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'matrix' && <CriticalityMatrix elements={sorted} />}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SUPPLY CHAIN VIEW                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'supply' && <SupplyChainView />}

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="mt-3 text-[9px] text-muted-foreground/55 italic leading-snug">
        Prices: indicative 2023–24 ranges from Asian Metal / Shanghai Metal Market (oxide form).
        China %: USGS / Adamas Intelligence 2024 estimates.{' '}
        {view === 'elements' && 'Click any element row to expand supply-chain detail. '}
        For REE-bloc price exposure use{' '}
        <span className="font-mono not-italic">REMX.US</span> on the price strip above.
      </p>
    </div>
  );
}
