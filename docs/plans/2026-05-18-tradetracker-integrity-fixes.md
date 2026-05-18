# TradeTracker Integrity Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop the Trade Tracker from (a) filing wrong-P&L trades into the permanent Journal and (b) silently losing open positions across browser tabs.

**Architecture:** Two surgical fixes, no data-model/API change. Testable logic is extracted into `src/lib/` (the only path the test harness runs); the thin DOM wiring is type-checked + manually verified.

**Tech Stack:** React + Vite + TypeScript, Vitest 2 (`environment: node`, `include: ['src/lib/**/*.test.ts']`), `useSyncExternalStore` store pattern.

**Hard harness constraint:** `npm test` runs ONLY `src/lib/**/*.test.ts` in a `node` env (no DOM, no localStorage). Do NOT change `vitest.config.ts` (51 tests currently pass — protect them). Put unit-tested logic in `src/lib/`. Component/hook DOM behavior is verified by `npx tsc --noEmit`, `npm run build`, and the documented manual checks.

Design ref: `docs/plans/2026-05-18-tradetracker-integrity-fixes-design.md`.
Work from: `C:\Users\PC\Downloads\market-pulse` (branch `master`). Stage only the files each task names — the repo has unrelated uncommitted WIP that must NOT be committed.

---

### Task 1: `isValidExit` pure helper (TDD)

**Files:**
- Create: `src/lib/exitValidation.ts`
- Create: `src/lib/exitValidation.test.ts`

**Step 1 — failing test** (`src/lib/exitValidation.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { isValidExit } from './exitValidation';

describe('isValidExit', () => {
  it('rejects blank, zero, negative, non-numeric', () => {
    expect(isValidExit('')).toBe(false);
    expect(isValidExit('0')).toBe(false);
    expect(isValidExit('-5')).toBe(false);
    expect(isValidExit('abc')).toBe(false);
    expect(isValidExit('  ')).toBe(false);
  });
  it('accepts a positive price (incl. a scratch equal to entry)', () => {
    expect(isValidExit('12.5')).toBe(true);
    expect(isValidExit('100')).toBe(true);
  });
});
```

**Step 2 — run, expect FAIL:** `npm test -- exitValidation`
Expected: fail, `isValidExit` not found.

**Step 3 — implement** (`src/lib/exitValidation.ts`):

```ts
/** A close may only be filed to the Journal when the exit price parses to a
 *  positive number. A true scratch (exit == entry) is still valid; only
 *  blank/0/negative/non-numeric is blocked. */
export function isValidExit(raw: string): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
```

**Step 4 — run, expect PASS:** `npm test -- exitValidation`

**Step 5 — commit:**
```bash
git add src/lib/exitValidation.ts src/lib/exitValidation.test.ts
git commit -m "feat: add isValidExit guard helper for trade close"
```

---

### Task 2: Gate the close flow in `TradeTracker.tsx`

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — import the helper.** Add near the other `@/lib` imports (around line 19-21):
```ts
import { isValidExit } from '@/lib/exitValidation';
```

**Step 2 — guard `confirmClose`.** At the very top of `confirmClose` (line ~289), before `addTrade(...)`:
```ts
if (!isValidExit(exitPrice)) return;
```

**Step 3 — disable the confirm button + add hint.** Replace the confirm button block (line ~834-837) with:
```tsx
{!isValidExit(exitPrice) && (
  <p className="text-[11px] text-trading-sell">
    Enter the actual exit price to file this trade.
  </p>
)}
<Button size="sm" className="w-full font-semibold"
  disabled={!isValidExit(exitPrice)}
  onClick={() => confirmClose(t)}>
  Confirm close &amp; add to Journal
</Button>
```

**Step 4 — verify (no harness coverage for DOM; use compiler + build):**
```bash
npx tsc --noEmit
npm run build
```
Expected: no new TS errors; build succeeds.

**Step 5 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: block trade close until exit price is valid (protects Journal)"
```

---

### Task 3: Smart exit prefill in `beginClose`

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — replace the prefill.** In `beginClose` (line ~280-287), change:
```ts
setExitPrice(String(t.target ?? t.entryPrice));
```
to:
```ts
const liveAtOpen = quotes[t.symbol.trim().toUpperCase()]?.price ?? null;
setExitPrice(liveAtOpen != null && liveAtOpen > 0 ? String(liveAtOpen) : '');
```
(`quotes` is already in scope in the component — it backs the open-position live rows.)

**Step 2 — verify:**
```bash
npx tsc --noEmit && npm run build
```
Expected: clean.

**Step 3 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: prefill exit with live price or blank, never target/entry"
```

---

### Task 4: Extract `parseOpenTrades` pure parser (TDD)

**Why:** the cross-tab handler and `readLS` both need to parse the stored payload; extracting it gives a node-testable invariant (the only place the harness can cover this fix) and also hardens the schema path.

**Files:**
- Create: `src/lib/openTradesStore.ts`
- Create: `src/lib/openTradesStore.test.ts`
- Modify: `src/hooks/useOpenTrades.ts`

**Step 1 — failing test** (`src/lib/openTradesStore.test.ts`):

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
    const t = [{ id: 'a', symbol: 'AAPL', side: 'long', quantity: 1,
      entryPrice: 10, entryDate: '2026-05-18', planValid: true }];
    expect(parseOpenTrades(JSON.stringify(t))).toEqual(t);
  });
});
```

**Step 2 — run, expect FAIL:** `npm test -- openTradesStore`

**Step 3 — implement** (`src/lib/openTradesStore.ts`):

```ts
import type { OpenTrade } from '@/hooks/useOpenTrades';

