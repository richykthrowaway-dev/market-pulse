# Performance Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full Performance page with KPI strip, equity curve, drawdown chart, period returns/risk table, attribution, and correlation matrix — all driven by real Supabase holdings + DefeatBeta historical prices.

**Architecture:** Layered hooks + pure computation. `performanceCalc.ts` handles all math as pure functions. `usePortfolioPrices` fetches raw data. `usePerformanceMetrics` wires them together with `useMemo`. Six sub-components consume the computed data.

**Tech Stack:** React + TypeScript + Recharts + TanStack Query + shadcn/ui. No test runner — verify each step with `npm run build` then visual check in preview.

---

## Key Facts About the Codebase

- Holdings schema: `{ ticker: string, shares: number, avg_cost_basis: number, ... }` (from `usePortfolio()`)
- Price bars: `PriceBar { symbol, report_date: string, open, close, high, low, volume }` — note `report_date` not `date`
- `useHistoricalPrices(symbol, days)` from `src/hooks/useDefeatBeta.ts` — returns `PriceBar[]`
- `useCompanyProfile(symbol)` from same file — returns `CompanyProfile { sector, industry, ... }`
- `StatsCard` props: `{ title, value, description?, icon?, trend?: number, trendLabel?, className?, valueClassName? }`
- All pages wrap with `<PageLayout title="...">` from `@/components/layout/PageLayout`
- Tailwind color tokens: `text-[hsl(var(--success))]` (green), `text-[hsl(var(--danger))]` (red), `text-muted-foreground`
- Recharts is `recharts ^2.12.7` — use `LineChart`, `AreaChart`, `ResponsiveContainer`, `Tooltip`, `ReferenceLine`
- `cn()` utility at `@/lib/utils`

---

## Task 1: TypeScript Types

**Files:**
- Create: `src/lib/performanceTypes.ts`

**Step 1: Create the types file**

```typescript
// src/lib/performanceTypes.ts

export type BenchmarkKey = 'SPY' | 'QQQ' | 'ACWI' | '6040';
export type DateRange = '1Y' | '3Y' | 'Max';
export type TableMode = 'returns' | 'risk';
export type AttributionGrouping = 'sector' | 'ticker';

export interface EquityPoint {
  date: string;           // YYYY-MM-DD
  portfolio: number;      // normalized to 100 at start
  benchmark: number;      // normalized to 100 at start
}

export interface DrawdownPoint {
  date: string;
  portfolioDrawdownPct: number;   // always <= 0
  benchmarkDrawdownPct: number;   // always <= 0
}

export interface PeriodPerformance {
  periodLabel: string;            // "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y" | "Since Inception"
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
  activeReturnPct: number;
  annualizedReturnPct: number | null;  // null for periods < 1Y
  volatilityPct: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  beta: number;
  trackingErrorPct: number;
  informationRatio: number;
}

export interface PerformanceSummary {
  ytdReturnPct: number;
  ytdVsBenchmarkPct: number;
  oneYearReturnPct: number;
  oneYearVsBenchmarkPct: number;
  sinceInceptionReturnPct: number;
  volatility1YPct: number;
  sharpe1Y: number;
  maxDrawdownPct: number;
  benchmarkLabel: string;
}

export interface AttributionRow {
  segmentType: 'sector' | 'ticker';
  segmentName: string;
  weightPct: number;
  segmentReturnPct: number;
  contributionReturnPct: number;
  contributionActivePct: number;
}

export interface CorrelationEntry {
  assetA: string;
  assetB: string;
  correlation: number;  // -1 to +1
}

export interface PerformanceData {
  equityCurve: EquityPoint[];
  drawdownData: DrawdownPoint[];
  periods: PeriodPerformance[];
  summary: PerformanceSummary | null;
  attribution: AttributionRow[];
  correlations: CorrelationEntry[];
}

// Internal helper type for raw price map
export type PriceMap = Record<string, Record<string, number>>;
// shape: { 'AAPL': { '2025-01-02': 185.5, '2025-01-03': 187.0, ... }, ... }
```

**Step 2: Build and verify TypeScript**

```bash
cd C:/Users/PC/Downloads/market-pulse && npm run build
```

Expected: clean compile, no errors in new file.

**Step 3: Commit**

```bash
git add src/lib/performanceTypes.ts
git commit -m "feat(performance): add TypeScript types for performance page"
```

---

## Task 2: Pure Computation Module

**Files:**
- Create: `src/lib/performanceCalc.ts`

**Step 1: Create the computation module**

