import { Users } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Analyst Ratings Breakdown — visualises the consensus distribution
 * (Strong Buy / Buy / Hold / Sell / Strong Sell) as horizontal stacked
 * bars. Sourced from `data.AnalystRatings` in the existing fundamentals
 * payload — costs 0 extra EODHD credits.
 *
 * Why bars instead of just a number: the *shape* of the distribution
 * matters. 10 Strong-Buys + 5 Holds is bullish; 5 Buys + 10 Sells is
 * bearish — both could collapse to the same average rating.
 */

interface Props { data: EodFundamentals }

const TIERS = [
  { key: 'StrongBuy',  label: 'Strong Buy',  color: 'bg-emerald-500',  text: 'text-emerald-400' },
  { key: 'Buy',        label: 'Buy',         color: 'bg-emerald-400',  text: 'text-emerald-300' },
  { key: 'Hold',       label: 'Hold',        color: 'bg-amber-400',    text: 'text-amber-300' },
  { key: 'Sell',       label: 'Sell',        color: 'bg-red-400',      text: 'text-red-300' },
  { key: 'StrongSell', label: 'Strong Sell', color: 'bg-red-500',      text: 'text-red-400' },
] as const;

export function AnalystRatingsBreakdown({ data }: Props) {
  const ar = data.AnalystRatings;
  if (!ar) return null;

  const total =
    (ar.StrongBuy ?? 0) + (ar.Buy ?? 0) + (ar.Hold ?? 0) +
    (ar.Sell ?? 0) + (ar.StrongSell ?? 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Analyst Recommendations · {total} analysts
        </span>
      </div>

      {/* Stacked single-bar visual */}
      <div className="flex h-3 w-full overflow-hidden rounded-sm">
        {TIERS.map((t) => {
          const n = (ar[t.key as keyof typeof ar] as number) ?? 0;
          const pct = (n / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={t.key}
              className={t.color}
              style={{ width: `${pct}%` }}
              title={`${t.label}: ${n} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* Per-tier counts */}
      <div className="grid grid-cols-5 gap-1 text-center">
        {TIERS.map((t) => {
          const n = (ar[t.key as keyof typeof ar] as number) ?? 0;
          return (
            <div key={t.key} className="space-y-0.5">
              <p className={cn('text-sm font-semibold tabular-nums', n > 0 ? t.text : 'text-muted-foreground/50')}>
                {n}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-tight leading-tight">
                {t.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
