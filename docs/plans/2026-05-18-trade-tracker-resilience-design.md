# Trade Tracker Resilience Bundle — Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Scope:** `src/components/trading/TradeTracker.tsx` and its stores, on `/trading`.

## Context

Visiting `/trading` mounts `TradeTracker`, which calls `useTradeJournal()`.
A regression (`export … from` with no local binding) made the hook throw
`ReferenceError: computePnL is not defined` whenever the journal was
non-empty; with **no ErrorBoundary anywhere**, React unmounted the whole app
→ blank white screen on every visit. Root cause fixed in commit `3bcb6da`.

This bundle hardens against the *class* of failure that produced it: a bad
render in one widget, and unsanitized `localStorage` reaching React render.

## Goals

1. A crash in one Trading widget must never blank the whole site.
2. Corrupt/legacy `localStorage` must never throw during render — repair or
   drop bad rows, and tell the user once.
3. Destructive actions (discard, close-to-Journal) must be reversible.

## Hard constraint

`src/App.tsx` is in the user's uncommitted WIP. **No app-root changes.**
All work lands in new files or non-WIP files: `Trading.tsx`,
`src/lib/openTradesStore.ts`, `src/hooks/useOpenTrades.ts`,
`src/hooks/useTradeJournal.ts`, and new files under
`src/components/common/`.

## Part 1 — `<ErrorBoundary>` (per-widget)

- **New** `src/components/common/ErrorBoundary.tsx`: dependency-free React
  class component. Props: `fallback?: (reset) => ReactNode`, `name?: string`.
  `componentDidCatch` logs `[ErrorBoundary:<name>]` + error to console.
  Default fallback: a compact `trading-card` reading "This panel hit an
  error" + a **Try again** button that resets boundary state.
- **`Trading.tsx`**: wrap `<TradeTracker/>`, `<Watchlist/>`,
  `<SymbolChart/>`, `<QuickOrder/>` each in its own `<ErrorBoundary>`.
  Rationale: a broken Trade Tracker shows a small recoverable card while the
  rest of the page keeps working (vs. one page-level boundary that blanks
  the whole route).

## Part 2 — Self-healing storage

The true root-cause fix for "bad localStorage → render throw."

- **`src/lib/openTradesStore.ts` → `parseOpenTrades`**: per-row validation —
  drop rows that aren't plain objects or lack a string `id`/`symbol` or
  finite numeric `entryPrice`/`quantity`; coerce safe types; clamp
  `side` to `'long'|'short'`. Add schema key `tp-open-trades-v` (current
  shape = v1). Return `{ trades: OpenTrade[]; dropped: number }`.
  `useOpenTrades.readLS` consumes `.trades`; surfaces `.dropped`.
- **`src/hooks/useTradeJournal.ts` → new `parseJournal(raw)`**: analogous
  sanitizer for `trade-journal-v1` (the store that actually crashed). Repair
  rather than drop where safe: missing `exitDate` ← `entryDate` ← `createdAt`
  ← `''`; ensure `tags` is an array; numeric coercion for money fields.
  Drop only rows missing `id`+`symbol`. `lsRead` delegates to it.
- **Notice (Decision A = one-time toast):** when `dropped > 0` or any row
  repaired, fire a single non-blocking `sonner` toast: "Recovered your
  saved data — skipped N unreadable rows." Guard with a module-level
  `notified` flag so it shows once per session, not per render.

## Part 3 — Undo (Decision B = discard + close)

`sonner` is already imported; use action toasts.

- **`useTradeJournal.addTrade`**: return the generated `id` (currently
  returns `void`). No behavior change for existing callers.
- **Discard (X):** `TradeTracker` keeps the removed `OpenTrade` in a ref;
  `removeOpen` then `toast("Trade discarded", { action: { label:'Undo',
  onClick: () => addOpen(removed) } })`, ~6s.
- **Close → Journal:** capture the `OpenTrade` + the `id` returned by
  `addTrade`. `toast("AAPL filed to Journal", { action: { label:'Undo',
  onClick: () => { deleteTrade(id); addOpen(originalTrade); } } })`.
  Re-uses existing `deleteTrade` + `addOpen`; restores both stores.

## Testing

- `src/lib/openTradesStore.test.ts` (exists) — extend: non-array input,
  non-object rows, missing/invalid fields, version handling; assert
  `{ trades, dropped }`.
- New `src/lib/` or co-located unit tests for `parseJournal` (pure fn) —
  malformed entries, missing `exitDate` repair, non-array input.
- Vitest harness is `src/lib/**` node-only → parser tests run there.
- ErrorBoundary + Undo are interaction behavior (not unit-testable in that
  harness): verified via `tsc` + `npm run build` + a throttle-immune
  manual reproduction (force a child throw → fallback shows, siblings live;
  discard→Undo and close→Undo round-trips restore state).

## Out of scope

App-root/global ErrorBoundary (App.tsx is WIP); the Risk-cockpit, partial
closes, and feedback-loop ideas from the brainstorm (separate designs).

## Files touched

New: `src/components/common/ErrorBoundary.tsx`,
`src/lib/parseJournal.ts` (+ test), `openTradesStore.test.ts` (extend).
Modified: `src/pages/Trading.tsx`, `src/lib/openTradesStore.ts`,
`src/hooks/useOpenTrades.ts`, `src/hooks/useTradeJournal.ts`,
`src/components/trading/TradeTracker.tsx`.
