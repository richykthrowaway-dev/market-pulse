# Close-Flow Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Trade Tracker → Journal close step show realized P&L/R before filing, require an explicit exit reason, and be double-click safe — with the P&L math extracted to a shared, tested module.

**Architecture:** Move the three pure P&L functions out of the side-effectful `useTradeJournal` hook into `src/lib/tradeMath.ts` (self-contained, no hook import → acyclic), re-export for back-compat, unit-test them, then consume them in `TradeTracker.tsx` for a live close preview plus two small UI guards.

**Tech Stack:** React + Vite + TypeScript, Vitest 2 (`environment: node`, `include: ['src/lib/**/*.test.ts']`).

**Hard constraints:**
- `npm test` runs ONLY `src/lib/**/*.test.ts` (node). Do NOT change `vitest.config.ts`. Component/hook DOM behavior is verified by `npx tsc --noEmit`, `npm run build`, and the documented manual checks.
- Work from `C:\Users\PC\Downloads\market-pulse`, branch `master`. NEVER `git add -A` — the repo has unrelated uncommitted WIP. Stage ONLY the files each task names.
- Design ref: `docs/plans/2026-05-18-close-flow-quality-design.md`.

---

### Task 1: Extract `tradeMath.ts` (TDD) + re-export

**Files:**
- Create: `src/lib/tradeMath.ts`
- Create: `src/lib/tradeMath.test.ts`
- Modify: `src/hooks/useTradeJournal.ts`

Current state: `useTradeJournal.ts` defines & exports `computePnL(t)`, `computeInitialRisk(t)`, `computeR(t)` (pure; `computePnL = side==='long' ? (exit-entry)*qty : (entry-exit)*qty; then - fees`. `computeInitialRisk = stopLoss==null ? null : abs(entry-stopLoss)*qty`. `computeR = risk==null||0 ? null : pnl/risk`). Many journal components import these FROM `@/hooks/useTradeJournal`.

**Step 1 — failing test `src/lib/tradeMath.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import { computePnL, computeInitialRisk, computeR } from './tradeMath';

const base = { side: 'long' as const, entryPrice: 100, exitPrice: 110,
  quantity: 10, fees: 5 };

describe('computePnL', () => {
  it('long nets fees', () => { expect(computePnL(base)).toBe(95); });        // (110-100)*10 - 5
  it('short flips direction', () => {
    expect(computePnL({ ...base, side: 'short', exitPrice: 90 })).toBe(95);  // (100-90)*10 - 5
  });
});
describe('computeInitialRisk', () => {
  it('null without a stop', () => { expect(computeInitialRisk(base)).toBeNull(); });
  it('abs(entry-stop)*qty', () => {
    expect(computeInitialRisk({ ...base, stopLoss: 98 })).toBe(20);          // |100-98|*10
  });
});
describe('computeR', () => {
  it('null when no stop', () => { expect(computeR(base)).toBeNull(); });
  it('pnl / initialRisk', () => {
    expect(computeR({ ...base, stopLoss: 98 })).toBe(95 / 20);
  });
});
```

**Step 2 — run, expect FAIL:** `npm test -- tradeMath` (module not found)

**Step 3 — implement `src/lib/tradeMath.ts`** (self-contained; NO import from hooks → no cycle):
```ts
/** Minimal structural input shared by the Journal and the close preview.
 *  TradeEntry (in useTradeJournal) is a superset and is assignable here. */
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

**Step 4 — run, expect PASS:** `npm test -- tradeMath`

**Step 5 — re-export from `useTradeJournal.ts`.** Delete the three function
bodies (`computePnL`, `computeInitialRisk`, `computeR`) and replace with a
re-export so every existing `import { computePnL } from '@/hooks/useTradeJournal'`
still resolves:
```ts
export { computePnL, computeInitialRisk, computeR } from '@/lib/tradeMath';
```
Keep `TradeEntry`/`TradeSide`/`ExitReason` types and everything else in the
hook unchanged. (TradeEntry has all `TradeMathInput` fields plus extras →
existing call sites still type-check.)

**Step 6 — verify nothing regressed:**
```
npm test
npx tsc --noEmit
npm run build
```
Expected: full suite green (prior count + new `tradeMath` file); tsc clean
(no caller broke — the re-export preserves the import surface); build OK.

**Step 7 — commit (stage ONLY these three files):**
```
git add src/lib/tradeMath.ts src/lib/tradeMath.test.ts src/hooks/useTradeJournal.ts
git commit -m "refactor: extract pure tradeMath (testable P&L/R), re-export from journal"
```

---

### Task 2: Require explicit exit reason (`TradeTracker.tsx`)

**Files:** Modify: `src/components/trading/TradeTracker.tsx`

Current: `const [exitReason, setExitReason] = useState<ExitReason>('target');`
`beginClose` sets `setExitReason('target')`. A `<Select value={exitReason}>`
renders `EXIT_REASONS`. `confirmClose` already begins with
`if (!isValidExit(exitPrice)) return;`. The confirm button is disabled by
`!isValidExit(exitPrice)`.

**Step 1 — state type.** Change to:
```ts
const [exitReason, setExitReason] = useState<ExitReason | ''>('');
```

**Step 2 — `beginClose`.** Change `setExitReason('target');` to
`setExitReason('');`.

**Step 3 — Select placeholder.** Ensure the Select trigger shows a
placeholder when unset. The `<SelectValue />` for exit reason should read
`<SelectValue placeholder="Why did you exit?" />`. Keep `value={exitReason}`
and `onValueChange={(v) => setExitReason(v as ExitReason)}`. Do NOT add an
empty-string `<SelectItem>` (Radix forbids it) — the empty controlled value
shows the placeholder; items keep their real `ExitReason` values.

**Step 4 — guard `confirmClose`.** Immediately after the existing
`if (!isValidExit(exitPrice)) return;` add:
```ts
if (exitReason === '') return;
```

**Step 5 — button disabled.** The confirm button's `disabled` (currently
`!isValidExit(exitPrice)`) becomes:
```ts
disabled={!isValidExit(exitPrice) || exitReason === ''}
```
Also extend the existing inline hint so it covers a missing reason (e.g. if
exit is valid but reason unset, show "Pick an exit reason to file this trade.").
Keep it one short conditional line; do not restructure the form.

**Step 6 — verify:** `npx tsc --noEmit && npm run build`
Expected: clean (note: `exitReason` is now `ExitReason | ''`; the
`addTrade({... exitReason ...})` call passes only after the `=== ''` guard, so
its type is narrowed to `ExitReason` — confirm tsc agrees; if tsc still widens,
add `exitReason: exitReason as ExitReason` at the addTrade call, which is sound
because the guard guarantees it).

**Step 7 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: require an explicit exit reason before filing to Journal"
```

