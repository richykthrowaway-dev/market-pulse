import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * api-market-returns — Market Return Distribution
 *
 * Returns { returns: number[], stats: { median, mean, up, down } }
 * for all stocks over the requested timeframe.
 *
 * Performance tiers (vs old approach of 2×N queries):
 *
 *   1D        → 1 query  (reads change_percent from stocks table directly)
 *   Non-1D    → 1 query  (reads pre-computed cache from market_returns_cache)
 *   Cache miss → 2 queries (timeframe_id lookup + get_period_returns() RPC)
 *                          get_period_returns() = single-scan window function,
 *                          O(N rows in range) regardless of stock count.
 *
 * Cache TTL: 15 minutes. Cache is populated by nightly ingest-eod-bulk
 * → refresh_market_returns_cache(), so misses are rare in normal operation.
 *
 * Query params:
 *   timeframe  "1D"|"1W"|"1M"|"3M"|"6M"|"YTD"|"1Y"|"3Y"|"5Y"|"10Y"
 *   refresh    "1"  — bypass cache (admin / debugging)
 */

const CACHE_MAX_AGE_MS = 15 * 60_000; // 15 minutes

interface ReturnStats {
  median: number;
  mean:   number;
  up:     number;
  down:   number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url          = new URL(req.url);
    const timeframe    = url.searchParams.get("timeframe") || "1D";
    const forceRefresh = url.searchParams.get("refresh") === "1";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1D fast path ──────────────────────────────────────────────────────────
    // Single SELECT on stocks table — no joins, no OHLCV scan.
    // Scales O(N stocks): 5,000 rows ≈ 5ms, 10,000 rows ≈ 10ms.
    if (timeframe === "1D") {
      // Paginate to overcome PostgREST's 1000-row default limit
      const PAGE_SIZE = 1000;
      const allReturns: number[] = [];
      let page = 0;

      // Fire both queries concurrently: returns + new highs/lows
      const hlPromise = supabase.rpc("get_new_highs_lows");

      while (true) {
        const { data: stocks, error } = await supabase
          .from("stocks")
          .select("change_percent")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        if (!stocks || stocks.length === 0) break;
        for (const s of stocks) {
          const v = Number(s.change_percent);
          if (!isNaN(v)) allReturns.push(v);
        }
        if (stocks.length < PAGE_SIZE) break;
        page++;
      }

      // Await the new-highs/lows RPC (ran concurrently with pagination loop)
      const { data: hlData } = await hlPromise;
      const newHigh = hlData?.new_high ?? 0;
      const newLow  = hlData?.new_low  ?? 0;

      return respond({
        returns: allReturns,
        stats: computeStats(allReturns),
        stock_count: allReturns.length,
        new_high: newHigh,
        new_low: newLow,
      });
    }

    // ── Non-1D: read pre-computed cache ───────────────────────────────────────
    // Cache populated nightly by ingest-eod-bulk → refresh_market_returns_cache().
    // Serving from cache = 1 row read, sub-millisecond response.
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("market_returns_cache")
        .select("returns, stats, computed_at, stock_count")
        .eq("timeframe_code", timeframe)
        .single();

      if (cached) {
        const ageMs = Date.now() - new Date(cached.computed_at).getTime();
        if (ageMs < CACHE_MAX_AGE_MS) {
          return respond({
            returns:     cached.returns    as number[],
            stats:       cached.stats      as ReturnStats,
            stock_count: cached.stock_count,
            cached:      true,
            cache_age_s: Math.round(ageMs / 1000),
          });
        }
      }
    }

    // ── Cache miss: single-scan RPC ───────────────────────────────────────────
    // get_period_returns() uses PostgreSQL window functions:
    //   FIRST_VALUE(close) OVER w → open price
    //   LAST_VALUE(close)  OVER w → close price
    // One scan over ohlcv_bars for the date range — no per-listing loops.
    const rawStartDate = calcStartDate(timeframe);

    const { data: tf, error: tfErr } = await supabase
      .from("timeframes")
      .select("id")
      .eq("code", "1D")
      .single();

    if (tfErr || !tf) throw new Error("1D timeframe not found");

    // Snap start date backward to the nearest available trading bar.
    // Financial convention: use close of last trading day on or before the
    // period start (handles weekends, holidays, and sparse historical data).
    const { data: snapRow } = await supabase
      .from("ohlcv_bars")
      .select("ts")
      .eq("timeframe_id", tf.id)
      .lte("ts", rawStartDate.toISOString())
      .order("ts", { ascending: false })
      .limit(1)
      .single();

    const startDate = snapRow ? new Date(snapRow.ts) : rawStartDate;

    const { data: rawReturns, error: rpcErr } = await supabase.rpc(
      "get_period_returns",
      {
        p_start_date: startDate.toISOString(),
        p_tf_id:      tf.id,
      },
    );

    if (rpcErr) throw rpcErr;

    const returns = (rawReturns ?? []).map((v: unknown) => Number(v));
    const stats   = computeStats(returns);

    // Write-through to cache (fire-and-forget — does not block the response)
    supabase.from("market_returns_cache").upsert(
      {
        timeframe_code: timeframe,
        returns,
        stats,
        stock_count:    returns.length,
        computed_at:    new Date().toISOString(),
      },
      { onConflict: "timeframe_code" },
    ).then(({ error: e }) => {
      if (e) console.error("market_returns_cache write-through error:", e.message);
    });

    return respond({ returns, stats, stock_count: returns.length });

  } catch (err) {
    console.error("api-market-returns error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function respond(body: object) {
  return new Response(
    JSON.stringify(body),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function computeStats(returns: number[]): ReturnStats {
  if (returns.length === 0) return { median: 0, mean: 0, up: 0, down: 0 };
  const sorted = [...returns].sort((a, b) => a - b);
  const n      = sorted.length;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  return {
    median: Math.round(median * 100) / 100,
    mean:   Math.round(mean   * 100) / 100,
    up:     returns.filter((r) => r > 0).length,
    down:   returns.filter((r) => r < 0).length,
  };
}

function calcStartDate(tf: string): Date {
  const now = new Date();
  // Truncate to midnight UTC so arithmetic lands on day boundaries,
  // matching how ohlcv_bars are stored (T00:00:00Z).
  now.setUTCHours(0, 0, 0, 0);
  switch (tf) {
    case "1W":  return new Date(now.getTime() - 7 * 86_400_000);
    case "1M":  { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - 1);        return d; }
    case "3M":  { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - 3);        return d; }
    case "6M":  { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - 6);        return d; }
    case "YTD": return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case "1Y":  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1);  return d; }
    case "3Y":  { const d = new Date(now); d.setFullYear(d.getFullYear() - 3);  return d; }
    case "5Y":  { const d = new Date(now); d.setFullYear(d.getFullYear() - 5);  return d; }
    case "10Y": { const d = new Date(now); d.setFullYear(d.getFullYear() - 10); return d; }
    default:    return new Date(now.getTime() - 7 * 86_400_000);
  }
}
