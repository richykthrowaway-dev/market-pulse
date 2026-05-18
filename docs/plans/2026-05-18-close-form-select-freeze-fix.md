# Close-Form Select Freeze Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the freezing Radix `<Select>` in the Trade Tracker inline close form with a native styled `<select>`, eliminating the renderer freeze.

**Architecture:** One-element swap in `src/components/trading/TradeTracker.tsx`. Native `<select>` keeps the exact state contract (`exitReason: ExitReason | ''`, placeholder until picked). No other component or behavior changes.

**Tech Stack:** React 18 + Vite + TS. Vitest harness runs ONLY `src/lib/**/*.test.ts` (node) → it does NOT cover this component; verification is `tsc` + `build` + a **mandatory manual freeze-reproduction** (the regression gate).

**Constraints:** Work from `C:\Users\PC\Downloads\market-pulse`, branch `master`. NEVER `git add -A` (unrelated WIP present) — stage only the named file(s). Design ref: `docs/plans/2026-05-18-close-form-select-freeze-design.md`.

**Why no automated test:** the defect is a render-time main-thread freeze in a third-party component; it builds & type-checks fine (that's why it shipped). The only valid proof is re-running the exact user reproduction. Treat that repro as the failing test.

---

### Task 1: Replace the Radix Select with a native `<select>`

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx` (the exit-reason block, currently lines ~821-831)

**Step 1 — locate the exact block.** It is:
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
(The snippet is authoritative over line numbers — line numbers may drift due to CRLF normalization.)

**Step 2 — replace the inner `<Select>…</Select>` ONLY** (keep the wrapping
`<div className="space-y-1">` and the `<label>`), with a native select that
reuses the same field styling the sibling close-form inputs use (`fieldCls`):

```tsx
                              <select
                                value={exitReason}
                                onChange={(e) => setExitReason(e.target.value as ExitReason)}
                                className={`${fieldCls} capitalize appearance-none bg-background`}
                              >
                                <option value="" disabled hidden>Why did you exit?</option>
                                {EXIT_REASONS.map((r) => (
                                  <option key={r} value={r} className="capitalize">{r}</option>
                                ))}
                              </select>
```
Notes:
- `fieldCls` is the existing const used by the other close-form `Input`s in this
  file — reuse it (DRY); do not invent new classes. If `fieldCls` is not in
  scope at this JSX location, use the same literal class string the adjacent
  Exit price / Fees `Input`s use.
- Do NOT change `exitReason` state type, `beginClose`, `confirmClose`, the
  `isValidExit` guard, the "Pick an exit reason" hint, the preview IIFE, or the
  `submittingRef` logic. Widget-only change.

**Step 3 — verify the block compiles in isolation (type check):**
```
npx tsc --noEmit
```
Expected: clean (no new errors). `e.target.value` is `string`; the
`as ExitReason` cast matches the previous `v as ExitReason` pattern.

**Step 4 — commit (stage ONLY this file):**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: replace freezing Radix Select with native select in close form"
```

---

### Task 2: Remove now-unused Radix Select imports (only if truly unused)

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx` (import line ~5)

**Step 1 — verify no remaining usage:**
```
grep -nE '<Select|<SelectTrigger|<SelectContent|<SelectItem|<SelectValue' src/components/trading/TradeTracker.tsx
```
Expected: **no matches** (the close form was the only Radix Select; the Setup
field is a custom combobox, not Radix). If there ARE matches, STOP — do not
remove the import; report.

**Step 2 — remove the unused import line** (only if Step 1 found nothing):
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```
Delete that entire line.

**Step 3 — type-check + build:**
```
npx tsc --noEmit
npm run build
```
Expected: both clean (pre-existing chunk-size warning is unrelated/OK). No
"declared but never read" / unresolved errors.

**Step 4 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "chore: drop unused Radix Select imports from TradeTracker"
```

---

### Task 3: Decisive verification — the freeze regression gate (MANDATORY)

This is the real "test". The fix is NOT done until this passes.

**Step 1 — start an isolated dev server** (port 8080 may be in use by another
preview; pick a free port):
```
npm run dev -- --port 5199
```
Wait until it serves `http://localhost:5199/` (HTTP 200).

**Step 2 — seed an open trade** (browser console at `http://localhost:5199`,
any page, then it persists for the origin):
```js
localStorage.setItem('tp-open-trades-v1', JSON.stringify([
  { id:'v1', symbol:'AAPL', side:'long', quantity:10, entryPrice:190.5, stopLoss:185, target:205, entryDate:'2026-05-15', setup:'VCP', planValid:true },
  { id:'v2', symbol:'TSLA', side:'short', quantity:5, entryPrice:240, entryDate:'2026-05-16', planValid:true }
]));
```

**Step 3 — reproduce the exact failing path:** open
`http://localhost:5199/trading`, wait for it to render the open-positions list
(2 tracked), then click the "**Close → Journal**" button on a position.

**Pass criteria (ALL must hold):**
- The inline close form opens **immediately — no freeze / no "page
  unresponsive"** (this is the bug; it must be gone).
- The Exit reason native dropdown shows the placeholder "Why did you exit?" and
  is selectable; picking a reason works.
- "Books …" P&L/R preview renders and updates as exit price/fees change.
- "Confirm close & add to Journal" is disabled until a valid exit price AND a
  reason are set; enabling + clicking it files the trade to the Journal and
  removes it from open positions.

If the freeze still occurs → STOP, the root-cause/fix is wrong; return to
systematic-debugging Phase 1. Do not "try another tweak."

**Step 4 — stop the dev server.**

**Step 5 — mark the design implemented + commit:**
```
git add docs/plans/2026-05-18-close-form-select-freeze-design.md
# edit Status: Approved (design) -> Implemented (2026-05-18)
git commit -m "docs: mark close-form Select freeze fix implemented"
```

---

### Notes for the implementer
- Do not touch any other Radix `<Select>` in the app — out of scope, they work.
- Do not add an ErrorBoundary here — separate deferred follow-up.
- If `npm run dev -- --port 5199` fails because 5199 is taken, choose another
  free port and adjust the URLs; never kill a server you didn't start.
