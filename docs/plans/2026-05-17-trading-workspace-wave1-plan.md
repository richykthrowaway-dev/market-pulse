# Trading Workspace — Wave 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Trading tab valuable offline — an always-on broker-independent core (Watchlist, Chart, risk-aware Order Ticket) with IBKR layering in additively when connected.

**Architecture:** Reuse the live-monitoring infra (`useLiveQuotes`, `useSymbolSearch`, `fetchYahooChart`, `useOpenTrades`, the 5s/30s speed-toggle pattern) plus recharts (already a dep). New persisted `useWatchlist` store mirrors `useOpenTrades`. Pure logic (`windowChange`, `riskPreview`) lives in `src/lib` with vitest tests. `Trading.tsx` is restructured so the workspace always renders and each IBKR piece self-gates.

**Tech Stack:** React 18, TypeScript, @tanstack/react-query v5, recharts, Vitest, Vite, Tailwind/shadcn.

**Design doc:** `docs/plans/2026-05-17-trading-workspace-design.md`

**Context the engineer needs:**
- `src/pages/Trading.tsx` is the page. Today it hides EVERYTHING behind `isGatewayOffline` except `<TradeTracker />`. Components in that file: `ConnectionStatus`, `GatewayGuide`, `AccountStats`, `PositionsTable`, `OrdersTable`, `TradesTable`, `LivePrices`, `QuickOrder`, default `Trading`. `accountId` + `isConnected = authStatus?.authenticated === true` + `isGatewayOffline = !authLoading && authStatus === null` are computed in `Trading()`.
- `src/hooks/useLiveQuotes.ts`: `useLiveQuotes(symbols: string[], intervalMs: number) → Record<UPPER_SYM, { price: number|null; updatedAt: number }>`. Write-free, dedups, pauses on hidden tab. Reuse as-is.
- `src/hooks/useSymbolSearch.ts`: `useSymbolSearch(query) → { data: SymbolSearchResult[] }` (enabled when query.length>=2). `SymbolSearchResult` has `symbolId, canonicalTicker, name, primaryExchangeCode`. Pattern for an autocomplete dropdown already exists in `src/components/trading/TradeTracker.tsx` (symbol field: relative div + abs dropdown, `onMouseDown` select, outside-click `useEffect`).
- `src/services/yahooFinanceApi.ts`: `fetchYahooChart(yahooTicker, interval: '1h'|'1d', range: '7d'|'1mo'|'3mo'|'6mo'|'1y'|'2y'|'5y'|'10y'|'max') → Promise<YahooBar[]>` where `YahooBar = { t:number; o:number; h:number; l:number; c:number; v:number }` (cached, returns `[]` on failure, never throws). `fetchYahooQuote(symbol) → Promise<YahooQuote|null>` (cached 15min; has `regularMarketPrice`, `shortName`).
- `src/hooks/useOpenTrades.ts`: `useOpenTrades() → { trades, addOpen, removeOpen, patchOpen }`. `OpenTrade = { id, symbol, side:'long'|'short', quantity, entryPrice, stopLoss?, target?, entryDate, setup?, notes?, planValid }`. This is the shared store the Trade Tracker reads; "Track in Trade Tracker" = `addOpen({...})`.
- Risk params: `localStorage['tp-risk-v1']` → JSON `{ account:number, riskPct:number }` (set in My Trading Plan; may be absent). `TradeTracker.tsx` has a `readRiskParams()` example.
- `useSyncExternalStore` store pattern: copy the exact shape of `src/hooks/useOpenTrades.ts` (module snapshot + listener Set + `readLS`/`writeLS` + `useSyncExternalStore`).
- Vitest is set up; `vitest.config.ts` `include` is scoped to `src/lib/**/*.test.ts`. `npm test` runs only `src/lib` tests. Run hook/other tests directly with `npx vitest run <path>` if needed, but per-plan unit tests live in `src/lib`.
- recharts import style: see `src/components/journal/ByExitReasonChart.tsx` for `ResponsiveContainer`/chart usage.
- You are on `master` with MANY unrelated modified files. For EVERY commit, `git add` ONLY the explicitly named files. Never `git add -A`/`.`.

