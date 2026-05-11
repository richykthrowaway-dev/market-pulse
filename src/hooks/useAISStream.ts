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

  // ── Tier 1 enrichment (NavigationalStatus from PositionReport) ──────────
  /**
   * AIS Navigation Status code (0–15). Common values:
   *   0  = Under way using engine
   *   1  = At anchor
   *   2  = Not under command
   *   3  = Restricted maneuverability
   *   4  = Constrained by her draught
   *   5  = Moored
   *   6  = Aground
   *   7  = Engaged in fishing
   *   8  = Under way sailing
   *   15 = Default / undefined
   */
  navStatus?: number;

  // ── Tier 2 enrichment (from ShipStaticData / StaticDataReport) ──────────
  /** IMO number — permanent unique ship identifier. */
  imo?:         number;
  /** Radio call sign (e.g. "HVOM3"). */
  callSign?:    string;
  /** Captain-entered destination text — e.g. "ROTTERDAM", "FOR ORDERS". */
  destination?: string;
  /** ETA at destination — ISO string. AIS broadcasts month/day/hour/minute (no year). */
  eta?:         string;
  /** Ship length in meters (Dimension A + B). */
  length?:      number;
  /** Ship width in meters (Dimension C + D). */
  width?:       number;
  /** Maximum static draught in meters — how deep the ship sits. */
  draught?:     number;
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

// Position reports for both Class A (large commercial ships) and Class B
// (smaller coastal vessels), PLUS the static-data variants that carry
// destination / ETA / IMO / callsign / dimensions for ship enrichment.
//
// Static data is broadcast every ~6 minutes (much less often than position
// reports, which fire every 2-30 seconds), so a freshly-seen vessel may not
// have destination/IMO info immediately — it streams in over time.
const SUBSCRIBED_MESSAGE_TYPES = [
  'PositionReport',                // Class A position (mostly large vessels)
  'StandardClassBPositionReport',  // Class B position (smaller vessels)
  'ShipStaticData',                // Class A static — destination, ETA, IMO, dimensions
  'StaticDataReport',              // Class B static (split across PartNumber 0 + 1)
] as const;

// ─── Static-data parsing helpers ──────────────────────────────────────────

/**
 * Subset of Vessel fields populated by ShipStaticData / StaticDataReport.
 * Stored as a partial record so we can merge it into a Vessel later when
 * a position report arrives for the same MMSI.
 */
type StaticData = Partial<Pick<Vessel,
  'name' | 'shipType' | 'imo' | 'callSign' | 'destination' | 'eta' |
  'length' | 'width' | 'draught'
>>;

/**
 * AIS ETA broadcasts month/day/hour/minute but NO year — by convention
 * it's interpreted as "the next occurrence." If the broadcast month has
 * already passed in the current year, we roll forward to next year.
 * Returns an ISO datetime string, or undefined if the values are sentinel
 * "not set" markers (month=0, day=0, hour=24, minute=60).
 */
function parseAisEta(eta: { Month?: number; Day?: number; Hour?: number; Minute?: number } | undefined): string | undefined {
  if (!eta) return undefined;
  const { Month = 0, Day = 0, Hour = 24, Minute = 60 } = eta;
  if (!Month || !Day || Month > 12 || Day > 31) return undefined;
  const now    = new Date();
  let   year   = now.getUTCFullYear();
  if (Month < now.getUTCMonth() + 1) year += 1;
  const hour   = Hour   >= 24 ? 0 : Hour;
  const minute = Minute >= 60 ? 0 : Minute;
  const d = new Date(Date.UTC(year, Month - 1, Day, hour, minute));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Extract length/width from AIS Dimension A/B/C/D (each is a distance in metres). */
function parseAisDimension(
  dim: { A?: number; B?: number; C?: number; D?: number } | undefined,
): { length?: number; width?: number } {
  if (!dim) return {};
  const A = dim.A ?? 0, B = dim.B ?? 0, C = dim.C ?? 0, D = dim.D ?? 0;
  const length = A + B || undefined;
  const width  = C + D || undefined;
  return { length, width };
}

/** Parse a ShipStaticData (Class A) message body into a StaticData record. */
function parseShipStaticData(body: any): StaticData {
  const dim = parseAisDimension(body?.Dimension);
  return {
    name:        typeof body?.Name        === 'string' ? body.Name.trim()        : undefined,
    callSign:    typeof body?.CallSign    === 'string' ? body.CallSign.trim()    : undefined,
    destination: typeof body?.Destination === 'string' ? body.Destination.trim() : undefined,
    imo:         typeof body?.ImoNumber   === 'number' ? body.ImoNumber
               : typeof body?.Imo         === 'number' ? body.Imo
               : undefined,
    shipType:    typeof body?.Type        === 'number' ? body.Type
               : typeof body?.ShipType    === 'number' ? body.ShipType
               : undefined,
    draught:     typeof body?.MaximumStaticDraught === 'number' ? body.MaximumStaticDraught : undefined,
    eta:         parseAisEta(body?.Eta),
    length:      dim.length,
    width:       dim.width,
  };
}

/**
 * Parse a StaticDataReport (Class B) message body.  Class B static data is
 * split into two parts: PartNumber 0 carries the name, PartNumber 1 carries
 * shipType / CallSign / Dimension.  Each part returns its own slice.
 */
function parseStaticDataReport(body: any): StaticData {
  const partNum = body?.PartNumber;
  if (partNum === 0) {
    return {
      name: typeof body?.Name === 'string' ? body.Name.trim() : undefined,
    };
  }
  if (partNum === 1) {
    const dim = parseAisDimension(body?.Dimension);
    return {
      shipType:  typeof body?.ShipType === 'number' ? body.ShipType : undefined,
      callSign:  typeof body?.CallSign === 'string' ? body.CallSign.trim() : undefined,
      length:    dim.length,
      width:     dim.width,
    };
  }
  return {};
}

/** Drop undefined / empty values so a merge never overwrites real data with junk. */
function compact<T extends Record<string, any>>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in o) {
    const v = o[k];
    if (v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v))) {
      (out as any)[k] = v;
    }
  }
  return out;
}

