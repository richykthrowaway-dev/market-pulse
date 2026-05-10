import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-economic-events — upcoming macro calendar events from EODHD.
 *
 * Fetches a 14-day rolling window of scheduled economic releases,
 * filters to high-impact event types that traders actually care about,
 * and returns them with country ISO2 codes and position metadata so
 * the globe can render them as clickable calendar pins.
 *
 * Server cache: 1 hour — events don't change more often than this, and
 * EODHD charges per call so we don't want to hit it on every page load.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface EconomicEvent {
  id:          string;
  type:        string;  // "Non-Farm Payrolls", "CPI MoM", etc.
  country:     string;  // ISO2 uppercase
  date:        string;  // ISO datetime string
  period:      string | null;
  comparison:  string | null;
  actual:      number | null;
  previous:    number | null;
  estimate:    number | null;
  /** Derived importance: 'high' | 'medium' | 'low' */
  importance:  'high' | 'medium' | 'low';
  lat:         number;
  lng:         number;
}

// ── Country centroid map (ISO2 → [lat, lng]) ─────────────────────────────
// EODHD uses a mix of standard ISO2 and some non-standard (UK instead of GB).
const COUNTRY_CENTROID: Record<string, [number, number]> = {
  US: [39.5, -98.4], GB: [55.4, -3.4], UK: [55.4, -3.4],
  EU: [50.1, 10.4], DE: [51.2, 10.4], FR: [46.2, 2.2],
  JP: [36.2, 138.3], CN: [35.9, 104.2], AU: [25.3, 133.8],
  CA: [56.1, -106.3], NZ: [42.2, -171.0], CH: [47.0, 8.2],
  SE: [62.2, 17.6], NO: [64.6, 17.9], DK: [55.9, 10.0],
  FI: [64.0, 26.0], PL: [51.9, 19.1], CZ: [49.8, 15.5],
  HU: [47.2, 19.5], RO: [45.9, 24.9], IT: [41.9, 12.6],
  ES: [40.5, -3.7], PT: [39.6, -8.0], NL: [52.1, 5.3],
  BE: [50.5, 4.5], AT: [47.5, 14.5], GR: [39.1, 21.8],
  IL: [31.5, 34.9], ZA: [30.6, 22.9], BR: [14.2, -51.9],
  MX: [23.6, -102.5], AR: [38.4, -63.6], CO: [4.6, -74.3],
  CL: [35.7, -71.5], IN: [20.6, 78.9], KR: [35.9, 127.8],
  TW: [23.7, 121.0], SG: [1.4, 103.8], HK: [22.4, 114.1],
  ID: [-0.8, 113.9], TH: [15.9, 100.9], MY: [4.2, 108.0],
  PH: [12.9, 121.8], TR: [38.9, 35.2], SA: [23.9, 45.1],
  AE: [23.4, 53.8], NG: [9.1, 8.7], EG: [26.8, 30.8],
  RU: [61.5, 105.3], UA: [49.0, 32.0], PK: [30.4, 69.3],
  BD: [23.7, 90.4], VN: [14.1, 108.3], MU: [-20.3, 57.6],
  ID2: [-0.8, 113.9], SK: [48.7, 19.7], HR: [45.1, 15.2],
};

// ── Normalise EODHD country codes to ISO2 ────────────────────────────────
function normalizeCountry(c: string): string {
  const fixes: Record<string, string> = { UK: "GB" };
  return (fixes[c] ?? c).toUpperCase();
}

// ── High-impact event type matching ──────────────────────────────────────
// Uses substring matching against the event "type" string.
const HIGH_IMPORTANCE_PATTERNS = [
  "non-farm payroll", "nonfarm payroll", "unemployment rate",
  "consumer price index", "cpi", "pce",
  "gdp", "gross domestic product",
  "fomc", "federal reserve", "interest rate decision",
  "ecb", "bank of england", "bank of japan", "boe", "boj",
  "manufacturing pmi", "services pmi", "composite pmi",
  "retail sales", "trade balance",
  "producer price index", "ppi",
  "industrial production",
  "eia crude oil", "eia natural gas",
  "adp employment",
];
const MEDIUM_IMPORTANCE_PATTERNS = [
  "pmi", "housing", "building permits", "durable goods",
  "consumer confidence", "business confidence",
  "current account", "inflation",
  "jobless claims", "initial claims",
  "gdp growth", "gdp annualized",
  "imports", "exports",
];

function getImportance(type: string): 'high' | 'medium' | 'low' {
  const t = type.toLowerCase();
  if (HIGH_IMPORTANCE_PATTERNS.some(p => t.includes(p))) return 'high';
  if (MEDIUM_IMPORTANCE_PATTERNS.some(p => t.includes(p))) return 'medium';
  return 'low';
}

// ── Module-level cache ────────────────────────────────────────────────────
const CACHE_TTL = 60 * 60_000; // 1 hour
let cache: { payload: string; expires: number } | null = null;

// ── Handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (cache && Date.now() < cache.expires) {
    return new Response(cache.payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("EODHD_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ events: [], error: "no_token" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const today = new Date();
    const from  = today.toISOString().slice(0, 10);
    const to    = new Date(today.getTime() + 14 * 86400_000).toISOString().slice(0, 10);

    const url = `https://eodhd.com/api/economic-events?from=${from}&to=${to}&limit=500&fmt=json&api_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`EODHD ${res.status}`);

    const raw = await res.json() as Array<{
      type:        string;
      country:     string;
      date:        string;
      period?:     string | null;
      comparison?: string | null;
      actual:      number | null;
      previous:    number | null;
      estimate:    number | null;
    }>;

    const events: EconomicEvent[] = [];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const importance = getImportance(r.type);
      // Only include medium and high — low events are too noisy on the globe
      if (importance === 'low') continue;

      const iso2    = normalizeCountry(r.country);
      const centroid = COUNTRY_CENTROID[r.country] ?? COUNTRY_CENTROID[iso2];
      if (!centroid) continue;

      // Jitter slightly so stacked same-day country events don't overlap
      const jitter = () => (Math.random() - 0.5) * 1.2;
      events.push({
        id:         `eco-${r.date}-${r.country}-${i}`,
        type:       r.type,
        country:    iso2,
        date:       r.date,
        period:     r.period ?? null,
        comparison: r.comparison ?? null,
        actual:     r.actual,
        previous:   r.previous,
        estimate:   r.estimate,
        importance,
        lat:        centroid[0] + jitter(),
        lng:        centroid[1] + jitter(),
      });
    }

    // Sort: soonest first, then by importance
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    events.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });

    const payload = JSON.stringify({ events, timestamp: Date.now() });
    cache = { payload, expires: Date.now() + CACHE_TTL };

    return new Response(payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api-economic-events]", err);
    return new Response(
      JSON.stringify({ events: [], error: String(err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
