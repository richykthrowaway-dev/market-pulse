import { useQuery } from '@tanstack/react-query';
import { subDays, subMonths, subYears, format } from 'date-fns';

const rangeConfig: Record<string, { timeframe: string; getFrom: () => string }> = {
  '1D': { timeframe: '5m', getFrom: () => format(subDays(new Date(), 1), 'yyyy-MM-dd') },
  '1W': { timeframe: '1h', getFrom: () => format(subDays(new Date(), 7), 'yyyy-MM-dd') },
  '1M': { timeframe: '1D', getFrom: () => format(subMonths(new Date(), 1), 'yyyy-MM-dd') },
  '3M': { timeframe: '1D', getFrom: () => format(subMonths(new Date(), 3), 'yyyy-MM-dd') },
  '1Y': { timeframe: '1D', getFrom: () => format(subYears(new Date(), 1), 'yyyy-MM-dd') },
};

interface UsePriceChartParams {
  ticker: string;
  exchange: string;
  range: string;
}

export function usePriceChart({ ticker, exchange, range }: UsePriceChartParams) {
  const config = rangeConfig[range] || rangeConfig['1M'];

  return useQuery({
    queryKey: ['price-chart', ticker, exchange, range],
    queryFn: async () => {
      const from = config.getFrom();
      const to = format(new Date(), 'yyyy-MM-dd');
      const params = new URLSearchParams({
        ticker,
        exchange,
        timeframe: config.timeframe,
        from,
        to,
        adjusted: 'true',
      });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-prices?${params}`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Price fetch failed');
      }
      return res.json();
    },
    enabled: !!ticker && !!exchange,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
