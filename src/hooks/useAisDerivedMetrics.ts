import { useEffect, useRef, useState } from 'react';
import type { Vessel } from './useAISStream';
import { CHOKEPOINTS } from '@/data/tradeInfrastructure/chokepoints';
import { SEAPORTS }    from '@/data/tradeInfrastructure/seaports';

/**
 * useAisDerivedMetrics — derives chokepoint and port "vessels nearby" counts
 * from the live AIS vessel stream.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The AIS stream gives us thousands of vessel positions per minute, but the
 * Trade tab's intelligence boards want a different shape: per-chokepoint and
 * per-port instantaneous traffic counts.  This hook does the spatial bucketing.
 *
 * ── Performance ────────────────────────────────────────────────────────────
 * Naively recomputing 11 chokepoints × 35 ports × ~10k vessels every 2 s
 * (the AIS flush cadence) costs ~500k distance computations per second —
 * wasteful.  Two design choices keep it cheap:
 *
 *   1. Recompute interval is throttled to 10 s.  AIS positions drift slowly
 *      enough that 10-s freshness is more than sufficient for a status board.
 *   2. Distance is approximated using a flat-earth equirectangular formula
 *      (cos-lat scaling on longitude).  At the small radii we care about
 *      (≤ 100 km), the error vs true haversine is sub-percent, and the math
 *      is ~5× faster.
 *
 * The hook returns counts only — vessel detail lookups are deferred to
 * separate per-feature hooks if needed.
 */

const CHOKEPOINT_RADIUS_KM = 100;  // vessels "near" a chokepoint
const PORT_RADIUS_KM       = 50;   // vessels "in/near" a port
const RECOMPUTE_INTERVAL_MS = 10_000;

// Pre-compute squared thresholds in km² so we can compare without sqrt.
const CP_THRESHOLD_KM2   = CHOKEPOINT_RADIUS_KM * CHOKEPOINT_RADIUS_KM;
const PORT_THRESHOLD_KM2 = PORT_RADIUS_KM * PORT_RADIUS_KM;

// Pre-build the target arrays once with their cos(lat) factor — saves
// trig in the hot loop.  1° latitude ≈ 111 km everywhere; 1° longitude ≈
// 111 × cos(lat) km.
interface Target {
  id:    string;
  lat:   number;
  lng:   number;
  /** cos(lat in radians) — for equirectangular longitude scaling. */
  cosLat: number;
}
const CHOKE_TARGETS: Target[] = CHOKEPOINTS.map(c => ({
  id: c.id, lat: c.lat, lng: c.lng, cosLat: Math.cos(c.lat * Math.PI / 180),
}));
const PORT_TARGETS:  Target[] = SEAPORTS.map(p => ({
  id: p.id, lat: p.lat, lng: p.lng, cosLat: Math.cos(p.lat * Math.PI / 180),
}));

export interface PortMetric {
  /** Total vessels within PORT_RADIUS_KM of this port. */
  total:    number;
  /** Subset whose AIS navStatus indicates stationary at port (anchored or moored). */
  anchored: number;
}

export interface DestinationTally {
  /** Normalised destination string (uppercase, trimmed). */
  destination: string;
  /** Vessel count broadcasting this destination. */
  count:       number;
}

export interface AisDerivedMetrics {
  /** Map of chokepoint id → instantaneous nearby vessel count. */
  chokepointCounts: Map<string, number>;
  /** Map of port id → { total, anchored } breakdown. */
  portMetrics:      Map<string, PortMetric>;
  /** Top vessel-destination strings ranked by frequency.  Pre-sorted desc. */
  topDestinations:  DestinationTally[];
  /** Timestamp of the last derivation pass (ms epoch). */
  computedAt:       number;
  /** Total vessels in the snapshot the metrics were computed from. */
  vesselTotal:      number;
}

const EMPTY: AisDerivedMetrics = {
  chokepointCounts: new Map(),
  portMetrics:      new Map(),
  topDestinations:  [],
  computedAt:       0,
  vesselTotal:      0,
};

// AIS navStatus codes that mean "vessel is stationary at a location":
//   1 = At anchor
//   5 = Moored
//   6 = Aground
// We treat all three as "anchored" for the purposes of the port-congestion
// indicator since each implies the vessel isn't moving freely.
const STATIONARY_NAV_STATUS = new Set([1, 5, 6]);

