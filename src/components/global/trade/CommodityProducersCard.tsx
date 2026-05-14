import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Factory, ShoppingCart, AlertTriangle,
  ArrowLeftRight, CalendarDays, Grid3X3, BarChart2, Zap,
} from 'lucide-react';
import {
  COMMODITIES, CATEGORY_LABELS, CATEGORY_ORDER,
  getCommodity, getConcentration, type CommodityCategory,
} from '@/data/tradeInfrastructure/commodities';
import {
  RARE_EARTH_ELEMENTS,
  LIGHT_REE_PRODUCERS, HEAVY_REE_PRODUCERS,
  REE_CLASS_LABEL,
  getReeBySymbol,
  type RareEarthElement,
} from '@/data/rareEarthsBreakdown';
import { COMMODITY_CONSUMERS } from '@/data/tradeInfrastructure/commodityConsumers';
import { COUNTRY_META } from '@/data/countryMeta';
import { CommoditySeasonalView }      from './CommoditySeasonalView';
import { CommodityCorrelationMatrix } from './CommodityCorrelationMatrix';
import { CommodityFlowView }          from './CommodityFlowView';
import { CommodityMacroView }         from './CommodityMacroView';
import { CommodityDisruptionView }    from './CommodityDisruptionView';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type View = 'producers' | 'buyers' | 'monopolies' | 'flow' | 'seasonal' | 'correlations' | 'macro' | 'disruptions';

