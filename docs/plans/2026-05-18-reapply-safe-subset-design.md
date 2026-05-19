# Re-apply Safe-Subset Improvements — Design

**Date:** 2026-05-18
**Status:** Approved (design)
**Context:** All of this session's Trade Tracker work was reverted to the
pre-session baseline `9d5a414` (commit `6cd4c67`) because the user believed it
broke the site. Investigation proved the close-form freeze is **pre-existing,
non-deterministic, and independent of our code** (bisected to `9d5a414`, which
froze identically). This re-applies ONLY the improvements that are provably
orthogonal to that freeze.

## Principle

The freeze is in the **render** of the close-form mount subtree. Every item
below lives in **pure `src/lib` modules, the stores/hooks, or the
`confirmClose`/`beginClose` handlers** — none add/alter anything that renders
in the close form. Therefore "without breaking" is truthfully guaranteed.

Deliberately EXCLUDED (they render in the still-broken close form; deferred
until the freeze is root-caused/contained): the require-exit-reason control,
the "Books" P&L/R preview, the disabled-button + hint, the
`submittingRef`-in-`disabled` reflection.

## Items to re-apply

**A. `tradeMath` extraction (behavior-preserving + test coverage)**
- Create `src/lib/tradeMath.ts`: `TradeMathInput` + `computePnL`,
  `computeInitialRisk`, `computeR` (bodies byte-identical to the current
  inline `useTradeJournal` versions — verified this session).
- Create `src/lib/tradeMath.test.ts` (the 6 tests that passed this session).
- `src/hooks/useTradeJournal.ts`: delete the three inline fn bodies, add
  `export { computePnL, computeInitialRisk, computeR } from '@/lib/tradeMath';`
  Zero behavior change; first-ever unit coverage of the money math.

**B. Journal-corruption guard (`isValidExit`) — handler-only**
- Create `src/lib/exitValidation.ts`: `isValidExit(raw) =>
  Number.isFinite(Number(raw)) && Number(raw) > 0` + `exitValidation.test.ts`.
- `TradeTracker.tsx` `confirmClose`: add `if (!isValidExit(exitPrice)) return;`
  as the FIRST statement. Do NOT add the disabled-button or hint (those render
  in the close form — excluded).

**C. `beginClose` prefill correctness — handler-only**
- In `beginClose`, replace `setExitPrice(String(t.target ?? t.entryPrice))`
  with the live quote if available, else `''`:
  `const liveAtOpen = quotes[t.symbol.trim().toUpperCase()]?.price ?? null;
  setExitPrice(liveAtOpen != null && liveAtOpen > 0 ? String(liveAtOpen) : '');`

**D. Double-submit guard — handler-only**
- Add `const submittingRef = useRef(false);` (useRef already imported).
- `confirmClose`: after the `isValidExit` guard, add
  `if (submittingRef.current) return; submittingRef.current = true;` and set
  `submittingRef.current = false;` as the last statement. Do NOT reflect it in
  the button `disabled` (renders in close form — excluded).

**E. Cross-tab sync + schema hardening**
- Create `src/lib/openTradesStore.ts`: `parseOpenTrades(raw): OpenTrade[]`
  (type-only import of `OpenTrade`) + `openTradesStore.test.ts` (the 2 tests).
- `src/hooks/useOpenTrades.ts`: `readLS` delegates to `parseOpenTrades`
  (SSR-guarded); add module-level `window.addEventListener('storage', …)` that
  re-reads + `emit()` on `LS_KEY`/null (adopt-latest-persisted).

## Accepted trade-off

With the close-form hint deferred, an invalid-exit click is a **silent no-op**
rather than an explained block. Strictly better than corrupting the Journal;
the explanatory UX returns with the deferred close-form work.

## Testing & verification

- `npm test` (Vitest `src/lib/**` node harness): `tradeMath` (6),
  `exitValidation` (2+), `openTradesStore` (2) all green; full suite green.
- `npx tsc --noEmit` + `npm run build` clean.
- Manual sanity: `/trading` with open trades still renders the list;
  `confirmClose` files correctly when given a valid exit + reason.
- **No claim** the pre-existing close-form freeze is fixed — untouched and
  separate; this work neither causes nor cures it.

## Out of scope
The close-form UI improvements; ErrorBoundary/containment of the freeze;
root-causing the freeze (separate, open).
