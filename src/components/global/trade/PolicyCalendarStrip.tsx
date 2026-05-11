import { useMemo } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useGlobalPolicyEvents } from '@/hooks/useGlobalPolicyEvents';
import { cn } from '@/lib/utils';

/**
 * PolicyCalendarStrip — horizontal scrollable feed of high-impact macro
 * events across major economies in the next 7 days.
 *
 * Each chip shows:
 *   - Country flag (ISO2 from EODHD event)
 *   - Event type (CPI / GDP / rate decision / NFP / PMI)
 *   - Date + time relative to now ("Today 14:30", "Wed", "in 3d")
 *   - Impact dot (red / amber / grey)
 *
 * The strip auto-divides at "now" — past events show actual results in
 * green/red vs estimate, upcoming events show just the estimate.
 */

interface Props {
  /** Optional max event count (default 30). */
  limit?: number;
}

function getFlagSrc(iso2: string): string {
  return `https://flagcdn.com/w20/${iso2.toLowerCase()}.png`;
}

/** Compact relative time label — e.g. "today 14:30", "tomorrow", "in 3d", "2d ago". */
function formatRelative(date: string, now: Date): string {
  const d = new Date(date.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return date.slice(0, 16);

  const diffMs = d.getTime() - now.getTime();
  const sameDayUTC =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth()    === now.getUTCMonth() &&
    d.getUTCDate()     === now.getUTCDate();

  if (sameDayUTC) {
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    return `today ${hh}:${mm}`;
  }

  const days = Math.round(diffMs / 86_400_000);
  if (days === 1)  return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days  >  0)  return `in ${days}d`;
  return `${-days}d ago`;
}

const IMPACT_DOT: Record<'High' | 'Medium' | 'Low' | 'unknown', string> = {
  High:    'bg-red-500',
  Medium:  'bg-amber-500',
  Low:     'bg-muted-foreground/50',
  unknown: 'bg-muted-foreground/30',
};

export function PolicyCalendarStrip({ limit = 30 }: Props) {
  const { data, isLoading } = useGlobalPolicyEvents();
  const now = new Date();

  const shown = useMemo(() => data.slice(0, limit), [data, limit]);

  return (
    <div className="px-4 py-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <CalendarDays className="w-3 h-3" />
        Policy Calendar (±7 days)
      </h3>

      {isLoading && data.length === 0 ? (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading global macro events…
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[10px] italic text-muted-foreground/70">
          No high-impact events scheduled in the window.
        </p>
      ) : (
        <div className="-mx-1 px-1 overflow-x-auto">
          <div className="flex items-stretch gap-1.5 min-w-min">
            {shown.map((ev, idx) => {
              const isPast = new Date(ev.date.replace(' ', 'T') + 'Z') < now;
              const impactKey = ev.impact ?? 'unknown';
              const beat   = isPast && ev.actual != null && ev.estimate != null && ev.actual > ev.estimate;
              const miss   = isPast && ev.actual != null && ev.estimate != null && ev.actual < ev.estimate;
              return (
                <div
                  key={`${ev.country}-${ev.date}-${ev.type}-${idx}`}
                  className={cn(
                    'shrink-0 w-44 rounded-md border px-2 py-1.5 flex flex-col gap-1',
                    isPast
                      ? 'border-border/60 bg-card/40 opacity-80'
                      : 'border-border bg-card/70',
                  )}
                >
                  {/* Header row: flag + country + impact */}
                  <div className="flex items-center gap-1.5">
                    {ev.country && (
                      <img
                        src={getFlagSrc(ev.country)}
                        alt={ev.country}
                        width={14}
                        height={10}
                        className="shrink-0 rounded-[2px] ring-1 ring-border/40 object-cover"
                      />
                    )}
                    <span className="text-[10px] font-medium text-foreground/80 uppercase tracking-wide">
                      {ev.country}
                    </span>
                    <span className={cn('ml-auto w-1.5 h-1.5 rounded-full', IMPACT_DOT[impactKey])} />
                  </div>

                  {/* Event name (truncated) */}
                  <p
                    className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground/90"
                    title={ev.type}
                  >
                    {ev.type}
                  </p>

                  {/* When + actual vs estimate */}
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      {formatRelative(ev.date, now)}
                    </span>
                    {isPast && ev.actual != null ? (
                      <span
                        className={cn(
                          'text-[10px] tabular-nums font-semibold',
                          beat ? 'text-emerald-400' : miss ? 'text-red-400' : 'text-muted-foreground/80',
                        )}
                      >
                        {ev.actual}{ev.unit ?? ''}
                      </span>
                    ) : ev.estimate != null ? (
                      <span className="text-[10px] tabular-nums text-muted-foreground/70">
                        est {ev.estimate}{ev.unit ?? ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        EODHD · US · EU · CN · JP · GB · IN · BR · high-impact rates / GDP / CPI / PMI / NFP only.
      </p>
    </div>
  );
}
