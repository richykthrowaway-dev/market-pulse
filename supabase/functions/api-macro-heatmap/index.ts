import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-macro-heatmap — GDP growth (annual %) per country from EODHD.
 *
 * Fetches the latest GDP growth rate for ~50 major economies and returns
 * them as { countryIso2, value, year } entries so the globe can shade
 * countries from deep red (contraction) through green (strong growth).
 *
 * Server cache: 24 hours — GDP data is annual, no point refreshing often.
 * Cold-start: ~50 parallel EODHD fetches (~2–4s total), then cached.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface MacroCountry {
  countryIso2: string;
  value:       number;  // GDP growth annual %
  year:        number;  // Year of the data point
}

// ── Countries to fetch — ISO3 → ISO2 mapping ────────────────────────────
// EODHD macro-indicator uses ISO3 country codes as path segment.
const COUNTRIES: Array<{ iso3: string; iso2: string }> = [
  { iso3: "USA", iso2: "US" }, { iso3: "GBR", iso2: "GB" },
  { iso3: "CHN", iso2: "CN" }, { iso3: "DEU", iso2: "DE" },
  { iso3: "JPN", iso2: "JP" }, { iso3: "IND", iso2: "IN" },
  { iso3: "FRA", iso2: "FR" }, { iso3: "ITA", iso2: "IT" },
  { iso3: "BRA", iso2: "BR" }, { iso3: "CAN", iso2: "CA" },
  { iso3: "AUS", iso2: "AU" }, { iso3: "KOR", iso2: "KR" },
  { iso3: "ESP", iso2: "ES" }, { iso3: "NLD", iso2: "NL" },
  { iso3: "MEX", iso2: "MX" }, { iso3: "IDN", iso2: "ID" },
  { iso3: "SAU", iso2: "SA" }, { iso3: "TUR", iso2: "TR" },
  { iso3: "CHE", iso2: "CH" }, { iso3: "POL", iso2: "PL" },
  { iso3: "SWE", iso2: "SE" }, { iso3: "BEL", iso2: "BE" },
  { iso3: "ARG", iso2: "AR" }, { iso3: "NOR", iso2: "NO" },
  { iso3: "AUT", iso2: "AT" }, { iso3: "ARE", iso2: "AE" },
  { iso3: "NGA", iso2: "NG" }, { iso3: "ZAF", iso2: "ZA" },
  { iso3: "ISR", iso2: "IL" }, { iso3: "DNK", iso2: "DK" },
  { iso3: "FIN", iso2: "FI" }, { iso3: "SGP", iso2: "SG" },
  { iso3: "MYS", iso2: "MY" }, { iso3: "THA", iso2: "TH" },
  { iso3: "VNM", iso2: "VN" }, { iso3: "PHL", iso2: "PH" },
  { iso3: "PAK", iso2: "PK" }, { iso3: "BGD", iso2: "BD" },
  { iso3: "EGY", iso2: "EG" }, { iso3: "COL", iso2: "CO" },
  { iso3: "CHL", iso2: "CL" }, { iso3: "PER", iso2: "PE" },
  { iso3: "ROU", iso2: "RO" }, { iso3: "CZE", iso2: "CZ" },
  { iso3: "HUN", iso2: "HU" }, { iso3: "GRC", iso2: "GR" },
  { iso3: "PRT", iso2: "PT" }, { iso3: "NZL", iso2: "NZ" },
  { iso3: "UKR", iso2: "UA" }, { iso3: "KAZ", iso2: "KZ" },
  { iso3: "MMR", iso2: "MM" }, { iso3: "ETH", iso2: "ET" },
  { iso3: "KEN", iso2: "KE" }, { iso3: "TZA", iso2: "TZ" },
];

// ── Module-level cache ────────────────────────────────────────────────────
const CACHE_TTL = 24 * 60 * 60_000; // 24 hours
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
    return new Response(JSON.stringify({ data: [], error: "no_token" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch all countries in parallel — each is a tiny JSON response (<1KB).
    // 54 parallel fetches typically complete in 2–4s, well within the 25s limit.
    const results = await Promise.allSettled(
      COUNTRIES.map(async ({ iso3, iso2 }) => {
        const url = `https://eodhd.com/api/macro-indicator/${iso3}?indicator=gdp_growth_annual&limit=1&fmt=json&api_token=${token}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return null;
        const data = await res.json() as Array<{ Value: number; Date: string }>;
        if (!data?.length) return null;
        const latest = data[0];
        return {
          countryIso2: iso2,
          value:       latest.Value,
          year:        new Date(latest.Date).getFullYear(),
        } as MacroCountry;
      }),
    );

    const data: MacroCountry[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        data.push(r.value);
      }
    }

    const payload = JSON.stringify({ data, timestamp: Date.now() });
    cache = { payload, expires: Date.now() + CACHE_TTL };

    return new Response(payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api-macro-heatmap]", err);
    return new Response(
      JSON.stringify({ data: [], error: String(err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
