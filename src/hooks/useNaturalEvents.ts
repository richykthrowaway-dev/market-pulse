import { useMemo } from 'react';
import { useQueries, type UseQueryOptions } from '@tanstack/react-query';
import { COUNTRY_META } from '@/data/countryMeta';

/**
 * useNaturalEvents — natural disaster events from NASA EONET.
 *
 * Feed: https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300
 *   - Free, no auth, CORS-open (same pattern as USGS earthquakes)
 *   - Returns active events across 13 categories; we filter to 4
 *   - Each event has multiple geometry points (e.g. a tropical cyclone has
 *     a track) — we keep only the MOST RECENT point as the "current" location
 *   - EONET geometry coordinates are GeoJSON-ordered: [lng, lat]
 *
 * Country attribution:
 *   EONET doesn't tag events with countries; we approximate via nearest-
 *   centroid lookup against COUNTRY_META.  This is good enough for the
 *   "affected commodities" panel — exact admin-level resolution isn't needed
 *   when we're showing "could affect oil supply" because Saudi Arabia is the
 *   closest centroid to a Persian Gulf storm.
 *
 * Refetch: 30 minute stale window — EONET refreshes every ~30-60 minutes
 * for fast-moving categories (wildfires) and slower for others.
 */

export type NaturalEventCategory =
  | 'wildfires'
  | 'severeStorms'
  | 'volcanoes'
  | 'floods';

export interface NaturalEventSource {
  id:  string;
  url: string;
}

export interface NaturalEvent {
  id:           string;
  title:        string;
  category:     NaturalEventCategory;
  /** ISO date string YYYY-MM-DD from the latest geometry point. */
  date:         string;
  lat:          number;
  lng:          number;
  /** Nearest-centroid country ISO2 — best-effort, may be empty for open-ocean events. */
  countryIso2:  string;
  description:  string | null;
  /** EONET detail page or upstream source URL. */
  sourceUrl:    string;
  /** Source agency name, e.g. "InciWeb", "NASA FIRMS", "NOAA NHC". */
  sourceName:   string | null;
  /** Full source list (id + url per source). */
  sources:      NaturalEventSource[];
  /** Number of geometry points — high count = long-duration / long-track event. */
  geometryCount: number;
  /**
   * EONET event-closed timestamp.  null = currently open / active.
   * String = ISO datetime when the event was marked closed.
   */
  closed:       string | null;
  /**
   * Latest geometry's magnitude value — the event's quantitative size.
   * Per category:
   *   wildfires    → acres (or hectares — see magnitudeUnit)
   *   severeStorms → average max sustained wind speed in knots
   *   volcanoes    → usually unset
   *   floods       → usually unset
   */
  magnitudeValue: number | null;
  /** Unit label for `magnitudeValue` — e.g. "acres", "kts", "ha". */
  magnitudeUnit:  string | null;
  /**
   * Magnitude growth rate per day, computed from the FIRST and LATEST
   * geometry points.  For wildfires: acres/day spread. For storms: kts/day
   * intensification.  null when fewer than 2 magnitude points exist.
   */
  growthRatePerDay: number | null;
  /**
   * Translation speed of the event over Earth's surface (km/h), from the
   * last two geometry points.  Meaningful for moving systems like storms;
   * largely zero for stationary wildfires.
   */
  motionSpeedKmh:   number | null;
  /**
   * Initial bearing of motion (degrees clockwise from north) from the
   * last two geometry points.  null when only one geometry exists.
   */
  bearingDeg:       number | null;
}

// ── EONET → our category mapping ────────────────────────────────────────────
// EONET category IDs are stable; we map only the 4 we care about for v1.
// Anything not in this map is filtered out at the parse step.
const EONET_CATEGORY_MAP: Record<string, NaturalEventCategory> = {
  wildfires:    'wildfires',
  severeStorms: 'severeStorms',
  volcanoes:    'volcanoes',
  floods:       'floods',
};

// ── Nearest-centroid country lookup ────────────────────────────────────────
// Pre-built at module load from COUNTRY_META.  ~250 centroids, brute-force
// nearest scan is fine — used only at fetch time, not in render loops.
interface Centroid { iso2: string; lat: number; lng: number; cosLat: number }

