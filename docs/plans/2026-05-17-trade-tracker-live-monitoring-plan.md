# Trade Tracker Live Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make tracked open positions live — auto-poll quotes and show unrealized P&L and distance-to-stop/target per position, with a 30s/5s refresh toggle.

**Architecture:** A write-free React Query hook (`useLiveQuotes`) polls a non-cached `api-yahoo` quote fetcher per unique open symbol; pure math helpers compute P&L and stop/target proximity; `TradeTracker.tsx` renders a live row per card and a header speed toggle persisted in localStorage.

**Tech Stack:** React 18, TypeScript, @tanstack/react-query (already a dep), Vitest (added here; repo already has vitest-style `.test.ts` files), Vite, Tailwind/shadcn.

**Design doc:** `docs/plans/2026-05-17-trade-tracker-live-monitoring-design.md`

**Context the engineer needs:**
- `src/services/yahooFinanceApi.ts` already has `fetchYahooQuote(symbol)` calling `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?endpoint=quote&symbol=`, headers `{ apikey: API_KEY, Authorization: Bearer API_KEY }`, where `PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID` and `API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`. It returns `YahooQuote` with `regularMarketPrice: number | null`. It wraps the call in `fetchCached` (15-min localStorage TTL) — too stale for polling, so we add a non-cached sibling.
- `src/hooks/useOpenTrades.ts` exports `useOpenTrades()` → `{ trades, addOpen, removeOpen, patchOpen }`; `OpenTrade = { id, symbol, side: 'long'|'short', quantity, entryPrice, stopLoss?, target?, entryDate, setup?, notes?, planValid }`.
- `src/components/trading/TradeTracker.tsx` renders open positions in `open.map((t) => …)`. The "Numbers" grid (Qty/Entry/Stop/Target) and the "Plan-valid toggle + actions" row are where the live row goes. The header has a `flex items-center justify-between` row with `Open positions` and `{open.length} tracked`.
- `usePersistentState` lives in `src/pages/TradingPlan.tsx` and is NOT exported. Do NOT import it across pages. Use a small local `localStorage` read/write for the speed toggle instead (key `tt-live-speed-v1`).
- React Query `QueryClientProvider` is already mounted app-wide (see `src/hooks/useSymbolSearch.ts` using `useQuery`).
- `money(n)` helper already exists in `TradeTracker.tsx`.

---

### Task 1: Add Vitest tooling

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\package.json`
- Create: `C:\Users\PC\Downloads\market-pulse\vitest.config.ts`

**Step 1: Add the test script and dev deps**

Run:
```bash
cd "C:/Users/PC/Downloads/market-pulse" && npm i -D vitest@^2 --no-audit --no-fund
```
Expected: vitest installed, `package.json` devDependencies updated.

**Step 2: Add a `test` script**

Edit `package.json` `scripts`, add:
```json
"test": "vitest run"
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

