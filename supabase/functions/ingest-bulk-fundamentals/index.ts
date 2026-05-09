import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ingest-bulk-fundamentals
 *
 * Pulls GICS sector/group/industry/sub-industry data for an entire exchange
 * using EODHD's /bulk-fundamentals endpoint.
 *
 * Why this and not /fundamentals per ticker?
 *   /fundamentals/{TICKER}        = 10 quota credits per ticker
 *   /bulk-fundamentals/{EXCHANGE} = 100 credits per request, up to 500 tickers
 *
 *   For a 47,000-ticker DB:
 *     per-ticker:  47,000 × 10  = 470,000 credits  (~5 days of quota)
 *     bulk:         94 × 100    =   9,400 credits  (~10% of one day)
 *
 *   That's a ~50× reduction in quota burn, the difference between this being
 *   feasible vs. flat-out impossible on any reasonable plan.
 *
 * POST body:
 *   {
 *     "exchange": "US",        — exchange code (US, LSE, TO, V, AX, …)
 *     "offset":   0,           — starting offset (paginate by 500)
 *     "limit":    500,         — max tickers per request (EODHD caps at 500)
 *     "max_pages": 5           — process at most N pages this invocation
 *                                 (default 5 → 2,500 tickers / 500 credits / ~10s)
 *   }
 *
 * Returns:
 *   {
 *     "exchange":      "US",
 *     "pages_done":    5,
 *     "tickers_seen":  2500,
 *     "tickers_written": 2480,
 *     "next_offset":   2500,    — pass this back to continue, or null when finished
 *     "credits_used":  500
 *   }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE = "https://eodhd.com/api";

interface EodhdGeneral {
  Code?: string;
  Name?: string;
  Type?: string;
  Sector?: string;
  Industry?: string;
  GicSector?: string;
  GicGroup?: string;
  GicIndustry?: string;
  GicSubIndustry?: string;
  CountryISO?: string;
  CountryName?: string;
}

interface EodhdBulkRow {
  General?: EodhdGeneral;
  Highlights?: { MarketCapitalization?: number };
  // bulk-fundamentals also returns flatter top-level fields on some plans
  Code?: string;
  Sector?: string;
  Industry?: string;
  GicSector?: string;
  GicGroup?: string;
  GicIndustry?: string;
  GicSubIndustry?: string;
  CountryISO?: string;
  CountryName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey      = Deno.env.get("EODHD_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!apiKey) {
    return json(500, { error: "EODHD_API_KEY not configured" });
  }

  let body: Record<string, unknown> = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { /* no body */ }
  const exchange  = (typeof body.exchange === "string" ? body.exchange : "US").toUpperCase();
  let   offset    =  typeof body.offset    === "number" ? body.offset    : 0;
  const limit     =  Math.min(typeof body.limit === "number" ? body.limit : 500, 500);
  const maxPages  =  typeof body.max_pages === "number" ? body.max_pages : 5;

  const sb = createClient(supabaseUrl, serviceKey);

  let pagesDone      = 0;
  let tickersSeen    = 0;
  let tickersWritten = 0;
  let nextOffset: number | null = offset;

  for (let page = 0; page < maxPages; page++) {
    const url =
      `${EODHD_BASE}/bulk-fundamentals/${encodeURIComponent(exchange)}` +
      `?api_token=${apiKey}&fmt=json&version=1.2&offset=${offset}&limit=${limit}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      return json(502, { error: `EODHD fetch failed: ${(e as Error).message}`,
                         offset, pages_done: pagesDone, tickers_seen: tickersSeen });
    }

    if (!res.ok) {
      const text = await res.text();
      // 429 / 402 — quota exceeded
      return json(res.status, {
        error: `EODHD HTTP ${res.status}`,
        detail: text.slice(0, 300),
        offset, pages_done: pagesDone, tickers_seen: tickersSeen,
      });
    }

    let payload: unknown;
    try { payload = await res.json(); }
    catch { return json(502, { error: "EODHD non-JSON response", offset }); }

    // Bulk fundamentals returns either an array OR an object keyed by ticker
    const rows: EodhdBulkRow[] = Array.isArray(payload)
      ? payload as EodhdBulkRow[]
      : Object.values(payload as Record<string, EodhdBulkRow>);

    if (rows.length === 0) {
      // No more data — we're done with this exchange
      nextOffset = null;
      break;
    }

    // Build update statements per row
    const updates: { ticker: string; cols: Record<string, string> }[] = [];
    for (const row of rows) {
      // Normalize across possible payload shapes (nested General vs flat)
      const g: EodhdGeneral = row.General ?? {
        Code:           row.Code,
        Sector:         row.Sector,
        Industry:       row.Industry,
        GicSector:      row.GicSector,
        GicGroup:       row.GicGroup,
        GicIndustry:    row.GicIndustry,
        GicSubIndustry: row.GicSubIndustry,
        CountryISO:     row.CountryISO,
        CountryName:    row.CountryName,
      };
      const ticker = (g.Code || row.Code || "").toUpperCase();
      if (!ticker) continue;

      const cols: Record<string, string> = {};
      const sector   = g.GicSector   || g.Sector   || "";
      const industry = g.GicIndustry || g.Industry || "";
      const country  = g.CountryISO  || g.CountryName || "";
      if (sector)            cols.gics_sector         = sector;
      if (g.GicGroup)        cols.gics_industry_group = g.GicGroup;
      if (industry)          cols.gics_industry       = industry;
      if (g.GicSubIndustry)  cols.gics_sub_industry   = g.GicSubIndustry;
      if (country)           cols.country             = country;
      if (Object.keys(cols).length > 0) updates.push({ ticker, cols });
    }

    // Batch the updates — Supabase doesn't have a single multi-row UPDATE
    // primitive without upsert, so we fire them concurrently with a small cap.
    const CONCURRENCY = 20;
    let written = 0;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const chunk = updates.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(u => sb.from("symbols").update(u.cols).eq("canonical_ticker", u.ticker))
      );
      for (const r of results) if (r.status === "fulfilled") written++;
    }

    tickersSeen    += rows.length;
    tickersWritten += written;
    pagesDone      += 1;
    offset         += rows.length;
    nextOffset      = offset;

    // If we got fewer than `limit`, we've reached the end of the exchange
    if (rows.length < limit) {
      nextOffset = null;
      break;
    }
  }

  return json(200, {
    exchange,
    pages_done:      pagesDone,
    tickers_seen:    tickersSeen,
    tickers_written: tickersWritten,
    next_offset:     nextOffset,
    // Each /bulk-fundamentals request costs 100 quota credits regardless of size
    credits_used:    pagesDone * 100,
  });
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
