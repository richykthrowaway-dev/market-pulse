# Trading Fast-Entry + Terminal Restyle — Wave 1 Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate manual price typing in the Order Ticket (live prefill, %/R chips, auto-qty) and apply a scoped pro-terminal restyle to the Trading tab.

**Architecture:** Pure entry math in `src/lib` (vitest, aligned with existing `riskPreview`); chip rows + auto-qty wired into the existing `QuickOrder` in `src/pages/Trading.tsx` (no new components, no data layer); a scoped `.trading-terminal` CSS layer in `src/index.css` applied to the Trading workspace only.

**Tech Stack:** React 18, TS, Vitest, Tailwind/shadcn, Vite.

**Design doc:** `docs/plans/2026-05-17-trading-fast-entry-terminal-design.md`

**Context (verified against current code):**
- `src/pages/Trading.tsx` `QuickOrder` has state: `symbol`, `side: 'BUY'|'SELL'`, `qty` (string, default `'1'`), `orderType`, `price`, `stop` (string), `target` (string), `entry` (string), setters `setQty/setStop/setTarget/setEntry`. `livePrice` from a `useQuery(['ticket-quote',symbol])` already prefills `entry` when empty (lines ~447-458). `readRiskParams()` (module fn, line 69) → `{account,riskPct}|null` from `localStorage['tp-risk-v1']`. `riskPreview` imported from `@/lib/riskPreview` (line 50), called at ~468. `confirming` reset effect deps at line 465. Stop/target/entry `<Input>`s at lines ~687-710; qty stepper at ~657-672. Submit button label logic ~769.
- `riskPreview` (`src/lib/riskPreview.ts`) exists with `{ side:'long'|'short', entry, stop?, target?, qty, account?, riskPct? }`.
- Vitest `include` is `src/lib/**/*.test.ts`; `@`→`./src`. `npm test` runs src/lib only.
- Tailwind tokens: `--trading-buy`, `--trading-sell`, `font-mono-num`, `hsl(var(--border))` etc. Scoped editorial-style CSS layers already exist in the codebase (e.g. `.tp-ext`/`.tt-ext` namespaces) — `.trading-terminal` follows that precedent in `src/index.css`.
- You are on `master` with MANY unrelated modified files. For EVERY commit, `git add` ONLY the explicitly named files. Never `git add -A`/`.`.

---

### Task 1: Pure entry-math helpers (TDD)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\lib\entryMath.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\entryMath.test.ts`

**Step 1: Write the failing test** — `src/lib/entryMath.test.ts` EXACTLY:
```ts
import { describe, it, expect } from 'vitest';
import { stopFromPct, targetFromR, qtyFromRisk } from './entryMath';

describe('stopFromPct', () => {
  it('long stop is below entry', () => {
    expect(stopFromPct('long', 100, 2)).toBe(98);
  });
  it('short stop is above entry', () => {
    expect(stopFromPct('short', 100, 2)).toBe(102);
  });
  it('rounds to 2 decimals', () => {
    expect(stopFromPct('long', 99.99, 3)).toBe(96.99);
  });
  it('entry<=0 → null', () => {
    expect(stopFromPct('long', 0, 2)).toBeNull();
  });
});

describe('targetFromR', () => {
  it('long target = entry + R*|entry-stop|', () => {
    expect(targetFromR('long', 100, 90, 2)).toBe(120);
  });
  it('short target = entry - R*|entry-stop|', () => {
    expect(targetFromR('short', 100, 110, 2)).toBe(80);
  });
  it('no stop / zero risk → null', () => {
    expect(targetFromR('long', 100, 100, 2)).toBeNull();
    expect(targetFromR('long', 100, undefined, 2)).toBeNull();
  });
});

describe('qtyFromRisk', () => {
  it('floors account*riskPct%/perShareRisk', () => {
    // 10000 * 1% = 100 risk budget; per-share risk 10 → 10 shares
    expect(qtyFromRisk(100, 90, 10000, 1)).toBe(10);
  });
  it('rounds down', () => {
    // budget 100, per-share 7 → 14.28 → 14
    expect(qtyFromRisk(100, 93, 10000, 1)).toBe(14);
  });
  it('invalid inputs → 0', () => {
    expect(qtyFromRisk(100, 100, 10000, 1)).toBe(0); // zero per-share risk
    expect(qtyFromRisk(100, 90, 0, 1)).toBe(0);      // no account
    expect(qtyFromRisk(0, 90, 10000, 1)).toBe(0);    // no entry
  });
});
```

