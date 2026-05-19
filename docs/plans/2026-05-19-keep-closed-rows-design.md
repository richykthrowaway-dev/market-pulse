# Keep Closed Rows Visible — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** `src/components/trading/TradeTracker.tsx` only.

## Problem

When a trade is closed (`confirmClose` full close), `removeOpen(t.id)` makes
its row vanish from the positions list. It only lives in the collapsed
"Recently closed" section, so it *looks* like it disappeared. User wants the
row to stay visible after sending to the Journal.

## Decision

The just-closed row stays in place, **dimmed**, marked "Closed → Journal",
with no live price and no actions, until the user dismisses it or reloads.
The Journal write and all existing data flow are unchanged.

Keeping it in the persisted `tp-open-trades-v1` store is rejected: it would
reappear as a *live* position on reload (quote polling, editable,
re-closeable) and break the "close = one Journal write, removed from open"
model. "Until reload" therefore = **session-only React state**, not
persistence.

## Approach

In `TradeTracker`:

1. `const [justClosed, setJustClosed] = useState<{ entry: TradeEntry; id: string }[]>([]);`
2. `confirmClose`, **full-close branch only** (partial already keeps the row —
   the position stays open with reduced qty, so nothing to add): after the
   existing `const newId = addTrade(payload)` and `removeOpen(t.id)`, also
   `setJustClosed(prev => [{ entry: <the addTrade payload as TradeEntry incl. id:newId>, id: newId }, ...prev])`.
   Do NOT change the payload, the partial path, `setClosingId(null)`, the
   `isValidExit`/`submittingRef` guards, or their order.
3. The existing post-close Undo toast action currently does
   `deleteTrade(newId); addOpen(t);`. Add
   `setJustClosed(prev => prev.filter(j => j.id !== newId));` to that same
   `onClick` so an undone trade is not shown both back-in-open and dimmed.
   (Partial Undo path unchanged.)
4. Render dimmed closed rows from `justClosed` directly AFTER the open
   positions list/empty-state and BEFORE the `<RecentlyClosed />` section,
   inside the same Open Positions column. Each row, reusing existing
   `computePnL`/`computeR`/`money`:
   `SYM · side · qty · $entry→$exit · ±P&L (±R) · "Closed → Journal"`
   at ~50% opacity, **no live price, no Edit/Close/Partial**, plus a small
   dismiss `✕` button → `setJustClosed(prev => prev.filter(j => j.id !== id))`.
   A module-scope presentational `JustClosedRow` (no own hooks needed) or an
   inline `.map` is fine; keep hooks out of `.map`.

State clears on reload (not persisted) and on dismiss — exactly the agreed
behavior.

## Non-goals (YAGNI)

Persisting closed rows across reload; any action on a closed row
(reopen/edit); a "clear all" control; marking partial closes as closed
(partials stay open by nature).

## Testing

No new pure logic (`computePnL`/`computeR` already unit-tested). Verify via
`npx tsc --noEmit` + `npm run build` + manual: full-close a trade → row
stays, dimmed, "Closed → Journal", correct ±P&L/R, no live price/actions;
dismiss ✕ removes it; Undo (toast) returns it to open AND removes the dimmed
row (no duplicate); partial close still just reduces qty (no dimmed row);
reload clears dimmed rows; "Recently closed" still works.

## Files

Modified: `src/components/trading/TradeTracker.tsx` only.
Never touched: `src/App.tsx`, `src/pages/TradeJournal.tsx` (user WIP).
