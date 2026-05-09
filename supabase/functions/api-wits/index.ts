import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-wits — World Bank WITS Trade Stats proxy + SDMX parser
 *
 * Provides per-country product-level export and import breakdowns via the
 * World Bank's Integrated Trade Solution (WITS) API. WITS publishes
 * SDMX-JSON which is dimensional and verbose; this proxy flattens it to
 * the exact shape the client UI consumes:
 *
 *   { year, totalUsd, products: [{ name, code, valueUsd, share }, ...] }
 *
 * Why proxy rather than call WITS directly from the browser:
 *   1. WITS does NOT send CORS headers — browser fetches are blocked.
 *   2. SDMX parsing is non-trivial; doing it once server-side keeps the
 *      client bundle small.
 *   3. We can transparently fall back across years if a given year has
 *      no data for a country (small economies often lag 1-2 years).
 *
 * Request:
 *   GET /functions/v1/api-wits?reporter={ISO3}&direction=exports|imports
 *
 * Optional:
 *   year={YYYY}  (default: try most recent ~4 years until data is found)
 *
 * Response (success):
 *   {
 *     reporter: "USA",
 *     year: 2022,
 *     direction: "exports",
 *     totalUsd: 411184_200_000,
 *     products: [
 *       { code: "27-27_Fuels", name: "Fuels", valueUsd: 327009100000, share: 0.795 },
 *       ...
 *     ]
 *   }
 *
 * Response (no data found):
 *   { reporter, direction, products: [] }   (HTTP 200, empty list)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WITS_BASE = "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/tradestats-trade";

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

  for (const year of yearsToTry) {
    if (!Number.isFinite(year)) continue;
    const products = await fetchAndParse(reporter, year, direction);
    if (products && products.length > 0) {
      const totalUsd = products.reduce((s, r) => s + r.valueUsd, 0);
      return json({ reporter, direction, year, totalUsd, products });
    }
  }

  // No data found for any year — return empty list (client renders fallback)
  return json({ reporter, direction, products: [] });
});
