/**
 * Vercel Serverless Function — OpenSky Network proxy
 *
 * Why this proxy exists:
 *   The OpenSky REST API does not guarantee CORS headers on every response,
 *   so a direct browser fetch() is unreliable.  Routing through our own
 *   origin (/api/opensky) eliminates cross-origin restrictions entirely
 *   and keeps the API key (if any) out of the browser bundle.
 *
 * Rate-limit notes:
 *   Anonymous: 400 credits/day, 4 credits per global call → 100 calls/day.
 *   This function adds a 15-second server-side cache (Cache-Control) so
 *   multiple browser tabs share one upstream call per window.
 *
 * Auth (optional, 10× more credits):
 *   Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET in Vercel environment
 *   variables.  The function will obtain a Bearer token via the OpenID
 *   Connect token endpoint and forward it to OpenSky.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENSKY_URL   = 'https://opensky-network.org/api/states/all';
const TOKEN_URL     = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// ── Module-level token cache (survives warm function invocations) ─────────────
let cachedToken:     string | null = null;
let tokenExpiresAt:  number = 0; // ms

async function getBearerToken(): Promise<string | null> {
  const id     = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { access_token: string; expires_in: number };
    cachedToken    = json.access_token;
    tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1_000; // expire 60 s early
    return cachedToken;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Forward bounding-box params when present (reduces credit cost)
  const params = new URLSearchParams();
  for (const key of ['lamin', 'lomin', 'lamax', 'lomax']) {
    const v = req.query[key];
    if (typeof v === 'string') params.set(key, v);
  }
  const url = params.toString() ? `${OPENSKY_URL}?${params}` : OPENSKY_URL;

  const headers: HeadersInit = { 'User-Agent': 'market-pulse-app/1.0' };
  const token = await getBearerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const upstream = await fetch(url, { headers });

    if (upstream.status === 429) {
      return res
        .status(429)
        .json({ error: 'OpenSky daily credit limit reached. Try again tomorrow.' });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `OpenSky returned ${upstream.status}` });
    }

    const data = await upstream.json();

    // Cache for 15 s — OpenSky anonymous data refreshes every 10 s server-side.
    // Multiple browser tabs will reuse this Vercel cache instead of each
    // burning a separate credit.
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[opensky proxy] fetch failed:', err);
    return res.status(502).json({ error: 'Failed to reach OpenSky Network.' });
  }
}
