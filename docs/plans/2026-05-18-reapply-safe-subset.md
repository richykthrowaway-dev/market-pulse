# Re-apply Safe-Subset Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-apply only the freeze-independent session improvements (data-integrity guards, P&L math extraction + tests, cross-tab sync) — nothing that renders in the pre-existing-frozen close-form subtree.

**Architecture:** Pure `src/lib` modules (unit-tested by the Vitest harness), behavior-preserving `useTradeJournal` re-export, store-level hardening in `useOpenTrades`, and handler-only guards in `confirmClose`/`beginClose`. No close-form render changes.

**Tech Stack:** React 18 + Vite + TS. Vitest harness runs ONLY `src/lib/**/*.test.ts` (node) → it covers the new lib modules; handler/store changes verified by `tsc` + `build`.

**Constraints:** Work from `C:\Users\PC\Downloads\market-pulse`, branch `master`. NEVER `git add -A` (unrelated WIP present: `useAISStream.ts`, `App.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`, `TradingPlan.tsx`, data files — DO NOT stage these). Stage only the files each task names. Design ref: `docs/plans/2026-05-18-reapply-safe-subset-design.md`. Code is byte-identical to versions that passed full review + tests earlier this session.

---

### Task 1: `tradeMath` extraction (TDD) + re-export

**Files:** Create `src/lib/tradeMath.ts`, `src/lib/tradeMath.test.ts`; Modify `src/hooks/useTradeJournal.ts`.

**Step 1 — `src/lib/tradeMath.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import { computePnL, computeInitialRisk, computeR } from './tradeMath';
const base = { side: 'long' as const, entryPrice: 100, exitPrice: 110, quantity: 10, fees: 5 };
describe('computePnL', () => {
  it('long nets fees', () => { expect(computePnL(base)).toBe(95); });
  it('short flips direction', () => { expect(computePnL({ ...base, side: 'short', exitPrice: 90 })).toBe(95); });
});
describe('computeInitialRisk', () => {
  it('null without a stop', () => { expect(computeInitialRisk(base)).toBeNull(); });
  it('abs(entry-stop)*qty', () => { expect(computeInitialRisk({ ...base, stopLoss: 98 })).toBe(20); });
});
describe('computeR', () => {
  it('null when no stop', () => { expect(computeR(base)).toBeNull(); });
  it('pnl / initialRisk', () => { expect(computeR({ ...base, stopLoss: 98 })).toBe(95 / 20); });
});
```
**Step 2 — run, expect FAIL:** `npm test -- tradeMath`

**Step 3 — `src/lib/tradeMath.ts`** (self-contained; no hook import):
```ts
export interface TradeMathInput {
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees: number;
  stopLoss?: number;
}
export function computePnL(t: TradeMathInput): number {
  const gross = t.side === 'long'
    ? (t.exitPrice - t.entryPrice) * t.quantity
    : (t.entryPrice - t.exitPrice) * t.quantity;
  return gross - t.fees;
}
export function computeInitialRisk(t: TradeMathInput): number | null {
  if (t.stopLoss === undefined || t.stopLoss === null) return null;
  return Math.abs(t.entryPrice - t.stopLoss) * t.quantity;
}
export function computeR(t: TradeMathInput): number | null {
  const risk = computeInitialRisk(t);
  if (risk === null || risk === 0) return null;
  return computePnL(t) / risk;
}
```
**Step 4 — run, expect PASS:** `npm test -- tradeMath` (6 pass)

**Step 5 — re-export in `src/hooks/useTradeJournal.ts`:** delete the three
`export function computePnL/computeInitialRisk/computeR` definitions (currently
~lines 57-73) and replace with the single line at that location:
```ts
export { computePnL, computeInitialRisk, computeR } from '@/lib/tradeMath';
```
Keep `TradeEntry`/`TradeSide`/`ExitReason` and everything else unchanged.

**Step 6 — verify:** `npm test` (all green incl. new file), `npx tsc --noEmit`
(clean — `TradeEntry` is structurally assignable to `TradeMathInput`).

**Step 7 — commit:**
```
git add src/lib/tradeMath.ts src/lib/tradeMath.test.ts src/hooks/useTradeJournal.ts
git commit -m "refactor: extract testable tradeMath, re-export from journal"
```

---

### Task 2: `isValidExit` guard (TDD) + confirmClose handler guard

**Files:** Create `src/lib/exitValidation.ts`, `src/lib/exitValidation.test.ts`; Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — `src/lib/exitValidation.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import { isValidExit } from './exitValidation';
describe('isValidExit', () => {
  it('rejects blank/zero/negative/non-numeric', () => {
    expect(isValidExit('')).toBe(false);
    expect(isValidExit('0')).toBe(false);
    expect(isValidExit('-5')).toBe(false);
    expect(isValidExit('abc')).toBe(false);
    expect(isValidExit('  ')).toBe(false);
  });
  it('accepts a positive price', () => {
    expect(isValidExit('12.5')).toBe(true);
    expect(isValidExit('100')).toBe(true);
  });
});
```
**Step 2 — run, expect FAIL:** `npm test -- exitValidation`

**Step 3 — `src/lib/exitValidation.ts`:**
```ts
/** A close may only be filed when the exit price parses to a positive number. */
export function isValidExit(raw: string): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
```
**Step 4 — run, expect PASS:** `npm test -- exitValidation`

**Step 5 — wire the HANDLER guard only** in `TradeTracker.tsx`:
- Add import near other `@/lib` imports: `import { isValidExit } from '@/lib/exitValidation';`
- In `function confirmClose(t: OpenTrade) {` (currently ~line 289), make the
  FIRST statement (before `addTrade({`):
  ```ts
  if (!isValidExit(exitPrice)) return;
  ```
