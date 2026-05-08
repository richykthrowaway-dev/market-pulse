// ── apiCache: localStorage-backed cache with stale-while-revalidate ─────────
// Three-tier cache strategy for all external API calls:
//
//   L1 — React Query in-memory (per-tab, cross-component, session-only)
//   L2 — localStorage (this file)        (per-browser, persists across reloads)
//   L3 — Network (Yahoo, Finnhub, etc.)
//
// L2 sits between React Query and the network. The first time a key is
// requested, we hit the network and persist the result. Every subsequent
// page-load returns the cached value instantly while a background refresh
// updates it. This is the same pattern used by monitor-the-situation.com.
//
// Key features:
//   • In-flight request deduplication: 3 components asking for the same
//     symbol at the same time → 1 network call, all 3 receive the same Promise.
//   • Stale-while-revalidate: a fresh-enough cache hit short-circuits.
//     A stale-but-valid hit returns immediately while triggering a refresh.
//     Past hard expiry, we wait for the network like usual.
//   • Lazy expiry sweep: expired entries are removed when read, no timers.
//   • Quota-safe: writes that exceed localStorage budget evict oldest first.
//   • Versioned: bump CACHE_VERSION to invalidate everything across all users.

const CACHE_VERSION = 1;
const STORAGE_PREFIX = `api-cache:v${CACHE_VERSION}:`;
// Cap how much of localStorage we use — 4MB leaves headroom for app state.
const STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

interface CacheEntry<T> {
  value: T;
  /** Unix ms when this entry was written. */
  ts: number;
  /** Hard expiry — past this we refuse to serve from cache. */
  expiry: number;
  /** Soft expiry — past this we serve stale + revalidate in background. */
  staleAfter: number;
}

export interface CacheOptions {
  /** Hard TTL (ms). Past this, the value is considered fully expired. */
  ttlMs: number;
  /**
   * Stale TTL (ms). Past this but before ttlMs, the value is served
   * immediately while a background refresh updates the cache. Defaults
   * to ttlMs / 3 (e.g. for ttlMs=5min → staleAfter 1m40s).
   */
  staleAfterMs?: number;
}

// Module-level Map of in-flight fetches keyed by cache key.
// Two simultaneous calls for the same key share the same Promise → 1 network req.
const inFlight = new Map<string, Promise<unknown>>();

function readEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    // Lazy expiry — if past hard TTL, drop and report miss.
    if (Date.now() > entry.expiry) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeEntry<T>(key: string, entry: CacheEntry<T>): void {
  const fullKey = STORAGE_PREFIX + key;
  const payload = JSON.stringify(entry);
  try {
    localStorage.setItem(fullKey, payload);
  } catch (err) {
    // QuotaExceededError — evict oldest entries until we fit.
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
      evictOldest();
      try { localStorage.setItem(fullKey, payload); } catch { /* give up */ }
    }
  }
}

/**
 * Evict the oldest 25% of api-cache entries to make room for new writes.
 * Sorted by `ts` (write timestamp). Cheap O(n) scan; runs only on quota errors.
 */
function evictOldest(): void {
  const entries: { key: string; ts: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key)!) as CacheEntry<unknown>;
      entries.push({ key, ts: entry.ts });
    } catch {
      // Corrupt entry — kill it
      localStorage.removeItem(key);
    }
  }
  entries.sort((a, b) => a.ts - b.ts);
  const toEvict = Math.max(1, Math.floor(entries.length * 0.25));
  for (let i = 0; i < toEvict; i++) {
    localStorage.removeItem(entries[i].key);
  }
}

/**
 * Wrap a fetcher with localStorage caching + in-flight deduplication +
 * stale-while-revalidate semantics.
 *
 * @param key      Stable cache key (e.g. "yahoo:quote:^GSPC")
 * @param fetcher  Function that performs the actual network call
 * @param options  TTL configuration
 *
 * @example
 *   const quote = await fetchCached(
 *     `yahoo:quote:${symbol}`,
 *     () => fetchYahooQuoteRaw(symbol),
 *     { ttlMs: 5 * 60_000 }  // 5 min hard TTL, ~100s stale
 *   );
 */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const ttlMs = options.ttlMs;
  const staleAfterMs = options.staleAfterMs ?? Math.max(30_000, Math.floor(ttlMs / 3));

  const cached = readEntry<T>(key);
  const now = Date.now();

  // Fresh hit → return immediately, no revalidation.
  if (cached && now < cached.staleAfter) {
    return cached.value;
  }

  // Stale-but-valid hit → return cached value, kick off background refresh.
  if (cached && now < cached.expiry) {
    void revalidate(key, fetcher, ttlMs, staleAfterMs);
    return cached.value;
  }

  // Cache miss or hard-expired → must wait for network.
  return await revalidate(key, fetcher, ttlMs, staleAfterMs);
}

async function revalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  staleAfterMs: number,
): Promise<T> {
  // In-flight dedup: if another call for this key is already running, await it.
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const value = await fetcher();
      const ts = Date.now();
      writeEntry<T>(key, {
        value,
        ts,
        staleAfter: ts + staleAfterMs,
        expiry: ts + ttlMs,
      });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Manually invalidate a single cache key. */
export function invalidateCache(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/** Drop all api-cache entries (e.g. on user logout, or for debugging). */
export function clearApiCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}

/**
 * Diagnostics: returns aggregate stats about the api-cache.
 * Useful for a debug overlay or developer console.
 */
export function getCacheStats(): {
  entries: number;
  bytes: number;
  oldestAge: number;
  newestAge: number;
  budgetUsedPct: number;
} {
  let entries = 0;
  let bytes = 0;
  let oldest = Infinity;
  let newest = 0;
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    entries++;
    bytes += key.length + raw.length;
    try {
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      const age = now - entry.ts;
      if (age < oldest) oldest = age;
      if (age > newest) newest = age;
    } catch { /* ignore */ }
  }
  return {
    entries,
    bytes,
    oldestAge: oldest === Infinity ? 0 : oldest,
    newestAge: newest,
    budgetUsedPct: (bytes / STORAGE_BUDGET_BYTES) * 100,
  };
}
