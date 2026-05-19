# Dashboard Resilience + Lazy Embeds — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** `src/components/layout/Dashboard.tsx` + new `src/components/common/DeferUntilVisible.tsx`.

## Problem

The Dashboard (highest-traffic page) still has the failure modes the rest of
the app no longer does:
- A **single full-page spinner gate**: `if (stocksLoading || !activeStock)
  return <spinner>` — a slow/failed `useStocks` query blanks the entire page.
- **No per-widget isolation**: only `YourSnapshot` is `ErrorBoundary`-wrapped;
  News, the 500 px TradingView iframe, breadth, fundamentals, and the
  4-provider market-cap card all run bare — one flaky source can blank the page.
- Heavy below-the-fold embeds (TradingView iframe, `MarketBreadthCards`)
  mount on first paint, slowing it.

## Decision (Approach A — targeted, minimal)

Reuse the shipped `ErrorBoundary`, standard skeleton placeholders, and one
small `IntersectionObserver` wrapper. No widget-bundle refactor (rejected B:
invasive, risks the active-stock selection logic). No page-level-only
boundary (rejected C: fixes neither problem).

## Part 1 — Remove the full-page spinner

`Dashboard()` keeps calling all hooks unconditionally (order preserved), but
the early `return <spinner>` is removed. Add `const ready = !stocksLoading
&& !!activeStock;`. The page frame, `YourSnapshot`, and the
non-stock-dependent widgets (market overview / indices / breadth / news —
they use their own hooks, not `activeStock`) **always render**. Only the
**stock-dependent block** — the Market-Cap stat value, the "All Stocks"
list, `StockChart`, `StockFundamentalsPanel` — shows a compact
`animate-pulse` skeleton while `!ready`, then swaps to real content. No code
path can blank the whole page on a slow/failed stocks query.

## Part 2 — Per-widget ErrorBoundary

Wrap each independent widget in `@/components/common/ErrorBoundary` with a
descriptive `name`: the stats row, the All-Stocks list, `StockChart`,
`StockFundamentalsPanel`, `NewsCard`, the TradingView card,
`MarketOverviewCard`, `MarketOverview`, `MarketBreadthCards`. A failing
data source/iframe degrades to the existing compact "panel hit an error"
fallback; siblings stay up. Consistent with Trading + `YourSnapshot`.

## Part 3 — Defer heavy embeds

**New** `src/components/common/DeferUntilVisible.tsx`:
- Props: `children`, `minHeight?: number` (placeholder reserved height,
  default e.g. 300), `rootMargin?: string` (default `'200px'`).
- Renders a reserved-height placeholder `<div>` until an
  `IntersectionObserver` reports it near the viewport, then renders
  `children` and stays mounted (observer disconnected after first hit).
  SSR/no-IO-safe: if `IntersectionObserver` is undefined, render children
  immediately.
Wrap the **TradingView 500 px iframe card** and **`MarketBreadthCards`** in
it → faster first paint, no layout shift (height reserved).

## Constraints

- Edit only `Dashboard.tsx` (editable; NOT user WIP) + create
  `DeferUntilVisible.tsx`. NEVER touch/stage `src/App.tsx`,
  `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`,
  `src/pages/TradeJournal.tsx`. All changes live inside `dashboardContent` +
  the loading-gate line, so the WIP `<MobileShell>` wrapper is untouched.
- Never `git add -A`; commits local until the user says push.
- No dev server; verify via `npx tsc --noEmit` + `npm run build` + static
  review (keep port 8080 free).

## Testing

No new pure logic — `ErrorBoundary` is already proven; `DeferUntilVisible`
is IO/DOM UI (not node-unit-testable in the `src/lib` Vitest harness, which
is expected, not a gap). Verify: `tsc` 0, `npm run build` ✓ (pre-existing
chunk/`articles.ts` warnings OK), and a static read confirming (a) no
remaining full-page early-return spinner, (b) every listed widget wrapped,
(c) the two embeds wrapped in `DeferUntilVisible`, (d) WIP files untouched.

## Out of scope (YAGNI)

Per-widget refetch/retry UI, skeletons for widgets that already self-handle
empty states, configurable defer thresholds beyond `minHeight`/`rootMargin`,
React.lazy code-splitting of widget bundles.

## Files

New: `src/components/common/DeferUntilVisible.tsx`.
Modified: `src/components/layout/Dashboard.tsx`.
Never touched: `App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`.
