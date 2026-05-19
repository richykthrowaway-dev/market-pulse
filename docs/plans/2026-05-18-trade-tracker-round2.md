# Trade Tracker Round-2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Risk Cockpit, auto plan-adherence tagging, per-position sparklines + inline edit, and partial/scale-out closes to the Trade Tracker.

**Architecture:** Every new calculation is a pure function in `src/lib` (TDD via the node Vitest harness). UI changes are confined to `src/components/trading/TradeTracker.tsx`, which already renders inside a per-widget ErrorBoundary and reads self-healed storage (shipped Resilience Bundle), so none of this can reintroduce the white-screen class.

**Tech Stack:** React 18 + TS + Vite; Vitest (`environment: node`, glob `src/lib/**/*.test.ts`); `sonner` toasts; recharts; existing hooks `useOpenTrades`/`useTradeJournal`/`useSparkline`/`useLiveQuotes`.

**Hard constraints (every task):**
- NEVER modify or stage `src/App.tsx` or `src/pages/TradeJournal.tsx` (user WIP). We edit the hook `src/hooks/useTradeJournal.ts`, never the page.
- NEVER `git add -A`/`.`. Stage only the exact files named in the task.
- Commits stay LOCAL — never `git push` (user pushes manually).
- Windows; `git -c core.safecrlf=false commit` (CRLF warnings are cosmetic).
- Commands: single test `npx vitest run <file>`; full `npm test`; `npx tsc --noEmit`; `npm run build` (a pre-existing >500 kB chunk warning + an `articles.ts` duplicate-key warning are EXPECTED — not failures).
- Phases are independent commit sets. Do them in order 1→2→3→4.

---

# PHASE 1 — Risk Cockpit lite

## Task 1: `portfolioRisk` pure lib (TDD)

**Files:** Create `src/lib/portfolioRisk.ts`, `src/lib/portfolioRisk.test.ts`.

**Step 1 — failing test** `src/lib/portfolioRisk.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aggregateRisk } from './portfolioRisk';
import type { OpenTrade } from '@/hooks/useOpenTrades';

const t = (o: Partial<OpenTrade>): OpenTrade => ({
  id: 'x', symbol: 'X', side: 'long', quantity: 1, entryPrice: 100,
  entryDate: '2026-05-15', planValid: true, ...o,
});

describe('aggregateRisk', () => {
  it('sums |entry-stop|*qty; pct vs account; perPosition', () => {
    const r = aggregateRisk(
      [t({ id: 'a', entryPrice: 100, stopLoss: 95, quantity: 10 }),
       t({ id: 'b', side: 'short', entryPrice: 50, stopLoss: 55, quantity: 4 })],
      10000,
    );
    expect(r.totalRisk).toBe(70);            // 5*10 + 5*4
    expect(r.pct).toBeCloseTo(0.7);          // 70/10000*100
    expect(r.noStopCount).toBe(0);
    expect(r.perPosition).toEqual([{ id: 'a', risk: 50 }, { id: 'b', risk: 20 }]);
  });
  it('no-stop positions contribute 0 and are counted; null pct without account', () => {
    const r = aggregateRisk([t({ id: 'a', stopLoss: 95, quantity: 2 }), t({ id: 'c' })]);
    expect(r.totalRisk).toBe(10);
    expect(r.pct).toBeNull();
    expect(r.noStopCount).toBe(1);
  });
  it('empty -> zeros', () => {
    expect(aggregateRisk([], 1000)).toEqual({ totalRisk: 0, pct: 0, noStopCount: 0, perPosition: [] });
  });
});
```

**Step 2 — run, expect FAIL:** `npx vitest run src/lib/portfolioRisk.test.ts` (module missing).

