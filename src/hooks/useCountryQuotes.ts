import { useQuery } from '@tanstack/react-query';
import { COUNTRY_META } from '@/data/countryMeta';

const YAHOO_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-yahoo`;
const YAHOO_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

export interface CountryQuote {
  symbol: string;
  /** Display ticker (e.g. "RY" for "RY.TO") */
  baseSymbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  exchange: string | null;
}

/**
 * Fetch live Yahoo Finance quotes for a country's curated major-company
 * tickers (`COUNTRY_META[iso2].newsTickers`).
 *
 * Why this hook exists:
 *   - The Supabase `useCountryStocks` fallback returns random small-caps
 *     for non-US countries (any ticker tagged with country=XX in the
 *     symbols table, regardless of size).
 *   - The EODHD screener is the ideal "top by market cap" source but is
 *     gated by a 2000-credit daily quota floor that's frequently hit.
 *   - Yahoo Finance via our `api-yahoo` edge function is free, unmetered,
 *     and accepts any Yahoo symbol (US ADRs as bare tickers, foreign
 *     listings with their suffix).
 *
 * COUNTRY_META.newsTickers is hand-curated — most entries are deliberately
 * chosen to be the country's biggest companies in their most-quoted form
 * (US ADRs where they exist, native exchange-suffixed otherwise). This
 * gives a reliable "Major Companies" list for every country, independent
 * of EODHD's daily quota.
 */
export function useCountryQuotes(iso2: string | null) {
  const meta = iso2 ? COUNTRY_META[iso2] : null;
  const tickers = meta?.newsTickers ?? [];

  return useQuery<CountryQuote[]>({
    queryKey: ['country-quotes', iso2, [...tickers].sort().join(',')],
    enabled: !!iso2 && tickers.length > 0,
    staleTime: 60 * 60_000,             // 60 min — one batch call per hour
    gcTime:    120 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CountryQuote[]> => {
      // Single batch call instead of N individual calls — collapses N browser→edge
      // round-trips into 1; the edge function fans out to Yahoo in parallel internally.
      const params = new URLSearchParams({
        endpoint: 'quotes',
        symbols:  tickers.join(','),
      });
      const res = await fetch(`${YAHOO_FN_BASE}?${params}`, {
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return [];
      const batch: Record<string, any> = await res.json();

      return tickers
        .map((ticker): CountryQuote | null => {
          const q = batch[ticker];
          if (!q || q.regularMarketPrice == null) return null;
          return {
            symbol:        ticker,
            baseSymbol:    ticker.split('.')[0],
            name:          q.shortName ?? q.longName ?? ticker,
            price:         q.regularMarketPrice,
            previousClose: q.previousClose,
            change:        q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            currency:      q.currency,
            exchange:      q.exchangeName,
          };
        })
        .filter((q): q is CountryQuote => q !== null);
    },
  });
}