```typescript
// src/lib/performanceCalc.ts
import type { PriceBar } from '@/hooks/useDefeatBeta';
import type {
  EquityPoint, DrawdownPoint, PeriodPerformance,
  PerformanceSummary, AttributionRow, CorrelationEntry, PriceMap
} from '@/lib/performanceTypes';

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Convert PriceBar[] to a date→close map for fast lookup */
export function pricesToMap(bars: PriceBar[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const b of bars) map[b.report_date] = b.close;
  return map;
}

/** Get sorted union of all dates across all symbols */
export function getAllDates(priceMap: PriceMap): string[] {
  const set = new Set<string>();
  for (const dates of Object.values(priceMap)) {
    for (const d of Object.keys(dates)) set.add(d);
  }
  return [...set].sort();
}

/** Slice dates to a given DateRange */
export function sliceDates(dates: string[], range: '1Y' | '3Y' | 'Max'): string[] {
  if (range === 'Max') return dates;
  const now = new Date();
  const cutoff = new Date(now);
  if (range === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
  if (range === '3Y') cutoff.setFullYear(now.getFullYear() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return dates.filter(d => d >= cutoffStr);
}

/** Get dates from Jan 1 of the current year */
function ytdCutoff(): string {
  return `${new Date().getFullYear()}-01-01`;
}

// ── Portfolio value computation ───────────────────────────────────────────────

export interface HoldingInput {
  ticker: string;
  shares: number;
}

/**
 * For each date, compute portfolio market value = Σ(qty_i × price_i).
 * If a symbol has no price on a date, carry forward the last known price.
 * Returns { date, value }[] sorted chronologically.
 */
export function buildPortfolioValues(
  holdings: HoldingInput[],
  priceMap: PriceMap,
): { date: string; value: number }[] {
  const allDates = getAllDates(priceMap);
  // carry-forward map: last known price per symbol
  const lastPrice: Record<string, number> = {};

  return allDates
    .map(date => {
      let value = 0;
      for (const h of holdings) {
        const price = priceMap[h.ticker]?.[date] ?? lastPrice[h.ticker];
        if (price !== undefined) {
          lastPrice[h.ticker] = price;
          value += h.shares * price;
        }
      }
      return { date, value };
    })
    .filter(p => p.value > 0); // skip leading dates before any holding has data
}

// ── Equity curve (normalized) ────────────────────────────────────────────────

/**
 * Build normalized equity curve (base = 100) for portfolio and benchmark.
 * Both are normalized to 100 at the first date of the sliced range.
 */
export function buildEquityCurve(
  portfolioValues: { date: string; value: number }[],
  benchmarkValues: { date: string; value: number }[],
  range: '1Y' | '3Y' | 'Max',
): EquityPoint[] {
  const allDates = [
    ...new Set([
      ...portfolioValues.map(p => p.date),
      ...benchmarkValues.map(p => p.date),
    ]),
  ].sort();

  const sliced = sliceDates(allDates, range);
  if (sliced.length === 0) return [];

  const portMap = Object.fromEntries(portfolioValues.map(p => [p.date, p.value]));
  const benchMap = Object.fromEntries(benchmarkValues.map(p => [p.date, p.value]));

  // Forward-fill for the sliced dates
  let lastPort = 0, lastBench = 0;
  const points: { date: string; port: number; bench: number }[] = [];
  for (const d of sliced) {
    if (portMap[d] !== undefined) lastPort = portMap[d];
    if (benchMap[d] !== undefined) lastBench = benchMap[d];
    if (lastPort > 0 && lastBench > 0) points.push({ date: d, port: lastPort, bench: lastBench });
  }
  if (points.length === 0) return [];

  const portBase = points[0].port;
  const benchBase = points[0].bench;

  return points.map(p => ({
    date: p.date,
    portfolio: parseFloat(((p.port / portBase) * 100).toFixed(4)),
    benchmark: parseFloat(((p.bench / benchBase) * 100).toFixed(4)),
  }));
}

// ── Drawdown series ──────────────────────────────────────────────────────────

/** Compute rolling max-drawdown series from a normalized equity curve */
function toDrawdowns(values: number[]): number[] {
  let peak = values[0] ?? 100;
  return values.map(v => {
    if (v > peak) peak = v;
    return parseFloat((((v - peak) / peak) * 100).toFixed(4));
  });
}

export function buildDrawdownSeries(equity: EquityPoint[]): DrawdownPoint[] {
  const portDD = toDrawdowns(equity.map(e => e.portfolio));
  const benchDD = toDrawdowns(equity.map(e => e.benchmark));
  return equity.map((e, i) => ({
    date: e.date,
    portfolioDrawdownPct: portDD[i],
    benchmarkDrawdownPct: benchDD[i],
  }));
}

// ── Statistical helpers ──────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function dailyLogReturns(values: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) rets.push(Math.log(values[i] / values[i - 1]));
  }
  return rets;
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  return a.slice(0, n).reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / (n - 1);
}

// ── Period metrics ───────────────────────────────────────────────────────────

/**
 * Compute all return + risk metrics for a single period slice.
 * portValues and benchValues should already be sliced to the period.
 */
export function computePeriodMetrics(
  label: string,
  portValues: number[],
  benchValues: number[],
  isAnnualized: boolean,
): PeriodPerformance {
  const n = portValues.length;
  const portReturn = n > 1 ? (portValues[n - 1] / portValues[0] - 1) * 100 : 0;
  const benchReturn = n > 1 ? (benchValues[n - 1] / benchValues[0] - 1) * 100 : 0;
  const activeReturn = portReturn - benchReturn;

  const tradingDays = n - 1;
  const annFactor = tradingDays > 0 ? 252 / tradingDays : 1;
  const annualizedReturn = isAnnualized && tradingDays >= 252
    ? ((portValues[n - 1] / portValues[0]) ** annFactor - 1) * 100
    : null;

  const portLogRets = dailyLogReturns(portValues);
  const benchLogRets = dailyLogReturns(benchValues);

  const vol = stdDev(portLogRets) * Math.sqrt(252) * 100;

  const annualizedRetForSharpe = tradingDays > 0
    ? ((portValues[n - 1] / portValues[0]) ** (252 / tradingDays) - 1) * 100
    : portReturn;
  const sharpe = vol > 0 ? annualizedRetForSharpe / vol : 0;

  const negRets = portLogRets.filter(r => r < 0);
  const downsideDev = negRets.length > 1
    ? Math.sqrt(negRets.reduce((s, r) => s + r ** 2, 0) / negRets.length) * Math.sqrt(252) * 100
    : vol;
  const sortino = downsideDev > 0 ? annualizedRetForSharpe / downsideDev : 0;

  // Max drawdown in this period
  let peak = portValues[0];
  let maxDD = 0;
  for (const v of portValues) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak * 100;
    if (dd < maxDD) maxDD = dd;
  }

  const beta = benchLogRets.length > 1
    ? covariance(portLogRets, benchLogRets) / (stdDev(benchLogRets) ** 2 || 1)
    : 1;

  const diffRets = portLogRets.map((r, i) => r - (benchLogRets[i] ?? 0));
  const trackingError = stdDev(diffRets) * Math.sqrt(252) * 100;
  const informationRatio = trackingError > 0 ? activeReturn / trackingError : 0;

  return {
    periodLabel: label,
    portfolioReturnPct: parseFloat(portReturn.toFixed(2)),
    benchmarkReturnPct: parseFloat(benchReturn.toFixed(2)),
    activeReturnPct: parseFloat(activeReturn.toFixed(2)),
    annualizedReturnPct: annualizedReturn !== null ? parseFloat(annualizedReturn.toFixed(2)) : null,
    volatilityPct: parseFloat(vol.toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(2)),
    sortino: parseFloat(sortino.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDD.toFixed(2)),
    beta: parseFloat(beta.toFixed(3)),
    trackingErrorPct: parseFloat(trackingError.toFixed(2)),
    informationRatio: parseFloat(informationRatio.toFixed(2)),
  };
}

/** Slice a value array to approximately N trading days from the end */
function sliceToDays(values: { date: string; value: number }[], days: number) {
  return values.slice(Math.max(0, values.length - days));
}

function sliceFromDate(values: { date: string; value: number }[], cutoff: string) {
  return values.filter(v => v.date >= cutoff);
}

/**
 * Compute all period metrics for the standard set of periods.
 * portValues and benchValues must be sorted chronologically.
 */
export function computeAllPeriods(
  portValues: { date: string; value: number }[],
  benchValues: { date: string; value: number }[],
): PeriodPerformance[] {
  const periods: Array<{ label: string; days: number | null; cutoff?: string; annualized: boolean }> = [
    { label: '1M', days: 21, annualized: false },
    { label: '3M', days: 63, annualized: false },
    { label: 'YTD', days: null, cutoff: ytdCutoff(), annualized: false },
    { label: '1Y', days: 252, annualized: false },
    { label: '3Y', days: 756, annualized: true },
    { label: '5Y', days: 1260, annualized: true },
    { label: 'Since Inception', days: null, annualized: true },
  ];

  return periods
    .map(({ label, days, cutoff, annualized }) => {
      const pSlice = cutoff
        ? sliceFromDate(portValues, cutoff)
        : days
        ? sliceToDays(portValues, days)
        : portValues;
      const bSlice = cutoff
        ? sliceFromDate(benchValues, cutoff)
        : days
        ? sliceToDays(benchValues, days)
        : benchValues;

      if (pSlice.length < 2 || bSlice.length < 2) return null;

      return computePeriodMetrics(
        label,
        pSlice.map(v => v.value),
        bSlice.map(v => v.value),
        annualized,
      );
    })
    .filter((p): p is PeriodPerformance => p !== null);
}

// ── KPI Summary ──────────────────────────────────────────────────────────────

export function computeSummary(
  periods: PeriodPerformance[],
  benchmarkLabel: string,
): PerformanceSummary | null {
  if (periods.length === 0) return null;
  const byLabel = Object.fromEntries(periods.map(p => [p.periodLabel, p]));
  const ytd = byLabel['YTD'];
  const oneY = byLabel['1Y'];
  const inception = byLabel['Since Inception'];

  return {
    ytdReturnPct: ytd?.portfolioReturnPct ?? 0,
    ytdVsBenchmarkPct: ytd?.activeReturnPct ?? 0,
    oneYearReturnPct: oneY?.portfolioReturnPct ?? 0,
    oneYearVsBenchmarkPct: oneY?.activeReturnPct ?? 0,
    sinceInceptionReturnPct: inception?.portfolioReturnPct ?? 0,
    volatility1YPct: oneY?.volatilityPct ?? 0,
    sharpe1Y: oneY?.sharpe ?? 0,
    maxDrawdownPct: inception?.maxDrawdownPct ?? 0,
    benchmarkLabel,
  };
}

// ── Attribution ──────────────────────────────────────────────────────────────

export interface AttributionInput {
  ticker: string;
  shares: number;
  sector: string;
  currentPrice: number;
  startPrice: number;  // price at start of selected range
}

export function buildAttributionRows(
  inputs: AttributionInput[],
  grouping: 'sector' | 'ticker',
  benchmarkReturnPct: number,
): AttributionRow[] {
  const totalValue = inputs.reduce((s, i) => s + i.shares * i.currentPrice, 0);
  if (totalValue === 0) return [];

  // Compute per-holding metrics
  const holdingRows = inputs.map(i => {
    const weight = (i.shares * i.currentPrice) / totalValue;
    const ret = i.startPrice > 0 ? (i.currentPrice / i.startPrice - 1) * 100 : 0;
    const contribution = weight * ret;
    const activeContrib = weight * (ret - benchmarkReturnPct);
    return { group: grouping === 'sector' ? i.sector : i.ticker, weight, ret, contribution, activeContrib };
  });

  if (grouping === 'ticker') {
    return inputs.map((inp, i) => ({
      segmentType: 'ticker' as const,
      segmentName: inp.ticker,
      weightPct: parseFloat((holdingRows[i].weight * 100).toFixed(2)),
      segmentReturnPct: parseFloat(holdingRows[i].ret.toFixed(2)),
      contributionReturnPct: parseFloat(holdingRows[i].contribution.toFixed(2)),
      contributionActivePct: parseFloat(holdingRows[i].activeContrib.toFixed(2)),
    }));
  }

  // Group by sector
  const sectorMap = new Map<string, { weight: number; ret: number; contribution: number; activeContrib: number }>();
  for (const r of holdingRows) {
    const existing = sectorMap.get(r.group) ?? { weight: 0, ret: 0, contribution: 0, activeContrib: 0 };
    sectorMap.set(r.group, {
      weight: existing.weight + r.weight,
      ret: existing.ret + r.ret * r.weight, // weighted sum for averaging
      contribution: existing.contribution + r.contribution,
      activeContrib: existing.activeContrib + r.activeContrib,
    });
  }

  return [...sectorMap.entries()].map(([sector, v]) => ({
    segmentType: 'sector' as const,
    segmentName: sector || 'Unknown',
    weightPct: parseFloat((v.weight * 100).toFixed(2)),
    segmentReturnPct: v.weight > 0 ? parseFloat((v.ret / v.weight).toFixed(2)) : 0,
    contributionReturnPct: parseFloat(v.contribution.toFixed(2)),
    contributionActivePct: parseFloat(v.activeContrib.toFixed(2)),
  }));
}

// ── Correlation matrix ───────────────────────────────────────────────────────

export function buildCorrelationMatrix(
  priceMap: PriceMap,
  symbols: string[],
): CorrelationEntry[] {
  if (symbols.length < 2) return [];

  // Get log returns for each symbol
  const logRetsBySymbol: Record<string, number[]> = {};
  for (const sym of symbols) {
    const dates = Object.keys(priceMap[sym] ?? {}).sort();
    const values = dates.map(d => priceMap[sym][d]);
    logRetsBySymbol[sym] = dailyLogReturns(values);
  }

  const entries: CorrelationEntry[] = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const a = logRetsBySymbol[symbols[i]];
      const b = logRetsBySymbol[symbols[j]];
      const n = Math.min(a.length, b.length);
      if (n < 5) continue;
      const cov = covariance(a.slice(-n), b.slice(-n));
      const sd1 = stdDev(a.slice(-n));
      const sd2 = stdDev(b.slice(-n));
      const corr = sd1 > 0 && sd2 > 0 ? cov / (sd1 * sd2) : 0;
      entries.push({
        assetA: symbols[i],
        assetB: symbols[j],
        correlation: parseFloat(Math.max(-1, Math.min(1, corr)).toFixed(2)),
      });
    }
  }
  return entries;
}
```

