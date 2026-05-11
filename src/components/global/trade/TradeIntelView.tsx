import { useMemo } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { useAISStream, matchesVesselType, type VesselTypeFilter } from '@/hooks/useAISStream';
import { useAisDerivedMetrics } from '@/hooks/useAisDerivedMetrics';
import { ChokePointStatusBoard } from './ChokePointStatusBoard';
import { PortStressBoard } from './PortStressBoard';
import { VesselDestinationsBoard } from './VesselDestinationsBoard';
import { PolicyCalendarStrip } from './PolicyCalendarStrip';
import { YieldCurveWidget } from './YieldCurveWidget';
import type { Chokepoint, Seaport } from '@/data/tradeInfrastructure/types';

/**
 * TradeIntelView — the analytical lens of the Trade tab.
 *
 * Composes five derived-data sections, top-to-bottom:
 *   1. US Yield Curve widget   — leading recession indicator (Treasury 2-10 spread)
 *   2. ChokePointStatusBoard   — live AIS density at the 11 chokepoints
 *   3. PortStressBoard         — top 10 ports with stationary/moving split
 *   4. VesselDestinationsBoard — most-broadcast vessel destinations
 *   5. PolicyCalendarStrip     — next 7d of high-impact global macro events
 *
 * The view auto-subscribes to AIS via `useAISStream(true)`.  The singleton
 * ref-counts shared connections, so if the user already has Live Vessels
 * enabled on the globe, this is a no-op extra subscriber.
 *
 * When the user has the vessel-type filter set on the globe ("Tankers
 * only" etc.), we apply the same filter here so the Intel metrics stay
 * consistent with what's visible on the map.  Filter state lives in
 * Global.tsx and is passed in via the `vesselTypeFilter` prop.
 *
 * AIS-derived metrics are throttled to a 10-s recompute cadence so the
 * board doesn't churn on every 2-s flush.
 */

interface Props {
  /** Camera fly-to handler — wires board clicks to globe focus. */
  onCameraFocus?:    (lat: number, lng: number, altitude?: number) => void;
  /** Filter applied to the vessel snapshot before computing AIS metrics. */
  vesselTypeFilter?: VesselTypeFilter;
}

export function TradeIntelView({ onCameraFocus, vesselTypeFilter = 'all' }: Props) {
  const { vessels, status, vesselCount } = useAISStream(true);

  // Apply the type filter BEFORE feeding the metrics — so chokepoint counts,
  // port counts, and destination tallies all reflect the user's lens.
  const filteredVessels = useMemo(
    () => vesselTypeFilter === 'all'
      ? vessels
      : vessels.filter(v => matchesVesselType(v, vesselTypeFilter)),
    [vessels, vesselTypeFilter],
  );

  const metrics = useAisDerivedMetrics(filteredVessels);

  const aisLive = status === 'connected';

  const handleChokepointClick = (cp: Chokepoint) => {
    onCameraFocus?.(cp.lat, cp.lng, 1.6);
  };

  const handlePortClick = (port: Seaport) => {
    onCameraFocus?.(port.lat, port.lng, 1.5);
  };

  // Total visible count = post-filter snapshot size, useful when filter is on.
  const displayCount = vesselTypeFilter === 'all' ? vesselCount : filteredVessels.length;

  return (
    <div className="flex flex-col">
      {/* ── Header strip ─────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-sm font-semibold">Live Trade Intelligence</h3>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {status === 'connecting' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting…
              </>
            )}
            {status === 'connected' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {displayCount.toLocaleString()} vessels
                {vesselTypeFilter !== 'all' && (
                  <span className="text-muted-foreground/70 lowercase">({vesselTypeFilter})</span>
                )}
              </>
            )}
            {status === 'idle' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                AIS idle
              </>
            )}
            {status === 'no-key' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                AIS key missing
              </>
            )}
            {status === 'error' && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                AIS error
              </>
            )}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug mt-1">
          Real-time chokepoint and port traffic, vessel destinations, US yield curve,
          and the week's high-impact macro calendar.
        </p>
      </div>

      {/* ── US Yield Curve (leading recession indicator) ─────────────── */}
      <YieldCurveWidget />

      {/* ── AIS-derived boards ───────────────────────────────────────── */}
      <ChokePointStatusBoard
        chokepointCounts={metrics.chokepointCounts}
        aisLive={aisLive}
        onSelect={handleChokepointClick}
      />

      <PortStressBoard
        portMetrics={metrics.portMetrics}
        aisLive={aisLive}
        onSelect={handlePortClick}
      />

      <VesselDestinationsBoard
        topDestinations={metrics.topDestinations}
        aisLive={aisLive}
      />

      <PolicyCalendarStrip />
    </div>
  );
}
