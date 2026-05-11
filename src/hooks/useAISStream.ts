import { useEffect, useRef, useState } from 'react';

/**
 * useAISStream — connects to the AISStream WebSocket feed (aisstream.io)
 * and exposes the current set of live vessel positions.
 *
 * ── Call-efficiency design ──────────────────────────────────────────────
 *
 * A single WebSocket connection is shared across ALL hook instances via a
 * module-level singleton. This means:
 *   • React Strict Mode double-mount → 1 connection, not 2.
 *   • Multiple components consuming the hook → still 1 connection.
 *   • Rapid enable/disable toggles → debounced by a 300 ms grace period
 *     before the socket actually closes (re-enabling within the window
 *     reuses the existing connection).
 *
 * Vessel positions are persisted to localStorage (`ais-vessel-cache-v1`)
 * on every flush. On the next enable the cache is loaded immediately, so
 * the map shows vessels instantly rather than building from zero.
 *
 * Page Visibility API: when the tab is hidden we keep the WebSocket open
 * (AISStream counts unique connections, not message throughput) but pause
 * React state flushes. The vessel map still updates in the background, so
 * the tab is instantly up-to-date when the user returns.
 *
 * Exponential backoff (1 s → 2 s → 4 s … cap 30 s) prevents hammering
 * the server after errors or unexpected closes.
 *
 * API key sourcing:
 *   Browser-side key from `import.meta.env.VITE_AISSTREAM_KEY`. Fine for
 *   demo / personal use — for production, route the WebSocket through a
 *   Supabase edge function so the key never reaches the client.
 */

export interface Vessel {
  mmsi:      number;
  name?:     string;
  shipType?: number;
  lat:       number;
  lng:       number;
  /** Course over ground, degrees clockwise from north. */
  cog?:      number;
  /** Speed over ground, knots. */
  sog?:      number;
  /** True heading, degrees (or 511 = unavailable, filtered out). */
  heading?:  number;
  /** Wall-clock ms when we last received a position for this MMSI. */
  lastSeen:  number;
}

export type AISStatus =
  | 'idle'        // not connected (toggle off)
  | 'no-key'      // toggle on but VITE_AISSTREAM_KEY missing
  | 'connecting'  // socket opening
  | 'connected'   // receiving messages
  | 'error';      // socket failed

// ─── Constants ────────────────────────────────────────────────────────────────
const AISSTREAM_URL      = 'wss://stream.aisstream.io/v0/stream';
const FLUSH_INTERVAL_MS  = 2_000;           // React render cadence
const STALE_VESSEL_MS    = 5 * 60 * 1_000; // prune vessels not seen in 5 min
const NO_DATA_TIMEOUT_MS = 12_000;          // warn if no messages in 12 s after open
const CACHE_KEY          = 'ais-vessel-cache-v1';
// Cache TTL — extended to 24 hours so coming back the next day still shows
// vessels instantly.  Cached vessels are given a 60-second grace window on
// load (see loadCache) — the live WebSocket feed refreshes active vessels'
// `lastSeen` long before the grace expires, while truly dormant cached
// vessels get pruned by the normal 5-min stale-prune cycle.
const CACHE_TTL_MS       = 24 * 60 * 60 * 1_000;
const CACHE_LOAD_GRACE_MS = 60 * 1_000; // restored vessels get 60s before stale-pruning
const DISCONNECT_GRACE_MS = 300;            // wait before closing after last subscriber leaves
const BACKOFF_BASE_MS    = 1_000;
const BACKOFF_MAX_MS     = 30_000;

// Both Class A (large commercial ships) and Class B (smaller coastal vessels).
const SUBSCRIBED_MESSAGE_TYPES = ['PositionReport', 'StandardClassBPositionReport'] as const;

// ─── Module-level singleton state ─────────────────────────────────────────────
// Shared by all hook instances in the same JS module (same browser tab).

type Listener = (vessels: Vessel[], status: AISStatus, rawMsgCount: number) => void;

