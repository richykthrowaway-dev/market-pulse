import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEodhdEconomicEvents, type EodhdEconomicEvent } from '@/hooks/useEodhdEconomicEvents';
import { TradingViewEconomicCalendar } from '@/components/tradingview/TradingViewEconomicCalendar';
import { TradeSnapshot } from './TradeSnapshot';
import { TradeBreakdown } from './TradeBreakdown';
import { TradePartners } from './TradePartners';

const PAGE_SIZE = 20;

interface CountryEconomyProps {
  iso2: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY_UTC = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

function eventDateStr(dateRaw: string): string {
  // dateRaw: "YYYY-MM-DD HH:MM:SS" — treat as UTC
  const d = new Date(dateRaw.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dateRaw.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function eventTimeStr(dateRaw: string): string {
  const d = new Date(dateRaw.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 0 && m === 0) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function eventDateKey(dateRaw: string): string {
  return dateRaw.slice(0, 10); // "YYYY-MM-DD"
}

function isPast(event: EodhdEconomicEvent): boolean {
  // An event is "past" if it has an actual value OR its date is before today
  if (event.actual !== null) return true;
  return eventDateKey(event.date) < TODAY_UTC;
}

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return '—';
  const suffix = unit ? ` ${unit}` : '';
  // Keep to 3 significant figures, strip trailing zeros
  const formatted =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : value.toLocaleString(undefined, { maximumSignificantDigits: 3 });
  return `${formatted}${suffix}`;
}

/** Returns +1 if actual is "better", -1 if "worse", 0 if equal/ambiguous */
function compareActualToPrevious(event: EodhdEconomicEvent): 1 | -1 | 0 {
  const { actual, previous } = event;
  if (actual === null || previous === null) return 0;
  if (actual === previous) return 0;
  return actual > previous ? 1 : -1;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpactDot({ impact }: { impact: EodhdEconomicEvent['impact'] }) {
  const cls =
    impact === 'High'
      ? 'bg-red-500'
      : impact === 'Medium'
      ? 'bg-amber-400'
      : 'bg-muted-foreground/40';

  const title = impact ?? 'Unknown';

  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full shrink-0', cls)}
      title={`Impact: ${title}`}
    />
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 py-2 px-2 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
      <div className="h-3 w-16 bg-muted rounded shrink-0" />
      <div className="h-3 flex-1 bg-muted rounded" />
      <div className="h-3 w-10 bg-muted rounded shrink-0" />
      <div className="h-3 w-10 bg-muted rounded shrink-0" />
      <div className="h-3 w-10 bg-muted rounded shrink-0" />
    </div>
  );
}

function ColumnHeaders() {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 border-b border-border">
      <span className="w-2 shrink-0" />
      <span className="w-[72px] shrink-0">Date</span>
      <span className="flex-1 min-w-0">Event</span>
      <span className="w-14 text-right shrink-0">Actual</span>
      <span className="w-14 text-right shrink-0">Est.</span>
      <span className="w-14 text-right shrink-0">Prev.</span>
    </div>
  );
}

function EventRow({ event }: { event: EodhdEconomicEvent }) {
  const direction = compareActualToPrevious(event);
  const hasActual = event.actual !== null;

  const actualColor =
    hasActual && direction === 1
      ? 'text-emerald-500'
      : hasActual && direction === -1
      ? 'text-red-500'
      : 'text-foreground';

  const dateStr = eventDateStr(event.date);
  const timeStr = eventTimeStr(event.date);

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-2 px-2 text-xs rounded-md transition-colors',
        'hover:bg-muted/40',
        !hasActual && 'opacity-90',
      )}
    >
      {/* Impact dot */}
      <ImpactDot impact={event.impact} />

      {/* Date + time */}
      <div className="w-[72px] shrink-0 text-muted-foreground tabular-nums leading-tight">
        <span>{dateStr}</span>
        {timeStr && (
          <>
            <br />
            <span className="text-[10px]">{timeStr}</span>
          </>
        )}
      </div>