**Step 2: Build and check**

```bash
cd C:/Users/PC/Downloads/market-pulse && npm run build
```

Expected: clean compile.

**Step 3: Commit**

```bash
git add src/lib/performanceCalc.ts
git commit -m "feat(performance): add pure computation module (performanceCalc)"
```

---

## Task 3: `usePortfolioPrices` Hook

**Files:**
- Create: `src/hooks/usePortfolioPrices.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/usePortfolioPrices.ts
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useHistoricalPrices, useCompanyProfile, type PriceBar } from '@/hooks/useDefeatBeta';
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
  benchmarkValues: { date: string; value: number }[];  // benchmark daily values (normalized to initial $100)
  isLoading: boolean;
  error: Error | null;
}

export function usePortfolioPrices(benchmark: BenchmarkKey): PortfolioPricesResult {
  const { data: rawHoldings = [], isLoading: holdingsLoading, error: holdingsError } = usePortfolio();

  const holdings = useMemo(() =>
    rawHoldings
      .filter((h: any) => h.ticker && h.shares > 0)
      .map((h: any) => ({
        ticker: h.ticker as string,
        shares: h.shares as number,
        avg_cost_basis: h.avg_cost_basis as number,
      })),
    [rawHoldings],
  );

  // Determine which benchmark symbols we need
  const benchmarkConfig = BENCHMARK_SYMBOLS[benchmark];
  const benchmarkSymbols = Array.isArray(benchmarkConfig) ? benchmarkConfig : [benchmarkConfig];

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

  const isLoading = holdingsLoading || priceQueries.some(q => q.isLoading);
  const error = (holdingsError ?? priceQueries.find(q => q.error)?.error ?? null) as Error | null;

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
 * Uses individual useCompanyProfile queries (one per holding).
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
```