**Shared symbol selection:** `Trading()` owns `const [selSymbol, setSelSymbol] = useState<string>('')`. Passed to Watchlist (row click → `setSelSymbol`), Chart panel (reads `selSymbol`), Order Ticket (reads `selSymbol` to prefill; "→ Ticket" on a watchlist row also calls `setSelSymbol`).

---

### Task 1: `windowChange` pure helper (TDD)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\lib\windowChange.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\windowChange.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { windowChange } from './windowChange';

describe('windowChange', () => {
  it('computes abs + pct from first to last close', () => {
    expect(windowChange([{ c: 100 }, { c: 110 }] as any)).toEqual({ abs: 10, pct: 10 });
  });
  it('negative move', () => {
    expect(windowChange([{ c: 200 }, { c: 150 }] as any)).toEqual({ abs: -50, pct: -25 });
  });
  it('empty → null', () => {
    expect(windowChange([])).toBeNull();
  });
  it('single bar → zero change', () => {
    expect(windowChange([{ c: 50 }] as any)).toEqual({ abs: 0, pct: 0 });
  });
  it('first close 0 → pct 0 (no divide-by-zero)', () => {
    expect(windowChange([{ c: 0 }, { c: 5 }] as any)).toEqual({ abs: 5, pct: 0 });
  });
});
```

**Step 2: Run — verify it FAILS**
`cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/windowChange.test.ts 2>&1 | tail -8`
Expected: FAIL (cannot resolve './windowChange').

**Step 3: Implement**
```ts
import type { YahooBar } from '@/services/yahooFinanceApi';

/** Change from the first to the last bar's close. null if no bars. */
export function windowChange(
  bars: Pick<YahooBar, 'c'>[],
): { abs: number; pct: number } | null {
  if (bars.length === 0) return null;
  const first = bars[0].c;
  const last = bars[bars.length - 1].c;
  const abs = last - first;
  const pct = first > 0 ? (abs / first) * 100 : 0;
  return { abs, pct };
}
```

**Step 4: Run — verify it PASSES** (`npx vitest run src/lib/windowChange.test.ts` → 5 passed)

**Step 5: Commit**
```
git add src/lib/windowChange.ts src/lib/windowChange.test.ts
git commit -m "feat: windowChange pure helper"
```

---

### Task 2: `riskPreview` pure helper (TDD)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\lib\riskPreview.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\riskPreview.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { riskPreview } from './riskPreview';

describe('riskPreview', () => {
  it('long: rr, dollarRisk, posValue', () => {
    expect(riskPreview({ side: 'long', entry: 100, stop: 90, target: 130, qty: 10 }))
      .toEqual({ rr: 3, dollarRisk: 100, posValue: 1000, acctRiskPct: null, overRisk: false });
  });
  it('short: risk above entry', () => {
    const r = riskPreview({ side: 'short', entry: 100, stop: 110, target: 80, qty: 5 });
    expect(r.rr).toBe(2);
    expect(r.dollarRisk).toBe(50);
    expect(r.posValue).toBe(500);
  });
  it('account-relative risk + over-risk flag', () => {
    const r = riskPreview({ side: 'long', entry: 100, stop: 90, target: 120, qty: 10, account: 10000, riskPct: 0.5 });
    expect(r.acctRiskPct).toBeCloseTo(1, 5);
    expect(r.overRisk).toBe(true);
  });
  it('missing stop/target → nulls, no throw', () => {
    expect(riskPreview({ side: 'long', entry: 100, qty: 10 }))
      .toEqual({ rr: null, dollarRisk: null, posValue: 1000, acctRiskPct: null, overRisk: false });
  });
  it('zero qty → posValue 0', () => {
    expect(riskPreview({ side: 'long', entry: 100, stop: 90, qty: 0 }).posValue).toBe(0);
  });
});
```

