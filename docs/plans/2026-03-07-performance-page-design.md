# Performance Page Design

**Date:** 2026-03-07
**Status:** Approved

---

## Overview

Build a full Performance tab for the MarketPulse portfolio web app. The page gives medium-to-advanced investors a complete view of their portfolio's historical returns, risk metrics, benchmark comparisons, sector attribution, and asset correlation — all computed client-side from real data sources.

---

## Data Sources

- **Portfolio holdings:** `usePortfolio()` → Supabase (symbol, quantity, costBasis, marketValue)
- **Historical prices:** DefeatBeta backend `GET /api/prices?symbol=X&days=1825` → OHLCV bars per symbol
- **Benchmark prices:** Same DefeatBeta endpoint, symbols: `SPY`, `QQQ`, `ACWI`, plus synthetic 60/40 blend
- **Sector attribution:** `useCompanyProfile()` per holding → sector label for grouping
- **No mock data** — loading states use skeletons; empty portfolio shows a proper empty state

---

## Approach: Layered Hooks + Pure Computation Module

Chosen over a single mega-hook (too monolithic) and a server-side edge function (premature).

---

## Data Layer

### `src/lib/performanceCalc.ts` — Pure math, no React

| Function | Input | Output | Notes |
|---|---|---|---|
| `buildPortfolioEquityCurve` | holdings, pricesBySymbol | `EquityPoint[]` | Aligns date ranges, computes daily portfolio value = Σ(qty_i × price_i(t)), normalizes to 100 |
| `buildDrawdownSeries` | equityCurve | `DrawdownPoint[]` | Rolling max drawdown from equity curve |
| `computePeriodMetrics` | curve, benchmarkCurve, label | `PeriodPerformance` | Slices for 1M/3M/YTD/1Y/3Y/5Y/Since Inception; derives all return + risk metrics |
| `computeKpis` | periods, benchmarkLabel | `PerformanceSummary` | Extracts headline values for KPI strip |
| `buildAttributionRows` | holdings, pricesBySymbol, profiles | `AttributionRow[]` | Groups by sector or ticker |
| `buildCorrelationMatrix` | pricesBySymbol | `CorrelationEntry[]` | Pearson correlation of daily log returns |

**Risk metric formulas:**
- Volatility: annualized std dev of daily log returns × √252
- Sharpe: (annualized return − 0) / volatility (rf = 0)
- Sortino: annualized return / downside deviation (returns below 0)
- Beta: cov(portfolio, benchmark) / var(benchmark)
- Tracking Error: std dev of (portfolio daily return − benchmark daily return) × √252
- Information Ratio: active return / tracking error
- Max Drawdown: max(peak − trough) / peak over the period

### `src/hooks/usePortfolioPrices.ts`

- Calls `usePortfolio()` for holdings
- Fires parallel `useHistoricalPrices(symbol, 1825)` for each holding + selected benchmark
- Returns `{ pricesBySymbol, holdings, isLoading, error }` — loading until ALL resolve

### `src/hooks/usePerformanceMetrics.ts`

- Accepts `{ pricesBySymbol, holdings, benchmark, dateRange }`
- Runs all `performanceCalc` functions in `useMemo` (recomputes on input change)
- Returns `PerformanceData: { equityCurve, drawdownData, periods, kpis, attribution, correlations }`

---

## TypeScript Types

```ts
type EquityPoint = { date: string; portfolio: number; benchmark: number }
type DrawdownPoint = { date: string; portfolioDrawdownPct: number; benchmarkDrawdownPct: number }
type PeriodPerformance = {
  periodLabel: string       // "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y" | "Since Inception"
  portfolioReturnPct: number
  benchmarkReturnPct: number
  activeReturnPct: number
  annualizedReturnPct: number | null
  volatilityPct: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
  beta: number
  trackingErrorPct: number
  informationRatio: number
}
type PerformanceSummary = {
  ytdReturn: number; ytdVsBenchmark: number
  oneYearReturn: number; oneYearVsBenchmark: number
  sinceInceptionReturn: number
  volatility1Y: number
  sharpe1Y: number
  maxDrawdown: number
  benchmarkLabel: string
}
type AttributionRow = {
  segmentType: 'sector' | 'ticker'
  segmentName: string
  weightPct: number
  segmentReturnPct: number
  contributionReturnPct: number
  contributionActivePct: number
}
type CorrelationEntry = { assetA: string; assetB: string; correlation: number }
```