/** Parse the persisted open-trades payload. Always returns an array;
 *  malformed/missing input yields []. */
export function parseOpenTrades(raw: string | null): OpenTrade[] {
  try {
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

(Note: `OpenTrade` is exported from `useOpenTrades.ts` — keep that export. This
creates a hooks→lib type-only import; if the bundler flags a cycle, change the
import to `import type` only, which it already is.)

**Step 4 — run, expect PASS:** `npm test -- openTradesStore`

**Step 5 — refactor `readLS` to use it.** In `src/hooks/useOpenTrades.ts`,
replace the body of `readLS()` with:
```ts
import { parseOpenTrades } from '@/lib/openTradesStore';
// ...
function readLS(): OpenTrade[] {
  if (typeof localStorage === 'undefined') return [];
  return parseOpenTrades(localStorage.getItem(LS_KEY));
}
```

**Step 6 — verify nothing regressed:** `npm test` (full suite — expect prior
count + 2 new files all green) and `npx tsc --noEmit`.

**Step 7 — commit:**
```bash
git add src/lib/openTradesStore.ts src/lib/openTradesStore.test.ts src/hooks/useOpenTrades.ts
git commit -m "refactor: extract testable parseOpenTrades; harden readLS"
```

---

### Task 5: Cross-tab `storage` listener in `useOpenTrades`

**Files:**
- Modify: `src/hooks/useOpenTrades.ts`

**Step 1 — add the listener at module load.** After `let snapshot = readLS();`
and the `listeners`/`emit` definitions, add:
```ts
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    // storage events fire only in OTHER tabs (no echo loop). Adopt the
    // latest persisted state when this key (or all keys) changed.
    if (e.key === LS_KEY || e.key == null) {
      snapshot = readLS();
      emit();
    }
  });
}
```
Place it AFTER `readLS`, `emit`, and `snapshot` are defined (hoisting-safe:
`function readLS`/`function emit` are hoisted; `snapshot` must be declared
above this block).

**Step 2 — verify:** `npx tsc --noEmit && npm run build && npm test`
Expected: clean; full suite green.

**Step 3 — commit:**
```bash
git add src/hooks/useOpenTrades.ts
git commit -m "fix: sync open trades across tabs via storage event (adopt latest)"
```

---

### Task 6: Final verification

**Step 1 — automated:**
```bash
npm test          # all prior tests + exitValidation + openTradesStore green
npx tsc --noEmit  # clean
npm run build     # succeeds
```

**Step 2 — manual (DOM behavior the harness can't cover):**
1. Run `npm run dev`. Open the Trading page → Trade Tracker. Track a test
   trade. Click **Close → Journal**:
   - With exit price blank: the hint shows and **Confirm is disabled**.
   - Type `0`: still disabled. Type a positive price: enabled; confirm files
     correctly to the Journal.
   - Re-open close on a trade with no target: exit field is **blank or live
     price**, never the entry/target.
2. Open the app in **two tabs**, both on the Tracker. Add a trade in tab A →
   tab B reflects it within a moment (no manual refresh). Remove in B → A
   updates. No lost trades.

**Step 3 — update design doc status** to `Implemented` and commit:
```bash
git add docs/plans/2026-05-18-tradetracker-integrity-fixes-design.md
git commit -m "docs: mark TradeTracker integrity fixes implemented"
```