**Step 2: Run — verify FAILS**
`cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/entryMath.test.ts 2>&1 | tail -8`
Expected: FAIL (cannot resolve './entryMath').

**Step 3: Implement** — `src/lib/entryMath.ts` EXACTLY:
```ts
type Side = 'long' | 'short';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stop a given % away from entry (below for long, above for short). */
export function stopFromPct(side: Side, entry: number, pct: number): number | null {
  if (entry <= 0) return null;
  const d = entry * (pct / 100);
  return round2(side === 'long' ? entry - d : entry + d);
}

/** Target at R multiples of the entry→stop risk distance. */
export function targetFromR(
  side: Side,
  entry: number,
  stop: number | undefined,
  rMult: number,
): number | null {
  if (entry <= 0 || stop == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return null;
  return round2(side === 'long' ? entry + rMult * risk : entry - rMult * risk);
}

/** Position size so that |entry-stop|*qty ≈ account*riskPct%. Floored. */
export function qtyFromRisk(
  entry: number,
  stop: number,
  account: number,
  riskPct: number,
): number {
  const perShare = Math.abs(entry - stop);
  if (entry <= 0 || account <= 0 || riskPct <= 0 || perShare <= 0) return 0;
  return Math.floor((account * (riskPct / 100)) / perShare);
}
```

**Step 4: Run — verify PASSES** (`npx vitest run src/lib/entryMath.test.ts` → all green)

**Step 5: Commit**
```
git add src/lib/entryMath.ts src/lib/entryMath.test.ts
git commit -m "feat: pure entry-math helpers (stop%/targetR/qtyFromRisk)"
```

---

### Task 2: Wire chips + auto-qty + Use-live into the Order Ticket

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\pages\Trading.tsx` (the `QuickOrder` component only)

**Step 1: Imports** — add to the existing `@/lib` imports:
```ts
import { stopFromPct, targetFromR, qtyFromRisk } from '@/lib/entryMath';
```

**Step 2: Add a `qtyTouched` ref/state** near the other QuickOrder state:
```ts
const [qtyTouched, setQtyTouched] = useState(false);
```
- In the qty `<Input> onChange` (line ~665) and BOTH qty stepper buttons (lines ~657, ~672), call `setQtyTouched(true)` in addition to the existing `setQty(...)`.
- In the offline `doTrack` reset block (~lines 529-533) and the connected `onSuccess` reset, also `setQtyTouched(false)`.

**Step 3: Derived helpers inside QuickOrder** (after `rp`/`preview` are computed, ~line 478):
```ts
const sideLW = side === 'BUY' ? 'long' : 'short';
const entryN = Number(entry) || 0;
const stopN = stop ? Number(stop) : undefined;

const applyStopPct = (pct: number) => {
  const s = stopFromPct(sideLW, entryN, pct);
  if (s != null) { setStop(String(s)); }
};
const applyTargetR = (r: number) => {
  const t = targetFromR(sideLW, entryN, stopN, r);
  if (t != null) { setTarget(String(t)); }
};
const useLive = () => { if (livePrice != null) setEntry(String(livePrice)); };

