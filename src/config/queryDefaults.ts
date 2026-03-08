/**
 * Centralized React Query configuration with tiered refresh strategies.
 *
 * Different data types have different freshness requirements:
 * - Live quotes: most time-sensitive (15s)
 * - Market data summaries: moderate (60s)
 * - Historical data: rarely changes (30min+)
 * - Fundamentals: quarterly data (24h)
 */

import type { DefaultOptions } from '@tanstack/react-query';

/** Global defaults applied to all queries */
export const queryClientDefaults: DefaultOptions = {
  queries: {
    gcTime: 10 * 60 * 1000,        // 10 min garbage collection
    staleTime: 60 * 1000,           // 1 min default stale time
    // Disabled globally — refetching on every tab switch hammers the API
    // when many queries have short stale times. Enable per-query if needed.
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  },
};

/** Per-data-type query options */
export const QUERY_CONFIG = {
  /** Price quotes – EODHD free tier is already 15-min delayed; 60s polls are sufficient */
  quotes: {
    staleTime: 60_000,
    refetchInterval: 60_000,
  },

  /** Stock list – nightly ingest; 5 min is plenty for dashboard display */
  stocks: {
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  },

  /** Market indices – slow moving during market hours */
  indices: {
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  },

  /** Currency pairs – FX moves slowly */
  currencies: {
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  },

  /** News articles – new articles rarely arrive within 10 min */
  news: {
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  },

  /** Historical OHLCV bars – only changes at EOD */
  historicalBars: {
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  },

  /** Market caps – changes slowly */
  marketCaps: {
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  },

  /** Portfolio holdings – user-driven changes */
  portfolio: {
    staleTime: 5 * 60_000,
  },

  /** Beta, fundamentals – quarterly/annual data */
  fundamentals: {
    staleTime: 24 * 60 * 60_000,
    gcTime: 4 * 60 * 60_000,
    refetchOnWindowFocus: false,
  },
} as const;
