/**
 * useOpenSkyFlights — polls a live ADS-B aggregator (airplanes.live) for
 * airborne aircraft positions and exposes them to the trade overlay.
 *
 * (Filename kept for git-history continuity; the hook originally used
 *  OpenSky Network but had to be migrated — see REGIONS below.)
 *
 * Call-efficiency design (mirrors useAISStream):
 *   • Module-level singleton — one set of HTTP requests in flight at a
 *     time no matter how many React components subscribe.
 *   • Page Visibility API — the poll interval is suspended entirely
 *     when the tab is hidden (no background network traffic).
 *   • 300 ms grace period before actually cancelling on disable —
 *     rapid toggle-off → toggle-on reuses the latest data.
 *   • localStorage cache (60 s TTL) — if the user re-enables within
 *     60 s the map is populated instantly from cache while the next
 *     fetch is in flight.
 *   • Exponential backoff on total failure (30 s → 60 s … cap 5 min).
 *
 * API reference:
 *   https://airplanes.live/rest-api-adsb-data-field-descriptions/
 */

export interface Flight {
  icao24:      string;
  callsign?:   string;
  country?:    string;
  lat:         number;
  lng:         number;
  /** Barometric altitude in metres (null when on ground or unknown). */
  altitudeM?:  number;
  /** Ground speed in m/s. */
  velocityMs?: number;
  /** True track in degrees clockwise from north. */
  track?:      number;
  lastSeen:    number;
}

export type FlightStatus =
  | 'idle'        // layer off
  | 'loading'     // first fetch in progress
  | 'live'        // data flowing
  | 'error';      // fetch failed

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Why airplanes.live (not OpenSky):
 *   OpenSky cannot be used from this app:
 *     • Browser-direct fetch is blocked by CORS — they restrict
 *       Access-Control-Allow-Origin to opensky-network.org itself.
 *     • Server-side proxy is blocked at the network level — OpenSky
 *       blocks all datacenter IPs (AWS, Cloudflare, Supabase Edge, etc.)
 *       so neither Vercel nor Supabase Edge Functions can reach them.
 *
 *   airplanes.live is a community-run ADS-B aggregator that:
 *     • Returns Access-Control-Allow-Origin: * (works from any browser).
 *     • Has no IP filtering.
 *     • Requires no auth, has no documented daily limit.
 *
 * Endpoint:
 *   GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}
 *   Max radius is 250 nautical miles (~463 km).  To approximate a global
 *   view we poll several major air-traffic centres in parallel and dedupe
 *   by hex (ICAO24).  This gives a representative global picture without
 *   exhaustive coverage — the goal is "lots of dots in major regions",
 *   not every aircraft on earth.
 */
const AIRPLANES_LIVE_BASE = 'https://api.airplanes.live/v2/point';

/** Major air-traffic centres — ~250 nm radius each, queried in parallel. */
const REGIONS: ReadonlyArray<readonly [lat: number, lon: number, label: string]> = [
  [40.6, -74.0,  'NYC / NE-US'],
  [34.0, -118.2, 'LAX / SW-US'],
  [41.9,  -87.6, 'ORD / Mid-US'],
  [29.6,  -95.3, 'IAH / S-US'],
  [51.5,   -0.1, 'London'],
  [50.1,    8.7, 'Frankfurt'],
  [41.0,   28.9, 'Istanbul'],
  [25.3,   55.4, 'Dubai'],
  [22.3,  114.2, 'Hong Kong'],
  [35.7,  139.7, 'Tokyo'],
  [ 1.4,  103.8, 'Singapore'],
  [-33.9, 151.2, 'Sydney'],
  [19.4,  -99.1, 'Mexico City'],
  [-23.5, -46.6, 'São Paulo'],
];
const REGION_RADIUS_NM = 250;

const POLL_INTERVAL_MS    = 30_000;          // airplanes.live has no documented limit
const STALE_FLIGHT_MS     = 90_000;          // 3× poll interval
const CACHE_KEY           = 'airplanes-live-flights-cache-v1';
const CACHE_TTL_MS        = 60_000;
const DISCONNECT_GRACE_MS = 300;
const BACKOFF_BASE_MS     = 30_000;
const BACKOFF_MAX_MS      = 5 * 60_000;

