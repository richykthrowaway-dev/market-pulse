import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-wits — World Bank WITS + UN Comtrade proxy for country trade data
 *
 * Two complementary modes:
 *
 *   ?level=section (default) — World Bank WITS Trade Stats
 *     → 16 HS Section-level categories (Fuels, Machinery & Electronics,
 *       Chemicals, etc.). Pre-aggregated, fast.
 *
 *   ?level=chapter — UN Comtrade preview (no auth)
 *     → 99 HS 2-digit Chapter-level codes within whichever section the
 *       client wants to drill into. Used to populate hover tooltips
 *       showing "what's inside Machinery & Electronics".
 *
 * Both modes return the same flattened JSON shape so the client renders
 * them with the same code path.
 *
 * Why proxy:
 *   - WITS doesn't send CORS headers — browser blocks direct calls
 *   - WITS publishes SDMX-JSON; parsing it once here keeps the client lean
 *   - Comtrade preview is permissive but uses M49 numeric country codes,
 *     not ISO3 — server converts the moment we know the request is for
 *     Comtrade
 *   - Year-fallback chain hides the 1-2 year publication lag from the UI
 *
 * Request:
 *   GET ?reporter={ISO3}&direction=exports|imports[&level=section|chapter][&year=YYYY]
 *
 * Response (success, level=section):
 *   { reporter, direction, year, totalUsd,
 *     products: [{ code: "27-27_Fuels", name: "Fuels", valueUsd, share }] }
 *
 * Response (success, level=chapter):
 *   { reporter, direction, year, totalUsd,
 *     products: [{ code: "27", name: "HS 27", valueUsd, share }] }
 *
 * Response (no data found): { products: [] }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WITS_BASE     = "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade";
const COMTRADE_BASE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

// ── ISO 3166-1 alpha-3 → UN M49 numeric (Comtrade reporter codes) ─────
// Only countries actually queried in production need entries here. Keep
// alphabetised by ISO3 for legibility. Sourced from the UN's official
// M49 list (https://unstats.un.org/unsd/methodology/m49/).
const ISO3_TO_M49: Record<string, string> = {
  AFG: "4",   AGO: "24",  ALB: "8",   ARE: "784", ARG: "32",  ARM: "51",
  AUS: "36",  AUT: "40",  AZE: "31",  BDI: "108", BEL: "56",  BEN: "204",
  BFA: "854", BGD: "50",  BGR: "100", BHR: "48",  BHS: "44",  BIH: "70",
  BLR: "112", BLZ: "84",  BOL: "68",  BRA: "76",  BRN: "96",  BTN: "64",
  BWA: "72",  CAF: "140", CAN: "124", CHE: "756", CHL: "152", CHN: "156",
  CIV: "384", CMR: "120", COD: "180", COG: "178", COL: "170", COM: "174",
  CPV: "132", CRI: "188", CUB: "192", CYP: "196", CZE: "203", DEU: "276",
  DJI: "262", DNK: "208", DOM: "214", DZA: "12",  ECU: "218", EGY: "818",
  ERI: "232", ESH: "732", ESP: "724", EST: "233", ETH: "231", FIN: "246",
  FJI: "242", FLK: "238", FRA: "251", GAB: "266", GBR: "826", GEO: "268",
  GHA: "288", GIN: "324", GMB: "270", GNB: "624", GNQ: "226", GRC: "300",
  GRL: "304", GTM: "320", GUY: "328", HKG: "344", HND: "340", HRV: "191",
  HTI: "332", HUN: "348", IDN: "360", IND: "699", IRL: "372", IRN: "364",
  IRQ: "368", ISL: "352", ISR: "376", ITA: "381", JAM: "388", JOR: "400",
  JPN: "392", KAZ: "398", KEN: "404", KGZ: "417", KHM: "116", KOR: "410",
  KWT: "414", LAO: "418", LBN: "422", LBR: "430", LBY: "434", LKA: "144",
  LSO: "426", LTU: "440", LUX: "442", LVA: "428", MAR: "504", MDA: "498",
  MDG: "450", MEX: "484", MKD: "807", MLI: "466", MMR: "104", MNE: "499",
  MNG: "496", MOZ: "508", MRT: "478", MUS: "480", MWI: "454", MYS: "458",
  NAM: "516", NCL: "540", NER: "562", NGA: "566", NIC: "558", NLD: "528",
  NOR: "579", NPL: "524", NZL: "554", OMN: "512", PAK: "586", PAN: "591",
  PER: "604", PHL: "608", PNG: "598", POL: "616", PRI: "630", PRK: "408",
  PRT: "620", PRY: "600", PSE: "275", QAT: "634", ROU: "642", RUS: "643",
  RWA: "646", SAU: "682", SDN: "729", SEN: "686", SGP: "702", SLB: "90",
  SLE: "694", SLV: "222", SOM: "706", SRB: "688", SSD: "728", STP: "678",
  SUR: "740", SVK: "703", SVN: "705", SWE: "752", SWZ: "748", SYC: "690",
  SYR: "760", TCD: "148", TGO: "768", THA: "764", TJK: "762", TKM: "795",
  TLS: "626", TTO: "780", TUN: "788", TUR: "792", TWN: "490", TZA: "834",
  UGA: "800", UKR: "804", URY: "858", USA: "842", UZB: "860", VEN: "862",
  VNM: "704", VUT: "548", XKX: "412", YEM: "887", ZAF: "710", ZMB: "894",
  ZWE: "716",
};