---

### Task 3: Realized P&L + R preview (`TradeTracker.tsx`)

**Files:** Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — import the math + helper** (near other `@/lib` imports):
```ts
import { computePnL, computeR } from '@/lib/tradeMath';
// isValidExit is already imported from '@/lib/exitValidation'
```

**Step 2 — compute the preview inside the open-trade `.map((t) => {...})`
render, where the inline close form is shown (the block guarded by
`closingId === t.id`).** Add, just before the confirm button:
```tsx
{(() => {
  if (!isValidExit(exitPrice)) {
    return (
      <div className="text-xs text-muted-foreground">
        Books <span className="font-mono-num">—</span>
      </div>
    );
  }
  const m = {
    side: t.side, entryPrice: t.entryPrice,
    exitPrice: Number(exitPrice), quantity: t.quantity,
    fees: Number(fees) || 0, stopLoss: t.stopLoss,
  };
  const pnl = computePnL(m);
  const r = computeR(m);
  const cls = pnl > 0 ? 'text-trading-buy'
    : pnl < 0 ? 'text-trading-sell' : 'text-muted-foreground';
  return (
    <div className="text-xs">
      Books{' '}
      <span className={`font-mono-num font-semibold ${cls}`}>
        {pnl >= 0 ? '+' : ''}{money(pnl)}
      </span>
      {r != null && (
        <span className="text-muted-foreground"> · {r.toFixed(2)}R</span>
      )}
    </div>
  );
})()}
```
`money(...)` already exists in this file. `exitPrice`/`fees` are existing
component state, so this re-renders live as the user types. Do not change any
other part of the close form.

**Step 3 — verify:** `npx tsc --noEmit && npm run build` → clean.

**Step 4 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: show realized P&L/R in the close form before filing"
```

---

### Task 4: Idempotency guard (`TradeTracker.tsx`)

**Files:** Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — add a submitting ref** near the other refs/state:
```ts
const submittingRef = useRef(false);
```
(`useRef` is already imported in this file.)

**Step 2 — guard `confirmClose`.** After the existing guards
(`!isValidExit` / `exitReason === ''` returns), add as the next line:
```ts
if (submittingRef.current) return;
submittingRef.current = true;
```
At the very end of `confirmClose` (after `setClosingId(null)` /
`toast.success(...)`), reset it:
```ts
submittingRef.current = false;
```
(`addTrade`/`removeOpen` are synchronous store updates, so a try/finally is
unnecessary; resetting after the state setters is sufficient and keeps the
guard closed for the duration of the synchronous write.)

**Step 3 — also reflect in the button** (belt-and-suspenders): the confirm
button `disabled` becomes:
```ts
disabled={!isValidExit(exitPrice) || exitReason === '' || submittingRef.current}
```
(Ref reads don't trigger re-render; the function-level guard is the real
protection — the button condition is a cheap extra. Do NOT convert to state
just for the button; YAGNI.)

**Step 4 — verify:** `npx tsc --noEmit && npm run build` → clean.

**Step 5 — commit:**
```
git add src/components/trading/TradeTracker.tsx
git commit -m "fix: guard confirmClose against double-submit (one Journal row)"
```

---

### Task 5: Final verification

**Step 1 — automated:**
```
npm test          # all prior + tradeMath green
npx tsc --noEmit  # clean
npm run build     # succeeds (pre-existing chunk-size warning OK)
```

**Step 2 — manual (`npm run dev`, Trading page → Trade Tracker):**
1. Track a test trade, click **Close → Journal**.
2. Exit reason starts unselected; with a valid exit price, **Confirm is
   disabled** until a reason is picked; hint explains why.
3. Type a valid exit → preview shows `Books +$X.XX · N.NNR` (R only if the
   trade had a stop), updates live as you change exit/fees; invalid/blank
   exit → `Books —`.
4. Confirm once → exactly one Journal row; rapid double-click → still one row.

**Step 3 — mark design implemented + commit:**
```
git add docs/plans/2026-05-18-close-flow-quality-design.md
git commit -m "docs: mark close-flow quality implemented"
```