**Step 3 — implement** `src/lib/portfolioRisk.ts`:
```ts
import type { OpenTrade } from '@/hooks/useOpenTrades';

export interface AggregateRisk {
  totalRisk: number;
  pct: number | null;
  noStopCount: number;
  perPosition: { id: string; risk: number }[];
}

/** Total open risk = Σ |entry − stop| × qty over positions WITH a stop.
 *  Positions without a finite stop contribute 0 and bump noStopCount. */
export function aggregateRisk(open: OpenTrade[], account?: number): AggregateRisk {
  let totalRisk = 0;
  let noStopCount = 0;
  const perPosition: { id: string; risk: number }[] = [];
  for (const o of open) {
    const hasStop = typeof o.stopLoss === 'number' && Number.isFinite(o.stopLoss);
    const risk = hasStop ? Math.abs(o.entryPrice - (o.stopLoss as number)) * o.quantity : 0;
    if (!hasStop) noStopCount++;
    totalRisk += risk;
    perPosition.push({ id: o.id, risk });
  }
  const pct = account && account > 0 ? (totalRisk / account) * 100 : (account === undefined ? null : 0);
  return { totalRisk, pct, noStopCount, perPosition };
}
```
Note: empty + `account=1000` must yield `pct:0` (test 3); no `account` arg yields `pct:null` (test 2). The expression above does that.

**Step 4 — run, expect PASS:** `npx vitest run src/lib/portfolioRisk.test.ts` then `npx tsc --noEmit` (0).

**Step 5 — commit:**
```bash
git add src/lib/portfolioRisk.ts src/lib/portfolioRisk.test.ts
git -c core.safecrlf=false commit -m "feat: aggregateRisk pure lib (portfolio open-risk)"
```

---

## Task 2: `openR` in tradeMetrics (TDD)

**Files:** Modify `src/lib/tradeMetrics.ts`; Create `src/lib/tradeMetrics.test.ts`.

**Step 1 — failing test** `src/lib/tradeMetrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openR } from './tradeMetrics';

describe('openR', () => {
  it('long: +1R at target distance, negative below entry', () => {
    expect(openR('long', 100, 90, 110)).toBeCloseTo(1);   // (110-100)/(100-90)
    expect(openR('long', 100, 90, 95)).toBeCloseTo(-0.5);
  });
  it('short: signed correctly', () => {
    expect(openR('short', 100, 110, 90)).toBeCloseTo(1);   // (100-90)/(110-100)
  });
  it('null when no stop or entry===stop or non-finite', () => {
    expect(openR('long', 100, undefined, 110)).toBeNull();
    expect(openR('long', 100, 100, 110)).toBeNull();
    expect(openR('long', 100, 90, NaN)).toBeNull();
  });
});
```

**Step 2 — run, expect FAIL** (`openR` not exported): `npx vitest run src/lib/tradeMetrics.test.ts`.

**Step 3 — append to `src/lib/tradeMetrics.ts`** (do not change existing exports):
```ts
/** Live R-multiple of an open position. null if no usable stop. */
export function openR(
  side: 'long' | 'short',
  entry: number,
  stop: number | undefined,
  live: number,
): number | null {
  if (stop == null || !Number.isFinite(stop) || !Number.isFinite(live)) return null;
  const perR = Math.abs(entry - stop);
  if (perR === 0) return null;
  const dir = side === 'long' ? 1 : -1;
  return ((live - entry) * dir) / perR;
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/tradeMetrics.test.ts && npm test && npx tsc --noEmit` (full suite stays green).

**Step 5 — commit:**
```bash
git add src/lib/tradeMetrics.ts src/lib/tradeMetrics.test.ts
git -c core.safecrlf=false commit -m "feat: openR live R-multiple in tradeMetrics"
```

---

## Task 3: Open-risk strip + per-row R readout (UI)

**Files:** Modify `src/components/trading/TradeTracker.tsx`. Read it fully first.

**Step 1 — imports:** add `aggregateRisk` to a new import line and add `openR` to the EXISTING `@/lib/tradeMetrics` import (currently `import { unrealizedPnl, stopProximity } from '@/lib/tradeMetrics';`):
```tsx
import { unrealizedPnl, stopProximity, openR } from '@/lib/tradeMetrics';
import { aggregateRisk } from '@/lib/portfolioRisk';
```

