import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-fx-rates — Fetch all major FX rates in a SINGLE Yahoo Finance API call.
 *
 * Response: {
 *   rates: Record<string, { usdRate, marketRate, change, changePct, symbol }>,
 *   timestamp: number
 * }
 *
 * usdRate = units of currency per 1 USD (for cross-rate conversion)
 * marketRate = raw Yahoo market convention rate
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

const YF_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

// 19 major FX pairs
const PAIRS = [
  "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCAD=X", "AUDUSD=X",
  "USDCHF=X", "NZDUSD=X", "USDHKD=X", "USDCNY=X", "USDSGD=X",
  "USDSEK=X", "USDNOK=X", "USDDKK=X", "USDINR=X", "USDBRL=X",
  "USDMXN=X", "USDKRW=X", "USDZAR=X", "USDTRY=X",
];

// Pairs where Yahoo quote = "USD per 1 foreign unit" (need to invert)
const INVERTED = new Set(["EURUSD=X", "GBPUSD=X", "AUDUSD=X", "NZDUSD=X"]);

// ── Crumb cache (same approach as api-yahoo) ────────────────────────────────

let crumbCache: { crumb: string; cookie: string; expiry: number } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() < crumbCache.expiry) return crumbCache;

  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { ...YF_HEADERS, Accept: "text/plain" },
      });
      if (!res.ok) continue;

      const crumb = (await res.text()).trim();
      if (!crumb || crumb.length > 64 || crumb.startsWith("<")) continue;

      const raw = res.headers.get("set-cookie") ?? "";
      const m = raw.match(/\bA1=[^;]+/);
      const cookie = m ? m[0] : raw.split(";")[0];

      crumbCache = { crumb, cookie, expiry: Date.now() + 28 * 60_000 };
      return crumbCache;
    } catch { /* next host */ }
  }
  return null;
}

// ── Fetch all FX quotes ─────────────────────────────────────────────────────

async function fetchFxQuotes(): Promise<any[]> {
  const symbols = PAIRS.join(",");

  // Strategy 1: Try v7/finance/quote without crumb (works for some deployments)
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `${host}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
      const res = await fetch(url, {
        headers: YF_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error(`v7 no-crumb ${host}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const results = data?.quoteResponse?.result ?? [];
      if (results.length > 0) return results;
    } catch (e) {
      console.error(`v7 no-crumb ${host} error:`, e);
    }
  }

  // Strategy 2: Try v7 with crumb + cookie
  const auth = await getCrumb();
  if (auth) {
    for (const host of YAHOO_HOSTS) {
      try {
        const url = `${host}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(auth.crumb)}`;
        const res = await fetch(url, {
          headers: { ...YF_HEADERS, Cookie: auth.cookie },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 401) {
          crumbCache = null;
          continue;
        }
        if (!res.ok) {
          console.error(`v7 crumb ${host}: ${res.status}`);
          continue;
        }
        const data = await res.json();
        const results = data?.quoteResponse?.result ?? [];
        if (results.length > 0) return results;
      } catch (e) {
        console.error(`v7 crumb ${host} error:`, e);
      }
    }
  }

  // Strategy 3: Fallback to individual v8/finance/chart calls (parallel, 1 per pair)
  console.error("v7 failed, falling back to v8 chart per pair");
  const chartAuth = await getCrumb();
  const results: any[] = [];

  const fetchOne = async (pair: string): Promise<any | null> => {
    const crumbParam = chartAuth?.crumb ? `&crumb=${encodeURIComponent(chartAuth.crumb)}` : "";
    const cookieHdr = chartAuth?.cookie ? { Cookie: chartAuth.cookie } : {};

    for (const host of YAHOO_HOSTS) {
      try {
        const url = `${host}/v8/finance/chart/${encodeURIComponent(pair)}?interval=1d&range=2d&includePrePost=false${crumbParam}`;
        const res = await fetch(url, {
          headers: { ...YF_HEADERS, ...cookieHdr },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        return {
          symbol: pair,
          regularMarketPrice: meta.regularMarketPrice,
          regularMarketChange: meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice),
          regularMarketChangePercent: meta.chartPreviousClose
            ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
            : 0,
        };
      } catch { /* next host */ }
    }
    return null;
  };

  // Fetch all pairs in parallel
  const all = await Promise.all(PAIRS.map(fetchOne));
  for (const r of all) {
    if (r) results.push(r);
  }
  return results;
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const quotes = await fetchFxQuotes();

    const rates: Record<string, {
      usdRate: number;
      marketRate: number;
      change: number;
      changePct: number;
      symbol: string;
    }> = {};

    for (const q of quotes) {
      const sym: string = q.symbol;
      const price: number = q.regularMarketPrice;
      const change: number = q.regularMarketChange ?? 0;
      const changePct: number = q.regularMarketChangePercent ?? 0;

      if (!price || price <= 0) continue;

      const isInv = INVERTED.has(sym);
      const currency = isInv ? sym.slice(0, 3) : sym.slice(3, 6);

      rates[currency] = {
        usdRate: isInv ? 1 / price : price,
        marketRate: price,
        change,
        changePct,
        symbol: sym,
      };
    }

    rates["USD"] = { usdRate: 1, marketRate: 1, change: 0, changePct: 0, symbol: "USD" };

    return new Response(JSON.stringify({ rates, timestamp: Date.now() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-fx-rates error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