**Step 2: Run — verify it FAILS**

**Step 3: Implement**
```ts
export interface RiskPreviewInput {
  side: 'long' | 'short';
  entry: number;
  stop?: number;
  target?: number;
  qty: number;
  account?: number;
  riskPct?: number;
}
export interface RiskPreviewResult {
  rr: number | null;
  dollarRisk: number | null;
  posValue: number;
  acctRiskPct: number | null;
  overRisk: boolean;
}

/** Position risk/reward preview. Pure; all optional fields degrade to null. */
export function riskPreview(i: RiskPreviewInput): RiskPreviewResult {
  const riskPS = i.stop != null && i.entry > 0 ? Math.abs(i.entry - i.stop) : null;
  const rewardPS = i.target != null && i.entry > 0 ? Math.abs(i.target - i.entry) : null;
  const rr = riskPS != null && rewardPS != null && riskPS > 0 ? rewardPS / riskPS : null;
  const dollarRisk = riskPS != null && i.qty > 0 ? riskPS * i.qty : null;
  const posValue = i.entry > 0 && i.qty > 0 ? i.entry * i.qty : 0;
  const acctRiskPct =
    dollarRisk != null && i.account != null && i.account > 0
      ? (dollarRisk / i.account) * 100
      : null;
  const overRisk =
    acctRiskPct != null && i.riskPct != null ? acctRiskPct > i.riskPct : false;
  return { rr, dollarRisk, posValue, acctRiskPct, overRisk };
}
```

**Step 4: Run — verify PASSES** (5 passed)

**Step 5: Commit**
```
git add src/lib/riskPreview.ts src/lib/riskPreview.test.ts
git commit -m "feat: riskPreview pure helper"
```

---

### Task 3: `useWatchlist` persisted store (TDD where pure)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\hooks\useWatchlist.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\watchlistStore.test.ts`

To keep store logic unit-testable under the `src/lib`-scoped vitest config, put the pure list reducer in `src/lib` and have the hook consume it.

**Step 1: Write the failing test** `src/lib/watchlistStore.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { addSym, removeSym } from '@/hooks/useWatchlist';

describe('watchlist reducers', () => {
  it('adds normalized (trim+upper), dedups case-insensitively', () => {
    expect(addSym(['AAPL'], ' aapl ')).toEqual(['AAPL']);
    expect(addSym(['AAPL'], 'msft')).toEqual(['AAPL', 'MSFT']);
  });
  it('ignores empty', () => {
    expect(addSym(['AAPL'], '   ')).toEqual(['AAPL']);
  });
  it('removes by normalized symbol', () => {
    expect(removeSym(['AAPL', 'MSFT'], 'aapl')).toEqual(['MSFT']);
  });
});
```
(Per the `src/lib`-scoped vitest `include`, this test must live in `src/lib/` even though it imports from `@/hooks/useWatchlist` — the `@` alias resolves there. Confirm it runs via `npx vitest run src/lib/watchlistStore.test.ts`.)

**Step 2: Run — verify FAILS**

**Step 3: Implement** `src/hooks/useWatchlist.ts` (mirror `useOpenTrades.ts` exactly for the store mechanics):
```ts
import { useCallback, useSyncExternalStore } from 'react';

const LS_KEY = 'tp-watchlist-v1';

export function addSym(list: string[], raw: string): string[] {
  const s = raw.trim().toUpperCase();
  if (!s) return list;
  return list.some((x) => x.toUpperCase() === s) ? list : [...list, s];
}
export function removeSym(list: string[], raw: string): string[] {
  const s = raw.trim().toUpperCase();
  return list.filter((x) => x.toUpperCase() !== s);
}

function readLS(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const p = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function writeLS(next: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota */ }
}

let snapshot: string[] = readLS();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return snapshot; }
function update(fn: (p: string[]) => string[]) { snapshot = fn(snapshot); writeLS(snapshot); emit(); }

export function useWatchlist() {
  const symbols = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const add = useCallback((raw: string) => update((p) => addSym(p, raw)), []);
  const remove = useCallback((raw: string) => update((p) => removeSym(p, raw)), []);
  return { symbols, add, remove } as const;
}
```

