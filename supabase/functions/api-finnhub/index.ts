import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-finnhub — Finnhub API proxy with sector write-through cache.
 *
 * Supported endpoints (via ?endpoint=):
 *   quote    → GET /quote?symbol=AAPL
 *   profile2 → GET /stock/profile2?symbol=AAPL
 *              Also writes gics_sector back to symbols table.
 *   search   → GET /search?q=apple
 *
 * The FINNHUB_API_KEY secret is never exposed to the client.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINNHUB_BASE = "https://finnhub.io/api/v1";

/**
 * Maps Finnhub's own industry taxonomy to canonical GICS sector names.
 * Finnhub uses values like "Consumer Cyclical", "Financial Services", etc.
 */
function normalizeFinnhubIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  const lower = industry.toLowerCase().trim();
  const MAP: Record<string, string> = {
    'technology':             'Information Technology',
    'information technology': 'Information Technology',
    'healthcare':             'Health Care',
    'health care':            'Health Care',
    'financial services':     'Financials',
    'financials':             'Financials',
    'finance':                'Financials',
    'consumer cyclical':      'Consumer Discretionary',
    'consumer discretionary': 'Consumer Discretionary',
    'consumer defensive':     'Consumer Staples',
    'consumer staples':       'Consumer Staples',
    'communication services': 'Communication Services',
    'telecommunications':     'Communication Services',
    'industrials':            'Industrials',
    'industrial':             'Industrials',
    'energy':                 'Energy',
    'utilities':              'Utilities',
    'real estate':            'Real Estate',
    'real estate investment trust (reit)': 'Real Estate',
    'materials':              'Materials',
    'basic materials':        'Materials',
  };
  return MAP[lower] ?? industry;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let apiKey = Deno.env.get("FINNHUB_API_KEY");
  console.log(`[api-finnhub] Env API key status: ${apiKey ? `present (${apiKey.length} chars)` : 'NOT SET'}`);

  // Fallback to hardcoded key for testing (temporary)
  if (!apiKey || apiKey.length < 40) {
    console.log("[api-finnhub] Using hardcoded API key for testing");
    apiKey = "d6hubv9r01qr5k4dbeo0d6hubv9r01qr5k4dbeog";
  }

  console.log(`[api-finnhub] Final API key: ${apiKey.slice(0, 10)}... (${apiKey.length} chars)`);

  const url      = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "quote";
  const symbol   = url.searchParams.get("symbol") ?? "";
  const query    = url.searchParams.get("query") ?? url.searchParams.get("q") ?? "";

  try {
    let finnhubUrl: string;

    if (endpoint === "profile2") {
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    } else if (endpoint === "quote") {
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    } else if (endpoint === "search") {
      const q = query || symbol;
      if (!q) {
        return new Response(JSON.stringify({ error: "query param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/search?q=${encodeURIComponent(q)}&token=${apiKey}`;
    } else if (endpoint === "basic-financials") {
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/stock/basic-financials?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`;
    } else if (endpoint === "recommendation") {
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    } else if (endpoint === "earnings") {
      if (!symbol) {
        return new Response(JSON.stringify({ error: "symbol param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finnhubUrl = `${FINNHUB_BASE}/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    } else if (endpoint === "calendar-earnings") {
      // Forward-looking earnings calendar. Optional `symbol` param filters
      // to a single ticker; without it Finnhub returns all companies in
      // the date range, which we filter client-side. `from` / `to` are
      // required and accept ISO YYYY-MM-DD.
      const from = url.searchParams.get("from") ?? "";
      const to   = url.searchParams.get("to")   ?? "";
      if (!from || !to) {
        return new Response(JSON.stringify({ error: "from and to params required (YYYY-MM-DD)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const symbolParam = symbol ? `&symbol=${encodeURIComponent(symbol)}` : "";
      finnhubUrl =
        `${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}${symbolParam}&token=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(finnhubUrl, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: `Finnhub error ${upstream.status}`, detail: text.slice(0, 300) }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();

    // ── Write-through cache: persist sector to symbols table ──
    if (endpoint === "profile2" && symbol && data?.finnhubIndustry) {
      const gicsSector = normalizeFinnhubIndustry(data.finnhubIndustry);
      const country    = data.country || null;
      const ticker     = (data.ticker || symbol).toUpperCase();

      if (gicsSector || country) {
        const supa = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const update: Record<string, string> = {};
        if (gicsSector) update.gics_sector = gicsSector;
        if (country)    update.country     = country;

        // Fire-and-forget — never block the response
        supa
          .from("symbols")
          .update(update)
          .eq("canonical_ticker", ticker)
          .then(({ error }) => {
            if (error) console.error(`symbols update failed for ${ticker}:`, error.message);
            else console.log(`Cached sector '${gicsSector}' for ${ticker}`);
          });
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("api-finnhub error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
