# Trade Tracker Streaming Entry + Viz — Wave 1 Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add streaming-feel live entry + 1-tap Quick-fill and decision visualizations (R/R bar, payoff gauge, mini live chart) to the Trade Tracker, reusing existing infra.

**Architecture:** Pure viz/default math in `src/lib/entryViz.ts` (vitest). The draft symbol is polled via the existing `useLiveQuotes` + shared `useLiveSpeed` toggle; the New-trade form gets an entry-follows-live lock, a Market button, a Quick-fill button, an R/R bar + payoff gauge (replacing the text preview), and a mini `useSparkline` chart with entry/stop/target reference lines.

**Tech Stack:** React 18, TS, Vitest, recharts, Tailwind/shadcn, @tanstack/react-query (all already deps).

**Design doc:** `docs/plans/2026-05-17-trade-tracker-streaming-entry-design.md`

**Context (verified against current `src/components/trading/TradeTracker.tsx`):**
- `const [draft, setDraft] = useState<OpenTrade>(emptyDraft())`; mutate via `set(k,v)` (line 132). `draft.side` is `'long'|'short'`, `draft.entryPrice:number`, `draft.stopLoss?:number`, `draft.target?:number`, `draft.quantity:number`. `emptyDraft()` line 50; `submit` line 208 resets via `setDraft(emptyDraft())` + `setQtyTouched(false)` + `setLive(null)`.
- `const { fast, setFast, intervalMs } = useLiveSpeed()` (line 95). `const openSymbols = useMemo(()=>open.map(t=>t.symbol),[open])`; `const quotes = useLiveQuotes(openSymbols, intervalMs)` (lines 96-97). `useLiveQuotes(symbols:string[], intervalMs)` → `Record<UPPER_SYM,{price:number|null;updatedAt:number}>`, dedups, pauses hidden tab.
- One-shot `live` state `{price,name}|null` set in `pickSymbol` (lines 103, 137-156). `useLive()` line 169 sets entry from `live.price`. Existing %/R chips `applyStopPct`/`applyTargetR` lines 161-168; auto-qty effect lines 171-178 (guarded by `qtyTouched`).
- `preview = useMemo(... )` lines 183-206 → `{ rr, dollarRisk, posValue, acctRiskPct, overRisk, hints, hasRp }` from `draft` + `readRiskParams()` (module fn line 67 → `{account,riskPct}|null`). The preview is rendered as a text block in the JSX (search the file for where `preview.rr`/`preview.dollarRisk` are shown — that block is what Task 4 replaces/augments).
- `money(n)` helper line 79. `unrealizedPnl(side,entry,price,qty)→{dollars,pct}` and `stopProximity` from `@/lib/tradeMetrics` (already imported line 17). `stopFromPct/targetFromR/qtyFromRisk` from `@/lib/entryMath` (imported line 18). `useSparkline(symbol,range?)` in `src/hooks/useSparkline.ts` → `useQuery<YahooBar[]>` (default '1mo'); `YahooBar={t,o,h,l,c,v}`. recharts usage precedent: `src/components/trading/SymbolChart.tsx` and `Watchlist.tsx`.
- Vitest `include` = `src/lib/**/*.test.ts`; `@`→`./src`. You are on `master` with MANY unrelated modified files — for EVERY commit `git add` ONLY the explicitly named files; never `-A`/`.`.

---

### Task 1: Pure viz + defaults helpers (TDD)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\lib\entryViz.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\entryViz.test.ts`

