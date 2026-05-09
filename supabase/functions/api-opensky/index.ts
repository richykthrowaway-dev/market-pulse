/**
 * api-opensky — OpenSky Network proxy (Supabase Edge Function / Deno Deploy)
 *
 * Why Supabase instead of Vercel serverless:
 *   OpenSky blocks AWS/cloud-provider IPs at the network level.
 *   Supabase Edge Functions run on Cloudflare (not AWS), bypassing that block.
 *   All other external API proxies in this project use the same pattern.
 *
 * Rate limits:
 *   Anonymous: 400 credits/day. Global /states/all costs 4 credits → 100 calls/day.
 *   This function adds a 15-second server-side Cache-Control so multiple browser
 *   tabs share one upstream call per window.
 *
 * Auth (optional, 10× more credits):
 *   Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET in Supabase project secrets.
 *   The function obtains a Bearer token via OpenID Connect and forwards it.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENSKY_URL  = "https://opensky-network.org/api/states/all";
const TOKEN_URL    = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Module-level token cache (survives warm invocations on the same isolate)
let cachedToken:    string | null = null;
let tokenExpiresAt: number = 0;

async function getBearerToken(): Promise<string | null> {
  const id     = Deno.env.get("OPENSKY_CLIENT_ID");
  const secret = Deno.env.get("OPENSKY_CLIENT_SECRET");
  if (!id || !secret) return null;

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  try {
    const res = await fetch(TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     id,
        client_secret: secret,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { access_token: string; expires_in: number };
    cachedToken    = json.access_token;
    tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1_000;
    return cachedToken;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Forward optional bounding-box params (reduces credit cost to 1 when area ≤ 25 sq°)
  const incomingUrl = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of ["lamin", "lomin", "lamax", "lomax"]) {
    const v = incomingUrl.searchParams.get(key);
    if (v) params.set(key, v);
  }
  const upstreamUrl = params.toString()
    ? `${OPENSKY_URL}?${params}`
    : OPENSKY_URL;

  const headers: Record<string, string> = { "User-Agent": "market-pulse-app/1.0" };
  const token = await getBearerToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const upstream = await fetch(upstreamUrl, { headers });

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ error: "OpenSky daily credit limit reached. Try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `OpenSky returned ${upstream.status}` }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // 15-second CDN cache — multiple tabs share one upstream credit
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error("[api-opensky] fetch failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach OpenSky Network." }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
