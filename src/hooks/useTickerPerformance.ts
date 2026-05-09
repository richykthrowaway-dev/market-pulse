/**
 * useTickerPerformance — fetch live price + 1D/1W/1M/3M % changes for a ticker.
 *
 * Calls the `api-yahoo?endpoint=perf` edge function (3-month daily adjclose,
 * Yahoo Finance, crumb-authenticated). Results cached 5 minutes — quick enough
 * for a popover that opens on demand, generous enough not to hammer Yahoo.
 *
 * Pass `enabled=false` to suspend fetching while the popover is closed.
 */
import { useQuery } from '@tanstack/react-query';

export interface TickerPerf {
  /** Most recent market price from Yahoo Finance */
  price: number | null;
  /** 1-day % change  (previous close → last close) */
  d1:    number | null;
  /** 1-week % change  (~5 trading days) */
  w1:    number | null;
  /** 1-month % change (~21 trading days) */
  m1:    number | null;
  /** 3-month % change (~63 trading days) */
  m3:    number | null;
}

/**
 * Convert a bare ticker + IBKR exchange code into the Yahoo Finance symbol format.
 *
 * Examples:
 *   ("AAPL", "NASDAQ") → "AAPL"
 *   ("RY",   "TSE")    → "RY.TO"
 *   ("SCD",  "VENTURE")→ "SCD.V"
 *   ("BA",   "LSE")    → "BA.L"
 *   ("BHP",  "ASX")    → "BHP.AX"
 */
export function toYahooSymbol(ticker: string, exchange?: string): string {
  const ex = (exchange ?? '').toUpperCase();

  if (ex === 'TSE' || ex === 'TSX' || ex === 'TORONTO')    return `${ticker}.TO`;
  if (ex === 'VENTURE' || ex === 'TSXV' || ex === 'TSX-V') return `${ticker}.V`;
  if (ex === 'LSE' || ex === 'LONDON')                      return `${ticker}.L`;
  if (ex === 'ASX')                                         return `${ticker}.AX`;
  if (ex === 'FRA' || ex === 'FRANKFURT')                   return `${ticker}.F`;
  if (ex === 'XETRA')                                       return `${ticker}.DE`;
  if (ex === 'EPA' || ex === 'PARIS')                       return `${ticker}.PA`;

  // US exchanges (NASDAQ, NYSE, ARCA, BATS, PCX, AMEX…) — pass bare ticker
  return ticker;
}

export function useTickerPerformance(
  ticker: string,
  exchange?: string,
  enabled = true,
) {
  const symbol = toYahooSymbol(ticker, exchange);

  return useQuery<TickerPerf>({
    queryKey: ['ticker-perf', symbol],
    queryFn:  async () => {
      const empty: TickerPerf = { price: null, d1: null, w1: null, m1: null, m3: null };

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      if (!projectId || !anonKey) return empty;

      const url = `https://${projectId}.supabase.co/functions/v1/api-yahoo`
        + `?endpoint=perf&symbol=${encodeURIComponent(symbol)}`;

      const res = await fetch(url, {
        headers: {
          apikey:        anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) return empty;
      const json = await res.json() as TickerPerf;
      return json;
    },
    enabled:              enabled && !!ticker,
    staleTime:            5 * 60_000,    // 5 min — enough for a trade-style popover
    retry:                1,
    refetchOnWindowFocus: false,
  });
}
