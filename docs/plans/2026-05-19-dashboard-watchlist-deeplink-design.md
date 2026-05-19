# Dashboard: Watchlist-driven list + Sticky/Shareable selection — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** new `src/lib/dashboardStocks.ts` (+test) + modify `src/components/layout/Dashboard.tsx`.

## Goal

Two improvements to the Dashboard:
1. The prominent left list shows an arbitrary alphabetical first-10 of ~1000
   DB stocks. Make it the user's **watchlist**; when empty, fall back to
   **top movers** + an add CTA.
2. The selected (active) stock resets on reload and isn't shareable. Make it
   **persist via URL `?sym=` + localStorage**.

## Decision

Approach A: extract the resolution/fallback/ordering logic into a pure,
unit-tested lib; keep `Dashboard.tsx` thin glue. (Rejected: inlining
untested logic in a 320-line file; a new context store — URL+localStorage
already is the store.)

## Part 1 — `resolveDisplayStocks` (pure lib, TDD)

`src/lib/dashboardStocks.ts`:
`resolveDisplayStocks(stocks, watchlistSymbols, limit = 10): { list: Stock[]; source: 'watchlist' | 'movers' }`
- Resolve each `watchlistSymbols` entry against `stocks` by symbol,
  case-insensitive, preserving watchlist order; drop unresolved symbols.
- If the resolved list is empty → `list` = top `limit` of `stocks` sorted by
  `|changePercent|` descending; `source = 'movers'`. Otherwise
  `source = 'watchlist'` (cap to `limit`).
- Total, never throws (guards non-array inputs, missing `symbol`/
  `changePercent`). `Stock` typed loosely (`{ symbol: string;
  changePercent?: number; ... }`) to match the existing `useStocks` row
  shape without coupling.
- Unit-tested in the `src/lib/**/*.test.ts` Vitest node harness
  (failing-test-first).

## Part 2 — `Dashboard.tsx` wiring (only this file; editable, NOT WIP)

- `useWatchlist()` → `symbols`. `const { list, source } = useMemo(
  () => resolveDisplayStocks(stocks, symbols), [stocks, symbols])`.
- Render `list` (replacing `stocks.slice(0, 10)`) **inside the existing**
  `ready`-gate and `<ErrorBoundary name="AllStocks">` shipped in the
  resilience bundle — preserve both wrappers exactly.
- Heading: `source === 'watchlist' ? 'Your Watchlist' : 'Top Movers'`
  (replaces the static `All Stocks` `<h2>`).
- When `source === 'movers'`: a subtle CTA under the list — a
  react-router `<Link to="/watchlists">` "Add symbols to build your
  watchlist →" (route exists). No add-from-dashboard (YAGNI).
- **Selection persistence:** `useSearchParams()` (react-router; already used
  via `Link`). Initial active symbol resolution order: `?sym=` →
  `localStorage['dash-active-sym']` → `stocks[0]`. A param/stored symbol not
  present in `stocks` is ignored (falls through). On card click:
  `setSelectedStock(stock)`, set `?sym=SYMBOL` (replace, no history spam) and
  mirror to `localStorage`. `activeStock` derivation must remain compatible
  with the existing `StockChart`/`StockFundamentalsPanel`/Market-Cap usage.

## Constraints

- New `src/lib/dashboardStocks.ts` (+ test) and edits to
  `src/components/layout/Dashboard.tsx` ONLY. NEVER touch/stage `src/App.tsx`,
  `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`,
  `src/pages/TradeJournal.tsx`.
- Preserve the shipped resilience wrapping (per-widget `ErrorBoundary`,
  `ready` skeleton, `DeferUntilVisible`) — only change the All-Stocks data
  source, heading, CTA, and add selection persistence.
- Never `git add -A`; commits local until the user says push.
- No dev server. Verify: `resolveDisplayStocks` via Vitest; wiring via
  `npx tsc --noEmit` + `npm run build` + static review (port 8080 stays free).

## Testing

- `resolveDisplayStocks`: TDD — watchlist resolution + order preservation,
  case-insensitive match, unresolved-symbol drop, empty → movers sort,
  non-array/missing-field safety, `limit` cap.
- Dashboard wiring: `tsc` 0, `npm run build` ✓, static read confirming
  (a) list renders `list` not `stocks.slice`, (b) heading switches on
  `source`, (c) movers CTA present, (d) `useSearchParams`/localStorage
  selection sync, (e) resilience wrappers intact, (f) WIP files untouched.

## Out of scope (YAGNI)

Add/remove watchlist entries from the dashboard, multiple watchlists,
server-side movers, configurable list length, history deep-link beyond
`?sym=`.

## Files

New: `src/lib/dashboardStocks.ts` (+ `dashboardStocks.test.ts`).
Modified: `src/components/layout/Dashboard.tsx`.
Never touched: `App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`.
