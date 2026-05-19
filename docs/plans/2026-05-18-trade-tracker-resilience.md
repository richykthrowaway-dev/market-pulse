# Trade Tracker Resilience Bundle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/trading` un-crashable by bad data — a per-widget ErrorBoundary, self-healing localStorage parsers, and Undo for discard + close.

**Architecture:** Three independent layers. (1) A dependency-free React class `ErrorBoundary` wraps each Trading widget so one crash can't blank the page. (2) Pure parser functions in `src/lib` validate/repair the open-trades and journal blobs before they ever reach React render; the hooks surface a one-time "recovered your data" toast. (3) `sonner` action toasts re-insert a discarded trade or reverse a close (delete the filed Journal row + restore the open trade).

**Tech Stack:** React 18 + TypeScript + Vite, `sonner` toasts, Vitest (`src/lib/**/*.test.ts`, `environment: node`).

**Hard constraints:**
- `src/App.tsx` AND `src/pages/TradeJournal.tsx` are uncommitted user WIP — **do NOT touch them**. (We modify the hook `src/hooks/useTradeJournal.ts`, never the page `TradeJournal.tsx`.)
- **NEVER `git add -A`.** Stage only the exact files named in each task's commit step.
- Verify commands before claiming success (REQUIRED SUB-SKILL: superpowers:verification-before-completion).

---

## Task 1: Create the dependency-free `ErrorBoundary` component

**Files:**
- Create: `src/components/common/ErrorBoundary.tsx`