// ── Concentration colour palette ──────────────────────────────────────────────
const CONCENTRATION_STYLE = {
  high:   { dot: 'bg-red-500',     text: 'text-red-400',     label: 'High concentration'   },
  medium: { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Moderate'             },
  low:    { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Diversified'          },
} as const;

const DEFAULT_COMMODITY_ID = 'crude-oil';

/** Pre-group commodities by category once at module load. */
const GROUPED: Record<CommodityCategory, typeof COMMODITIES[number][]> = {
  energy: [], metals: [], agriculture: [],
};
for (const c of COMMODITIES) GROUPED[c.category].push(c);

function getFlagSrc(iso2: string): string {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

// ── HHI helper ────────────────────────────────────────────────────────────────
/**
 * Herfindahl-Hirschman Index — standard supply-concentration metric.
 * Computed as Σ(shareᵢ²) on the 0-100 scale (result is 0–10000).
 * DOJ thresholds: <1500 competitive, 1500-2500 moderate, >2500 highly concentrated.
 *
 * Rest-of-world correction: when listed producers sum to less than 100%, the
 * remaining share belongs to a diffuse "rest of world" block.  Treating it as
 * zero would understate concentration, so we add (100 − Σtop8)² as one extra
 * term.  This keeps the index mathematically consistent even for commodities
 * where top-8 coverage is only ~60-70%.
 */
function hhi(producers: readonly { share: number }[]): number {
  const top8Sum = producers.reduce((s, p) => s + p.share, 0);
  const row     = Math.max(0, 100 - top8Sum);        // rest-of-world residual
  return producers.reduce((sum, p) => sum + p.share * p.share, 0) + row * row;
}

// ── REE element selection helpers ─────────────────────────────────────────────

/** Namespace prefix for individual rare-earth element IDs in the dropdown. */
const REE_PREFIX = 'ree-';

/** Style tokens keyed by REE class. */
const REE_CLS: Record<string, { text: string; badge: string; bar: string }> = {
  light: { text: 'text-amber-400',  badge: 'bg-amber-500/15 text-amber-400  border-amber-500/30',  bar: 'bg-amber-500/70'  },
  heavy: { text: 'text-red-400',    badge: 'bg-red-500/15   text-red-400    border-red-500/30',    bar: 'bg-red-500/70'    },
  other: { text: 'text-violet-400', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', bar: 'bg-violet-500/70' },
};

/** Pre-group elements by class once. */
const REE_BY_CLASS = {
  light: RARE_EARTH_ELEMENTS.filter(e => e.class === 'light'),
  heavy: RARE_EARTH_ELEMENTS.filter(e => e.class === 'heavy'),
  other: RARE_EARTH_ELEMENTS.filter(e => e.class === 'other'),
} as const;

/**
 * Approximate global import shares for LREE oxide / metal (ex-China).
 * Japan is by far the largest importer — Toyota, TDK, Shin-Etsu all
 * depend on NdPr for NdFeB magnets.
 * Source: ITC TradeMap / Adamas Intelligence 2023 estimates.
 */
const LREE_CONSUMERS = [
  { iso2: 'JP', share: 40.0 },
  { iso2: 'US', share: 17.0 },
  { iso2: 'DE', share:  9.0 },
  { iso2: 'KR', share:  7.0 },
  { iso2: 'NL', share:  6.0 },
  { iso2: 'FR', share:  5.0 },
  { iso2: 'IN', share:  4.0 },
] as const;

/**
 * Approximate global import shares for HREE oxide / metal (ex-China).
 * Japan's share is even higher for HREEs — Shin-Etsu, TDK, and Hitachi
 * use the bulk of global Dy/Tb output for high-performance NdFeB magnets.
 * Source: ITC TradeMap / Adamas Intelligence 2023 estimates.
 */
const HREE_CONSUMERS = [
  { iso2: 'JP', share: 50.0 },
  { iso2: 'US', share: 15.0 },
  { iso2: 'DE', share: 10.0 },
  { iso2: 'KR', share:  8.0 },
  { iso2: 'FR', share:  5.0 },
  { iso2: 'UK', share:  3.0 },
  { iso2: 'IN', share:  2.5 },
] as const;

/**
 * Resolve an individual REE element ID (`'ree-Nd'`) to the parent
 * commodity ID (`'rare-earths'`) for views that don't have element-level
 * data.  All other IDs are returned unchanged.
 */
function resolveToBloc(id: string): string {
  return id.startsWith(REE_PREFIX) ? 'rare-earths' : id;
}

/**
 * Thin identity strip shown above views that fall back to the REMX/bloc
 * dataset when a specific REE element is selected.  Keeps the user aware
 * of which element they've selected without hiding the underlying chart.
 */
function ReeElementStrip({ symbol }: { symbol: string }) {
  const el = getReeBySymbol(symbol);
  if (!el) return null;
  const cs = REE_CLS[el.class] ?? REE_CLS['other'];
  return (
    <div className="px-4 pb-1 flex items-center gap-2">
      <span className={cn(
        'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
        cs.badge,
      )}>
        {el.symbol}
      </span>
      <span className="text-[11px] font-semibold">{el.name}</span>
      <span className="text-[9px] text-amber-400/70 italic ml-auto">
        → showing REE bloc data (REMX)
      </span>
    </div>
  );
}

/**
 * Inline dropdown sub-group that expands the "Rare Earths" commodity into all
 * 17 individual elements, grouped Light → Heavy → Y/Sc. Each element is a
 * selectable button that sets selectedId to `'ree-{symbol}'`.
 */
function ReeDropdownGroup({
  selectedId,
  onChange,
}: {
  selectedId: string;
  onChange:   (id: string) => void;
}) {
  return (
    <div className="px-1.5 py-1">
      {/* Section label */}
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Rare Earths
        </span>
        <span className="flex-1 border-t border-border/30" />
      </div>

      {(['light', 'heavy', 'other'] as const).map((cls) => (
        <div key={cls} className="mb-1.5">
          {/* Class sub-label */}
          <div className="px-1 pb-0.5">
            <span className={cn('text-[8px] uppercase tracking-widest font-semibold', REE_CLS[cls].text)}>
              {REE_CLASS_LABEL[cls]}
            </span>
          </div>
          {/* Element grid — 2 columns for compactness */}
          <div className="grid grid-cols-2 gap-0.5">
            {REE_BY_CLASS[cls].map((el) => {
              const id       = `${REE_PREFIX}${el.symbol}`;
              const selected = selectedId === id;
              return (
                <button
                  key={el.symbol}
                  type="button"
                  data-selected={selected}
                  onClick={() => onChange(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors duration-75',
                    selected
                      ? cn('border text-foreground font-semibold', REE_CLS[cls].badge)
                      : 'hover:bg-accent text-foreground/80 hover:text-foreground',
                  )}
                >
                  <span className={cn('font-mono text-[10px] font-bold w-4 shrink-0 tabular-nums', REE_CLS[cls].text)}>
                    {el.symbol}
                  </span>
                  <span className="text-[10px] truncate leading-none">{el.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Commodity dropdown ────────────────────────────────────────────────────────
function CommodityDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentLabel = useMemo(() => {
    // REE element selection: 'ree-Nd' → 'Nd · Neodymium'
    if (value.startsWith(REE_PREFIX)) {
      const el = getReeBySymbol(value.slice(REE_PREFIX.length));
      return el ? `${el.symbol} · ${el.name}` : value;
    }
    return COMMODITIES.find((c) => c.id === value)?.label ?? value;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, { passive: true });
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-full flex items-center justify-between gap-2',
          'h-8 px-3 rounded-md text-xs font-medium',
          'border bg-background text-foreground transition-colors duration-100',
          open
            ? 'border-purple-500/60 ring-1 ring-purple-500/40'
            : 'border-input hover:border-purple-500/50 hover:bg-purple-500/5',
        ].join(' ')}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className={[
            'absolute left-0 right-0 z-[200] mt-1',
            'bg-popover text-popover-foreground',
            'border border-border rounded-md shadow-lg',
            'max-h-56 overflow-y-auto overscroll-contain',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border',
          ].join(' ')}
        >
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              <div className="sticky top-0 z-10 px-2 pt-2 pb-1 bg-popover/95 backdrop-blur-sm">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-400/80">
                  {CATEGORY_LABELS[cat]}
                </span>
              </div>
              {GROUPED[cat].map((c) => {
                // "Rare Earths" expands inline into all 17 individual elements.
                if (c.id === 'rare-earths') {
                  return (
                    <ReeDropdownGroup
                      key="ree-group"
                      selectedId={value}
                      onChange={(id) => { onChange(id); setOpen(false); }}
                    />
                  );
                }

                const selected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-selected={selected}
                    onClick={() => { onChange(c.id); setOpen(false); }}
                    className={[
                      'w-full flex items-center justify-between gap-2',
                      'px-3 py-1.5 text-xs rounded-sm transition-colors duration-75',
                      selected
                        ? 'bg-purple-500/20 text-purple-300 font-medium'
                        : 'text-foreground/90 hover:bg-accent hover:text-accent-foreground',
                    ].join(' ')}
                  >
                    <span className="truncate">{c.label}</span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {c.producers.slice(0, 5).map((p) => (
                        <img
                          key={p.iso2}
                          src={`https://flagcdn.com/w40/${p.iso2.toLowerCase()}.png`}
                          alt={p.iso2}
                          className="h-4 w-auto rounded-[1px] ring-1 ring-border/40 object-cover opacity-80"
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
              {cat !== CATEGORY_ORDER[CATEGORY_ORDER.length - 1] && (
                <div className="mx-2 my-1 border-t border-border/50" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared ranked-list row ─────────────────────────────────────────────────────
function CountryRow({
  rank,
  iso2,
  share,
  maxShare,
  barColor = 'bg-purple-500/70',
}: {
  rank:      number;
  iso2:      string;
  share:     number;
  maxShare:  number;
  barColor?: string;
}) {
  const name     = COUNTRY_META[iso2]?.name ?? iso2;
  const barWidth = `${(share / maxShare) * 100}%`;
  return (
    <li className="flex items-center gap-2 text-xs group">
      <span className="text-[10px] tabular-nums text-muted-foreground/40 w-3 shrink-0 text-right">
        {rank}
      </span>
      <img
        src={getFlagSrc(iso2)}
        alt=""
        width={20}
        height={14}
        className="shrink-0 rounded-[2px] ring-1 ring-border/50 object-cover"
      />
      <span
        className="truncate min-w-0 flex-1 text-foreground/85 group-hover:text-foreground transition-colors duration-75"
        title={name}
      >
        {name}
      </span>
      <span className="tabular-nums shrink-0 w-9 text-right text-muted-foreground group-hover:text-foreground/80 transition-colors duration-75">
        {share.toFixed(1)}%
      </span>
      <span className="w-14 h-1.5 bg-purple-500/10 rounded-full overflow-hidden shrink-0">
        <span
          className={cn('block h-full rounded-full transition-[width] duration-300', barColor)}
          style={{ width: barWidth }}
        />
      </span>
    </li>
  );
}

// ── REE element producers view ────────────────────────────────────────────────
/**
 * Shown when the user selects an individual rare-earth element (e.g. 'ree-Nd').
 * Uses the class-level producer array (Light or Heavy REE) as a proxy for the
 * individual element — all elements in a class are co-mined from the same
 * deposit types, so the supply-chain geography is the same.
 */
function ReeElementProducersView({ element }: { element: RareEarthElement }) {
  // Y and Sc ('other') co-occur geographically with HREEs
  const producers = element.class === 'light' ? LIGHT_REE_PRODUCERS : HEAVY_REE_PRODUCERS;
  const maxShare  = Math.max(...producers.map(p => p.share));
  const top3Share = producers.slice(0, 3).reduce((s, p) => s + p.share, 0);
  const isHeavy   = element.class !== 'light';
  const cStyle    = REE_CLS[element.class] ?? REE_CLS['other'];
  const dotColor  = top3Share >= 80 ? 'bg-red-500' : top3Share >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  const concLabel = top3Share >= 80 ? 'High concentration' : top3Share >= 60 ? 'Moderate' : 'Diversified';
  const concText  = top3Share >= 80 ? 'text-red-400' : top3Share >= 60 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <>
      {/* ── Element identity card ───────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Large symbol badge */}
          <div className={cn(
            'shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center border',
            cStyle.badge,
          )}>
            <span className={cn('font-mono font-bold text-base leading-none', cStyle.text)}>
              {element.symbol}
            </span>
            <span className="text-[9px] text-muted-foreground/60 tabular-nums leading-none mt-0.5">
              {element.atomicNumber}
            </span>
          </div>

          {/* Name + class + price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold">{element.name}</span>
              <span className={cn(
                'text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border',
                cStyle.badge,
              )}>
                {REE_CLASS_LABEL[element.class]}
              </span>
            </div>
            {element.priceRangeUsd ? (
              <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                ≈ ${element.priceRangeUsd[0]}–${element.priceRangeUsd[1]}/kg oxide
                <span className="text-muted-foreground/50"> · Asian Metal/SMM 2024</span>
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground/50 mt-0.5 italic">
                No commercial market price
              </div>
            )}
            {element.proxy && (
              <div className="text-[10px] font-mono mt-0.5">
                <span className="text-muted-foreground/60">Proxy: </span>
                <span className="text-primary/80">{element.proxy}</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary use */}
        <p className="text-[11px] text-muted-foreground leading-snug mt-2 italic">
          {element.primaryUse}
        </p>
      </div>

      {/* ── Concentration summary ───────────────────────────────────────── */}
      <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
        <span className="text-foreground/85">
          Top 3 control{' '}
          <span className="font-semibold tabular-nums">{top3Share.toFixed(0)}%</span>{' '}
          of {isHeavy ? 'heavy' : 'light'} REE supply
        </span>
        <span className={cn('ml-auto text-[10px] uppercase tracking-wide font-medium', concText)}>
          {concLabel}
        </span>
      </div>

      {/* ── Producer list ───────────────────────────────────────────────── */}
      <ul className="px-4 pb-2 space-y-1.5">
        {producers.map((p, i) => (
          <CountryRow
            key={p.iso2}
            rank={i + 1}
            iso2={p.iso2}
            share={p.share}
            maxShare={maxShare}
            barColor={cStyle.bar}
          />
        ))}
      </ul>

      {/* ── Element-specific supply note ────────────────────────────────── */}
      <div className="mx-4 mb-3 p-2.5 rounded-md border border-border/40 bg-muted/10">
        <p className="text-[10px] text-muted-foreground/80 leading-snug">
          {element.supplyNote}
        </p>
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        USGS / Adamas Intelligence 2023 ·{' '}
        {isHeavy ? 'Heavy' : 'Light'} REE supply proxy ·{' '}
        share of global {isHeavy ? 'ion-adsorption clay' : 'hard-rock mine'} output
      </p>
    </>
  );
}

// ── View: Producers ────────────────────────────────────────────────────────────
function ProducersView({ selectedId }: { selectedId: string }) {
  // Always call hooks first — no early returns before hook calls.
  const isRee     = selectedId.startsWith(REE_PREFIX);
  const reeSymbol = isRee ? selectedId.slice(REE_PREFIX.length) : null;

  const commodity     = useMemo(() => (!isRee ? getCommodity(selectedId) : null), [isRee, selectedId]);
  const maxShare      = useMemo(() => (commodity ? Math.max(...commodity.producers.map(p => p.share)) : 1), [commodity]);
  const concentration = useMemo(() => (commodity ? getConcentration(commodity) : null), [commodity]);

  // ── REE individual element ──────────────────────────────────────────────
  if (isRee) {
    const element = reeSymbol ? getReeBySymbol(reeSymbol) : undefined;
    if (!element) return null;
    return <ReeElementProducersView element={element} />;
  }

  // ── Normal commodity ────────────────────────────────────────────────────
  if (!commodity || !concentration) return null;
  const concStyle = CONCENTRATION_STYLE[concentration.level];

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        {commodity.useCase}
      </p>
      <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', concStyle.dot)} />
        <span className="text-foreground/85">
          Top 3 control{' '}
          <span className="font-semibold tabular-nums">{concentration.top3Share.toFixed(0)}%</span>{' '}
          of supply
        </span>
        <span className={cn('ml-auto text-[10px] uppercase tracking-wide font-medium', concStyle.text)}>
          {concStyle.label}
        </span>
      </div>
      <ul className="px-4 pb-2 space-y-1.5">
        {commodity.producers.map((p, i) => (
          <CountryRow key={p.iso2} rank={i + 1} iso2={p.iso2} share={p.share} maxShare={maxShare} />
        ))}
        {concentration.restShare > 0.5 && (
          <li className="flex items-center gap-2 text-xs pt-1 mt-1 border-t border-border/40 text-muted-foreground/60">
            <span className="text-[10px] tabular-nums w-3 shrink-0 text-right">—</span>
            <span className="shrink-0 w-5 h-[14px] rounded-[2px] ring-1 ring-border/40 bg-muted/40" />
            <span className="truncate min-w-0 flex-1 italic">Rest of world</span>
            <span className="tabular-nums shrink-0 w-9 text-right">{concentration.restShare.toFixed(1)}%</span>
            <span className="w-14 h-1.5 bg-muted/30 rounded-full overflow-hidden shrink-0">
              <span
                className="block h-full bg-muted-foreground/40 rounded-full transition-[width] duration-300"
                style={{ width: `${(concentration.restShare / maxShare) * 100}%` }}
              />
            </span>
          </li>
        )}
      </ul>
      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        {commodity.source} · {commodity.year} · share of global production ({commodity.unit})
      </p>

      {/* ── Rare-earths only: Light vs Heavy split ──────────────────────── */}
      {commodity.id === 'rare-earths' && <ReeSubclassSplit />}
    </>
  );
}

/**
 * ReeSubclassSplit — extra section that appears below the producers list
 * when the user selects "Rare Earths". The bloc-level 68% China share
 * hides two very different supply chains: Light REE (more diversified,
 * Mountain Pass / Mt Weld) vs Heavy REE (China + Myanmar ion clays, ~95%).
 */
function ReeSubclassSplit() {
  const lightMax = Math.max(...LIGHT_REE_PRODUCERS.map(p => p.share));
  const heavyMax = Math.max(...HEAVY_REE_PRODUCERS.map(p => p.share));
  const lightTop3 = LIGHT_REE_PRODUCERS.slice(0, 3).reduce((s, p) => s + p.share, 0);
  const heavyTop3 = HEAVY_REE_PRODUCERS.slice(0, 3).reduce((s, p) => s + p.share, 0);

  return (
    <div className="mx-4 mb-3 rounded-md border border-border/50 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Behind the bloc — Light vs Heavy
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground/60 italic">
          USGS / Adamas 2023
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/80 leading-snug mb-2">
        Light REEs (Nd, Pr, Ce, La, Sm, Eu) come from monazite / bastnäsite hardrock
        mines — moderately diversified. Heavy REEs (Dy, Tb, Y, etc.) come almost
        entirely from ion-adsorption clays in southern China + Myanmar.
      </p>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <ReeSplitColumn
          title="Light (LREE)"
          accent="text-amber-400"
          chip="bg-amber-500/15 text-amber-400"
          producers={LIGHT_REE_PRODUCERS}
          maxShare={lightMax}
          top3={lightTop3}
          barColor="bg-amber-500/70"
        />
        <ReeSplitColumn
          title="Heavy (HREE)"
          accent="text-red-400"
          chip="bg-red-500/15 text-red-400"
          producers={HEAVY_REE_PRODUCERS}
          maxShare={heavyMax}
          top3={heavyTop3}
          barColor="bg-red-500/70"
        />
      </div>

      <p className="text-[9px] text-muted-foreground/60 italic leading-snug mt-2">
        See the 17-element breakdown card below for per-element use, price,
        and equity proxy.
      </p>
    </div>
  );
}

function ReeSplitColumn({
  title, accent, chip, producers, maxShare, top3, barColor,
}: {
  title:     string;
  accent:    string;
  chip:      string;
  producers: { iso2: string; share: number }[];
  maxShare:  number;
  top3:      number;
  barColor:  string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', accent)}>
          {title}
        </span>
        <span className={cn('text-[9px] px-1 rounded tabular-nums', chip)}>
          Top 3: {top3.toFixed(0)}%
        </span>
      </div>
      <ul className="space-y-1">
        {producers.slice(0, 5).map((p, i) => (
          <li key={p.iso2} className="flex items-center gap-1.5 text-[10px] group">
            <span className="text-muted-foreground/40 w-2 text-right tabular-nums">{i + 1}</span>
            <img
              src={`https://flagcdn.com/w40/${p.iso2.toLowerCase()}.png`}
              alt=""
              width={14}
              className="rounded-[1px] ring-1 ring-border/40 shrink-0"
            />
            <span className="truncate flex-1 text-foreground/85">
              {COUNTRY_META[p.iso2]?.name ?? p.iso2}
            </span>
            <span className="tabular-nums w-8 text-right text-muted-foreground">
              {p.share.toFixed(1)}%
            </span>
            <span className="w-8 h-1 bg-muted/30 rounded-full overflow-hidden shrink-0">
              <span
                className={cn('block h-full rounded-full', barColor)}
                style={{ width: `${(p.share / maxShare) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── View: Buyers (REE element variant) ────────────────────────────────────────
/**
 * Shown when the user selects an individual REE element.
 * Uses class-level import data (LREE vs HREE) as the proxy — all elements
 * in a class are traded as mixed oxides and follow the same import geography.
 */
function ReeElementBuyersView({ element }: { element: RareEarthElement }) {
  const consumers = element.class === 'light'
    ? (LREE_CONSUMERS as readonly { iso2: string; share: number }[])
    : (HREE_CONSUMERS as readonly { iso2: string; share: number }[]);
  const maxShare  = Math.max(...consumers.map(c => c.share));
  const topShare  = consumers.slice(0, 3).reduce((s, c) => s + c.share, 0);
  const isHeavy   = element.class !== 'light';
  const cs        = REE_CLS[element.class] ?? REE_CLS['other'];

  return (
    <>
      {/* Element identity strip */}
      <div className="px-4 pb-2 flex items-start gap-3">
        <div className={cn(
          'shrink-0 w-9 h-9 rounded flex flex-col items-center justify-center border',
          cs.badge,
        )}>
          <span className={cn('font-mono font-bold text-sm leading-none', cs.text)}>
            {element.symbol}
          </span>
          <span className="text-[8px] text-muted-foreground/60 tabular-nums leading-none mt-0.5">
            {element.atomicNumber}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">{element.name}</span>
            <span className={cn('text-[9px] uppercase tracking-wide px-1 py-px rounded border', cs.badge)}>
              {REE_CLASS_LABEL[element.class]}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5 italic">
            {element.primaryUse}
          </p>
        </div>
      </div>

      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Countries that import separated {element.name.toLowerCase()} oxide / metal for downstream
        manufacturing. {isHeavy
          ? 'Japan takes ~half of all global HREE imports for its magnet industry.'
          : 'Japan and the US together account for over half of LREE oxide imports.'}
      </p>

      <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
        <ShoppingCart className="w-3 h-3 text-blue-400 shrink-0" />
        <span className="text-foreground/85">
          Top 3 importers take{' '}
          <span className="font-semibold tabular-nums">{topShare.toFixed(0)}%</span>{' '}
          of {isHeavy ? 'HREE' : 'LREE'} imports
        </span>
        {topShare >= 65 && (
          <span className="ml-auto text-[10px] uppercase tracking-wide font-medium text-amber-400">
            Import concentration
          </span>
        )}
      </div>

      <ul className="px-4 pb-2 space-y-1.5">
        {consumers.map((c, i) => (
          <CountryRow
            key={c.iso2}
            rank={i + 1}
            iso2={c.iso2}
            share={c.share}
            maxShare={maxShare}
            barColor="bg-blue-500/70"
          />
        ))}
        {/* Rest of world */}
        {(() => {
          const rest = Math.max(0, 100 - consumers.reduce((s, c) => s + c.share, 0));
          if (rest < 1) return null;
          return (
            <li className="flex items-center gap-2 text-xs pt-1 mt-1 border-t border-border/40 text-muted-foreground/60">
              <span className="text-[10px] tabular-nums w-4 shrink-0 text-right">—</span>
              <span className="shrink-0 w-5 h-[14px] rounded-[2px] ring-1 ring-border/40 bg-muted/40" />
              <span className="truncate min-w-0 flex-1 italic">Rest of world</span>
              <span className="tabular-nums shrink-0 w-9 text-right">{rest.toFixed(1)}%</span>
              <span className="w-14 h-1.5 bg-muted/30 rounded-full overflow-hidden shrink-0">
                <span
                  className="block h-full bg-muted-foreground/40 rounded-full"
                  style={{ width: `${(rest / maxShare) * 100}%` }}
                />
              </span>
            </li>
          );
        })()}
      </ul>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        ITC TradeMap / Adamas Intelligence 2023 ·{' '}
        {isHeavy ? 'HREE' : 'LREE'} oxide/metal imports (ex-China production) ·{' '}
        share of global import volume
      </p>
    </>
  );
}

// ── View: Buyers ──────────────────────────────────────────────────────────────
function BuyersView({ selectedId }: { selectedId: string }) {
  const isRee     = selectedId.startsWith(REE_PREFIX);
  const reeSymbol = isRee ? selectedId.slice(REE_PREFIX.length) : null;

  // Always call all hooks before any conditional return
  const commodity = useMemo(
    () => (!isRee ? getCommodity(selectedId) : null),
    [isRee, selectedId],
  );
  const consumers = isRee ? null : COMMODITY_CONSUMERS[selectedId];
  const maxShare  = useMemo(
    () => (consumers ? Math.max(...consumers.map((c) => c.share)) : 1),
    [consumers],
  );
  const topShare  = useMemo(
    () => (consumers ? consumers.slice(0, 3).reduce((s, c) => s + c.share, 0) : 0),
    [consumers],
  );

  // REE element path
  if (isRee) {
    const element = reeSymbol ? getReeBySymbol(reeSymbol) : undefined;
    if (!element) return null;
    return <ReeElementBuyersView element={element} />;
  }

  if (!commodity) return null;

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Countries most dependent on importing {commodity.label.toLowerCase()}.
      </p>

      {consumers ? (
        <>
          <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
            <ShoppingCart className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-foreground/85">
              Top 3 buyers take{' '}
              <span className="font-semibold tabular-nums">{topShare.toFixed(0)}%</span>{' '}
              of global imports
            </span>
            {topShare >= 60 && (
              <span className="ml-auto text-[10px] uppercase tracking-wide font-medium text-red-400">
                Buyer monopoly
              </span>
            )}
          </div>
          <ul className="px-4 pb-2 space-y-1.5">
            {consumers.map((c, i) => (
              <CountryRow
                key={c.iso2}
                rank={i + 1}
                iso2={c.iso2}
                share={c.share}
                maxShare={maxShare}
                barColor="bg-blue-500/70"
              />
            ))}
          </ul>
          <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
            UN Comtrade / USDA FAS · 2022-23 · share of global imports
          </p>
        </>
      ) : (
        <p className="px-4 pb-4 text-xs text-muted-foreground/60 italic">
          Import data not yet available for {commodity.label}.
        </p>
      )}
    </>
  );
}

// ── View: Monopolies (cross-commodity concentration ranking) ──────────────────
/**
 * Ranks ALL commodities AND all individual rare-earth elements by supply
 * concentration.  Includes sort + filter controls so the user can slice by
 * category (Energy / Metals / Agri / REE) and risk level (Monopoly / etc.).
 */
function MonopoliesView({ onSelect }: { onSelect?: (id: string) => void }) {
  type SortKey      = 'conc-desc' | 'conc-asc' | 'az';
  type CatFilter    = 'all' | 'energy' | 'metals' | 'agriculture' | 'ree';
  type RiskFilter   = 'all' | 'monopoly' | 'concentrated' | 'diversified';

  const [sort,       setSort]       = useState<SortKey>('conc-desc');
  const [catFilter,  setCatFilter]  = useState<CatFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  type RankedEntry = {
    type:      'commodity' | 'ree';
    id:        string;
    label:     string;
    category:  'energy' | 'metals' | 'agriculture' | 'ree';
    topShare:  number;
    top:       { iso2: string; share: number } | null;
    element:   RareEarthElement | null;
    sepPct:    number;
  };

  const ranked = useMemo<RankedEntry[]>(() => {
    const regular: RankedEntry[] = COMMODITIES
      .filter(c => c.id !== 'rare-earths')
      .map(c => ({
        type:     'commodity',
        id:       c.id,
        label:    c.label,
        category: c.category,
        topShare: c.producers[0]?.share ?? 0,
        top:      c.producers[0] ?? null,
        element:  null,
        sepPct:   0,
      }));

    const reeEntries: RankedEntry[] = RARE_EARTH_ELEMENTS
      .filter(e => e.miningChinaPct > 0)
      .map(e => {
        const producers = e.class === 'light' ? LIGHT_REE_PRODUCERS : HEAVY_REE_PRODUCERS;
        return {
          type:     'ree',
          id:       `${REE_PREFIX}${e.symbol}`,
          label:    e.name,
          category: 'ree' as const,
          topShare: e.miningChinaPct,
          top:      producers[0] ?? null,
          element:  e,
          sepPct:   e.separationChinaPct,
        };
      });

    return [...regular, ...reeEntries].sort((a, b) => {
      if (b.topShare !== a.topShare) return b.topShare - a.topShare;
      return b.sepPct - a.sepPct;
    });
  }, []);

  // Apply active filters + sort
  const displayed = useMemo(() => {
    let list = [...ranked];
    if (catFilter !== 'all')             list = list.filter(e => e.category === catFilter);
    if (riskFilter === 'monopoly')       list = list.filter(e => e.topShare >= 70);
    if (riskFilter === 'concentrated')   list = list.filter(e => e.topShare >= 40 && e.topShare < 70);
    if (riskFilter === 'diversified')    list = list.filter(e => e.topShare < 40);
    if (sort === 'conc-asc')             list.sort((a, b) => a.topShare - b.topShare);
    else if (sort === 'az')              list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [ranked, catFilter, riskFilter, sort]);

  // Chip button helper
  function Chip<T extends string>({
    value, active, onClick, children,
  }: { value: T; active: boolean; onClick: (v: T) => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={() => onClick(value)}
        className={cn(
          'px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors leading-none',
          active
            ? 'bg-purple-600 text-white'
            : 'border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Ranked by the leading country's share of global supply. REE rows show
        China's mining share — hover the flag for sep% (refining chokepoint).
        Click any REE to view its producers.
      </p>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="px-4 pb-2 space-y-1.5">
        {/* Sort */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-8 shrink-0">
            Sort
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <Chip value="conc-desc" active={sort === 'conc-desc'} onClick={setSort}>% High ↓</Chip>
            <Chip value="conc-asc"  active={sort === 'conc-asc'}  onClick={setSort}>% Low ↑</Chip>
            <Chip value="az"        active={sort === 'az'}         onClick={setSort}>A–Z</Chip>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-8 shrink-0">
            Type
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <Chip value="all"         active={catFilter === 'all'}         onClick={setCatFilter}>All</Chip>
            <Chip value="energy"      active={catFilter === 'energy'}      onClick={setCatFilter}>⚡ Energy</Chip>
            <Chip value="metals"      active={catFilter === 'metals'}      onClick={setCatFilter}>⚙ Metals</Chip>
            <Chip value="agriculture" active={catFilter === 'agriculture'} onClick={setCatFilter}>🌾 Agri</Chip>
            <Chip value="ree"         active={catFilter === 'ree'}         onClick={setCatFilter}>✦ REE</Chip>
          </div>
        </div>

        {/* Risk level filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 w-8 shrink-0">
            Risk
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <Chip value="all"          active={riskFilter === 'all'}          onClick={setRiskFilter}>Any</Chip>
            <Chip value="monopoly"     active={riskFilter === 'monopoly'}     onClick={setRiskFilter}><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1 align-middle" />≥70%</Chip>
            <Chip value="concentrated" active={riskFilter === 'concentrated'} onClick={setRiskFilter}><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 align-middle" />40–70%</Chip>
            <Chip value="diversified"  active={riskFilter === 'diversified'}  onClick={setRiskFilter}><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 align-middle" />&lt;40%</Chip>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/50 flex-wrap border-t border-border/30 pt-1.5">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> monopoly</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> concentrated</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> diversified</span>
        <span className="ml-auto tabular-nums text-muted-foreground/40">{displayed.length} shown</span>
      </div>

      <ul className="px-4 pb-3 space-y-1">
        {displayed.map(({ type, id, label, topShare, top, element }, i) => {
          const dotColor = topShare >= 70 ? 'bg-red-500'    : topShare >= 40 ? 'bg-amber-500'    : 'bg-emerald-500';
          const barColor = topShare >= 70 ? 'bg-red-500/70' : topShare >= 40 ? 'bg-amber-500/70' : 'bg-emerald-500/70';
          // Bar width IS the percentage — no scaling needed (0–100 range)
          const barW     = `${topShare}%`;
          const cs       = element ? (REE_CLS[element.class] ?? REE_CLS['other']) : null;
          const topName  = top ? (COUNTRY_META[top.iso2]?.name ?? top.iso2) : '';
          const isReeRow = type === 'ree' && !!element && !!cs;

          /**
           * ── Unified row template ─────────────────────────────────────────
           * All entries — commodity and REE — use identical column widths so
           * the bars and HHI values stay perfectly aligned.
           *
           * Columns (L→R):
           *   rank    w-4  fixed
           *   dot     w-2  fixed
           *   name    flex-1  (truncated)
           *   info    w-12 fixed  ← flag for commodity / sep% chip for REE
           *   bar     w-16 fixed
           *   hhi     w-10 fixed
           */
          return (
            <li
              key={id}
              title={isReeRow ? `${element!.name} — click to view producers` : undefined}
              onClick={isReeRow ? () => onSelect?.(id) : undefined}
              className={cn(
                'flex items-center gap-2 text-[11px] group rounded-sm px-1 -mx-1',
                isReeRow
                  ? cn('cursor-pointer hover:bg-muted/20', cs!.text.replace('text-', 'hover:bg-').replace('400', '500/5'))
                  : 'hover:bg-muted/10',
              )}
            >
              {/* 1 ── Rank */}
              <span className="text-[10px] tabular-nums text-muted-foreground/40 w-4 shrink-0 text-right leading-none">
                {i + 1}
              </span>

              {/* 2 ── Concentration dot */}
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />

              {/* 3 ── Name (flex-1 for both types) */}
              <span className="truncate min-w-0 flex-1 transition-colors group-hover:text-foreground text-foreground/85">
                {isReeRow && element && cs ? (
                  <>
                    <span className={cn('font-mono font-bold text-[10px]', cs.text)}>
                      {element.symbol}
                    </span>
                    <span className="text-muted-foreground/50 mx-0.5">·</span>
                    <span>{element.name}</span>
                  </>
                ) : (
                  label
                )}
              </span>

              {/* 4 ── Info slot — FIXED w-12 keeps bar column aligned */}
              <div className="w-12 shrink-0 flex items-center justify-end">
                {isReeRow && element ? (
                  /* REE: China flag (always #1) — sep% shown in tooltip */
                  <img
                    src={getFlagSrc('cn')}
                    alt="China"
                    title={`#1: China — mining ${element.miningChinaPct}% · separation ${element.separationChinaPct}%`}
                    width={16}
                    height={11}
                    className="rounded-[2px] ring-1 ring-border/40 object-cover opacity-80"
                  />
                ) : top ? (
                  /* Commodity: top-producer flag */
                  <img
                    src={getFlagSrc(top.iso2)}
                    alt=""
                    title={`#1: ${topName} (${top.share.toFixed(0)}%)`}
                    width={16}
                    height={11}
                    className="rounded-[2px] ring-1 ring-border/40 object-cover opacity-80"
                  />
                ) : null}
              </div>

              {/* 5 ── HHI bar — FIXED w-16 */}
              <span className="w-16 h-1.5 bg-purple-500/10 rounded-full overflow-hidden shrink-0">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-300', barColor)}
                  style={{ width: barW }}
                />
              </span>

              {/* 6 ── Leading-country share % */}
              <span className="tabular-nums shrink-0 w-10 text-right text-muted-foreground/60 text-[10px] leading-none">
                {topShare.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        % = leading country's share of global supply · USGS / Adamas 2024 ·
        REE sep% = China's separation share (refining chokepoint, always higher than mining)
      </p>
    </>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function CommodityProducersCard() {
  const [view, setView]           = useState<View>('producers');
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_COMMODITY_ID);

  // 8 views in two rows of 4
  const VIEW_CONFIG: { id: View; label: string; icon: React.ReactNode; tip: string; needsDropdown: boolean }[] = [
    { id: 'producers',    label: 'Producers',    icon: <Factory       className="w-3 h-3" />, tip: 'Top producing countries by output share',                needsDropdown: true  },
    { id: 'buyers',       label: 'Buyers',       icon: <ShoppingCart  className="w-3 h-3" />, tip: 'Top importing countries by import share',                needsDropdown: true  },
    { id: 'flow',         label: 'Flow',         icon: <ArrowLeftRight className="w-3 h-3" />, tip: 'Producer–buyer overlap and net trade balance',           needsDropdown: true  },
    { id: 'monopolies',   label: 'Monopolies',   icon: <AlertTriangle className="w-3 h-3" />, tip: 'All commodities ranked by supply concentration (HHI)',   needsDropdown: false },
    { id: 'seasonal',     label: 'Seasonal',     icon: <CalendarDays  className="w-3 h-3" />, tip: 'Average monthly returns across 5 years',                 needsDropdown: true  },
    { id: 'correlations', label: 'Correlations', icon: <Grid3X3       className="w-3 h-3" />, tip: '9×9 commodity inter-correlation matrix',                 needsDropdown: false },
    { id: 'macro',        label: 'Macro',        icon: <BarChart2     className="w-3 h-3" />, tip: 'Sensitivity to USD, real yields, and equity risk',       needsDropdown: true  },
    { id: 'disruptions',  label: 'Disruptions',  icon: <Zap           className="w-3 h-3" />, tip: 'Live conflict + earthquake alerts in producing regions', needsDropdown: true  },
  ];

  const active = VIEW_CONFIG.find((v) => v.id === view)!;

  return (
    <div className="border-t border-border bg-purple-500/5">
      {/* ── Header: title + view toggle ────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
            {active.icon}
            {active.label}
          </span>
        </div>

        {/* 2-row × 4-col toggle grid */}
        <div className="grid grid-cols-4 gap-1 text-[9px]">
          {VIEW_CONFIG.map((v) => (
            <button
              key={v.id}
              title={v.tip}
              onClick={() => setView(v.id)}
              className={cn(
                'flex items-center justify-center gap-1 px-1.5 py-1 rounded transition-colors',
                view === v.id
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'border border-border/60 hover:bg-muted text-muted-foreground',
              )}
            >
              {v.icon}
              <span className="truncate">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Commodity dropdown — hidden on views that show all commodities */}
      {active.needsDropdown && (
        <div className="px-4 pb-3">
          <CommodityDropdown value={selectedId} onChange={setSelectedId} />
        </div>
      )}

      {/* ── Active view ─────────────────────────────────────────────────── */}
      {view === 'producers'    && <ProducersView  selectedId={selectedId} />}
      {view === 'buyers'       && <BuyersView     selectedId={selectedId} />}

      {/* Monopolies: 16 REE elements now inline in the ranked list.
          Clicking an REE row navigates to that element in Producers view. */}
      {view === 'monopolies' && (
        <MonopoliesView
          onSelect={(id) => { setSelectedId(id); setView('producers'); }}
        />
      )}

      {/* Flow / Seasonal / Macro / Disruptions — these views don't have
          per-element REE data.  We fall back to the 'rare-earths' bloc
          (REMX.US) and show a small element-identity strip so the user
          can see which element they had selected. */}
      {view === 'flow' && (
        <>
          {selectedId.startsWith(REE_PREFIX) && (
            <ReeElementStrip symbol={selectedId.slice(REE_PREFIX.length)} />
          )}
          <CommodityFlowView selectedId={resolveToBloc(selectedId)} />
        </>
      )}
      {view === 'seasonal' && (
        <>
          {selectedId.startsWith(REE_PREFIX) && (
            <ReeElementStrip symbol={selectedId.slice(REE_PREFIX.length)} />
          )}
          <CommoditySeasonalView selectedId={resolveToBloc(selectedId)} />
        </>
      )}
      {view === 'correlations' && <CommodityCorrelationMatrix />}
      {view === 'macro' && (
        <>
          {selectedId.startsWith(REE_PREFIX) && (
            <ReeElementStrip symbol={selectedId.slice(REE_PREFIX.length)} />
          )}
          <CommodityMacroView selectedId={resolveToBloc(selectedId)} />
        </>
      )}
      {view === 'disruptions' && (
        <>
          {selectedId.startsWith(REE_PREFIX) && (
            <ReeElementStrip symbol={selectedId.slice(REE_PREFIX.length)} />
          )}
          <CommodityDisruptionView selectedId={resolveToBloc(selectedId)} />
        </>
      )}
    </div>
  );
}
