import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Factory, ShoppingCart, AlertTriangle,
  ArrowLeftRight, CalendarDays, Grid3X3, BarChart2, Zap,
} from 'lucide-react';
import {
  COMMODITIES, CATEGORY_LABELS, CATEGORY_ORDER,
  getCommodity, getConcentration, type CommodityCategory,
} from '@/data/tradeInfrastructure/commodities';
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

// ── Commodity dropdown (unchanged) ────────────────────────────────────────────
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

  const currentLabel = useMemo(
    () => COMMODITIES.find((c) => c.id === value)?.label ?? value,
    [value],
  );

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

// ── View: Producers ────────────────────────────────────────────────────────────
function ProducersView({ selectedId }: { selectedId: string }) {
  const commodity   = useMemo(() => getCommodity(selectedId), [selectedId]);
  const maxShare    = useMemo(
    () => (commodity ? Math.max(...commodity.producers.map((p) => p.share)) : 1),
    [commodity],
  );
  const concentration = useMemo(
    () => (commodity ? getConcentration(commodity) : null),
    [commodity],
  );

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
    </>
  );
}

// ── View: Buyers ──────────────────────────────────────────────────────────────
function BuyersView({ selectedId }: { selectedId: string }) {
  const commodity  = useMemo(() => getCommodity(selectedId), [selectedId]);
  const consumers  = COMMODITY_CONSUMERS[selectedId];
  const maxShare   = useMemo(
    () => (consumers ? Math.max(...consumers.map((c) => c.share)) : 1),
    [consumers],
  );
  const topShare   = useMemo(
    () => (consumers ? consumers.slice(0, 3).reduce((s, c) => s + c.share, 0) : 0),
    [consumers],
  );

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
function MonopoliesView() {
  // Rank ALL commodities by HHI descending — most monopolised at the top.
  const ranked = useMemo(() => {
    return [...COMMODITIES]
      .map((c) => {
        const conc = getConcentration(c);
        const h    = hhi(c.producers);
        return { c, conc, hhi: h };
      })
      .sort((a, b) => b.hhi - a.hhi);
  }, []);

  const maxHhi = ranked[0]?.hhi ?? 1;

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        All commodities ranked by supply concentration (HHI).
        Higher = fewer countries control global output = greater supply-shock risk.
      </p>

      {/* Legend */}
      <div className="px-4 pb-2 flex items-center gap-3 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;2500 monopoly</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 1500-2500 moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;1500 competitive</span>
      </div>

      <ul className="px-4 pb-3 space-y-1.5">
        {ranked.map(({ c, hhi: h }, i) => {
          const dotColor =
            h > 2500 ? 'bg-red-500'     :
            h > 1500 ? 'bg-amber-500'   :
                       'bg-emerald-500';
          const barColor =
            h > 2500 ? 'bg-red-500/70'   :
            h > 1500 ? 'bg-amber-500/70' :
                       'bg-emerald-500/70';
          const barW = `${(h / maxHhi) * 100}%`;

          // Top producer flag + name for context
          const top = c.producers[0];
          const topName = top ? (COUNTRY_META[top.iso2]?.name ?? top.iso2) : '';

          return (
            <li key={c.id} className="flex items-center gap-2 text-[11px] group">
              {/* Rank */}
              <span className="text-[10px] tabular-nums text-muted-foreground/40 w-4 shrink-0 text-right">
                {i + 1}
              </span>

              {/* Concentration dot */}
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />

              {/* Commodity name */}
              <span className="truncate min-w-0 w-24 shrink-0 text-foreground/85 group-hover:text-foreground transition-colors">
                {c.label}
              </span>

              {/* Top producer flag */}
              {top && (
                <img
                  src={getFlagSrc(top.iso2)}
                  alt={topName}
                  title={`#1: ${topName} (${top.share.toFixed(0)}%)`}
                  width={16}
                  height={11}
                  className="shrink-0 rounded-[2px] ring-1 ring-border/40 object-cover opacity-80"
                />
              )}

              {/* HHI bar */}
              <span className="flex-1 h-1.5 bg-purple-500/10 rounded-full overflow-hidden min-w-0">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-300', barColor)}
                  style={{ width: barW }}
                />
              </span>

              {/* HHI value */}
              <span className="tabular-nums shrink-0 w-10 text-right text-muted-foreground/70 text-[10px]">
                {h.toFixed(0)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        HHI = Σ(shareᵢ²) · DOJ: &gt;2500 concentrated, 1500–2500 moderate, &lt;1500 competitive
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
      {view === 'producers'    && <ProducersView           selectedId={selectedId} />}
      {view === 'buyers'       && <BuyersView              selectedId={selectedId} />}
      {view === 'flow'         && <CommodityFlowView       selectedId={selectedId} />}
      {view === 'monopolies'   && <MonopoliesView />}
      {view === 'seasonal'     && <CommoditySeasonalView   selectedId={selectedId} />}
      {view === 'correlations' && <CommodityCorrelationMatrix />}
      {view === 'macro'        && <CommodityMacroView      selectedId={selectedId} />}
      {view === 'disruptions'  && <CommodityDisruptionView selectedId={selectedId} />}
    </div>
  );
}
