import { useQuery } from '@tanstack/react-query';
import { fetchEodHistorical, fetchEodIntraday } from '@/services/eodhdApi';
import { subDays, format } from 'date-fns';

/**
 * Fetches close-price history for sparkline rendering via EODHD.
 *
 * Unlike `useStockHistory` (which queries the sparse local ohlcv_bars table),
 * this hook calls the already-deployed `api-eodhd` edge function to get
 * reliable 30-day daily bars directly from the EODHD data provider.
 *
 * @param symbol  Ticker (e.g. "AAPL")
 * @param days    Number of trailing days (default 30)
 * @param exchange EODHD exchange suffix (default "US")
 */
export function useSparklineData(
  symbol: string,
  days = 30,
  exchange = 'US',
) {
  return useQuery<number[]>({
    queryKey: ['sparkline', symbol, days, exchange],
    queryFn: async () => {
      const eodSymbol = `${symbol}.${exchange}`;
      const from = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const to = format(new Date(), 'yyyy-MM-dd');
      const bars = await fetchEodHistorical(eodSymbol, from, to);
      // Use adjusted_close so stock splits (e.g. AMZN 20:1, AAPL 4:1) don't
      // distort multi-year period returns.
      return bars.map(b => b.adjusted_close ?? b.close);
    },
    enabled: !!symbol,
    staleTime: 30 * 60_000, // 30 min — sparkline data doesn't need real-time refresh
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetches 1 month of hourly close prices from EODHD intraday API.
 * Replaces the old Yahoo Finance–based useIntradaySparkline.
 */
export function useIntradaySparkline(symbol: string, exchange = 'US') {
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.${exchange}`;

  return useQuery<number[]>({
    queryKey: ['sparkline-intraday-eodhd', eodSymbol],
    queryFn: async () => {
      const bars = await fetchEodIntraday(eodSymbol, '1h');
      return bars.map(b => b.close);
    },
    enabled: !!symbol,
    staleTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}
