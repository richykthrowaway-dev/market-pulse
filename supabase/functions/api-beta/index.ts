import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-beta — Compute portfolio beta using Yahoo Finance 1-year daily prices.
 *
 * POST body: { tickers: string[], weights: number[] }
 * Response:  { betas: Record<string, number>, portfolioBeta: number,
 *              benchmark: "SPY", dataPoints: number,
 *              portfolioReturns: number[],  // weight-blended daily returns (NEW)
 *              spyReturns: number[],        // benchmark daily returns (NEW)
 *              dates: string[] }            // date stamps for each return (NEW)
 *
 * Fetches 1-year daily close prices for all tickers + SPY in parallel from
 * Yahoo Finance, then computes beta = Cov(stock, market) / Var(market) using
 * daily log returns. More accurate than pre-computed metrics.
 *
 * Also returns the weight-blended portfolio return series so the frontend
 * can derive VaR, max drawdown, Sharpe, etc. without another round-trip.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BENCHMARK = "SPY";
const RANGE = "1y";
const INTERVAL = "1d";

/** Fetch daily close prices + timestamps from Yahoo Finance v8 chart endpoint */
async function fetchCloses(ticker: string): Promise<{ closes: number[]; timestamps: number[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${RANGE}&interval=${INTERVAL}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BetaCalc/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const closes: (number | null)[] | undefined = result?.indicators?.quote?.[0]?.close;
    const timestamps: number[] | undefined = result?.timestamp;
    if (!closes || !timestamps) return null;
    // Filter out null closes and align timestamps
    const filteredCloses: number[] = [];
    const filteredTs: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] != null) {
        filteredCloses.push(closes[i] as number);
        filteredTs.push(timestamps[i]);
      }
    }
    return { closes: filteredCloses, timestamps: filteredTs };
  } catch {
    return null;
  }
}

/** Compute daily log returns from close prices */
function logReturns(closes: number[]): number[] {
  const r: number[] = new Array(closes.length - 1);
  for (let i = 1; i < closes.length; i++) {
    r[i - 1] = Math.log(closes[i] / closes[i - 1]);
  }
  return r;
}

/** Compute mean of array */
function mean(arr: number[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

/** Compute beta = Cov(stock, market) / Var(market) */
function computeBeta(stockReturns: number[], marketReturns: number[]): number {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 20) return 1.0;

  const sOff = stockReturns.length - n;
  const mOff = marketReturns.length - n;

  const sMean = mean(stockReturns.slice(sOff));
  const mMean = mean(marketReturns.slice(mOff));

  let cov = 0;
  let mVar = 0;
  for (let i = 0; i < n; i++) {
    const sd = stockReturns[sOff + i] - sMean;
    const md = marketReturns[mOff + i] - mMean;
    cov += sd * md;
    mVar += md * md;
  }

  if (mVar === 0) return 1.0;
  return cov / mVar;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers, weights } = await req.json() as {
      tickers: string[];
      weights: number[];
    };

    if (!tickers?.length) {
      return new Response(JSON.stringify({ error: "tickers required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch benchmark + all stock prices in parallel (one Yahoo call each)
    const allTickers = [BENCHMARK, ...tickers];
    const fetched = await Promise.all(allTickers.map(fetchCloses));

    const benchData = fetched[0];
    if (!benchData || benchData.closes.length < 30) {
      return new Response(
        JSON.stringify({ error: "Could not fetch benchmark data" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const marketReturns = logReturns(benchData.closes);
    // Date stamps for returns array (one shorter than closes)
    const benchDates = benchData.timestamps.slice(1).map(ts => {
      const d = new Date(ts * 1000);
      return d.toISOString().slice(0, 10);
    });

    const betas: Record<string, number> = {};
    let portfolioBeta = 0;

    // For portfolio returns: align each stock's returns to benchmark dates
    // by truncating to the shorter common-suffix length, then weight-blend.
    const stockReturnsByTicker: Record<string, number[]> = {};
    let minLen = marketReturns.length;

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const data = fetched[i + 1];
      let beta = 1.0;
      if (data && data.closes.length >= 30) {
        const stockRet = logReturns(data.closes);
        beta = computeBeta(stockRet, marketReturns);
        beta = Math.max(-2, Math.min(4, beta));
        stockReturnsByTicker[ticker] = stockRet;
        if (stockRet.length < minLen) minLen = stockRet.length;
      } else {
        stockReturnsByTicker[ticker] = [];
      }
      betas[ticker] = Math.round(beta * 1000) / 1000;
      const w = weights?.[i] ?? (1 / tickers.length);
      portfolioBeta += w * beta;
    }

    // Build weight-blended portfolio return series (right-aligned to common length)
    const portfolioReturns: number[] = new Array(minLen).fill(0);
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const stockRet = stockReturnsByTicker[ticker];
      if (!stockRet.length) continue;
      const w = weights?.[i] ?? (1 / tickers.length);
      const offset = stockRet.length - minLen;
      for (let j = 0; j < minLen; j++) {
        portfolioReturns[j] += w * stockRet[offset + j];
      }
    }

    // Truncate SPY returns + dates to same length
    const spyOffset = marketReturns.length - minLen;
    const spyReturns = marketReturns.slice(spyOffset);
    const dates = benchDates.slice(spyOffset);

    return new Response(
      JSON.stringify({
        betas,
        portfolioBeta: Math.round(portfolioBeta * 1000) / 1000,
        benchmark: BENCHMARK,
        dataPoints: marketReturns.length,
        portfolioReturns,
        spyReturns,
        dates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("api-beta error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