**Step 1 — Create the file with this exact content:**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: (reset: () => void) => ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Dependency-free error boundary. React requires a class for this.
 * Catches render/lifecycle errors in its subtree so one broken widget
 * degrades to a recoverable card instead of unmounting the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this — it's the only signal when a widget dies in prod.
    console.error(`[ErrorBoundary:${this.props.name ?? 'unnamed'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.reset);
      return (
        <div className="trading-card rounded-lg border border-border/60 p-4 text-sm">
          <p className="font-medium text-foreground">This panel hit an error.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The rest of the page is unaffected.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Step 2 — Typecheck:**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

**Step 3 — Commit:**

```bash
git add src/components/common/ErrorBoundary.tsx
git commit -m "feat: add dependency-free ErrorBoundary component"
```

---

## Task 2: Wrap each Trading widget in its own `ErrorBoundary`

**Files:**
- Modify: `src/pages/Trading.tsx` (import + wrap `<TradeTracker/>`, `<Watchlist/>`, `<SymbolChart/>`, `<QuickOrder/>`)

**Step 1 — Add the import** near the other component imports (after the `TradeTracker` import line):

```tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
```

**Step 2 — Wrap each widget at its render site.** Replace each usage:

- `<TradeTracker />` → `<ErrorBoundary name="TradeTracker"><TradeTracker /></ErrorBoundary>`
- `<Watchlist ... />` → wrap the whole `<Watchlist ... />` element in `<ErrorBoundary name="Watchlist"> ... </ErrorBoundary>`
- `<SymbolChart symbol={selSymbol} />` → `<ErrorBoundary name="SymbolChart"><SymbolChart symbol={selSymbol} /></ErrorBoundary>`
- `<QuickOrder ... />` → `<ErrorBoundary name="QuickOrder"> ... </ErrorBoundary>`

Do not change any props or other markup.

**Step 3 — Typecheck + build:**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0 (pre-existing chunk-size warning is fine).

**Step 4 — Commit:**

```bash
git add src/pages/Trading.tsx
git commit -m "feat: isolate each Trading widget behind an ErrorBoundary"
```

---

## Task 3: Harden `parseOpenTrades` (TDD) + return repair stats

**Files:**
- Modify: `src/lib/openTradesStore.ts`
- Test: `src/lib/openTradesStore.test.ts` (extend)

**Step 1 — Write failing tests.** Append to `src/lib/openTradesStore.test.ts`:

```ts
import { parseOpenTrades } from './openTradesStore';

describe('parseOpenTrades hardening', () => {
  it('returns empty + dropped 0 for null / non-array / bad JSON', () => {
    expect(parseOpenTrades(null)).toEqual({ trades: [], dropped: 0 });
    expect(parseOpenTrades('not json')).toEqual({ trades: [], dropped: 0 });
    expect(parseOpenTrades('{}')).toEqual({ trades: [], dropped: 0 });
  });

  it('drops malformed rows and counts them', () => {
    const raw = JSON.stringify([
      { id: 'a', symbol: 'AAPL', side: 'long', quantity: 10, entryPrice: 190, entryDate: '2026-05-15', planValid: true },
      { id: 'b', symbol: 'TSLA' },                 // missing numeric fields -> drop
      null,                                        // not an object -> drop
      { symbol: 'NVDA', quantity: 1, entryPrice: 9 }, // missing id -> drop
    ]);
    const r = parseOpenTrades(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].symbol).toBe('AAPL');
    expect(r.dropped).toBe(3);
  });

  it('coerces side and defaults planValid', () => {
    const raw = JSON.stringify([
      { id: 'x', symbol: 'msft', side: 'BUY', quantity: 2, entryPrice: 400, entryDate: '2026-05-15' },
    ]);
    const r = parseOpenTrades(raw);
    expect(r.trades[0].side).toBe('long');
    expect(r.trades[0].planValid).toBe(true);
  });
});
```

**Step 2 — Run, verify it fails:**

Run: `npx vitest run src/lib/openTradesStore.test.ts`
Expected: FAIL — `parseOpenTrades` currently returns an array, not `{ trades, dropped }`.

**Step 3 — Reimplement `parseOpenTrades` in `src/lib/openTradesStore.ts`** as a hardened pure function returning stats. Replace the existing `parseOpenTrades` with:

```ts
export interface ParseResult {
  trades: OpenTrade[];
  dropped: number;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

export function parseOpenTrades(raw: string | null): ParseResult {
  if (raw == null) return { trades: [], dropped: 0 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { trades: [], dropped: 0 }; }
  if (!Array.isArray(arr)) return { trades: [], dropped: 0 };

  const trades: OpenTrade[] = [];
  let dropped = 0;
  for (const row of arr) {
    if (!row || typeof row !== 'object') { dropped++; continue; }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id ? r.id : undefined;
    const symbol = typeof r.symbol === 'string' && r.symbol.trim() ? r.symbol.trim().toUpperCase() : undefined;
    const entryPrice = num(r.entryPrice);
    const quantity = num(r.quantity);
    if (!id || !symbol || entryPrice == null || quantity == null) { dropped++; continue; }
    trades.push({
      id,
      symbol,
      side: r.side === 'short' ? 'short' : 'long',
      quantity,
      entryPrice,
      stopLoss: num(r.stopLoss),
      target: num(r.target),
      entryDate: typeof r.entryDate === 'string' ? r.entryDate : '',
      setup: typeof r.setup === 'string' ? r.setup : undefined,
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      planValid: r.planValid !== false,
    });
  }
  return { trades, dropped };
}
```

(Keep the `OpenTrade` import/type usage exactly as before — type-only import.)

**Step 4 — Update `readLS` in the same file** (or wherever it lives) to consume `.trades`. In `src/hooks/useOpenTrades.ts`, `readLS()` currently does `return parseOpenTrades(localStorage.getItem(LS_KEY));`. Change to:

```ts
function readLS(): OpenTrade[] {
  if (typeof localStorage === 'undefined') return [];
  const { trades, dropped } = parseOpenTrades(localStorage.getItem(LS_KEY));
  if (dropped > 0) pendingNotice.open += dropped;
  return trades;
}
```

Add at module scope in `src/hooks/useOpenTrades.ts` (top, after imports):

```ts
// One-time "we recovered your data" signal, consumed by the UI layer.
export const pendingNotice = { open: 0 };
```

**Step 5 — Run tests, verify pass:**

Run: `npx vitest run src/lib/openTradesStore.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0. (If older tests asserted an array return, update them to `.trades` in the same commit.)

**Step 6 — Commit:**

```bash
git add src/lib/openTradesStore.ts src/lib/openTradesStore.test.ts src/hooks/useOpenTrades.ts
git commit -m "feat: self-healing parseOpenTrades with drop-count stats"
```

---

## Task 4: Add `parseJournal` (TDD) + wire into `useTradeJournal`

**Files:**
- Create: `src/lib/parseJournal.ts`
- Test: `src/lib/parseJournal.test.ts`
- Modify: `src/hooks/useTradeJournal.ts`

**Step 1 — Write failing tests** `src/lib/parseJournal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseJournal } from './parseJournal';

describe('parseJournal', () => {
  it('null / non-array / bad JSON -> empty', () => {
    expect(parseJournal(null)).toEqual({ trades: [], dropped: 0 });
    expect(parseJournal('nope')).toEqual({ trades: [], dropped: 0 });
    expect(parseJournal('{"a":1}')).toEqual({ trades: [], dropped: 0 });
  });

  it('repairs missing exitDate from entryDate/createdAt (no throw on sort)', () => {
    const raw = JSON.stringify([
      { id: '1', symbol: 'AAPL', entryDate: '2026-05-10', createdAt: '2026-05-12T00:00:00Z' },
    ]);
    const r = parseJournal(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].exitDate).toBe('2026-05-10');
    expect(() => [...r.trades].sort((a, b) => b.exitDate.localeCompare(a.exitDate))).not.toThrow();
  });

  it('drops rows missing id+symbol; counts them', () => {
    const raw = JSON.stringify([
      { id: '1', symbol: 'AAPL', exitDate: '2026-05-12' },
      { foo: 'bar' },
      42,
    ]);
    const r = parseJournal(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });
});
```

**Step 2 — Run, verify fail:**

Run: `npx vitest run src/lib/parseJournal.test.ts`
Expected: FAIL — module does not exist.

**Step 3 — Create `src/lib/parseJournal.ts`:**

```ts
import type { TradeEntry } from '@/hooks/useTradeJournal';

export interface JournalParseResult {
  trades: TradeEntry[];
  dropped: number;
}

const n = (v: unknown, d = 0): number => {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
};
const s = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export function parseJournal(raw: string | null): JournalParseResult {
  if (raw == null) return { trades: [], dropped: 0 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { trades: [], dropped: 0 }; }
  if (!Array.isArray(arr)) return { trades: [], dropped: 0 };

  const trades: TradeEntry[] = [];
  let dropped = 0;
  for (const row of arr) {
    if (!row || typeof row !== 'object') { dropped++; continue; }
    const r = row as Record<string, unknown>;
    const id = s(r.id);
    const symbol = s(r.symbol);
    if (!id || !symbol) { dropped++; continue; }
    const createdAt = s(r.createdAt);
    const entryDate = s(r.entryDate);
    trades.push({
      ...(r as object),
      id,
      symbol,
      side: r.side === 'short' ? 'short' : 'long',
      quantity: n(r.quantity),
      entryPrice: n(r.entryPrice),
      exitPrice: n(r.exitPrice),
      entryDate,
      // The field whose absence white-screened the app via .localeCompare:
      exitDate: s(r.exitDate) || entryDate || createdAt || '',
      fees: n(r.fees),
      notes: s(r.notes),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      createdAt: createdAt || new Date(0).toISOString(),
    } as TradeEntry);
  }
  return { trades, dropped };
}
```

**Step 4 — Wire into `src/hooks/useTradeJournal.ts`:**

- Add import: `import { parseJournal } from '@/lib/parseJournal';`
- Add module-scope: `export const pendingJournalNotice = { dropped: 0 };`
- Replace `lsRead()` body with:

```ts
function lsRead(): TradeEntry[] {
  try {
    const { trades, dropped } = parseJournal(localStorage.getItem(LS_KEY));
    if (dropped > 0) pendingJournalNotice.dropped += dropped;
    return trades;
  } catch { return []; }
}
```

- Change `addTrade` to **return the new id** (callers ignoring the return are unaffected):

```ts
const addTrade = useCallback((input: Omit<TradeEntry, 'id' | 'createdAt'>): string => {
  const id = crypto.randomUUID();
  update(prev => [...prev, { ...input, id, createdAt: new Date().toISOString() }]);
  return id;
}, []);
```

**Step 5 — Run tests + typecheck:**

Run: `npx vitest run src/lib/parseJournal.test.ts && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

**Step 6 — Commit:**

```bash
git add src/lib/parseJournal.ts src/lib/parseJournal.test.ts src/hooks/useTradeJournal.ts
git commit -m "feat: self-healing journal parser; addTrade returns id"
```

---

## Task 5: One-time recovery toast

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — Add imports** (top of `TradeTracker.tsx`, alongside existing ones):

```tsx
import { pendingNotice } from '@/hooks/useOpenTrades';
import { pendingJournalNotice } from '@/hooks/useTradeJournal';
```

(`toast` from `sonner` is already imported.)

**Step 2 — Add a mount effect** inside `TradeTracker()` (after the existing effects, before `return`):

```tsx
useEffect(() => {
  const dropped = pendingNotice.open + pendingJournalNotice.dropped;
  if (dropped > 0) {
    pendingNotice.open = 0;
    pendingJournalNotice.dropped = 0;
    toast(`Recovered your saved data — skipped ${dropped} unreadable row${dropped === 1 ? '' : 's'}.`);
  }
}, []);
```

**Step 3 — Typecheck + build:**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

**Step 4 — Commit:**

```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: one-time toast when corrupt stored rows were recovered"
```

---

## Task 6: Undo for discard + close

**Files:**
- Modify: `src/components/trading/TradeTracker.tsx`

**Step 1 — Discard Undo.** Find the discard handler (the `X` button → `onClick={() => removeOpen(t.id)}`). Replace with a call to a new handler defined in the component body:

```tsx
function discardOpen(t: OpenTrade) {
  removeOpen(t.id);
  toast(`${t.symbol} discarded`, {
    action: { label: 'Undo', onClick: () => addOpen(t) },
    duration: 6000,
  });
}
```
and change the button to `onClick={() => discardOpen(t)}`.

**Step 2 — Close Undo.** In `confirmClose(t)`, capture the filed id and original trade. After the existing `addTrade({...})` call, change it to:

```tsx
const newId = addTrade({ /* ...exact same payload object as before... */ });
removeOpen(t.id);
setClosingId(null);
toast(`${t.symbol} closed — filed to your Journal`, {
  action: {
    label: 'Undo',
    onClick: () => { deleteTrade(newId); addOpen(t); },
  },
  duration: 6000,
});
submittingRef.current = false;
```

Add `deleteTrade` to the `useTradeJournal()` destructure at the top of the component:
`const { addTrade, deleteTrade } = useTradeJournal();`

Do not change the `addTrade` payload contents — only capture its return value. Keep the `isValidExit`/`submittingRef` guards exactly as they are.

**Step 3 — Typecheck + build:**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

**Step 4 — Manual verification (throttle-immune; documented in design):**
- Seed an open trade, open `/trading`.
- Click `X` → toast appears → click **Undo** → trade reappears in Open Positions.
- Close → Journal a trade → toast → **Undo** → trade returns to Open Positions and is gone from the Journal (`localStorage['trade-journal-v1']` length unchanged from before the close).

**Step 5 — Commit:**

```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: Undo for discard and close-to-Journal"
```

---

## Task 7: Final verification

**Step 1 — Full suite + build:**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all green; pre-existing chunk-size warning OK.

**Step 2 — Forced-crash check.** Temporarily make `TradeTracker` throw (e.g., `if (open.length >= 0) throw new Error('x')` at the top of render), `npm run build`, load `/trading`: the Trade Tracker shows the "This panel hit an error / Try again" card while Watchlist, SymbolChart, and QuickOrder still render. Revert the temporary throw, rebuild.

**Step 3 — Confirm clean tree** (no stray WIP staged, App.tsx / TradeJournal.tsx untouched):

Run: `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx`
Expected: shows them only if they were already user-WIP modified — and **nothing of ours staged there**. Never `git add -A`.

---

## Notes for the implementer
- The Vitest harness only runs `src/lib/**/*.test.ts` in `environment: node` — ErrorBoundary/Undo/toast are verified by `tsc` + `build` + the manual steps, not unit tests. That is expected, not a gap.
- Keep the parser libs **pure** (no `toast`, no `localStorage`) — that is what makes them unit-testable. The notice/toast lives only in the hook/UI layer.
- If an older `openTradesStore.test.ts` assertion expects an array return, update it to `.trades` in Task 3's commit — do not leave the suite red.
