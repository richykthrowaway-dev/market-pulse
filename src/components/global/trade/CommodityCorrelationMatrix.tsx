/**
 * CommodityCorrelationMatrix
 *
 * Visual design mirrors portfolio/CorrelationMatrix.tsx exactly:
 *   • Sort controls: Default | Correlation ↓ | Category
 *   • 9 switchable colour palettes with live gradient swatches
 *   • Lower-triangular heatmap — upper half masked
 *   • Continuous HSL cell colouring via pal.bg(r) / pal.fg(r)
 *   • Category colour dots on row/column labels (energy/metals/agriculture)
 *   • Category separator rows when sorting by category
 *   • Category legend in right-side panel
 *   • Diagonal shows 1.00 (dimmed)
 *   • Ranked "Top Pairs" table sorted by |r| desc
 *   • "How to read" side panel with live palette swatches
 *
 * Math — identical to useCorrelationMatrix.ts:
 *   • logReturns: skips zero/negative price pairs (never pushes 0)
 *   • pearson: deviation (mean-centred) form, clamped [-1, 1], MIN_RETURNS=15
 *   • All series right-aligned to shortest before computing
 */
import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCommodityPrices } from '@/hooks/useCommodityPrices';
import { COMMODITIES, type CommodityCategory } from '@/data/tradeInfrastructure/commodities';
import { cn } from '@/lib/utils';

// ── Math helpers — identical to useCorrelationMatrix.ts ──────────────────────

const MIN_RETURNS = 15;

function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) out.push(Math.log(curr / prev));
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < MIN_RETURNS) return null;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const mx = sumX / n;
  const my = sumY / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return Math.max(-1, Math.min(1, num / denom));
}

// ── Category colours ──────────────────────────────────────────────────────────
const CAT_COLOR: Record<CommodityCategory, string> = {
  energy:      '#f59e0b', // amber
  metals:      '#60a5fa', // blue
  agriculture: '#4ade80', // green
};

const CAT_LABEL: Record<CommodityCategory, string> = {
  energy:      'Energy',
  metals:      'Metals',
  agriculture: 'Agriculture',
};

// id → category lookup built once at module load
const COMMODITY_CAT = new Map<string, CommodityCategory>(
  COMMODITIES.map(c => [c.id, c.category]),
);

// ── Colour palettes — copied verbatim from portfolio/CorrelationMatrix.tsx ───

const ri = Math.round;

interface Palette { label: string; bg: (r: number) => string; fg: (r: number) => string }

type PaletteKey = 'rocket' | 'rdbu' | 'spectral' | 'viridis' | 'plasma' | 'inferno'
                | 'ember' | 'nox' | 'velvet';