**Step 2 — compute (in component body, after `const quotes = useLiveQuotes(...)`):**
```tsx
const rp = readRiskParams();
const risk = useMemo(() => aggregateRisk(open, rp?.account), [open, rp?.account]);
const riskOver = rp != null && risk.pct != null && risk.pct > rp.riskPct * 3;
```
(`readRiskParams` already exists in this file. Do NOT call hooks conditionally; `useMemo` is fine.)

**Step 3 — render the strip** inside the Open Positions column, directly under the `Open positions` header row (find the `<p ...>Open positions</p>` / "tracked" header block). Add:
```tsx
{open.length > 0 && (
  <div className={`text-[11px] font-mono-num rounded-md border px-2 py-1 ${
    riskOver ? 'border-trading-sell/50 text-trading-sell' : 'border-border/50 text-muted-foreground'
  }`}>
    Open risk {money(risk.totalRisk)}
    {risk.pct != null && <> · {risk.pct.toFixed(2)}% acct</>}
    {risk.noStopCount > 0 && <> · {risk.noStopCount} no-stop</>}
    {riskOver && <> · over 3× plan</>}
  </div>
)}
```

**Step 4 — per-row R readout.** In the `open.map((t) => { ... })` body where `livePrice`/`pnl` are computed, add:
```tsx
const rMult = livePrice != null ? openR(t.side, t.entryPrice, t.stopLoss, livePrice) : null;
```
Then in the live row, next to the existing pnl span, add:
```tsx
{rMult != null && (
  <span className={`font-mono-num ${rMult >= 0 ? 'text-trading-buy' : 'text-trading-sell'}`}>
    {rMult >= 0 ? '+' : ''}{rMult.toFixed(2)}R
  </span>
)}
```

**Step 5 — verify:** `npx tsc --noEmit && npm run build` (both clean).

**Step 6 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: open-risk strip + per-position live R readout"
```

---

## Task 4: Stop/target crossing alert (UI)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — state ref** (in component body, near other refs):
```tsx
const crossRef = useRef<Record<string, 'ok' | 'breached' | 'target'>>({});
```

**Step 2 — detect transitions in an effect.** After `quotes`/`open` are available, add:
```tsx
useEffect(() => {
  for (const t of open) {
    const q = quotes[t.symbol.trim().toUpperCase()];
    const live = q?.price ?? null;
    if (live == null) continue;
    const reached = t.target != null && (t.side === 'long' ? live >= t.target : live <= t.target);
    const breached = stopProximity(t.side, t.entryPrice, t.stopLoss, live) === 'breached';
    const next: 'ok' | 'breached' | 'target' = breached ? 'breached' : reached ? 'target' : 'ok';
    const prev = crossRef.current[t.id] ?? 'ok';
    if (next !== prev && next !== 'ok') {
      toast(next === 'breached' ? `${t.symbol} hit stop` : `${t.symbol} hit target`);
    }
    crossRef.current[t.id] = next;
  }
}, [quotes, open]);
```
(Transition-only: a toast fires once when state changes into breached/target, not every render. No browser Notification API.)

**Step 3 — verify:** `npx tsc --noEmit && npm run build`.

**Step 4 — manual check (throttle-immune; optional during dev):** seed an open trade, set a target at/below current live price → on next quote tick a single "hit target" toast appears, and does not repeat on subsequent ticks while still past target.

**Step 5 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: one-shot stop/target crossing toast"
```

---

# PHASE 2 — Auto plan-adherence tag at close

## Task 5: `planAdherence` pure lib (TDD)

**Files:** Create `src/lib/planAdherence.ts`, `src/lib/planAdherence.test.ts`.

