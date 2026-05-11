import { useQuery } from '@tanstack/react-query';

/**
 * useIndexHistory — fetches 1-year of daily closes for a Yahoo Finance
 * index symbol and computes derived metrics for the Summary tab card.
 *
 * Uses the already-deployed api-yahoo `chart` endpoint (same one
 * useCountryIndices uses for current quotes).  The endpoint returns
 * `{ closes, bars }` so we get the close-price array directly without
 * having to walk OHLCV bars.
 *
 * Cached 30 min — daily index closes don't change intraday in any
 * way that affects sparkline shape.
 */

export interface IndexHistory {
  /** Daily closes oldest→newest, suitable for sparkline rendering. */
  closes:       number[];
  /** Highest close in the trailing 252 trading days. */
  high52w:      number;
  /** Lowest close in the trailing 252 trading days. */
  low52w:       number;
  /** Year-to-date percent change (latest close vs Dec-31 prior year close). */
  ytdPct:       number | null;
  /** Latest close in the series. */
  lastClose:    number;
  /** Where today's close sits in the 52w range, 0 = at low, 1 = at high. */
  range52wPct:  number;
}

const YAHOO_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-yahoo`;
const YAHOO_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

export function useIndexHistory(symbol: string | null) {
  return useQuery<IndexHistory | null>({
    queryKey: ['yahoo-index-history-1y', symbol],
    enabled:  !!symbol,
    staleTime:            30 * 60_000,
    gcTime:               4  * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<IndexHistory | null> => {
      if (!symbol) return null;

      const params = new URLSearchParams({
        endpoint: 'chart',
        symbol,
        interval: '1d',
        range:    '1y',
      });

      const res = await fetch(`${YAHOO_FN_BASE}?${params}`, { headers: YAHOO_HEADERS });
      if (!res.ok) return null;

      const data = await res.json() as {
        closes?: number[];
        bars?:   Array<{ t: number; c: number }>;
      };

      const closes = (data.closes ?? []).filter(
        (v): v is number => typeof v === 'number' && isFinite(v),
      );
      if (closes.length < 2) return null;

      // 52-week high/low over the whole returned window (close-based; intraday
      // wicks not considered — close is the relevant trader signal anyway).
      let high52w = -Infinity;
      let low52w  =  Infinity;
      for (const c of closes) {
        if (c > high52w) high52w = c;
        if (c < low52w)  low52w  = c;
      }
      const lastClose = closes[closes.length - 1];

      // Range position — clamped 0..1.  We don't simply divide by range
      // because if the latest close equals the 52w low we want exactly 0,
      // and the high exactly 1, with linear interpolation between.
      const range52wPct = high52w > low52w
        ? Math.max(0, Math.min(1, (lastClose - low52w) / (high52w - low52w)))
        : 0;

      // YTD: latest close vs the first close of the current calendar year.
      // The bars array carries timestamps; we find the first bar whose
      // year matches the latest bar's year.
      let ytdPct: number | null = null;
      const bars = Array.isArray(data.bars) ? data.bars : [];
      if (bars.length > 0) {
        const latestYear = new Date(bars[bars.length - 1].t * 1000).getUTCFullYear();
        const firstOfYear = bars.find(b => new Date(b.t * 1000).getUTCFullYear() === latestYear);
        if (firstOfYear && firstOfYear.c > 0) {
          ytdPct = ((lastClose - firstOfYear.c) / firstOfYear.c) * 100;
        }
      }

      return { closes, high52w, low52w, ytdPct, lastClose, range52wPct };
    },
  });
}