**Step 1: Write the failing test** — `src/lib/entryViz.test.ts` EXACTLY:
```ts
import { describe, it, expect } from 'vitest';
import { rrBar, payoff, resolveEntryDefaults } from './entryViz';

describe('rrBar', () => {
  it('positions stop/entry/target/live as 0..1 fractions of the span', () => {
    const b = rrBar('long', 100, 90, 120, 110)!;
    expect(b.lo).toBe(90);
    expect(b.hi).toBe(120);
    expect(b.stopPct).toBeCloseTo(0, 5);
    expect(b.entryPct).toBeCloseTo((100 - 90) / 30, 5);
    expect(b.targetPct).toBeCloseTo(1, 5);
    expect(b.livePct).toBeCloseTo((110 - 90) / 30, 5);
    expect(b.rMultiple).toBeCloseTo(2, 5);
  });
  it('live clamps into [0,1]', () => {
    const b = rrBar('long', 100, 90, 120, 200)!;
    expect(b.livePct).toBe(1);
  });
  it('null when entry<=0 / no stop / no target', () => {
    expect(rrBar('long', 0, 90, 120, undefined)).toBeNull();
    expect(rrBar('long', 100, undefined, 120, undefined)).toBeNull();
    expect(rrBar('long', 100, 90, undefined, undefined)).toBeNull();
  });
});

describe('payoff', () => {
  it('long: ifStopped negative, ifTarget positive', () => {
    const p = payoff('long', 100, 90, 120, 10, 10000);
    expect(p.ifStopped).toEqual({ dollars: -100, pct: -10 });
    expect(p.ifTarget).toEqual({ dollars: 200, pct: 20 });
    expect(p.posValue).toBe(1000);
    expect(p.acctPct).toBeCloseTo(10, 5);
  });
  it('short: signs flip', () => {
    const p = payoff('short', 100, 110, 80, 5);
    expect(p.ifStopped).toEqual({ dollars: -50, pct: -10 });
    expect(p.ifTarget).toEqual({ dollars: 100, pct: 20 });
    expect(p.acctPct).toBeNull();
  });
  it('missing stop/target → null legs, posValue still computed', () => {
    const p = payoff('long', 100, undefined, undefined, 10);
    expect(p.ifStopped).toBeNull();
    expect(p.ifTarget).toBeNull();
    expect(p.posValue).toBe(1000);
  });
});

describe('resolveEntryDefaults', () => {
  it('falls back to {stopPct:2,targetR:2} on bad/missing input', () => {
    expect(resolveEntryDefaults(null)).toEqual({ stopPct: 2, targetR: 2 });
    expect(resolveEntryDefaults('not json')).toEqual({ stopPct: 2, targetR: 2 });
    expect(resolveEntryDefaults('{"stopPct":-1}')).toEqual({ stopPct: 2, targetR: 2 });
  });
  it('uses valid positive overrides', () => {
    expect(resolveEntryDefaults('{"stopPct":3,"targetR":2.5}')).toEqual({ stopPct: 3, targetR: 2.5 });
  });
});
```

**Step 2: Run — verify FAILS**
`cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/entryViz.test.ts 2>&1 | tail -8`
Expected: FAIL (cannot resolve './entryViz').

**Step 3: Implement** — `src/lib/entryViz.ts` EXACTLY:
```ts
import { unrealizedPnl } from './tradeMetrics';

type Side = 'long' | 'short';
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface RrBar {
  lo: number; hi: number;
  stopPct: number; entryPct: number; targetPct: number;
  livePct: number | null; rMultiple: number | null;
}

/** Geometry for the risk/reward bar. null unless entry>0 && stop && target. */
export function rrBar(
  side: Side, entry: number, stop: number | undefined,
  target: number | undefined, live: number | null | undefined,
): RrBar | null {
  if (entry <= 0 || stop == null || target == null) return null;
  const xs = [stop, entry, target];
  if (live != null) xs.push(live);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo;
  const pos = (x: number) => (span <= 0 ? 0 : clamp01((x - lo) / span));
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  return {
    lo, hi,
    stopPct: pos(stop), entryPct: pos(entry), targetPct: pos(target),
    livePct: live != null ? pos(live) : null,
    rMultiple: risk > 0 ? reward / risk : null,
  };
}

export interface Payoff {
  ifStopped: { dollars: number; pct: number } | null;
  ifTarget: { dollars: number; pct: number } | null;
  posValue: number;
  acctPct: number | null;
}

/** Live payoff figures. Reuses unrealizedPnl for sign correctness. */
export function payoff(
  side: Side, entry: number, stop: number | undefined,
  target: number | undefined, qty: number, account?: number,
): Payoff {
  const ok = entry > 0 && qty > 0;
  const ifStopped = ok && stop != null ? unrealizedPnl(side, entry, stop, qty) : null;
  const ifTarget = ok && target != null ? unrealizedPnl(side, entry, target, qty) : null;
  const posValue = ok ? entry * qty : 0;
  const acctPct =
    ifStopped != null && account != null && account > 0
      ? (Math.abs(ifStopped.dollars) / account) * 100
      : null;
  return { ifStopped, ifTarget, posValue, acctPct };
}

export interface EntryDefaults { stopPct: number; targetR: number; }

/** Parse tp-entry-defaults-v1 JSON; fall back to {stopPct:2,targetR:2}. */
export function resolveEntryDefaults(raw: string | null): EntryDefaults {
  const d: EntryDefaults = { stopPct: 2, targetR: 2 };
  if (!raw) return d;
  try {
    const p = JSON.parse(raw);
    if (typeof p?.stopPct === 'number' && p.stopPct > 0) d.stopPct = p.stopPct;
    if (typeof p?.targetR === 'number' && p.targetR > 0) d.targetR = p.targetR;
  } catch { /* keep defaults */ }
  return d;
}
```
NOTE the test's `acctPct` expectation: for `payoff('long',100,90,120,10,10000)`, `|ifStopped.dollars|=100`, `100/10000*100 = 1`... the test expects `10`. **Reconcile before implementing:** the test asserts `acctPct ≈ 10`. That equals `posValue/account*100 = 1000/10000*100 = 10`, NOT risk-based. So `acctPct` must be **position value as % of account**, not risk. Change the impl line to:
```ts
  const acctPct = ok && account != null && account > 0 ? (posValue / account) * 100 : null;
```
(Implement THIS version; it matches the test: long case → 10, short case has no account → null.)

