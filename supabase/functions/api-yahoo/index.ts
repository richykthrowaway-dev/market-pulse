import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-yahoo — Yahoo Finance proxy with crumb-based auth.
 *
 * Yahoo Finance's v8 chart API requires a crumb token obtained via a
 * two-step auth flow. Without it all requests return 401.
 *
 * Auth flow (per Yahoo Finance requirements circa 2024):
 *   1. GET /v1/test/getcrumb  → plain-text crumb + sets A1 session cookie
 *   2. GET /v8/finance/chart/{symbol}?...&crumb={crumb}  with Cookie header
 *
 * The crumb+cookie pair is cached at module level (persists across warm
 * Deno invocations) and refreshed on 401 or after 30 minutes.
 *
 * Endpoints (via ?endpoint=):
 *   chart  → Yahoo Finance v8/finance/chart/{symbol}
 *            Returns { closes: number[] } — nulls filtered, adjclose preferred.
 *            Params: symbol (required), interval (default "1h"), range (default "1mo")
 *
 *   quote  → Yahoo Finance v7/finance/quote?symbols={symbol}
 *            Returns raw Yahoo quote JSON.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

// ── Crumb cache (module-level — persists between warm invocations) ────────────

interface CrumbCache {
  crumb: string;
  cookie: string;
  expiry: number; // unix ms
}

let crumbCache: CrumbCache | null = null;

async function fetchCrumb(): Promise<CrumbCache | null> {
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { ...YF_HEADERS, "Accept": "text/plain, */*" },
      });

      if (!res.ok) continue;

      const crumb = (await res.text()).trim();

      // A valid crumb is a short alphanumeric/punctuation string (not an HTML page)
      if (!crumb || crumb.length > 64 || crumb.startsWith("<")) continue;

      // Extract the A1 session cookie — required alongside the crumb
      const rawCookie = res.headers.get("set-cookie") ?? "";
      // Pull just the A1=... value; ignore Expires/Path/etc. attributes
      const a1Match  = rawCookie.match(/\bA1=[^;]+/);
      const cookie   = a1Match ? a1Match[0] : rawCookie.split(";")[0];

      // 22-min TTL: Yahoo's actual crumb lifetime is ~30min, but we expire
      // pre-emptively so requests near the boundary get a fresh crumb on
      // their first attempt instead of paying the 401 + retry round trip.
      return { crumb, cookie, expiry: Date.now() + 22 * 60 * 1000 };
    } catch {
      // Try next host
    }
  }
  return null;
}

async function getCrumb(): Promise<CrumbCache | null> {
  if (crumbCache && Date.now() < crumbCache.expiry) return crumbCache;
  crumbCache = await fetchCrumb();
  return crumbCache;
}

// ── Chart fetch (with automatic crumb refresh on 401) ────────────────────────

