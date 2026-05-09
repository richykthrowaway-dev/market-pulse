import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-market-caps — batch market cap lookup
 *
 * Returns market capitalisation in USD for a list of tickers, used by the
 * Portfolio page's "Market Cap" allocation tab.
 *
 * Resolution chain:
 *   1. Query the `stocks` DB table (populated by nightly ingest-eod-bulk)
 *   2. For tickers with no cached market_cap, call FMP /profile in parallel
 *   3. Write FMP results back to `stocks` so the next call hits the DB cache
 *
 * Why this layered approach:
 *   • DB hit costs ~50ms total (one batch query) for the whole portfolio
 *   • FMP fallback is the right primary source for new tickers — free tier,
 *     comprehensive US coverage, returns market cap in the profile payload
 *     anyway, so no extra API call is wasted
 *   • EODHD is NOT used here on purpose — too expensive (10 credits per
 *     /fundamentals call) for a field that updates daily at most
 *
 * POST body:
 *   { "tickers": ["AAPL", "MSFT", ...] }
 *
 * Returns:
 *   { "AAPL": 3000000000000, "MSFT": 2800000000000, "TUNG": null, ... }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FMP_BASE = "https://financialmodelingprep.com";

interface PostBody {
  tickers?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "POST required" });
  }

  let body: PostBody = {};
  try { body = await req.json(); } catch { /* keep empty */ }
  const tickers = Array.isArray(body.tickers)
    ? body.tickers.map(t => String(t).toUpperCase()).filter(Boolean)
    : [];
  if (tickers.length === 0) return json(200, {});

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fmpKey      = Deno.env.get("FMP_API_KEY") ?? Deno.env.get("VITE_FMP_KEY");
  const sb          = createClient(supabaseUrl, serviceKey);

  // ── Layer 1: DB cache ────────────────────────────────────────────────
  // The stocks table is populated nightly with EOD prices and market cap
  // for ~47K tickers. A single batched query covers most portfolio holdings
  // in ~50ms. The bare ticker (no exchange suffix) is the primary key here.
  const result: Record<string, number | null> = {};
  for (const t of tickers) result[t] = null;

  const { data: stockRows, error: stocksErr } = await sb
    .from("stocks")
    .select("symbol, market_cap")
    .in("symbol", tickers);

  if (!stocksErr && stockRows) {
    for (const row of stockRows) {
      const cap = Number(row.market_cap);
      if (Number.isFinite(cap) && cap > 0) {
        result[String(row.symbol).toUpperCase()] = cap;
      }
    }
  }

  // ── Layer 2: FMP for tickers still missing market cap ─────────────────
  const stillMissing = tickers.filter(t => !result[t]);
  if (stillMissing.length > 0 && fmpKey) {
    // FMP free tier handles bursts of parallel requests; we cap at 20 in
    // flight at a time to avoid hammering them and to leave headroom for
    // other concurrent users of the API key.
    const CONCURRENCY = 20;
    const upserts: { symbol: string; market_cap: number }[] = [];

    for (let i = 0; i < stillMissing.length; i += CONCURRENCY) {
      const chunk = stillMissing.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (ticker) => {
        try {
          const fmpUrl = `${FMP_BASE}/stable/profile?symbol=${encodeURIComponent(ticker)}&apikey=${fmpKey}`;
          const res = await fetch(fmpUrl, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return;
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          const profile = arr[0];
          if (!profile) return;

          const cap = Number(profile.marketCap);
          if (!Number.isFinite(cap) || cap <= 0) return;

          result[ticker] = cap;
          upserts.push({ symbol: ticker, market_cap: cap });
        } catch {
          // best-effort — leave result[ticker] as null
        }
      }));
    }

    // Write-through: cache fresh market caps back to stocks so the next
    // call hits DB instantly. Only update existing rows — we don't want
    // to insert ghost rows for tickers that aren't tracked elsewhere.
    if (upserts.length > 0) {
      // Fire-and-forget DB updates; don't block the response on them
      Promise.all(
        upserts.map(u =>
          sb.from("stocks").update({ market_cap: u.market_cap }).eq("symbol", u.symbol)
        )
      ).catch(err => console.error("market_cap cache update failed:", err));
    }
  }

  return json(200, result);
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
