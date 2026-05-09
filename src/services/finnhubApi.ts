/**
 * Finnhub API client utility
 *
 * Calls the `api-finnhub` Edge Function (never Finnhub directly).
 * Includes client-side rate limiting + L2 (localStorage) caching.
 */

import { fetchCached } from "@/lib/apiCache";

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

  const data = await res.json();
  // Finnhub sometimes returns HTTP 200 with {error: "..."} instead of a proper 4xx.
  // Treat these as null (same as a 429) so callers don't get a partial/error object.
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
    console.warn(`Finnhub ${params.endpoint} soft error for ${params.symbol ?? params.query}:`, (data as any).error);
    return null;
  }
  return data as T;
}

/**
 * Get real-time quote for a US stock symbol.
 * Cached for 2 minutes — quotes change continuously during market hours
 * but a 2-minute lag is acceptable for sparklines and watchlist tickers.
 */
export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  return fetchCached(
    `finnhub:quote:${symbol}`,
    () => fetchJson<FinnhubQuote>({ endpoint: "quote", symbol }),
    { ttlMs: 2 * 60_000, staleAfterMs: 30_000 },
  );
}

/**
 * Get company profile (name, market cap, industry, logo, etc).
 * Cached for 24h — profile data rarely changes.
 */
export async function fetchFinnhubProfile(symbol: string): Promise<FinnhubProfile | null> {
  return fetchCached(
    `finnhub:profile:${symbol}`,
    () => fetchJson<FinnhubProfile>({ endpoint: "profile2", symbol }),
    { ttlMs: 24 * 60 * 60_000 },
  );
}

// fetchFinnhubCandles removed — historical data now served by EODHD

/**
 * Search for symbols by name or ticker.
 * Cached for 1h per query — searches for the same query are identical.
 */
export async function fetchFinnhubSearch(query: string): Promise<{ count: number; result: FinnhubSearchResult[] } | null> {
  return fetchCached(
    `finnhub:search:${query.toLowerCase()}`,
    () => fetchJson<{ count: number; result: FinnhubSearchResult[] }>({ endpoint: "search", query }),
    { ttlMs: 60 * 60_000 },
  );
}

export interface FinnhubBasicFinancials {
  metric: {
    '52WeekHigh': number;
    '52WeekHighDate': string;
    '52WeekLow': number;
    '52WeekLowDate': string;
    beta: number;
    peNormalizedAnnual: number | null;
    peTTM: number | null;
    epsTTM: number | null;
    epsGrowthTTMYoy: number | null;
    dividendYieldIndicatedAnnual: number | null;
    revenueGrowthTTMYoy: number | null;
    roeTTM: number | null;
    debtEquityRatio: number | null;
    marketCapitalization: number | null;
    [key: string]: unknown;
  };
  metricType: string;
  symbol: string;
}

/**
 * Get basic financial metrics (52-week range, beta, P/E, EPS, etc).
 * Cached for 60 minutes, stale after 15 minutes.
 */
export async function fetchFinnhubBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
  return fetchCached(
    `finnhub:basic-financials:${symbol}`,
    () => fetchJson<FinnhubBasicFinancials>({ endpoint: "basic-financials", symbol }),
    { ttlMs: 60 * 60_000, staleAfterMs: 15 * 60_000 },
  );
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;       // e.g. "2024-03-01"
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

/**
 * Get analyst buy/hold/sell recommendations history.
 * Cached for 24h — analyst consensus changes infrequently.
 */
export async function fetchFinnhubRecommendations(symbol: string): Promise<FinnhubRecommendation[] | null> {
  return fetchCached(
    `finnhub:recommendation:${symbol}`,
    () => fetchJson<FinnhubRecommendation[]>({ endpoint: "recommendation", symbol }),
    { ttlMs: 24 * 60 * 60_000 },
  );
}

export interface FinnhubEarning {
  actual: number | null;
  estimate: number | null;
  period: string;         // e.g. "2024-03-31"
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

/**
 * Get EPS beat/miss history (earnings surprises).
 * Cached for 24h — historical earnings data is static.
 */
export async function fetchFinnhubEarnings(symbol: string): Promise<FinnhubEarning[] | null> {
  return fetchCached(
    `finnhub:earnings:${symbol}`,
    () => fetchJson<FinnhubEarning[]>({ endpoint: "earnings", symbol }),
    { ttlMs: 24 * 60 * 60_000 },
  );
}
