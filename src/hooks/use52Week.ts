import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Range52Data {
  price: number;
  low52: number;
  high52: number;
}

export interface Ranges52 {
  ranges: Record<string, Range52Data>;
}

async function fetch52Week(tickers: string[]): Promise<Ranges52> {
  const { data, error } = await supabase.functions.invoke('api-52week', {
    body: { tickers },
  });
  if (error) throw error;
  return data as Ranges52;
}

/**
 * Fetch real 52-week high/low for a list of tickers.
 * Cache key is a sorted ticker hash so it only recalculates when holdings change.
 */
export function use52Week(tickers: string[], enabled = true) {
  const hash = [...tickers].sort().join(',');
  return useQuery({
    queryKey: ['52week-ranges', hash],
    queryFn: () => fetch52Week(tickers),
    enabled: enabled && tickers.length > 0,
    staleTime: 60 * 60 * 1000,      // 1 hour — Finnhub data is end-of-day
    gcTime: 4 * 60 * 60 * 1000,    // 4 hours — keep in cache across page navigations
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 2000,
  });
}
