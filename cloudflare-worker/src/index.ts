/**
 * OpenSky proxy — Cloudflare Worker
 * ──────────────────────────────────────────────────────────────────────
 * Why this Worker exists
 *   OpenSky's REST API is the single best free global flight feed
 *   (~12,000 airborne aircraft worldwide).  Two layers of defence stop
 *   us from calling it directly from the Market Pulse app:
 *
 *     1. CORS — the API responds with `Access-Control-Allow-Origin:
 *        https://opensky-network.org`, locked to their own origin, so
 *        a direct browser fetch is blocked.
 *     2. Cloud-IP block — OpenSky drops connections from AWS, Azure,
 *        GCP and the major cloud-edge providers (Vercel, Supabase
 *        Edge, Render, Fly).  We confirmed Vercel and Supabase Edge
 *        both fail at the TCP level with 60 s timeouts.
 *
 *   Cloudflare Workers run on Cloudflare's anycast network — an IP
 *   range OpenSky does NOT block.  This Worker is a pinhole for the
 *   browser to reach OpenSky through.
 *
 * Endpoint
 *   GET /              → forwards to /api/states/all
 *   GET /?lamin=…      → forwards bbox params (lamin/lomin/lamax/lomax)
 *
 * Auth (optional but recommended)
 *   Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET in Worker env vars
 *   (`wrangler secret put OPENSKY_CLIENT_ID`) for the 4,000-credit/day
 *   authenticated tier.  Without auth: 400 credits/day, plenty for
 *   personal use thanks to Cloudflare's edge cache below.
 *
 * Caching
 *   `Cache-Control: s-maxage=10` plus the `cf.cacheEverything` hint
 *   tells Cloudflare to cache the response at the edge for 10 s.
 *   Every Market Pulse user worldwide hits their nearest CF POP and
 *   shares one upstream OpenSky call per 10 s window — so 100 users
 *   browsing the live-flights layer cost the same 6 calls/min as one
 *   user.  This is the magic that makes a 400-credit budget work.
 */

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const TOKEN_URL   = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

interface Env {
  OPENSKY_CLIENT_ID?:     string;
  OPENSKY_CLIENT_SECRET?: string;
}

// Module-level token cache — survives between requests on a warm isolate.
let cachedToken:    string | null = null;
let tokenExpiresAt: number        = 0;

async function getBearerToken(env: Env): Promise<string | null> {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) return null;
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  try {
    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     env.OPENSKY_CLIENT_ID,
        client_secret: env.OPENSKY_CLIENT_SECRET,
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

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
} as const;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Forward optional bbox params (reduces credit cost from 4 → 1 when area ≤ 25 sq°)
    const incoming = new URL(req.url);
    const params   = new URLSearchParams();
    for (const k of ['lamin', 'lomin', 'lamax', 'lomax']) {
      const v = incoming.searchParams.get(k);
      if (v) params.set(k, v);
    }
    const upstream = params.toString() ? `${OPENSKY_URL}?${params}` : OPENSKY_URL;

    const headers: Record<string, string> = { 'User-Agent': 'market-pulse/1.0 (+cloudflare-worker)' };
    const token = await getBearerToken(env);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const r = await fetch(upstream, {
        headers,
        cf: { cacheTtl: 10, cacheEverything: true } as any,
      });

      // Bubble up rate-limit and other non-OK statuses with friendly bodies
      if (r.status === 429) {
        return new Response(
          JSON.stringify({ error: 'OpenSky daily credit limit reached.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (!r.ok) {
        return new Response(
          JSON.stringify({ error: `OpenSky returned ${r.status}` }),
          { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Stream OpenSky's JSON straight through with permissive CORS + edge cache
      return new Response(r.body, {
        status:  200,
        headers: {
          ...corsHeaders,
          'Content-Type':  'application/json',
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to reach OpenSky.', detail: String(err) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  },
};
