// src/hooks/usePortfolioPrices.ts
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStatement } from '@/contexts/StatementContext';
import type { PriceBar } from '@/hooks/useDefeatBeta';
import { pricesToMap } from '@/lib/performanceCalc';
import type { BenchmarkKey, PriceMap } from '@/lib/performanceTypes';

const BACKEND_URL = 'http://localhost:4400';
const PRICE_DAYS = 1825; // 5 years

// Benchmark symbol mapping
// '6040' requires two symbols: SPY (60%) + IEF (40%)
export const BENCHMARK_SYMBOLS: Record<BenchmarkKey, string | [string, string]> = {
  SPY: 'SPY',
  QQQ: 'QQQ',
  ACWI: 'ACWI',
  '6040': ['SPY', 'IEF'],
};

export const BENCHMARK_LABELS: Record<BenchmarkKey, string> = {
  SPY: 'S&P 500 (SPY)',
  QQQ: 'NASDAQ 100 (QQQ)',
  ACWI: 'Global Equity (ACWI)',
  '6040': '60/40 (SPY+IEF)',
};

async function fetchPrices(symbol: string, days: number): Promise<PriceBar[]> {
  const url = new URL(`${BACKEND_URL}/api/prices`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('days', String(days));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Prices fetch failed for ${symbol}`);
  const json = await res.json();
  return json.data ?? [];
}

export interface PortfolioPricesResult {
  holdings: Array<{ ticker: string; shares: number; avg_cost_basis: number }>;
  priceMap: PriceMap;               // all symbols (holdings + benchmark)
  benchmarkValues: { date: string; value: number }[];  // benchmark daily values
  isLoading: boolean;
  error: Error | null;
}

export function usePortfolioPrices(benchmark: BenchmarkKey): PortfolioPricesResult {
  const { data: rawHoldings = [], isLoading: holdingsLoading, error: holdingsError } = usePortfolio();
  const { parsedStatement } = useStatement();

  // Prefer parsed CSV statement positions over Supabase holdings.
  // OpenPosition uses { symbol, quantity, costPrice } — map to internal shape.
  const holdings = useMemo(() => {
    const csvPositions = parsedStatement?.openPositions?.filter(
      p => p.assetCategory === 'STK' && p.quantity > 0,
    );
    if (csvPositions && csvPositions.length > 0) {
      return csvPositions.map(p => ({
        ticker: p.symbol,
        shares: p.quantity,
        avg_cost_basis: p.costPrice,
      }));
    }
    // Fallback: Supabase holdings
    return rawHoldings
      .filter((h: any) => h.ticker && h.shares > 0)
      .map((h: any) => ({
        ticker: h.ticker as string,
        shares: h.shares as number,
        avg_cost_basis: h.avg_cost_basis as number,
      }));
  }, [parsedStatement, rawHoldings]);

  // Determine which benchmark symbols we need
  const benchmarkConfig = BENCHMARK_SYMBOLS[benchmark];
  const benchmarkSymbols = useMemo(
    () => (Array.isArray(benchmarkConfig) ? benchmarkConfig : [benchmarkConfig]),
    [benchmarkConfig],
  );

  // Symbols to fetch: unique holdings + benchmark symbols (deduplicated)
  const allSymbols = useMemo(() => {
    const holdingSymbols = holdings.map(h => h.ticker);
    const unique = new Set([...holdingSymbols, ...benchmarkSymbols]);
    return [...unique];
  }, [holdings, benchmarkSymbols]);

  // Fire one query per symbol using useQueries
  const priceQueries = useQueries({
    queries: allSymbols.map(symbol => ({
      queryKey: ['defeatbeta', 'prices', symbol, PRICE_DAYS],
      queryFn: () => fetchPrices(symbol, PRICE_DAYS),
      staleTime: 30 * 60_000,
      gcTime: 15 * 60_000,
      enabled: allSymbols.length > 0,
    })),
  });

  const usingCsv = !!(parsedStatement?.openPositions?.some(p => p.assetCategory === 'STK' && p.quantity > 0));
  const isLoading = (!usingCsv && holdingsLoading) || priceQueries.some(q => q.isLoading);
  const error = ((!usingCsv ? holdingsError : null) ?? priceQueries.find(q => q.error)?.error ?? null) as Error | null;

  const priceMap = useMemo<PriceMap>(() => {
    const map: PriceMap = {};
    allSymbols.forEach((sym, i) => {
      const bars = priceQueries[i]?.data ?? [];
      map[sym] = pricesToMap(bars as PriceBar[]);
    });
    return map;
  }, [allSymbols, priceQueries]);

  // Build benchmark daily values
  const benchmarkValues = useMemo(() => {
    if (Array.isArray(benchmarkConfig)) {
      // 60/40 blend: 60% first symbol + 40% second symbol
      const [sym1, sym2] = benchmarkConfig;
      const map1 = priceMap[sym1] ?? {};
      const map2 = priceMap[sym2] ?? {};
      const dates = [...new Set([...Object.keys(map1), ...Object.keys(map2)])].sort();
      let last1 = 0, last2 = 0;
      const raw: { date: string; value: number }[] = [];
      for (const d of dates) {
        if (map1[d]) last1 = map1[d];
        if (map2[d]) last2 = map2[d];
        if (last1 > 0 && last2 > 0) raw.push({ date: d, value: 0.6 * last1 + 0.4 * last2 });
      }
      return raw;
    }
    // Single benchmark symbol
    const sym = benchmarkConfig as string;
    const map = priceMap[sym] ?? {};
    return Object.entries(map)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [benchmarkConfig, priceMap]);

  return { holdings, priceMap, benchmarkValues, isLoading, error };
}

/**
 * Companion hook: fetches sector profiles for attribution section.
 * Returns map of ticker → sector string.
 */
export function useHoldingSectors(tickers: string[]): Record<string, string> {
  const profileQueries = useQueries({
    queries: tickers.map(symbol => ({
      queryKey: ['defeatbeta', 'profile', symbol],
      queryFn: async () => {
        const url = new URL(`${BACKEND_URL}/api/profile`);
        url.searchParams.set('symbol', symbol);
        const res = await fetch(url.toString());
        if (!res.ok) return { data: null };
        return res.json();
      },
      staleTime: 24 * 60 * 60_000,
      gcTime: 60 * 60_000,
      enabled: tickers.length > 0,
    })),
  });

  return useMemo(() => {
    const map: Record<string, string> = {};
    tickers.forEach((sym, i) => {
      const profile = profileQueries[i]?.data?.data;
      if (profile?.sector) map[sym] = profile.sector;
    });
    return map;
  }, [tickers, profileQueries]);
}
