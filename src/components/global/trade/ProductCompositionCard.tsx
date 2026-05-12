import { useMemo, useState } from 'react';
import { Boxes, ArrowRight } from 'lucide-react';
import {
  PRODUCT_COMPOSITIONS,
  PRODUCT_CATEGORY_ORDER,
  PRODUCT_CATEGORY_LABEL,
  type ProductComposition,
  type Criticality,
} from '@/data/productCompositions';
import { getCommodity } from '@/data/tradeInfrastructure/commodities';
import { extractReeSymbols, getReeBySymbol } from '@/data/rareEarthsBreakdown';
import { cn } from '@/lib/utils';

// ── Criticality styling ────────────────────────────────────────────────────
const CRIT_STYLE: Record<Criticality, { bar: string; text: string; pips: number; label: string }> = {
  critical:  { bar: 'bg-red-500',     text: 'text-red-400',     pips: 3, label: 'Critical'  },
  important: { bar: 'bg-amber-500',   text: 'text-amber-400',   pips: 2, label: 'Important' },
  trace:     { bar: 'bg-emerald-500', text: 'text-emerald-400', pips: 1, label: 'Trace'     },
};

const CATEGORY_COLOR: Record<ProductComposition['category'], string> = {
  transport:      'text-sky-400',
  electronics:    'text-violet-400',
  energy:         'text-amber-400',
  military:       'text-red-400',
  infrastructure: 'text-emerald-400',
  industrial:     'text-orange-400',
  consumer:       'text-pink-400',
};

const DEFAULT_PRODUCT_ID = 'ev';

/**
 * Resolve well-known untracked material names to a tracked commodity ID
 * where one now exists (Phase 2 added rare-earths, steel, lumber).
 *
 * Older product entries hard-code `commodityId: null` with names like
 * "Rare earths (Nd, Dy)*" or "Steel (HSLA)*".  Rather than touch every
 * one of those, we sniff the display name here and upgrade the link.
 */
function resolveLooseCommodityId(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('rare earth')) return 'rare-earths';
  if (n.startsWith('steel'))    return 'steel';
  // "Wood pulp", "Lumber", "Softwood/hardwood" → lumber feedstock
  if (n.includes('wood pulp') || n.startsWith('lumber') || n.includes('softwood') || n.includes('hardwood')) {
    return 'lumber';
  }
  return null;
}

/**
 * ProductCompositionCard — sits below CommodityProducersCard on the
 * Commodities tab.  Lets the user pick a finished product (EV, smartphone,
 * F-35, etc.) and see the raw commodities + materials inside it, grouped
 * by subsystem.  Components that map to a tracked commodity in
 * `commodities.ts` link to the producers card; untracked materials show
 * with an asterisk indicator.
 */
