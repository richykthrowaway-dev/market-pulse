import { useQuery } from '@tanstack/react-query';

/**
 * useEarthquakes — M2.5+ earthquakes from the USGS Earthquake Hazards Program.
 *
 * Feed: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson
 * - No auth required (public domain, US government data)
 * - Updates every 5 minutes
 * - Covers all M2.5+ events globally in the past 7 days
 * - ~300–800 events typical (spikes after major quakes with aftershock swarms)
 *
 * We refetch every 10 minutes — faster than conflicts because significant quakes
 * can cascade with aftershocks that affect supply chains (mining, ports).
 */

/** USGS PAGER (Prompt Assessment of Global Earthquakes for Response) alert level. */
export type PagerAlert = 'green' | 'yellow' | 'orange' | 'red';

export interface EarthquakeEvent {
  id:        string;
  /** ISO date string YYYY-MM-DD */
  date:      string;
  /** Unix epoch ms */
  time:      number;
  /** Unix epoch ms — when USGS last revised the solution (>= time). */
  updated:   number;
  lat:       number;
  lng:       number;
  /** Depth in km below surface */
  depth:     number;
  /** Richter / moment magnitude */
  magnitude: number;
  /**
   * Magnitude type code from USGS — e.g. 'mww' (W-phase moment tensor),
   * 'mb' (body wave), 'ml' (Richter), 'md' (duration).  Lets us label the
   * magnitude badge as "M 6.4 Mww" instead of bare "M 6.4".
   */
  magType:   string | null;
  /** USGS place description, e.g. "12km NNW of Ridgecrest, California" */
  place:     string;
  /** USGS significance score 0–1000 (blends mag + pop exposure + shaking) */
  sig:       number;
  /** Whether a tsunami warning was issued */
  tsunami:   boolean;
  /**
   * PAGER impact estimate — green/yellow/orange/red.  Single most useful
   * field on the response: green = no fatalities expected; red = mass-
   * casualty event predicted.  null for events too small for PAGER.
   */
  alert:     PagerAlert | null;
  /** Number of "Did You Feel It?" citizen reports submitted to USGS. */
  felt:      number | null;
  /** Community Determined Intensity (1–12 scale, citizen-reported shaking). */
  cdi:       number | null;
  /** Modified Mercalli Intensity (instrument-derived shaking, 1–10 scale). */
  mmi:       number | null;
  /** 'reviewed' (manually QC'd) vs 'automatic' (raw algorithm). */
  status:    'reviewed' | 'automatic' | null;
  /**
   * Event type — usually 'earthquake', but can be 'quarry blast', 'mining
   * explosion', 'explosion', 'sonic boom' etc.  Useful to flag non-tectonic
   * events explicitly so users don't read them as natural seismicity.
   */
  type:      string;
  /**
   * Available USGS product types for this event — drives deep-link buttons
   * (shakemap, dyfi, losspager, moment-tensor, focal-mechanism, ...).
   * Parsed from the comma-delimited `types` string on the response.
   */
  types:     string[];
  /** ISO 3166-1 alpha-2 country code derived from place string (best-effort). */
  countryIso2: string;
  /** Direct link to USGS event page */
  sourceUrl: string;
}

// ── Rough country extraction from USGS place strings ─────────────────────
// USGS place descriptions end with a US state or country name.
// e.g. "12km NNW of Ridgecrest, California" → US
//      "45km E of Honshu, Japan"            → JP
// This is imperfect but catches the common cases.  Unmapped → empty string.
const USGS_PLACE_SUFFIX_MAP: Record<string, string> = {
  'alaska': 'US', 'california': 'US', 'hawaii': 'US', 'nevada': 'US',
  'washington': 'US', 'oregon': 'US', 'oklahoma': 'US', 'texas': 'US',
  'idaho': 'US', 'montana': 'US', 'wyoming': 'US', 'utah': 'US',
  'colorado': 'US', 'new mexico': 'US', 'arizona': 'US', 'kansas': 'US',
  'missouri': 'US', 'tennessee': 'US', 'kentucky': 'US', 'virginia': 'US',
  'puerto rico': 'US', 'u.s. virgin islands': 'US', 'guam': 'US',
  'japan': 'JP', 'indonesia': 'ID', 'philippines': 'PH', 'taiwan': 'TW',
  'china': 'CN', 'new zealand': 'NZ', 'australia': 'AU', 'fiji': 'FJ',
  'tonga': 'TO', 'vanuatu': 'VU', 'solomon islands': 'SB', 'papua new guinea': 'PG',
  'chile': 'CL', 'peru': 'PE', 'ecuador': 'EC', 'colombia': 'CO',
  'bolivia': 'BO', 'argentina': 'AR', 'mexico': 'MX', 'guatemala': 'GT',
  'el salvador': 'SV', 'honduras': 'HN', 'nicaragua': 'NI', 'costa rica': 'CR',
  'panama': 'PA', 'haiti': 'HT', 'dominican republic': 'DO',
  'iran': 'IR', 'turkey': 'TR', 'greece': 'GR', 'italy': 'IT',
  'afghanistan': 'AF', 'pakistan': 'PK', 'india': 'IN', 'nepal': 'NP',
  'myanmar': 'MM', 'russia': 'RU', 'ukraine': 'UA',
  'kazakhstan': 'KZ', 'kyrgyzstan': 'KG', 'tajikistan': 'TJ', 'uzbekistan': 'UZ',
  'turkmenistan': 'TM', 'azerbaijan': 'AZ', 'georgia': 'GE', 'armenia': 'AM',
  'iraq': 'IQ', 'syria': 'SY', 'yemen': 'YE', 'saudi arabia': 'SA',
  'kenya': 'KE', 'ethiopia': 'ET', 'tanzania': 'TZ', 'mozambique': 'MZ',
  'south africa': 'ZA', 'democratic republic of the congo': 'CD', 'congo': 'CG',
  'canada': 'CA', 'iceland': 'IS', 'portugal': 'PT', 'romania': 'RO',
  'north korea': 'KP', 'south korea': 'KR',
};

