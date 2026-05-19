# Dashboard: Inline Watchlist Add/Remove + Movers Callout — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** extend `src/lib/dashboardStocks.ts` (+test); modify `src/components/layout/Dashboard.tsx`.

## Goal

The dashboard list is now the user's watchlist (shipped) but read-only.
Add: (1) inline add/remove of watchlist symbols without leaving the page;
(2) a one-line "your biggest gainer/loser today" callout.

## Decision

Extend the existing pure `dashboardStocks` lib for the movers calc (TDD);
do all UI in `Dashboard.tsx`. **Do not modify the shared `StockCard`**
(use an absolutely-positioned overlay ✕). Rejected: a full remote-search
autocomplete component (extra surface; Trading Watchlist already exists for
richer add); adding `onRemove` to `StockCard` (touches a widely-shared
component — risk).

## Part 1 — `watchlistMovers` (pure, TDD)

Add to `src/lib/dashboardStocks.ts`:
`watchlistMovers<T extends StockLike>(stocks, symbols): { best: T; worst: T } | null`
- Resolve `symbols` against `stocks` using the same case-insensitive match
  as `resolveDisplayStocks`.
- `best` = max `changePercent`, `worst` = min `changePercent` among resolved.
- Returns `null` if fewer than 1 resolves. If only one resolves, best===worst
  (caller can render a single entry) — keep simple: still return both.
- Total, never throws (guards non-array / missing fields). Extend
  `src/lib/dashboardStocks.test.ts` (failing-first).

## Part 2 — `Dashboard.tsx` (only this file)

- **Add control:** beneath the list `<h2>`, a compact controlled text input
  that filters the already-loaded `stocks` (by symbol or name, case-insensitive,
  ≤6 matches in a small dropdown). Selecting a match → `useWatchlist().add(sym)`
  then clears the input. Empty / no match → no-op. No new data fetch (reuses
  `stocks` in scope). `useWatchlist()` already destructured for `symbols`;
  also pull `add`, `remove`.
- **Remove:** wrap each list row in a `relative` container; an
  absolutely-positioned ✕ button (visible on hover/focus,
  `aria-label="Remove {sym}"`) → `useWatchlist().remove(stock.symbol)`.
  Rendered **only when `listSource === 'watchlist'`** (movers-fallback rows
  stay read-only). `StockCard` itself unchanged; row click → existing
  `selectStock` still works (✕ uses `e.stopPropagation()`).
- **Movers callout:** when `listSource === 'watchlist'` and
  `watchlistMovers(stocks, watchSymbols)` is non-null, a one-line strip under
  the heading: `▲ {best.symbol} +x.x%` (green) `· ▼ {worst.symbol} −y.y%`
  (red). Hidden otherwise (incl. movers-fallback mode).
- Preserve EXACTLY: the `ready` skeleton gate, `<ErrorBoundary name="AllStocks">`,
  `DeferUntilVisible`, `selectStock`/`?sym=`+localStorage wiring, and the
  movers→`/watchlists` CTA.

## Constraints

Extend `src/lib/dashboardStocks.ts` (+ its test) and edit
`src/components/layout/Dashboard.tsx` ONLY. Never touch/stage `App.tsx`,
`MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`. Explicit
`C:\Users\PC\Downloads\market-pulse` path for every tool. Never `git add -A`;
commits local until the user says push. No dev server — `watchlistMovers`
via Vitest; UI via `tsc` + `build` + static review.

## Testing

- `watchlistMovers`: TDD — resolves subset, best/worst by `changePercent`,
  case-insensitive, `null` when none resolve, non-array safe.
- Dashboard wiring: `tsc` 0, `build` ✓, static read confirming add input +
  hover ✕ (watchlist-mode-gated) + callout present and the shipped
  wrappers/wiring intact; WIP untouched.

## Out of scope (YAGNI)

Remote-symbol-search autocomplete, multi-watchlist, drag-reorder, price
alerts (separate bundle), edit/remove in movers-fallback mode.

## Files

Modified: `src/lib/dashboardStocks.ts` (+ `dashboardStocks.test.ts`),
`src/components/layout/Dashboard.tsx`.
Never touched: `App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`.
