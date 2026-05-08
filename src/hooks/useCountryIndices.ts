import { useQuery } from "@tanstack/react-query";
import { getCountryIndices, type CountryIndex } from "@/data/countryIndices";
import { fetchCached } from "@/lib/apiCache";

/**
 * Live quote data for a country index.
 * Uses Yahoo Finance via the api-yahoo edge function (?endpoint=quote).
 */
export interface CountryIndexQuote extends CountryIndex {
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  /** True if the Yahoo quote couldn't be fetched (fallback display state) */
  unavailable: boolean;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string ?? "").trim();
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string ?? "").trim();

/** Fetch a single Yahoo quote via the api-yahoo edge function (endpoint=quote). */
async function fetchYahooQuoteRaw(symbol: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const url = new URL(`${SUPABASE_URL}/functions/v1/api-yahoo`);
  url.searchParams.set("endpoint", "quote");
  url.searchParams.set("symbol", symbol);

  try {
    const res = await fetch(url.toString(), {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch live quotes for a country's major stock indices.
 *
 * Uses the api-yahoo edge function with endpoint=quote, which returns Yahoo's
 * full quote object including regularMarketPrice, regularMarketChange,
 * regularMarketChangePercent, etc.
 *
 * All indices are fetched in parallel via Promise.all so the total latency
 * is one Yahoo round-trip regardless of how many indices a country has.
 */
export function useCountryIndices(iso2: string | null) {
  return useQuery({
    queryKey: ["country-indices", iso2],
    enabled: !!iso2,
    staleTime: 60_000,           // 1 min — index data is near real-time during market hours
    refetchInterval: 5 * 60_000, // refresh every 5 min while panel is open
    queryFn: async (): Promise<CountryIndexQuote[]> => {
      if (!iso2) return [];
      const indices = getCountryIndices(iso2);
      if (indices.length === 0) return [];

      // Fetch all indices in parallel — wrapped in fetchCached for L2 (localStorage)
      // caching, in-flight dedup, and stale-while-revalidate. 5-min hard TTL
      // means a hot index symbol is hit Yahoo at most 12 times per hour
      // PER BROWSER, regardless of how many components / countries reference it.
      const quotes = await Promise.all(
        indices.map(async (idx): Promise<CountryIndexQuote> => {
          const data = await fetchCached(
            `yahoo:quote:${idx.symbol}`,
            () => fetchYahooQuoteRaw(idx.symbol),
            { ttlMs: 5 * 60_000, staleAfterMs: 60_000 },
          );
          if (!data) {
            return {
              ...idx,
              price: null,
              previousClose: null,
              change: null,
              changePercent: null,
              currency: null,
              unavailable: true,
            };
          }
          const price = typeof data.regularMarketPrice === "number" ? data.regularMarketPrice : null;
          const prev  = typeof data.regularMarketPreviousClose === "number"
            ? data.regularMarketPreviousClose
            : (typeof data.previousClose === "number" ? data.previousClose : null);
          const change = typeof data.regularMarketChange === "number"
            ? data.regularMarketChange
            : (price !== null && prev !== null ? price - prev : null);
          const changePct = typeof data.regularMarketChangePercent === "number"
            ? data.regularMarketChangePercent
            : (price !== null && prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null);

          return {
            ...idx,
            price,
            previousClose: prev,
            change,
            changePercent: changePct,
            currency: data.currency ?? null,
            unavailable: price === null,
          };
        })
      );

      return quotes;
    },
  });
}