async function fetchChart(symbol: string, interval: string, range: string): Promise<Response | null> {
  const auth = await getCrumb();

  for (let attempt = 0; attempt < 2; attempt++) {
    const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
    const cookieHdr  = auth?.cookie ? { "Cookie": auth.cookie } : {};

    const chartPath = `/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${interval}&range=${range}&includePrePost=false${crumbParam}`;

    for (const host of YAHOO_HOSTS) {
      try {
        const res = await fetch(`${host}${chartPath}`, {
          headers: { ...YF_HEADERS, ...cookieHdr },
        });

        if (res.status === 401 && attempt === 0) {
          // Crumb expired — force-refresh and retry
          crumbCache = null;
          const fresh = await getCrumb();
          if (!fresh) return null;
          Object.assign(auth ?? {}, fresh); // update for retry loop
          break; // break inner host loop to retry outer attempt loop
        }

        if (res.ok) return res;
      } catch {
        // Try next host
      }
    }
  }

  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url      = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "chart";
  const symbol   = url.searchParams.get("symbol")   ?? "";
  const interval = url.searchParams.get("interval") ?? "1h";
  const range    = url.searchParams.get("range")    ?? "1mo";

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol param required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Chart endpoint ────────────────────────────────────────────────────────
    if (endpoint === "chart") {
      const upstream = await fetchChart(symbol, interval, range);

      if (!upstream) {
        return new Response(JSON.stringify({ closes: [], error: "Yahoo Finance unavailable" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data   = await upstream.json();
      const result = data?.chart?.result?.[0];

      if (!result) {
        return new Response(JSON.stringify({ closes: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prefer adjclose (handles stock splits correctly)
      const rawCloses: (number | null)[] =
        result.indicators?.adjclose?.[0]?.adjclose ??
        result.indicators?.quote?.[0]?.close       ??
        [];

      // Strip nulls (market gaps, pre/post-market holes)
      const closes = rawCloses.filter((v): v is number => v != null && isFinite(v));

      // Build timestamped OHLCV bars for charts that need full candle data.
      // Backwards-compatible: `closes` is still returned for sparklines.
      const timestamps: number[] = result.timestamp ?? [];
      const quote = result.indicators?.quote?.[0] ?? {};
      const bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
      for (let i = 0; i < timestamps.length; i++) {
        const c = rawCloses[i];
        if (c == null || !isFinite(c)) continue;
        bars.push({
          t: timestamps[i],
          o: quote.open?.[i]   ?? c,
          h: quote.high?.[i]   ?? c,
          l: quote.low?.[i]    ?? c,
          c,
          v: quote.volume?.[i] ?? 0,
        });
      }

      return new Response(JSON.stringify({ closes, bars }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Quote endpoint ────────────────────────────────────────────────────────
    // Yahoo now requires crumb auth here too, so we use the same retry-on-401 flow as chart.
    if (endpoint === "quote") {
      const auth = await getCrumb();

      for (let attempt = 0; attempt < 2; attempt++) {
        const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
        const cookieHdr  = auth?.cookie ? { "Cookie": auth.cookie } : {};

        for (const host of YAHOO_HOSTS) {
          try {
            const res = await fetch(
              `${host}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}${crumbParam}`,
              { headers: { ...YF_HEADERS, ...cookieHdr } },
            );

            if (res.status === 401 && attempt === 0) {
              crumbCache = null;
              const fresh = await getCrumb();
              if (fresh) Object.assign(auth ?? {}, fresh);
              break; // retry outer attempt loop
            }

            if (!res.ok) continue;
            const data  = await res.json();
            const quote = data?.quoteResponse?.result?.[0] ?? null;
            return new Response(JSON.stringify(quote), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch { /* try next host */ }
        }
      }

      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Quote Summary endpoint (richer fundamentals) ─────────────────────────
    // Returns pre-flattened fundamentals: PE, EPS, beta, 52W range, dividend yield, market cap.
    // Uses Yahoo's /v10/finance/quoteSummary which supports the `modules` param.
    if (endpoint === "quoteSummary") {
      const modules = url.searchParams.get("modules") ?? "summaryDetail,defaultKeyStatistics,price,financialData";
      const auth = await getCrumb();

      for (let attempt = 0; attempt < 2; attempt++) {
        const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
        const cookieHdr  = auth?.cookie ? { "Cookie": auth.cookie } : {};

        for (const host of YAHOO_HOSTS) {
          try {
            const res = await fetch(
              `${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules)}${crumbParam}`,
              { headers: { ...YF_HEADERS, ...cookieHdr } },
            );

            if (res.status === 401 && attempt === 0) {
              crumbCache = null;
              const fresh = await getCrumb();
              if (fresh) Object.assign(auth ?? {}, fresh);
              break;
            }

            if (!res.ok) continue;
            const data   = await res.json();
            const result = data?.quoteSummary?.result?.[0] ?? null;
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch { /* try next host */ }
        }
      }

      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Perf endpoint — price + 1D/1W/1M/3M % changes ───────────────────────
    // Returns { price, d1, w1, m1, m3 } — all pct values, null on missing data.
    // Fetches 3-month daily adjclose (covers ~63 trading days, enough for 3M).
    if (endpoint === "perf") {
      const upstream = await fetchChart(symbol, "1d", "3mo");

      const emptyPerf = { price: null, d1: null, w1: null, m1: null, m3: null };
      if (!upstream) {
        return new Response(JSON.stringify(emptyPerf), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data   = await upstream.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        return new Response(JSON.stringify(emptyPerf), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prefer adjclose (handles splits), fall back to close
      const rawCloses: (number | null)[] =
        result.indicators?.adjclose?.[0]?.adjclose ??
        result.indicators?.quote?.[0]?.close       ??
        [];
      const closes = rawCloses.filter((v): v is number => v != null && isFinite(v));

      const n = closes.length;
      if (n < 2) {
        return new Response(JSON.stringify(emptyPerf), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pct = (curr: number, prev: number | undefined) =>
        prev == null || prev === 0 ? null : Math.round(((curr / prev) - 1) * 10000) / 100;

      const last = closes[n - 1];
      const price = result.meta?.regularMarketPrice ?? last;

      return new Response(JSON.stringify({
        price,
        d1: pct(last, closes[n - 2]),
        w1: pct(last, closes[Math.max(0, n - 6)]),
        m1: pct(last, closes[Math.max(0, n - 22)]),
        m3: pct(last, closes[0]),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("api-yahoo error:", err);
    return new Response(JSON.stringify({ error: String(err), closes: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