function extractCountry(place: string): string {
  if (!place) return '';
  // USGS format: "… of <place>, <region/country>"
  const afterComma = place.split(',').pop()?.trim().toLowerCase() ?? '';
  return USGS_PLACE_SUFFIX_MAP[afterComma] ?? '';
}

// USGS updates their feed every 5 minutes; 10 min staleTime gives a
// comfortable buffer without hammering the public government endpoint.
// No server-side cache here — USGS is fetched directly from the client,
// and at ~300–800 events/response it's a single public CDN-backed request.
const EQ_STALE = 10 * 60_000; // 10 min

export function useEarthquakes(enabled: boolean) {
  return useQuery<EarthquakeEvent[]>({
    queryKey:             ['usgs-earthquakes'],
    enabled,
    staleTime:            EQ_STALE,
    gcTime:               EQ_STALE * 2,
    refetchInterval:      enabled ? EQ_STALE : false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url =
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`USGS ${res.status}`);

      const data = await res.json() as {
        features: Array<{
          id: string;
          geometry: { coordinates: [number, number, number] };
          properties: {
            mag:     number;
            place:   string;
            time:    number;
            updated: number;
            url:     string;
            sig:     number;
            tsunami: number;
            magType: string | null;
            alert:   string | null;
            felt:    number | null;
            cdi:     number | null;
            mmi:     number | null;
            status:  string | null;
            type:    string;
            types:   string;   // comma-delimited: ",dyfi,origin,phase-data,"
          };
        }>;
      };

      return data.features
        .filter((f) => f.geometry?.coordinates && f.properties?.mag != null)
        .map((f): EarthquakeEvent => {
          const [lng, lat, depth] = f.geometry.coordinates;
          const p = f.properties;
          // `types` is a comma-bordered string like ",dyfi,origin,shakemap,";
          // split + drop empty entries to get a clean string[].
          const typesArr = (p.types ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          const alertRaw = p.alert?.toLowerCase();
          const alert: PagerAlert | null =
            alertRaw === 'green'  ? 'green'  :
            alertRaw === 'yellow' ? 'yellow' :
            alertRaw === 'orange' ? 'orange' :
            alertRaw === 'red'    ? 'red'    : null;
          const statusRaw = p.status?.toLowerCase();
          const status: EarthquakeEvent['status'] =
            statusRaw === 'reviewed'  ? 'reviewed'  :
            statusRaw === 'automatic' ? 'automatic' : null;
          return {
            id:          f.id,
            date:        new Date(p.time).toISOString().slice(0, 10),
            time:        p.time,
            updated:     p.updated ?? p.time,
            lat,
            lng,
            depth:       depth ?? 0,
            magnitude:   p.mag,
            magType:     p.magType ?? null,
            place:       p.place ?? '',
            sig:         p.sig ?? 0,
            tsunami:     p.tsunami === 1,
            alert,
            felt:        typeof p.felt === 'number' ? p.felt : null,
            cdi:         typeof p.cdi  === 'number' ? p.cdi  : null,
            mmi:         typeof p.mmi  === 'number' ? p.mmi  : null,
            status,
            type:        p.type ?? 'earthquake',
            types:       typesArr,
            countryIso2: extractCountry(p.place ?? ''),
            sourceUrl:   p.url ?? '',
          };
        });
    },
  });
}
