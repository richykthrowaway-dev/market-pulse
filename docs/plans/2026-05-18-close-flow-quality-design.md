# Close-Flow Quality Improvements — Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Scope:** First pass on the Trade Tracker → Journal handoff. Three changes:
#1 realized P&L/R preview before Confirm, #4 require explicit exit reason,
#5 idempotency guard. Plus a behavior-preserving extraction of the P&L math
so the preview can share it (and so it's finally testable).

## Why

The close step is the single chokepoint where ephemeral tracking becomes the
permanent Journal. The shipped integrity fixes ensured it can't write a *wrong*
number; this pass ensures the user files with *eyes open* and the reason isn't
silently mislabeled.

- **#1** `confirmClose` collects an exit price but never shows the resulting
  P&L / R before filing — the user files blind, and a fat-finger exit isn't
  caught.
- **#4** `beginClose` defaults `exitReason` to `'target'`; a quick loss-close
  left unchanged is silently recorded as a target hit, corrupting
  `ByExitReasonChart`.
- **#5** `confirmClose` isn't guarded against double-invocation → a double
  click can file two Journal rows.

## #4 — Require explicit exit reason (`TradeTracker.tsx`)

Chosen: **require an explicit pick** (rejected: smart-default and
neutral-default — both can still file a wrong reason).

- `exitReason` state: `useState<ExitReason>('target')` → `useState<ExitReason | ''>('')`.
- `beginClose`: `setExitReason('')`.
- Radix `<Select value="">` shows a placeholder ("Why did you exit?"); items
  keep their real `ExitReason` values.
- `confirmClose`: add `if (exitReason === '') return;` beside the existing
  `isValidExit` guard (defense-in-depth, same pattern as the shipped fix).
- Confirm button `disabled` when `!isValidExit(exitPrice) || exitReason === ''`.

## #1 — Realized $ + R preview (`TradeTracker.tsx`)

A small block above Confirm: e.g. **"Books +$420.00 · 1.82R"**. R shown only
when a stop exists, else "—". Green/red/neutral by sign. Live-updates as exit
price / fees change. Shows "—" when the exit is invalid (never a garbage
number; reuse `isValidExit`).

## #5 — Idempotency (`TradeTracker.tsx`)

`submittingRef` guard at the top of `confirmClose`
(`if (submittingRef.current) return; submittingRef.current = true;` then
proceed), plus button disabled during the write. Reset after the store
mutation completes.

## Architectural choice: shared, testable P&L math

`computePnL` / `computeInitialRisk` / `computeR` already exist and are correct
but live inside `src/hooks/useTradeJournal.ts`, a module with **load-time side
effects** (registers a `storage` listener, kicks off IndexedDB) and is **not
covered by the test harness** (only `src/lib/**/*.test.ts` runs, node env).

Chosen: **move the three pure functions to `src/lib/tradeMath.ts`** and
re-export them from `useTradeJournal.ts` (zero behavior change, no caller
edited). The preview imports from `src/lib/tradeMath`.

Rejected: duplicating the P&L formula into a new helper — violates DRY and
risks the preview and the Journal disagreeing on P&L (a new trust bug while
fixing trust).

## Testing

- `src/lib/tradeMath.ts`: unit tests — `computePnL` (long/short, fees),
  `computeInitialRisk`, `computeR` (incl. null when no stop and when risk = 0).
- #1/#4/#5 UI guards: `npx tsc --noEmit` + `npm run build` + scripted manual
  checks (harness cannot cover the component — known constraint).
- Manual: close with no reason → Confirm disabled; preview shows correct $/R
  and updates live; invalid exit → preview "—"; double-click files one row.

## Out of scope (separate follow-ups from the same review)

#2 capture mistakes/tags/exit-time at close; #3 undo on the close toast;
partial-close / scale-out; screenshot at close.