**Step 4: Run — verify PASSES**
`cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/entryViz.test.ts 2>&1 | tail -8`
Expected: all green.

**Step 5: Commit**
```
git add src/lib/entryViz.ts src/lib/entryViz.test.ts
git commit -m "feat: pure entry-viz helpers (rrBar/payoff/resolveEntryDefaults)"
```

---

### Task 2: Stream the draft symbol + entry-follows-live + Market lock

**Files:** Modify `C:\Users\PC\Downloads\market-pulse\src\components\trading\TradeTracker.tsx`

**Step 1:** Poll the draft symbol. Change `openSymbols` memo (line ~96) so the draft symbol is included:
```ts
const openSymbols = useMemo(
  () => Array.from(new Set([...open.map((t) => t.symbol), draft.symbol].filter(Boolean))),
  [open, draft.symbol],
);
```
Add a derived live price for the draft (after `set` is defined, ~line 134):
```ts
const draftLive = quotes[draft.symbol.trim().toUpperCase()]?.price ?? live?.price ?? null;
```
(Falls back to the one-shot `live` until the first poll lands.)

**Step 2:** Add `const [entryLocked, setEntryLocked] = useState(false);` near the other state. Entry-follows-live effect:
```ts
useEffect(() => {
  if (entryLocked) return;
  if (draftLive != null && draftLive !== draft.entryPrice) set('entryPrice', draftLive);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [draftLive, entryLocked]);
```
- The Entry `<Input> onChange` must also `setEntryLocked(true)` (user typing pins it).
- `submit` and any reset path: add `setEntryLocked(false)`.
- Replace `useLive` (line 169) with a **Market** action: `const useMarket = () => { if (draftLive != null) { set('entryPrice', draftLive); setEntryLocked(true); } };` (rename usages).

**Step 3:** Indicator: next to the Entry field show `entryLocked ? '🔒 locked' : '● live'` (only when `draftLive != null`); the existing "Use live" button becomes the **Market** button (label `Market`, `onClick={useMarket}`, `disabled={draftLive == null}`), keep styling.

**Step 4:** Build — `cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -8 && npm run build 2>&1 | tail -3` → clean, `✓ built`.

**Step 5:** Commit
```
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: stream draft symbol + entry-follows-live with Market lock"
```

---

### Task 3: 1-tap Quick-fill

**Files:** Modify `TradeTracker.tsx`

**Step 1:** Import: `import { resolveEntryDefaults } from '@/lib/entryViz';` (entryMath helpers already imported). Add:
```ts
const quickFill = () => {
  const px = draftLive;
  if (px == null) return;
  const { stopPct, targetR } = resolveEntryDefaults(
    typeof localStorage !== 'undefined' ? localStorage.getItem('tp-entry-defaults-v1') : null,
  );
  const s = stopFromPct(draft.side, px, stopPct);
  setDraft((d) => ({
    ...d,
    entryPrice: px,
    stopLoss: s ?? d.stopLoss,
    target: s != null ? (targetFromR(draft.side, px, s, targetR) ?? d.target) : d.target,
  }));
  setEntryLocked(true);
  // qty auto-fills via the existing qtyFromRisk effect (qtyTouched stays false)
};
```

**Step 2:** Add a **Quick-fill** button in the form action area (near the Track button / Long-Short row), `disabled={draftLive == null}`, styled like the existing chip/secondary buttons (reuse classes). Label `⚡ Quick-fill`.

**Step 3:** Build (tsc + `npm run build`) → clean / `✓ built`.

**Step 4:** Commit
```
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: 1-tap Quick-fill (live entry + default stop/target + auto-qty)"
```

---

### Task 4: R/R bar + payoff gauge (replace the text preview block)

**Files:** Modify `TradeTracker.tsx`

**Step 1:** Import `{ rrBar, payoff } from '@/lib/entryViz'`. Compute (near `preview`):
```ts
const bar = rrBar(draft.side, draft.entryPrice, draft.stopLoss, draft.target, draftLive);
const pay = payoff(draft.side, draft.entryPrice, draft.stopLoss, draft.target,
                   draft.quantity, rpTT?.account);
```

