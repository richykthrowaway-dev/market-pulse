import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ingest-fundamentals-bulk
 *
 * Seeds GICS sector, industry, country, and market cap for every ticker
 * in the `symbols` table that currently has no sector tag.
 *
 * Strategy:
 *   1. Fetch all canonical_tickers from `symbols` where gics_sector IS NULL
 *   2. For each ticker, call EODHD /fundamentals/{ticker}.US
 *   3. Extract General.GicSector/Industry/Country + Highlights.MarketCapitalization
 *   4. Upsert back to `symbols` and `stocks`
 *
 * ⚠️  CREDIT COST WARNING — READ BEFORE INVOKING ⚠️
 *   EODHD `/fundamentals/{ticker}` costs **10 CREDITS per call**, NOT 1.
 *   Original docstring claimed "1 call per ticker is fine" — this was WRONG
 *   and caused us to burn 100,000 credits in a single day.
 *
 *   Cost math:
 *     50 tickers per invocation × 10 credits = 500 credits per run
 *     Full backfill of 47K tickers           = 470,000 credits (4.7 days quota!)
 *
 *   **Prefer `ingest-bulk-fundamentals`** which uses EODHD's bulk-fundamentals
 *   endpoint at ~0.2 credits/ticker (50× cheaper). This per-ticker function
 *   exists only for filling individual gaps after a bulk run.
 *
 *   Quota guardrail: this function refuses to run when remaining daily quota
 *   is below MIN_QUOTA_TO_RUN (default 15,000 — enough headroom for ~1500
 *   tickers × 10 credits with safety margin).
 *
 * POST body (optional):
 *   { "limit": 500 }    — process only N tickers (for testing)
 *   { "exchange": "US" } — restrict to one exchange (default: all)
 *   { "resume_after": "AAPL" } — start after this ticker (alphabetical)
 *   { "missing": "sub_industry" } — target tickers missing gics_sub_industry
 *                                   (default: "sector" — original behavior)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE       = "https://eodhd.com/api";
const BATCH_SIZE       = 10;     // concurrent EODHD requests per wave (kept small to avoid edge-fn wall-time)
const WAVE_DELAY       = 300;    // ms between waves
const MAX_TICKERS      = 50;     // hard cap per invocation to stay under Supabase 25s wall-time
const EODHD_TIMEOUT    = 6000;   // ms per EODHD call
const FUNDAMENTALS_COST = 10;    // credits per /fundamentals call (EODHD's actual cost)
const MIN_QUOTA_TO_RUN  = 15000; // refuse to run when remaining daily quota < this

