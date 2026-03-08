import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-52week — Fetch real 52-week high/low and current price for a list of tickers.
 *
 * POST body: { tickers: string[] }
 * Response:  { ranges: Record<string, { price: number, low52: number, high52: number }> }
 *
 * Fetches 1-year daily OHLC data from Yahoo Finance and computes true
 * 52-week high/low from actual daily highs and lows.
 * Uses one Yahoo call per ticker (vs two Finnhub calls). Batches 8 at a time
 * with a 200ms inter-batch pause to avoid Yahoo rate limiting.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Range52 {
  ticker: string;
  price: number;
  low52: number;
  high52: number;
}

/** Fetch 1-year daily data from Yahoo Finance and extract 52-week high/low + current price */
async function fetch52Week(ticker: string): Promise<Range52 | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; 52wCalc/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!meta || !quotes) return null;

    const highs: number[] = (quotes.high ?? []).filter((v: number | null) => v != null);
    const lows: number[] = (quotes.low ?? []).filter((v: number | null) => v != null);
    const closes: number[] = (quotes.close ?? []).filter((v: number | null) => v != null);

    if (!highs.length || !lows.length || !closes.length) return null;

    return {
      ticker,
      price: meta.regularMarketPrice ?? closes[closes.length - 1],
      high52: Math.max(...highs),
      low52: Math.min(...lows),
    };
  } catch {
    return null;
  }
}

/** Process tickers in batches to avoid Yahoo rate limiting */
async function fetchBatch(tickers: string[], batchSize = 8): Promise<(Range52 | null)[]> {
  const results: (Range52 | null)[] = [];
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetch52Week));
    results.push(...batchResults);
    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json() as { tickers: string[] };

    if (!tickers?.length) {
      return new Response(JSON.stringify({ error: "tickers required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await fetchBatch(tickers);

    const ranges: Record<string, { price: number; low52: number; high52: number }> = {};
    for (const r of results) {
      if (r) {
        ranges[r.ticker] = { price: r.price, low52: r.low52, high52: r.high52 };
      }
    }

    return new Response(JSON.stringify({ ranges }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-52week error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