**Step 1 — failing test** `src/lib/planAdherence.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classifyExit } from './planAdherence';

describe('classifyExit', () => {
  it('stopped (long/short)', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 89 })).toBe('stopped');
    expect(classifyExit({ side: 'short', entry: 100, stop: 110, target: 80, exitPrice: 111 })).toBe('stopped');
  });
  it('target hit exactly; let it run beyond', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 120 })).toBe('target hit');
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 130 })).toBe('let it run');
  });
  it('between: loss -> cut early; profit -> overstayed', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 97 })).toBe('cut early');
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 110 })).toBe('overstayed');
  });
  it('never throws on partial inputs', () => {
    expect(() => classifyExit({ side: 'long', entry: 100, exitPrice: 105 })).not.toThrow();
  });
});
```

**Step 2 — run, expect FAIL.**

**Step 3 — implement** `src/lib/planAdherence.ts`:
```ts
export type AdherenceTag = 'stopped' | 'target hit' | 'let it run' | 'cut early' | 'overstayed';

export interface ExitFacts {
  side: 'long' | 'short';
  entry: number;
  stop?: number;
  target?: number;
  exitPrice: number;
}

/** Total, never-throws classification of an exit vs the original plan. */
export function classifyExit(f: ExitFacts): AdherenceTag {
  const dir = f.side === 'long' ? 1 : -1;
  const gain = (f.exitPrice - f.entry) * dir; // per-share signed P/L
  const hitStop = f.stop != null && (f.side === 'long' ? f.exitPrice <= f.stop : f.exitPrice >= f.stop);
  if (hitStop) return 'stopped';
  if (f.target != null) {
    const reached = f.side === 'long' ? f.exitPrice >= f.target : f.exitPrice <= f.target;
    const beyond = f.side === 'long' ? f.exitPrice > f.target : f.exitPrice < f.target;
    if (beyond) return 'let it run';
    if (reached) return 'target hit';
  }
  return gain < 0 ? 'cut early' : 'overstayed';
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/planAdherence.test.ts && npm test && npx tsc --noEmit`.

**Step 5 — commit:**
```bash
git add src/lib/planAdherence.ts src/lib/planAdherence.test.ts
git -c core.safecrlf=false commit -m "feat: classifyExit plan-adherence pure lib"
```

---

## Task 6: Tag the Journal entry on close (wiring)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — import:** `import { classifyExit } from '@/lib/planAdherence';`

**Step 2 — in `confirmClose`,** the `addTrade({...})` payload currently has `tags: []`. Replace `tags: []` with:
```tsx
tags: [classifyExit({ side: t.side, entry: t.entryPrice, stop: t.stopLoss, target: t.target, exitPrice: Number(exitPrice) || 0 })],
```
Change NOTHING else in `confirmClose` (keep `isValidExit`/`submittingRef` guards, `newId` capture, Undo toast exactly as-is).

**Step 3 — verify:** `npx tsc --noEmit && npm run build`.

