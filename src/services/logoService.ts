/**
 * Logo Service — multi-source logo fetching with serial queue + caching.
 *
 * Fallback chain (per ticker):
 * 1. localStorage cache (30-day TTL — instant on repeat visits)
 * 2. Finnhub profile2 edge function (serialized, 500ms between calls to avoid 429)
 * 3. null (caller shows Building2 icon)
 *
 * All Finnhub calls go through a single global serial queue so we never
 * fire 38 concurrent requests that exhaust the free-tier rate limit.
 */

const LOGO_CACHE_KEY = 'logo-cache-v1';
const QUEUE_DELAY_MS = 500; // 2 calls/sec — well under Finnhub 60/min free tier

interface LogoCacheEntry {
  url: string;
  source: 'logo.dev' | 'finnhub' | 'duckduckgo' | 'none';
  timestamp: number;
}

interface LogoCache {
  [ticker: string]: LogoCacheEntry;
}

export function getLogoCache(): LogoCache {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLogoCache(cache: LogoCache) {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save logo cache:', e);
  }
}

function saveSingleEntry(ticker: string, entry: LogoCacheEntry) {
  // Always read fresh before writing to avoid concurrent overwrites
  const fresh = getLogoCache();
  fresh[ticker] = entry;
  saveLogoCache(fresh);
}

// ── Serial fetch queue ────────────────────────────────────────────────────────

type QueueEntry = {
  ticker: string;
  callbacks: Array<(url: string | null) => void>;
};

const fetchQueue: QueueEntry[] = [];
let queueRunning = false;

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;

  while (fetchQueue.length > 0) {
    const entry = fetchQueue.shift()!;
    const { ticker, callbacks } = entry;

    // Re-check cache in case another component already fetched it
    const cached = getLogoCache()[ticker];
    if (cached?.url) {
      callbacks.forEach(cb => cb(cached.url));
      continue;
    }

    // Fetch from Finnhub
    const url = await fetchFinnhubLogo(ticker);
    if (url) {
      saveSingleEntry(ticker, { url, source: 'finnhub', timestamp: Date.now() });
    }
    callbacks.forEach(cb => cb(url));

    // Throttle between requests
    if (fetchQueue.length > 0) {
      await new Promise(r => setTimeout(r, QUEUE_DELAY_MS));
    }
  }

  queueRunning = false;
}

/**
 * Request a logo URL for the given ticker.
 * - Returns immediately from cache if available.
 * - Otherwise enqueues a serial Finnhub fetch and resolves when done.
 */
export function requestLogoUrl(ticker: string, callback: (url: string | null) => void): void {
  const cached = getLogoCache()[ticker];
  if (cached !== undefined) {
    // Cache hit (even if url is empty = confirmed no logo)
    callback(cached.url || null);
    return;
  }

  // Find existing queue entry for this ticker or create one
  const existing = fetchQueue.find(e => e.ticker === ticker);
  if (existing) {
    existing.callbacks.push(callback);
  } else {
    fetchQueue.push({ ticker, callbacks: [callback] });
  }

  runQueue();
}

// ── Finnhub fetcher ───────────────────────────────────────────────────────────

/**
 * Fetch company logo URL from Finnhub profile2 via the edge function proxy.
 */
export async function fetchFinnhubLogo(ticker: string): Promise<string | null> {
  try {
    const url = `/api/finnhub?endpoint=profile2&symbol=${encodeURIComponent(ticker)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      if (response.status !== 429 && response.status !== 403) {
        console.debug(`[Finnhub] ${ticker} → ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    return data.logo || null;
  } catch {
    return null;
  }
}

/**
 * Clear the logo cache (for testing or manual refresh).
 */
export function clearLogoCache(): void {
  try {
    localStorage.removeItem(LOGO_CACHE_KEY);
  } catch {
    // Silently fail
  }
}
