import { useQuery } from '@tanstack/react-query';
import { fetchYahooChart, type YahooBar } from '@/services/yahooFinanceApi';

/**
 * Daily bars for a sparkline + window-change. `enabled` lets callers gate
 * (e.g. skip until the symbol is on screen). 10-min React Query cache.
 */
export function useSparkline(symbol: string, range: '5d' | '1mo' | '3mo' | '1y' = '1mo') {
  return useQuery<YahooBar[]>({
    queryKey: ['sparkline', symbol.trim().toUpperCase(), range],
    queryFn: () => fetchYahooChart(symbol.trim().toUpperCase(), '1d', range),
    enabled: symbol.trim().length > 0,
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
  });
}
