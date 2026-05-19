import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { fetchYahooQuoteLive } from '@/services/yahooFinanceApi';

export interface LiveQuote {
  price: number | null;
  updatedAt: number;
}

/**
 * Poll live quotes for a set of symbols. One React Query per UNIQUE symbol
 * (keying dedups for free). Pauses when the tab is hidden; resumes on focus.
 * Empty input → zero requests. Write-free (safe for read-only mirrors).
 *
 * The result map is derived inside React Query's `combine` so its identity is
 * stable across renders until the underlying quote data actually changes —
 * consumers can safely use it as an effect/memo dependency.
 */
export function useLiveQuotes(
  symbols: string[],
  intervalMs: number,
): Record<string, LiveQuote> {
  const unique = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))),
    [symbols],
  );

  // Stable `queries` reference: only rebuilt when the symbol set or interval
  // actually changes. An inline array is a NEW reference every render, which
  // forces React Query's post-render effect to call `observer.setQueries()`
  // and reconcile observers on every single render of every consumer.
  const queries = useMemo(
    () =>
      unique.map((sym) => ({
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
    [unique, intervalMs],
  );

  // Stable `combine` reference: TanStack Query only memoizes the combined
  // result while `combine` is referentially stable — an inline function
  // re-runs combine on every render.
  const combine = useCallback(
    (results: ReadonlyArray<{ data?: LiveQuote } | undefined>) => {
      const map: Record<string, LiveQuote> = {};
      unique.forEach((sym, i) => {
        const d = results[i]?.data;
        if (d) map[sym] = d;
      });
      return map;
    },
    [unique],
  );

  return useQueries({ queries, combine });
}
