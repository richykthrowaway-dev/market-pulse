import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BetaResult {
  betas: Record<string, number>;
  portfolioBeta: number;
  benchmark: string;
  dataPoints: number;
}

/**
 * Compute a stable cache key from tickers so we only recalculate
 * when the set of holdings actually changes.
 */
function tickerHash(tickers: string[]): string {
  return [...tickers].sort().join(',');
}

async function fetchBetas(
  tickers: string[],
  weights: number[],
): Promise<BetaResult> {
  const { data, error } = await supabase.functions.invoke('api-beta', {
    body: { tickers, weights },
  });
  if (error) throw error;
  return data as BetaResult;
}

/**
 * Hook to compute portfolio beta from holdings.
 * Caches aggressively — only refetches when the ticker set changes.
 * staleTime = 1 hour (beta based on 1Y data doesn't change fast).
 */
export function useBeta(
  tickers: string[],
  weights: number[],
  enabled = true,
) {
  const hash = tickerHash(tickers);

  return useQuery<BetaResult>({
    queryKey: ['portfolio-beta', hash],
    queryFn: () => fetchBetas(tickers, weights),
    enabled: enabled && tickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 4 * 60 * 60 * 1000, // keep in cache 4 hours
    retry: 1,
  });
}