**Step 4: Verify the runner works**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib 2>&1 | tail -5`
Expected: "No test files found" (no `src/lib/*.test.ts` yet) and exit without crashing.

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

### Task 2: Pure P&L + proximity helpers (TDD)

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\lib\tradeMetrics.ts`
- Test: `C:\Users\PC\Downloads\market-pulse\src\lib\tradeMetrics.test.ts`

**Step 1: Write the failing test**

`src/lib/tradeMetrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { unrealizedPnl, stopProximity } from './tradeMetrics';

describe('unrealizedPnl', () => {
  it('long gain', () => {
    expect(unrealizedPnl('long', 100, 110, 10)).toEqual({ dollars: 100, pct: 10 });
  });
  it('long loss', () => {
    expect(unrealizedPnl('long', 100, 90, 10)).toEqual({ dollars: -100, pct: -10 });
  });
  it('short gain (price falls)', () => {
    expect(unrealizedPnl('short', 100, 90, 10)).toEqual({ dollars: 100, pct: 10 });
  });
  it('short loss (price rises)', () => {
    expect(unrealizedPnl('short', 100, 110, 10)).toEqual({ dollars: -100, pct: -10 });
  });
});

describe('stopProximity', () => {
  // long: entry 100, stop 90 → band = 90 + 0.25*(100-90) = 92.5
  it('far → ok', () => {
    expect(stopProximity('long', 100, 90, 99)).toBe('ok');
  });
  it('within band → near', () => {
    expect(stopProximity('long', 100, 90, 92)).toBe('near');
  });
  it('crossed → breached', () => {
    expect(stopProximity('long', 100, 90, 89)).toBe('breached');
  });
  it('short crossed (price above stop)', () => {
    expect(stopProximity('short', 100, 110, 111)).toBe('breached');
  });
  it('no stop → ok', () => {
    expect(stopProximity('long', 100, undefined, 50)).toBe('ok');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/tradeMetrics.test.ts 2>&1 | tail -8`
Expected: FAIL — "Failed to resolve import './tradeMetrics'" / function not defined.

**Step 3: Write minimal implementation**

`src/lib/tradeMetrics.ts`:
```ts
export type StopState = 'ok' | 'near' | 'breached';

/** Unrealized P&L. `side` flips the sign for shorts. */
export function unrealizedPnl(
  side: 'long' | 'short',
  entry: number,
  price: number,
  qty: number,
): { dollars: number; pct: number } {
  const dir = side === 'long' ? 1 : -1;
  const dollars = (price - entry) * qty * dir;
  const pct = entry > 0 ? ((price - entry) / entry) * 100 * dir : 0;
  return { dollars, pct };
}

/**
 * Where price sits relative to the stop.
 *  - 'breached': price has crossed the stop (loss side)
 *  - 'near': price within 25% of the entry→stop distance of the stop
 *  - 'ok': otherwise (or no stop set)
 */
export function stopProximity(
  side: 'long' | 'short',
  entry: number,
  stop: number | undefined,
  price: number,
): StopState {
  if (stop == null) return 'ok';
  const dist = Math.abs(entry - stop);
  if (side === 'long') {
    if (price <= stop) return 'breached';
    if (price <= stop + dist * 0.25) return 'near';
    return 'ok';
  }
  if (price >= stop) return 'breached';
  if (price >= stop - dist * 0.25) return 'near';
  return 'ok';
}
```

**Step 4: Run test to verify it passes**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npx vitest run src/lib/tradeMetrics.test.ts 2>&1 | tail -8`
Expected: PASS — all 9 assertions green.

**Step 5: Commit**

```bash
git add src/lib/tradeMetrics.ts src/lib/tradeMetrics.test.ts
git commit -m "feat: pure P&L + stop-proximity helpers"
```

---

### Task 3: Non-cached live quote fetch

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\services\yahooFinanceApi.ts` (append a new export)

**Step 1: Add `fetchYahooQuoteLive`**

Append after `fetchYahooQuote` (reuse the existing `PROJECT_ID` / `API_KEY` module constants):
```ts
/**
 * Non-cached quote fetch for live polling. Same proxy as `fetchYahooQuote`
 * but WITHOUT `fetchCached` — React Query owns freshness/dedup. Returns the
 * regular-market price, or null on any failure (never throws to the caller).
 */
