/**
 * CorrelationMatrix — 3-month daily log-return Pearson correlation heatmap.
 *
 * Visual design copied from RodolpheKouyoumdjian/StocksCorrelation:
 *   • Lower-triangular only  (upper half masked, just like sns.heatmap mask=np.triu)
 *   • rocket_r-inspired palette:  pale-cream (r≈0) → deep rose-purple (r→+1)
 *                                 pale-cream (r≈0) → deep blue        (r→-1)
 *   • Ranked "Top Pairs" table below the grid, sorted by |r| desc
 *
 * Sort controls: Default | Correlation ↓ | By Sector | By Size $
 *
 * HOOKS NOTE: All hooks must be declared before ANY early return to satisfy
 * React's Rules of Hooks. Data-dependent memos guard with early exits inside
 * the memo body instead.
 */
import React, { useState, useMemo } from 'react';
import { useCorrelationMatrix, type HoldingPair } from '@/hooks/useCorrelationMatrix';
import { getGicsSectorColor, normalizeSector } from '@/lib/gicsColors';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedHolding extends HoldingPair {
  name?:        string;
  sector?:      string;
  subIndustry?: string;
  marketValue?: number;
}

interface Props {
  holdings: EnrichedHolding[];
}

type SortMode    = 'default' | 'correlation' | 'sector' | 'size';
type PaletteKey  = 'rocket' | 'rdbu' | 'spectral' | 'viridis' | 'plasma' | 'inferno'
                 | 'ember' | 'nox' | 'velvet';

// ── Colour palettes ───────────────────────────────────────────────────────────
// Each palette exposes bg(r) and fg(r) where r ∈ [-1, 1].
// Diverging palettes use separate hue branches for positive/negative.
// Sequential palettes map |r| → intensity so strong correlations (either sign)
// appear dark — useful when magnitude matters more than direction.

const i = Math.round; // alias for brevity inside palette math

interface Palette { label: string; bg: (r: number) => string; fg: (r: number) => string }