**Step 2: Build and verify**

```bash
npm run build
```

Expected: clean compile.

**Step 3: Commit**

```bash
git add src/hooks/usePortfolioPrices.ts
git commit -m "feat(performance): add usePortfolioPrices hook with parallel fetching"
```

---

## Task 4: `usePerformanceMetrics` Hook

**Files:**
- Create: `src/hooks/usePerformanceMetrics.ts`

**Step 1: Create the hook**

```typescript
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

    // 1. Portfolio daily values
    const portValues = buildPortfolioValues(holdings, priceMap);
    if (portValues.length < 2) return empty;

    // 2. Equity curve + drawdowns (sliced to selected date range)
    const equityCurve = buildEquityCurve(portValues, benchmarkValues, dateRange);
    const drawdownData = buildDrawdownSeries(equityCurve);

    // 3. Period metrics (always uses full history for all periods)
    const periods = computeAllPeriods(portValues, benchmarkValues);
    const summary = computeSummary(periods, BENCHMARK_LABELS[benchmark]);

    // 4. Attribution
    const sinceInceptionPeriod = periods.find(p => p.periodLabel === 'Since Inception');
    const startDate = portValues[0]?.date;
    const attribution = holdings.length > 0 && startDate
      ? buildAttributionRows(
          holdings.map(h => ({
            ticker: h.ticker,
            shares: h.shares,
            sector: sectorMap[h.ticker] ?? 'Unknown',
            currentPrice: Object.values(priceMap[h.ticker] ?? {}).at(-1) ?? 0,
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
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/hooks/usePerformanceMetrics.ts
git commit -m "feat(performance): add usePerformanceMetrics hook (useMemo computation layer)"
```

