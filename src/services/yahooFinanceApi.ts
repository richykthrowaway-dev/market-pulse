/**
 * Client-side service to fetch Yahoo Finance data via the api-yahoo-finance edge function.
 * Used for non-US stock fundamentals (currency, name, market data).
 *
 * All public functions in this file are wrapped in `fetchCached` so:
 *   • Repeat calls within the TTL window come from localStorage (zero network)
 *   • Concurrent calls for the same symbol share one network request
 *   • Stale-but-valid data is served instantly while refreshing in background
 */

import { fetchCached } from "@/lib/apiCache";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * A normalized Yahoo Finance quote.
 *
 * All fields are sourced from Yahoo's v8/finance/chart `meta` object via the
 * `api-yahoo?endpoint=quote` proxy. v7/finance/quote and v10/quoteSummary have
 * been killed by Yahoo, so chart-meta is the only reliable source.
 *
 * Fundamentals fields (`marketCap`, `trailingPE`, etc.) are NOT available from
 * v8/chart and always come back as `null`. Use Finnhub, EODHD, or the Supabase
 * `stocks` table for those.
 */
export interface YahooQuote {
  symbol: string;
  shortName: string | null;
  longName: string | null;
  currency: string | null;
  exchangeName: string | null;
  fullExchangeName: string | null;
  regularMarketPrice: number | null;
  previousClose: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketVolume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /** Always null from v8/chart — use a fundamentals source if needed. */
  marketCap: null;
}

/**
 * Fetch a normalized quote for a Yahoo Finance symbol via the api-yahoo proxy.
 * The `exchange` arg is currently unused (kept for API compatibility) — exchange
 * suffixing should already be encoded in the `symbol` (e.g. `RY.TO`, `BP.L`).
 */
export async function fetchYahooQuote(
  symbol: string,
  exchange?: string
): Promise<YahooQuote | null> {
  void exchange; // reserved for future symbol-format normalisation
  return fetchCached(
    `yahoo:quote-v8:${symbol}`,
    async () => {
      const qs = new URLSearchParams({ endpoint: 'quote', symbol }).toString();
      const url = `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?${qs}`;
      const res = await fetch(url, {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      if (!res.ok) {
        console.warn(`Yahoo Finance API returned ${res.status} for ${symbol}`);
        await res.text();
        return null;
      }
      return res.json();
    },
    { ttlMs: 15 * 60_000 }, // 15 min — quotes are good enough for a fundamentals card
  );
}

/**
 * Fetch intraday close prices via the api-yahoo edge function → Yahoo Finance chart API.
 *
 * @param yahooTicker  Yahoo-format ticker: "AAPL", "RY.TO", "SCD.V", "LLOY.L" …
 * @param interval     Bar size — "1h" for intraday, "1d" for daily
 * @param range        How far back — "7d" | "1mo" | "3mo" | "6mo" | "1y"
 * @returns            Array of close prices, nulls filtered, adjclose preferred
 */
export async function fetchYahooIntraday(
  yahooTicker: string,
  interval: '1h' | '1d' = '1h',
  range: '7d' | '1mo' | '3mo' | '6mo' | '1y' = '1mo',
): Promise<number[]> {
  return fetchCached(
    `yahoo:intraday:${yahooTicker}:${interval}:${range}`,
    async () => {
      const qs = new URLSearchParams({
        endpoint: 'chart',
        symbol: yahooTicker,
        interval,
        range,
      }).toString();
      const url = `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?${qs}`;
      try {
        const res = await fetch(url, {
          headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          console.debug(`[Yahoo chart] ${yahooTicker} → ${res.status}`);
          return [];
        }
        const json: { closes?: number[] } = await res.json();
        return json.closes ?? [];
      } catch {
        return [];
      }
    },
    // 1h bars: 10min cache. 1d bars: 60min cache.
    { ttlMs: interval === '1h' ? 10 * 60_000 : 60 * 60_000 },
  );
}

/**
 * A single OHLCV bar from Yahoo Finance with a Unix timestamp.
 * `t` is seconds since epoch (UTC).
 */
export interface YahooBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/**
 * Fetch timestamped OHLCV bars from the api-yahoo edge function.
 *
 * Unlike `fetchYahooIntraday` (which returns only close prices), this
 * returns full OHLCV bars with Unix timestamps — suitable for rendering
 * hourly candlestick charts or area charts that need a time axis.
 *
 * @param yahooTicker  Yahoo-format ticker: "AAPL", "RY.TO", "LLOY.L"
 * @param interval     Bar size — "1h" or "1d"
 * @param range        Lookback — "7d" | "1mo" | "3mo" | "6mo" | "1y"
 */
export async function fetchYahooChart(
  yahooTicker: string,
  interval: '1h' | '1d' = '1h',
  range: '7d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'max' = '7d',
): Promise<YahooBar[]> {
  return fetchCached(
    `yahoo:chart:${yahooTicker}:${interval}:${range}`,
    async () => {
      const qs = new URLSearchParams({
        endpoint: 'chart',
        symbol: yahooTicker,
        interval,
        range,
      }).toString();
      const url = `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?${qs}`;
      try {
        const res = await fetch(url, {
          headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          console.debug(`[Yahoo chart bars] ${yahooTicker} → ${res.status}`);
          return [];
        }
        const json: { bars?: YahooBar[] } = await res.json();
        return json.bars ?? [];
      } catch {
        return [];
      }
    },
    { ttlMs: interval === '1h' ? 10 * 60_000 : 60 * 60_000 },
  );
}
