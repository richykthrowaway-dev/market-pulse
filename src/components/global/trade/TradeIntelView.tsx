import { Activity, Loader2 } from 'lucide-react';
import { useAISStream } from '@/hooks/useAISStream';
import { useAisDerivedMetrics } from '@/hooks/useAisDerivedMetrics';
import { ChokePointStatusBoard } from './ChokePointStatusBoard';
import { PortStressBoard } from './PortStressBoard';
import { PolicyCalendarStrip } from './PolicyCalendarStrip';
import type { Chokepoint, Seaport } from '@/data/tradeInfrastructure/types';

/**
 * TradeIntelView — the analytical lens of the Trade tab.
 *
 * Composes three derived-data boards:
 *   1. ChokePointStatusBoard   — live AIS density at the 11 chokepoints
 *   2. PortStressBoard         — top 10 ports by current vessel-nearby count
 *   3. PolicyCalendarStrip     — next 7d of high-impact global macro events
 *
 * The view auto-subscribes to AIS via `useAISStream(true)`.  The singleton
 * ref-counts shared connections, so if the user already has Live Vessels
 * enabled on the globe, this is a no-op extra subscriber.  If not, the
 * Intel view brings AIS up on its own (≈ one WebSocket).
 *
 * AIS-derived metrics are throttled to a 10-s recompute cadence so the
 * board doesn't churn on every 2-s flush.
 */

interface Props {
  /** Camera fly-to handler — wires board clicks to globe focus. */
  onCameraFocus?: (lat: number, lng: number, altitude?: number) => void;
}

export function TradeIntelView({ onCameraFocus }: Props) {
  const { vessels, status, vesselCount } = useAISStream(true);
  const metrics = useAisDerivedMetrics(vessels);

  const aisLive = status === 'connected';

  const handleChokepointClick = (cp: Chokepoint) => {
    onCameraFocus?.(cp.lat, cp.lng, 1.6);
  };

  const handlePortClick = (port: Seaport) => {
    onCameraFocus?.(port.lat, port.lng, 1.5);
  };

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
                {vesselCount.toLocaleString()} vessels
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
          Real-time chokepoint and port traffic from the live AIS feed, plus the
          week's high-impact macro calendar.
        </p>
      </div>

      {/* ── The three boards ─────────────────────────────────────────── */}
      <ChokePointStatusBoard
        chokepointCounts={metrics.chokepointCounts}
        aisLive={aisLive}
        onSelect={handleChokepointClick}
      />

      <PortStressBoard
        portCounts={metrics.portCounts}
        aisLive={aisLive}
        onSelect={handlePortClick}
      />

      <PolicyCalendarStrip />
    </div>
  );
}
