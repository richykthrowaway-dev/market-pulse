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
