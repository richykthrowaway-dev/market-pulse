import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveListingId, resolveTimeframeId } from '@/services/symbolMappingCache';
import { QUERY_CONFIG } from '@/config/queryDefaults';

/**
 * Fetch recent OHLCV close prices for a stock from the ohlcv_bars table.
 * Used for sparklines and the main chart.
 *
 * Optimized: uses cached symbol→listing→timeframe mappings to reduce
 * 4 sequential Supabase queries down to 1 on cache hit.
 */
export function useStockHistory(ticker: string, days = 30) {
  return useQuery({
    queryKey: ['stock-history', ticker, days],
    queryFn: async () => {
      // Use cached mappings (hit = 0 queries, miss = 2-3 queries, then cached for 24h)
      const mapping = await resolveListingId(ticker);
      if (!mapping) return [];

      const tfId = await resolveTimeframeId('1D');
      if (!tfId) return [];

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data: bars, error } = await supabase
        .from('ohlcv_bars')
        .select('ts, open, high, low, close, volume')
        .eq('listing_id', mapping.listingId)
        .eq('timeframe_id', tfId)
        .gte('ts', fromDate.toISOString())
        .order('ts', { ascending: true })
        .limit(10000);

      if (error) throw error;
      return bars ?? [];
    },
    enabled: !!ticker,
    ...QUERY_CONFIG.historicalBars,
  });
}