export function ProductCompositionCard() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_PRODUCT_ID);

  const active = useMemo(
    () => PRODUCT_COMPOSITIONS.find(p => p.id === activeId) ?? PRODUCT_COMPOSITIONS[0],
    [activeId],
  );

  // Group products by category for the picker
  const grouped = useMemo(() => {
    const out: Record<ProductComposition['category'], ProductComposition[]> = {
      transport: [], electronics: [], energy: [], military: [], infrastructure: [], industrial: [], consumer: [],
    };
    for (const p of PRODUCT_COMPOSITIONS) out[p.category].push(p);
    return out;
  }, []);

  // Stats
  const stats = useMemo(() => {
    let total = 0;
    let critical = 0;
    let tracked = 0;
    let untracked = 0;
    const trackedIds = new Set<string>();
    for (const sub of active.subsystems) {
      for (const c of sub.components) {
        total += 1;
        if (c.criticality === 'critical') critical += 1;
        const id = c.commodityId ?? resolveLooseCommodityId(c.name);
        if (id) { tracked += 1; trackedIds.add(id); }
        else    { untracked += 1; }
      }
    }
    return { total, critical, tracked, untracked, uniqueTracked: trackedIds.size };
  }, [active]);

  return (
    <div className="px-4 py-3 border-t border-border">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-2">
        <Boxes className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Product → Commodity Breakdown</span>
        <span className="ml-auto text-[9px] text-muted-foreground/60 uppercase tracking-wide">
          What's inside common things
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/80 leading-snug mb-3">
        Pick a finished product to see the raw materials it depends on, grouped
        by subsystem. Items marked with <span className="text-muted-foreground">*</span> are
        upstream materials we don't track as a standalone commodity.
      </p>

      {/* ── Product picker (grouped chips) ──────────────────────────────── */}
      <div className="space-y-1.5 mb-3">
        {PRODUCT_CATEGORY_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items.length) return null;
          return (
            <div key={cat} className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                'text-[9px] uppercase tracking-wide font-semibold w-20 shrink-0',
                CATEGORY_COLOR[cat],
              )}>
                {PRODUCT_CATEGORY_LABEL[cat]}
              </span>
              <div className="flex flex-wrap gap-1">
                {items.map(p => {
                  const selected = p.id === active.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveId(p.id)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] border transition-colors',
                        selected
                          ? 'bg-primary/15 border-primary/50 text-foreground font-semibold'
                          : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Selected product header ─────────────────────────────────────── */}
      <div className="rounded-md border border-border/50 bg-muted/20 p-3 mb-2">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h4 className={cn('text-sm font-semibold', CATEGORY_COLOR[active.category])}>
            {active.label}
          </h4>
          {active.scaleNote && (
            <span className="text-[9px] text-muted-foreground/70 italic shrink-0">
              {active.scaleNote}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug mb-2">
          {active.description}
        </p>

        {/* Stat strip */}
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <Stat label="Inputs"    value={String(stats.total)} />
          <Stat label="Critical"  value={String(stats.critical)} accent="text-red-400" />
          <Stat label="Tracked"   value={String(stats.uniqueTracked)} accent="text-emerald-400" />
          <Stat label="Untracked" value={String(stats.untracked)} accent="text-muted-foreground" />
        </div>
      </div>

      {/* ── Subsystem breakdown ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {active.subsystems.map(sub => (
          <div key={sub.label} className="rounded-md border border-border/40 bg-card/30">
            <div className="px-2.5 py-1.5 border-b border-border/30 bg-muted/20">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                {sub.label}
              </span>
              <span className="ml-1.5 text-[9px] text-muted-foreground/60">
                · {sub.components.length} input{sub.components.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="divide-y divide-border/20">
              {sub.components.map((c, i) => {
                // First try the explicit commodityId; if null, try to
                // resolve via the well-known-name heuristic so legacy
                // entries link to Phase-2 commodities (rare-earths, steel, lumber).
                const resolvedId = c.commodityId ?? resolveLooseCommodityId(c.name);
                const commodity = resolvedId ? getCommodity(resolvedId) : null;
                const crit = CRIT_STYLE[c.criticality];
                return (
                  <li key={i} className="px-2.5 py-1.5 flex items-center gap-2">
                    {/* Criticality pips */}
                    <div className="flex flex-col gap-0.5 shrink-0 w-1.5">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <span
                          key={j}
                          className={cn(
                            'w-1.5 h-1 rounded-sm',
                            j < crit.pips ? crit.bar : 'bg-muted/40',
                          )}
                        />
                      ))}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-[11px] font-medium truncate',
                          commodity ? 'text-foreground' : 'text-muted-foreground/85',
                        )}>
                          {commodity?.label ?? c.name}
                        </span>
                        {commodity && (
                          <span className="text-[8px] uppercase tracking-wide text-primary/70 font-semibold">
                            tracked
                          </span>
                        )}
                        {c.approxAmount && (
                          <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                            · {c.approxAmount}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 leading-snug truncate">
                        {c.role}
                      </p>
                      {/* REE element chips — when a rare-earth component lists
                          specific elements parenthetically e.g. "Rare earths (Nd, Dy)*",
                          break them out so the user sees the actual elements driving the supply risk. */}
                      <ReeChipStrip name={c.name} />
                    </div>

                    {/* Criticality label */}
                    <span className={cn('text-[9px] font-semibold uppercase tracking-wide shrink-0', crit.text)}>
                      {crit.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1 rounded-sm bg-red-500" />
          <span className="w-1.5 h-1 rounded-sm bg-red-500" />
          <span className="w-1.5 h-1 rounded-sm bg-red-500" />
          Critical
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1 rounded-sm bg-amber-500" />
          <span className="w-1.5 h-1 rounded-sm bg-amber-500" />
          <span className="w-1.5 h-1 rounded-sm bg-muted/40" />
          Important
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1 rounded-sm bg-emerald-500" />
          <span className="w-1.5 h-1 rounded-sm bg-muted/40" />
          <span className="w-1.5 h-1 rounded-sm bg-muted/40" />
          Trace
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <ArrowRight className="w-2.5 h-2.5" />
          <span className="italic">* = upstream material we don't track standalone</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('font-semibold tabular-nums', accent ?? 'text-foreground')}>{value}</span>
      <span className="text-muted-foreground/70 uppercase tracking-wide text-[9px]">{label}</span>
    </span>
  );
}

/**
 * ReeChipStrip — for rare-earth components, pulls the element symbols out
 * of the parenthetical name (e.g. "Rare earths (Nd, Dy)*" → Nd, Dy chips).
 * Each chip is colored by Light/Heavy class and shows the element name
 * + primary use as a hover tooltip — turning the generic "rare earths"
 * line into the specific elements that drive the product's supply risk.
 */
function ReeChipStrip({ name }: { name: string }) {
  // Cheap guard — bail before regex if not a rare-earth row.
  if (!name.toLowerCase().includes('rare earth')) return null;
  const symbols = extractReeSymbols(name);
  if (symbols.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {symbols.map(sym => {
        const el = getReeBySymbol(sym);
        if (!el) return null;
        const tone =
          el.class === 'light' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
          el.class === 'heavy' ? 'bg-red-500/15    text-red-400    border-red-500/30'   :
                                 'bg-violet-500/15 text-violet-400 border-violet-500/30';
        return (
          <span
            key={sym}
            title={`${el.name} — ${el.primaryUse}${el.priceRangeUsd ? ` (≈ $${el.priceRangeUsd[0]}-${el.priceRangeUsd[1]}/kg)` : ''}`}
            className={cn(
              'inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-px rounded border tabular-nums',
              tone,
            )}
          >
            <span className="font-bold">{el.symbol}</span>
            <span className="opacity-80">{el.name}</span>
          </span>
        );
      })}
    </div>
  );
}