---

## Task 5: `PerformanceKpiGrid` Component

**Files:**
- Create: `src/components/performance/PerformanceKpiGrid.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/PerformanceKpiGrid.tsx
import { TrendingUp, TrendingDown, Activity, Shield, BarChart2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/ui/StatsCard';
import type { PerformanceSummary } from '@/lib/performanceTypes';

interface PerformanceKpiGridProps {
  summary: PerformanceSummary | null;
  isLoading: boolean;
}

function fmt(val: number, decimals = 2): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

export function PerformanceKpiGrid({ summary, isLoading }: PerformanceKpiGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      title: 'YTD Return',
      value: fmt(summary.ytdReturnPct),
      trend: summary.ytdVsBenchmarkPct,
      trendLabel: `vs ${summary.benchmarkLabel}`,
      valueClassName: summary.ytdReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: summary.ytdReturnPct >= 0 ? <TrendingUp /> : <TrendingDown />,
    },
    {
      title: '1Y Return',
      value: fmt(summary.oneYearReturnPct),
      trend: summary.oneYearVsBenchmarkPct,
      trendLabel: `vs ${summary.benchmarkLabel}`,
      valueClassName: summary.oneYearReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: summary.oneYearReturnPct >= 0 ? <TrendingUp /> : <TrendingDown />,
    },
    {
      title: 'Since Inception',
      value: fmt(summary.sinceInceptionReturnPct),
      description: 'Total return',
      valueClassName: summary.sinceInceptionReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: <Activity />,
    },
    {
      title: 'Volatility (1Y)',
      value: `${summary.volatility1YPct.toFixed(2)}%`,
      description: 'Annualized std dev',
      icon: <BarChart2 />,
    },
    {
      title: 'Sharpe (1Y)',
      value: summary.sharpe1Y.toFixed(2),
      description: summary.sharpe1Y >= 1 ? 'Good risk-adjusted return' : summary.sharpe1Y >= 0 ? 'Positive' : 'Below risk-free',
      valueClassName: summary.sharpe1Y >= 1 ? 'text-[hsl(var(--success))]' : summary.sharpe1Y < 0 ? 'text-[hsl(var(--danger))]' : undefined,
      icon: <Shield />,
    },
    {
      title: 'Max Drawdown',
      value: `${summary.maxDrawdownPct.toFixed(2)}%`,
      description: 'Peak to trough',
      valueClassName: 'text-[hsl(var(--danger))]',
      icon: <AlertTriangle />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(card => (
        <StatsCard
          key={card.title}
          title={card.title}
          value={card.value}
          description={card.description}
          trend={card.trend}
          trendLabel={card.trendLabel}
          valueClassName={card.valueClassName}
          icon={card.icon}
        />
      ))}
    </div>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/PerformanceKpiGrid.tsx
git commit -m "feat(performance): add PerformanceKpiGrid component"
```

