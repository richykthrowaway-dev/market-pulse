import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-eodhd — EODHD All-in-One API proxy
 *
 * All EODHD calls go through here so the API key is never exposed to the client.
 * The EODHD_API_KEY Supabase secret is the only credential needed.
 *
 * Supported ?endpoint= values:
 *   eod              → /api/eod/{symbol}              daily OHLCV bars
 *   intraday         → /api/intraday/{symbol}          intraday bars (replaces Yahoo)
 *   fundamentals     → /api/fundamentals/{symbol}      full fundamentals JSON
 *   news             → /api/financial-news             news + sentiment
 *   technical        → /api/technical/{symbol}         pre-calc indicators (RSI, MACD…)
 *   dividends        → /api/div/{symbol}               dividend history
 *   splits           → /api/splits/{symbol}            split history
 *   screener         → /api/screener                   filtered stock lists
 *   economic-events  → /api/economic-events            macro calendar
 *   insider          → /api/insider-transactions       SEC Form 4 insider trades
 *   options          → /api/options/{symbol}           options chain + Greeks
 *   search           → /api/search/{query}             ticker search
 *   bulk-eod         → /api/eod-bulk-last-day/{exchange} bulk EOD prices
 *   user             → /api/user                        plan tier + remaining quota
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE = "https://eodhd.com/api";

// ── Credit cost map ───────────────────────────────────────────────────────────
// Approximate EODHD credit cost per call. Use to predict & guardrail spend.
//   1   = standard endpoints (eod, dividends, splits, news, screener, search…)
//   5   = intraday bars
//   10  = full fundamentals (the 10× sneaky cost — MUST gate this)
//   100 = bulk-eod (returns the entire exchange in 1 call)
const ENDPOINT_COST: Record<string, number> = {
  eod:               1,
  intraday:          5,
  fundamentals:      10,
  news:              1,
  technical:         1,
  dividends:         1,
  splits:            1,
  screener:          1,
  "economic-events": 1,
  insider:           1,
  options:           1,
  search:            1,
  earnings:          1,
  "bulk-eod":        100,
  "macro-indicator": 1,
  user:              0,    // meta — free, never gate this
};

// Reserve this much daily quota as a "safety floor" — if remaining quota dips
// below this threshold, only free meta endpoints (user) are allowed through.
// Keeps the UI responsive (cached data still works) while preventing further burn.
const QUOTA_SAFETY_FLOOR = 2000;

// ── Server-side fundamentals cache ────────────────────────────────────
// The 10-credit /fundamentals endpoint is the single biggest quota burner
// in the app. We back it with a Postgres-backed shared cache (table
// `public.fundamentals_cache`) so the FIRST user to look up a ticker pays
// 10 credits and EVERY subsequent user within the TTL gets free reads,
// even across different browser sessions / devices / users.
//
// TTL: 24h. Fundamentals data updates quarterly so a day-long cache is
// well within the data's natural staleness. Was 12h client-side; bumped
// for the shared cache.
const FUNDAMENTALS_CACHE_TTL_HOURS = 24;

// In-memory quota cache shared across requests in this edge-fn instance.
// EODHD's /user endpoint is free, but we still don't want to call it on every
// request. Refresh at most once per minute. (Supabase edge fns are short-lived
// so this cache is naturally scoped to a single warm instance.)
let quotaCache: { remaining: number; checkedAt: number } | null = null;
const QUOTA_CACHE_TTL = 60_000;

async function getRemainingQuota(apiKey: string): Promise<number | null> {
  if (quotaCache && Date.now() - quotaCache.checkedAt < QUOTA_CACHE_TTL) {
    return quotaCache.remaining;
  }
  try {
    const res = await fetch(`${EODHD_BASE}/user?api_token=${apiKey}&fmt=json`);
    if (!res.ok) return null;
    const d = await res.json();
    const used  = typeof d.apiRequests   === "number" ? d.apiRequests   : 0;
    const limit = typeof d.dailyRateLimit === "number" ? d.dailyRateLimit : 100_000;
    const remaining = Math.max(0, limit - used);
    quotaCache = { remaining, checkedAt: Date.now() };
    return remaining;
  } catch {
    return null;
  }
}

// ── Generic EODHD fetch helper ────────────────────────────────────────────────