// Pattern that identifies an HS Section product code (e.g. "01-05_Animal",
// "27-27_Fuels", "84-85_MachElec"). Filtering to these guarantees a clean
// mutually-exclusive partition of trade — without this filter we'd also
// pull aggregates like "Total", "Manufactures", "Capital goods" which
// overlap with the section breakdowns and break percent-share math.
const HS_SECTION_RE = /^\d{2}-\d{2}_/;

interface SdmxDimension {
  id: string;
  values: Array<{ id: string; name: string }>;
}

interface ProductRow {
  code: string;
  name: string;
  valueUsd: number;   // already converted from "thousands of USD" to USD
  share: number;      // 0..1, fraction of HS-section total
}

/**
 * Fetch HS 2-digit Chapter-level trade data from UN Comtrade's public
 * preview endpoint (no auth, no key, ~99 rows per call). Used for the
 * hover-drill-down inside each WITS section.
 *
 * Comtrade quirks:
 *   - Country code is M49 numeric (842 for USA), NOT ISO3
 *   - Field is `cmdCode` (HS chapter as string), value is `primaryValue`
 *     in plain USD (not thousands like WITS)
 *   - Returns one row per chapter that had reported trade in the year;
 *     chapters with zero trade are simply omitted
 *   - Aggregate row with cmdCode "TOTAL" or special chapters (99, 98)
 *     may appear — we keep all but the explicit TOTAL aggregate
 */
