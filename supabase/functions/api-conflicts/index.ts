import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-conflicts — geocoded conflict / unrest event feed.
 *
 * Pulls from two free sources and merges:
 *   1. GDELT 2.1 GeoJSON Feed   — no key, ~15-min latency, broad event types
 *   2. ACLED API                 — academic key required, higher fidelity
 *
 * If neither source yields events (e.g. ACLED key not set + GDELT outage),
 * returns an empty list so the client can degrade gracefully.
 *
 * Response: { events: ConflictEvent[], sources: string[], timestamp: number }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConflictEvent {
  id:          string;
  date:        string;     // ISO date
  lat:         number;
  lng:         number;
  /** ISO 3166-1 alpha-2 country code (uppercase). */
  countryIso2: string;
  /** Human-readable event type, e.g. "Battle", "Protest", "Strategic dev". */
  eventType:   string;
  /** Estimated fatalities, if known.  0 means "unknown or none". */
  fatalities:  number;
  /** One-sentence description / headline. */
  notes:       string;
  /** URL to the source article or report, if available. */
  sourceUrl:   string;
  /** "acled" | "gdelt" — which feed it came from. */
  source:      "acled" | "gdelt";
}

// Translate ACLED 2-letter country code → standard ISO-2 (mostly identical)
const ACLED_COUNTRY_FIX: Record<string, string> = {
  // ACLED uses some non-standard codes — patch as needed
};

// ── GDELT 2.1 GeoJSON live feed ───────────────────────────────────────────
// Returns the last 24 hours of geocoded events worldwide.
async function fetchGdeltEvents(): Promise<ConflictEvent[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/geo/geo" +
    "?query=sourcelang:eng%20theme:ARMEDCONFLICT" +
    "&format=geojson" +
    "&mode=PointData" +
    "&maxrows=200" +
    "&timespan=24H";

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GDELT ${res.status}`);

  const data = await res.json();
  const features = (data.features ?? []) as Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?:     string;
      html?:     string;
      url?:      string;
      shareimage?: string;
      count?:    number;
    };
  }>;

  return features
    .filter((f) => f.geometry?.coordinates)
    .map((f, i): ConflictEvent => {
      const [lng, lat] = f.geometry!.coordinates!;
      // GDELT GeoJSON doesn't include country code directly — derive from name
      // by using a coarse lat/lng → country lookup in the client.  For now,
      // pass empty string and let the client compute it.
      return {
        id:          `gdelt-${Date.now()}-${i}`,
        date:        new Date().toISOString().slice(0, 10),
        lat,
        lng,
        countryIso2: "",  // filled by client via reverse geocoding cache
        eventType:   "News mention",
        fatalities:  0,
        notes:       (f.properties?.name ?? "").slice(0, 200),
        sourceUrl:   f.properties?.url ?? "",
        source:      "gdelt",
      };
    });
}

// ── ACLED API (new OAuth system, 2024+) ──────────────────────────────────
// Token cached at module scope — survives across requests served by the
// same isolate.  Tokens are valid 24h, so this is plenty.
let acledToken:        string | null = null;
let acledTokenExpiry:  number        = 0;

async function getAcledToken(username: string, password: string): Promise<string | null> {
  if (acledToken && Date.now() < acledTokenExpiry) return acledToken;

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
    client_id:  "acled",
    scope:      "authenticated",
  });

  const res = await fetch("https://acleddata.com/oauth/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`[acled] oauth token failed: ${res.status} ${await res.text().catch(() => '')}`);
    return null;
  }

  const j = await res.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;

  acledToken       = j.access_token;
  // Refresh 5 minutes before actual expiry to be safe.
  acledTokenExpiry = Date.now() + ((j.expires_in ?? 86400) - 300) * 1000;
  return acledToken;
}

async function fetchAcledEvents(): Promise<ConflictEvent[]> {
  // New auth: ACLED_USERNAME (email) + ACLED_PASSWORD (myACLED password)
  // Backwards-compat: still accept ACLED_EMAIL as alias for ACLED_USERNAME.
  const username =
    Deno.env.get("ACLED_USERNAME") ?? Deno.env.get("ACLED_EMAIL") ?? "";
  const password = Deno.env.get("ACLED_PASSWORD") ?? "";
  if (!username || !password) return [];  // graceful no-op if not configured

  const token = await getAcledToken(username, password);
  if (!token) return [];

  // Last 14 days, fatalities >= 1.  New API uses the same /api/acled/read
  // endpoint but authenticated via Bearer token instead of query params.
  const fromDate = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const url =
    `https://acleddata.com/api/acled/read` +
    `?event_date=${fromDate}` +
    `&event_date_where=>=` +
    `&fatalities=1` +
    `&fatalities_where=>=` +
    `&limit=300`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal:  AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // If token rejected, invalidate the cache so the next call retries.
    if (res.status === 401 || res.status === 403) {
      acledToken = null;
      acledTokenExpiry = 0;
    }
    throw new Error(`ACLED ${res.status}`);
  }

  const data = await res.json();
  const rows = (data.data ?? []) as Array<{
    event_id_cnty: string;
    event_date:    string;
    latitude:      string;
    longitude:     string;
    iso:           string;        // numeric
    iso3:          string;
    country:       string;
    event_type:    string;
    sub_event_type:string;
    fatalities:    string;
    notes:         string;
    source:        string;
  }>;

  return rows.map((r): ConflictEvent => ({
    id:          `acled-${r.event_id_cnty}`,
    date:        r.event_date,
    lat:         parseFloat(r.latitude),
    lng:         parseFloat(r.longitude),
    countryIso2: iso3ToIso2(r.iso3) ?? "",
    eventType:   r.sub_event_type || r.event_type,
    fatalities:  parseInt(r.fatalities, 10) || 0,
    notes:       (r.notes ?? "").slice(0, 280),
    sourceUrl:   "",
    source:      "acled",
  }));
}

