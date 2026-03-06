/**
 * Finnhub API client utility
 *
 * Calls the `api-finnhub` Edge Function (never Finnhub directly).
 * Includes client-side rate limiting to stay within API tier limits.
 */

export interface FinnhubQuote {
  /** Current price */
  c: number;
  /** Change */
  d: number;
  /** Percent change */
  dp: number;
  /** High price of the day */
  h: number;
  /** Low price of the day */
  l: number;
  /** Open price of the day */
  o: number;
  /** Previous close price */
  pc: number;
  /** Timestamp */
  t: number;
}

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

// Candle types and fetchFinnhubCandles removed — historical data now served by EODHD

/**
 * Client-side rate limiter (sliding window).
 * Finnhub free tier: 30 calls/second.
 */
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 30;
const callTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  // Remove timestamps outside the window
  while (callTimestamps.length > 0 && callTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= RATE_LIMIT_MAX) {
    const waitMs = callTimestamps[0] + RATE_LIMIT_WINDOW_MS - now + 10;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  callTimestamps.push(Date.now());
}

export interface FinnhubSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

function buildUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/api-finnhub?${qs}`;
}

function getHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function fetchJson<T>(params: Record<string, string>): Promise<T | null> {
  await waitForRateLimit();
  const res = await fetch(buildUrl(params), { headers: getHeaders() });

  if (!res.ok) {
    const body = await res.text();
    // Gracefully handle rate limits (429) and access denied (403)
    if (res.status === 429 || res.status === 403) {
      console.warn(`Finnhub ${params.endpoint} returned ${res.status} for ${params.symbol ?? params.query}: ${body}`);
      return null;
    }
    throw new Error(`Finnhub fetch failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Get real-time quote for a US stock symbol.
 */
export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  return fetchJson<FinnhubQuote>({ endpoint: "quote", symbol });
}

/**
 * Get company profile (name, market cap, industry, logo, etc).
 */
export async function fetchFinnhubProfile(symbol: string): Promise<FinnhubProfile | null> {
  return fetchJson<FinnhubProfile>({ endpoint: "profile2", symbol });
}

// fetchFinnhubCandles removed — historical data now served by EODHD

/**
 * Search for symbols by name or ticker.
 */
export async function fetchFinnhubSearch(query: string): Promise<{ count: number; result: FinnhubSearchResult[] } | null> {
  return fetchJson({ endpoint: "search", query });
}
