import { Compass } from 'lucide-react';
import type { DestinationTally } from '@/hooks/useAisDerivedMetrics';
import { cn } from '@/lib/utils';

/**
 * VesselDestinationsBoard — top inbound ports from live AIS captain-typed
 * `destination` fields.
 *
 * AIS broadcasts a free-form destination string set by the captain
 * ("ROTTERDAM", "SHANGHAI", "FOR ORDERS").  We aggregate across all
 * tracked vessels and show the top destinations to give a "where is
 * shipping heading right now" snapshot.
 *
 * The destination is captain-typed, so noise filtering is important:
 *   - DESTINATION_NOISE set in useAisDerivedMetrics drops "FOR ORDERS",
 *     "AT ANCHOR", etc.
 *   - Minimum length 3 (skip "X", ".", etc.)
 *   - Normalised to UPPERCASE in the hook
 *
 * Bars are scaled to the leading destination so relative magnitude is
 * legible even when overall counts are low.
 */

interface Props {
  topDestinations: DestinationTally[];
  /** Whether AIS is connected and feeding data. */
  aisLive:         boolean;
}

/**
 * Lightly humanise the all-uppercase destination string for display.
 * AIS captains type in caps so the data is shouty by default; we present
 * Title Case but keep tabular-nums alignment intact.
 */
function presentDestination(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    // Common ports left fully capitalised when 3-letter UN/LOCODEs are typed
    .replace(/\bUk\b/g, 'UK')
    .replace(/\bUae\b/g, 'UAE')
    .replace(/\bUs\b/g, 'US')
    .replace(/\bUsa\b/g, 'USA');
}

export function VesselDestinationsBoard({ topDestinations, aisLive }: Props) {
  const maxCount = topDestinations[0]?.count ?? 0;

  return (
    <div className="px-4 py-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Compass className="w-3 h-3" />
        Top Vessel Destinations
      </h3>

      {!aisLive ? (
        <p className="text-[10px] italic text-muted-foreground/70">
          Enable Live Vessels (Intelligence overlay) to populate destinations.
        </p>
      ) : topDestinations.length === 0 ? (
        <p className="text-[10px] italic text-muted-foreground/70">
          No destinations broadcast yet — static AIS data is sparse, takes a few minutes to accumulate.
        </p>
      ) : (
        <ul className="space-y-1">
          {topDestinations.map(({ destination, count }) => {
            const widthPct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
            return (
              <li
                key={destination}
                className="grid grid-cols-[1fr_auto] gap-2 items-center px-1"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-medium truncate text-foreground/90"
                      title={destination}
                    >
                      {presentDestination(destination)}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400/80"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  'text-[11px] tabular-nums font-semibold text-foreground/85 w-10 text-right',
                )}>
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        AIS captain-typed destinations · static broadcasts every ~6 min, so freshly-seen vessels may not appear yet.
      </p>
    </div>
  );
}