const PALETTES: Record<PaletteKey, Palette> = {
  // ── Diverging ───────────────────────────────────────────────────────────────
  rocket: {
    label: 'Rocket',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(330,${i(12+a*68)}%,${i(95-a*67)}%)`
        : `hsl(215,${i(12+a*60)}%,${i(95-a*63)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  rdbu: {
    label: 'RdBu',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(6,${i(8+a*78)}%,${i(97-a*60)}%)`   // white → deep red
        : `hsl(213,${i(8+a*78)}%,${i(97-a*60)}%)`; // white → deep blue
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  spectral: {
    label: 'Spectral',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(22,${i(8+a*80)}%,${i(97-a*60)}%)`   // white → burnt orange
        : `hsl(152,${i(8+a*65)}%,${i(97-a*57)}%)`; // white → forest green
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  // ── Sequential (|r| = intensity; both signs show same darkness) ─────────────
  viridis: {
    label: 'Viridis',
    bg: (r) => {
      const t = Math.abs(r);
      // light yellow → green → teal → dark navy  (approx matplotlib viridis)
      const h = t < 0.5 ? i(60 + t*2*125) : i(185 + (t-0.5)*2*75); // 60→185→260
      return `hsl(${h},${i(18+t*68)}%,${i(94-t*70)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  plasma: {
    label: 'Plasma',
    bg: (r) => {
      const t = Math.abs(r);
      // light yellow → orange → red → dark purple (counterclockwise hue)
      const h = i((55 - t*125 + 360) % 360);
      return `hsl(${h},${i(18+t*74)}%,${i(95-t*68)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.42 ? '#fff' : '#111827',
  },
  inferno: {
    label: 'Inferno',
    bg: (r) => {
      const t = Math.abs(r);
      // near-black → deep purple → red → bright orange → cream  (inferno reversed)
      // We go: cream(t=0) → orange → red → dark purple(t=1)
      const h = t < 0.5 ? i(40 - t*2*34) : i(6 + (t-0.5)*2*-66 + 360) % 360; // 40→6→300
      const h2 = i((40 - t * 100 + 360) % 360); // simpler: 40 → 300
      return `hsl(${h2},${i(15+t*78)}%,${i(95-t*72)}%)`;
    },
    fg: (r) => Math.abs(r) > 0.40 ? '#fff' : '#111827',
  },
  // ── Dark-mode / night palettes ──────────────────────────────────────────────
  // All three stay under ~44 % lightness so they never blast the eyes.
  // Text is always a soft light tone — there are no bright cells needing dark ink.

  ember: {
    // Warm desert night: dark amber-gray center → deep gold (pos) / deep ocean blue (neg)
    label: 'Ember',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(38,${i(6+a*68)}%,${i(15+a*28)}%)`    // dark warm gray → deep amber-gold
        : `hsl(208,${i(6+a*50)}%,${i(15+a*22)}%)`;  // dark warm gray → deep ocean blue
    },
    fg: (_r) => '#fef3c7',  // soft warm cream — readable on all dark amber/blue cells
  },

  nox: {
    // Pure night: near-black center → teal glow (pos) / crimson glow (neg)
    label: 'Nox',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(172,${i(8+a*60)}%,${i(12+a*22)}%)`   // near-black → deep emerald teal
        : `hsl(350,${i(8+a*55)}%,${i(12+a*27)}%)`;  // near-black → deep crimson
    },
    fg: (_r) => '#ccfbf1',  // pale teal-white — harmonises with both teal and crimson
  },

  velvet: {
    // Rich dark: violet-gray center → deep gold (pos) / deep indigo (neg)
    label: 'Velvet',
    bg: (r) => {
      const a = Math.abs(r);
      return r >= 0
        ? `hsl(44,${i(10+a*72)}%,${i(13+a*28)}%)`   // dark violet-gray → deep ochre-gold
        : `hsl(255,${i(10+a*58)}%,${i(13+a*32)}%)`;  // dark violet-gray → deep indigo
    },
    fg: (_r) => '#ede9fe',  // soft lavender-white — at home on both gold and indigo
  },
} as const;

/** Generate a CSS linear-gradient preview for a palette swatch. */
function swatchGradient(key: PaletteKey): string {
  const p = PALETTES[key];
  const stops = [-1, -0.6, -0.2, 0, 0.2, 0.6, 1].map(r => p.bg(r)).join(', ');
  return `linear-gradient(to right, ${stops})`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
// Custom CSS-driven tooltip so we can control the activation delay.
// Browser `title` tooltips are locked to the OS delay (~500 ms); CSS transitions
// let us target the 30%-shorter ~350 ms delay the user requested.

function TickerTooltip({
  ticker,
  name,
  exchange,
  sector,
  subIndustry,
  position = 'above',
  children,
}: {
  ticker:       string;
  name?:        string;
  exchange?:    string;
  sector?:      string;
  subIndustry?: string;
  position?:    'above' | 'right';
  children:     React.ReactNode;
}) {
  const posClass =
    position === 'above'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'left-full top-1/2 -translate-y-1/2 ml-2';

  const displayName      = name && name.trim() !== '' ? name.trim() : null;
  const sectorLabel      = sector      && sector      !== 'Other' ? sector      : null;
  const subIndustryLabel = subIndustry && subIndustry !== ''       ? subIndustry : null;

  return (
    <div className="relative group/tip flex w-full">
      {children}
      <div
        className={cn(
          'pointer-events-none absolute z-50 min-w-max',
          posClass,
          'invisible opacity-0',
          'group-hover/tip:visible group-hover/tip:opacity-100',
          'transition-[opacity,visibility] duration-150 [transition-delay:350ms]',
          'bg-popover border border-border rounded-lg shadow-lg',
          'px-2.5 py-1.5 text-left',
        )}
      >
        {/* Company name as headline; ticker as secondary identifier */}
        <p className="text-[12px] font-semibold text-foreground leading-tight">
          {displayName ?? ticker}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-mono">
          {ticker}{exchange ? ` · ${exchange}` : ''}
        </p>
        {sectorLabel && (
          <p className="text-[10px] text-muted-foreground leading-tight mt-1">{sectorLabel}</p>
        )}
        {subIndustryLabel && (
          <p className="text-[10px] text-muted-foreground/70 leading-tight italic">{subIndustryLabel}</p>
        )}
      </div>
    </div>
  );
}

function fmtM(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CorrelationMatrix({ holdings }: Props) {
  // ━━━ ALL hooks first — no early returns until after this block ━━━━━━━━━━━━

  const [sortMode,        setSortMode]        = useState<SortMode>('default');
  const [paletteKey,      setPaletteKey]      = useState<PaletteKey>('rocket');
  const [hideEtfs,        setHideEtfs]        = useState(false);
  const [pairsCollapsed,  setPairsCollapsed]  = useState(false);
  const pal = PALETTES[paletteKey];

  // Apply ETF filter before anything else — all downstream memos use this
  const filteredHoldings = useMemo(() => {
    if (!hideEtfs) return holdings;
    return holdings.filter(
      (h) => normalizeSector(h.sector || 'Other') !== 'ETFs',
    );
  }, [holdings, hideEtfs]);

  // Only pass pairs to the data hook; sector/size stay UI-only
  const matrixHoldings = useMemo(
    () => filteredHoldings.map(({ ticker, exchange }) => ({ ticker, exchange })),
    [filteredHoldings],
  );

  const { data, isLoading, error } = useCorrelationMatrix(matrixHoldings);

  // Ticker → enriched holding lookup (always computed, empty when no holdings)
  const holdingMap = useMemo(() => {
    const m: Record<string, EnrichedHolding> = {};
    for (const h of filteredHoldings) m[h.ticker.toUpperCase()] = h;
    return m;
  }, [filteredHoldings]);

  const { matrix, tickers: rawLabels } = data ?? { matrix: [], tickers: [] };

  // Sort order — guards against empty rawLabels inside the body
  const sortedIndices = useMemo(() => {
    if (!rawLabels.length) return [];
    const indices = rawLabels.map((_, i) => i);

    if (sortMode === 'default') return indices;

    if (sortMode === 'correlation') {
      const avgCorr = rawLabels.map((_, i) => {
        let sum = 0, count = 0;
        for (let j = 0; j < rawLabels.length; j++) {
          if (i !== j) { sum += matrix[i][j]; count++; }
        }
        return count > 0 ? sum / count : 0;
      });
      return [...indices].sort((a, b) => avgCorr[b] - avgCorr[a]);
    }

    if (sortMode === 'sector') {
      return [...indices].sort((a, b) => {
        const sa = holdingMap[rawLabels[a]]?.sector ?? 'zzz';
        const sb = holdingMap[rawLabels[b]]?.sector ?? 'zzz';
        if (sa !== sb) return sa.localeCompare(sb);
        return rawLabels[a].localeCompare(rawLabels[b]);
      });
    }

    if (sortMode === 'size') {
      return [...indices].sort((a, b) => {
        const va = holdingMap[rawLabels[a]]?.marketValue ?? 0;
        const vb = holdingMap[rawLabels[b]]?.marketValue ?? 0;
        return vb - va;
      });
    }

    return indices;
  }, [sortMode, rawLabels, matrix, holdingMap]);

  // Permuted labels + matrix
  const labels = useMemo(
    () => sortedIndices.map((i) => rawLabels[i]),
    [sortedIndices, rawLabels],
  );
  const sorted = useMemo(
    () => sortedIndices.map((ri) => sortedIndices.map((ci) => matrix[ri][ci])),
    [sortedIndices, matrix],
  );

  // Ranked pairs (lower-triangle only, sorted by |r| desc)
  const rankedPairs = useMemo(() => {
    if (!labels.length) return [];
    const pairs: { a: string; b: string; r: number }[] = [];
    for (let i = 1; i < labels.length; i++) {
      for (let j = 0; j < i; j++) {
        pairs.push({ a: labels[i], b: labels[j], r: sorted[i][j] });
      }
    }
    return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 10);
  }, [labels, sorted]);

  // Unique sectors present in the matrix, in first-seen order
  const sectorLegend = useMemo(() => {
    if (!labels.length) return [];
    const seen = new Map<string, string>(); // sector → hex color
    for (const ticker of labels) {
      const sector = normalizeSector(holdingMap[ticker]?.sector || 'Other');
      if (!seen.has(sector)) seen.set(sector, getGicsSectorColor(sector));
    }
    return [...seen.entries()].map(([sector, color]) => ({ sector, color }));
  }, [labels, holdingMap]);

  // ━━━ Early returns — all hooks already called above ━━━━━━━━━━━━━━━━━━━━━━

  if (holdings.length < 2) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 h-4 w-44 animate-pulse rounded bg-muted" />
        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: Math.min(holdings.length, 5) }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-muted"
              style={{ width: `${55 + i * 8}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Could not load correlation data.</p>
      </div>
    );
  }

  if (!rawLabels.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1">Correlation Matrix</h3>
        <p className="text-sm text-muted-foreground">
          Not enough price history available for your holdings.
        </p>
      </div>
    );
  }

  // ── Sort buttons ────────────────────────────────────────────────────────────
  const SORT_BTNS: { mode: SortMode; label: string }[] = [
    { mode: 'default',     label: 'Default'       },
    { mode: 'correlation', label: 'Correlation ↓' },
    { mode: 'sector',      label: 'Sector'        },
    { mode: 'size',        label: 'Size $'        },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">

      {/* Header + sort buttons */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Correlation Matrix</h3>
            <p className="text-[11px] text-muted-foreground">3-month daily log returns · lower triangle</p>
          </div>
        </div>

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

          {/* Separator */}
          <span className="w-px h-3 bg-border mx-0.5 self-center" />

          {/* ETF filter toggle */}
          <button
            type="button"
            onClick={() => setHideEtfs((v) => !v)}
            title={hideEtfs ? 'ETFs hidden — click to show' : 'Click to hide ETFs'}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
              hideEtfs
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {hideEtfs ? 'ETFs hidden' : 'Hide ETFs'}
          </button>
        </div>

        {/* Palette swatches */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Palette:</span>
          <div className="flex gap-1.5">
            {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
              <button
                type="button"
                key={key}
                title={PALETTES[key].label}
                onClick={() => setPaletteKey(key)}
                className={cn(
                  'h-4 w-10 rounded transition-all',
                  paletteKey === key
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-card scale-110'
                    : 'opacity-70 hover:opacity-100',
                )}
                style={{ background: swatchGradient(key) }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Heatmap + sector key ─────────────────────────────────────────── */}
      {/* items-start keeps the sector key anchored at the top of the flex row
          so it doesn't jump when separator rows appear/disappear on sort change */}
      <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        <table className="border-collapse text-[11px] font-mono w-full" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="p-0 min-w-[4px]" />
              {labels.slice(0, -1).map((ticker, j) => {
                const h           = holdingMap[ticker];
                const sectorColor = getGicsSectorColor(
                  normalizeSector(h?.sector || 'Other')
                );
                return (
                  <th
                    key={`col-${j}`}
                    className="px-1 pb-1.5 text-center text-[13px] font-semibold text-muted-foreground"
                  >
                    <TickerTooltip
                      ticker={ticker}
                      name={h?.name}
                      exchange={h?.exchange}
                      sector={normalizeSector(h?.sector || 'Other')}
                      subIndustry={h?.subIndustry}
                      position="above"
                    >
                      <div className="flex flex-col items-center gap-0.5 cursor-default w-full">
                        <span className="block truncate">{ticker.slice(0, 5)}</span>
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sectorColor }}
                        />
                      </div>
                    </TickerTooltip>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {labels.map((rowTicker, i) => {
              if (i === 0) return null;

              const h = holdingMap[rowTicker];

              const prevTicker = labels[i - 1];
              const prevSector = holdingMap[prevTicker]?.sector;
              const thisSector = h?.sector;
              const showSector = sortMode === 'sector' && thisSector && thisSector !== prevSector;

              return (
                <React.Fragment key={rowTicker}>
                  {showSector && (
                    <tr>
                      <td
                        colSpan={i + 1}
                        className="pt-2 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-sans"
                      >
                        {thisSector}
                      </td>
                    </tr>
                  )}
                  <tr>
                    {/* Row label */}
                    <td className="pr-2 py-0.5 text-[13px] font-semibold text-muted-foreground">
                      <TickerTooltip
                        ticker={rowTicker}
                        name={h?.name}
                        exchange={h?.exchange}
                        sector={normalizeSector(h?.sector || 'Other')}
                        subIndustry={h?.subIndustry}
                        position="right"
                      >
                        <div className="flex items-center justify-end gap-1.5 cursor-default w-full">
                          <div className="text-right">
                            <span>{rowTicker.slice(0, 5)}</span>
                            {sortMode === 'size' && h?.marketValue != null && (
                              <span className="ml-1 text-[10px] opacity-50">
                                {fmtM(h.marketValue)}
                              </span>
                            )}
                          </div>
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getGicsSectorColor(normalizeSector(h?.sector || 'Other')) }}
                          />
                        </div>
                      </TickerTooltip>
                    </td>

                    {/* Lower-triangle cells */}
                    {sorted[i].slice(0, i).map((r, j) => {
                      const isHighCorr = Math.abs(r) > 0.75;
                      return (
                        <td
                          key={`cell-${i}-${j}`}
                          title={
                            isHighCorr
                              ? `${rowTicker} / ${labels[j]} · ${r.toFixed(2)} (high)`
                              : `${rowTicker} / ${labels[j]} · ${r.toFixed(2)}`
                          }
                          className={cn(
                            'rounded px-1 py-1 text-center tabular-nums',
                            isHighCorr && 'ring-1 ring-inset ring-white/25',
                          )}
                          style={{ backgroundColor: pal.bg(r), color: pal.fg(r) }}
                        >
                          {r.toFixed(2)}
                        </td>
                      );
                    })}

                    {/* Diagonal cell */}
                    <td
                      className="min-w-[36px] rounded px-1 py-0.5 text-center tabular-nums opacity-25 bg-muted/20"
                      title={rowTicker}
                    >
                      1.00
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>{/* end table wrapper */}

      {/* Sector key + matrix explainer — right-side panel */}
      <div className="flex-shrink-0 mt-7 flex flex-col gap-4">

        {/* Sector colour key */}
        {sectorLegend.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Sectors</p>
            <div className="flex flex-col gap-1.5">
              {sectorLegend.map(({ sector, color }) => (
                <div key={sector} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{sector}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matrix explainer — for first-time readers */}
        <div className="border-t border-border/50 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">How to read</p>
          <div className="flex flex-col gap-2">

            {/* Live swatches so the colour reference matches the active palette */}
            {([
              { r:  1,    label: '+1.00',  desc: 'Move in lockstep'       },
              { r:  0.5,  label: '+0.50',  desc: 'Tend to move together'  },
              { r:  0,    label: ' 0.00',  desc: 'No relationship'        },
              { r: -0.5,  label: '−0.50',  desc: 'Tend to diverge'        },
              { r: -1,    label: '−1.00',  desc: 'Opposite directions'    },
            ] as const).map(({ r, label, desc }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm flex-shrink-0 border border-white/10"
                  style={{ backgroundColor: pal.bg(r) }}
                />
                <span className="text-[10px] font-mono text-foreground/70 w-[2.6rem] shrink-0">{label}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{desc}</span>
              </div>
            ))}
          </div>

          {/* Contextual notes */}
          <div className="mt-2.5 flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              <span className="opacity-40 mr-1">▸</span>
              Diagonal is always <span className="font-mono">1.00</span> — each stock vs itself.
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              <span className="opacity-40 mr-1">▸</span>
              Lower / negative values = better diversification.
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              <span className="opacity-40 mr-1">▸</span>
              Based on 3-month daily log returns.
            </p>
          </div>
        </div>

      </div>{/* end right-side panel */}

      </div>{/* end heatmap+key flex */}

      {/* ── Colour legend ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
        <span className="inline-block h-2.5 w-4 rounded" style={{ backgroundColor: pal.bg(-1) }} />
        <span>−1</span>
        <span className="inline-block h-2.5 w-4 rounded" style={{ backgroundColor: pal.bg(-0.5) }} />
        <span>−0.5</span>
        <span className="inline-block h-2.5 w-4 rounded" style={{ backgroundColor: pal.bg(0) }} />
        <span>0</span>
        <span className="inline-block h-2.5 w-4 rounded" style={{ backgroundColor: pal.bg(0.5) }} />
        <span>+0.5</span>
        <span className="inline-block h-2.5 w-4 rounded" style={{ backgroundColor: pal.bg(1) }} />
        <span>+1</span>
      </div>

      {/* ── Ranked pairs ──────────────────────────────────────────────────── */}
      {rankedPairs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Top Pairs by Correlation
            </p>
            <button
              type="button"
              onClick={() => setPairsCollapsed(v => !v)}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted/70"
            >
              {pairsCollapsed ? `Show all ${rankedPairs.length}` : 'Show top 3'}
            </button>
          </div>
          <div className="space-y-1.5">
            {(pairsCollapsed ? rankedPairs.slice(0, 3) : rankedPairs).map(({ a, b, r }) => {
              const hA     = holdingMap[a];
              const hB     = holdingMap[b];
              const colorA = getGicsSectorColor(normalizeSector(hA?.sector || 'Other'));
              const colorB = getGicsSectorColor(normalizeSector(hB?.sector || 'Other'));
              return (
              <div key={`${a}-${b}`} className="flex items-center gap-2">
                {/* Pair label — each ticker gets its own inline tooltip */}
                <div className="flex items-center gap-1 w-[10rem] shrink-0">

                  {/* Ticker A */}
                  <div className="relative group/pairA inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorA }} />
                    <span className="text-xs font-mono font-medium text-foreground cursor-default">{a.slice(0, 5)}</span>
                    {/* Tooltip A */}
                    <div className={cn(
                      'pointer-events-none absolute z-50 bottom-full left-0 mb-2 min-w-max',
                      'invisible opacity-0',
                      'group-hover/pairA:visible group-hover/pairA:opacity-100',
                      'transition-[opacity,visibility] duration-150 [transition-delay:350ms]',
                      'bg-popover border border-border rounded-lg shadow-lg px-2.5 py-1.5 text-left',
                    )}>
                      <p className="text-[12px] font-semibold text-foreground leading-tight">
                        {hA?.name?.trim() || a}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-mono">
                        {a}{hA?.exchange ? ` · ${hA.exchange}` : ''}
                      </p>
                      {hA?.sector && normalizeSector(hA.sector) !== 'Other' && (
                        <p className="text-[10px] text-muted-foreground leading-tight mt-1">{normalizeSector(hA.sector)}</p>
                      )}
                      {hA?.subIndustry && (
                        <p className="text-[10px] text-muted-foreground/70 leading-tight italic">{hA.subIndustry}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground/50 mx-0.5">/</span>

                  {/* Ticker B */}
                  <div className="relative group/pairB inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorB }} />
                    <span className="text-xs font-mono font-medium text-foreground cursor-default">{b.slice(0, 5)}</span>
                    {/* Tooltip B */}
                    <div className={cn(
                      'pointer-events-none absolute z-50 bottom-full left-0 mb-2 min-w-max',
                      'invisible opacity-0',
                      'group-hover/pairB:visible group-hover/pairB:opacity-100',
                      'transition-[opacity,visibility] duration-150 [transition-delay:350ms]',
                      'bg-popover border border-border rounded-lg shadow-lg px-2.5 py-1.5 text-left',
                    )}>
                      <p className="text-[12px] font-semibold text-foreground leading-tight">
                        {hB?.name?.trim() || b}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-mono">
                        {b}{hB?.exchange ? ` · ${hB.exchange}` : ''}
                      </p>
                      {hB?.sector && normalizeSector(hB.sector) !== 'Other' && (
                        <p className="text-[10px] text-muted-foreground leading-tight mt-1">{normalizeSector(hB.sector)}</p>
                      )}
                      {hB?.subIndustry && (
                        <p className="text-[10px] text-muted-foreground/70 leading-tight italic">{hB.subIndustry}</p>
                      )}
                    </div>
                  </div>

                </div>
                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(Math.abs(r) * 100)}%`, backgroundColor: pal.bg(r) }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-mono w-10 text-right shrink-0',
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
