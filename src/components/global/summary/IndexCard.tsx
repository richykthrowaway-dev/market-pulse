import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import type { CountryIndexQuote } from '@/hooks/useCountryIndices';
import { useIndexHistory } from '@/hooks/useIndexHistory';
import { cn } from '@/lib/utils';

/**
 * IndexCard — upgraded card for a country's primary index.
 *
 * On top of the existing price + 1-day-change display, surfaces:
 *   - 1-year sparkline (shape of recent moves)
 *   - 52-week range bar (where today's close sits in the year's high-low)
 *   - YTD percent change (often more meaningful than 1D for an index)
 *
 * All derived from a single api-yahoo `chart?range=1y` call, cached
 * 30 min via useIndexHistory.
 */

interface Props {
  /** Live quote (price + 1D change) from useCountryIndices. */
  index: CountryIndexQuote;
}

/** Sparkline data shape — Recharts needs an object[] with a numeric field. */
interface SparkPoint { v: number }

export function IndexCard({ index }: Props) {
  const { data: history, isLoading: histLoading } = useIndexHistory(index.symbol);

  const sparkData = useMemo<SparkPoint[]>(
    () => history?.closes.map(v => ({ v })) ?? [],
    [history],
  );

  const positive1d  = (index.changePercent ?? 0) >= 0;
  const ytd         = history?.ytdPct ?? null;
  const ytdPositive = (ytd ?? 0) >= 0;
  const hasPrice    = !index.unavailable && index.price !== null;

  return (
    <div className="bg-muted/40 rounded-lg p-3 hover:bg-muted/55 transition-colors">
      {/* Top row: name + symbol + price + 1D change */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{index.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{index.symbol}</p>
        </div>

        {hasPrice ? (
          <div className="text-right shrink-0">
            <p className="text-base font-bold font-mono">
              {index.price!.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className={cn(
              'text-xs font-mono flex items-center justify-end gap-0.5',
              positive1d ? 'text-success' : 'text-danger',
            )}>
              {positive1d ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
              {positive1d ? '+' : ''}{(index.changePercent ?? 0).toFixed(2)}%
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic shrink-0">unavailable</span>
        )}
      </div>

      {/* Sparkline + YTD strip */}
      {hasPrice && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 items-center">
          {/* 1-year sparkline */}
          <div className="h-7">
            {histLoading ? (
              <div className="h-full rounded bg-muted/40 animate-pulse" />
            ) : sparkData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={positive1d ? '#10b981' : '#ef4444'}
                    strokeWidth={1.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full opacity-30 border-b border-dashed border-border" />
            )}
          </div>

          {/* YTD badge */}
          {ytd != null && (
            <div className="shrink-0 text-right">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">YTD</span>
              <p className={cn(
                'text-xs font-mono font-semibold tabular-nums',
                ytdPositive ? 'text-success' : 'text-danger',
              )}>
                {ytdPositive ? '+' : ''}{ytd.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* 52-week range bar */}
      {hasPrice && history && (
        <div className="mt-2">
          <div className="relative h-1 rounded-full bg-muted/40 overflow-hidden">
            {/* Position marker — where today sits in the 52w range */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full"
              style={{ left: `calc(${history.range52wPct * 100}% - 2px)` }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground/60 tabular-nums">
            <span title="52-week low">
              {history.low52w.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="opacity-70">52w range</span>
            <span title="52-week high">
              {history.high52w.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
