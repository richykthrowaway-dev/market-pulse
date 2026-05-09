import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useEarningsCalendar, EarningsEvent, type HoldingPair } from '@/hooks/useEarningsCalendar';
import { getCategoryColor } from '@/lib/gicsColors';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDays(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function formatRevenue(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
}

function urgencyClasses(days: number): { border: string; badge: string } {
  if (days < 7) {
    return {
      border: 'border-l-rose-500',
      badge: 'bg-rose-500/10 text-rose-500',
    };
  }
  if (days <= 21) {
    return {
      border: 'border-l-amber-500',
      badge: 'bg-amber-500/10 text-amber-500',
    };
  }
  return {
    border: 'border-l-border',
    badge: 'bg-muted text-muted-foreground',
  };
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 rounded-md bg-muted animate-pulse opacity-60"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

// ─── single event row ─────────────────────────────────────────────────────────

function formatBam(bam: string | null): string | null {
  if (!bam) return null;
  const s = bam.toLowerCase();
  if (s.includes('before') || s === 'bmo') return 'BMO';
  if (s.includes('after')  || s === 'amc') return 'AMC';
  return null;
}

function EventRow({ event, sector }: { event: EarningsEvent; sector?: string | null }) {
  const days = event.daysUntil ?? 0;
  const { border, badge } = urgencyClasses(days);
  const bam = formatBam(event.beforeAfterMarket ?? null);

  // Sector dot — uses the central GICS color registry so the same
  // sector gets the same hue here as in the holdings table, allocation
  // donut, and correlation matrix legend. Falls back to a neutral
  // muted dot when sector is unknown so the layout stays consistent
  // across rows whether sector data exists or not.
  const sectorColor = sector ? getCategoryColor('sector', sector) : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 pl-3 py-1 ${border}`}
    >
      {/* Sector dot */}
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: sectorColor ?? 'hsl(var(--muted-foreground) / 0.3)' }}
        title={sector || 'Sector unknown'}
        aria-label={sector ? `Sector: ${sector}` : 'Sector unknown'}
      />

      {/* Ticker */}
      <span className="font-mono font-bold text-sm min-w-[4rem]">
        {event.ticker}
      </span>

      {/* Date */}
      {event.earningsDate && (
        <span className="text-sm text-foreground">
          {formatDate(event.earningsDate)}
        </span>
      )}

      {/* Days badge */}
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded font-mono ${badge}`}>
        {formatDays(days)}
      </span>

      {/* Before/After market badge */}
      {bam && (
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {bam}
        </span>
      )}

      {/* Divider */}
      <span className="text-muted-foreground/40 hidden sm:inline">|</span>

      {/* EPS estimate */}
      {event.epsEstimate !== null && (
        <span className="text-sm">
          <span className="text-muted-foreground text-xs mr-0.5">EPS est.</span>
          <span className="font-mono font-medium">
            ${event.epsEstimate.toFixed(2)}
          </span>
        </span>
      )}

      {/* Revenue estimate */}
      {event.revenueEstimate !== null && (
        <>
          <span className="text-muted-foreground/40 hidden sm:inline">|</span>
          <span className="text-sm">
            <span className="text-muted-foreground text-xs mr-0.5">Rev est.</span>
            <span className="font-mono font-medium">
              {formatRevenue(event.revenueEstimate)}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface EarningsCalendarProps {
  holdings:   HoldingPair[];
  className?: string;
}

export function EarningsCalendar({ holdings, className }: EarningsCalendarProps) {
  const { data, isLoading } = useEarningsCalendar(holdings);

  const upcoming = data?.slice(0, 8) ?? [];

  // Build a ticker→sector lookup so EventRow can color its dot. We key
  // by the BARE upper-case ticker (no exchange suffix) because that's
  // what the Finnhub-sourced events return; portfolio holdings might
  // have ticker like "RY.TO" while the event has "RY", so normalize.
  const sectorByTicker = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holdings) {
      if (h.sector) {
        const bare = h.ticker.split('.')[0].toUpperCase();
        m.set(bare, h.sector);
      }
    }
    return m;
  }, [holdings]);

  return (
    <div className={`bg-card border border-border rounded-lg p-4 flex flex-col${className ? ` ${className}` : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Upcoming Earnings</h3>
      </div>

      {/* Body — flex-1 so it grows to fill available height */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton />
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No upcoming earnings in the next 90 days
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event) => (
              <EventRow
                key={event.ticker}
                event={event}
                sector={sectorByTicker.get(event.ticker.toUpperCase())}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