const COUNTRY_CENTROIDS: Centroid[] = (() => {
  const out: Centroid[] = [];
  for (const [iso2, meta] of Object.entries(COUNTRY_META)) {
    if (typeof meta.lat !== 'number' || typeof meta.lng !== 'number') continue;
    out.push({
      iso2,
      lat: meta.lat,
      lng: meta.lng,
      cosLat: Math.cos(meta.lat * Math.PI / 180),
    });
  }
  return out;
})();

// Equirectangular squared distance — same approximation we use elsewhere.
// At chokepoint/country scale (≤ ~2000 km) the error vs haversine is sub-
// percent and we save the trig.
function nearestCountry(lat: number, lng: number): string {
  let bestIso  = '';
  let bestDist = Infinity;
  for (const c of COUNTRY_CENTROIDS) {
    const dLat = (lat - c.lat) * 111;                  // km
    const dLng = (lng - c.lng) * 111 * c.cosLat;       // km
    const d    = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      bestIso  = c.iso2;
    }
  }
  // Cap at ~1500 km — beyond that the event is probably open ocean and
  // attributing it to a country would mislead the "affected supply" panel.
  if (bestDist > 1500 * 1500) return '';
  return bestIso;
}

// ── EONET response shape (only the fields we read) ────────────────────────
interface EonetGeometry {
  date:        string;            // ISO 8601 with time
  type:        'Point' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
  /** EONET per-point magnitude (fire size, wind speed, etc.). */
  magnitudeValue?: number | null;
  magnitudeUnit?:  string | null;
}

interface EonetEvent {
  id:          string;
  title:       string;
  description: string | null;
  link:        string;
  /** ISO datetime when the event closed; null = still active. */
  closed:      string | null;
  categories:  Array<{ id: string; title: string }>;
  sources:     Array<{ id: string; url: string }>;
  geometry:    EonetGeometry[];
}

interface EonetResponse {
  events: EonetEvent[];
}

// ── Geometry-track derived metrics ─────────────────────────────────────────
// Two-point haversine + bearing.  These run inside the hook on each fetch,
// not in render — they're cheap (~6 trig ops per event) but we still keep
// them outside the React tree so they don't memo-spin.

/** Initial bearing in degrees clockwise from north, going from a → b. */
function bearingBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = aLat * Math.PI / 180;
  const φ2 = bLat * Math.PI / 180;
  const Δλ = (bLng - aLng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

/** Great-circle distance in km via the haversine formula. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // Earth radius km
  const φ1 = aLat * Math.PI / 180;
  const φ2 = bLat * Math.PI / 180;
  const dφ = (bLat - aLat) * Math.PI / 180;
  const dλ = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const NE_STALE = 30 * 60_000; // 30 min

/**
 * Per-category fetch tuning.  Each category has very different volume +
 * freshness characteristics, so a one-size-fits-all single fetch wastes
 * payload on wildfires while starving storms/volcanoes that get pushed
 * off the response.
 *
 * Concretely (data observed live):
 *   - Wildfires:   ~1000+ active+recent globally → narrow window (14d, open)
 *   - SevereStorms: ~7 in 60d (rare outside hurricane season) → wide window,
 *                   include closed so recently-dissipated typhoons still show
 *   - Volcanoes:   ~1-5 active globally → narrow + open
 *   - Floods:      ~30-60 active → medium window + open
 *
 * Each query is enabled INDEPENDENTLY based on its layer toggle, so a
 * user who only wants Storms doesn't pay for wildfires.
 */
interface CategorySpec {
  category: NaturalEventCategory;
  /** EONET ?category= ID — happens to match our NaturalEventCategory but kept explicit for clarity. */
  eonetId:  string;
  /** ?status param — 'open' (active only) or 'all' (includes closed). */
  status:   'open' | 'all';
  /** ?days lookback window. */
  days:     number;
  /** ?limit cap — bounds payload size when a category gets noisy. */
  limit:    number;
}

const CATEGORY_SPECS: CategorySpec[] = [
  // Wildfires: huge volume — keep window tight to focus on active fires only.
  { category: 'wildfires',    eonetId: 'wildfires',    status: 'open', days: 14, limit: 250 },
  // SevereStorms: rare globally — capture recently-closed (dissipated) ones
  // too, since they remain newsworthy for damage assessment and shipping.
  { category: 'severeStorms', eonetId: 'severeStorms', status: 'all',  days: 60, limit:  60 },
  // Volcanoes: slow-moving, low volume — narrow window keeps it relevant.
  { category: 'volcanoes',    eonetId: 'volcanoes',    status: 'open', days: 30, limit:  40 },
  // Floods: medium volume — moderate window.
  { category: 'floods',       eonetId: 'floods',       status: 'open', days: 30, limit: 100 },
];

/**
 * Resolve a geometry record to (lat, lng).  Points are trivial — GeoJSON
 * order is [lng, lat].  Polygons we collapse to the first vertex (used for
 * flood polygons etc. where a single representative point is sufficient).
 */
function geometryToLatLng(g: EonetGeometry): { lat: number; lng: number } | null {
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const [lng, lat] = g.coordinates as number[];
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const ring = g.coordinates[0] as number[][] | undefined;
    if (ring && ring.length > 0 && ring[0].length >= 2) {
      const [lng, lat] = ring[0];
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    }
  }
  return null;
}