**Step 2:** In the JSX where the existing `preview` text block renders, ADD above it (keep the existing R:R / $risk / hints text — augment, don't delete the sanity `hints`):
- **R/R bar** (only when `bar`): a relative `h-2 rounded` track; a sell-tinted segment from `stopPct→entryPct` and buy-tinted from `entryPct→targetPct` (use `left`/`width` % from the fractions); absolutely-positioned ticks for entry (neutral), and a live marker at `bar.livePct` (when not null). Label `R {bar.rMultiple?.toFixed(2)} : 1`. Use `--trading-buy/-sell` tokens, `font-mono-num`.
- **Payoff gauge** (only when `pay.ifStopped || pay.ifTarget`): three small stat cells —
  `If stop: {money(pay.ifStopped.dollars)} ({pay.ifStopped.pct.toFixed(1)}%)` (sell color),
  `If target: +{money(pay.ifTarget.dollars)} ({pay.ifTarget.pct.toFixed(1)}%)` (buy color),
  `Now: {money(unrealizedPnl(draft.side, draft.entryPrice, draftLive, draft.quantity).dollars)}` when `draftLive!=null && draft.entryPrice>0 && draft.quantity>0` else `—`.
  Plus `Pos {money(pay.posValue)}{pay.acctPct!=null?` · ${pay.acctPct.toFixed(1)}% acct`:''}`.
Keep it compact, reuse the existing preview panel container styling.

**Step 3:** Build (tsc + `npm run build`) → clean / `✓ built`.

**Step 4:** Commit
```
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: R/R bar + live payoff gauge in Trade Tracker entry"
```

---

### Task 5: Mini live chart with entry/stop/target reference lines

**Files:** Modify `TradeTracker.tsx`

**Step 1:** Import `useSparkline` from `@/hooks/useSparkline` and recharts `{ ResponsiveContainer, AreaChart, Area, ReferenceLine, YAxis }` (match `SymbolChart.tsx` import style). `const { data: chartBars } = useSparkline(draft.symbol);` (hook is enabled only when symbol non-empty — safe).

**Step 2:** When `draft.symbol && (chartBars?.length ?? 0) > 0`, render a compact chart (height ~120, `ResponsiveContainer`): `AreaChart` of `c` over index, no axes except a hidden domain-fit `YAxis` (`domain={['auto','auto']}`, `hide`), `ReferenceLine`s at `y=draft.entryPrice` (neutral), `y=draft.stopLoss` (sell, when set), `y=draft.target` (buy, when set), and a `ReferenceLine y={draftLive}` (primary, dashed) when not null. Color the area by `draftLive>=draft.entryPrice` buy/sell or neutral. Empty/no symbol → render nothing (the bar+gauge already cover feedback). Never throw (`chartBars ?? []`).

**Step 3:** Build (tsc + `npm run build`) → clean / `✓ built`. If the chart materially bloats the component or fights layout, STOP and report — it is the YAGNI-trim candidate (defer to Wave 2) rather than forcing it.

**Step 4:** Commit
```
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: mini live chart with entry/stop/target reference lines"
```

---

### Task 6: Final regression + preview

**Step 1:** `cd "C:/Users/PC/Downloads/market-pulse" && npm test 2>&1 | tail -8`
Expected: `entryViz` (+~9) plus prior suites (entryMath 10, tradeMetrics 12, riskPreview 6, windowChange 5, watchlistStore 3) all green.

**Step 2:** `npm run build 2>&1 | tail -3` → `✓ built`.

**Step 3: Preview** (market-pulse server, `/trading`): pick a symbol → entry shows `● live` and follows the polled price → click **Market** → indicator flips `🔒 locked`, entry pinned → click **⚡ Quick-fill** on a fresh symbol → entry/stop/target/qty all fill → R/R bar shows proportional stop/entry/target with a live marker, payoff gauge shows If-stop / If-target / Now, mini chart shows level lines → Track → appears in open positions. Screenshot. Clean `tp-open-trades-v1`/`tp-watchlist-v1`/`tp-entry-defaults-v1`.

**Step 4:** Commit any verification fix (named files only).

---

## Done When
- `npm test` green incl. new `entryViz`; `npm run build` clean.
- Draft symbol streams (shared 5s/30s toggle); entry follows live until typed or **Market**-locked; **⚡ Quick-fill** produces a complete trackable trade in one click.
- R/R bar + payoff gauge + mini live chart render and update live; all degrade gracefully with no symbol/quote and never block manual entry.
- Wave 2 (editable defaults UI, price ladder, true push feed, chart click-to-set) explicitly deferred.