**Step 4 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: auto plan-adherence tag written to Journal on close"
```

---

# PHASE 3 — Per-position sparkline + inline edit

## Task 7: Per-position since-entry sparkline (UI)

**Files:** Modify `src/components/trading/TradeTracker.tsx`. Reference pattern: `src/components/trading/Watchlist.tsx` `WatchRow` (uses `useSparkline`, `<AreaChart width=.. height=.. data={bars.map((b,i)=>({i,c:b.c}))}>` with `<Area dataKey="c" isAnimationActive={false} dot={false} />`).

**Step 1 — extract a `<RowSparkline>` subcomponent** in TradeTracker.tsx (above `TradeTracker`) so the `useSparkline` hook is called once per position component instance (NOT inside `.map` of the parent):
```tsx
function RowSparkline({ t, live }: { t: OpenTrade; live: number | null }) {
  const { data } = useSparkline(t.symbol);
  const bars = data ?? [];
  if (bars.length === 0) return null;
  const d = bars.map((b, i) => ({ i, c: b.c }));
  return (
    <div style={{ width: '100%', height: 40 }} className="mt-2">
      <AreaChart width={260} height={40} data={d} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey="c" stroke="hsl(var(--primary))" strokeWidth={1} fill="hsl(var(--primary))" fillOpacity={0.12} isAnimationActive={false} dot={false} />
        {t.entryPrice > 0 && <ReferenceLine y={t.entryPrice} stroke="hsl(var(--foreground))" strokeOpacity={0.5} strokeDasharray="2 2" />}
        {t.stopLoss != null && <ReferenceLine y={t.stopLoss} stroke="hsl(var(--trading-sell))" />}
        {t.target != null && <ReferenceLine y={t.target} stroke="hsl(var(--trading-buy))" />}
        {live != null && <ReferenceLine y={live} stroke="hsl(var(--primary))" strokeDasharray="4 2" />}
      </AreaChart>
    </div>
  );
}
```
(`AreaChart`, `Area`, `ReferenceLine` are already imported in TradeTracker.tsx; `useSparkline` is already imported.)

**Step 2 — render it** inside the open-position row card (after the live row, before the actions row): `<RowSparkline t={t} live={livePrice} />`.

**Step 3 — verify:** `npx tsc --noEmit && npm run build`.

**Step 4 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: per-position since-entry sparkline with plan lines"
```

---

## Task 8: Inline edit of an open position (UI)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — state:** `const [editId, setEditId] = useState<string | null>(null);`

**Step 2 — add an "Edit" ghost button** in the row actions area (next to discard/close) `onClick={() => setEditId(editId === t.id ? null : t.id)}`.

**Step 3 — inline editor** rendered when `editId === t.id` (mirror close-form field styling — `fieldCls`/`lblCls` exist). Controlled local inputs initialised from `t`; on "Save": `patchOpen(t.id, { stopLoss, target, notes })` then `setEditId(null)`; on "Cancel": `setEditId(null)`. Use number inputs for stop/target (empty → `undefined`), text input for notes. Keep it small; reuse existing class constants. Do not alter `quantity`/`entryPrice`/`side` here.

**Step 4 — verify:** `npx tsc --noEmit && npm run build`.

**Step 5 — manual check:** edit a tracked position's stop → Save → row reflects new stop, R/risk strip recompute; reload page → persisted (it's in `tp-open-trades-v1`).

**Step 6 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: inline edit stop/target/notes for an open position"
```

---

# PHASE 4 — Partial / scale-out closes

## Task 9: `splitClose` pure lib (TDD)

**Files:** Create `src/lib/splitClose.ts`, `src/lib/splitClose.test.ts`.

**Step 1 — failing test** `src/lib/splitClose.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { planClose } from './splitClose';

