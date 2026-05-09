/**
 * AirportDB REST API client  (https://airportdb.io)
 *
 * Endpoint:  GET /api/v1/airport/{ICAO}?apiToken={key}
 * Key:       VITE_AIRPORTDB_KEY environment variable
 *
 * Rate notes:
 *   Queries are per-ICAO. We only call on user interaction (airport node
 *   selected) and React Query caches results for 24 h, so the effective
 *   call rate is at most 1 per unique airport per day across all users
 *   sharing the same browser cache.
 */

const BASE = 'https://airportdb.io/api/v1/airport';

// ── Response types (subset — full schema has more fields) ──────────────────

export interface AirportDbRunway {
  le_ident:   string;   // e.g. "10L"
  he_ident:   string;   // e.g. "28R"
  length_ft:  number;
  width_ft:   number;
  surface:    string;   // "ASP", "CON", "GRS", etc.
  lighted:    boolean;
  closed:     boolean;
}

export interface AirportDbFrequency {
  type:           string;   // "TWR", "APP", "ATIS", etc.
  description:    string;
  frequency_mhz:  number;
}

export interface AirportDbDetail {
  icao_code:      string;
  iata_code:      string;
  name:           string;
  type:           string;   // "large_airport" | "medium_airport" | "small_airport"
  latitude_deg:   number;
  longitude_deg:  number;
  elevation_ft:   number | null;
  municipality:   string;
  iso_country:    string;
  iso_region:     string;
  wikipedia_link: string;
  home_link:      string;
  runways:        AirportDbRunway[];
  frequencies:    AirportDbFrequency[];
}

export async function fetchAirportDetail(icao: string): Promise<AirportDbDetail> {
  const key = (import.meta.env.VITE_AIRPORTDB_KEY ?? '').toString().trim();
  if (!key) throw new Error('VITE_AIRPORTDB_KEY is not set');

  const url = `${BASE}/${icao.toUpperCase()}?apiToken=${key}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AirportDB ${res.status} for ${icao}: ${body.slice(0, 120)}`);
  }

  return res.json() as Promise<AirportDbDetail>;
}
