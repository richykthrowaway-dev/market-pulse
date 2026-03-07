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
  const portReturn  = n > 1 && portValues[0]  > 0 ? (portValues[n - 1]  / portValues[0]  - 1) * 100 : 0;
  const benchReturn = n > 1 && benchValues[0] > 0 ? (benchValues[n - 1] / benchValues[0] - 1) * 100 : 0;
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

  const downsideDev = portLogRets.length > 1
    ? Math.sqrt(
        portLogRets.reduce((s, r) => s + (r < 0 ? r ** 2 : 0), 0) / portLogRets.length
      ) * Math.sqrt(252) * 100
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