      {/* Event name */}
      <span className="flex-1 min-w-0 truncate text-foreground/90" title={event.type}>
        {event.type}
      </span>

      {/* Actual */}
      <span
        className={cn('w-14 text-right tabular-nums shrink-0 font-semibold', actualColor)}
        title={hasActual ? `Actual: ${event.actual}` : undefined}
      >
        {hasActual ? formatValue(event.actual, event.unit) : '—'}
      </span>

      {/* Estimate */}
      <span
        className="w-14 text-right tabular-nums shrink-0 text-muted-foreground"
        title={event.estimate !== null ? `Estimate: ${event.estimate}` : undefined}
      >
        {formatValue(event.estimate, event.unit)}
      </span>

      {/* Previous */}
      <span
        className="w-14 text-right tabular-nums shrink-0 text-muted-foreground"
        title={event.previous !== null ? `Previous: ${event.previous}` : undefined}
      >
        {formatValue(event.previous, event.unit)}
      </span>
    </div>
  );
}

function TodayDivider() {
  return (
    <div className="flex items-center gap-2 py-1 px-2 select-none">
      <div className="flex-1 border-t border-dashed border-border" />
      <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted/50 border border-border">
        Today
      </span>
      <div className="flex-1 border-t border-dashed border-border" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CountryEconomy({ iso2 }: CountryEconomyProps) {
  const [page, setPage] = useState(0);
  const { data: events = [], isLoading, isError } = useEodhdEconomicEvents(iso2);

  // Split into past (have actuals) and upcoming (no actuals), sorted by date asc
  const pastEvents = events.filter(isPast);
  const upcomingEvents = events.filter((e) => !isPast(e));

  // Combined list for pagination: past first (chronological), then upcoming
  const allEvents = [...pastEvents, ...upcomingEvents];
  const totalPages = Math.max(1, Math.ceil(allEvents.length / PAGE_SIZE));
  const pageEvents = allEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Find where the past→upcoming boundary falls within this page
  const pastOnPage = pageEvents.filter(isPast);
  const upcomingOnPage = pageEvents.filter((e) => !isPast(e));
  const showDivider = pastOnPage.length > 0 && upcomingOnPage.length > 0;

  return (
    <div className="space-y-4 pt-1">
      {/* ── Section 0: Trade & external-sector snapshot ── */}
      <TradeSnapshot iso2={iso2} />

      {/* ── Section 0.5: Trade composition (top exports + imports) ── */}
      <TradeBreakdown iso2={iso2} />

      {/* ── Section 0.6: Top trading partners (geographic counterparties) ── */}
      <TradePartners iso2={iso2} />

      {/* ── Section 1: EODHD Economic Calendar ── */}
      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">
              Economic Calendar
            </span>
            <span className="text-xs text-muted-foreground">· EODHD</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              ±30 days
            </span>
          </div>
          {!isLoading && !isError && events.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {events.length} events
            </span>
          )}
        </div>

        {/* Impact legend */}
        {!isLoading && !isError && events.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-2 pb-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              High
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />
              Low
            </span>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div>
              <ColumnHeaders />
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Unable to load economic events</p>
              <p className="text-xs text-muted-foreground/70">
                EODHD quota may be exhausted. Try again after UTC midnight.
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <Calendar className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No economic events found</p>
              <p className="text-xs text-muted-foreground/70">
                No releases scheduled in the ±30 day window.
              </p>
            </div>
          ) : (
            <div>
              <ColumnHeaders />
              <div className="divide-y divide-border/50">
                {pageEvents.map((event, idx) => {
                  const isLastPast =
                    showDivider && idx === pastOnPage.length - 1;
                  return (
                    <div key={`${event.date}-${event.type}-${idx}`}>
                      <EventRow event={event} />
                      {isLastPast && <TodayDivider />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex items-center justify-between pt-1 px-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: TradingView Economic Calendar ── */}
      <TradingViewEconomicCalendar
        countryFilter={iso2.toLowerCase()}
        height={400}
        className="rounded-lg overflow-hidden"
      />
    </div>
  );
}