// Destination strings to exclude from the tally — these are AIS noise
// rather than actual destinations.  Captains frequently type these when
// they don't have a confirmed destination yet.
const DESTINATION_NOISE = new Set([
  'NIL', 'UNKNOWN', 'NONE', 'N/A', 'NA',
  'FOR ORDERS', 'ORDERS', 'AT ANCHOR', 'AT SEA',
  'OFFSHORE', 'PILOT STATION', 'FISHING',
  'CHARTER', 'TRIAL', 'TRIALS',
]);
const DESTINATION_MIN_LENGTH = 3;
const DESTINATION_TOP_N = 12;

/**
 * Compute counts in a single pass over the vessel array.  Each vessel
 * contributes to at most a few chokepoint/port counters — the spatial
 * thresholds are non-overlapping in practice (chokepoints aren't on top
 * of ports).
 */
function computeMetrics(vessels: Vessel[]): AisDerivedMetrics {
  const chokepointCounts = new Map<string, number>();
  const portMetrics      = new Map<string, PortMetric>();
  const destCounts       = new Map<string, number>();

  for (const v of vessels) {
    const vLat = v.lat;
    const vLng = v.lng;
    const isStationary = v.navStatus != null && STATIONARY_NAV_STATUS.has(v.navStatus);

    // Chokepoints — usually 11 of them, cheap inner loop
    for (const t of CHOKE_TARGETS) {
      const dLat = (vLat - t.lat) * 111;                // km
      const dLng = (vLng - t.lng) * 111 * t.cosLat;     // km
      if (dLat * dLat + dLng * dLng <= CP_THRESHOLD_KM2) {
        chokepointCounts.set(t.id, (chokepointCounts.get(t.id) ?? 0) + 1);
      }
    }

    // Ports — usually 35; tighter radius, split total vs anchored
    for (const t of PORT_TARGETS) {
      const dLat = (vLat - t.lat) * 111;
      const dLng = (vLng - t.lng) * 111 * t.cosLat;
      if (dLat * dLat + dLng * dLng <= PORT_THRESHOLD_KM2) {
        const m = portMetrics.get(t.id);
        if (m) {
          m.total += 1;
          if (isStationary) m.anchored += 1;
        } else {
          portMetrics.set(t.id, { total: 1, anchored: isStationary ? 1 : 0 });
        }
      }
    }

    // Destination tally — captain-typed text, normalised + denoised
    if (typeof v.destination === 'string' && v.destination.length >= DESTINATION_MIN_LENGTH) {
      const norm = v.destination.trim().toUpperCase();
      if (norm.length >= DESTINATION_MIN_LENGTH && !DESTINATION_NOISE.has(norm)) {
        destCounts.set(norm, (destCounts.get(norm) ?? 0) + 1);
      }
    }
  }

  // Materialise top-N destinations; the long tail is noise anyway.
  const topDestinations: DestinationTally[] = Array.from(destCounts.entries())
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, DESTINATION_TOP_N);

  return {
    chokepointCounts,
    portMetrics,
    topDestinations,
    computedAt: Date.now(),
    vesselTotal: vessels.length,
  };
}

/**
 * Hook variant that subscribes to a vessels array and derives metrics on
 * a throttled cadence (10 s).  Returns the most recent derivation.
 *
 * Pass `null` or an empty array to clear metrics (e.g. when AIS is off).
 */
export function useAisDerivedMetrics(vessels: Vessel[] | null | undefined): AisDerivedMetrics {
  const [metrics, setMetrics] = useState<AisDerivedMetrics>(EMPTY);

  // Hold the latest vessels in a ref so the interval callback always sees
  // fresh data without re-creating the timer on every flush.
  const vesselsRef = useRef<Vessel[] | null | undefined>(vessels);
  vesselsRef.current = vessels;

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      const v = vesselsRef.current;
      if (!v || v.length === 0) {
        // Avoid spamming setState with EMPTY — only update if we previously
        // had data.
        setMetrics(prev => prev.vesselTotal === 0 ? prev : EMPTY);
        return;
      }
      const next = computeMetrics(v);
      if (!cancelled) setMetrics(next);
    };

    // Run once immediately so the boards aren't blank for 10 s on mount.
    tick();

    const id = setInterval(tick, RECOMPUTE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return metrics;
}