**Step 4: Run — verify PASSES** (3 passed)

**Step 5: Commit**
```
git add src/hooks/useWatchlist.ts src/lib/watchlistStore.test.ts
git commit -m "feat: useWatchlist persisted store"
```

---

### Task 4: `useSparkline` chart-data hook

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\hooks\useSparkline.ts`

No unit test (thin React Query wrapper over an already-tested service; verified via build + the component that consumes it).

**Step 1: Implement**
```ts
import { useQuery } from '@tanstack/react-query';
import { fetchYahooChart, type YahooBar } from '@/services/yahooFinanceApi';

/**
 * Daily bars for a sparkline + window-change. `enabled` lets callers gate
 * (e.g. skip until the symbol is on screen). 10-min React Query cache.
 */
export function useSparkline(symbol: string, range: '5d' | '1mo' | '3mo' | '1y' = '1mo') {
  return useQuery<YahooBar[]>({
    queryKey: ['sparkline', symbol.trim().toUpperCase(), range],
    queryFn: () => fetchYahooChart(symbol.trim().toUpperCase(), '1d', range),
    enabled: symbol.trim().length > 0,
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
  });
}
```

**Step 2: Type-check + build**
`cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: no errors for the new file; `✓ built`.

**Step 3: Commit**
```
git add src/hooks/useSparkline.ts
git commit -m "feat: useSparkline chart-data hook"
```

---

### Task 5: `Watchlist` component

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\components\trading\Watchlist.tsx`

**Props:** `{ selSymbol: string; onSelect: (s: string) => void; onSendToTicket: (s: string) => void; showGatewayNote: boolean }`.

**Behavior (mirror `TradeTracker.tsx` patterns):**
- Symbol add row: `useSymbolSearch` autocomplete (relative wrapper + absolute dropdown, `onMouseDown` to select, outside-click `useEffect`); selecting calls `useWatchlist().add(canonicalTicker)`; clear query.
- Header has the same 5s/30s speed toggle as TradeTracker (lazy `localStorage['tt-live-speed-v1']` read; reuse the SAME key so the rate is shared with the Tracker; `intervalMs = fast ? 5_000 : 30_000`). Include `aria-pressed` + `aria-label` + `<span aria-hidden>⚡</span>` like the Tracker.
- `const quotes = useLiveQuotes(symbols, intervalMs)` for live last price.
- Each row: clickable (`onClick={() => onSelect(sym)}`, highlight when `sym === selSymbol`): symbol, live last (`quotes[sym]?.price`), a `useSparkline(sym,'1mo')`-driven mini recharts `<AreaChart>` (~64×24, no axes/tooltip; color by `windowChange(bars)` sign), the window change `+$x (+y%)` from `windowChange`, a "→ Ticket" button (`onSendToTicket(sym)`, stopPropagation), and a remove ✕ (`useWatchlist().remove(sym)`, stopPropagation).
- Empty state: centered prompt "Add symbols to build your watchlist." If `showGatewayNote`, render a dismissible (local `useState`) inline note: "Connect an IBKR gateway for live order execution." (text only — no secrets/links).
- Failed sparkline/quote → render "—" / skip the sparkline; never throw.

**Step 1:** Implement the component (use `Card`/`CardHeader`/`CardContent` with `className="trading-card"`; recharts imports per `ByExitReasonChart.tsx`; `money`-style formatting — define a local `fmt` or reuse the page's; keep number cells `font-mono-num`).

**Step 2: Build**
`cd "C:/Users/PC/Downloads/market-pulse" && npm run build 2>&1 | tail -3` → `✓ built`.

**Step 3: Commit**
```
git add src/components/trading/Watchlist.tsx
git commit -m "feat: broker-independent Watchlist with live quotes + sparkline"
```

---

### Task 6: `SymbolChart` panel component

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\components\trading\SymbolChart.tsx`

