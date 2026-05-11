import { Loader2, BarChart3 } from 'lucide-react';
import { useWorldBankComparison, type ComparisonRow } from '@/hooks/useWorldBankComparison';
import { cn } from '@/lib/utils';

/**
 * ComparisonScorecard — "country vs region vs world" table.
 *
 * For each indicator we compare the country's latest value against the
 * World Bank's regional aggregate and global aggregate.  A relative-position
 * indicator on the right shows how the country fares vs the region:
 *
 *   - Country better than region by ≥ 0.5 standard-unit: ↑ emerald
 *   - Country worse  than region by ≥ 0.5 standard-unit: ↓ red
 *   - Otherwise: – muted
 *
 * "Better" depends on the indicator — for inflation/unemployment/debt
 * lower is better; for GDP growth and current account, higher is better.
 *
 * Caveats:
 *   - Regional aggregates are population-weighted, so big countries
 *     dominate (e.g. East Asia & Pacific is heavily China-influenced).
 *   - Some indicators (debt/GDP) are missing for a sizeable minority of
 *     reporters — we show "—" where data is null.
 */

interface Props {
  iso2: string;
}

function formatValue(value: number | null, unit: string): string {
  if (value == null) return '—';
  if (unit === '$') {
    // GDP per capita: format in $k for legibility.
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
  }
  return `${value > 0 && !Object.is(value, -0) ? '' : ''}${value.toFixed(1)}${unit}`;
}

/**
 * Compute a comparison verdict: is the country meaningfully better,
 * meaningfully worse, or roughly comparable to the region for this
 * indicator?  Threshold uses absolute differences calibrated per unit;
 * for percent indicators 0.5pp is the noise floor.
 */
type Verdict = 'better' | 'worse' | 'similar' | 'unknown';

function verdictForRow(row: ComparisonRow): Verdict {
  const c = row.country.value;
  const r = row.region.value;
  if (c == null || r == null) return 'unknown';

  // For GDP per capita ($) the threshold scales — use percent-of-region.
  const diff = row.unit === '$'
    ? (c - r) / Math.abs(r)        // ratio
    : c - r;                       // pp / units

  const threshold = row.unit === '$' ? 0.10 : 0.5;
  const absDiff   = Math.abs(diff);
  if (absDiff < threshold) return 'similar';

  const countryHigher = diff > 0;
  if (row.lowerBetter) return countryHigher ? 'worse' : 'better';
  return countryHigher ? 'better' : 'worse';
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === 'better') {
    return <span className="text-[10px] font-semibold text-emerald-400" title="Better than regional average">↑ better</span>;
  }
  if (verdict === 'worse') {
    return <span className="text-[10px] font-semibold text-red-400" title="Worse than regional average">↓ worse</span>;
  }
  if (verdict === 'similar') {
    return <span className="text-[10px] text-muted-foreground/60" title="Similar to regional average">— similar</span>;
  }
  return <span className="text-[10px] text-muted-foreground/30">—</span>;
}

export function ComparisonScorecard({ iso2 }: Props) {
  const { regionLabel, rows, isLoading } = useWorldBankComparison(iso2);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground h-28">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading peer comparison…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        Country vs Region vs World
      </h3>

      {/* Column headers */}
      <div className="grid grid-cols-[1.4fr_auto_auto_auto_auto] gap-x-3 px-1 pb-1 text-[9px] uppercase tracking-wide text-muted-foreground/60">
        <span>Indicator</span>
        <span className="w-14 text-right">Country</span>
        <span className="w-14 text-right">Region</span>
        <span className="w-14 text-right">World</span>
        <span className="w-16 text-right">vs Region</span>
      </div>

      <ul className="divide-y divide-border/40">
        {rows.map(row => {
          const v = verdictForRow(row);
          return (
            <li key={row.key} className="grid grid-cols-[1.4fr_auto_auto_auto_auto] gap-x-3 items-center px-1 py-1.5 text-[11px]">
              <div className="min-w-0">
                <span className="font-medium text-foreground/90 truncate block">{row.label}</span>
                {row.lowerBetter && (
                  <span className="text-[8px] text-muted-foreground/50 uppercase tracking-wide">lower better</span>
                )}
              </div>
              <span className={cn(
                'w-14 text-right tabular-nums font-semibold',
                row.country.value != null ? 'text-foreground/90' : 'text-muted-foreground/40',
              )}>
                {formatValue(row.country.value, row.unit)}
              </span>
              <span className="w-14 text-right tabular-nums text-muted-foreground">
                {formatValue(row.region.value, row.unit)}
              </span>
              <span className="w-14 text-right tabular-nums text-muted-foreground/70">
                {formatValue(row.world.value, row.unit)}
              </span>
              <span className="w-16 text-right">
                <VerdictBadge verdict={v} />
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        Region: <span className="text-foreground/70">{regionLabel ?? 'unknown'}</span> ·
        Aggregates are population-weighted · World Bank WDI (most recent year).
      </p>
    </div>
  );
}