---

## Task 6: `EquityCurveChart` Component

**Files:**
- Create: `src/components/performance/EquityCurveChart.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/EquityCurveChart.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import type { EquityPoint } from '@/lib/performanceTypes';

interface EquityCurveChartProps {
  data: EquityPoint[];
  benchmarkLabel: string;
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  // Show month+year for axis labels: "Jan '25"
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

export function EquityCurveChart({ data, benchmarkLabel, isLoading }: EquityCurveChartProps) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  // Thin data to max ~200 points for performance
  const step = Math.max(1, Math.floor(data.length / 200));
  const thinned = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Equity Curve (Normalized to 100)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={thinned} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(0)}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="portfolio"
              name="Portfolio"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkLabel}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/EquityCurveChart.tsx
git commit -m "feat(performance): add EquityCurveChart (Recharts LineChart)"
```

---

## Task 7: `DrawdownChart` Component

**Files:**
- Create: `src/components/performance/DrawdownChart.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/DrawdownChart.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Line, ComposedChart,
} from 'recharts';
import type { DrawdownPoint } from '@/lib/performanceTypes';

interface DrawdownChartProps {
  data: DrawdownPoint[];
  benchmarkLabel: string;
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

export function DrawdownChart({ data, benchmarkLabel, isLoading }: DrawdownChartProps) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  const step = Math.max(1, Math.floor(data.length / 200));
  const thinned = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Drawdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={thinned} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(0)}%`}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Area
              type="monotone"
              dataKey="portfolioDrawdownPct"
              name="Portfolio DD"
              stroke="hsl(var(--danger))"
              strokeWidth={1.5}
              fill="url(#ddGradient)"
            />
            <Line
              type="monotone"
              dataKey="benchmarkDrawdownPct"
              name={`${benchmarkLabel} DD`}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/DrawdownChart.tsx
git commit -m "feat(performance): add DrawdownChart (ComposedChart area + line)"
```

---

## Task 8: `PerformanceTable` Component

**Files:**
- Create: `src/components/performance/PerformanceTable.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/PerformanceTable.tsx
import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PeriodPerformance, TableMode } from '@/lib/performanceTypes';

interface PerformanceTableProps {
  rows: PeriodPerformance[];
  mode: TableMode;
  onModeChange: (mode: TableMode) => void;
  isLoading: boolean;
}

type SortKey = keyof PeriodPerformance;

function fmt(val: number | null, decimals = 2): string {
  if (val === null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

function fmtRaw(val: number | null, decimals = 2): string {
  if (val === null) return '—';
  return val.toFixed(decimals);
}

function ColoredCell({ value, suffix = '%', decimals = 2 }: { value: number | null; suffix?: string; decimals?: number }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
      {value >= 0 ? '+' : ''}{value.toFixed(decimals)}{suffix}
    </span>
  );
}

const PERIOD_ORDER = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'Since Inception'];

