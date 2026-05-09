import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { useTradeBreakdown, type TradeProduct, type TradeDirection } from '@/hooks/useTradeBreakdown';
import { cn } from '@/lib/utils';

interface TradeBreakdownProps {
  iso2: string;
}

// ── Product → color mapping ──────────────────────────────────────────
// Stable hash so the same product code always gets the same color
// across countries. Users learn the palette: Fuels is always orange,
// Mach+Elec is always blue, etc.
const PALETTE = [
  '#3b82f6', // blue-500    — large industrial categories
  '#10b981', // emerald-500
  '#f59e0b', // amber-500   — fuels-ish
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
  '#dc2626', // red-600
  '#0ea5e9', // sky-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#d946ef', // fuchsia-500
];

function colorFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) {
    h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Number formatting ────────────────────────────────────────────────

function formatUsdCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

// ── Sub-components ────────────────────────────────────────────────────

interface BreakdownPanelProps {
  title: string;
  icon: React.ReactNode;
  iso2: string;
  direction: TradeDirection;
}

function BreakdownPanel({ title, icon, iso2, direction }: BreakdownPanelProps) {
  const { data, isLoading } = useTradeBreakdown(iso2, direction);

  // Group long tail (rank 6+) into a single "Other" bucket so the visible
  // bar segments stay readable. The labeled list shows top 5 by name +
  // "Other" with combined share.
  const { topProducts, otherShare, otherValue } = useMemo(() => {
    const products = data?.products ?? [];
    const TOP_N = 5;
    const top = products.slice(0, TOP_N);
    const rest = products.slice(TOP_N);
    const otherShare = rest.reduce((s, r) => s + r.share, 0);
    const otherValue = rest.reduce((s, r) => s + r.valueUsd, 0);
    return { topProducts: top, otherShare, otherValue };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <div className="h-4 bg-muted/40 rounded animate-pulse" />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <p className="text-xs text-muted-foreground italic px-1">
          Not reported to WITS for this country.
        </p>
      </div>
    );
  }

  const total = data.totalUsd ?? 0;
  const year = data.year;

  return (
    <div className="space-y-2">
      <PanelHeader title={title} icon={icon} year={year} total={total} />

      {/* Stacked bar — one segment per top product, last segment = Other */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-md bg-muted/30"
        role="img"
        aria-label={`${title} composition for ${iso2}`}
      >
        {topProducts.map((p) => (
          <div
            key={p.code}
            style={{
              width: `${p.share * 100}%`,
              backgroundColor: colorFor(p.code),
            }}
            title={`${p.name}: ${(p.share * 100).toFixed(1)}% (${formatUsdCompact(p.valueUsd)})`}
          />
        ))}
        {otherShare > 0.001 && (
          <div
            style={{ width: `${otherShare * 100}%` }}
            className="bg-muted-foreground/40"
            title={`Other: ${(otherShare * 100).toFixed(1)}% (${formatUsdCompact(otherValue)})`}
          />
        )}
      </div>

      {/* Two-column legend listing top products */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {topProducts.map((p) => (
          <ProductRow key={p.code} product={p} />
        ))}
        {otherShare > 0.001 && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: 'hsl(var(--muted-foreground) / 0.4)' }}
            />
            <span className="truncate text-muted-foreground">Other</span>
            <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
              {(otherShare * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: TradeProduct }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className="inline-block w-2 h-2 rounded-sm shrink-0"
        style={{ backgroundColor: colorFor(product.code) }}
      />
      <span
        className="truncate text-foreground/90"
        title={product.name}
      >
        {product.name}
      </span>
      <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
        {(product.share * 100).toFixed(1)}%
      </span>
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  icon: React.ReactNode;
  year?: number | null;
  total?: number;
}

function PanelHeader({ title, icon, year, total }: PanelHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide truncate">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {total != null && total > 0 && <span>{formatUsdCompact(total)}</span>}
        {year != null && (
          <span className="px-1 rounded bg-muted/50 border border-border">{year}</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

/**
 * Side-by-side product-composition visualization for a country's
 * exports and imports. Lives in the Economy tab below the World Bank
 * trade snapshot and above the EODHD economic calendar.
 *
 * For each direction:
 *   - A stacked horizontal bar showing the top 5 product categories
 *     plus an "Other" bucket
 *   - A 2-column legend listing each segment with its % share
 *
 * Returns null only when BOTH directions have no data (e.g. small
 * territories not in WITS' reporter list).
 */
export function TradeBreakdown({ iso2 }: TradeBreakdownProps) {
  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground pb-1">
        <Package className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Trade Composition · World Bank WITS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3">
        <BreakdownPanel
          title="Top Exports"
          icon={<ArrowUpRight className={cn('w-3.5 h-3.5 text-emerald-500')} />}
          iso2={iso2}
          direction="exports"
        />
        <BreakdownPanel
          title="Top Imports"
          icon={<ArrowDownRight className={cn('w-3.5 h-3.5 text-amber-500')} />}
          iso2={iso2}
          direction="imports"
        />
      </div>
    </div>
  );
}
