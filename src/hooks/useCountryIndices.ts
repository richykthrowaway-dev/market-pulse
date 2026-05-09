import { useQuery } from "@tanstack/react-query";
import { getCountryIndices, type CountryIndex } from "@/data/countryIndices";

const YAHOO_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-yahoo`;
const YAHOO_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

/**
 * Live quote data for a country index.
 * Uses the api-yahoo edge function (Yahoo Finance v8 chart) which natively
 * accepts Yahoo Finance symbols like ^GSPC, ^FTSE, ^GDAXI, etc.
 */
export interface CountryIndexQuote extends CountryIndex {
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  /** True if Yahoo Finance data couldn't be fetched */
  unavailable: boolean;
}

/**
 * Fetch live quotes for a country's major stock indices via Yahoo Finance.
 *
 * Symbols in countryIndices.ts are Yahoo Finance format (^GSPC, ^FTSE, etc.)
 * so this is a direct match — no symbol conversion needed.
 *
 * Uses the api-yahoo `perf` endpoint, which is built on Yahoo's v8/finance/chart
 * (more reliable than v7/quote — Yahoo has been progressively blocking v7).
 * `perf` returns { price, d1, w1, m1, m3 } where d1 is the 1-day change %.
 *
 * 30-min staleTime: index prices are end-of-day anyway, no value in refetching.
 */
export function useCountryIndices(iso2: string | null) {
  return useQuery({
    queryKey: ["country-indices-v2", iso2],
    enabled: !!iso2,
    staleTime: 30 * 60_000,           // 30 min — EOD data doesn't change intraday
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CountryIndexQuote[]> => {
      if (!iso2) return [];
      const indices = getCountryIndices(iso2);
      if (indices.length === 0) return [];

      const quotes = await Promise.all(
        indices.map(async (idx): Promise<CountryIndexQuote> => {
          try {
            const params = new URLSearchParams({ endpoint: "perf", symbol: idx.symbol });
            const res = await fetch(`${YAHOO_FN_BASE}?${params}`, { headers: YAHOO_HEADERS });

            if (!res.ok) throw new Error(`api-yahoo perf ${res.status}`);

            // perf returns { price, d1, w1, m1, m3 } where d1 = 1-day change %
            const p = await res.json();
            const price         = typeof p?.price === "number" ? p.price : null;
            const changePercent = typeof p?.d1    === "number" ? p.d1    : null;

            // Derive previousClose + change amount from price + d1 %
            const previousClose = price !== null && changePercent !== null
              ? price / (1 + changePercent / 100)
              : null;
            const change = price !== null && previousClose !== null
              ? price - previousClose
              : null;

            return {
              ...idx,
              price,
              previousClose,
              change,
              changePercent,
              currency: null,
              unavailable: price === null,
            };
          } catch {
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
        })
      );

      return quotes;
    },
  });
}
