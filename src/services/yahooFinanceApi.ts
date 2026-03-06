/**
 * Client-side service to fetch Yahoo Finance data via the api-yahoo-finance edge function.
 * Used for non-US stock fundamentals (currency, name, market data).
 */

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface YahooQuote {
  symbol: string;
  shortName: string;
  longName: string;
  currency: string | null;
  exchangeName: string | null;
  fullExchangeName: string | null;
  regularMarketPrice: number | null;
  previousClose: number | null;
  regularMarketVolume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

export async function fetchYahooQuote(
  symbol: string,
  exchange: string
): Promise<YahooQuote | null> {
  const qs = new URLSearchParams({ symbol, exchange }).toString();
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?${qs}`;

  const res = await fetch(url, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    console.warn(`Yahoo Finance API returned ${res.status} for ${symbol}.${exchange}`);
    await res.text(); // consume body
    return null;
  }

  return res.json();
}