async function eodFetch(path: string, apiKey: string): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${EODHD_BASE}${path}${sep}api_token=${apiKey}&fmt=json`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("EODHD_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url      = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "eod";
  const symbol   = url.searchParams.get("symbol")   ?? "";
  const query    = url.searchParams.get("query")    ?? "";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const proxyError = (status: number, msg: string, detail = "") =>
    json({ error: msg, detail: detail.slice(0, 300) }, status);

  // ── Server-side fundamentals cache (BEFORE quota check) ─────────────
  // Critical ordering: the cache lookup runs BEFORE the quota guardrail.
  // A cache hit doesn't burn EODHD credits, so it should never be blocked
  // by the safety floor. Side benefit: when daily quota IS exhausted,
  // users can still view recently-cached tickers — the app degrades
  // gracefully instead of going dark.
  if (endpoint === "fundamentals" && symbol) {
    const tickerKey = symbol.toUpperCase();
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: cached } = await sb
        .from("fundamentals_cache")
        .select("payload, cached_at")
        .eq("ticker", tickerKey)
        .maybeSingle();

      if (cached?.payload && cached.cached_at) {
        const ageMs    = Date.now() - new Date(cached.cached_at).getTime();
        const ageHours = ageMs / 3_600_000;
        if (ageHours < FUNDAMENTALS_CACHE_TTL_HOURS) {
          console.log(`api-eodhd: fundamentals CACHE HIT for ${tickerKey} (age: ${ageHours.toFixed(1)}h)`);
          return json(cached.payload);
        }
        console.log(`api-eodhd: fundamentals cache STALE for ${tickerKey} (age: ${ageHours.toFixed(1)}h) — refetching`);
      }
    } catch (cacheErr) {
      console.error("fundamentals cache read error:", cacheErr);
      // Fall through to live fetch on any cache error — don't block the user
    }
  }

  // ── Quota guardrail ──────────────────────────────────────────────────────────
  // Block paid endpoints when we're near the daily floor. The /user endpoint
  // (and any other zero-cost endpoint) is always allowed through so the client
  // can still display quota status. The "force=1" query param bypasses the
  // guardrail for trusted server-to-server callers (ingest functions etc.).
  const cost   = ENDPOINT_COST[endpoint] ?? 1;
  const force  = url.searchParams.get("force") === "1";
  if (cost > 0 && !force) {
    const remaining = await getRemainingQuota(apiKey);
    if (remaining !== null && remaining < QUOTA_SAFETY_FLOOR) {
      return json({
        error:                "EODHD daily quota near limit — paid endpoints disabled",
        detail:               `Remaining: ${remaining}, floor: ${QUOTA_SAFETY_FLOOR}. Resets at UTC midnight.`,
        quotaRemaining:       remaining,
        quotaFloor:           QUOTA_SAFETY_FLOOR,
        endpoint,
        endpointCost:         cost,
      }, 429);
    }
    // Predictive block: if this single call would push us under the floor, refuse.
    if (remaining !== null && remaining - cost < QUOTA_SAFETY_FLOOR) {
      return json({
        error:                "EODHD call would breach quota floor — refused",
        detail:               `Remaining: ${remaining}, this call costs ${cost} credits.`,
        quotaRemaining:       remaining,
        quotaFloor:           QUOTA_SAFETY_FLOOR,
        endpoint,
        endpointCost:         cost,
      }, 429);
    }
  }

  try {

    // ── User / plan info ──────────────────────────────────────────────────────
    // Returns: { name, email, subscriptionType, apiRequests, apiRequestsDate, dailyRateLimit, ... }
    // Cost: 0 quota credits — meta endpoint, can be called at any time even when
    // the daily limit is exhausted. Use this to check what plan tier the account
    // is on and how much quota is left for the day.
    if (endpoint === "user") {
      const upstream = await eodFetch("/user", apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD user error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EOD historical bars ───────────────────────────────────────────────────
    if (endpoint === "eod") {
      if (!symbol) return proxyError(400, "symbol required");
      const from = url.searchParams.get("from") ?? "";
      const to   = url.searchParams.get("to")   ?? "";
      let path = `/eod/${encodeURIComponent(symbol)}?period=d`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD eod error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Intraday bars (replaces Yahoo hourly) ─────────────────────────────────
    // interval: 1m | 5m | 1h (default 1h)
    // from/to: unix timestamps or ISO dates
    if (endpoint === "intraday") {
      if (!symbol) return proxyError(400, "symbol required");
      const interval = url.searchParams.get("interval") ?? "1h";
      const from     = url.searchParams.get("from") ?? "";
      const to       = url.searchParams.get("to")   ?? "";
      let path = `/intraday/${encodeURIComponent(symbol)}?interval=${interval}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD intraday error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Full fundamentals ─────────────────────────────────────────────────────
    if (endpoint === "fundamentals") {
      if (!symbol) return proxyError(400, "symbol required");
      const upstream = await eodFetch(`/fundamentals/${encodeURIComponent(symbol)}`, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD fundamentals error", await upstream.text());
      const data = await upstream.json();
      const tickerKey = symbol.toUpperCase();

      // ── Write-through cache ──────────────────────────────────────────
      // Persist the full payload so subsequent users in the next 24h
      // can read for free. Fire-and-forget — don't make the user wait
      // on the upsert. Only cache valid payloads (must have a Code in
      // General, otherwise it's an error response or empty result).
      if (data?.General?.Code) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        sb.from("fundamentals_cache").upsert({
          ticker:    tickerKey,
          payload:   data,
          cached_at: new Date().toISOString(),
        }, { onConflict: "ticker" }).then(({ error }) => {
          if (error) console.error("fundamentals_cache write error:", error.message);
          else       console.log(`api-eodhd: fundamentals CACHE WRITE for ${tickerKey}`);
        });
      }

      // Write-through: persist GICS sector/country to symbols table
      if (data?.General) {
        const g = data.General;
        const canonicalTicker = (g.Code || symbol.split(".")[0]).toUpperCase();
        const update: Record<string, string | null> = {};
        if (g.GicSector   || g.Sector)   update.gics_sector         = g.GicSector   || g.Sector;
        if (g.GicGroup)                   update.gics_industry_group = g.GicGroup;
        if (g.GicIndustry || g.Industry)  update.gics_industry       = g.GicIndustry || g.Industry;
        if (g.GicSubIndustry)             update.gics_sub_industry   = g.GicSubIndustry;
        if (g.CountryISO  || g.CountryName) update.country           = g.CountryISO  || g.CountryName;

        if (Object.keys(update).length > 0) {
          const sb = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          sb.from("symbols").update(update).eq("canonical_ticker", canonicalTicker)
            .then(({ error }) => { if (error) console.error("symbols update error:", error.message); });
        }
      }

      return json(data);
    }

    // ── Financial news + sentiment ────────────────────────────────────────────
    // params: s (ticker, optional), t (tag, optional), limit, offset, from, to
    // The `t` param filters by news tag/topic (e.g. "merger", "earnings").
    // For country-level news, callers pass the country's primary index symbol
    // as `s` (e.g. s=FTSE.INDX for UK) — EODHD tags articles with tickers,
    // so index-tagged results are naturally country-scoped.
    if (endpoint === "news") {
      const s      = url.searchParams.get("s")      ?? symbol;
      const t      = url.searchParams.get("t")      ?? "";
      const limit  = url.searchParams.get("limit")  ?? "50";
      const offset = url.searchParams.get("offset") ?? "0";
      const from   = url.searchParams.get("from")   ?? "";
      const to     = url.searchParams.get("to")     ?? "";
      let path = `/financial-news?limit=${limit}&offset=${offset}`;
      if (s)    path += `&s=${encodeURIComponent(s)}`;
      if (t)    path += `&t=${encodeURIComponent(t)}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD news error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Technical indicators ──────────────────────────────────────────────────
    // function: sma | ema | rsi | macd | bbands | atr | cci | stochastic | adx
    // period: integer (default 14 for RSI, 20 for BBANDS etc.)
    if (endpoint === "technical") {
      if (!symbol) return proxyError(400, "symbol required");
      const fn     = url.searchParams.get("function") ?? "rsi";
      const period = url.searchParams.get("period")   ?? "14";
      const from   = url.searchParams.get("from")     ?? "";
      const to     = url.searchParams.get("to")       ?? "";
      const order  = url.searchParams.get("order")    ?? "a"; // a=ascending
      let path = `/technical/${encodeURIComponent(symbol)}?function=${fn}&period=${period}&order=${order}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD technical error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Dividend history ──────────────────────────────────────────────────────
    if (endpoint === "dividends") {
      if (!symbol) return proxyError(400, "symbol required");
      const from = url.searchParams.get("from") ?? "";
      const to   = url.searchParams.get("to")   ?? "";
      let path = `/div/${encodeURIComponent(symbol)}`;
      if (from || to) {
        path += `?`;
        if (from) path += `from=${from}`;
        if (from && to) path += `&`;
        if (to)   path += `to=${to}`;
      }
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD dividends error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Split history ─────────────────────────────────────────────────────────
    if (endpoint === "splits") {
      if (!symbol) return proxyError(400, "symbol required");
      const from = url.searchParams.get("from") ?? "";
      const to   = url.searchParams.get("to")   ?? "";
      let path = `/splits/${encodeURIComponent(symbol)}`;
      if (from || to) {
        path += `?`;
        if (from) path += `from=${from}`;
        if (from && to) path += `&`;
        if (to)   path += `to=${to}`;
      }
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD splits error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Stock screener ────────────────────────────────────────────────────────
    // filters: market_capitalization_more_than, pe_ratio_less_than, dividends_more_than, etc.
    // Pass all filter params through as-is from the client
    if (endpoint === "screener") {
      let path = `/screener?`;
      // Forward all query params except endpoint, apikey
      const SKIP = new Set(["endpoint", "apikey"]);
      for (const [k, v] of url.searchParams.entries()) {
        if (!SKIP.has(k)) path += `${encodeURIComponent(k)}=${encodeURIComponent(v)}&`;
      }
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD screener error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Economic events calendar ──────────────────────────────────────────────
    // country: ISO-2 (US, GB, EU…), from/to dates
    if (endpoint === "economic-events") {
      const country  = url.searchParams.get("country")  ?? "US";
      const from     = url.searchParams.get("from")     ?? "";
      const to       = url.searchParams.get("to")       ?? "";
      const limit    = url.searchParams.get("limit")    ?? "50";
      let path = `/economic-events?country=${country}&limit=${limit}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD economic-events error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insider transactions (SEC Form 4) ─────────────────────────────────────
    if (endpoint === "insider") {
      if (!symbol) return proxyError(400, "symbol required");
      const from  = url.searchParams.get("from")  ?? "";
      const to    = url.searchParams.get("to")    ?? "";
      const limit = url.searchParams.get("limit") ?? "50";
      let path = `/insider-transactions?code=${encodeURIComponent(symbol)}&limit=${limit}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD insider error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Options chain ─────────────────────────────────────────────────────────
    // from: expiration date filter (YYYY-MM-DD)
    if (endpoint === "options") {
      if (!symbol) return proxyError(400, "symbol required");
      const from = url.searchParams.get("from") ?? "";
      const to   = url.searchParams.get("to")   ?? "";
      let path = `/options/${encodeURIComponent(symbol)}`;
      if (from || to) {
        path += `?`;
        if (from) path += `from=${from}`;
        if (from && to) path += `&`;
        if (to)   path += `to=${to}`;
      }
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD options error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Search ────────────────────────────────────────────────────────────────
    if (endpoint === "search") {
      const q     = query || symbol;
      const limit = url.searchParams.get("limit") ?? "10";
      if (!q) return proxyError(400, "query or symbol required");
      const upstream = await eodFetch(
        `/search/${encodeURIComponent(q)}?limit=${limit}`, apiKey,
      );
      if (!upstream.ok) return proxyError(upstream.status, "EODHD search error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Earnings calendar ─────────────────────────────────────────────────────
    // symbols: comma-separated EODHD codes (e.g. "AAPL.US,MSFT.US,RY.TO")
    // from/to: ISO date strings — defaults to today → +90 days if omitted
    if (endpoint === "earnings") {
      const symbols = url.searchParams.get("symbols") ?? "";
      const today   = new Date().toISOString().split("T")[0];
      const d90     = new Date(Date.now() + 90 * 86_400_000).toISOString().split("T")[0];
      const from    = url.searchParams.get("from") ?? today;
      const to      = url.searchParams.get("to")   ?? d90;
      let path = `/calendar/earnings?from=${from}&to=${to}`;
      if (symbols) path += `&symbols=${encodeURIComponent(symbols)}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD earnings error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bulk EOD (used by ingest-eod-bulk) ────────────────────────────────────
    if (endpoint === "bulk-eod") {
      const exchange = url.searchParams.get("exchange") ?? "US";
      const date     = url.searchParams.get("date")     ?? "";
      let path = `/eod-bulk-last-day/${exchange}`;
      if (date) path += `?date=${date}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD bulk-eod error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Macro economic indicators ─────────────────────────────────────────────
    // country: ISO 3166-1 alpha-3 code (e.g. USA, GBR, DEU)
    // indicator: one of: gdp_growth_rate | inflation_consumer_prices_annual |
    //            unemployment_total_percent | real_interest_rate | gdp_current_usd
    // Returns array of { Date, Period, Value, CountryCode, Indicator } sorted oldest→newest.
    // Cost: 1 credit per indicator per call.
    if (endpoint === "macro-indicator") {
      const country   = url.searchParams.get("country")   ?? "USA";
      const indicator = url.searchParams.get("indicator") ?? "gdp_growth_rate";
      const from      = url.searchParams.get("from")      ?? "";
      const to        = url.searchParams.get("to")        ?? "";
      let path = `/macro-indicator/${encodeURIComponent(country)}?indicator=${indicator}`;
      if (from) path += `&from=${from}`;
      if (to)   path += `&to=${to}`;
      const upstream = await eodFetch(path, apiKey);
      if (!upstream.ok) return proxyError(upstream.status, "EODHD macro-indicator error", await upstream.text());
      return new Response(await upstream.text(), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return proxyError(400, `Unknown endpoint: ${endpoint}`);

  } catch (err) {
    console.error("api-eodhd error:", err);
    return json({ error: String(err) }, 500);
  }
});
