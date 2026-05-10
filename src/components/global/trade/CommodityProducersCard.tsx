import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Factory } from 'lucide-react';
import {
  COMMODITIES, CATEGORY_LABELS, CATEGORY_ORDER,
  getCommodity, getConcentration, type CommodityCategory,
} from '@/data/tradeInfrastructure/commodities';
import { COUNTRY_META } from '@/data/countryMeta';

/** Tailwind palette per concentration level — used for the dot + text. */
const CONCENTRATION_STYLE = {
  high:   { dot: 'bg-red-500',     text: 'text-red-400',     label: 'High concentration'     },
  medium: { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Moderate concentration' },
  low:    { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Diversified supply'     },
} as const;

const DEFAULT_COMMODITY_ID = 'crude-oil';

/** Pre-group commodities by category once at module load — zero cost at render. */
const GROUPED: Record<CommodityCategory, typeof COMMODITIES[number][]> = {
  energy: [], metals: [], agriculture: [],
};
for (const c of COMMODITIES) GROUPED[c.category].push(c);

function getFlagSrc(iso2: string): string {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

/* ─── Lightweight themed dropdown ─────────────────────────────────────────
   Replaces Radix Select entirely.  Opens/closes via local state, positioned
   with CSS (no Popper/Floating-UI), styled with the app's CSS variables so
   it respects dark mode.  Hover highlighting is pure CSS — no JS on hover.
──────────────────────────────────────────────────────────────────────────── */
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

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, { passive: true });
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* Scroll selected item into view when panel opens */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      {/* ── Trigger ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-full flex items-center justify-between gap-2',
          'h-8 px-3 rounded-md text-xs font-medium',
          'border bg-background text-foreground',
          'transition-colors duration-100',
          open
            ? 'border-purple-500/60 ring-1 ring-purple-500/40'
            : 'border-input hover:border-purple-500/50 hover:bg-purple-500/5',
        ].join(' ')}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={[
            'w-3.5 h-3.5 shrink-0 text-muted-foreground',
            'transition-transform duration-150',
            open ? 'rotate-180' : '',
          ].join(' ')}
          strokeWidth={2.5}
        />
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────── */}
      {open && (
        <div
          ref={listRef}
          className={[
            'absolute left-0 right-0 z-[200] mt-1',
            'bg-popover text-popover-foreground',
            'border border-border rounded-md shadow-lg',
            'max-h-56 overflow-y-auto overscroll-contain',
            /* thin custom scrollbar via Tailwind scrollbar plugin if present */
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border',
          ].join(' ')}
        >
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              {/* Category header — sticky so it stays visible while scrolling */}
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
                      'px-3 py-1.5 text-xs rounded-sm',
                      'transition-colors duration-75',
                      selected
                        ? 'bg-purple-500/20 text-purple-300 font-medium'
                        : 'text-foreground/90 hover:bg-accent hover:text-accent-foreground',
                    ].join(' ')}
                  >
                    {/* Commodity name */}
                    <span className="truncate">{c.label}</span>

                    {/* Top-5 producer flags — fill the line-height, width scales naturally */}
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

              {/* Divider between groups */}
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

/* ─── Main card ────────────────────────────────────────────────────────── */
export function CommodityProducersCard() {
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_COMMODITY_ID);

  const commodity = useMemo(() => getCommodity(selectedId), [selectedId]);
  const maxShare  = useMemo(
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
    <div className="border-t border-border bg-purple-500/5">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <Factory className="w-4 h-4 text-purple-500 shrink-0" />
        <span className="text-xs font-semibold">Top Producers</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          By country
        </span>
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <CommodityDropdown value={selectedId} onChange={setSelectedId} />
      </div>

      {/* ── Use case (what is this for?) ─────────────────────────────── */}
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        {commodity.useCase}
      </p>

      {/* ── Supply concentration metric ──────────────────────────────── */}
      <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${concStyle.dot}`} />
        <span className="text-foreground/85">
          Top 3 control{' '}
          <span className="font-semibold tabular-nums">
            {concentration.top3Share.toFixed(0)}%
          </span>{' '}
          of supply
        </span>
        <span className={`ml-auto text-[10px] uppercase tracking-wide font-medium ${concStyle.text}`}>
          {concStyle.label}
        </span>
      </div>

      {/* ── Producer ranked list ─────────────────────────────────────── */}
      <ul className="px-4 pb-2 space-y-1.5">
        {commodity.producers.map((p, i) => {
          const name     = COUNTRY_META[p.iso2]?.name ?? p.iso2;
          const barWidth = `${(p.share / maxShare) * 100}%`;

          return (
            <li key={p.iso2} className="flex items-center gap-2 text-xs group">
              {/* Rank */}
              <span className="text-[10px] tabular-nums text-muted-foreground/40 w-3 shrink-0 text-right">
                {i + 1}
              </span>

              {/* Flag */}
              <img
                src={getFlagSrc(p.iso2)}
                alt=""
                width={20}
                height={14}
                className="shrink-0 rounded-[2px] ring-1 ring-border/50 object-cover"
              />

              {/* Name */}
              <span
                className="truncate min-w-0 flex-1 text-foreground/85 group-hover:text-foreground transition-colors duration-75"
                title={name}
              >
                {name}
              </span>

              {/* Share % */}
              <span className="tabular-nums shrink-0 w-9 text-right text-muted-foreground group-hover:text-foreground/80 transition-colors duration-75">
                {p.share.toFixed(1)}%
              </span>

              {/* Bar */}
              <span className="w-14 h-1.5 bg-purple-500/10 rounded-full overflow-hidden shrink-0">
                <span
                  className="block h-full bg-purple-500/70 rounded-full transition-[width] duration-300"
                  style={{ width: barWidth }}
                />
              </span>
            </li>
          );
        })}

        {/* ── Rest-of-World remainder row ──────────────────────────── */}
        {concentration.restShare > 0.5 && (
          <li className="flex items-center gap-2 text-xs pt-1 mt-1 border-t border-border/40 text-muted-foreground/60">
            {/* Rank dash (instead of a number) */}
            <span className="text-[10px] tabular-nums w-3 shrink-0 text-right">—</span>

            {/* Globe placeholder where the flag would be */}
            <span className="shrink-0 w-5 h-[14px] rounded-[2px] ring-1 ring-border/40 bg-muted/40" />

            {/* Label */}
            <span className="truncate min-w-0 flex-1 italic">Rest of world</span>

            {/* Share % */}
            <span className="tabular-nums shrink-0 w-9 text-right">
              {concentration.restShare.toFixed(1)}%
            </span>

            {/* Bar — muted grey to distinguish from named producers */}
            <span className="w-14 h-1.5 bg-muted/30 rounded-full overflow-hidden shrink-0">
              <span
                className="block h-full bg-muted-foreground/40 rounded-full transition-[width] duration-300"
                style={{ width: `${(concentration.restShare / maxShare) * 100}%` }}
              />
            </span>
          </li>
        )}
      </ul>

      {/* ── Footer attribution ───────────────────────────────────────── */}
      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        {commodity.source} · {commodity.year} · share of global production ({commodity.unit})
      </p>
    </div>
  );
}
