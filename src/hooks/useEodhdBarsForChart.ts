import { useQuery } from '@tanstack/react-query';
import { fetchEodHistorical, type EodBar } from '@/services/eodhdApi';
import { subDays, format } from 'date-fns';

/**
 * Fetches up to 5 years of EODHD daily bars for the large StockChart.
 *
 * By fetching 5Y up-front and caching once, switching between 1W/1M/3M/1Y/5Y
 * requires no additional network requests — StockChart slices client-side.
 *
 * @param symbol   Ticker (e.g. "AAPL") — pass null/empty to disable
 * @param exchange EODHD exchange suffix (default "US")
 */
export function useEodhdBarsForChart(
  symbol: string | null | undefined,
  exchange = 'US',
) {
  return useQuery<EodBar[]>({
    queryKey: ['eodhd-chart-bars', symbol, exchange],
    queryFn: async () => {
      if (!symbol) return [];
      const eodSymbol = `${symbol}.${exchange}`;
      const from = format(subDays(new Date(), 1825), 'yyyy-MM-dd'); // 5Y
      const to   = format(new Date(), 'yyyy-MM-dd');
      return fetchEodHistorical(eodSymbol, from, to);
    },
    enabled: !!symbol,
    staleTime: 30 * 60_000,       // 30 min — daily bars don't change intra-day
    refetchOnWindowFocus: false,
  });
}