**Props:** `{ symbol: string }`.

**Behavior:**
- If `!symbol`: card with centered "Select a symbol to chart."
- Else: a range toggle (`1D`→`fetchYahooChart(sym,'1h','7d')`; `1M`→`('1d','1mo')`; `3M`→`('1d','3mo')`; `1Y`→`('1d','1y')`) via a small `useQuery` (queryKey `['symchart', sym, range]`, staleTime 10min) calling `fetchYahooChart`. Render a recharts `ResponsiveContainer` + `AreaChart` of `c` over `t` (format `t*1000` as date; minimal axes; buy/sell gradient by overall `windowChange` sign). Loading → `Skeleton`. Empty bars → "Chart unavailable for {symbol}."
- Card header shows the symbol + the range buttons.

**Step 1:** Implement. **Step 2:** `npm run build` → `✓ built`. **Step 3:**
```
git add src/components/trading/SymbolChart.tsx
git commit -m "feat: SymbolChart panel"
```

---

### Task 7: Upgrade `QuickOrder` → risk-aware Order Ticket

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\pages\Trading.tsx` (the `QuickOrder` component only, plus its new props)

**New props:** `{ accountId: string; isConnected: boolean; selSymbol: string }`.

**Changes inside `QuickOrder`:**
1. Replace the plain symbol `<Input>` with the `useSymbolSearch` autocomplete dropdown (same pattern as `TradeTracker.tsx`). When `selSymbol` changes (prop) and differs from local `symbol`, sync it in (a `useEffect`).
2. Add optional `stop` and `target` numeric inputs and a `qty` (already present).
3. Live price: on symbol commit, `fetchYahooQuote(sym)` (existing) → show "Live $X · Name"; if entry empty, prefill an `entry` state with it.
4. Risk preview block: read `tp-risk-v1` (copy `readRiskParams()` from `TradeTracker.tsx`), call `riskPreview({ side: side==='BUY'?'long':'short', entry, stop, target, qty, account, riskPct })`; render R:R, $ risk (+ % of account), position value, and an amber over-risk warning — same visual language as the TradeTracker preview panel.
5. Confirm step: first click sets `const [confirming,setConfirming]=useState(false)`; button label becomes "Confirm {side} {qty} {sym}" on the second click it executes. (Reset confirming on any field change.)
6. Action split:
   - `isConnected` → existing IBKR `placeOrder` path (unchanged logic; keep `selectedConid`/contract result block; if multiple contracts, still use `contracts[0]` for Wave 1 — disambiguation is Wave 2, leave a `// TODO Wave 2` comment).
   - `!isConnected` → primary button becomes **"Track in Trade Tracker"**: `useOpenTrades().addOpen({ id: Math.random().toString(36).slice(2,9), symbol: sym, side: side==='BUY'?'long':'short', quantity: Number(qty), entryPrice: Number(entry)||0, stopLoss: stop?Number(stop):undefined, target: target?Number(target):undefined, entryDate: <todayISO>, planValid: true })` then toast "Tracked — see Trade Tracker" and reset.

Keep the existing order-type/qty-stepper UI. Do not break the connected path.

**Step 1:** Implement. **Step 2:** `npm run build` → `✓ built`. **Step 3:**
```
git add src/pages/Trading.tsx
git commit -m "feat: risk-aware Order Ticket (symbol search, live price, risk preview, offline→tracker)"
```

---