// ─── Raw airplanes.live aircraft record ──────────────────────────────────────
// Subset of the readsb/tar1090 schema; we only consume the fields we need.
interface RawAircraft {
  hex:        string;            // 24-bit ICAO address (lowercase hex)
  flight?:    string;            // callsign, right-padded with spaces
  lat?:       number;            // decimal degrees
  lon?:       number;            // decimal degrees
  alt_baro?:  number | 'ground'; // barometric altitude in feet, or 'ground'
  gs?:        number;            // ground speed in knots
  track?:     number;            // true track in degrees
  seen?:      number;            // seconds since last seen
  r?:         string;            // registration (tail number)
}

interface RegionResponse {
  ac?: RawAircraft[];
  now?: number;
  msg?: string;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

type Listener = (flights: Flight[], status: FlightStatus, count: number) => void;

const singleton = (() => {
  let status:           FlightStatus = 'idle';
  let flightMap:        Map<string, Flight> = new Map();
  let refCount         = 0;
  let listeners        = new Set<Listener>();
  let pollTimer:       ReturnType<typeof setInterval>  | undefined;
  let backoffTimer:    ReturnType<typeof setTimeout>   | undefined;
  let disconnectTimer: ReturnType<typeof setTimeout>   | undefined;
  let backoffDelay     = BACKOFF_BASE_MS;
  let fetchInFlight    = false;

  // No auth needed — airplanes.live is fully open.

  // ── Cache helpers ────────────────────────────────────────────────────
  function saveCache(): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        flights: Array.from(flightMap.values()),
        savedAt: Date.now(),
      }));
    } catch { /* quota exceeded — ignore */ }
  }

  function loadCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { flights, savedAt } = JSON.parse(raw) as { flights: Flight[]; savedAt: number };
      if (Date.now() - savedAt > CACHE_TTL_MS) return;
      for (const f of flights) flightMap.set(f.icao24, f);
    } catch { /* corrupt cache — ignore */ }
  }

  // ── Notify ───────────────────────────────────────────────────────────
  function notify(): void {
    const snap = Array.from(flightMap.values());
    for (const fn of listeners) fn(snap, status, snap.length);
  }

  function setStatus(s: FlightStatus): void {
    status = s;
    notify();
  }

  // ── Prune stale aircraft ──────────────────────────────────────────────
  function prune(): void {
    const cutoff = Date.now() - STALE_FLIGHT_MS;
    for (const [id, f] of flightMap) {
      if (f.lastSeen < cutoff) flightMap.delete(id);
    }
  }

  // ── Parse one airplanes.live aircraft record ─────────────────────────
  // Convert imperial → metric to match the existing Flight contract.
  const FT_TO_M  = 0.3048;
  const KT_TO_MS = 0.5144444;
  function parseAircraft(a: RawAircraft): Flight | null {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
    if (Math.abs(a.lat) > 90 || Math.abs(a.lon) > 180) return null;
    if (a.alt_baro === 'ground') return null;

    return {
      icao24:     a.hex,
      callsign:   a.flight?.trim() || undefined,
      country:    undefined, // airplanes.live doesn't surface country
      lat:        a.lat,
      lng:        a.lon,
      altitudeM:  typeof a.alt_baro === 'number' ? a.alt_baro * FT_TO_M : undefined,
      velocityMs: typeof a.gs       === 'number' ? a.gs * KT_TO_MS      : undefined,
      track:      typeof a.track    === 'number' ? a.track              : undefined,
      lastSeen:   Date.now(),
    };
  }

  // ── Single poll — fan out to all regions in parallel, dedupe by hex ──
  async function poll(): Promise<void> {
    if (fetchInFlight || document.visibilityState === 'hidden') return;
    fetchInFlight = true;

    try {
      const results = await Promise.allSettled(
        REGIONS.map(([lat, lon]) =>
          fetch(`${AIRPLANES_LIVE_BASE}/${lat}/${lon}/${REGION_RADIUS_NM}`)
            .then(r => r.ok ? r.json() as Promise<RegionResponse>
                            : Promise.reject(new Error(`HTTP ${r.status}`)))
        ),
      );

      let okCount = 0;
      let added   = 0;
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        okCount += 1;
        const ac = result.value.ac;
        if (!Array.isArray(ac)) continue;
        for (const raw of ac) {
          const flight = parseAircraft(raw);
          if (flight) {
            flightMap.set(flight.icao24, flight);
            added += 1;
          }
        }
      }

      // If every region failed, treat the whole poll as a failure.
      if (okCount === 0) {
        const firstErr = results.find(r => r.status === 'rejected');
        throw new Error(
          firstErr && firstErr.status === 'rejected'
            ? `All ${REGIONS.length} regions failed: ${(firstErr.reason as Error)?.message ?? 'unknown'}`
            : `All ${REGIONS.length} regions failed`,
        );
      }

      prune();
      saveCache();
      backoffDelay = BACKOFF_BASE_MS;

      const n = flightMap.size;
      if (status !== 'live') {
        console.info(`[airplanes.live] first data — ${n.toLocaleString()} airborne aircraft (${okCount}/${REGIONS.length} regions, ${added} updates)`);
        setStatus('live');
      } else {
        console.debug(`[airplanes.live] updated — ${n.toLocaleString()} aircraft (${okCount}/${REGIONS.length} regions)`);
        notify();
      }
    } catch (err) {
      console.warn('[airplanes.live] fetch error:', err);
      setStatus('error');
      // Backoff — stop regular interval and reschedule
      clearInterval(pollTimer);
      pollTimer = undefined;
      const delay = backoffDelay;
      backoffDelay = Math.min(backoffDelay * 2, BACKOFF_MAX_MS);
      backoffTimer = setTimeout(() => {
        if (refCount > 0) startPolling();
      }, delay);
    } finally {
      fetchInFlight = false;
    }
  }

  // ── Start / stop polling ─────────────────────────────────────────────
  function startPolling(): void {
    clearInterval(pollTimer);
    poll(); // immediate first fetch
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  }

  // Pause poll when tab is hidden; resume when visible again
  function onVisibilityChange(): void {
    if (refCount === 0) return;
    if (document.visibilityState === 'visible') {
      startPolling(); // resume — also triggers immediate poll
    } else {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  // ── Disconnect grace ─────────────────────────────────────────────────
  function maybeDisconnect(): void {
    if (refCount > 0) return;
    disconnectTimer = setTimeout(() => {
      if (refCount > 0) return;
      clearInterval(pollTimer);
      clearTimeout(backoffTimer);
      pollTimer = undefined;
      saveCache();
      flightMap.clear();
      backoffDelay = BACKOFF_BASE_MS;
      setStatus('idle');
    }, DISCONNECT_GRACE_MS);
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      listener(Array.from(flightMap.values()), status, flightMap.size);
      return () => listeners.delete(listener);
    },

    enable(): void {
      clearTimeout(disconnectTimer);
      refCount += 1;

      if (refCount === 1) {
        loadCache();
        notify(); // show cached data immediately

        setStatus('loading');
        startPolling();
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
    },

    disable(): void {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        maybeDisconnect();
      }
    },
  };
})();

// ─── React hook ───────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

export function useOpenSkyFlights(enabled: boolean): {
  flights:     Flight[];
  status:      FlightStatus;
  flightCount: number;
} {
  const [flights,     setFlights]     = useState<Flight[]>([]);
  const [status,      setStatus]      = useState<FlightStatus>('idle');
  const [flightCount, setFlightCount] = useState(0);
  const isEnabledRef = useRef(false);

  useEffect(() => {
    const unsub = singleton.subscribe((f, s, c) => {
      setFlights(f);
      setStatus(s);
      setFlightCount(c);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (enabled && !isEnabledRef.current) {
      isEnabledRef.current = true;
      singleton.enable();
    } else if (!enabled && isEnabledRef.current) {
      isEnabledRef.current = false;
      singleton.disable();
    }
    return () => {
      if (isEnabledRef.current) {
        isEnabledRef.current = false;
        singleton.disable();
      }
    };
  }, [enabled]);

  return { flights, status, flightCount };
}
