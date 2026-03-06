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
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  },
};

/** Per-data-type query options */
export const QUERY_CONFIG = {
  /** Real-time price quotes – most time-sensitive */
  quotes: {
    staleTime: 15_000,
    refetchInterval: 15_000,
  },

  /** Stock list with prices – moderate freshness */
  stocks: {
    staleTime: 60_000,
    refetchInterval: 60_000,
  },

  /** Market indices – moderate freshness */
  indices: {
    staleTime: 60_000,
    refetchInterval: 60_000,
  },

  /** Currency pairs – FX moves slower */
  currencies: {
    staleTime: 120_000,
    refetchInterval: 120_000,
  },

  /** News articles – don't change often */
  news: {
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
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
