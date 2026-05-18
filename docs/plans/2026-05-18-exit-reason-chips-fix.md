# Exit-Reason Segmented Chips — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the freezing close-form exit-reason `<Select>` with a segmented button-chip group, eliminating the renderer freeze with zero behavior change.

**Architecture:** One-block swap in `src/components/trading/TradeTracker.tsx`: a `role="radiogroup"` of `<button>` chips bound to the existing `exitReason` state. No `<select>`, no Radix, no portal — the element class proven safe in this DOM slot by investigation.

**Tech Stack:** React 18 + Vite + TS. Vitest harness runs ONLY `src/lib/**/*.test.ts` (node) → it does NOT cover this component. Verification = `tsc` + `build` + a MANDATORY manual freeze-reproduction (the regression gate / real test).

**Constraints:** Work from `C:\Users\PC\Downloads\market-pulse`, branch `master`. NEVER `git add -A` (unrelated WIP present) — stage only named files. Design ref: `docs/plans/2026-05-18-exit-reason-chips-design.md`. There is NO automated test for this (render-time freeze in a component that builds clean); the exact user reproduction is the failing test.

---

### Task 1: Replace the exit-reason `<Select>` with segmented chips

**Files:** Modify `src/components/trading/TradeTracker.tsx` (close-form exit-reason block, ~lines 821-831).

**Step 1 — locate the exact block** (snippet authoritative over line numbers):
```tsx
                            <div className="space-y-1">
                              <label className={lblCls}>Exit reason</label>
                              <Select value={exitReason} onValueChange={(v) => setExitReason(v as ExitReason)}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Why did you exit?" /></SelectTrigger>
                                <SelectContent>
                                  {EXIT_REASONS.map((r) => (
                                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
```

**Step 2 — replace that entire `<div className="space-y-1">…</div>` block with:**
```tsx
                            <div className="space-y-1">
                              <label className={lblCls}>Exit reason</label>
                              <div role="radiogroup" aria-label="Exit reason" className="flex flex-wrap gap-1">
                                {EXIT_REASONS.map((r) => {
                                  const selected = exitReason === r;
                                  return (
                                    <button
                                      key={r}
                                      type="button"
                                      role="radio"
                                      aria-checked={selected}
                                      onClick={() => setExitReason(r)}
                                      className={`px-2.5 py-1 rounded text-xs capitalize border transition-colors ${
                                        selected
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                                      }`}
                                    >
                                      {r}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
```
Notes:
- `r` is typed `ExitReason` (from `const EXIT_REASONS: ExitReason[]`), so
  `setExitReason(r)` needs **no cast** (the old code's `as ExitReason` is gone — cleaner/safer).
- Do NOT change: `exitReason` state type/initial `''`, `beginClose`,
  `confirmClose` (incl. its `if (exitReason === '') return;` guard), the
  "Pick an exit reason to file this trade" hint, the `Books …` preview IIFE,
  `submittingRef`, `isValidExit`, or imports (Task 2 removes the unused import).
- Behavior is identical: no pre-selection (forces explicit pick), single
  selection, same state.

**Step 3 — type-check:**
```
npx tsc --noEmit
```
Expected: clean, no new errors. (`setExitReason(r)` where `r: ExitReason` fits
`Dispatch<SetStateAction<ExitReason | ''>>`.) Do not run build yet.

**Step 4 — commit (stage ONLY this file):**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: replace freezing exit-reason Select with segmented chips"
```

---

### Task 2: Remove the now-unused Radix Select import

**Files:** Modify `src/components/trading/TradeTracker.tsx` (import line ~5).

**Step 1 — verify no remaining Radix Select usage:**
```
grep -nE '<Select|<SelectTrigger|<SelectContent|<SelectItem|<SelectValue|\bSelectTrigger\b|\bSelectContent\b|\bSelectItem\b|\bSelectValue\b' src/components/trading/TradeTracker.tsx
```
- Only the import line should match. If ANY JSX `<Select*` remains → STOP, report (Task 1 incomplete). Do not remove the import.

**Step 2 — delete this exact import line** (only if Step 1 shows no JSX usage):
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```
Remove only that line; don't touch/reorder other imports.

**Step 3 — type-check + build:**
```
npx tsc --noEmit
npm run build
```
Expected: both clean (pre-existing chunk-size >500 kB warning is unrelated/OK). No unresolved-symbol / unused errors. If failure references a Select symbol → STOP, Step 1 missed a usage.

**Step 4 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "chore: drop unused Radix Select import from TradeTracker"
```

---

### Task 3: Mandatory freeze-reproduction gate (the real test)

The fix is NOT done until this passes. tsc/build cannot catch this freeze.

**Step 1 — start an isolated dev server** on a free port (8080 may be taken;
do NOT kill servers you didn't start):
```
npm run dev -- --port 5199
```
Wait for `http://localhost:5199/` → HTTP 200.

**Step 2 — seed open trades** (browser console at `http://localhost:5199`,
then it persists for the origin):
```js
localStorage.setItem('tp-open-trades-v1', JSON.stringify([
  { id:'g1', symbol:'AAPL', side:'long', quantity:10, entryPrice:190.5, stopLoss:185, target:205, entryDate:'2026-05-15', setup:'VCP', planValid:true },
  { id:'g2', symbol:'TSLA', side:'short', quantity:5, entryPrice:240, entryDate:'2026-05-16', planValid:true }
]));
```

**Step 3 — reproduce the exact failing path:** open
`http://localhost:5199/trading`, wait for the open-positions list (2 tracked),
click "**Close → Journal**" on a position.

**Pass criteria (ALL must hold):**
- Close form opens **immediately — NO freeze / no "page unresponsive"**.
- Exit-reason chips render (target/stop/time/discretion/panic), none
  pre-selected; clicking one selects it (single selection, visible state).
- "Books …" P&L/R preview renders/updates with exit price & fees.
- "Confirm close" is disabled until a valid exit price AND a reason are set;
  enabling + clicking files the trade to the Journal and removes it from open
  positions.

If it still freezes → STOP. Root cause/fix wrong; return to
systematic-debugging Phase 1. Do not "try another tweak."

**Step 4 — stop the dev server.**

**Step 5 — mark design implemented + commit:**
```
# in docs/plans/2026-05-18-exit-reason-chips-design.md change
#   **Status:** Approved (design)  ->  **Status:** Implemented (2026-05-18)
git add docs/plans/2026-05-18-exit-reason-chips-design.md
git commit -m "docs: mark exit-reason chips fix implemented"
```

---

### Notes for the implementer
- Do not touch any other Radix `<Select>` in the app — out of scope, they work.
- Do not add an ErrorBoundary — separate deferred follow-up.
- The earlier native-`<select>` docs (`b3ccc7d`, `12f66e6`) are superseded; leave them (history), do not act on them.