const PALETTES: Record<PaletteKey, Palette> = {
  rocket: {
    label: 'Rocket',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(330,${ri(12+a*68)}%,${ri(95-a*67)}%)`
        : `hsl(215,${ri(12+a*60)}%,${ri(95-a*63)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  rdbu: {
    label: 'RdBu',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(6,${ri(8+a*78)}%,${ri(97-a*60)}%)`
        : `hsl(213,${ri(8+a*78)}%,${ri(97-a*60)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  spectral: {
    label: 'Spectral',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(22,${ri(8+a*80)}%,${ri(97-a*60)}%)`
        : `hsl(152,${ri(8+a*65)}%,${ri(97-a*57)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  viridis: {
    label: 'Viridis',
    bg: (r) => {
      const t = Math.abs(r);
      const h = t < 0.5 ? ri(60 + t*2*125) : ri(185 + (t-0.5)*2*75);
      return `hsl(${h},${ri(18+t*68)}%,${ri(94-t*70)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  plasma: {
    label: 'Plasma',
    bg: (r) => {
      const t = Math.abs(r);
      const h = ri((55 - t*125 + 360) % 360);
      return `hsl(${h},${ri(18+t*74)}%,${ri(95-t*68)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  inferno: {
    label: 'Inferno',
    bg: (r) => {
      const t = Math.abs(r);
      const h2 = ri((40 - t * 100 + 360) % 360);
      return `hsl(${h2},${ri(15+t*78)}%,${ri(95-t*72)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  ember: {
    label: 'Ember',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(38,${ri(6+a*68)}%,${ri(15+a*28)}%)`
        : `hsl(208,${ri(6+a*50)}%,${ri(15+a*22)}%)`;
    },
    fg: (_r) => '#fef3c7',
  },
  nox: {
    label: 'Nox',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(172,${ri(8+a*60)}%,${ri(12+a*22)}%)`
        : `hsl(350,${ri(8+a*55)}%,${ri(12+a*27)}%)`;
    },
    fg: (_r) => '#ccfbf1',
  },
  velvet: {
    label: 'Velvet',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(44,${ri(10+a*72)}%,${ri(13+a*28)}%)`
        : `hsl(255,${ri(10+a*58)}%,${ri(13+a*32)}%)`;
    },
    fg: (_r) => '#ede9fe',
  },
} as const;

function swatchGradient(key: PaletteKey): string {
  const p = PALETTES[key];
  const stops = [-1, -0.6, -0.2, 0, 0.2, 0.6, 1].map(r => p.bg(r)).join(', ');
  return `linear-gradient(to right, ${stops})`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SortMode = 'default' | 'correlation' | 'category';

const SORT_BTNS: { mode: SortMode; label: string }[] = [
  { mode: 'default',     label: 'Default'       },
  { mode: 'correlation', label: 'Correlation ↓' },
  { mode: 'category',    label: 'Category'      },
];

// ── Main component ────────────────────────────────────────────────────────────

export function CommodityCorrelationMatrix() {
  // ── All hooks before any early return ────────────────────────────────────
  const [paletteKey,     setPaletteKey]     = useState<PaletteKey>('rocket');
  const [sortMode,       setSortMode]       = useState<SortMode>('default');
  const [pairsCollapsed, setPairsCollapsed] = useState(false);
  const pal = PALETTES[paletteKey];

  const { data, isLoading } = useCommodityPrices();
  const prices = data?.prices ?? [];

  // id → short label (≤5 chars, uppercase first word)
  const rawLabels = useMemo(() =>
    prices.map(p => p.label.split(/\s+/)[0].slice(0, 5).toUpperCase()),
    [prices],
  );

  // Full correlation matrix (all n×n, right-aligned, symmetric)
  const rawMatrix = useMemo((): (number | null)[][] => {
    if (prices.length === 0) return [];
    const allReturns = prices.map(p => logReturns(p.sparkline ?? []));
    const minLen = Math.min(...allReturns.map(r => r.length));
    const aligned = allReturns.map(r => r.slice(r.length - minLen));
    const n = prices.length;
    const mat: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          mat[i][j] = 1;
        } else {
          const r = pearson(aligned[i], aligned[j]);
          mat[i][j] = r;
          mat[j][i] = r;
        }
      }
    }
    return mat;
  }, [prices]);

  // Sorted indices — same logic as portfolio matrix
  const sortedIndices = useMemo(() => {
    if (!rawLabels.length) return [];
    const indices = rawLabels.map((_, i) => i);

    if (sortMode === 'default') return indices;

    if (sortMode === 'correlation') {
      const avgCorr = rawLabels.map((_, i) => {
        let sum = 0, count = 0;
        for (let j = 0; j < rawLabels.length; j++) {
          const v = rawMatrix[i]?.[j];
          if (i !== j && v !== null && v !== undefined) { sum += v; count++; }
        }
        return count > 0 ? sum / count : 0;
      });
      return [...indices].sort((a, b) => avgCorr[b] - avgCorr[a]);
    }

    if (sortMode === 'category') {
      const CAT_ORDER: CommodityCategory[] = ['energy', 'metals', 'agriculture'];
      return [...indices].sort((a, b) => {
        const ca = COMMODITY_CAT.get(prices[a]?.id ?? '') ?? 'agriculture';
        const cb = COMMODITY_CAT.get(prices[b]?.id ?? '') ?? 'agriculture';
        const oa = CAT_ORDER.indexOf(ca);
        const ob = CAT_ORDER.indexOf(cb);
        if (oa !== ob) return oa - ob;
        return rawLabels[a].localeCompare(rawLabels[b]);
      });
    }

    return indices;
  }, [sortMode, rawLabels, rawMatrix, prices]);

  // Permuted labels, prices, matrix
  const labels  = useMemo(() => sortedIndices.map(i => rawLabels[i]),  [sortedIndices, rawLabels]);
  const sortedP = useMemo(() => sortedIndices.map(i => prices[i]),     [sortedIndices, prices]);
  const matrix  = useMemo(
    () => sortedIndices.map(ri => sortedIndices.map(ci => rawMatrix[ri]?.[ci] ?? null)),
    [sortedIndices, rawMatrix],
  );

  // Category legend — unique categories in current order
  const categoryLegend = useMemo(() => {
    const seen = new Set<CommodityCategory>();
    const out: CommodityCategory[] = [];
    for (const p of sortedP) {
      const cat = COMMODITY_CAT.get(p?.id ?? '');
      if (cat && !seen.has(cat)) { seen.add(cat); out.push(cat); }
    }
    return out;
  }, [sortedP]);

  // Top pairs by |r|, lower triangle only (uses permuted labels)
  const rankedPairs = useMemo(() => {
    if (labels.length < 2 || matrix.length === 0) return [];
    const pairs: { a: string; b: string; aId: string; bId: string; r: number }[] = [];
    for (let i = 1; i < labels.length; i++) {
      for (let j = 0; j < i; j++) {
        const r = matrix[i]?.[j];
        if (r !== null && r !== undefined && r !== 1) {
          pairs.push({ a: labels[i], b: labels[j], aId: sortedP[i]?.id ?? '', bId: sortedP[j]?.id ?? '', r });
        }
      }
    }
    return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 10);
  }, [labels, matrix, sortedP]);

  // ── Early returns — all hooks already called ──────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Computing correlations…
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <p className="px-4 py-4 text-center text-xs text-muted-foreground/60 italic">
        No price data available.
      </p>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-4 space-y-3">

      {/* Description */}
      <p className="text-[11px] leading-snug text-muted-foreground italic">
        Pearson correlation of commodity ETF daily log returns.{' '}
        <span className="not-italic">Lower triangle · diagonal = 1.00</span>
      </p>

      {/* Sort buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {SORT_BTNS.map(({ mode, label }) => (
          <button
            type="button"
            key={mode}
            onClick={() => setSortMode(mode)}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
              sortMode === mode
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Palette switcher */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Palette:</span>
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
            <button
              type="button"
              key={key}
              title={PALETTES[key].label}
              onClick={() => setPaletteKey(key)}
              className={cn(
                'h-4 w-9 rounded transition-all',
                paletteKey === key
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-card scale-110'
                  : 'opacity-70 hover:opacity-100',
              )}
              style={{ background: swatchGradient(key) }}
            />
          ))}
        </div>
      </div>

      {/* Heatmap + side panel */}
      <div className="flex gap-4 items-start overflow-x-auto">

        {/* Lower-triangle table */}
        <div className="flex-1 min-w-0">
          <table className="border-collapse text-[10px] font-mono" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="p-0 min-w-[4px]" />
                {labels.slice(0, -1).map((l, j) => {
                  const cat = COMMODITY_CAT.get(sortedP[j]?.id ?? '');
                  return (
                    <th
                      key={j}
                      className="px-0.5 pb-1 text-center text-[10px] font-semibold text-muted-foreground"
                      title={sortedP[j]?.label}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="block truncate">{l}</span>
                        {cat && (
                          <span
                            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CAT_COLOR[cat] }}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLabel, i) => {
                if (i === 0) return null;

                const cat     = COMMODITY_CAT.get(sortedP[i]?.id ?? '');
                const prevCat = COMMODITY_CAT.get(sortedP[i - 1]?.id ?? '');
                const showSep = sortMode === 'category' && cat && cat !== prevCat;

                return (
                  <React.Fragment key={`row-${i}`}>
                    {showSep && (
                      <tr>
                        <td
                          colSpan={i + 1}
                          className="pt-2 pb-0.5 text-[9px] uppercase tracking-wider font-sans"
                          style={{ color: cat ? CAT_COLOR[cat] : undefined, opacity: 0.7 }}
                        >
                          {cat ? CAT_LABEL[cat] : ''}
                        </td>
                      </tr>
                    )}
                    <tr>
                      {/* Row label + category dot */}
                      <td
                        className="pr-1.5 py-0.5 text-right text-[10px] font-semibold text-muted-foreground whitespace-nowrap"
                        title={sortedP[i]?.label}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{rowLabel}</span>
                          {cat && (
                            <span
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CAT_COLOR[cat] }}
                            />
                          )}
                        </div>
                      </td>

                      {/* Lower-triangle cells */}
                      {matrix[i]?.slice(0, i).map((r, j) => {
                        const val = r ?? null;
                        const isHigh = val !== null && Math.abs(val) > 0.75;
                        return (
                          <td
                            key={j}
                            title={
                              val !== null
                                ? `${sortedP[i]?.label} / ${sortedP[j]?.label}: r = ${val.toFixed(2)}`
                                : `${sortedP[i]?.label} / ${sortedP[j]?.label}: insufficient data`
                            }
                            className={cn(
                              'rounded px-0.5 py-1 text-center tabular-nums w-8 h-7 align-middle',
                              isHigh && 'ring-1 ring-inset ring-white/20',
                            )}
                            style={
                              val !== null
                                ? { backgroundColor: pal.bg(val), color: pal.fg(val) }
                                : undefined
                            }
                          >
                            {val !== null ? val.toFixed(2) : '?'}
                          </td>
                        );
                      })}

                      {/* Diagonal */}
                      <td
                        className="w-8 h-7 rounded px-0.5 py-1 text-center tabular-nums opacity-25 bg-muted/20 text-muted-foreground"
                        title={sortedP[i]?.label}
                      >
                        1.00
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right-side panel */}
        <div className="flex-shrink-0 flex flex-col gap-3 mt-6">

          {/* Colour scale */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <span className="inline-block h-2.5 w-3 rounded" style={{ backgroundColor: pal.bg(-1) }} />
            <span>−1</span>
            <span className="inline-block h-2.5 w-3 rounded" style={{ backgroundColor: pal.bg(0) }} />
            <span>0</span>
            <span className="inline-block h-2.5 w-3 rounded" style={{ backgroundColor: pal.bg(1) }} />
            <span>+1</span>
          </div>

          {/* Category key */}
          {categoryLegend.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Category</p>
              <div className="flex flex-col gap-1.5">
                {categoryLegend.map(cat => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CAT_COLOR[cat] }}
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {CAT_LABEL[cat]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How to read */}
          <div className="border-t border-border/50 pt-2.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">How to read</p>
            <div className="flex flex-col gap-1.5">
              {([
                { r:  1,   label: '+1.00', desc: 'Move in lockstep'      },
                { r:  0.5, label: '+0.50', desc: 'Tend to move together' },
                { r:  0,   label: ' 0.00', desc: 'No relationship'       },
                { r: -0.5, label: '−0.50', desc: 'Tend to diverge'       },
                { r: -1,   label: '−1.00', desc: 'Opposite directions'   },
              ] as const).map(({ r, label, desc }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-sm flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: pal.bg(r) }}
                  />
                  <span className="text-[9px] font-mono text-foreground/70 w-10 shrink-0">{label}</span>
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[9px] text-muted-foreground/70 leading-snug">
                <span className="opacity-40 mr-1">▸</span>
                Sparkline log returns · right-aligned.
              </p>
              <p className="text-[9px] text-muted-foreground/70 leading-snug">
                <span className="opacity-40 mr-1">▸</span>
                Min {MIN_RETURNS} observations required.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Ranked top pairs */}
      {rankedPairs.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Top Pairs by Correlation
            </p>
            <button
              type="button"
              onClick={() => setPairsCollapsed(v => !v)}
              className="text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted/70"
            >
              {pairsCollapsed ? `Show all ${rankedPairs.length}` : 'Show top 3'}
            </button>
          </div>
          <div className="space-y-1.5">
            {(pairsCollapsed ? rankedPairs.slice(0, 3) : rankedPairs).map(({ a, b, aId, bId, r }) => {
              const catA = COMMODITY_CAT.get(aId);
              const catB = COMMODITY_CAT.get(bId);
              return (
                <div key={`${a}-${b}`} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-[7rem] shrink-0">
                    {catA && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLOR[catA] }} />}
                    <span className="text-[10px] font-mono font-medium text-foreground">{a}</span>
                    <span className="text-[9px] text-muted-foreground/50 mx-0.5">/</span>
                    {catB && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLOR[catB] }} />}
                    <span className="text-[10px] font-mono font-medium text-foreground">{b}</span>
                  </div>
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(Math.abs(r) * 100)}%`, backgroundColor: pal.bg(r) }}
                    />
                  </div>
                  <span className={cn(
                    'text-[10px] font-mono w-10 text-right shrink-0',
                    r >= 0 ? 'text-rose-400' : 'text-blue-400',
                  )}>
                    {r >= 0 ? '+' : ''}{r.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
