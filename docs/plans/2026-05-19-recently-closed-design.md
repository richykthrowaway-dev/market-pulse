# Recently-Closed Section in Trade Tracker — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** `src/components/trading/TradeTracker.tsx` only.

## Goal

Show the user's most recent **closed** trades inside the Trade Tracker,
below the open positions, so they can review what they just did without
leaving for the Journal.

## Approach (chosen: A)

A read-only, collapsible **"Recently closed (N)"** section sourced from the
existing `useTradeJournal()` store — which already returns `trades` sorted
newest-first by `exitDate` and is self-healed by `parseJournal` (Round-1).
Take `.slice(0, 5)`. No new store, no schema change, no duplicated data.

Rejected: a separate "recently closed" store (duplicates Journal data,
drift risk — the codebase explicitly avoids duplicating the trade shape);
keeping closed trades in `tp-open-trades-v1` with a flag (pollutes the
open-trades store, breaks the "close = one Journal write" model).

## Behavior

- `TradeTracker` already calls `useTradeJournal()` for `addTrade`/
  `deleteTrade`. Also pull `trades` from that SAME call (no extra hook).
- Section renders only when `trades.length > 0`.
- Header is a button: `Recently closed ({trades.length}) ▾/▸`, collapsed by
  default (`useState(false)`); toggles an expanded list of up to the **5**
  most recent `trades`.
- Each row is **read-only**, compact, one line where possible:
  `SYM · side · qty · $entry→$exit · ±$pnl (±R) · <tag> · <exitDate>`
  - P&L `$` from `computePnL(t)` (already imported/exported via
    `useTradeJournal`/`@/lib/tradeMath`); green ≥ 0 else red.
  - `R` from `computeR(t)` — omit the `(±R)` chunk when it returns null
    (no stop recorded).
  - Tag = `t.tags?.[0]` (the plan-adherence tag added in Round-2); omit if
    absent. Fall back to `t.exitReason` if no tag.
  - Date = `t.exitDate` (string already `YYYY-MM-DD`).
- No actions (no reopen/delete/navigate). The Journal owns edits.
- Placement: in the right-hand "Open positions" column, AFTER the open list
  / open-risk strip, as the last block in that column.
- Lives inside the existing per-widget `ErrorBoundary`; reads
  `parseJournal`-healed data → cannot white-screen.

## Implementation shape

A module-scope `RecentlyClosed` presentational component in
`TradeTracker.tsx` taking `trades: TradeEntry[]` as a prop (no hooks of its
own except a local `useState` for collapse) + a small pure formatter inline.
`TradeTracker` passes the `trades` it already has from `useTradeJournal()`.

Reuse existing helpers: `computePnL`, `computeR` (from
`@/hooks/useTradeJournal` re-exports / `@/lib/tradeMath`), and the existing
`money(...)` helper in the file. `TradeEntry` type already imported context
in the file via `useTradeJournal` types (`type TradeSide, ExitReason`); add
a `type TradeEntry` import from `@/hooks/useTradeJournal` if not present.

## Testing

No new pure logic (`computePnL`/`computeR` already unit-tested). Verify via
`npx tsc --noEmit` + `npm run build` + manual: close a trade → it appears at
top of "Recently closed (N)"; collapse/expand works; section hidden when the
Journal is empty; rows show correct P&L sign/color, R (or omitted), tag,
date.

## Out of scope (YAGNI)

Filtering/sorting controls, pagination, per-row actions, navigation to the
Journal, "closed today/session" variants, extra fields (fees/setup/notes).

## Files

Modified: `src/components/trading/TradeTracker.tsx` only.
Never touched: `src/App.tsx`, `src/pages/TradeJournal.tsx` (user WIP).