/** Check remaining daily quota via the free /user endpoint. Returns null on error. */
async function checkRemainingQuota(apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${EODHD_BASE}/user?api_token=${apiKey}&fmt=json`);
    if (!res.ok) return null;
    const d = await res.json();
    const used  = typeof d.apiRequests   === "number" ? d.apiRequests   : 0;
    const limit = typeof d.dailyRateLimit === "number" ? d.dailyRateLimit : 100_000;
    return Math.max(0, limit - used);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey       = Deno.env.get("EODHD_API_KEY");
  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // Parse options
  let body: Record<string, unknown> = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { /* no body */ }

  // ── Quota guardrail ─────────────────────────────────────────────────────────
  // Refuse to run when remaining quota is too low. This function costs
  // 10 credits/ticker × up to 50 tickers = 500 credits per invocation, and
  // historically blew the entire 100k daily allowance. Override with
  // { force: true } in the POST body if you really need to run anyway.
  const force = body.force === true;
  if (!force) {
    const remaining = await checkRemainingQuota(apiKey);
    if (remaining !== null && remaining < MIN_QUOTA_TO_RUN) {
      return new Response(JSON.stringify({
        error: "Insufficient EODHD quota",
        detail: `Remaining: ${remaining}, required: ${MIN_QUOTA_TO_RUN}. ` +
                `Pass { force: true } to override. Quota resets at UTC midnight. ` +
                `Consider using ingest-bulk-fundamentals instead (50× cheaper).`,
        quotaRemaining: remaining,
        quotaRequired:  MIN_QUOTA_TO_RUN,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const limit       = typeof body.limit       === "number" ? Math.min(body.limit, MAX_TICKERS) : MAX_TICKERS;
  const exchange    = typeof body.exchange    === "string" ? body.exchange    : null;
  const resumeAfter = typeof body.resume_after === "string" ? body.resume_after : null;
  /** dry_run=true returns the ticker list without calling EODHD — useful for debugging */
  const dryRun      = body.dry_run === true;
  /** Which column to filter on for "still needs ingestion".
   *  "sector"        → tickers missing gics_sector (original behavior)
   *  "sub_industry"  → tickers missing gics_sub_industry (covers stocks that
   *                    have sector tagged but no sub-industry yet) */
  const missingCol  = body.missing === "sub_industry" ? "gics_sub_industry" : "gics_sector";

  // ── 1. Fetch tickers that still need tagging ──────────────────────────────
  // Note: symbols table has no `exchange` column — filter by ticker suffix if needed
  let query = sb
    .from("symbols")
    .select("canonical_ticker")
    .is(missingCol, null)
    .order("canonical_ticker", { ascending: true })
    .limit(limit);

  // When exchange param provided, filter tickers that already contain the exchange suffix
  // (e.g. "US" matches tickers like "AAPL" that will be sent as "AAPL.US")
  // For tickers without a dot, they are all treated as US. Tickers with a dot (e.g. "RY.TO")
  // contain their exchange already — filter by matching suffix.
  if (exchange) {
    if (exchange !== "US") {
      // Only process tickers that end in .EXCHANGE
      query = (query as any).like("canonical_ticker", `%.${exchange}`);
    } else {
      // Only process tickers that do NOT already have a dot (plain US tickers)
      query = (query as any).not("canonical_ticker", "like", "%.%");
    }
  }
  if (resumeAfter) query = query.gt("canonical_ticker", resumeAfter);

  const { data: symbolRows, error: symErr } = await query;
  if (symErr) {
    return new Response(JSON.stringify({ error: symErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tickers = (symbolRows ?? []).map(r => r.canonical_ticker).filter(Boolean);
  if (tickers.length === 0) {
    return new Response(JSON.stringify({ message: "No untagged tickers found", processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dry-run: return ticker list without calling EODHD (for debugging)
  if (dryRun) {
    return new Response(JSON.stringify({ dry_run: true, tickers, total: tickers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`ingest-fundamentals-bulk: processing ${tickers.length} tickers`);

  // ── 2. Process in waves ───────────────────────────────────────────────────
  let processed = 0;
  let failed    = 0;
  let lastTicker = "";

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const wave = tickers.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      wave.map(async (ticker) => {
        // EODHD format: TICKER.US for US stocks
        const eodSymbol = ticker.includes(".") ? ticker : `${ticker}.US`;
        const url = `${EODHD_BASE}/fundamentals/${encodeURIComponent(eodSymbol)}?api_token=${apiKey}&fmt=json`;

        const res = await fetch(url, { signal: AbortSignal.timeout(EODHD_TIMEOUT) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.General?.Code) throw new Error("No fundamentals data");

        const g = data.General;
        const h = data.Highlights ?? {};

        const symbolUpdate: Record<string, string | null> = {};
        const sector   = g.GicSector   || g.Sector   || null;
        const industry = g.GicIndustry || g.Industry || null;
        const country  = g.CountryISO  || g.CountryName || null;

        if (sector)             symbolUpdate.gics_sector         = sector;
        if (g.GicGroup)         symbolUpdate.gics_industry_group = g.GicGroup;
        if (industry)           symbolUpdate.gics_industry       = industry;
        if (g.GicSubIndustry)   symbolUpdate.gics_sub_industry   = g.GicSubIndustry;
        if (country)            symbolUpdate.country             = country;

        if (Object.keys(symbolUpdate).length > 0) {
          await sb.from("symbols").update(symbolUpdate).eq("canonical_ticker", ticker);
        }

        // Also update stocks table with market cap if available
        const mktCap = h.MarketCapitalization;
        if (mktCap && Number(mktCap) > 0) {
          await sb.from("stocks")
            .update({ market_cap: mktCap })
            .eq("symbol", ticker);
        }

        return ticker;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") processed++;
      else { failed++; console.warn("failed:", r.reason); }
    }
    lastTicker = wave[wave.length - 1];

    // Wave delay to avoid hammering the API
    if (i + BATCH_SIZE < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, WAVE_DELAY));
    }
  }

  return new Response(
    JSON.stringify({
      message:          "Fundamentals bulk ingest complete",
      processed,
      failed,
      total:            tickers.length,
      last_ticker:      lastTicker,
      /** Pass this as resume_after in the next call to continue where this left off */
      next_resume_after: lastTicker || null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
