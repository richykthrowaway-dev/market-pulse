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

// Comtrade endpoint selection: when a COMTRADE_API_KEY is configured we use
// the authenticated `/data/v1/get/` endpoint which returns the full row set
// (no 500-row preview cap) and supports a higher rate limit.  Without a key
// we fall back to the public preview endpoint — same query format, just
// truncated to 500 rows.
const COMTRADE_API_KEY = Deno.env.get("COMTRADE_API_KEY") ?? "";
const COMTRADE_BASE    = COMTRADE_API_KEY
  ? "https://comtradeapi.un.org/data/v1/get/C/A/HS"
  : "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

/**
 * Append the Comtrade subscription key to a URL when configured.
 * Comtrade accepts it as either an `Ocp-Apim-Subscription-Key` header
 * or `subscription-key` query param — we use the query param to keep
 * the existing per-call fetch shape unchanged.
 */
function comtradeUrl(url: string): string {
  if (!COMTRADE_API_KEY) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}subscription-key=${COMTRADE_API_KEY}`;
}

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

// ── M49 → { ISO2, country name } ──────────────────────────────────────
// Used to decorate Comtrade partner responses, which return only the
// numeric M49 code (`partnerCode`) and leave `partnerISO` / `partnerDesc`
// null on the public preview tier. We resolve them server-side so the
// client receives ready-to-display country codes + names.
const M49_TO_INFO: Record<string, { iso2: string; name: string }> = {
  "4":   { iso2: "AF", name: "Afghanistan" },
  "8":   { iso2: "AL", name: "Albania" },
  "12":  { iso2: "DZ", name: "Algeria" },
  "24":  { iso2: "AO", name: "Angola" },
  "31":  { iso2: "AZ", name: "Azerbaijan" },
  "32":  { iso2: "AR", name: "Argentina" },
  "36":  { iso2: "AU", name: "Australia" },
  "40":  { iso2: "AT", name: "Austria" },
  "44":  { iso2: "BS", name: "Bahamas" },
  "48":  { iso2: "BH", name: "Bahrain" },
  "50":  { iso2: "BD", name: "Bangladesh" },
  "51":  { iso2: "AM", name: "Armenia" },
  "56":  { iso2: "BE", name: "Belgium" },
  "64":  { iso2: "BT", name: "Bhutan" },
  "68":  { iso2: "BO", name: "Bolivia" },
  "70":  { iso2: "BA", name: "Bosnia & Herzegovina" },
  "72":  { iso2: "BW", name: "Botswana" },
  "76":  { iso2: "BR", name: "Brazil" },
  "84":  { iso2: "BZ", name: "Belize" },
  "90":  { iso2: "SB", name: "Solomon Islands" },
  "96":  { iso2: "BN", name: "Brunei" },
  "100": { iso2: "BG", name: "Bulgaria" },
  "104": { iso2: "MM", name: "Myanmar" },
  "108": { iso2: "BI", name: "Burundi" },
  "112": { iso2: "BY", name: "Belarus" },
  "116": { iso2: "KH", name: "Cambodia" },
  "120": { iso2: "CM", name: "Cameroon" },
  "124": { iso2: "CA", name: "Canada" },
  "132": { iso2: "CV", name: "Cape Verde" },
  "140": { iso2: "CF", name: "C.A.R." },
  "144": { iso2: "LK", name: "Sri Lanka" },
  "148": { iso2: "TD", name: "Chad" },
  "152": { iso2: "CL", name: "Chile" },
  "156": { iso2: "CN", name: "China" },
  "170": { iso2: "CO", name: "Colombia" },
  "174": { iso2: "KM", name: "Comoros" },
  "178": { iso2: "CG", name: "Congo" },
  "180": { iso2: "CD", name: "DR Congo" },
  "188": { iso2: "CR", name: "Costa Rica" },
  "191": { iso2: "HR", name: "Croatia" },
  "192": { iso2: "CU", name: "Cuba" },
  "196": { iso2: "CY", name: "Cyprus" },
  "203": { iso2: "CZ", name: "Czechia" },
  "204": { iso2: "BJ", name: "Benin" },
  "208": { iso2: "DK", name: "Denmark" },
  "214": { iso2: "DO", name: "Dominican Rep." },
  "218": { iso2: "EC", name: "Ecuador" },
  "222": { iso2: "SV", name: "El Salvador" },
  "226": { iso2: "GQ", name: "Equatorial Guinea" },
  "231": { iso2: "ET", name: "Ethiopia" },
  "232": { iso2: "ER", name: "Eritrea" },
  "233": { iso2: "EE", name: "Estonia" },
  "238": { iso2: "FK", name: "Falkland Islands" },
  "242": { iso2: "FJ", name: "Fiji" },
  "246": { iso2: "FI", name: "Finland" },
  "251": { iso2: "FR", name: "France" },
  "262": { iso2: "DJ", name: "Djibouti" },
  "266": { iso2: "GA", name: "Gabon" },
  "268": { iso2: "GE", name: "Georgia" },
  "270": { iso2: "GM", name: "Gambia" },
  "275": { iso2: "PS", name: "Palestine" },
  "276": { iso2: "DE", name: "Germany" },
  "288": { iso2: "GH", name: "Ghana" },
  "300": { iso2: "GR", name: "Greece" },
  "304": { iso2: "GL", name: "Greenland" },
  "320": { iso2: "GT", name: "Guatemala" },
  "324": { iso2: "GN", name: "Guinea" },
  "328": { iso2: "GY", name: "Guyana" },
  "332": { iso2: "HT", name: "Haiti" },
  "340": { iso2: "HN", name: "Honduras" },
  "344": { iso2: "HK", name: "Hong Kong" },
  "348": { iso2: "HU", name: "Hungary" },
  "352": { iso2: "IS", name: "Iceland" },
  "360": { iso2: "ID", name: "Indonesia" },
  "364": { iso2: "IR", name: "Iran" },
  "368": { iso2: "IQ", name: "Iraq" },
  "372": { iso2: "IE", name: "Ireland" },
  "376": { iso2: "IL", name: "Israel" },
  "381": { iso2: "IT", name: "Italy" },
  "384": { iso2: "CI", name: "Ivory Coast" },
  "388": { iso2: "JM", name: "Jamaica" },
  "392": { iso2: "JP", name: "Japan" },
  "398": { iso2: "KZ", name: "Kazakhstan" },
  "400": { iso2: "JO", name: "Jordan" },
  "404": { iso2: "KE", name: "Kenya" },
  "408": { iso2: "KP", name: "North Korea" },
  "410": { iso2: "KR", name: "South Korea" },
  "412": { iso2: "XK", name: "Kosovo" },
  "414": { iso2: "KW", name: "Kuwait" },
  "417": { iso2: "KG", name: "Kyrgyzstan" },
  "418": { iso2: "LA", name: "Laos" },
  "422": { iso2: "LB", name: "Lebanon" },
  "426": { iso2: "LS", name: "Lesotho" },
  "428": { iso2: "LV", name: "Latvia" },
  "430": { iso2: "LR", name: "Liberia" },
  "434": { iso2: "LY", name: "Libya" },
  "440": { iso2: "LT", name: "Lithuania" },
  "442": { iso2: "LU", name: "Luxembourg" },
  "450": { iso2: "MG", name: "Madagascar" },
  "454": { iso2: "MW", name: "Malawi" },
  "458": { iso2: "MY", name: "Malaysia" },
  "466": { iso2: "ML", name: "Mali" },
  "478": { iso2: "MR", name: "Mauritania" },
  "480": { iso2: "MU", name: "Mauritius" },
  "484": { iso2: "MX", name: "Mexico" },
  "490": { iso2: "TW", name: "Taiwan" },
  "496": { iso2: "MN", name: "Mongolia" },
  "498": { iso2: "MD", name: "Moldova" },
  "499": { iso2: "ME", name: "Montenegro" },
  "504": { iso2: "MA", name: "Morocco" },
  "508": { iso2: "MZ", name: "Mozambique" },
  "512": { iso2: "OM", name: "Oman" },
  "516": { iso2: "NA", name: "Namibia" },
  "524": { iso2: "NP", name: "Nepal" },
  "528": { iso2: "NL", name: "Netherlands" },
  "540": { iso2: "NC", name: "New Caledonia" },
  "548": { iso2: "VU", name: "Vanuatu" },
  "554": { iso2: "NZ", name: "New Zealand" },
  "558": { iso2: "NI", name: "Nicaragua" },
  "562": { iso2: "NE", name: "Niger" },
  "566": { iso2: "NG", name: "Nigeria" },
  "578": { iso2: "NO", name: "Norway" }, // common alt M49 for Norway
  "579": { iso2: "NO", name: "Norway" },
  "586": { iso2: "PK", name: "Pakistan" },
  "591": { iso2: "PA", name: "Panama" },
  "598": { iso2: "PG", name: "Papua New Guinea" },
  "600": { iso2: "PY", name: "Paraguay" },
  "604": { iso2: "PE", name: "Peru" },
  "608": { iso2: "PH", name: "Philippines" },
  "616": { iso2: "PL", name: "Poland" },
  "620": { iso2: "PT", name: "Portugal" },
  "624": { iso2: "GW", name: "Guinea-Bissau" },
  "626": { iso2: "TL", name: "Timor-Leste" },
  "630": { iso2: "PR", name: "Puerto Rico" },
  "634": { iso2: "QA", name: "Qatar" },
  "642": { iso2: "RO", name: "Romania" },
  "643": { iso2: "RU", name: "Russia" },
  "646": { iso2: "RW", name: "Rwanda" },
  "678": { iso2: "ST", name: "São Tomé & Príncipe" },
  "682": { iso2: "SA", name: "Saudi Arabia" },
  "686": { iso2: "SN", name: "Senegal" },
  "688": { iso2: "RS", name: "Serbia" },
  "690": { iso2: "SC", name: "Seychelles" },
  "694": { iso2: "SL", name: "Sierra Leone" },
  "699": { iso2: "IN", name: "India" },
  "702": { iso2: "SG", name: "Singapore" },
  "703": { iso2: "SK", name: "Slovakia" },
  "704": { iso2: "VN", name: "Vietnam" },
  "705": { iso2: "SI", name: "Slovenia" },
  "706": { iso2: "SO", name: "Somalia" },
  "710": { iso2: "ZA", name: "South Africa" },
  "716": { iso2: "ZW", name: "Zimbabwe" },
  "724": { iso2: "ES", name: "Spain" },
  "728": { iso2: "SS", name: "South Sudan" },
  "729": { iso2: "SD", name: "Sudan" },
  "732": { iso2: "EH", name: "Western Sahara" },
  "740": { iso2: "SR", name: "Suriname" },
  "748": { iso2: "SZ", name: "Eswatini" },
  "752": { iso2: "SE", name: "Sweden" },
  "756": { iso2: "CH", name: "Switzerland" },
  "760": { iso2: "SY", name: "Syria" },
  "762": { iso2: "TJ", name: "Tajikistan" },
  "764": { iso2: "TH", name: "Thailand" },
  "768": { iso2: "TG", name: "Togo" },
  "780": { iso2: "TT", name: "Trinidad & Tobago" },
  "784": { iso2: "AE", name: "UAE" },
  "788": { iso2: "TN", name: "Tunisia" },
  "792": { iso2: "TR", name: "Turkey" },
  "795": { iso2: "TM", name: "Turkmenistan" },
  "800": { iso2: "UG", name: "Uganda" },
  "804": { iso2: "UA", name: "Ukraine" },
  "807": { iso2: "MK", name: "North Macedonia" },
  "818": { iso2: "EG", name: "Egypt" },
  "826": { iso2: "GB", name: "United Kingdom" },
  "834": { iso2: "TZ", name: "Tanzania" },
  "840": { iso2: "US", name: "United States" }, // common Comtrade code for USA
  "842": { iso2: "US", name: "United States" },
  "854": { iso2: "BF", name: "Burkina Faso" },
  "858": { iso2: "UY", name: "Uruguay" },
  "860": { iso2: "UZ", name: "Uzbekistan" },
  "862": { iso2: "VE", name: "Venezuela" },
  "887": { iso2: "YE", name: "Yemen" },
  "894": { iso2: "ZM", name: "Zambia" },
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
 * Fetch HS 4-digit Heading-level trade data from UN Comtrade's public
 * preview endpoint. Used for the hover-drill-down inside each WITS
 * section, e.g. hovering "Machinery & Electronics" reveals concrete
 * products like "Integrated circuits", "Telephones", "Aircraft engines"
 * rather than just "Industrial machinery (HS 84) vs Electrical (HS 85)".
 *
 * AG4 returns up to 1,229 distinct codes per country; the 500-row
 * Comtrade preview cap means very-large reporters might lose long-tail
 * codes, but the top 100 always come through (which is what hover
 * popovers actually display).
 *
 * Comtrade quirks:
 *   - Country code is M49 numeric, NOT ISO3
 *   - cmdCode is the HS heading as a 4-digit string ("8542", "2710")
 *   - primaryValue is plain USD
 *   - cmdDesc is null on preview tier — names are resolved client-side
 *     via the static HS_HEADING_NAMES map (1,229 entries)
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
    `&cmdCode=AG4` +       // HS 4-digit (Heading) — was AG2 (Chapter)
    `&flowCode=${flowCode}` +
    `&breakdownMode=classic` +
    `&maxRecords=2500`;

  let upstream: Response;
  try {
    upstream = await fetch(comtradeUrl(url), { signal: AbortSignal.timeout(12_000) });
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

/**
 * Fetch a country's TOP TRADING PARTNERS — i.e. the geographic
 * counterparties of its exports/imports.
 *
 * Trick: omit Comtrade's `partnerCode` parameter entirely. With no
 * partner constraint, the response groups by partner instead of
 * collapsing to a single world total. We then drop the world-total
 * row (partnerCode=0) and aggregate-region rows (anything not in
 * our M49_TO_INFO real-country map).
 *
 * Each surviving row is decorated with its ISO2 + display name on
 * the server, since Comtrade preview leaves `partnerISO`/`partnerDesc`
 * null. The client receives ready-to-render country-level rows.
 */
async function fetchComtradePartners(
  reporter: string, // ISO3
  year: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const m49 = ISO3_TO_M49[reporter];
  if (!m49) return null;

  const flowCode = direction === "exports" ? "X" : "M";
  // Using `breakdownMode=classic` per the official Comtrade SDK docs.
  // Classic mode collapses the response server-side to one row per
  // (cmdCode, partnerCode) pair — partner2Code=0, motCode=0, customsCode=C00
  // are already set, so we don't need EU-mirror hacks, max-wins dedup, or
  // partner2 filtering.  Just filter aggregates and we're done.
  const url =
    `${COMTRADE_BASE}?reporterCode=${m49}` +
    `&period=${year}` +
    `&cmdCode=TOTAL` +
    `&flowCode=${flowCode}` +
    `&breakdownMode=classic` +
    `&maxRecords=2500`;

  let upstream: Response;
  try {
    upstream = await fetch(comtradeUrl(url), { signal: AbortSignal.timeout(15_000) });
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
    const partnerM49 = String(r.partnerCode ?? "");
    // 0 = World total, 899 = "Areas, NES" / unspecified aggregate.
    if (!partnerM49 || partnerM49 === "0" || partnerM49 === "899") continue;
    if (partnerM49 === m49) continue; // self
    const info = M49_TO_INFO[partnerM49];
    if (!info) continue;

    const value = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    if (value <= 0) continue;

    rows.push({
      code:     info.iso2,
      name:     info.name,
      valueUsd: Math.round(value),
      share:    0,
    });
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);

  // Cap at top 20 — UI shows top 10, the extra 10 are headroom for
  // possible client-side filtering.
  return rows.slice(0, 20);
}

/**
 * Fetch a country's TOTAL trade value for the last 6 years from
 * UN Comtrade. Used to render mini-sparklines showing "where's the
 * trend going" alongside the headline total.
 *
 * Comtrade accepts comma-separated periods, so 6 years = 1 round trip.
 * The response is a flat array of one record per year — we just sort
 * by year ascending and reshape into ProductRow{code: year, valueUsd}.
 *
 * Same motCode/customsCode/partner2 filtering as the partners path
 * to dedup the inevitable transport/customs-procedure splits Comtrade
 * emits when querying TOTAL with no aggregation.
 */
async function fetchComtradeTrend(
  reporter: string, // ISO3
  _ignoredYear: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const m49 = ISO3_TO_M49[reporter];
  if (!m49) return null;

  const flowCode = direction === "exports" ? "X" : "M";
  // 6-year window: this year-1 back to this year-6. WITS publishes
  // annually with a 1-2 year lag, so the latest year may be missing
  // for some countries — frontend should handle short series gracefully.
  const now = new Date().getUTCFullYear();
  const years = Array.from({ length: 6 }, (_, i) => now - 6 + i).join(",");

  const url =
    `${COMTRADE_BASE}?reporterCode=${m49}` +
    `&period=${years}` +
    `&partnerCode=0` +
    `&cmdCode=TOTAL` +
    `&flowCode=${flowCode}` +
    `&motCode=0` +
    `&customsCode=C00`;

  let upstream: Response;
  try {
    upstream = await fetch(comtradeUrl(url), { signal: AbortSignal.timeout(15_000) });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;

  let json: any;
  try { json = await upstream.json(); } catch { return null; }
  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0) return null;

  // First-write-wins per year — Comtrade returns 2 rows per year
  // (partner2Code 0 vs 899) with identical primaryValue.
  const seen = new Set<number>();
  const rows: ProductRow[] = [];
  for (const r of data) {
    const year = r.refYear;
    if (!Number.isFinite(year)) continue;
    if (seen.has(year)) continue;
    const value = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    if (value <= 0) continue;
    seen.add(year);
    rows.push({
      code:     String(year),
      name:     String(year),
      valueUsd: Math.round(value),
      share:    0,
    });
  }
  if (rows.length < 2) return null;

  // Chronological order so the sparkline draws left-to-right past→present.
  rows.sort((a, b) => Number(a.code) - Number(b.code));
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

// ── ISO2 → M49 reverse lookup (derived from M49_TO_INFO at module load) ──
// Used by the bilateral mode below to convert the `partner` ISO2 query
// param into the M49 numeric code Comtrade expects.
const ISO2_TO_M49: Record<string, string> = {};
for (const [m49, info] of Object.entries(M49_TO_INFO)) {
  if (info.iso2) ISO2_TO_M49[info.iso2] = m49;
}

// ── ISO3 → { ISO2, name } derived lookup ─────────────────────────────────
// WITS returns partner identifiers as lowercase ISO3 codes; we convert to
// ISO2 + display name for the client.  Built from ISO3_TO_M49 (key) and
// M49_TO_INFO (value) so the two maps don't drift apart.
const ISO3_TO_INFO: Record<string, { iso2: string; name: string }> = {};
for (const [iso3, m49] of Object.entries(ISO3_TO_M49)) {
  const info = M49_TO_INFO[m49];
  if (info) ISO3_TO_INFO[iso3] = info;
}

/**
 * Fetch TOP TRADING PARTNERS via World Bank WITS — a coverage-rich
 * fallback for when UN Comtrade's preview tier rate-limits us or simply
 * has no data for the reporter.
 *
 * WITS publishes per-partner indicators that already give us the share
 * directly (no need to compute totals client-side):
 *   - XPRT-PRTNR-SHR — Partner share of total exports
 *   - MPRT-PRTNR-SHR — Partner share of total imports
 *
 * WITS partner codes are lowercase ISO3 (e.g. "usa", "deu", "chn") plus
 * some aggregate codes ("wld" = world total, "ots" = others not elsewhere
 * specified, "spe" = special category).  We drop aggregates and convert
 * the rest to ISO2 + display name via ISO3_TO_INFO.
 *
 * Since the indicator already encodes share as a percentage value, the
 * `valueUsd` field is unavailable — we set it to 0 and the client uses
 * `share` for ranking.  The downstream UI (PartnerRow) only reads `share`,
 * so this is transparent.
 */
/**
 * WITS aggregate partner codes that must be filtered out — these are
 * regional rollups (East Asia, EU, etc.) not actual trading partners.
 * Keys are uppercase ISO3-style codes as WITS emits them.
 */
const WITS_PARTNER_AGGREGATES = new Set([
  "WLD",  // World total — always 100%
  "EAS",  // East Asia and Pacific
  "ECS",  // Europe and Central Asia
  "LCN",  // Latin America and Caribbean
  "MEA",  // Middle East and North Africa
  "NAC",  // North America
  "SAS",  // South Asia
  "SSF",  // Sub-Saharan Africa
  "OAS",  // Other Asia, n.e.s.
  "SER",  // Serbia, FR (Serbia/Montenegro) historical aggregate
  "TMP",  // East Timor (legacy code; TLS is modern)
  "ATF",  // French Southern Antarctic Territories
  "HMD",  // Heard Island and McDonald Islands
]);

async function fetchWitsPartners(
  reporter: string, // ISO3 uppercase
  year: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const indicator = direction === "exports" ? "XPRT-PRTNR-SHR" : "MPRT-PRTNR-SHR";
  // ── CRITICAL: WITS XPRT-PRTNR-SHR / MPRT-PRTNR-SHR are PARTNER-SHARE
  // indicators with PRODUCTCODE locked to a sentinel "Not Applicable" (999999).
  // The URL path must use `product/all` (or `product/999999`) — using
  // `product/Total` returns 404 / NoRecordsFound because no row in the
  // dataset has that product attribute.
  const url =
    `${WITS_BASE}/reporter/${encodeURIComponent(reporter.toLowerCase())}` +
    `/year/${year}` +
    `/partner/all` +
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

  const partnerDimIdx = seriesDims.findIndex(d => d.id === "PARTNER");
  if (partnerDimIdx === -1) return null;
  const partners = seriesDims[partnerDimIdx].values;

  const series = json?.dataSets?.[0]?.series ?? {};
  const rows: ProductRow[] = [];

  for (const [seriesKey, seriesVal] of Object.entries(series) as Array<[string, any]>) {
    const indices    = seriesKey.split(":").map(s => parseInt(s, 10));
    const partnerIdx = indices[partnerDimIdx];
    const partner    = partners[partnerIdx];
    if (!partner) continue;

    const code3 = partner.id.toUpperCase();
    if (WITS_PARTNER_AGGREGATES.has(code3)) continue;

    const info = ISO3_TO_INFO[code3];
    if (!info) continue; // unmapped country code — skip

    const value = seriesVal?.observations?.["0"]?.[0];
    if (typeof value !== "number" || value <= 0) continue;

    rows.push({
      code:     info.iso2,
      name:     info.name,
      valueUsd: 0,            // share-only indicator — no absolute USD
      share:    value / 100,  // percent → fraction
    });
  }

  if (rows.length === 0) return null;
  rows.sort((a, b) => b.share - a.share);
  return rows.slice(0, 20);
}

/**
 * Fetch a TRUE BILATERAL product breakdown — exactly what `reporter`
 * traded with `partner` in `direction`, broken down by HS Chapter (2-digit).
 *
 * Sets both `reporterCode` AND `partnerCode` on the Comtrade preview
 * endpoint.  Uses cmdCode=AG2 (HS 2-digit Chapter, ~99 codes) since the
 * popover UI is compact and chapter granularity is the sweet spot for
 * quick scanning ("Mineral fuels 32%", "Vehicles 19%", etc.).
 *
 * Same motCode=0 + customsCode=C00 filters as the other Comtrade calls
 * to dedup the multi-transport / multi-customs rows that would otherwise
 * inflate the totals.  partner2Code dedup is unnecessary here because the
 * partner is constrained to a single country — no aggregation collisions.
 *
 * Example query:
 *   reporterCode=842 (USA) & partnerCode=124 (Canada)
 *   & cmdCode=AG2 & flowCode=X (exports)
 *   → returns the chapters US exported to Canada that year.
 */
async function fetchComtradeBilateral(
  reporter: string,       // ISO3
  partnerIso2: string,    // ISO2
  year: number,
  direction: "exports" | "imports",
): Promise<ProductRow[] | null> {
  const reporterM49 = ISO3_TO_M49[reporter];
  const partnerM49  = ISO2_TO_M49[partnerIso2];
  if (!reporterM49 || !partnerM49) return null;

  const flowCode = direction === "exports" ? "X" : "M";
  const url =
    `${COMTRADE_BASE}?reporterCode=${reporterM49}` +
    `&period=${year}` +
    `&partnerCode=${partnerM49}` +
    `&cmdCode=AG2` +
    `&flowCode=${flowCode}` +
    `&breakdownMode=classic` +
    `&maxRecords=2500`;

  let upstream: Response;
  try {
    upstream = await fetch(comtradeUrl(url), { signal: AbortSignal.timeout(12_000) });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;

  let json: any;
  try { json = await upstream.json(); } catch { return null; }
  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0) return null;

  // breakdownMode=classic returns one row per chapter — no dedup needed.
  const rows: ProductRow[] = [];
  for (const r of data) {
    const code = String(r.cmdCode ?? "");
    if (!code || code === "TOTAL" || code === "ALL") continue;
    const value = typeof r.primaryValue === "number" ? r.primaryValue : 0;
    if (value <= 0) continue;
    rows.push({
      code,
      name: `HS ${code.padStart(2, "0")}`,
      valueUsd: Math.round(value),
      share: 0,
    });
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url       = new URL(req.url);
  const reporter  = (url.searchParams.get("reporter") ?? "").toUpperCase().trim();
  const direction = (url.searchParams.get("direction") ?? "exports") as "exports" | "imports";
  const level     = (url.searchParams.get("level") ?? "section") as "section" | "chapter" | "partners" | "trend" | "bilateral";
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
  // from 2 years ago until we find data — country coverage isn't uniform.
  // Widened from 3 → 5 attempts (currentYear-2 through -6) because smaller
  // reporters often skip a year or two; bumping the range covers them
  // without meaningfully increasing latency in the common case (cache hits
  // on the first successful year).
  const currentYear = new Date().getFullYear();
  const yearsToTry = explicitYear
    ? [parseInt(explicitYear, 10)]
    : [currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5, currentYear - 6];

  // Bilateral mode takes an extra `partner` ISO2 query param and has a
  // different fetcher signature, so it's dispatched separately.
  if (level === "bilateral") {
    const partner = (url.searchParams.get("partner") ?? "").toUpperCase().trim();
    if (!partner || !/^[A-Z]{2}$/.test(partner)) {
      return json(
        { error: "partner param required as ISO 3166-1 alpha-2 for bilateral mode (e.g. CA, CN, DE)" },
        400,
      );
    }
    for (const year of yearsToTry) {
      if (!Number.isFinite(year)) continue;
      const products = await fetchComtradeBilateral(reporter, partner, year, direction);
      if (products && products.length > 0) {
        const totalUsd = products.reduce((s, r) => s + r.valueUsd, 0);
        return json({ reporter, partner, direction, level, year, totalUsd, products });
      }
    }
    return json({ reporter, partner, direction, level, products: [] });
  }

  // ── Partners path: try Comtrade first, then WITS as a fallback ──────────
  // Comtrade's preview tier is rate-limited and has spotty coverage for
  // many small/mid reporters.  When Comtrade comes back empty for every
  // candidate year, we fall back to WITS's partner-share indicator which
  // has much broader country coverage (it's published by World Bank from
  // multiple underlying sources, not just Comtrade).
  if (level === "partners") {
    // Pass 1: Comtrade across the year range
    for (const year of yearsToTry) {
      if (!Number.isFinite(year)) continue;
      const products = await fetchComtradePartners(reporter, year, direction);
      if (products && products.length > 0) {
        const totalUsd = products.reduce((s, r) => s + r.valueUsd, 0);
        return json({ reporter, direction, level, year, totalUsd, products, source: "comtrade" });
      }
    }
    // Pass 2: WITS partner-share indicator (different source — wider coverage)
    for (const year of yearsToTry) {
      if (!Number.isFinite(year)) continue;
      const products = await fetchWitsPartners(reporter, year, direction);
      if (products && products.length > 0) {
        // valueUsd is unavailable on the WITS share indicator; totalUsd ≈ 0.
        return json({ reporter, direction, level, year, totalUsd: 0, products, source: "wits" });
      }
    }
    return json({ reporter, direction, level, products: [] });
  }

  const fetcher =
    level === "chapter"  ? fetchComtradeChapters :
    level === "trend"    ? fetchComtradeTrend :
    fetchAndParse;

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
