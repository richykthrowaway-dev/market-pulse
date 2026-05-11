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
  /** Number of geometry points — high count = long-duration / long-track event. */
  geometryCount: number;
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
}

interface EonetEvent {
  id:          string;
  title:       string;
  description: string | null;
  link:        string;
  categories:  Array<{ id: string; title: string }>;
  sources:     Array<{ id: string; url: string }>;
  geometry:    EonetGeometry[];
}

interface EonetResponse {
  events: EonetEvent[];
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
        const pos    = geometryToLatLng(latest);
        if (!pos) continue;

        out.push({
          id:            e.id,
          title:         e.title,
          category,
          date:          latest.date.slice(0, 10),
          lat:           pos.lat,
          lng:           pos.lng,
          countryIso2:   nearestCountry(pos.lat, pos.lng),
          description:   e.description,
          sourceUrl:     e.sources?.[0]?.url ?? e.link ?? '',
          sourceName:    e.sources?.[0]?.id ?? null,
          geometryCount: e.geometry.length,
        });
      }
      return out;
    },
  });
}