---

## Component Architecture

```
src/
  lib/
    performanceCalc.ts
  hooks/
    usePortfolioPrices.ts
    usePerformanceMetrics.ts
  components/
    performance/
      PerformanceKpiGrid.tsx
      EquityCurveChart.tsx
      DrawdownChart.tsx
      PerformanceTable.tsx
      AttributionSection.tsx
      CorrelationMatrix.tsx
  pages/
    Performance.tsx
```

---

## Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Performance        [Benchmark ▾]  [1Y · 3Y · Max]  [Returns|Risk] │
├──────────────────────────────────────────────────────────────┤
│ KPI Strip (6 cards)                                          │
│ YTD Return │ 1Y Return │ Since Inception │ Vol │ Sharpe │ Max DD │
├─────────────────────────┬────────────────────────────────────┤
│ Equity Curve            │ Drawdown Chart                     │
│ (normalized to 100)     │ (area, red fill, negative Y)       │
├──────────────────────────────────────────────────────────────┤
│ [Returns Tab] [Risk Tab]  — sortable table by period         │
├──────────────────────────────────────────────────────────────┤
│ Attribution  (if sector data available)                      │
│ Correlation Matrix  (if 2+ holdings)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Controls State (lives in `Performance.tsx`)

| State | Type | Effect |
|---|---|---|
| `benchmark` | `'SPY' \| 'QQQ' \| 'ACWI' \| '6040'` | Re-fetches benchmark prices, re-runs useMemo |
| `dateRange` | `'1Y' \| '3Y' \| 'Max'` | Slices equityCurve + drawdownData passed to charts |
| `tableMode` | `'returns' \| 'risk'` | Switches PerformanceTable column set |
| `attributionGrouping` | `'sector' \| 'ticker'` | Switches AttributionSection grouping |

---

## Component Details

### `PerformanceKpiGrid`
- 6 `StatsCard` instances (reuse existing component)
- Each card: label + big value + small "vs SPY" delta in green/red
- Responsive: 2×3 on mobile, 6×1 on desktop

### `EquityCurveChart`
- Recharts `LineChart`, both lines normalized to 100 at period start
- Portfolio: primary blue; Benchmark: muted gray
- Tooltip: date + both values
- Reference line at 100

### `DrawdownChart`
- Recharts `AreaChart` with `fill` on portfolio drawdown (red, semi-transparent)
- Benchmark drawdown as thin gray line overlay
- Y-axis always negative; reference line at 0

### `PerformanceTable`
- shadcn `Table` with sortable column headers (click to toggle asc/desc)
- Returns mode: Period, Portfolio%, Benchmark%, Active%, Annualized%, Beat? icon
- Risk mode: Period, Vol%, Sharpe, Sortino, MaxDD%, Beta, TrackingError%, IR
- Positive values: `text-[hsl(var(--success))]`; negatives: `text-[hsl(var(--danger))]`
- Horizontally scrollable on small screens

### `AttributionSection`
- Shown only when `useCompanyProfile()` data is available for at least one holding
- Tabs: By Sector | By Position
- Inline mini bar inside Contribution cell (green/red)

### `CorrelationMatrix`
- Shown only when portfolio has 2+ holdings
- Square CSS grid, cells colored: blue (negative) → white (0) → red (+1)
- Correlation value shown to 2 decimal places
- Tooltip: "Correlation between X and Y: 0.72"

---

## Loading & Error States

- Full-page skeleton while `isLoading` (KPI strip shows 6 skeleton cards, charts show skeleton rectangles)
- Per-section error boundaries with retry button
- Empty state: "Add holdings to your portfolio to see performance analytics" with a link to Portfolio page

---

## Out of Scope (Future)

- Custom date range picker
- PDF export
- Cash flow-adjusted TWRR (positions opened mid-period)
- Server-side `api-performance` edge function
