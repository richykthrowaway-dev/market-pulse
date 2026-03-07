// src/hooks/usePerformanceMetrics.ts
import { useMemo } from 'react';
import {
  buildPortfolioValues, buildEquityCurve, buildDrawdownSeries,
  computeAllPeriods, computeSummary, buildAttributionRows,
  buildCorrelationMatrix,
} from '@/lib/performanceCalc';
import { BENCHMARK_LABELS } from '@/hooks/usePortfolioPrices';
import type { PortfolioPricesResult } from '@/hooks/usePortfolioPrices';
import type { PerformanceData, DateRange, BenchmarkKey, AttributionGrouping } from '@/lib/performanceTypes';

interface UsePerformanceMetricsInput {
  portfolioData: PortfolioPricesResult;
  benchmark: BenchmarkKey;
  dateRange: DateRange;
  attributionGrouping: AttributionGrouping;
  sectorMap: Record<string, string>;  // ticker → sector from useHoldingSectors
}

export function usePerformanceMetrics({
  portfolioData,
  benchmark,
  dateRange,
  attributionGrouping,
  sectorMap,
}: UsePerformanceMetricsInput): PerformanceData & { isLoading: boolean; error: Error | null } {
  const { holdings, priceMap, benchmarkValues, isLoading, error } = portfolioData;

  const computed = useMemo<PerformanceData>(() => {
    const empty: PerformanceData = {
      equityCurve: [], drawdownData: [], periods: [],
      summary: null, attribution: [], correlations: [],
    };

    if (holdings.length === 0 || Object.keys(priceMap).length === 0) return empty;

    // 1. Portfolio daily values — use holdings-only sub-map to avoid
    //    benchmark dates polluting the date union and skewing Since Inception
    const holdingPriceMap = Object.fromEntries(
      holdings.map(h => [h.ticker, priceMap[h.ticker] ?? {}])
    );
    const portValues = buildPortfolioValues(holdings, holdingPriceMap);
    if (portValues.length < 2) return empty;

    // 2. Equity curve + drawdowns (sliced to selected date range)
    const equityCurve = buildEquityCurve(portValues, benchmarkValues, dateRange);
    const drawdownData = buildDrawdownSeries(equityCurve);

    // 3. Period metrics (always uses full history for all periods)
    const periods = computeAllPeriods(portValues, benchmarkValues);
    const summary = computeSummary(periods, BENCHMARK_LABELS[benchmark]);

    // 4. Attribution
    const sinceInceptionPeriod = periods.find(p => p.periodLabel === 'Since Inception');
    const attribution = holdings.length > 0
      ? buildAttributionRows(
          holdings.map(h => ({
            ticker: h.ticker,
            shares: h.shares,
            sector: sectorMap[h.ticker] ?? 'Unknown',
            currentPrice: (() => {
              const dates = Object.keys(priceMap[h.ticker] ?? {}).sort();
              return priceMap[h.ticker]?.[dates[dates.length - 1]] ?? 0;
            })(),
            startPrice: (() => {
              const sorted = Object.keys(priceMap[h.ticker] ?? {}).sort();
              return priceMap[h.ticker]?.[sorted[0]] ?? 0;
            })(),
          })),
          attributionGrouping,
          sinceInceptionPeriod?.benchmarkReturnPct ?? 0,
        )
      : [];

    // 5. Correlations (only for holding symbols, not benchmark)
    const holdingSymbols = holdings.map(h => h.ticker);
    const correlations = holdingSymbols.length >= 2
      ? buildCorrelationMatrix(priceMap, holdingSymbols)
      : [];

    return { equityCurve, drawdownData, periods, summary, attribution, correlations };
  }, [holdings, priceMap, benchmarkValues, benchmark, dateRange, attributionGrouping, sectorMap]);

  return { ...computed, isLoading, error };
}
