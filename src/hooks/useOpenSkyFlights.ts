/**
 * useOpenSkyFlights — polls the OpenSky Network REST API for live
 * airborne aircraft positions and exposes them to the trade overlay.
 *
 * Why REST polling (not WebSocket):
 *   OpenSky's public API is REST-only.  Anonymous users get 10-second
 *   server-side state-vector resolution; authenticated users get 5 s.
 *
 * Call-efficiency design (mirrors useAISStream):
 *   • Module-level singleton — one HTTP request in flight at a time,
 *     no matter how many React components subscribe.
 *   • Page Visibility API — the poll interval is suspended entirely
 *     when the tab is hidden (no background network traffic).
 *   • 300 ms grace period before actually cancelling on disable —
 *     rapid toggle-off → toggle-on reuses the latest data.
 *   • localStorage cache (60 s TTL) — if the user re-enables within
 *     60 s the map is populated instantly from cache while the next
 *     fetch is in flight.
 *   • Exponential backoff (60 s → 120 s → 240 s … cap 5 min) on errors.
 *
 * OpenSky anonymous credit budget (per documentation):
 *   400 credits / day.  A global /states/all call (no bounding box,
 *   area > 400 sq°) costs 4 credits — NOT 1.  Budget: 400 ÷ 4 = 100
 *   calls/day.  At 60 s polling that covers ~100 minutes of active use,
 *   which is the right balance for an optional overlay the user explicitly
 *   enables.  Using a bounding box (≤ 25 sq°) drops cost to 1 credit and
 *   would allow 15 s polling again — future optimisation.
 *
 * Authentication (optional, 10× more credits):
 *   Set VITE_OPENSKY_CLIENT_ID and VITE_OPENSKY_CLIENT_SECRET in .env.local.
 *   The singleton will obtain a Bearer token via the OpenID Connect token
 *   endpoint and auto-refresh it before the 30-minute expiry.
 *   With auth: 4,000 credits/day → 1,000 calls → ~16 hours at 60 s.
 *
 * API reference:
 *   https://openskynetwork.github.io/opensky-api/rest.html
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
 * Route through our own Vercel serverless proxy (/api/opensky) instead of
 * calling OpenSky directly from the browser.  This solves two problems:
 *   1. CORS — OpenSky does not guarantee Access-Control-Allow-Origin headers
 *      on every response, so a direct browser fetch() is unreliable.
 *   2. Auth — client credentials stay in Vercel environment variables, never
 *      shipped to the browser bundle.
 *
 * In dev, vite.config.ts proxies /api/opensky → opensky-network.org/api/states/all.
 * In production, api/opensky.ts (Vercel serverless function) handles the call.
 */
const OPENSKY_BASE_URL   = '/api/opensky';
const OPENSKY_TOKEN_URL  = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
/**
 * 60 s polling — conservative but correct for anonymous users.
 * Global fetch costs 4 credits; budget is 400/day → 100 calls/day.
 * 100 × 60 s = 100 minutes of active use per day, which matches
 * realistic usage of an opt-in overlay.
 */
const POLL_INTERVAL_MS    = 60_000;
/**
 * Keep aircraft for 2× the poll interval so a single delayed response
 * does not cause dots to blink out and back.
 */
const STALE_FLIGHT_MS     = 120_000;
const CACHE_KEY           = 'opensky-flights-cache-v1';
const CACHE_TTL_MS        = 60_000;   // match poll interval
const DISCONNECT_GRACE_MS = 300;
const BACKOFF_BASE_MS     = 60_000;   // same as poll interval
const BACKOFF_MAX_MS      = 5 * 60_000;

// Auth is handled server-side in api/opensky.ts (Vercel env vars).
// Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET in Vercel project settings
// for 4,000 credits/day.  No client-side secrets needed.

// ─── Raw OpenSky state-vector tuple ──────────────────────────────────────────
// Indices match the documented array order exactly (rest.html §"State Vectors").
// Index 17 (category) only present when the request includes extended=1.
type RawState = [
  string,              // 0  icao24
  string | null,       // 1  callsign (8 chars, right-padded; nullable)
  string,              // 2  origin_country (inferred from ICAO24)
  number | null,       // 3  time_position (Unix s; last position update)
  number,              // 4  last_contact  (Unix s; last valid message)
  number | null,       // 5  longitude  (WGS-84 decimal °; nullable)
  number | null,       // 6  latitude   (WGS-84 decimal °; nullable)
  number | null,       // 7  baro_altitude (metres; nullable)
  boolean,             // 8  on_ground
  number | null,       // 9  velocity     (m/s; nullable)
  number | null,       // 10 true_track   (° clockwise from north; nullable)
  number | null,       // 11 vertical_rate (m/s; positive = climbing; nullable)
  number[] | null,     // 12 sensors      (receiver IDs; null for anonymous)
  number | null,       // 13 geo_altitude (metres; nullable)
  string | null,       // 14 squawk       (Mode-C transponder code; nullable)
  boolean,             // 15 spi          (special purpose indicator)
  number,              // 16 position_source (0=ADS-B 1=ASTERIX 2=MLAT 3=FLARM)
  // 17 category — only present when extended=1 is sent in the request
];

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

  // Auth is handled by api/opensky.ts on the server — no client-side headers needed.

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

  // ── Parse a raw OpenSky state vector ─────────────────────────────────
  function parseState(s: RawState): Flight | null {
    const lng = s[5];
    const lat = s[6];
    if (lng == null || lat == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (s[8]) return null; // on_ground — skip

    return {
      icao24:     s[0],
      callsign:   s[1]?.trim() || undefined,
      country:    s[2] || undefined,
      lat,
      lng,
      altitudeM:  typeof s[7]  === 'number' ? s[7]  : undefined,
      velocityMs: typeof s[9]  === 'number' ? s[9]  : undefined,
      track:      typeof s[10] === 'number' ? s[10] : undefined,
      lastSeen:   Date.now(),
    };
  }

  // ── Single poll ───────────────────────────────────────────────────────
  async function poll(): Promise<void> {
    if (fetchInFlight || document.visibilityState === 'hidden') return;
    fetchInFlight = true;

    try {
      const res = await fetch(OPENSKY_BASE_URL);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`OpenSky proxy ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
      }

      const json = await res.json() as { states: RawState[] | null };

      if (Array.isArray(json.states)) {
        for (const raw of json.states) {
          const flight = parseState(raw);
          if (flight) flightMap.set(flight.icao24, flight);
        }
      }

      prune();
      saveCache();
      backoffDelay = BACKOFF_BASE_MS; // reset on success

      const n = flightMap.size;
      if (status !== 'live') {
        console.info(`[OpenSky] first data — ${n.toLocaleString()} airborne aircraft`);
        setStatus('live');
      } else {
        console.debug(`[OpenSky] updated — ${n.toLocaleString()} aircraft`);
        notify();
      }
    } catch (err) {
      console.warn('[OpenSky] fetch error:', err);
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