/** Tiny ISO-3 → ISO-2 map for the most-active conflict countries. */
function iso3ToIso2(iso3: string): string | null {
  const m: Record<string, string> = {
    UKR: "UA", RUS: "RU", USA: "US", ISR: "IL", PSE: "PS", LBN: "LB",
    SYR: "SY", IRQ: "IQ", IRN: "IR", YEM: "YE", AFG: "AF", PAK: "PK",
    IND: "IN", MMR: "MM", SDN: "SD", SSD: "SS", ETH: "ET", SOM: "SO",
    NGA: "NG", COD: "CD", CMR: "CM", MLI: "ML", BFA: "BF", NER: "NE",
    LBY: "LY", EGY: "EG", TUN: "TN", DZA: "DZ", MAR: "MA", TUR: "TR",
    GRC: "GR", BGR: "BG", ROU: "RO", HUN: "HU", POL: "PL", DEU: "DE",
    FRA: "FR", GBR: "GB", ESP: "ES", ITA: "IT", VEN: "VE", COL: "CO",
    BRA: "BR", MEX: "MX", HTI: "HT", CUB: "CU", CHN: "CN", TWN: "TW",
    KOR: "KR", PRK: "KP", JPN: "JP", IDN: "ID", PHL: "PH", THA: "TH",
    VNM: "VN", SAU: "SA", ARE: "AE", QAT: "QA", IRQ_ALT: "IQ",
    AZE: "AZ", ARM: "AM", GEO: "GE", BLR: "BY", MDA: "MD", LTU: "LT",
    LVA: "LV", EST: "EE", FIN: "FI", SWE: "SE", NOR: "NO", DNK: "DK",
    NLD: "NL", BEL: "BE", CHE: "CH", AUT: "AT", PRT: "PT", IRL: "IE",
    KAZ: "KZ", UZB: "UZ", TKM: "TM", KGZ: "KG", TJK: "TJ", MNG: "MN",
    AUS: "AU", NZL: "NZ", CAN: "CA", ZAF: "ZA", KEN: "KE", UGA: "UG",
    TZA: "TZ", RWA: "RW", BDI: "BI", AGO: "AO", MOZ: "MZ", ZWE: "ZW",
    ZMB: "ZM", BWA: "BW", NAM: "NA", MDG: "MG", CIV: "CI", GHA: "GH",
    SEN: "SN", GIN: "GN", LBR: "LR", SLE: "SL", BEN: "BJ", TGO: "TG",
    TCD: "TD", CAF: "CF", GAB: "GA", COG: "CG", GNB: "GW", MRT: "MR",
    CHL: "CL", PER: "PE", BOL: "BO", ARG: "AR", PRY: "PY", URY: "UY",
    ECU: "EC", GUY: "GY", SUR: "SR", BLZ: "BZ", GTM: "GT", HND: "HN",
    SLV: "SV", NIC: "NI", CRI: "CR", PAN: "PA", DOM: "DO", JAM: "JM",
  };
  return m[iso3] ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Run both fetches in parallel; tolerate partial failure
    const results = await Promise.allSettled([fetchAcledEvents(), fetchGdeltEvents()]);
    const events: ConflictEvent[] = [];
    const sources: string[] = [];

    for (const [name, r] of [["acled", results[0]], ["gdelt", results[1]]] as const) {
      if (r.status === "fulfilled" && r.value.length > 0) {
        events.push(...r.value);
        sources.push(name);
      }
    }

    // De-dup by spatial proximity (~5km) + same date
    const dedup: ConflictEvent[] = [];
    for (const e of events) {
      const dup = dedup.find(
        (d) =>
          d.date === e.date &&
          Math.abs(d.lat - e.lat) < 0.05 &&
          Math.abs(d.lng - e.lng) < 0.05,
      );
      if (!dup) dedup.push(e);
      else if (e.source === "acled") {
        // Prefer ACLED when both feeds have the same incident
        Object.assign(dup, e);
      }
    }

    return new Response(
      JSON.stringify({
        events: dedup,
        sources,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        events: [],
        sources: [],
        error: String(err),
        timestamp: Date.now(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
