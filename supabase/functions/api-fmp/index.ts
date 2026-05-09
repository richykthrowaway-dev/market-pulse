import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-fmp — Financial Modeling Prep proxy
 *
 * Used as a free, comprehensive fallback for ticker classification when
 * EODHD is rate-limited or doesn't have a ticker. FMP's free tier covers
 * ~30K US-listed stocks with sector + industry tags.
 *
 * Why this proxy exists separate from api-eodhd:
 *   - Different API key (FMP_API_KEY in Supabase secrets, mirrored from
 *     VITE_FMP_KEY in .env for dev)
 *   - Different rate limits (FMP free = 250 req/day, paid = unlimited)
 *   - Smaller payload (~1KB profile vs ~500KB EODHD fundamentals)
 *
 * Supported ?endpoint= values:
 *   profile  → /stable/profile?symbol={SYMBOL}  company profile w/ sector + industry
 *
 * Side effect:
 *   When the symbol resolves to a known FMP industry, the edge fn maps it
 *   to a GICS sub-industry and writes both to the symbols table — so the
 *   second portfolio load hits the DB cache without any FMP call at all.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FMP_BASE = "https://financialmodelingprep.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Use FMP_API_KEY secret first; fall back to anon-public VITE_FMP_KEY for dev
  const apiKey = Deno.env.get("FMP_API_KEY") ?? Deno.env.get("VITE_FMP_KEY");
  if (!apiKey) {
    return json(500, { error: "FMP_API_KEY not configured" });
  }

  const url      = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "profile";
  const symbol   = url.searchParams.get("symbol")   ?? "";

  if (!symbol) return json(400, { error: "symbol required" });

  if (endpoint === "profile") {
    const fmpUrl = `${FMP_BASE}/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    let res: Response;
    try {
      res = await fetch(fmpUrl, { signal: AbortSignal.timeout(8000) });
    } catch (e) {
      return json(502, { error: `FMP fetch failed: ${(e as Error).message}` });
    }
    if (!res.ok) {
      return json(res.status, { error: `FMP HTTP ${res.status}`, detail: (await res.text()).slice(0, 300) });
    }

    let payload: unknown;
    try { payload = await res.json(); }
    catch { return json(502, { error: "FMP non-JSON response" }); }

    // FMP returns an array; first element is the profile (or empty if not found)
    const arr  = Array.isArray(payload) ? payload : [];
    const prof = arr[0] as Record<string, unknown> | undefined;

    // Side effect: write-through cache the sector/industry to symbols table.
    // The FMP→GICS sub-industry mapping happens client-side (in sectorMap.ts)
    // so we only persist the raw FMP strings here — the client translates.
    if (prof) {
      const ticker  = String(prof.symbol || symbol).toUpperCase().split(".")[0];
      const sector  = String(prof.sector   || "");
      const industry= String(prof.industry || "");
      const country = String(prof.country  || "");

      const update: Record<string, string | null> = {};
      if (sector)   update.gics_sector    = sector;     // FMP's sector ≠ GICS but normalizeSector translates
      if (industry) update.gics_industry  = industry;   // raw FMP industry; client maps to GICS sub-industry
      if (country)  update.country        = country;

      if (Object.keys(update).length > 0) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        sb.from("symbols").update(update).eq("canonical_ticker", ticker)
          .then(({ error }) => { if (error) console.error("symbols update error:", error.message); });
      }
    }

    return json(200, { profile: prof ?? null });
  }

  return json(400, { error: `unknown endpoint: ${endpoint}` });
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
