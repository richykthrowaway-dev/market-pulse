// src/pages/Performance.tsx
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PerformanceKpiGrid } from '@/components/performance/PerformanceKpiGrid';
import { EquityCurveChart } from '@/components/performance/EquityCurveChart';
import { DrawdownChart } from '@/components/performance/DrawdownChart';
import { PerformanceTable } from '@/components/performance/PerformanceTable';
import { AttributionSection } from '@/components/performance/AttributionSection';
import { CorrelationMatrix } from '@/components/performance/CorrelationMatrix';
import { usePortfolioPrices, useHoldingSectors, BENCHMARK_LABELS } from '@/hooks/usePortfolioPrices';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import type { BenchmarkKey, DateRange, TableMode, AttributionGrouping } from '@/lib/performanceTypes';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '1Y', value: '1Y' },
  { label: '3Y', value: '3Y' },
  { label: 'Max', value: 'Max' },
];

export default function Performance() {
  const [benchmark, setBenchmark] = useState<BenchmarkKey>('SPY');
  const [dateRange, setDateRange] = useState<DateRange>('1Y');
  const [tableMode, setTableMode] = useState<TableMode>('returns');
  const [attributionGrouping, setAttributionGrouping] = useState<AttributionGrouping>('sector');

  const portfolioData = usePortfolioPrices(benchmark);
  const holdingTickers = useMemo(
    () => portfolioData.holdings.map(h => h.ticker),
    [portfolioData.holdings],
  );
  const sectorMap = useHoldingSectors(holdingTickers);

  const { equityCurve, drawdownData, periods, summary, attribution, correlations, isLoading, error } =
    usePerformanceMetrics({ portfolioData, benchmark, dateRange, attributionGrouping, sectorMap });

  const holdingSymbols = portfolioData.holdings.map(h => h.ticker);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!isLoading && portfolioData.holdings.length === 0) {
    return (
      <PageLayout title="Performance">
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-lg font-medium">No portfolio holdings yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add holdings to your portfolio to see performance analytics.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/portfolio">Go to Portfolio</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <PageLayout title="Performance">
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <p className="text-destructive font-medium">Failed to load performance data</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Performance">
      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          {/* Benchmark selector */}
          <Select value={benchmark} onValueChange={v => setBenchmark(v as BenchmarkKey)}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(BENCHMARK_LABELS) as [BenchmarkKey, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range pills */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {DATE_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  dateRange === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── KPI strip ──────────────────────────────────────────────── */}
        <PerformanceKpiGrid summary={summary} isLoading={isLoading} />

        {/* ── Charts row ─────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 min-w-0 h-48 md:h-72">
            <EquityCurveChart
              data={equityCurve}
              benchmarkLabel={BENCHMARK_LABELS[benchmark]}
              isLoading={isLoading}
            />
          </div>
          <div className="flex-1 min-w-0 h-48 md:h-72">
            <DrawdownChart
              data={drawdownData}
              benchmarkLabel={BENCHMARK_LABELS[benchmark]}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* ── Performance table ──────────────────────────────────────── */}
        <PerformanceTable
          rows={periods}
          mode={tableMode}
          onModeChange={setTableMode}
          isLoading={isLoading}
        />

        {/* ── Attribution ────────────────────────────────────────────── */}
        {attribution.length > 0 && (
          <AttributionSection
            rows={attribution}
            grouping={attributionGrouping}
            onGroupingChange={setAttributionGrouping}
          />
        )}

        {/* ── Correlation matrix ─────────────────────────────────────── */}
        {holdingSymbols.length >= 2 && correlations.length > 0 && (
          <CorrelationMatrix entries={correlations} symbols={holdingSymbols} />
        )}
      </div>
    </PageLayout>
  );
}