export async function fetchYahooQuoteLive(symbol: string): Promise<number | null> {
  try {
    const qs = new URLSearchParams({ endpoint: 'quote', symbol }).toString();
    const url = `https://${PROJECT_ID}.supabase.co/functions/v1/api-yahoo?${qs}`;
    const res = await fetch(url, {
      headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json: { regularMarketPrice?: number | null } = await res.json();
    return json.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}
```

**Step 2: Type-check**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors referencing `yahooFinanceApi.ts`.

**Step 3: Commit**

```bash
git add src/services/yahooFinanceApi.ts
git commit -m "feat: non-cached fetchYahooQuoteLive for polling"
```

---

### Task 4: `useLiveQuotes` polling hook

**Files:**
- Create: `C:\Users\PC\Downloads\market-pulse\src\hooks\useLiveQuotes.ts`

**Step 1: Implement the hook**

```ts
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchYahooQuoteLive } from '@/services/yahooFinanceApi';

export interface LiveQuote {
  price: number | null;
  updatedAt: number;
}

/**
 * Poll live quotes for a set of symbols. One React Query per UNIQUE symbol
 * (keying dedups for free). Pauses when the tab is hidden; resumes on focus.
 * Empty input → zero requests. Write-free (safe for read-only mirrors).
 */
export function useLiveQuotes(
  symbols: string[],
  intervalMs: number,
): Record<string, LiveQuote> {
  const unique = useMemo(
    () => Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))),
    [symbols],
  );

  const results = useQueries({
    queries: unique.map((sym) => ({
      queryKey: ['live-quote', sym],
      queryFn: async (): Promise<LiveQuote> => ({
        price: await fetchYahooQuoteLive(sym),
        updatedAt: Date.now(),
      }),
      refetchInterval: intervalMs,
      refetchIntervalInBackground: false,
      staleTime: Math.max(0, intervalMs - 5_000),
      gcTime: 60_000,
    })),
  });

  return useMemo(() => {
    const map: Record<string, LiveQuote> = {};
    unique.forEach((sym, i) => {
      const d = results[i]?.data;
      if (d) map[sym] = d;
    });
    return map;
  }, [unique, results]);
}
```

**Step 2: Type-check**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors referencing `useLiveQuotes.ts`.

**Step 3: Commit**

```bash
git add src/hooks/useLiveQuotes.ts
git commit -m "feat: useLiveQuotes polling hook"
```

---

### Task 5: Speed toggle + wire hook into TradeTracker

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\components\trading\TradeTracker.tsx`

**Step 1: Add imports** (extend existing import lines):
```ts
import { useLiveQuotes } from '@/hooks/useLiveQuotes';
import { unrealizedPnl, stopProximity } from '@/lib/tradeMetrics';
```

**Step 2: Add a local persisted speed state** (inside `TradeTracker`, near the other `useState`s):
```ts
const [fast, setFast] = useState<boolean>(() => {
  try { return localStorage.getItem('tt-live-speed-v1') === 'fast'; } catch { return false; }
});
const setSpeed = (f: boolean) => {
  setFast(f);
  try { localStorage.setItem('tt-live-speed-v1', f ? 'fast' : 'slow'); } catch { /* ignore */ }
};
const intervalMs = fast ? 5_000 : 30_000;
const quotes = useLiveQuotes(open.map((t) => t.symbol), intervalMs);
```

**Step 3: Add the speed toggle to the header.** Replace the existing open-positions header block:
```tsx
<div className="flex items-center justify-between">
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Open positions
  </p>
  {open.length > 0 && (
    <span className="text-[11px] text-muted-foreground">{open.length} tracked</span>
  )}
</div>
```
with:
```tsx
<div className="flex items-center justify-between gap-2">
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Open positions
  </p>
  <div className="flex items-center gap-2">
    {open.length > 0 && (
      <button
        type="button"
        onClick={() => setSpeed(!fast)}
        title="Live price refresh rate"
        className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-mono-num text-muted-foreground hover:text-foreground transition-colors"
      >
        ⚡ {fast ? '5s' : '30s'}
      </button>
    )}
    {open.length > 0 && (
      <span className="text-[11px] text-muted-foreground">{open.length} tracked</span>
    )}
  </div>
</div>
```