// ─── Module-level singleton state ─────────────────────────────────────────────
// Shared by all hook instances in the same JS module (same browser tab).

type Listener = (vessels: Vessel[], status: AISStatus, rawMsgCount: number) => void;

const singleton = (() => {
  let ws:              WebSocket | null = null;
  let status:          AISStatus = 'idle';
  let vesselMap:       Map<number, Vessel> = new Map();
  // Orphan static data: arrives before we've seen a PositionReport for this
  // MMSI. Kept here until a position report creates the vessel, at which
  // point we merge and delete. Bounded growth — pruned alongside vessels.
  let staticDataMap:   Map<number, StaticData> = new Map();
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
    // Safety cap on the orphan static-data map.  In practice this map stays
    // small (most vessels broadcast position before static), but if a ship
    // ever broadcasts static-only its entry would sit here forever.  Cap at
    // 5 000 — well above realistic counts — and clear on overflow so the
    // next static broadcast (every ~6 min) re-populates.
    if (staticDataMap.size > 5_000) staticDataMap.clear();

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

        // Dispatch by message type. Four kinds matter to us:
        //   • PositionReport               — Class A position (lat/lng + course + speed + navStatus)
        //   • StandardClassBPositionReport — Class B position (same core fields, no navStatus)
        //   • ShipStaticData               — Class A static (destination, ETA, IMO, dims, draught)
        //   • StaticDataReport             — Class B static (name + callSign + dims, split in 2 parts)
        const meta    = msg.MetaData ?? msg.Metadata ?? {};
        const msgType = msg.MessageType;

        // ── Resolve MMSI (used by every branch) ──────────────────────────
        const mmsiRaw =
          meta.MMSI
          ?? msg.Message?.PositionReport?.UserID
          ?? msg.Message?.StandardClassBPositionReport?.UserID
          ?? msg.Message?.ShipStaticData?.UserID
          ?? msg.Message?.StaticDataReport?.UserID;
        const mmsi = typeof mmsiRaw === 'number' ? mmsiRaw
                   : typeof mmsiRaw === 'string' ? parseInt(mmsiRaw, 10)
                   : NaN;
        if (!mmsi || isNaN(mmsi)) return;

        // ── Static-data branch (no position, just enrichment) ────────────
        if (msgType === 'ShipStaticData' || msgType === 'StaticDataReport') {
          const slice = msgType === 'ShipStaticData'
            ? parseShipStaticData(msg.Message?.ShipStaticData)
            : parseStaticDataReport(msg.Message?.StaticDataReport);
          const clean = compact(slice);
          if (Object.keys(clean).length === 0) return;

          const existing = vesselMap.get(mmsi);
          if (existing) {
            // Vessel already on the map — merge enrichment in place.
            vesselMap.set(mmsi, { ...existing, ...clean });
          } else {
            // No position yet — stash in the orphan map.  When a
            // PositionReport for this MMSI arrives we'll merge it then.
            const prior = staticDataMap.get(mmsi) ?? {};
            staticDataMap.set(mmsi, { ...prior, ...clean });
          }
          return;
        }

        // ── Position-report branch ───────────────────────────────────────
        const isClassA = msgType === 'PositionReport';
        const isClassB = msgType === 'StandardClassBPositionReport';
        if (!isClassA && !isClassB) return;

        const pos = isClassA
          ? msg.Message?.PositionReport
          : msg.Message?.StandardClassBPositionReport;
        if (!pos) return;

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

        // ── Tier 1: Navigation status (Class A only; Class B doesn't carry it) ──
        // Codes:
        //   0=Under way (engine), 1=Anchored, 2=Not under cmd, 3=Restricted mvr,
        //   4=Constrained by draught, 5=Moored, 6=Aground, 7=Fishing, 8=Sailing,
        //   15=Default/undefined.  Other values (9-14) are reserved.
        const navRaw    = pos.NavigationalStatus;
        const navStatus = typeof navRaw === 'number' && navRaw >= 0 && navRaw <= 15 && navRaw !== 15
          ? navRaw : undefined;

        // Drain any orphan static data we received before this position report.
        const orphan = staticDataMap.get(mmsi);
        if (orphan) staticDataMap.delete(mmsi);

        const positionPart = compact({
          name:     typeof meta.ShipName  === 'string' ? meta.ShipName.trim() : undefined,
          shipType: typeof pos.ShipType   === 'number' ? pos.ShipType
                  : typeof meta.ShipType  === 'number' ? meta.ShipType : undefined,
          cog:     typeof pos.Cog === 'number' ? pos.Cog : undefined,
          sog:     typeof pos.Sog === 'number' ? pos.Sog : undefined,
          heading,
          navStatus,
        });

        // Merge order: existing vessel → orphan static → fresh position fields.
        // Fresh position fields win over orphan static (e.g. shipType from
        // a position report supersedes a stale orphan), but existing vessel
        // values are kept when neither orphan nor position supply them.
        const existing = vesselMap.get(mmsi);
        vesselMap.set(mmsi, {
          ...(existing ?? {}),
          ...(orphan   ?? {}),
          ...positionPart,
          mmsi,
          lat, lng,
          lastSeen: Date.now(),
        } as Vessel);
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
      staticDataMap.clear();
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
