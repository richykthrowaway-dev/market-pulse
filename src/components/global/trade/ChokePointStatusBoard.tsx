import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CHOKEPOINTS } from '@/data/tradeInfrastructure/chokepoints';
import type { Chokepoint } from '@/data/tradeInfrastructure/types';
import { cn } from '@/lib/utils';

/**
 * ChokePointStatusBoard — live AIS-derived transit count for each of the
 * 11 strategic chokepoints, with a vs-typical indicator.
 *
 * ── How the comparison works ───────────────────────────────────────────────
 * `chokepointCounts` is an instantaneous count of vessels within 100 km of
 * the chokepoint right now.  `typicalDailyTransits` (in the chokepoints
 * data file) is the average count of *transits per 24h* under normal
 * conditions.
 *
 * These are dimensionally different — but related: a vessel typically takes
 * 6-12 hours to clear a 100 km radius around a chokepoint, so under normal
 * conditions the instantaneous count is roughly `typicalDailyTransits / 4`
 * (~6h dwell time / 24h day).
 *
 * The "expected instantaneous" is calibrated as `typicalDailyTransits × 0.3`
 * — empirically fits Singapore-area density and Suez/Hormuz transit dwell.
 * Status thresholds (vs expected):
 *   ≥ +30%  → ↑ "elevated"
 *   ≤ −40%  → ↓ "depressed"   (could mean diversion or AIS coverage gap)
 *   else    → "normal"
 */

interface Props {
  /** Map of chokepoint id → instantaneous nearby vessel count. */
  chokepointCounts: Map<string, number>;
  /** Whether AIS is connected and feeding data. */
  aisLive: boolean;
  /** Optional click handler — wires the row to camera-fly on the globe. */
  onSelect?: (cp: Chokepoint) => void;
}

type Status = 'elevated' | 'normal' | 'depressed' | 'unknown';

const STATUS_STYLE: Record<Status, { dot: string; label: string }> = {
  elevated:  { dot: 'bg-amber-500',   label: 'text-amber-400'   },
  normal:    { dot: 'bg-emerald-500', label: 'text-emerald-400' },
  depressed: { dot: 'bg-red-500',     label: 'text-red-400'     },
  unknown:   { dot: 'bg-muted',       label: 'text-muted-foreground/60' },
};

interface Row {
  cp:       Chokepoint;
  count:    number;
  expected: number | null;
  ratio:    number | null;
  status:   Status;
}

function classifyStatus(count: number, expected: number | null): Status {
  if (expected == null) return 'unknown';
  const ratio = count / expected;
  if (ratio >= 1.30) return 'elevated';
  if (ratio <= 0.60) return 'depressed';
  return 'normal';
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'elevated')  return <TrendingUp   className="w-3 h-3" />;
  if (status === 'depressed') return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3 opacity-50" />;
}

export function ChokePointStatusBoard({ chokepointCounts, aisLive, onSelect }: Props) {
  const rows = useMemo<Row[]>(() => {
    return CHOKEPOINTS.map(cp => {
      const count    = chokepointCounts.get(cp.id) ?? 0;
      const expected = cp.typicalDailyTransits != null
        ? Math.round(cp.typicalDailyTransits * 0.3)
        : null;
      const ratio    = expected ? count / expected : null;
      const status   = classifyStatus(count, expected);
      return { cp, count, expected, ratio, status };
    })
      // Sort by importance — Malacca/Hormuz/Suez lead
      .sort((a, b) => b.cp.importance - a.cp.importance);
  }, [chokepointCounts]);

  return (
    <div className="px-4 py-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <AlertTriangle className="w-3 h-3" />
        Choke Point Status
      </h3>

      {!aisLive && (
        <p className="text-[10px] italic text-muted-foreground/70 mb-2">
          Enable Live Vessels (Intelligence overlay) to populate live transit counts.
        </p>
      )}

      <ul className="space-y-1">
        {rows.map(({ cp, count, status, ratio }) => {
          const style = STATUS_STYLE[status];
          return (
            <li
              key={cp.id}
              onClick={() => onSelect?.(cp)}
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-2 py-1.5 rounded transition-colors',
                onSelect && 'cursor-pointer hover:bg-muted/30',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
              <span className="text-[11px] font-medium truncate" title={cp.name}>
                {cp.name}
              </span>
              <span className="text-[11px] tabular-nums font-semibold text-foreground/85 w-10 text-right">
                {count}
              </span>
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[9px] uppercase tracking-wide w-16 justify-end',
                  style.label,
                )}
                title={ratio != null ? `${(ratio * 100).toFixed(0)}% of typical instantaneous density` : 'No baseline available'}
              >
                <StatusIcon status={status} />
                {status === 'unknown' ? '—' : status}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        Vessels within 100 km · live AIS · status vs typical instantaneous density.
        Coverage varies — sparse regions may underreport.
      </p>
    </div>
  );
}
