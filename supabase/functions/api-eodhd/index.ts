import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-eodhd — EODHD API proxy with sector write-through cache.
 *
 * Supported endpoints (via ?endpoint=):
 *   search       → /api/search/{query}  (uses ?query=, ?limit=)
 *   eod          → /api/eod/{symbol}
 *   fundamentals → /api/fundamentals/{symbol}
 *                  Also writes gics_sector/industry back to symbols table.
 *
 * The EODHD_API_KEY secret is never exposed to the client.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE = "https://eodhd.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("EODHD_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "eod";
  const symbol   = url.searchParams.get("symbol") ?? "";
  const query    = url.searchParams.get("query")  ?? "";
  const limit    = url.searchParams.get("limit")  ?? "10";
  const from     = url.searchParams.get("from")   ?? "";
  const to       = url.searchParams.get("to")     ?? "";

  // ── Search endpoint — does not require a symbol ──────────────────────────
  if (endpoint === "search") {
    if (!query) {
      return new Response(JSON.stringify({ error: "query param required for search" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const searchUrl = `${EODHD_BASE}/search/${encodeURIComponent(query)}?api_token=${apiKey}&limit=${limit}&fmt=json`;
      const upstream = await fetch(searchUrl);
      if (!upstream.ok) {
        const text = await upstream.text();
        return new Response(JSON.stringify({ error: `EODHD error ${upstream.status}`, detail: text.slice(0, 300) }), {
          status: upstream.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await upstream.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol param required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let eodhdPath: string;
    let extraParams = "";

    if (endpoint === "fundamentals") {
      eodhdPath = `/fundamentals/${symbol}`;
    } else {
      // Default: EOD historical
      eodhdPath = `/eod/${symbol}`;
      if (from) extraParams += `&from=${from}`;
      if (to)   extraParams += `&to=${to}`;
      extraParams += "&period=d";
    }

    const eodhdUrl = `${EODHD_BASE}${eodhdPath}?api_token=${apiKey}&fmt=json${extraParams}`;
    const upstream = await fetch(eodhdUrl);

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: `EODHD error ${upstream.status}`, detail: text.slice(0, 300) }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();

    // ── Write-through cache: persist GICS sector data to symbols table ──
    if (endpoint === "fundamentals" && data?.General) {
      const g = data.General;
      const gicsSector        = g.GicSector        || g.Sector        || null;
      const gicsIndustryGroup = g.GicGroup         || null;
      const gicsIndustry      = g.GicIndustry      || g.Industry      || null;
      const gicsSubIndustry   = g.GicSubIndustry   || null;
      const country           = g.CountryISO        || g.CountryName   || null;
      const canonicalTicker   = (g.Code || symbol.split(".")[0]).toUpperCase();

      if (gicsSector || country) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const update: Record<string, string | null> = {};
        if (gicsSector)        update.gics_sector         = gicsSector;
        if (gicsIndustryGroup) update.gics_industry_group = gicsIndustryGroup;
        if (gicsIndustry)      update.gics_industry       = gicsIndustry;
        if (gicsSubIndustry)   update.gics_sub_industry   = gicsSubIndustry;
        if (country)           update.country             = country;

        // Fire-and-forget — don't block the response
        supabase
          .from("symbols")
          .update(update)
          .eq("canonical_ticker", canonicalTicker)
          .then(({ error }) => {
            if (error) console.error(`symbols update failed for ${canonicalTicker}:`, error.message);
          });
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("api-eodhd error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
