import { useMemo } from 'react';
import { Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useEodhdEconomicEvents } from '@/hooks/useEodhdEconomicEvents';
import { filterCatalystsForCommodity, impactStars } from '@/data/commodityCatalysts';
import type { CommodityPrice } from '@/hooks/useCommodityPrices';
import { cn } from '@/lib/utils';

/**
 * CommodityCatalystStrip — forward-looking row above the price chart.
 *
 * Shows the next 3 upcoming economic events that historically move the
 * selected commodity, with countdown and impact rating.  Designed to
 * answer "what's coming?" in one glance — the question every trader
 * asks before holding a position into the next session.
 *
 * Data path:
 *   1. useEodhdEconomicEvents('US') — global macro releases (most
 *      market-moving events are US-released, even for non-US commodities).
 *   2. filterCatalystsForCommodity() — substring-matches the event types
 *      against a hand-curated keyword list per commodity.
 *   3. Take the next 3 chronologically.
 */
export function CommodityCatalystStrip({ price }: { price: CommodityPrice }) {
  // US calendar covers FOMC / CPI / NFP / PCE / GDP — the catalysts
  // that move commodity prices across the board.  Region-specific events
  // (China PMI, ECB) are a v2 expansion.
  const { data: events = [], isLoading } = useEodhdEconomicEvents('US');

  const upcoming = useMemo(
    () => filterCatalystsForCommodity(events, price.id).slice(0, 3),
    [events, price.id],
  );

  return (
    <div className="px-4 pt-3 pb-2 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Clock className="w-3 h-3" />
        Next catalysts
        <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
          What's coming · EODHD US macro
        </span>
      </h3>

      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 py-3 text-[10px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading calendar…
        </div>
      ) : upcoming.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic py-1">
          No catalysts on the calendar in the next 30 days.
        </p>
      ) : (
        <ul className="space-y-1">
          {upcoming.map((ev, i) => (
            <CatalystRow key={`${ev.date}-${ev.type}-${i}`} event={ev} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Subcomponent: one row ────────────────────────────────────────────────────

function CatalystRow({ event }: { event: ReturnType<typeof filterCatalystsForCommodity>[number] }) {
  const eventDate = useMemo(() => {
    // EODHD format: "YYYY-MM-DD HH:MM:SS" UTC
    return new Date(event.date.replace(' ', 'T') + 'Z');
  }, [event.date]);

  const countdownLabel = useMemo(() => {
    const ms = eventDate.getTime() - Date.now();
    if (ms <= 0) return 'now';
    const hours = ms / 3_600_000;
    if (hours < 1)  return `${Math.round(ms / 60_000)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = hours / 24;
    if (days < 14) return `${Math.round(days)}d`;
    return `${Math.round(days / 7)}w`;
  }, [eventDate]);

  const stars = impactStars(event.impact);
  const starColor =
    stars === 3 ? 'text-red-400'
    : stars === 2 ? 'text-amber-400'
    : 'text-muted-foreground/50';

  return (
    <li
      className="flex items-center gap-2 text-[11px] py-1 px-1.5 rounded hover:bg-muted/30 transition-colors"
      title={`${event.type} · ${event.date} UTC`}
    >
      {/* Countdown pill */}
      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono tabular-nums">
        <Clock className="w-2.5 h-2.5" />
        {countdownLabel}
      </span>

      {/* Event title */}
      <span className="flex-1 min-w-0 truncate text-foreground/90">
        {event.type}
      </span>

      {/* Est / Prev */}
      {(event.estimate != null || event.previous != null) && (
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground hidden md:inline">
          {event.estimate != null && (
            <>est {formatVal(event.estimate, event.unit)}{event.previous != null ? ' · ' : ''}</>
          )}
          {event.previous != null && (
            <>prev {formatVal(event.previous, event.unit)}</>
          )}
        </span>
      )}

      {/* Impact stars */}
      <span
        className={cn('shrink-0 font-bold text-[10px] tracking-tight', starColor)}
        title={event.impact ? `${event.impact} impact` : 'Impact unknown'}
      >
        {stars === 3 ? '★★★' : stars === 2 ? '★★' : '★'}
      </span>

      {/* High-impact warning glyph */}
      {stars === 3 && (
        <AlertTriangle className="w-3 h-3 text-red-400/70 shrink-0" />
      )}
    </li>
  );
}

function formatVal(v: number | null, unit: string | null): string {
  if (v == null) return '—';
  const suffix = unit ? unit : '';
  const num = Math.abs(v) >= 1000
    ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : v.toLocaleString(undefined, { maximumSignificantDigits: 3 });
  return `${num}${suffix}`;
}
