# TradeTracker Integrity Fixes — Design

**Date:** 2026-05-18
**Status:** Implemented (2026-05-18)
**Scope:** Two trust-critical bug fixes in the Trade Tracker. No data-model or API change.

## Why

A dependency-level audit of `src/components/trading/TradeTracker.tsx` and its
store found two correctness bugs that strike the app's core promise (an
accurate, trustworthy journal/tracker):

1. **Close flow can file a wrong-P&L trade into the permanent Journal.**
   `confirmClose` does `exitPrice: Number(exitPrice) || 0` with no validation,
   and `beginClose` prefills exit with `t.target ?? t.entryPrice`. A hasty
   confirm books a −100% loss (blank → 0) or a fake scratch (no target →
   entry) into `useTradeJournal` permanently.
2. **Open positions can be silently lost across browser tabs.**
   `useOpenTrades` has a module-level snapshot + localStorage write but no
   `storage` event listener, so concurrent tabs diverge and last-writer-wins
   overwrites `tp-open-trades-v1` with no error.

## Bug #1 — Close-flow integrity (`TradeTracker.tsx`)

Chosen approach: **hard block + smart prefill**.
(Rejected: warn-and-allow keeps the corruption path; block-only keeps the
misleading prefill.)

- `beginClose(t)`: replace `setExitPrice(String(t.target ?? t.entryPrice))`
  with the **live price if available** (`quotes[t.symbol.toUpperCase()]?.price`),
  otherwise an **empty string**.
- Add a tiny exported pure helper `isValidExit(s: string): boolean` →
  `Number(s) > 0`.
- `confirmClose`: guard at the top — `if (!isValidExit(exitPrice)) return;`
  (defense-in-depth even with the button disabled).
- "Confirm close & add to Journal" button: `disabled={!isValidExit(exitPrice)}`
  plus a one-line hint when invalid: "Enter the actual exit price to file
  this trade."
- Preserved: a true scratch (exit == entry) stays allowed; only ≤0 / blank
  is blocked. `fees` keeps `Number(fees) || 0`.

## Bug #2 — Cross-tab sync (`useOpenTrades.ts`)

Chosen approach: **adopt-latest-persisted**.
(Rejected: merge-by-id adds edge cases for a single-user app; warn-on-conflict
interrupts the trader mid-position.)

- At module load, after `let snapshot = readLS()`, register one
  `window.addEventListener('storage', …)`, SSR-guarded with
  `typeof window !== 'undefined'`.
- Handler: when `e.key === LS_KEY` or `e.key == null`, run
  `snapshot = readLS(); emit();`. The `storage` event fires only in *other*
  tabs by spec → no echo loop. The existing `useSyncExternalStore` + `emit()`
  path re-renders all consumers.
- Module-level singleton listener, app-lifetime, no teardown (YAGNI; it is a
  store singleton like the snapshot itself).

## Testing

- `useOpenTrades`: unit test — dispatch a synthetic `storage` event with a new
  `tp-open-trades-v1` payload; assert `getSnapshot()` reflects it and
  subscribers fire.
- `isValidExit`: unit tests — `'0'`, `''`, `'-5'`, `'abc'` → false;
  `'12.5'` → true.
- Manual: two tabs — add a trade in one, confirm the other updates; attempt a
  close with blank/0 exit and confirm it is blocked.

## Out of scope

Portfolio heat, partial exits / stop-trailing, proactive breach alerts,
plan-vs-actual at close (separate follow-ups identified in the same review).
