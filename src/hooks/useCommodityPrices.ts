import { useQuery } from '@tanstack/react-query';

/**
 * useCommodityPrices — latest EOD prices for key commodity ETF proxies.
 *
 * Prices come from EODHD via the api-commodity-prices edge function.
 * Returns a lookup map (commodity id → price data) for fast access in
 * the ConflictEventDialog commodity list and the TradeInfrastructurePanel strip.
 *
 * staleTime: 1 hour — EOD data, no need to poll faster.
 */

export interface CommodityPrice {
  id:        string;
  label:     string;
  ticker:    string;
  price:     number;
  prevClose: number;
  changeP:   number;
  date:      string;
  unit:      string;
  /** Last ~30 daily closes, oldest → newest. Used by in-tile sparklines. */
  sparkline: number[];
}

export interface CommodityPricesResponse {
  prices:    CommodityPrice[];
  timestamp: number;
}

const STALE = 60 * 60_000; // 1 hour — matches CACHE_TTL in api-commodity-prices

export function useCommodityPrices() {
  return useQuery<CommodityPricesResponse>({
    queryKey:             ['commodity-prices'],
    staleTime:            STALE,
    gcTime:               STALE * 2,
    refetchInterval:      STALE,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        return { prices: [], timestamp: Date.now() };
      }
      const url = `https://${projectId}.supabase.co/functions/v1/api-commodity-prices`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) return { prices: [], timestamp: Date.now() };
      return (await res.json()) as CommodityPricesResponse;
    },
  });
}

/** Helper — build an id→price lookup map from the query result. */
export function buildPriceMap(
  prices: CommodityPrice[],
): Map<string, CommodityPrice> {
  return new Map(prices.map(p => [p.id, p]));
}
