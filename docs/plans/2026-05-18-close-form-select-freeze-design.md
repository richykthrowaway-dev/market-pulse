# Close-Form Exit-Reason Select Freeze — Fix Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Type:** Bug fix (pre-existing renderer freeze; not introduced by recent work)

## Symptom

Clicking "Close → Journal" on a tracked open position in the Trade Tracker
(`/trading`) freezes the browser tab (main thread pegged ~indefinitely). The
rest of the app — including `/trading` itself until that action — works.

## Root cause (confirmed)

The Radix `<Select>` (`@radix-ui/react-select@^2.1.1`) rendered inside the
inline close form (`src/components/trading/TradeTracker.tsx`, the
`{closing && ...}` subtree) runs a **non-terminating synchronous computation
on mount** in this specific DOM context.

Evidence chain (systematic debugging):
- Reliable repro: seed open trades → `/trading` → click "Close → Journal" → 45 s+ renderer freeze.
- Bisect: commit `9d5a414` (before *any* of this session's Trade-Tracker work) freezes identically → **pre-existing, not caused by recent changes**.
- Disproved: changing the controlled `value` (`'' → undefined`) still freezes → not the value prop.
- Single-variable proof: replacing **only** the `<Select>` with a plain `<div>` → close form opens instantly, fully functional.
- Freeze-surviving instrumentation (console/onerror persisted to localStorage) captured **nothing** → not a React render/state loop, not a thrown error → a silent synchronous block inside Radix Select's mount/layout path.

Mechanism class: synchronous main-thread block in Radix Select mount. Therefore
Radix-config tweaks (value sentinel, memoization, deps, `position`) are ruled
out; the only viable fix class is replacing this Select instance.

## Fix

Replace the exit-reason Radix `<Select>` in the close form with a **native
styled HTML `<select>`**. Scope: this one element only.

- `value={exitReason}` (state stays `ExitReason | ''` — unchanged).
- First option: `<option value="" disabled hidden>Why did you exit?</option>`
  — preserves the "must explicitly pick a reason" behavior (placeholder, not a
  selectable value).
- `{EXIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}` (capitalize
  via CSS as today).
- `onChange={(e) => setExitReason(e.target.value as ExitReason)}`.
- Styled to match adjacent close-form fields (same height/border/bg/text as the
  form `Input`s) + `appearance-none` + a chevron.
- Remove the now-unused `Select*` imports **only if** no longer referenced
  elsewhere in the file (verify first).

### Explicitly preserved (untouched)
`isValidExit` guard, `exitReason === ''` requirement + hint, the P&L/R preview,
the `submittingRef` idempotency guard. Only the widget changes.

### Out of scope
All other Radix `<Select>` usages in the app (TradeFormDialog, Performance,
Trading QuickOrder, etc.) — they are in different contexts and work; changing
them risks regressions for no benefit. The ErrorBoundary / stale-chunk safety
net remains a separate, deferred follow-up.

## Testing & verification

- `npx tsc --noEmit` and `npm run build` clean (component change; the Vitest
  harness only runs `src/lib/**/*.test.ts`, so it does not cover this file).
- **Decisive regression gate (mechanism-specific manual repro):** seed open
  trades → `/trading` → click "Close → Journal":
  - close form opens **instantly, no freeze**;
  - exit reason selectable; placeholder shown until picked;
  - "Books …" P&L/R preview correct;
  - "Confirm close" disabled until a reason is chosen;
  - confirming files the trade to the Journal.
  The fix is not complete until this passes. (tsc/build cannot catch a
  render-time freeze — it builds fine; only this repro proves resolution.)
