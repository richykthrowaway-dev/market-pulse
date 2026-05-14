import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * api-eonet — Cached proxy for NASA EONET natural-event feeds.
 *
 * Why this exists:
 *   NASA's eonet.gsfc.nasa.gov endpoints take 500–2000 ms on cold requests
 *   and sit behind no CDN. Hitting them directly from the browser makes
 *   the natural-events layer toggles feel laggy.
 *
 * Cache strategy (three layers, fast → slow):
 *   1. In-memory cache (Map) inside this worker — sub-ms within the same
 *      Deno isolate. Supabase recycles isolates aggressively, so this
 *      only helps for back-to-back requests on the same warm worker.
 *   2. Postgres `edge_cache` table — persistent across all workers, all
 *      users, all regions. Lookup is ~30-80 ms (one indexed query).
 *      TTL: 15 min.
 *   3. NASA EONET upstream — 500-2000 ms cold, the slow path we're
 *      trying to avoid.
 *
 * Resilience:
 *   - If upstream EONET errors AND we have stale Postgres cache, we
 *     return stale data (clearly tagged with X-Cache: STALE-*).
 *   - Hard fail only when all three layers are unavailable.
 *
 * Allowed categories are whitelisted; days/limit are clamped server-side
 * to prevent abuse.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_CATEGORIES = new Set([
  "wildfires", "severeStorms", "volcanoes", "floods",
]);
const ALLOWED_STATUS = new Set(["open", "all", "closed"]);

const TTL_MS = 15 * 60 * 1000;          // 15 min — matches the frontend staleTime
const STALE_FALLBACK_MS = 24 * 60 * 60 * 1000; // up to 24h of stale data on upstream error

// ── In-memory layer ──────────────────────────────────────────────────────────
interface CacheEntry { data: unknown; ts: number; }
const MEM_CACHE = new Map<string, CacheEntry>();

// ── Supabase admin client (service role bypasses RLS on edge_cache) ──────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function readPgCache(key: string): Promise<{ data: unknown; fresh: boolean } | null> {
  const { data, error } = await db
    .from("edge_cache")
    .select("data, expires_at, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  const fresh = new Date(data.expires_at).getTime() > Date.now();
  // Don't return entries older than STALE_FALLBACK_MS even as stale fallback.
  const age = Date.now() - new Date(data.updated_at).getTime();
  if (!fresh && age > STALE_FALLBACK_MS) return null;
  return { data: data.data, fresh };
}

async function writePgCache(key: string, data: unknown) {
  // Fire-and-forget — we don't want to block the response on the cache write,
  // but we do want errors logged.
  db.from("edge_cache")
    .upsert({
      key,
      data,
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error("edge_cache upsert failed:", error.message);
    });
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ── Validate inputs ──────────────────────────────────────────────────
    const category = url.searchParams.get("category") ?? "wildfires";
    if (!ALLOWED_CATEGORIES.has(category)) {
      return jsonResponse({ error: `invalid category: ${category}` }, {}, 400);
    }
    const status = url.searchParams.get("status") ?? "open";
    if (!ALLOWED_STATUS.has(status)) {
      return jsonResponse({ error: `invalid status: ${status}` }, {}, 400);
    }
    const daysRaw  = parseInt(url.searchParams.get("days")  ?? "14", 10);
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "250", 10);
    const days  = isFinite(daysRaw)  ? clamp(daysRaw, 1, 365)  : 14;
    const limit = isFinite(limitRaw) ? clamp(limitRaw, 1, 500) : 250;

    const cacheKey = `eonet|${category}|${status}|${days}|${limit}`;

    // ── L1: in-memory cache ──────────────────────────────────────────────
    const mem = MEM_CACHE.get(cacheKey);
    if (mem && Date.now() - mem.ts < TTL_MS) {
      return jsonResponse(mem.data, {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache": "HIT-MEM",
        "X-Cache-Age": String(Math.floor((Date.now() - mem.ts) / 1000)),
      });
    }

    // ── L2: Postgres cache ───────────────────────────────────────────────
    const pg = await readPgCache(cacheKey);
    if (pg && pg.fresh) {
      MEM_CACHE.set(cacheKey, { data: pg.data, ts: Date.now() });
      return jsonResponse(pg.data, {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache": "HIT-PG",
      });
    }

    // ── L3: upstream EONET ───────────────────────────────────────────────
    const eonetUrl =
      `https://eonet.gsfc.nasa.gov/api/v3/events` +
      `?category=${encodeURIComponent(category)}` +
      `&status=${encodeURIComponent(status)}` +
      `&days=${days}` +
      `&limit=${limit}`;

    let upstream: Response;
    try {
      upstream = await fetch(eonetUrl, {
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "market-pulse/1.0 (cached proxy)" },
      });
    } catch (err) {
      // Network failure — fall back to stale PG cache if available.
      if (pg) {
        return jsonResponse(pg.data, {
          "X-Cache": "STALE-NETERR",
        });
      }
      throw err;
    }

    if (!upstream.ok) {
      // Upstream error — fall back to stale PG cache if available.
      if (pg) {
        return jsonResponse(pg.data, {
          "X-Cache": "STALE-UPSTREAM",
          "X-Upstream-Status": String(upstream.status),
        });
      }
      return jsonResponse({ error: `EONET upstream ${upstream.status}` }, {}, 502);
    }

    const data = await upstream.json();

    // Write through both cache layers. PG write is fire-and-forget so we
    // don't pay for the round trip on the response path.
    MEM_CACHE.set(cacheKey, { data, ts: Date.now() });
    writePgCache(cacheKey, data);

    return jsonResponse(data, {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      "X-Cache": "MISS",
    });
  } catch (err) {
    console.error("api-eonet error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "unknown error" },
      {},
      500,
    );
  }
});
