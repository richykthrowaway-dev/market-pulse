import { useQuery } from "@tanstack/react-query";
import { getCountryIndices, type CountryIndex } from "@/data/countryIndices";
import { fetchEodHistorical } from "@/services/eodhdApi";

/**
 * Live quote data for a country index.
 * Uses EODHD EOD bars via the api-eodhd edge function.
 */
export interface CountryIndexQuote extends CountryIndex {
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  /** True if the EODHD data couldn't be fetched (fallback display state) */
  unavailable: boolean;
}

/**
 * Fetch live (end-of-day) quotes for a country's major stock indices via EODHD.
 * Returns the last two daily bars to compute price change.
 *
 * ⚠️  Cost notes:
 *   - 1 EODHD credit per index (cheap individually, but multiplied by N indices)
 *   - **NO refetchInterval**: EOD bars only update once per trading day, so
 *     polling every 5 min was burning ~290 credits/tab/day for zero benefit.
 *   - **Tight `from` window**: only fetch 7 days of history (need last 2 bars
 *     to compute change %). Was previously fetching ~30 years per call.
 *   - 30-min staleTime: a user re-opening the same panel within 30 min hits
 *     cache instead of EODHD.
 */
export function useCountryIndices(iso2: string | null) {
  return useQuery({
    queryKey: ["country-indices", iso2],
    enabled: !!iso2,
    staleTime: 30 * 60_000,           // 30 min — EOD bars don't change intraday
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,      // never refetch on tab switch — cached EOD is fine
    queryFn: async (): Promise<CountryIndexQuote[]> => {
      if (!iso2) return [];
      const indices = getCountryIndices(iso2);
      if (indices.length === 0) return [];

      // Tight 7-day window to ensure we always get at least 2 bars even across
      // long weekends, while sending a tiny payload (vs 30 years of daily bars).
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const from = fmt(weekAgo);
      const to   = fmt(today);

      const quotes = await Promise.all(
        indices.map(async (idx): Promise<CountryIndexQuote> => {
          try {
            // Only fetch last week of bars — we just need the last 2 to compute change
            const bars = await fetchEodHistorical(idx.symbol, from, to);
            if (!bars || bars.length === 0) throw new Error("no bars");

            const last = bars[bars.length - 1];
            const prev = bars.length >= 2 ? bars[bars.length - 2] : null;

            const price         = last.adjusted_close ?? last.close ?? null;
            const previousClose = prev ? (prev.adjusted_close ?? prev.close) : null;
            const change        = price != null && previousClose != null ? price - previousClose : null;
            const changePercent = change != null && previousClose ? (change / previousClose) * 100 : null;

            return {
              ...idx,
              price,
              previousClose,
              change,
              changePercent,
              currency: null, // EODHD EOD bars don't include currency — use symbol's known currency
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