async function fetchComtradeChapters(
  reporter: string, // ISO3
  year: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const m49 = ISO3_TO_M49[reporter];
  if (!m49) return null;

  const flowCode = direction === "exports" ? "X" : "M";
  const url =
    `${COMTRADE_BASE}?reporterCode=${m49}` +
    `&period=${year}` +
    `&partnerCode=0` +     // 0 = world
    `&cmdCode=AG2` +       // HS 2-digit
    `&flowCode=${flowCode}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;

  let json: any;
  try { json = await upstream.json(); } catch { return null; }
  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0) return null;

  const rows: ProductRow[] = [];
  for (const r of data) {
    const code = String(r.cmdCode ?? "");
    if (!code || code === "TOTAL" || code === "ALL") continue;
    const value = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    if (value <= 0) continue;
    rows.push({
      code,
      name: `HS ${code.padStart(2, "0")}`, // client maps to friendly name
      valueUsd: Math.round(value),         // Comtrade values are already in USD
      share: 0,
    });
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  return rows;
}

async function fetchAndParse(
  reporter: string,
  year: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const indicator = direction === "exports" ? "XPRT-TRD-VL" : "MPRT-TRD-VL";
  const url =
    `${WITS_BASE}/reporter/${encodeURIComponent(reporter.toLowerCase())}` +
    `/year/${year}` +
    `/partner/wld` +
    `/product/all` +
    `/indicator/${indicator}` +
    `?format=JSON`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;

  let json: any;
  try { json = await upstream.json(); } catch { return null; }

  const seriesDims: SdmxDimension[] = json?.structure?.dimensions?.series ?? [];
  if (seriesDims.length === 0) return null;

  // Locate the PRODUCTCODE dimension's position in the colon-keyed series.
  // We look it up dynamically rather than hardcoding the position because
  // WITS could reorder dimensions in a future schema version.
  const productDimIdx = seriesDims.findIndex((d) => d.id === "PRODUCTCODE");
  if (productDimIdx === -1) return null;
  const products = seriesDims[productDimIdx].values;

  const series = json?.dataSets?.[0]?.series ?? {};
  const rows: ProductRow[] = [];

  for (const [seriesKey, seriesVal] of Object.entries(series) as Array<[string, any]>) {
    const indices = seriesKey.split(":").map((s) => parseInt(s, 10));
    const productIdx = indices[productDimIdx];
    const product = products[productIdx];
    if (!product) continue;
    if (!HS_SECTION_RE.test(product.id)) continue; // skip aggregates

    // Observation shape: { "0": [value, status] } where index "0" is the
    // single TIME_PERIOD slice we requested.
    const value = seriesVal?.observations?.["0"]?.[0];
    if (typeof value !== "number" || value <= 0) continue;

    rows.push({
      code:     product.id,
      name:     product.name,
      // WITS values are in THOUSANDS of USD — convert to base USD for the
      // client to format. (Yes, really — 411184.2 in the response = $411B.)
      valueUsd: Math.round(value * 1000),
      share:    0, // filled in below
    });
  }

  if (rows.length === 0) return null;

  // Compute share against HS-section subtotal (NOT against the reported
  // "All Products" aggregate). This matches the user's intuition: the
  // top-N percentages should add up to ~100% across the visible bars.
  const total = rows.reduce((sum, r) => sum + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);

  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url       = new URL(req.url);
  const reporter  = (url.searchParams.get("reporter") ?? "").toUpperCase().trim();
  const direction = (url.searchParams.get("direction") ?? "exports") as "exports" | "imports";
  const level     = (url.searchParams.get("level") ?? "section") as "section" | "chapter";
  const explicitYear = url.searchParams.get("year");

  if (!reporter || !/^[A-Z]{3}$/.test(reporter)) {
    return new Response(
      JSON.stringify({ error: "reporter param required as ISO 3166-1 alpha-3 (e.g. USA, GBR, DEU)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (direction !== "exports" && direction !== "imports") {
    return new Response(
      JSON.stringify({ error: "direction must be 'exports' or 'imports'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Year fallback chain: WITS publishes annually with a 1-2 year lag. If a
  // specific year was requested, try only that year. Otherwise walk back
  // from 3 years ago until we find data — country coverage isn't uniform.
  const yearsToTry = explicitYear
    ? [parseInt(explicitYear, 10)]
    : [new Date().getFullYear() - 3, new Date().getFullYear() - 4, new Date().getFullYear() - 5];

  const fetcher = level === "chapter" ? fetchComtradeChapters : fetchAndParse;

  for (const year of yearsToTry) {
    if (!Number.isFinite(year)) continue;
    const products = await fetcher(reporter, year, direction);
    if (products && products.length > 0) {
      const totalUsd = products.reduce((s, r) => s + r.valueUsd, 0);
      return json({ reporter, direction, level, year, totalUsd, products });
    }
  }

  // No data found for any year — return empty list (client renders fallback)
  return json({ reporter, direction, level, products: [] });
});