/**
 * Parse a single raw EONET event into our flat NaturalEvent shape.
 * Returns null when the event is unmappable (no recognized category,
 * empty geometry, bad coordinates).
 */
function parseEvent(e: EonetEvent, forcedCategory: NaturalEventCategory): NaturalEvent | null {
        // When the call was scoped to a single category we know the answer
        // up-front; otherwise we'd map via e.categories[].id.  Both paths
        // produce the same NaturalEventCategory.
        const category = forcedCategory;

        if (!Array.isArray(e.geometry) || e.geometry.length === 0) return null;

        // Most-recent geometry as "current location".  EONET orders the
        // array oldest→newest but doesn't guarantee it, so sort defensively.
        const sorted = [...e.geometry].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const earliest = sorted[0];
        const pos    = geometryToLatLng(latest);
        if (!pos) return null;

        // ── Derived: growth rate per day (intensity change over time) ──
        // Only meaningful if both earliest and latest carry a magnitude.
        // For wildfires this is acres-per-day spread; for storms it's
        // wind-kts-per-day intensification.
        let growthRatePerDay: number | null = null;
        if (
          earliest !== latest &&
          typeof earliest.magnitudeValue === 'number' &&
          typeof latest.magnitudeValue   === 'number'
        ) {
          const t0 = new Date(earliest.date).getTime();
          const t1 = new Date(latest.date).getTime();
          const days = (t1 - t0) / 86_400_000;
          if (days > 0) {
            growthRatePerDay = (latest.magnitudeValue - earliest.magnitudeValue) / days;
          }
        }

        // ── Derived: storm motion (last two points → speed + bearing) ──
        // For multi-point events we use the most recent two geometries.
        // For static events (single point) this stays null.
        let motionSpeedKmh: number | null = null;
        let bearingDeg:     number | null = null;
        if (sorted.length >= 2) {
          const prev    = sorted[sorted.length - 2];
          const prevPos = geometryToLatLng(prev);
          if (prevPos) {
            const t0 = new Date(prev.date).getTime();
            const t1 = new Date(latest.date).getTime();
            const hours = (t1 - t0) / 3_600_000;
            if (hours > 0) {
              const km = haversineKm(prevPos.lat, prevPos.lng, pos.lat, pos.lng);
              motionSpeedKmh = km / hours;
              // Only report bearing when there's meaningful displacement
              // (>1 km) — stationary wildfires would otherwise emit
              // noisy bearings from sub-pixel coordinate jitter.
              if (km > 1) {
                bearingDeg = bearingBetween(prevPos.lat, prevPos.lng, pos.lat, pos.lng);
              }
            }
          }
        }

        return {
          id:               e.id,
          title:            e.title,
          category,
          date:             latest.date.slice(0, 10),
          lat:              pos.lat,
          lng:              pos.lng,
          countryIso2:      nearestCountry(pos.lat, pos.lng),
          description:      e.description,
          sourceUrl:        e.sources?.[0]?.url ?? e.link ?? '',
          sourceName:       e.sources?.[0]?.id ?? null,
          sources:          (e.sources ?? []).map(s => ({ id: s.id, url: s.url })),
          geometryCount:    e.geometry.length,
          closed:           e.closed,
          magnitudeValue:   typeof latest.magnitudeValue === 'number' ? latest.magnitudeValue : null,
          magnitudeUnit:    latest.magnitudeUnit ?? null,
          growthRatePerDay,
          motionSpeedKmh,
          bearingDeg,
        };
}

