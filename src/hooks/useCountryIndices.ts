import { useQuery } from "@tanstack/react-query";
import { getCountryIndices, type CountryIndex } from "@/data/countryIndices";

const YAHOO_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-yahoo`;
const YAHOO_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

/**
 * Live quote data for a country index.
 * Uses the api-yahoo `quote` endpoint, which is built on Yahoo's v8/finance/chart
 * (the only Yahoo endpoint that's still reliable — v7/quote and v10/quoteSummary
 * have been progressively killed).
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
 * 30-min staleTime: index prices are end-of-day anyway, no value in refetching.
 */
export function useCountryIndices(iso2: string | null) {
  return useQuery({
    // v3 = api-yahoo `quote` re-routed through v8/chart meta
    queryKey: ["country-indices-v3", iso2],
    enabled: !!iso2,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CountryIndexQuote[]> => {
      if (!iso2) return [];
      const indices = getCountryIndices(iso2);
      if (indices.length === 0) return [];

      const quotes = await Promise.all(
        indices.map(async (idx): Promise<CountryIndexQuote> => {
          try {
            const params = new URLSearchParams({ endpoint: "quote", symbol: idx.symbol });
            const res = await fetch(`${YAHOO_FN_BASE}?${params}`, { headers: YAHOO_HEADERS });

            if (!res.ok) throw new Error(`api-yahoo quote ${res.status}`);

            const q = await res.json();
            if (!q || q.regularMarketPrice == null) throw new Error("no quote data");

            return {
              ...idx,
              // Prefer Yahoo's display name when available
              name:           q.shortName ?? q.longName ?? idx.name,
              price:          q.regularMarketPrice,
              previousClose:  q.previousClose,
              change:         q.regularMarketChange,
              changePercent:  q.regularMarketChangePercent,
              currency:       q.currency ?? null,
              unavailable:    false,
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