export function PerformanceTable({ rows, mode, onModeChange, isLoading }: PerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('periodLabel');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'periodLabel') {
      const ai = PERIOD_ORDER.indexOf(a.periodLabel);
      const bi = PERIOD_ORDER.indexOf(b.periodLabel);
      return sortAsc ? ai - bi : bi - ai;
    }
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortAsc
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const Th = ({ label, col, className }: { label: string; col: SortKey; className?: string }) => (
    <th
      className={cn('px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors', className)}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center">{label}<SortIcon col={col} /></span>
    </th>
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4">
        <Tabs value={mode} onValueChange={v => onModeChange(v as TableMode)}>
          <TabsList>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Period" col="periodLabel" className="pl-4" />
                {mode === 'returns' ? (
                  <>
                    <Th label="Portfolio" col="portfolioReturnPct" />
                    <Th label="Benchmark" col="benchmarkReturnPct" />
                    <Th label="Active" col="activeReturnPct" />
                    <Th label="Annualized" col="annualizedReturnPct" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Beat?</th>
                  </>
                ) : (
                  <>
                    <Th label="Volatility" col="volatilityPct" />
                    <Th label="Sharpe" col="sharpe" />
                    <Th label="Sortino" col="sortino" />
                    <Th label="Max DD" col="maxDrawdownPct" />
                    <Th label="Beta" col="beta" />
                    <Th label="Tracking Err" col="trackingErrorPct" />
                    <Th label="Info Ratio" col="informationRatio" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.periodLabel} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 pl-4 font-medium">{row.periodLabel}</td>
                  {mode === 'returns' ? (
                    <>
                      <td className="px-3 py-3"><ColoredCell value={row.portfolioReturnPct} /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.benchmarkReturnPct} /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.activeReturnPct} /></td>
                      <td className="px-3 py-3">
                        {row.annualizedReturnPct !== null
                          ? <ColoredCell value={row.annualizedReturnPct} />
                          : <span className="text-muted-foreground text-xs">{'< 1Y'}</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        {row.activeReturnPct >= 0
                          ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                          : <XCircle className="h-4 w-4 text-[hsl(var(--danger))]" />
                        }
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3">{row.volatilityPct.toFixed(2)}%</td>
                      <td className="px-3 py-3"><ColoredCell value={row.sharpe} suffix="" /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.sortino} suffix="" /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.maxDrawdownPct} /></td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtRaw(row.beta, 3)}</td>
                      <td className="px-3 py-3">{row.trackingErrorPct.toFixed(2)}%</td>
                      <td className="px-3 py-3"><ColoredCell value={row.informationRatio} suffix="" /></td>
                    </>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Not enough data to compute performance periods.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/PerformanceTable.tsx
git commit -m "feat(performance): add PerformanceTable with Returns/Risk modes and sorting"
```

---

## Task 9: `AttributionSection` Component

**Files:**
- Create: `src/components/performance/AttributionSection.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/AttributionSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AttributionRow, AttributionGrouping } from '@/lib/performanceTypes';

interface AttributionSectionProps {
  rows: AttributionRow[];
  grouping: AttributionGrouping;
  onGroupingChange: (g: AttributionGrouping) => void;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.abs(value) / max * 100 : 0;
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', positive ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]')}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium w-14 text-right', positive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  );
}

