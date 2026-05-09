import { useEffect, useRef, useState } from 'react';

/**
 * useAISStream — connects to the AISStream WebSocket feed (aisstream.io)
 * and exposes the current set of live vessel positions.
 *
 * Why a custom hook (not react-query):
 *   AIS is push-only (server → client). A single WebSocket emits hundreds
 *   of position reports per second worldwide. We can't fire React state
 *   updates that fast without locking the main thread, so the hook keeps
 *   a Map<mmsi, Vessel> in a ref and flushes to React state on a 2-second
 *   timer. Renders happen at ≤ 0.5 Hz regardless of message rate.
 *
 * API key sourcing:
 *   Browser-side key from `import.meta.env.VITE_AISSTREAM_KEY`. Fine for
 *   demo / personal use — for production, route the WebSocket through a
 *   Supabase edge function so the key never reaches the client.
 *
 * Lifecycle:
 *   - enabled=false → close socket, clear vessels, status='idle'
 *   - enabled=true, no key → status='no-key' (UI tells user how to fix)
 *   - enabled=true, key present → connect, subscribe to all PositionReport
 *     messages worldwide, flush every 2s, prune vessels stale > 5 min.
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

const AISSTREAM_URL   = 'wss://stream.aisstream.io/v0/stream';
const FLUSH_INTERVAL_MS  = 2_000;           // React render cadence
const STALE_VESSEL_MS    = 5 * 60 * 1_000; // prune vessels not seen in 5 min
const DEBUG_LOG_COUNT    = 5;               // log first N raw messages to console
const NO_DATA_TIMEOUT_MS = 12_000;          // warn if no messages in 12 s after open

// Both Class A (large commercial ships) and Class B (smaller coastal vessels).
// Class B is 5-10× more numerous, so including it dramatically increases the
// chance of seeing vessels from the free tier.
const SUBSCRIBED_MESSAGE_TYPES = ['PositionReport', 'StandardClassBPositionReport'] as const;

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

  // Keep all received vessel state in a ref — no re-render per AIS message.
  const vesselMapRef    = useRef<Map<number, Vessel>>(new Map());
  const wsRef           = useRef<WebSocket | null>(null);
  const flushTimerRef   = useRef<ReturnType<typeof setInterval>>();
  const noDataTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const rawCountRef     = useRef(0);   // incremented per message; flushed with vessel state
  const debugLoggedRef  = useRef(0);   // how many raw msgs have been console-logged

  useEffect(() => {
    // ── Toggle off → tear everything down ─────────────────────────────
    if (!enabled) {
      wsRef.current?.close();
      wsRef.current = null;
      clearInterval(flushTimerRef.current);
      clearTimeout(noDataTimerRef.current);
      vesselMapRef.current.clear();
      rawCountRef.current    = 0;
      debugLoggedRef.current = 0;
      setVessels([]);
      setRawMsgCount(0);
      setStatus('idle');
      return;
    }

    // ── Toggle on → check key, connect, subscribe ─────────────────────
    const apiKey = (import.meta.env.VITE_AISSTREAM_KEY ?? '').toString().trim();
    if (!apiKey) {
      setStatus('no-key');
      return;
    }

    setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(AISSTREAM_URL);
    } catch (err) {
      console.error('[AISStream] WebSocket constructor failed:', err);
      setStatus('error');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('[AISStream] Socket open — sending subscription');
      // Stay in 'connecting' until we actually receive a message — otherwise
      // a server-side rejection (bad key, oversized bbox) would still show
      // "connected" in the UI even though no data ever flows.

      // Subscribe to PositionReport + StandardClassBPositionReport for the
      // whole globe. Class B vessels (coastal, smaller craft) are far more
      // numerous than Class A and improve coverage significantly.
      //
      // IMPORTANT: The field name is "Apikey" (docs confirmed), NOT "APIKey".
      // Case-sensitivity is the most common silent failure cause here.
      ws.send(JSON.stringify({
        Apikey:             apiKey,
        BoundingBoxes:      [[[-90, -180], [90, 180]]],
        FilterMessageTypes: [...SUBSCRIBED_MESSAGE_TYPES],
      }));

      // If no messages arrive within NO_DATA_TIMEOUT_MS, log a warning so
      // the user can investigate free-tier limits or CORS issues.
      noDataTimerRef.current = setTimeout(() => {
        if (rawCountRef.current === 0) {
          console.warn(
            '[AISStream] No messages received in',
            NO_DATA_TIMEOUT_MS / 1000,
            's after subscription was sent.',
            'Possible causes: free-tier rate limit, API key rejected silently,',
            'or network blocking WSS.',
          );
        }
      }, NO_DATA_TIMEOUT_MS);
    };

    ws.onmessage = (event) => {
      rawCountRef.current += 1;

      // First real message means the subscription was accepted by the server.
      // - Flip status to 'connected' (not in onopen) so UI reflects real data flow.
      // - Cancel the no-data warning timer since data is clearly flowing.
      if (rawCountRef.current === 1) {
        setStatus('connected');
        clearTimeout(noDataTimerRef.current);
        console.info('[AISStream] First message received — data is flowing');
      }

      try {
        const msg = JSON.parse(event.data as string);

        // ── Debug: log first N messages so we can see the real shape ──
        if (debugLoggedRef.current < DEBUG_LOG_COUNT) {
          console.log(
            `[AISStream] msg #${rawCountRef.current}:`,
            JSON.stringify(msg).slice(0, 400),
          );
          debugLoggedRef.current += 1;
        }

        // ── Detect server-side error messages.  AISStream returns a JSON
        // body like { "error": "..." } when subscription is invalid (bad key,
        // unauthorised bbox, etc).  Without this branch the user just sees
        // "connected, 0 vessels" forever. ─────────────────────────────────
        if (msg && typeof msg === 'object' && typeof msg.error === 'string') {
          console.error('[AISStream] server error:', msg.error);
          setStatus('error');
          ws.close();
          return;
        }

        // ── Accept both Class A and Class B position reports ──────────────
        // Class A:  msg.MessageType = 'PositionReport'
        // Class B:  msg.MessageType = 'StandardClassBPositionReport'
        const isClassA = msg.MessageType === 'PositionReport';
        const isClassB = msg.MessageType === 'StandardClassBPositionReport';
        if (!isClassA && !isClassB) {
          console.info('[AISStream] unhandled message type:', msg.MessageType);
          return;
        }

        // Docs confirm: "Metadata" (lowercase d), NOT "MetaData".
        // We try both spellings defensively since some AIS providers vary.
        const meta = msg.Metadata ?? msg.MetaData ?? {};
        // Class A data lives under msg.Message.PositionReport
        // Class B data lives under msg.Message.StandardClassBPositionReport
        const pos  = isClassA
          ? msg.Message?.PositionReport
          : msg.Message?.StandardClassBPositionReport;

        if (!pos) {
          console.warn('[AISStream] position payload missing for', msg.MessageType, msg);
          return;
        }

        // MMSI: documented as number in MetaData; fall back to UserID in pos.
        // Accept both number and string (defensive).
        const mmsiRaw = meta.MMSI ?? pos.UserID;
        const mmsi    = typeof mmsiRaw === 'number'
          ? mmsiRaw
          : typeof mmsiRaw === 'string' ? parseInt(mmsiRaw, 10) : NaN;
        if (!mmsi || isNaN(mmsi)) {
          console.warn('[AISStream] could not parse MMSI:', mmsiRaw);
          return;
        }

        // Coordinates: docs show Metadata.Latitude (PascalCase) but real
        // messages from GitHub examples show metadata.latitude (lowercase).
        // We try all three sources, priority: Metadata → PositionReport.
        const lat = typeof meta.Latitude   === 'number' ? meta.Latitude
                  : typeof meta.latitude   === 'number' ? meta.latitude
                  : typeof pos.Latitude    === 'number' ? pos.Latitude
                  : null;
        const lng = typeof meta.Longitude  === 'number' ? meta.Longitude
                  : typeof meta.longitude  === 'number' ? meta.longitude
                  : typeof pos.Longitude   === 'number' ? pos.Longitude
                  : null;

        if (lat === null || lng === null) {
          console.warn('[AISStream] missing lat/lng for MMSI', mmsi);
          return;
        }

        // AIS sentinel values: lat 91.0 / lng 181.0 mean "position unavailable"
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

        // Heading 511 = "not available" per ITU-R M.1371 AIS spec.
        const headingRaw = pos.TrueHeading;
        const heading = typeof headingRaw === 'number' && headingRaw < 360
          ? headingRaw : undefined;

        vesselMapRef.current.set(mmsi, {
          mmsi,
          name:     typeof meta.ShipName === 'string' ? meta.ShipName.trim() : undefined,
          shipType: typeof pos.ShipType  === 'number' ? pos.ShipType
                  : typeof meta.ShipType === 'number' ? meta.ShipType : undefined,
          lat,
          lng,
          cog:     typeof pos.Cog === 'number' ? pos.Cog : undefined,
          sog:     typeof pos.Sog === 'number' ? pos.Sog : undefined,
          heading,
          lastSeen: Date.now(),
        });

      } catch (err) {
        console.warn('[AISStream] failed to parse message:', err, event.data);
      }
    };

    ws.onerror = (ev) => {
      console.error('[AISStream] WebSocket error:', ev);
      setStatus('error');
    };

    ws.onclose = (ev) => {
      console.info(`[AISStream] Socket closed — code ${ev.code}, clean: ${ev.wasClean}`);
      // Only flip to idle if we were connected — a 'connecting' close is an error.
      setStatus((prev) =>
        prev === 'connected' ? 'idle' :
        prev === 'connecting' ? 'error' :
        prev,
      );
    };

    // Flush vessel snapshot to React every FLUSH_INTERVAL_MS.
    flushTimerRef.current = setInterval(() => {
      const now    = Date.now();
      const cutoff = now - STALE_VESSEL_MS;

      // Prune stale vessels (their broadcast slot may have been re-assigned).
      for (const [mmsi, v] of vesselMapRef.current) {
        if (v.lastSeen < cutoff) vesselMapRef.current.delete(mmsi);
      }

      setVessels(Array.from(vesselMapRef.current.values()));
      setRawMsgCount(rawCountRef.current);
    }, FLUSH_INTERVAL_MS);

    return () => {
      ws.close();
      clearInterval(flushTimerRef.current);
      clearTimeout(noDataTimerRef.current);
      vesselMapRef.current.clear();
    };
  }, [enabled]);

  return {
    vessels,
    status,
    vesselCount: vessels.length,
    rawMsgCount,
  };
}
