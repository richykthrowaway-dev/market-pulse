import { useQuery } from '@tanstack/react-query';

/**
 * useCommodityIntraday — 1-hour intraday bars for all 9 commodity ETF proxies.
 *
 * Fetches from the api-commodity-intraday edge function, which returns the
 * last 48h of 1h bars for each ticker.  Used exclusively by the "1D" sparkline
 * range in CommoditiesPanel to show today's hourly price action.
 *
 * staleTime: 15 min — matches server cache TTL.
 * Pass `enabled: false` when not on the 1D tab to avoid unnecessary credits.
 */

export interface IntradayBar {
  timestamp: number;  // Unix seconds
  datetime:  string;  // "YYYY-MM-DD HH:mm:ss"
  close:     number;
}

export interface CommodityIntraday {
  id:     string;
  label:  string;
  ticker: string;
  bars:   IntradayBar[];
}

export interface CommodityIntradayResponse {
  intraday:  CommodityIntraday[];
  timestamp: number;
}

const STALE = 15 * 60_000; // 15 min

export function useCommodityIntraday(enabled = true) {
  return useQuery<CommodityIntradayResponse>({
    queryKey:             ['commodity-intraday'],
    staleTime:            STALE,
    gcTime:               STALE * 2,
    refetchInterval:      STALE,
    refetchOnWindowFocus: false,
    enabled,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        return { intraday: [], timestamp: Date.now() };
      }
      const url = `https://${projectId}.supabase.co/functions/v1/api-commodity-intraday`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) return { intraday: [], timestamp: Date.now() };
      return (await res.json()) as CommodityIntradayResponse;
    },
  });
}

/** Build an id→closes lookup from intraday response for sparkline use. */
export function buildIntradayMap(
  intraday: CommodityIntraday[],
): Map<string, number[]> {
  return new Map(
    intraday.map((d) => [d.id, d.bars.map((b) => b.close)]),
  );
}