// Auto-size: when entry+stop known and the user hasn't hand-edited qty,
// keep qty = risk-based size. rp may be null (no saved risk params).
useEffect(() => {
  if (qtyTouched) return;
  if (entryN > 0 && stopN != null && rp) {
    const q = qtyFromRisk(entryN, stopN, rp.account, rp.riskPct);
    if (q > 0) setQty(String(q));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [entry, stop, side, qtyTouched]);
```
(`rp` is `readRiskParams()` already computed each render; referencing it in the effect is fine — it is a plain value, not reactive. Keep the eslint-disable line; deps are intentionally limited to the trigger fields.)

**Step 4: Render chip rows.** Directly under the Stop `<Input>` (~line 699) add:
```tsx
<div className="flex gap-1 mt-1">
  {[1, 2, 3, 5].map((p) => (
    <button key={p} type="button" onClick={() => applyStopPct(p)}
      disabled={entryN <= 0}
      className="px-2 py-0.5 rounded text-[10px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-40 transition-colors">
      −{p}%
    </button>
  ))}
</div>
```
Directly under the Target `<Input>` (~line 710) add:
```tsx
<div className="flex gap-1 mt-1">
  {[1, 2, 3].map((r) => (
    <button key={r} type="button" onClick={() => applyTargetR(r)}
      disabled={entryN <= 0 || stopN == null}
      className="px-2 py-0.5 rounded text-[10px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-40 transition-colors">
      +{r}R
    </button>
  ))}
</div>
```
Add a `Use live` button next to the Entry `<Input>` (wrap the existing entry input in a `flex gap-1` row if needed):
```tsx
<button type="button" onClick={useLive} disabled={livePrice == null}
  className="shrink-0 px-2 rounded text-[11px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
  Use live
</button>
```

**Step 5: Confirm-reset deps** — the `confirming` reset effect (line ~465) already lists `qty/stop/target/entry/side`; chips call those setters so confirm correctly disarms. No change needed; verify by reading.

**Step 6: Build**
`cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -8 && npm run build 2>&1 | tail -3`
Expected: no TS errors; `✓ built` (chunk-size warning OK).

**Step 7: Commit**
```
git add src/pages/Trading.tsx
git commit -m "feat: %/R quick-set chips, Use-live, auto-qty in Order Ticket"
```

---

### Task 3: Scoped pro-terminal restyle

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\index.css` (append a scoped layer)
- Modify: `C:\Users\PC\Downloads\market-pulse\src\pages\Trading.tsx` (wrap workspace; compact header)

**Step 1: Append scoped CSS** to `src/index.css` (end of file). Reuses existing tokens; affects only descendants of `.trading-terminal`:
```css
/* ── Pro-terminal restyle (scoped; Trading tab only) ───────────────── */
.trading-terminal { letter-spacing: -0.01em; }
.trading-terminal .trading-card {
  border-color: hsl(var(--border) / 0.45);
  background: hsl(var(--card) / 0.6);
  box-shadow: none;
}
.trading-terminal .trading-card :is(h2,h3,.card-title) { letter-spacing: 0; }
/* Tighter vertical rhythm */
.trading-terminal .trading-card > * { padding-top: 0.65rem; padding-bottom: 0.65rem; }
/* Tabular, right-aligned numerics everywhere in the terminal */
.trading-terminal .font-mono-num { font-variant-numeric: tabular-nums; }
/* Hairline dividers */
.trading-terminal table tr { border-color: hsl(var(--border) / 0.4); }
.trading-terminal .tt-headstrip {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.4rem 0.1rem; border-bottom: 1px solid hsl(var(--border) / 0.4);
}
```

**Step 2: Wrap the workspace.** In `Trading()` `return`, add `trading-terminal` to the outermost content wrapper class (the `<div className="space-y-6">` inside `PageLayout`) → `className="space-y-5 trading-terminal"`. Reduce the big title block to a compact strip: replace the existing header `<div className="flex items-center justify-between flex-wrap gap-4">…<h1 className="text-2xl font-bold tracking-tight">Trading</h1>…<ConnectionStatus /></div>` with the same content but `h1` → `className="text-base font-semibold tracking-tight"` and wrap the row with an added `tt-headstrip` class (keep the account `Select` and `ConnectionStatus` exactly as-is). Do NOT remove functionality — only class/size changes.

**Step 3: Build + visual check**
`cd "C:/Users/PC/Downloads/market-pulse" && npm run build 2>&1 | tail -3`
Expected: `✓ built`.

**Step 4: Commit**
```
git add src/index.css src/pages/Trading.tsx
git commit -m "feat: scoped pro-terminal restyle for Trading tab"
```

---

### Task 4: Final regression + preview

**Step 1:** `cd "C:/Users/PC/Downloads/market-pulse" && npm test 2>&1 | tail -8`
Expected: `entryMath` (10) + prior suites (windowChange 5, riskPreview 6, watchlistStore 3, tradeMetrics 12) all green.

**Step 2:** `npm run build 2>&1 | tail -3` → `✓ built`.

**Step 3: Preview** (market-pulse server, `/trading`): pick a symbol in the Order Ticket → entry auto-prefills (or click `Use live`) → click a `−2%` stop chip → stop set → click `+2R` target chip → target set → qty auto-fills from risk (if `tp-risk-v1` set; else stays manual) → confirm → tracked into Trade Tracker. Screenshot the restyled page for the visual check. Clean any test data (`tp-open-trades-v1`/`tp-watchlist-v1` → `[]`).

**Step 4:** Commit any verification fix (specific files only).

---

## Done When
- `npm test` green incl. new `entryMath` (10 assertions); `npm run build` clean.
- Order Ticket: entry prefilled from live, `Use live` works, `−1/2/3/5%` stop chips + `+1/2/3R` target chips set prices, qty auto-derives from `tp-risk-v1` until hand-edited, confirm step still disarms on edits.
- Trading tab visibly denser/terminal-styled, scoped to `.trading-terminal` (no other page changes).
- Wave 2 (chart click-to-set, ATR chips, controlled-Tabs-on-disconnect) explicitly deferred.
