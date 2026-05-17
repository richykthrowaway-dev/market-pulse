import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchYahooQuoteLive } from '@/services/yahooFinanceApi';

export interface LiveQuote {
  price: number | null;
  updatedAt: number;
}

/**
 * Poll live quotes for a set of symbols. One React Query per UNIQUE symbol
 * (keying dedups for free). Pauses when the tab is hidden; resumes on focus.
 * Empty input → zero requests. Write-free (safe for read-only mirrors).
 */
export function useLiveQuotes(
  symbols: string[],
  intervalMs: number,
): Record<string, LiveQuote> {
  const unique = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))),
    [symbols],
  );

  const results = useQueries({
    queries: unique.map((sym) => ({
      queryKey: ['live-quote', sym],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<LiveQuote> => ({
        price: await fetchYahooQuoteLive(sym, signal),
        updatedAt: Date.now(),
      }),
      refetchInterval: intervalMs,
      refetchIntervalInBackground: false,
      staleTime: Math.max(0, intervalMs - 5_000),
      gcTime: 60_000,
    })),
  });

  return useMemo(() => {
    const map: Record<string, LiveQuote> = {};
    unique.forEach((sym, i) => {
      const d = results[i]?.data;
      if (d) map[sym] = d;
    });
    return map;
  }, [unique, results]);
}