### Task 8: Restructure `Trading.tsx` to always-on workspace

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\pages\Trading.tsx` (the default `Trading` component + remove `GatewayGuide` as a full-page block; `LivePrices` stays for now)

**Changes in `Trading()`:**
1. Add `const [selSymbol, setSelSymbol] = useState('')`.
2. Remove the page-level "hide everything when offline" gating. New body order:
   - Header + `ConnectionStatus` (unchanged).
   - `<TradeTracker />` (unchanged).
   - `{isConnected && <AccountStats accountId={accountId} />}`.
   - Always render the 3-col workspace:
     - Left (`lg:col-span-2`): a `Tabs`. `TabsList` always has `Watchlist`; conditionally append `Positions`/`Orders`/`Trades` triggers only when `isConnected`. `defaultValue="watchlist"`. `Watchlist` tab content: `<Watchlist selSymbol={selSymbol} onSelect={setSelSymbol} onSendToTicket={setSelSymbol} showGatewayNote={isGatewayOffline} />`. The other tab contents only mount when `isConnected` (so `PositionsTable` etc. unchanged).
     - Right: `<SymbolChart symbol={selSymbol} />` then `<QuickOrder accountId={accountId} isConnected={isConnected} selSymbol={selSymbol} />` then `{isConnected && accountId && <LivePrices accountId={accountId} />}`.
3. Delete the standalone `{isGatewayOffline && <GatewayGuide />}` line. Keep the `GatewayGuide` function defined but unused is NOT allowed (lint) — either delete the `GatewayGuide` function entirely (its guidance is now the dismissible note in Watchlist) OR keep it and render it inside the Watchlist empty/offline area. Simplest: delete the `GatewayGuide` function and the `Server` import if now unused. Verify no other refs.

**Step 1:** Implement. **Step 2:** `cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -8 && npm run build 2>&1 | tail -3` — no TS errors, `✓ built`. **Step 3:**
```
git add src/pages/Trading.tsx
git commit -m "feat: always-on Trading workspace (broker-independent core + IBKR self-gating)"
```

---

### Task 9: Final regression + preview verification

**Step 1: Unit suite** — `cd "C:/Users/PC/Downloads/market-pulse" && npm test 2>&1 | tail -8`
Expected: `windowChange` (5), `riskPreview` (5), `watchlistStore` (3), plus prior `tradeMetrics` (12) — all green.

**Step 2: Clean build** — `npm run build 2>&1 | tail -3` → `✓ built`.

**Step 3: Preview (offline path is the key one)** via `mcp__Claude_Preview__*` against the `market-pulse` server, `/trading`:
1. Watchlist: type a real ticker (e.g. `AAPL`) → dropdown → select → row appears with a live last price (≤ one interval) + sparkline + window change.
2. Click the row → `SymbolChart` renders for AAPL; toggle 1D/1M/3M/1Y → chart updates.
3. "→ Ticket" → Order Ticket symbol prefills; enter qty + stop + target → risk preview shows R:R / $ risk / pos value; click once → "Confirm…"; click again (offline) → toast "Tracked", and the position appears in the Trade Tracker's Open positions (shared store).
4. Speed toggle in Watchlist header flips 5s/30s and persists across reload (shared `tt-live-speed-v1`).
5. Remove the watchlist row; discard the test trade in the Trade Tracker.
6. **Cleanup:** `localStorage.setItem('tp-watchlist-v1','[]'); localStorage.setItem('tp-open-trades-v1','[]'); localStorage.removeItem('tt-live-speed-v1')` then reload → empty states.

**Step 4:** If anything needed a fix, commit it:
```
git add <specific files>
git commit -m "fix: trading workspace wave1 verification fixes"
```

---

## Done When
- `npm test` green (windowChange 5, riskPreview 5, watchlistStore 3, tradeMetrics 12); `npm run build` clean.
- Offline `/trading` shows a usable workspace: Watchlist (live quotes + sparkline), Chart, risk-aware Order Ticket that tracks into the shared Trade Tracker.
- Connected `/trading` additionally shows AccountStats + Positions/Orders/Trades tabs + LivePrices, with no regression to IBKR order placement.
- No market data persisted into `tp-watchlist-v1` (symbols only) or `tp-open-trades-v1` beyond the existing OpenTrade shape.