const singleton = (() => {
  let ws:              WebSocket | null = null;
  let status:          AISStatus = 'idle';
  let vesselMap:       Map<number, Vessel> = new Map();
  let rawCount         = 0;
  let flushTimer:      ReturnType<typeof setInterval>  | undefined;
  let noDataTimer:     ReturnType<typeof setTimeout>   | undefined;
  let backoffTimer:    ReturnType<typeof setTimeout>   | undefined;
  let disconnectTimer: ReturnType<typeof setTimeout>   | undefined;
  let backoffDelay     = BACKOFF_BASE_MS;
  let refCount         = 0;           // how many hook instances are "enabled"
  let listeners        = new Set<Listener>();

  // ── Cache helpers ──────────────────────────────────────────────────────────
  function saveCache(): void {
    try {
      const payload = {
        vessels:  Array.from(vesselMap.values()),
        savedAt:  Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage quota exceeded — ignore
    }
  }

  function loadCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { vessels, savedAt } = JSON.parse(raw) as { vessels: Vessel[]; savedAt: number };
      if (Date.now() - savedAt > CACHE_TTL_MS) return;   // stale — discard
      // Give every cached vessel a fresh grace window before the stale-prune
      // can touch them.  Active vessels will have their `lastSeen` overwritten
      // by live WebSocket data within seconds; dormant ones age out cleanly
      // once the grace window elapses without a fresh position report.
      const freshLastSeen = Date.now() - (STALE_VESSEL_MS - CACHE_LOAD_GRACE_MS);
      for (const v of vessels) {
        vesselMap.set(v.mmsi, { ...v, lastSeen: freshLastSeen });
      }
    } catch {
      // corrupt cache — ignore
    }
  }

  // ── Notify all subscribed hooks ───────────────────────────────────────────
  function notify(): void {
    const snap = Array.from(vesselMap.values());
    for (const fn of listeners) fn(snap, status, rawCount);
  }

  function setStatus(next: AISStatus): void {
    status = next;
    notify();
  }

  // ── Flush + prune (called on interval, skipped when tab is hidden) ────────
  function flush(): void {
    if (document.visibilityState === 'hidden') return;

    const now    = Date.now();
    const cutoff = now - STALE_VESSEL_MS;
    for (const [mmsi, v] of vesselMap) {
      if (v.lastSeen < cutoff) vesselMap.delete(mmsi);
    }
    saveCache();
    notify();
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  function connect(): void {
    if (ws && ws.readyState <= WebSocket.OPEN) return; // already connecting/open

    const apiKey = (
      typeof import.meta !== 'undefined'
        ? (import.meta.env?.VITE_AISSTREAM_KEY ?? '')
        : ''
    ).toString().trim();

    if (!apiKey) {
      setStatus('no-key');
      return;
    }

    clearTimeout(backoffTimer);
    setStatus('connecting');

    let sock: WebSocket;
    try {
      sock = new WebSocket(AISSTREAM_URL);
    } catch (err) {
      console.error('[AISStream] WebSocket constructor failed:', err);
      scheduleReconnect();
      setStatus('error');
      return;
    }
    ws = sock;

    sock.onopen = () => {
      backoffDelay = BACKOFF_BASE_MS; // reset backoff on successful open

      sock.send(JSON.stringify({
        Apikey:             apiKey,
        BoundingBoxes:      [[[-90, -180], [90, 180]]],
        FilterMessageTypes: [...SUBSCRIBED_MESSAGE_TYPES],
      }));

      // Warn if no data after NO_DATA_TIMEOUT_MS
      noDataTimer = setTimeout(() => {
        if (rawCount === 0) {
          console.warn(
            '[AISStream] No messages in', NO_DATA_TIMEOUT_MS / 1_000,
            's after subscription. Possible causes: free-tier rate limit, API key silently rejected, or WSS blocked.',
          );
        }
      }, NO_DATA_TIMEOUT_MS);
    };

    sock.onmessage = async (event) => {
      rawCount += 1;

      if (rawCount === 1) {
        clearTimeout(noDataTimer);
        setStatus('connected');
      }

      try {
        const raw = event.data instanceof Blob
          ? await event.data.text()
          : (event.data as string);
        const msg = JSON.parse(raw);

        // Server-side error payload → e.g. bad key, oversized bbox
        if (msg && typeof msg === 'object' && typeof msg.error === 'string') {
          console.error('[AISStream] server error:', msg.error);
          setStatus('error');
          sock.close();
          return;
        }

        const isClassA = msg.MessageType === 'PositionReport';
        const isClassB = msg.MessageType === 'StandardClassBPositionReport';
        if (!isClassA && !isClassB) return;

        // Real messages use MetaData (capital D); try both spellings defensively
        const meta = msg.MetaData ?? msg.Metadata ?? {};
        const pos  = isClassA
          ? msg.Message?.PositionReport
          : msg.Message?.StandardClassBPositionReport;
        if (!pos) return;

        const mmsiRaw = meta.MMSI ?? pos.UserID;
        const mmsi    = typeof mmsiRaw === 'number' ? mmsiRaw
                      : typeof mmsiRaw === 'string' ? parseInt(mmsiRaw, 10)
                      : NaN;
        if (!mmsi || isNaN(mmsi)) return;

        // Coordinates: MetaData uses lowercase keys in real messages
        const lat = typeof meta.latitude  === 'number' ? meta.latitude
                  : typeof meta.Latitude  === 'number' ? meta.Latitude
                  : typeof pos.Latitude   === 'number' ? pos.Latitude
                  : null;
        const lng = typeof meta.longitude === 'number' ? meta.longitude
                  : typeof meta.Longitude === 'number' ? meta.Longitude
                  : typeof pos.Longitude  === 'number' ? pos.Longitude
                  : null;

        if (lat === null || lng === null) return;
        // AIS sentinel: lat 91 / lng 181 = unavailable
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

        const headingRaw = pos.TrueHeading;
        const heading = typeof headingRaw === 'number' && headingRaw < 360
          ? headingRaw : undefined;

        vesselMap.set(mmsi, {
          mmsi,
          name:     typeof meta.ShipName  === 'string' ? meta.ShipName.trim() : undefined,
          shipType: typeof pos.ShipType   === 'number' ? pos.ShipType
                  : typeof meta.ShipType  === 'number' ? meta.ShipType : undefined,
          lat, lng,
          cog:     typeof pos.Cog === 'number' ? pos.Cog : undefined,
          sog:     typeof pos.Sog === 'number' ? pos.Sog : undefined,
          heading,
          lastSeen: Date.now(),
        });
      } catch (err) {
        console.warn('[AISStream] failed to parse message:', err);
      }
    };

    sock.onerror = () => {
      // onerror is always followed by onclose — let onclose drive reconnect logic
      setStatus('error');
    };

    sock.onclose = (ev) => {
      ws = null;
      clearTimeout(noDataTimer);

      // If there are still active subscribers, reconnect with backoff
      if (refCount > 0) {
        scheduleReconnect();
        setStatus(ev.wasClean ? 'connecting' : 'error');
      } else {
        setStatus('idle');
      }
    };
  }

  // ── Exponential backoff reconnect ─────────────────────────────────────────
  function scheduleReconnect(): void {
    clearTimeout(backoffTimer);
    const delay = backoffDelay;
    backoffDelay = Math.min(backoffDelay * 2, BACKOFF_MAX_MS);
    backoffTimer = setTimeout(connect, delay);
  }

  // ── Disconnect (only when last subscriber leaves, after grace period) ─────
  function maybeDisconnect(): void {
    if (refCount > 0) return;

    disconnectTimer = setTimeout(() => {
      if (refCount > 0) return; // someone re-subscribed in the meantime
      clearTimeout(backoffTimer);
      clearInterval(flushTimer);
      clearTimeout(noDataTimer);
      ws?.close();
      ws = null;
      saveCache();         // persist positions before clearing
      vesselMap.clear();
      rawCount = 0;
      backoffDelay = BACKOFF_BASE_MS;
      setStatus('idle');
      notify();
    }, DISCONNECT_GRACE_MS);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    subscribe(listener: Listener): () => void {
      listeners.add(listener);

      // Immediately deliver current state to the new subscriber
      listener(Array.from(vesselMap.values()), status, rawCount);

      return () => {
        listeners.delete(listener);
      };
    },

    enable(): void {
      clearTimeout(disconnectTimer); // cancel any pending disconnect
      refCount += 1;

      if (refCount === 1) {
        // First subscriber: seed map from cache, then connect
        loadCache();
        rawCount = 0;

        flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

        // Re-notify immediately with cached vessels
        notify();

        connect();
      }
    },

    disable(): void {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) {
        clearInterval(flushTimer);
        maybeDisconnect();
      }
    },
  };
})();


// ─── React hook ───────────────────────────────────────────────────────────────

export function useAISStream(enabled: boolean): {
  vessels:     Vessel[];
  status:      AISStatus;
  vesselCount: number;
  /** Total WebSocket messages received (all types). Useful for debugging. */
  rawMsgCount: number;
} {
  const [vessels,     setVessels]     = useState<Vessel[]>([]);
  const [status,      setStatus]      = useState<AISStatus>('idle');
  const [rawMsgCount, setRawMsgCount] = useState(0);

  // Track whether we've told the singleton we're enabled, so the cleanup
  // handler only calls disable() if we actually called enable().
  const isEnabledRef = useRef(false);

  useEffect(() => {
    // Subscribe to the singleton for state updates
    const unsub = singleton.subscribe((v, s, r) => {
      setVessels(v);
      setStatus(s);
      setRawMsgCount(r);
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

  return {
    vessels,
    status,
    vesselCount: vessels.length,
    rawMsgCount,
  };
}
