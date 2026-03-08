import { useQuery } from '@tanstack/react-query';
import { fetchEodHistorical } from '@/services/eodhdApi';
import { fetchYahooIntraday } from '@/services/yahooFinanceApi';
import { buildQualifiedTicker } from '@/components/stocks/StockLogo';
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
 * Fetches 1 month of hourly close prices from Yahoo Finance.
 *
 * A single fetch covers both short periods:
 *   7D  → last ~35 bars  (5 trading days × 7 hourly bars/day)
 *   30D → all  ~130 bars (21 trading days × 6.5 hours)
 *
 * Uses the Yahoo Finance ticker format (same suffixes as Logo.dev):
 *   US → "AAPL", TSX → "RY.TO", TSX-V → "SCD.V", LSE → "LLOY.L"
 *
 * Falls back gracefully to an empty array if Yahoo is unavailable.
 */
export function useIntradaySparkline(symbol: string, exchange = 'US') {
  // buildQualifiedTicker produces Yahoo-compatible tickers:
  //   ("SCD", "V") → "SCD.V",  ("AAPL", "US") → "AAPL",  ("RY", "TO") → "RY.TO"
  const yahooTicker = buildQualifiedTicker(symbol, exchange);

  return useQuery<number[]>({
    queryKey: ['sparkline-intraday', yahooTicker],
    queryFn: () => fetchYahooIntraday(yahooTicker, '1h', '1mo'),
    enabled: !!symbol,
    staleTime: 15 * 60_000,      // 15 min — intraday data, moderately fresh
    refetchOnWindowFocus: false,
  });
}
