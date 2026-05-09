import { useQuery } from "@tanstack/react-query";
import { getCountryIndices, type CountryIndex } from "@/data/countryIndices";

const YAHOO_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-yahoo`;
const YAHOO_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

/**
 * Live quote data for a country index.
 * Uses the api-yahoo edge function (Yahoo Finance v7/quote) which natively
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
 * Fetches all indices in parallel (N concurrent edge-fn calls, each cheap).
 * 30-min staleTime: index prices are end-of-day anyway, no value in refetching.
 */
export function useCountryIndices(iso2: string | null) {
  return useQuery({
    queryKey: ["country-indices", iso2],
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
            const params = new URLSearchParams({ endpoint: "quote", symbol: idx.symbol });
            const res = await fetch(`${YAHOO_FN_BASE}?${params}`, { headers: YAHOO_HEADERS });

            if (!res.ok) throw new Error(`api-yahoo quote ${res.status}`);

            // api-yahoo returns the raw Yahoo quote object or null
            const q = await res.json();
            if (!q) throw new Error("no quote data");

            const price         = q.regularMarketPrice          ?? null;
            const previousClose = q.regularMarketPreviousClose  ?? null;
            const change        = q.regularMarketChange         ?? null;
            const changePercent = q.regularMarketChangePercent  ?? null;
            const currency      = q.currency                    ?? null;

            return {
              ...idx,
              // Prefer Yahoo's display name if available
              name: q.shortName ?? q.longName ?? idx.name,
              price,
              previousClose,
              change,
              changePercent,
              currency,
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
