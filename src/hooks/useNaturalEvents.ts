import { useQuery } from '@tanstack/react-query';
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

export function useNaturalEvents(enabled: boolean) {
  return useQuery<NaturalEvent[]>({
    queryKey:             ['eonet-natural-events'],
    enabled,
    staleTime:            NE_STALE,
    gcTime:               NE_STALE * 2,
    refetchInterval:      enabled ? NE_STALE : false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url =
        'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300';
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`EONET ${res.status}`);

      const data = await res.json() as EonetResponse;
      const events = data.events ?? [];

      const out: NaturalEvent[] = [];
      for (const e of events) {
        // Each event carries 1+ category; map the first that we recognize.
        let category: NaturalEventCategory | null = null;
        for (const c of e.categories ?? []) {
          const mapped = EONET_CATEGORY_MAP[c.id];
          if (mapped) { category = mapped; break; }
        }
        if (!category) continue;          // not one of our four categories

        if (!Array.isArray(e.geometry) || e.geometry.length === 0) continue;

        // Most-recent geometry as "current location".  EONET orders the
        // array oldest→newest but doesn't guarantee it, so sort defensively.
        const sorted = [...e.geometry].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const earliest = sorted[0];
        const pos    = geometryToLatLng(latest);
        if (!pos) continue;

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

        out.push({
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
        });
      }
      return out;
    },
  });
}
