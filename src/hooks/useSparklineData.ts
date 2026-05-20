import { useQuery } from '@tanstack/react-query';
import { fetchEodHistorical, fetchEodIntraday } from '@/services/eodhdApi';
import { subDays, format } from 'date-fns';

/**
 * Fetches 1-hour intraday bars for the past `calendarDays` calendar days and
 * aggregates them into 4-hour candles by taking the last close in each group
 * of 4 hourly bars. Used for the 7D sparkline in the watchlist.
 *
 * EODHD doesn't expose a native 4h interval, so we aggregate client-side.
 * We request 14 calendar days to ensure we always cover 7 full trading days
 * even across weekends / holidays.
 */
export function use4hSparkline(symbol: string, exchange = 'US') {
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.${exchange}`;
  const from = format(subDays(new Date(), 14), 'yyyy-MM-dd');
  const to   = format(new Date(), 'yyyy-MM-dd');

  return useQuery<number[]>({
    queryKey: ['sparkline-4h', eodSymbol, from],
    queryFn: async () => {
      const bars = await fetchEodIntraday(eodSymbol, '1h', from, to);
      if (bars.length === 0) return [];
      // Aggregate: group into chunks of 4 and take the last close in each chunk.
      const closes: number[] = [];
      for (let i = 3; i < bars.length; i += 4) {
        closes.push(bars[i].close);
      }
      // If the most recent group is incomplete (< 4 bars), include current close.
      const remainder = bars.length % 4;
      if (remainder > 0) {
        closes.push(bars[bars.length - 1].close);
      }
      return closes;
    },
    enabled: !!symbol,
    staleTime: 15 * 60_000, // 15 min
    refetchOnWindowFocus: false,
  });
}

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