export function AttributionSection({ rows, grouping, onGroupingChange }: AttributionSectionProps) {
  if (rows.length === 0) return null;

  const maxContrib = Math.max(...rows.map(r => Math.abs(r.contributionReturnPct)));

  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Attribution</CardTitle>
        <Tabs value={grouping} onValueChange={v => onGroupingChange(v as AttributionGrouping)}>
          <TabsList className="h-8">
            <TabsTrigger value="sector" className="text-xs px-3">By Sector</TabsTrigger>
            <TabsTrigger value="ticker" className="text-xs px-3">By Position</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Segment</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Weight</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Return</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-48">Contribution</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Active Contrib</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => Math.abs(b.contributionReturnPct) - Math.abs(a.contributionReturnPct))
                .map(row => (
                  <tr key={row.segmentName} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.segmentName}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{row.weightPct.toFixed(1)}%</td>
                    <td className="px-3 py-3 text-right">
                      <span className={row.segmentReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                        {row.segmentReturnPct >= 0 ? '+' : ''}{row.segmentReturnPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 w-48">
                      <MiniBar value={row.contributionReturnPct} max={maxContrib} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={row.contributionActivePct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                        {row.contributionActivePct >= 0 ? '+' : ''}{row.contributionActivePct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/AttributionSection.tsx
git commit -m "feat(performance): add AttributionSection with sector/ticker grouping"
```

---

## Task 10: `CorrelationMatrix` Component

**Files:**
- Create: `src/components/performance/CorrelationMatrix.tsx`

**Step 1: Create the component**

```typescript
// src/components/performance/CorrelationMatrix.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CorrelationEntry } from '@/lib/performanceTypes';

interface CorrelationMatrixProps {
  entries: CorrelationEntry[];
  symbols: string[];
}

/** Map correlation -1..+1 to a background color */
function corrToColor(corr: number): string {
  // Negative: blue tones, positive: red tones, zero: neutral
  if (corr >= 0.8) return 'bg-red-500/80 text-white';
  if (corr >= 0.6) return 'bg-red-400/60 text-foreground';
  if (corr >= 0.4) return 'bg-red-300/50 text-foreground';
  if (corr >= 0.2) return 'bg-red-200/40 text-foreground';
  if (corr >= -0.2) return 'bg-muted text-foreground';
  if (corr >= -0.4) return 'bg-blue-200/40 text-foreground';
  if (corr >= -0.6) return 'bg-blue-300/50 text-foreground';
  if (corr >= -0.8) return 'bg-blue-400/60 text-foreground';
  return 'bg-blue-500/80 text-white';
}

export function CorrelationMatrix({ entries, symbols }: CorrelationMatrixProps) {
  if (symbols.length < 2 || entries.length === 0) return null;

  // Build lookup map
  const corrMap: Record<string, number> = {};
  for (const e of entries) {
    corrMap[`${e.assetA}|${e.assetB}`] = e.correlation;
    corrMap[`${e.assetB}|${e.assetA}`] = e.correlation;
  }

  const getCorr = (a: string, b: string): number | null => {
    if (a === b) return 1;
    return corrMap[`${a}|${b}`] ?? null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Correlation Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-16" />
                  {symbols.map(sym => (
                    <th key={sym} className="px-1 py-1 text-center font-medium text-muted-foreground w-16">
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map(rowSym => (
                  <tr key={rowSym}>
                    <td className="pr-2 py-1 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {rowSym}
                    </td>
                    {symbols.map(colSym => {
                      const corr = getCorr(rowSym, colSym);
                      return (
                        <td key={colSym} className="p-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'w-14 h-10 flex items-center justify-center rounded font-mono font-medium cursor-default transition-opacity hover:opacity-80',
                                  corrToColor(corr ?? 0),
                                )}
                              >
                                {corr !== null ? corr.toFixed(2) : '—'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Correlation between <strong>{rowSym}</strong> and <strong>{colSym}</strong>:{' '}
                                {corr !== null ? corr.toFixed(2) : 'N/A'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Build and verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/performance/CorrelationMatrix.tsx
git commit -m "feat(performance): add CorrelationMatrix heatmap component"
```

---

## Task 11: `Performance.tsx` Page (Full Replacement)

**Files:**
- Modify: `src/pages/Performance.tsx` (full replacement)

**Step 1: Replace the page**

```typescript
// src/pages/Performance.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  const sectorMap = useHoldingSectors(portfolioData.holdings.map(h => h.ticker));

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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <EquityCurveChart
            data={equityCurve}
            benchmarkLabel={BENCHMARK_LABELS[benchmark]}
            isLoading={isLoading}
          />
          <DrawdownChart
            data={drawdownData}
            benchmarkLabel={BENCHMARK_LABELS[benchmark]}
            isLoading={isLoading}
          />
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
```

**Step 2: Build — this is the final integration build**

```bash
cd C:/Users/PC/Downloads/market-pulse && npm run build
```

Expected: clean compile with no TypeScript errors.

**Step 3: Start the DefeatBeta backend, then preview the page**

```bash
node backend/server.js
```

Then open the preview server at `http://localhost:8080/performance`.

Verify:
- [ ] Holdings loaded from Supabase
- [ ] KPI strip shows values (or skeletons if backend loading)
- [ ] Equity curve chart renders with portfolio + benchmark lines
- [ ] Drawdown chart renders
- [ ] Table shows period rows, switching Returns/Risk modes works
- [ ] Attribution section appears if sector data loads
- [ ] Correlation matrix appears for 2+ holdings
- [ ] Changing benchmark dropdown updates all sections
- [ ] Changing date range (1Y/3Y/Max) updates charts

**Step 4: Final commit**

```bash
git add src/pages/Performance.tsx
git commit -m "feat(performance): wire full Performance page with all components"
```

---

## Summary of All Files Created/Modified

| File | Status |
|---|---|
| `src/lib/performanceTypes.ts` | Create |
| `src/lib/performanceCalc.ts` | Create |
| `src/hooks/usePortfolioPrices.ts` | Create |
| `src/hooks/usePerformanceMetrics.ts` | Create |
| `src/components/performance/PerformanceKpiGrid.tsx` | Create |
| `src/components/performance/EquityCurveChart.tsx` | Create |
| `src/components/performance/DrawdownChart.tsx` | Create |
| `src/components/performance/PerformanceTable.tsx` | Create |
| `src/components/performance/AttributionSection.tsx` | Create |
| `src/components/performance/CorrelationMatrix.tsx` | Create |
| `src/pages/Performance.tsx` | Replace |

Total: 10 new files, 1 replacement.
