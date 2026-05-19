# Dashboard Insights Bundle (6 features) — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** 6 new pure libs (+tests) in `src/lib`, wiring in `src/components/layout/Dashboard.tsx`, and one read-only `earnings` case added to `supabase/functions/api-finnhub/index.ts` (+ redeploy) for #1 only.

## Goal

Add six additive, production-ready dashboard widgets. No mock/localhost-only data: every data path is loaded `stocks`, a deployed edge function, localStorage, or already-fetched news.

## Decision

Reuse the proven pattern: pure, unit-tested logic in `src/lib` (Vitest node harness, TDD failing-first); thin glue in `Dashboard.tsx`; each new widget wrapped in its own `<ErrorBoundary name=...>`. No edits to shared components (`StockCard`, etc.). No new deps.

Rejected: a generic "widget framework" (YAGNI); client-side Finnhub calls (would leak the key — proxy via the existing edge function).

## Features

1. **Earnings-this-week** — `earningsWindow(rows, now)` buckets Finnhub earnings-calendar rows into this-week / next by date. Prod data: extend `api-finnhub` with an `earnings` endpoint (`GET /calendar/earnings?from&to`, existing key). New client hook calls it for watchlist symbols. One-line strip under the list. If the endpoint errors → ErrorBoundary hides it (no crash).
2. **Watchlist day heatmap** — `watchlistHeatmap(stocks, symbols)` resolves symbols (case-insensitive, reuse the dashboardStocks match style), returns cells sorted by `changePercent` desc with an intensity bucket. Compact colored grid. Pure, never throws.
3. **Sector exposure mini-bar** — `sectorExposure(stocks, symbols)` maps resolved symbols through the static `src/lib/sectorMap.ts`, returns `{ sector, pct }[]` (descending), "Unknown" bucket for misses. Stacked horizontal bar + small legend using existing `gicsColors`.
4. **Price-alert chips** — `priceAlerts.ts`: pure `evaluateAlerts(alerts, priceBySym)` → triggered list (above/below target). localStorage store key `dash-price-alerts-v1` (self-healing parse, same pattern as journal). Small input (symbol + target) + chip strip with ✕ remove. No backend.
5. **52-week range bar** — `weekRangePosition(low, high, price)` → clamped 0..1 (null if invalid). Uses the deployed `api-52week` function for the active stock. A thin bar rendered inside the existing Fundamentals area of `Dashboard.tsx` (no shared-component edit).
6. **News sentiment tag** — `headlineSentiment(text)` keyword lexicon → `'bull' | 'bear' | 'neutral'` (pure, deterministic, no LLM/cost). Inline badge on TopStories headlines, rendered in `Dashboard.tsx`.

## Constraints

- Create only the 6 `src/lib/*.ts` (+ `.test.ts`) and edit only `src/components/layout/Dashboard.tsx` and `supabase/functions/api-finnhub/index.ts`.
- NEVER touch/stage `src/App.tsx`, `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/TradeJournal.tsx`.
- Never `git add -A`. Commits LOCAL until the user says push. Edge-function deploy only on explicit user go.
- Every tool uses the explicit `C:\Users\PC\Downloads\market-pulse` path (shell defaults elsewhere).
- No dev server: libs via Vitest, UI via `tsc` + `build` + static review (port 8080 free).
- Preserve every shipped wrapper exactly: `ready` gate, all `ErrorBoundary name=`, `DeferUntilVisible`, `?sym=`+localStorage selection, watchlist add/remove/movers callout, movers→`/watchlists` CTA.

## Testing

- Each lib: TDD (failing-first) — happy path, case-insensitivity/resolution, empty/`null`/non-array safety, clamping/bucketing edges.
- `api-finnhub` earnings case: manual contract check (endpoint param routed, date range passthrough) — no unit harness for edge fns.
- Wiring: `npx vitest run` green, `tsc` 0, `npm run build` ✓ (pre-existing chunk + articles warnings expected), static greps confirm widgets + preserved wrappers, diff scope = only the allowed files, WIP untouched.

## Out of scope (YAGNI)

Configurable widget order, multi-watchlist, server-persisted alerts, push notifications, historical earnings, ML sentiment.

## Files

New: `src/lib/{earningsWindow,watchlistHeatmap,sectorExposure,priceAlerts,weekRangePosition,headlineSentiment}.ts` (+ `.test.ts` each).
Modified: `src/components/layout/Dashboard.tsx`, `supabase/functions/api-finnhub/index.ts`.
Never touched: `App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`.
