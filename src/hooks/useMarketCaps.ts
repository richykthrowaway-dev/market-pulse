import { useQuery } from '@tanstack/react-query';

/**
 * Batch-fetch market capitalisation for an array of tickers.
 * Returns Record<ticker, marketCapInDollars>.
 * Stale time: 1 hour (market cap moves slowly).
 */
export function useMarketCaps(tickers: string[]) {
  const key = tickers.slice().sort().join(',');

  return useQuery<Record<string, number>>({
    queryKey: ['market-caps', key],
    queryFn: async () => {
      if (tickers.length === 0) return {};

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-market-caps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ tickers }),
        }
      );

      if (!res.ok) {
        console.warn('api-market-caps failed:', res.status);
        return {};
      }

      const data: Record<string, number | null> = await res.json();
      // Strip nulls
      const out: Record<string, number> = {};
      for (const [t, v] of Object.entries(data)) {
        if (typeof v === 'number') out[t] = v;
      }
      return out;
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  });
}
