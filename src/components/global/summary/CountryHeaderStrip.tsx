import { useEffect, useState, useMemo } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { EXCHANGES, isExchangeOpen, type ExchangeInfo } from '@/data/exchangeData';
import { getSovereignRating, RATING_RANK } from '@/data/sovereignRatings';
import { cn } from '@/lib/utils';

/**
 * CountryHeaderStrip — compact status chip row directly under the country
 * header.  Three things in a single line: market open/closed indicator,
 * current local time at the primary exchange, and sovereign credit rating.
 *
 * All three are derived from data we already have — no new network calls.
 *   - Exchange hours + timezone: src/data/exchangeData.ts (isExchangeOpen())
 *   - Credit rating: src/data/sovereignRatings.ts (manually maintained)
 *
 * Time updates every minute via a 60-second interval — cheap enough to
 * not be metered, fresh enough that the displayed clock doesn't drift.
 */

interface Props {
  iso2: string;
}

/**
 * Pick the "primary" exchange for a country — heuristic: the first
 * EXCHANGES entry whose country matches.  EXCHANGES is ordered
 * roughly by importance, so the first match is the canonical one.
 */
function getPrimaryExchange(iso2: string): ExchangeInfo | undefined {
  return EXCHANGES.find(ex => ex.country === iso2.toUpperCase());
}

/** Format current time at a given timezone as "HH:MM TZABBR". */
function formatLocalTime(timezone: string, now: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone:   timezone,
      hour:       '2-digit',
      minute:     '2-digit',
      hour12:     false,
      timeZoneName: 'short',
    });
    return fmt.format(now);
  } catch {
    // Invalid timezone — fall back to UTC
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone:   'UTC',
      hour:       '2-digit',
      minute:     '2-digit',
      hour12:     false,
    });
    return `${fmt.format(now)} UTC`;
  }
}

/**
 * "Closes in 3h 42m" / "Opens in 14h 22m" — minutes until next state change.
 * Returns null when day-of-week mismatches (weekend, holiday closure logic).
 */
function timeToNextStateChange(ex: ExchangeInfo, now: Date): string | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone:   ex.timezone,
      hour:       'numeric',
      minute:     'numeric',
      hour12:     false,
      weekday:    'short',
    });
    const parts      = fmt.formatToParts(now);
    const hour       = Number(parts.find(p => p.type === 'hour')?.value   ?? 0);
    const minute     = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = dayMap[weekdayStr] ?? -1;
    if (dayOfWeek < 0) return null;

    const nowMin   = hour * 60 + minute;
    const [openH, openM ]  = ex.openTime.split(':').map(Number);
    const [closeH, closeM] = ex.closeTime.split(':').map(Number);
    const openMin  = openH  * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    const isTradingDay = ex.tradingDays.includes(dayOfWeek);

    if (isTradingDay && nowMin >= openMin && nowMin < closeMin) {
      // Currently open — show countdown to close
      const remaining = closeMin - nowMin;
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      return `closes in ${h > 0 ? `${h}h ` : ''}${m}m`;
    }

    // Closed — find next opening
    // Simple: if today is a trading day and we're before openMin, count to today's open.
    if (isTradingDay && nowMin < openMin) {
      const remaining = openMin - nowMin;
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      return `opens in ${h > 0 ? `${h}h ` : ''}${m}m`;
    }

    // Otherwise we need to find the next trading day.  Walk forward up to 7 days.
    for (let d = 1; d <= 7; d++) {
      const candidate = (dayOfWeek + d) % 7;
      if (ex.tradingDays.includes(candidate)) {
        const minutesToMidnight = (24 * 60) - nowMin;
        const minutesFromMidnightToOpen = (d - 1) * 24 * 60 + openMin;
        const totalMin = minutesToMidnight + minutesFromMidnightToOpen;
        const days = Math.floor(totalMin / (24 * 60));
        const hours = Math.floor((totalMin % (24 * 60)) / 60);
        if (days > 0) return `opens in ${days}d ${hours}h`;
        return `opens in ${hours}h ${totalMin % 60}m`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Color a rating badge by tier — investment grade green/blue, speculative amber/red. */
function ratingTone(rating: string): string {
  const r = RATING_RANK[rating] ?? 0;
  if (r >= 19) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (r >= 16) return 'bg-cyan-500/15    text-cyan-400    border-cyan-500/30';
  if (r >= 13) return 'bg-blue-500/15    text-blue-400    border-blue-500/30';
  if (r >= 10) return 'bg-amber-500/15   text-amber-400   border-amber-500/30';
  if (r >= 7)  return 'bg-orange-500/15  text-orange-400  border-orange-500/30';
  if (r >= 1)  return 'bg-red-500/15     text-red-400     border-red-500/30';
  return 'bg-muted/30 text-muted-foreground border-border';
}

export function CountryHeaderStrip({ iso2 }: Props) {
  const exchange = useMemo(() => getPrimaryExchange(iso2), [iso2]);
  const rating   = useMemo(() => getSovereignRating(iso2),  [iso2]);

  // Tick once per minute so the open/closed pill + countdown stays current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isOpen        = exchange ? isExchangeOpen(exchange) : null;
  const localTime     = exchange ? formatLocalTime(exchange.timezone, now) : null;
  const stateChange   = exchange ? timeToNextStateChange(exchange, now) : null;

  // Don't render the strip if we have nothing useful to show.
  if (!exchange && !rating) return null;

  return (
    <div className="flex items-center flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
      {/* Market status pill */}
      {exchange && (
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded-md border',
          isOpen
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-muted/40 text-muted-foreground border-border',
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60',
          )} />
          <span className="font-semibold">{exchange.code}</span>
          <span className="opacity-80">{isOpen ? 'OPEN' : 'CLOSED'}</span>
          {stateChange && <span className="opacity-60 normal-case">· {stateChange}</span>}
        </div>
      )}

      {/* Local time */}
      {localTime && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-card/40 text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          <span className="font-mono tabular-nums">{localTime}</span>
        </div>
      )}

      {/* Sovereign credit rating */}
      {rating && (
        <>
          <div className="flex items-center gap-1 ml-1 text-muted-foreground/70">
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Rating</span>
          </div>
          <span className={cn(
            'px-1.5 py-0.5 rounded border font-mono font-bold normal-case',
            ratingTone(rating.moody.rating),
          )} title="Moody's">
            {rating.moody.rating}
          </span>
          <span className={cn(
            'px-1.5 py-0.5 rounded border font-mono font-bold normal-case',
            ratingTone(rating.sp.rating),
          )} title="S&P">
            {rating.sp.rating}
          </span>
          <span className={cn(
            'px-1.5 py-0.5 rounded border font-mono font-bold normal-case',
            ratingTone(rating.fitch.rating),
          )} title="Fitch">
            {rating.fitch.rating}
          </span>
        </>
      )}
    </div>
  );
}