- Do NOT add any disabled-button or hint JSX (those render in the close form —
  out of scope).

**Step 6 — verify:** `npx tsc --noEmit` clean.

**Step 7 — commit:**
```
git add src/lib/exitValidation.ts src/lib/exitValidation.test.ts src/components/trading/TradeTracker.tsx
git commit -m "fix: guard confirmClose against invalid exit (protects Journal)"
```

---

### Task 3: `beginClose` prefill correctness (handler-only)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — in `beginClose` (~line 280-287)** replace the single line
`setExitPrice(String(t.target ?? t.entryPrice));` with:
```ts
const liveAtOpen = quotes[t.symbol.trim().toUpperCase()]?.price ?? null;
setExitPrice(liveAtOpen != null && liveAtOpen > 0 ? String(liveAtOpen) : '');
```
`quotes` is already in scope (used by the open-positions rows). Change nothing
else in `beginClose`.

**Step 2 — verify:** `npx tsc --noEmit` clean.

**Step 3 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: prefill exit from live price or blank, not target/entry"
```

---

### Task 4: Double-submit guard (handler-only)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — add a ref** with the other refs (~line 113-114, `useRef` already imported):
```ts
const submittingRef = useRef(false);
```
**Step 2 — in `confirmClose`,** immediately AFTER the `isValidExit` guard
(Task 2) and BEFORE `addTrade({`:
```ts
if (submittingRef.current) return;
submittingRef.current = true;
```
and as the LAST statement of `confirmClose` (after the `toast.success(...)`):
```ts
submittingRef.current = false;
```
Do NOT reflect `submittingRef` in any button `disabled` prop (renders in the
close form — out of scope). `addTrade`/`removeOpen` are synchronous so no
try/finally is needed.

**Step 3 — verify:** `npx tsc --noEmit` clean.

**Step 4 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: guard confirmClose against double-submit (one Journal row)"
```

---

### Task 5: `parseOpenTrades` (TDD) + readLS hardening + cross-tab sync

**Files:** Create `src/lib/openTradesStore.ts`, `src/lib/openTradesStore.test.ts`; Modify `src/hooks/useOpenTrades.ts`.

**Step 1 — `src/lib/openTradesStore.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import { parseOpenTrades } from './openTradesStore';
describe('parseOpenTrades', () => {
  it('returns [] for null, invalid JSON, or non-array', () => {
    expect(parseOpenTrades(null)).toEqual([]);
    expect(parseOpenTrades('not json')).toEqual([]);
    expect(parseOpenTrades('{"a":1}')).toEqual([]);
  });
  it('passes through a valid array', () => {
    const t = [{ id:'a', symbol:'AAPL', side:'long', quantity:1, entryPrice:10, entryDate:'2026-05-18', planValid:true }];
    expect(parseOpenTrades(JSON.stringify(t))).toEqual(t);
  });
});
```
**Step 2 — run, expect FAIL:** `npm test -- openTradesStore`

**Step 3 — `src/lib/openTradesStore.ts`:**
```ts
import type { OpenTrade } from '@/hooks/useOpenTrades';
/** Parse the persisted open-trades payload. Malformed/missing → []. */
export function parseOpenTrades(raw: string | null): OpenTrade[] {
  try {
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
```
(Type-only import — no runtime cycle. Confirm `useOpenTrades.ts` `export`s the
`OpenTrade` interface; it does.)

**Step 4 — run, expect PASS:** `npm test -- openTradesStore`

**Step 5 — modify `src/hooks/useOpenTrades.ts`:**
- Add import: `import { parseOpenTrades } from '@/lib/openTradesStore';`
- Replace the body of `function readLS(): OpenTrade[] { ... }` (the inline
  try/catch, currently ~lines 37-45) with:
  ```ts
  function readLS(): OpenTrade[] {
    if (typeof localStorage === 'undefined') return [];
    return parseOpenTrades(localStorage.getItem(LS_KEY));
  }
  ```
- Add a module-level cross-tab listener AFTER `snapshot`, `readLS`, `LS_KEY`,
  and the notify function are all defined (the notify fn is likely named
  `emit` — VERIFY its exact name in the file and use that):
  ```ts
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === LS_KEY || e.key == null) {
        snapshot = readLS();
        emit(); // ← use the file's actual notify function name
      }
    });
  }
  ```

**Step 6 — verify:** `npm test` (all green incl. new file), `npx tsc --noEmit` clean.

**Step 7 — commit:**
```
git add src/lib/openTradesStore.ts src/lib/openTradesStore.test.ts src/hooks/useOpenTrades.ts
git commit -m "fix: harden readLS + cross-tab open-trades sync"
```

---

### Task 6: Final verification

**Step 1 — automated:**
```
npm test          # full suite green incl. tradeMath/exitValidation/openTradesStore
npx tsc --noEmit  # clean
npm run build     # succeeds (pre-existing chunk-size warning OK)
```
**Step 2 — sanity (NOT a freeze claim):** the changes touch no close-form
render; do NOT attempt the close-form freeze repro as a gate (the pre-existing
freeze is separate and untouched). Confirm only that `tsc`/`build`/tests pass.

**Step 3 — mark design implemented + commit:**
```
# docs/plans/2026-05-18-reapply-safe-subset-design.md: Status -> Implemented (2026-05-18)
git add docs/plans/2026-05-18-reapply-safe-subset-design.md
git commit -m "docs: mark safe-subset re-apply implemented"
```

### Notes
- Do NOT re-add: the exit-reason control change, the "Books" preview, the
  disabled-button/hint, or `submittingRef` in `disabled` — all render in the
  frozen close form, deliberately deferred.
- Do NOT touch other files / the user's WIP.