**Step 4: Build**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npm run build 2>&1 | tail -3`
Expected: `✓ built` with only the pre-existing chunk-size warning.

**Step 5: Commit**

```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: live-quote wiring + 5s/30s speed toggle"
```

---

### Task 6: Per-position live row (P&L + distance to stop/target)

**Files:**
- Modify: `C:\Users\PC\Downloads\market-pulse\src\components\trading\TradeTracker.tsx`

**Step 1:** Inside `open.map((t) => { … })`, after the existing `const rr = …;` line and before `return (`, add:
```ts
const q = quotes[t.symbol.trim().toUpperCase()];
const livePrice = q?.price ?? null;
const pnl = livePrice != null ? unrealizedPnl(t.side, t.entryPrice, livePrice, t.quantity) : null;
const stopState = livePrice != null ? stopProximity(t.side, t.entryPrice, t.stopLoss, livePrice) : 'ok';
const gapPct = (to?: number) =>
  livePrice != null && to != null && livePrice > 0
    ? ((to - livePrice) / livePrice) * 100
    : null;
```

**Step 2:** Insert a live row immediately AFTER the `grid grid-cols-4` Numbers block (before the "Plan-valid toggle + actions" `border-t` row):
```tsx
<div className="mt-2 rounded-md bg-muted/30 px-2.5 py-2 text-xs">
  {livePrice == null ? (
    <span className="text-muted-foreground/60">waiting for price…</span>
  ) : (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-mono-num">
        <span className="text-muted-foreground/70">Last </span>
        {money(livePrice)}
      </span>
      {pnl && (
        <span className={`font-mono-num font-semibold ${
          pnl.dollars >= 0 ? 'text-trading-buy' : 'text-trading-sell'
        }`}>
          {pnl.dollars >= 0 ? '+' : ''}{money(pnl.dollars)} ({pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%)
        </span>
      )}
      {t.stopLoss != null && (
        <span className={`font-mono-num ${
          stopState === 'breached' ? 'text-trading-sell font-semibold'
            : stopState === 'near' ? 'text-warning' : 'text-muted-foreground'
        }`}>
          {stopState === 'breached' ? 'stop hit' : `${Math.abs(gapPct(t.stopLoss) ?? 0).toFixed(1)}% to stop`}
        </span>
      )}
      {t.target != null && (() => {
        const reached = t.side === 'long' ? livePrice >= t.target : livePrice <= t.target;
        return (
          <span className={`font-mono-num ${reached ? 'text-trading-buy font-semibold' : 'text-muted-foreground'}`}>
            {reached ? 'target hit' : `${Math.abs(gapPct(t.target) ?? 0).toFixed(1)}% to target`}
          </span>
        );
      })()}
    </div>
  )}
</div>
```

**Step 3: Build**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npm run build 2>&1 | tail -3`
Expected: `✓ built` with only the chunk-size warning.

**Step 4: Manual verification (preview)**

Use the `mcp__Claude_Preview__*` tools against the `market-pulse` server:
1. Navigate to `/trading`, add a position with a real liquid US ticker (e.g. AAPL), qty 10, a stop a few % below entry, a target above.
2. Within one interval (≤30s) the live row shows `Last $…`, a colored P&L, "x% to stop", "x% to target".
3. Click the `⚡ 30s` toggle → it reads `⚡ 5s`; reload the page → toggle still reads `5s` (persistence).
4. In the preview console, temporarily seed an `OpenTrade` whose stop is just below the live price to confirm the amber "near" state; one just above (long) to confirm red "stop hit".
5. Switch the browser tab away and back — confirm no console errors; data refetches on focus.
6. Close the trade → its card (and its poll) disappears.
7. **Clean up:** `localStorage.setItem('tp-open-trades-v1','[]')` and reload — verify empty state.

**Step 5: Commit**

```bash
git add src/components/trading/TradeTracker.tsx
git commit -m "feat: live P&L + distance-to-stop/target per open position"
```

---

### Task 7: Final regression pass

**Step 1: Run the unit suite**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npm test 2>&1 | tail -10`
Expected: `src/lib/tradeMetrics.test.ts` passes (9 assertions). Pre-existing
`src/test/*.test.ts` may require network/Supabase — note any failures as
pre-existing, do NOT fix in this branch.

**Step 2: Clean production build**

Run: `cd "C:/Users/PC/Downloads/market-pulse" && npm run build 2>&1 | tail -3`
Expected: `✓ built`, only the chunk-size warning.

**Step 3: Confirm no leftover test data**

In preview: `JSON.parse(localStorage.getItem('tp-open-trades-v1')||'[]')` → `[]`.

**Step 4: Commit any final cleanup** (if needed)

```bash
git add -A && git commit -m "chore: trade-tracker live-monitoring final pass"
```

---

## Done When

- `npm test` green for `tradeMetrics.test.ts`; `npm run build` clean.
- Open positions show live P&L + distance-to-stop/target, updating on the
  selected cadence; 5s/30s toggle persists across reloads.
- Polling pauses on hidden tab; closing a trade stops its poll; failed/unknown
  quotes degrade to "waiting for price…" without breaking the close flow.
- No live/market data persisted into `tp-open-trades-v1`.