describe('planClose', () => {
  it('full when closeQty == positionQty', () => {
    expect(planClose({ positionQty: 10, closeQty: 10 })).toEqual({ mode: 'full', closeQty: 10, remainder: 0 });
  });
  it('partial when 0 < closeQty < positionQty', () => {
    expect(planClose({ positionQty: 10, closeQty: 3 })).toEqual({ mode: 'partial', closeQty: 3, remainder: 7 });
  });
  it('invalid for <=0, > position, NaN', () => {
    expect(planClose({ positionQty: 10, closeQty: 0 }).mode).toBe('invalid');
    expect(planClose({ positionQty: 10, closeQty: 11 }).mode).toBe('invalid');
    expect(planClose({ positionQty: 10, closeQty: NaN }).mode).toBe('invalid');
  });
});
```

**Step 2 — run, expect FAIL.**

**Step 3 — implement** `src/lib/splitClose.ts`:
```ts
export interface ClosePlan {
  mode: 'full' | 'partial' | 'invalid';
  closeQty: number;
  remainder: number;
}
export function planClose({ positionQty, closeQty }: { positionQty: number; closeQty: number }): ClosePlan {
  if (!Number.isFinite(closeQty) || closeQty <= 0 || closeQty > positionQty) {
    return { mode: 'invalid', closeQty, remainder: positionQty };
  }
  if (closeQty === positionQty) return { mode: 'full', closeQty, remainder: 0 };
  return { mode: 'partial', closeQty, remainder: positionQty - closeQty };
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/splitClose.test.ts && npm test && npx tsc --noEmit`.

**Step 5 — commit:**
```bash
git add src/lib/splitClose.ts src/lib/splitClose.test.ts
git -c core.safecrlf=false commit -m "feat: planClose pure lib (full/partial/invalid)"
```

---

## Task 10: Wire partial close + Undo into the close form (UI)

**Files:** Modify `src/components/trading/TradeTracker.tsx`.

**Step 1 — import:** `import { planClose } from '@/lib/splitClose';`

**Step 2 — state:** `const [closeQty, setCloseQty] = useState('');`
In `beginClose(t)`, set the default: `setCloseQty(String(t.quantity));`

**Step 3 — close form field:** add a "Qty to close" number input (mirror exit-price field styling) bound to `closeQty`. Below it show validation: compute
`const cp = planClose({ positionQty: t.quantity, closeQty: Number(closeQty) });`
and disable the Confirm button when `cp.mode === 'invalid'`.

**Step 4 — `confirmClose(t)` partial branch.** Keep the `isValidExit` + `submittingRef` guards EXACTLY. After computing `cp = planClose({ positionQty: t.quantity, closeQty: Number(closeQty) || 0 })`:
- if `cp.mode === 'invalid'` → `submittingRef.current = false; return;`
- build the payload with `quantity: cp.closeQty` and, when partial, append `` `partial ${cp.closeQty}/${t.quantity}` `` to the notes join.
- `const newId = addTrade({...});`
- if `cp.mode === 'full'`: `removeOpen(t.id);` (existing behavior)
  else (`partial`): `patchOpen(t.id, { quantity: cp.remainder });`
- `setClosingId(null);`
- success toast with Undo:
  - full: `onClick: () => { deleteTrade(newId); addOpen(t); }` (unchanged)
  - partial: `onClick: () => { deleteTrade(newId); patchOpen(t.id, { quantity: t.quantity }); }`
- `submittingRef.current = false;`

**Step 5 — verify:** `npx tsc --noEmit && npm run build`.

**Step 6 — manual check (throttle-immune):** seed a 10-share position; Close → set Qty to close = 4 → Confirm → Journal gets a 4-share entry tagged + noted "partial 4/10", open position now shows 6 shares; click Undo → Journal entry removed and position back to 10. Then full close (qty 6) works as before with its Undo.

**Step 7 — commit:**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: partial/scale-out close with Undo"
```

---

## Task 11: Final verification

**Step 1:** `npm test && npx tsc --noEmit && npm run build` — all green (expected pre-existing build warnings only).

**Step 2 — boundary still intact:** the whole TradeTracker is wrapped by the shipped ErrorBoundary in `Trading.tsx`; no change needed. Spot-confirm `Trading.tsx` still wraps `<TradeTracker/>` in `<ErrorBoundary name="TradeTracker">`.

**Step 3 — clean tree:** `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx` shows them only as pre-existing ` M` user WIP, never staged by us; `git diff --cached --name-only` empty. Confirm no `git add -A` was ever used.

**Step 4 — report** the full `git log --oneline` for the phase commits and the final `npm test` summary line.

---

## Notes for the implementer
- Pure libs are the only unit-tested pieces (node Vitest harness, `src/lib/**`). UI/wiring tasks are verified by `tsc` + `build` + the documented manual checks — that is expected, not a coverage gap.
- Never call React hooks inside `.map`/conditionals — `RowSparkline` (Task 7) exists specifically so `useSparkline` is one hook call per row component instance.
- Keep `confirmClose`'s `isValidExit` and `submittingRef` guards byte-identical across Tasks 6 and 10 — they are the regression-critical close-flow protections.
- If `npm test` ever goes red because a prior task's test needs updating, fix it within that same task's commit; never leave the suite red between tasks.