/**
 * Build the request URL for a single category fetch.
 *
 * Goes through our `api-eonet` edge function, which:
 *   - Caches NASA EONET responses for 15 min in worker memory
 *   - Adds Cache-Control: s-maxage=900, stale-while-revalidate=1800
 *     so the Supabase edge CDN also caches the response
 *   - Falls back to stale cache when upstream errors or times out
 *
 * Cold-response latency drops from 500-2000 ms (direct EONET) to ~50 ms
 * (cached) or ~600 ms (cache miss with upstream fetch).
 */
const EONET_FN_BASE =
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-eonet`;
const EONET_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

function buildUrl(spec: CategorySpec): string {
  const params = new URLSearchParams({
    category: spec.eonetId,
    status:   spec.status,
    days:     String(spec.days),
    limit:    String(spec.limit),
  });
  return `${EONET_FN_BASE}?${params}`;
}

async function fetchCategory(spec: CategorySpec): Promise<NaturalEvent[]> {
  const res = await fetch(buildUrl(spec), {
    signal: AbortSignal.timeout(25_000), // edge function may take longer on a cache miss
    headers: EONET_HEADERS,
  });
  if (!res.ok) throw new Error(`api-eonet ${spec.eonetId} ${res.status}`);
  const data = await res.json() as EonetResponse;
  const out: NaturalEvent[] = [];
  for (const e of (data.events ?? [])) {
    const parsed = parseEvent(e, spec.category);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * useNaturalEvents — accepts either a single boolean (legacy: enable all
 * categories) OR a per-category enabled map.  Returns the combined event
 * list across all enabled categories.
 *
 * Internally fires up to 4 PARALLEL queries (one per category), each
 * with its own tuning (window, status, limit) and independent cache key.
 * This avoids the "wildfires drown out storms" pathology where a single
 * unified fetch would burn its 300-event budget on wildfires and never
 * return the rare-but-newsworthy storm/volcano entries.
 */
export function useNaturalEvents(enabled: boolean | Partial<Record<NaturalEventCategory, boolean>>): {
  data:      NaturalEvent[] | undefined;
  isLoading: boolean;
  isError:   boolean;
} {
  const enabledMap = typeof enabled === 'boolean'
    ? { wildfires: enabled, severeStorms: enabled, volcanoes: enabled, floods: enabled }
    : enabled;

  // Build a query option for every category — disabled ones don't fire.
  const queries: UseQueryOptions<NaturalEvent[]>[] = CATEGORY_SPECS.map(spec => ({
    queryKey:             ['eonet-natural-events', spec.eonetId, spec.status, spec.days, spec.limit],
    enabled:              !!enabledMap[spec.category],
    staleTime:            NE_STALE,
    gcTime:               NE_STALE * 2,
    refetchInterval:      enabledMap[spec.category] ? NE_STALE : false,
    refetchOnWindowFocus: false,
    queryFn:              () => fetchCategory(spec),
  }));

  const results = useQueries({ queries });

  const data = useMemo<NaturalEvent[] | undefined>(() => {
    // If no category is enabled, return undefined so consumers can short-circuit.
    if (!CATEGORY_SPECS.some(s => enabledMap[s.category])) return undefined;
    // Important: a disabled React Query still exposes its previously-cached
    // `data` on `results[i].data` (that's the gc behaviour, not a bug).
    // We must filter by the current enabledMap so toggling a layer OFF
    // actually removes its events from the merged output. Without this,
    // wildfires (or any other category) would stay on the globe after
    // their toggle is turned off until the cache eventually gc'd them.
    const combined: NaturalEvent[] = [];
    for (let i = 0; i < CATEGORY_SPECS.length; i++) {
      const spec = CATEGORY_SPECS[i];
      if (!enabledMap[spec.category]) continue;
      const d = results[i]?.data;
      if (d) combined.push(...d);
    }
    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    results[0].data, results[1].data, results[2].data, results[3].data,
    enabledMap.wildfires, enabledMap.severeStorms, enabledMap.volcanoes, enabledMap.floods,
  ]);

  return {
    data,
    isLoading: results.some(r => r.isLoading),
    isError:   results.every(r => r.isError),
  };
}
