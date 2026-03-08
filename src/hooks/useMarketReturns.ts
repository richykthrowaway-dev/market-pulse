import { useQuery } from '@tanstack/react-query';

export interface MarketReturnsData {
  returns: number[];
  stats: {
    median: number;
    mean: number;
    up: number;
    down: number;
  };
  /** New 52-week highs — only present in 1D responses */
  new_high?: number;
  /** New 52-week lows — only present in 1D responses */
  new_low?: number;
}

/**
 * Fetches the return distribution for all stocks over a given timeframe
 * via the api-market-returns edge function.
 */
export function useMarketReturns(timeframe: string) {
  return useQuery<MarketReturnsData>({
    queryKey: ['market-returns', timeframe],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-market-returns?timeframe=${encodeURIComponent(timeframe)}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch market returns: ${res.status}`);
      }

      return res.json();
    },
    staleTime: timeframe === '1D' ? 30_000 : 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/** Fixed bucket edges matching GuruFocus: -100..-10 (1 bucket), then -10..-9, ..., 9..10, 10..+Inf */
export interface Bucket {
  label: string;
  from: number;
  to: number;
  count: number;
}

export function buildBuckets(returns: number[]): Bucket[] {
  // Bucket edges: [-Inf, -10], [-10,-9], [-9,-8], ..., [-1,0], [0,1], ..., [9,10], [10, +Inf]
  const buckets: Bucket[] = [];

  // First bucket: < -10
  buckets.push({ label: '-100', from: -Infinity, to: -10, count: 0 });

  // Middle buckets: -10 to 10 in steps of 1
  for (let i = -10; i < 10; i++) {
    const label = i < 0 ? `${i}.00` : `${i}.00`;
    buckets.push({ label: `${i}.00`, from: i, to: i + 1, count: 0 });
  }

  // Last bucket: >= 10
  buckets.push({ label: '10+', from: 10, to: Infinity, count: 0 });

  // Fill counts
  for (const r of returns) {
    for (const b of buckets) {
      if (r >= b.from && r < b.to) {
        b.count++;
        break;
      }
    }
    // Handle exactly +Inf boundary (r >= 10 goes to last bucket)
  }

  return buckets;
}
