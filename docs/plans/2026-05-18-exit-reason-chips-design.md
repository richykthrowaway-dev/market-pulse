# Exit-Reason Segmented Chips — Fix Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Supersedes:** `2026-05-18-close-form-select-freeze-design.md` and
`2026-05-18-close-form-select-freeze-fix.md` (native-`<select>` approach —
invalidated: native `<select>` also froze).

## Problem (root cause, characterized)

Clicking "Close → Journal" on a tracked open position freezes the renderer
(synchronous main-thread peg, no console output). Investigation
(systematic-debugging Phase 1, multiple single-variable tests) established:

- Trigger: rendering a **`<select>` element of any kind** in the inline
  close-form slot (Radix `<Select>`, native bound, native unbound, bare
  `<select>` — all freeze).
- NOT the cause: the `exitReason` binding, the options/`EXIT_REASONS` map,
  Radix internals, or `value=""` (each disproved single-variable).
- Proven safe in that exact slot: non-`<select>` elements — a `<div>`, and the
  four sibling `<Input>`s, all render with no freeze.
- Pre-existing (commit `9d5a414`, before any recent work, froze identically) —
  not introduced by recent changes.
- No `ResizeObserver`/`MutationObserver`/`scrollIntoView`/`focus`/rAF in the
  TradeTracker/Trading/layout tree. Exact environmental "why a `<select>`
  freezes here" is unresolved (would require global-provider bisection) and is
  **not required for this fix**.

## Fix

Replace the close-form exit-reason `<Select>` with a **segmented button-chip
group** (no `<select>`, no Radix, no portal/dropdown).

File: `src/components/trading/TradeTracker.tsx` — exit-reason block only.

- Keep the wrapping `<div className="space-y-1">` and
  `<label className={lblCls}>Exit reason</label>`.
- Container: `<div role="radiogroup" aria-label="Exit reason">`, compact
  flex-wrap row.
- Per `r` of `EXIT_REASONS` (`target/stop/time/discretion/panic`):
  `<button type="button" role="radio" aria-checked={exitReason === r}
  onClick={() => setExitReason(r)}>` — `r` is typed `ExitReason`; **no cast**.
- Styling mirrors the file's existing chip pattern (the `−%`/`+R` chips and
  Long/Short toggle): compact, `capitalize`. Selected = accent fill
  (`bg-primary text-primary-foreground border-primary`); unselected = muted
  (`border-border/50 text-muted-foreground hover:text-foreground`).
- Remove the now-unused `@/components/ui/select` import (verify zero `<Select*`
  usages remain first).

### Preserved exactly (no behavior change)
`exitReason` state stays `ExitReason | ''` starting `''` (no pre-selection →
still forces an explicit pick); `confirmClose` `if (exitReason === '') return;`
guard; the "Pick an exit reason to file this trade" hint; the Confirm button
`disabled` condition; the P&L/R preview IIFE; `submittingRef`; `isValidExit`.

### Why it resolves the freeze
Plain `<button>` elements are in the proven-safe set for this DOM slot. No
`<select>` is rendered, so the established trigger is categorically absent. Fix
correctness does not depend on the unresolved environmental mechanism.

### Out of scope
Other Radix `<Select>`s elsewhere (work — untouched); ErrorBoundary (separate
deferred follow-up); pinning the exact `<select>`-vs-environment cause.

## Testing & verification

- `npx tsc --noEmit` and `npm run build` clean. (Vitest harness only runs
  `src/lib/**/*.test.ts`; this component is not unit-coverable there.)
- **Mandatory regression gate (the real test):** isolated dev server → seed
  open trades → `/trading` → click "Close → Journal":
  - close form opens **instantly, no freeze**;
  - reason chips render, are selectable, one-at-a-time selected state;
  - "Books …" P&L/R preview correct and live;
  - Confirm disabled until a valid exit price AND a reason are set;
  - confirming files the trade to the Journal and removes the open position.
  The fix is not complete until this passes. `tsc`/`build` cannot catch a
  render-time freeze (the broken versions built fine).
