# Dashboard Watchlist List + Sticky Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Dashboard's left list the user's watchlist (top-movers fallback + CTA) and make the selected stock persist via URL `?sym=` + localStorage.

**Architecture:** One pure, unit-tested generic `resolveDisplayStocks` lib does the watchlist→stocks resolution + movers fallback; `Dashboard.tsx` wires `useWatchlist` + `useSearchParams` + localStorage around it, preserving the already-shipped resilience wrappers.

**Tech Stack:** React 18 + TS + Vite + react-router-dom; Vitest (`environment: node`, `src/lib/**/*.test.ts`).

**Hard constraints (every task):**
- CRITICAL PATH: tools default to a DIFFERENT repo (`C:\Users\PC\Downloads\world-market-beat-main`). For EVERY tool use the explicit `C:\Users\PC\Downloads\market-pulse` path: Bash → `cd /c/Users/PC/Downloads/market-pulse && …`; Read/Write/Edit → absolute `C:\Users\PC\Downloads\market-pulse\…`; Grep/Glob → `path:"C:\\Users\\PC\\Downloads\\market-pulse\\src"`; git → `git -C /c/Users/PC/Downloads/market-pulse …`. Never declare a file missing without checking under that explicit path.
- Edit ONLY `src/components/layout/Dashboard.tsx`; CREATE `src/lib/dashboardStocks.ts` + `src/lib/dashboardStocks.test.ts`. NEVER modify/stage `src/App.tsx`, `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/TradeJournal.tsx`.
- NEVER `git add -A`/`.`; commits LOCAL (no push). `git -c core.safecrlf=false commit`.
- No dev server. Verify: `npx vitest run <file>`, `npm test`, `npx tsc --noEmit`, `npm run build` (pre-existing >500 kB chunk + `articles.ts` warnings are EXPECTED).
- Preserve the shipped resilience wrappers in Dashboard.tsx: the `ready` skeleton gate, `<ErrorBoundary name="AllStocks">`, and `DeferUntilVisible` — only change the list's data source, heading, add the CTA, and selection persistence.

---

### Task 1: `resolveDisplayStocks` pure lib (TDD)

**Files:** Create `src/lib/dashboardStocks.ts`, `src/lib/dashboardStocks.test.ts`.

**Step 1 — failing test** `src/lib/dashboardStocks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveDisplayStocks } from './dashboardStocks';

const S = (symbol: string, changePercent = 0) => ({ symbol, changePercent, name: symbol });

describe('resolveDisplayStocks', () => {
  const stocks = [
    S('AAPL', 1), S('MSFT', -3), S('NVDA', 5), S('TSLA', -8), S('GOOGL', 2),
  ];

  it('watchlist: resolved in watchlist order, case-insensitive, drops unknown', () => {
    const r = resolveDisplayStocks(stocks, ['nvda', 'AAPL', 'ZZZZ']);
    expect(r.source).toBe('watchlist');
    expect(r.list.map((s) => s.symbol)).toEqual(['NVDA', 'AAPL']);
  });

  it('empty watchlist → movers sorted by |changePercent| desc, capped', () => {
    const r = resolveDisplayStocks(stocks, [], 3);
    expect(r.source).toBe('movers');
    expect(r.list.map((s) => s.symbol)).toEqual(['TSLA', 'NVDA', 'MSFT']);
  });

  it('watchlist with no resolvable symbols → movers fallback', () => {
    const r = resolveDisplayStocks(stocks, ['NOPE', 'ALSO_NO']);
    expect(r.source).toBe('movers');
  });

  it('limit caps the watchlist list', () => {
    const r = resolveDisplayStocks(stocks, ['AAPL', 'MSFT', 'NVDA'], 2);
    expect(r.list.map((s) => s.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('non-array / garbage safe', () => {
    // @ts-expect-error intentional
    expect(resolveDisplayStocks(null, null)).toEqual({ list: [], source: 'movers' });
  });
});
```

**Step 2 — run, expect FAIL:** `cd /c/Users/PC/Downloads/market-pulse && npx vitest run src/lib/dashboardStocks.test.ts` (module missing).

**Step 3 — implement** `src/lib/dashboardStocks.ts`:
```ts
export interface StockLike {
  symbol: string;
  changePercent?: number;
}

export interface DisplayStocks<T> {
  list: T[];
  source: 'watchlist' | 'movers';
}

/**
 * Resolve the dashboard list: the user's watchlist symbols mapped onto the
 * loaded stocks (case-insensitive, watchlist order, unknown symbols dropped).
 * If nothing resolves, fall back to top movers by |changePercent|.
 * Pure, total, never throws.
 */
export function resolveDisplayStocks<T extends StockLike>(
  stocks: T[],
  watchlistSymbols: string[],
  limit = 10,
): DisplayStocks<T> {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(watchlistSymbols) ? watchlistSymbols : [];

  const bySym = new Map<string, T>();
  for (const s of all) {
    if (s && typeof s.symbol === 'string') {
      const k = s.symbol.trim().toUpperCase();
      if (k && !bySym.has(k)) bySym.set(k, s);
    }
  }

  const watch: T[] = [];
  for (const raw of wl) {
    if (typeof raw !== 'string') continue;
    const hit = bySym.get(raw.trim().toUpperCase());
    if (hit && !watch.includes(hit)) watch.push(hit);
    if (watch.length >= limit) break;
  }
  if (watch.length > 0) return { list: watch, source: 'watchlist' };

  const movers = [...all]
    .filter((s): s is T => !!s && typeof s.symbol === 'string')
    .sort(
      (a, b) =>
        Math.abs(Number(b.changePercent) || 0) - Math.abs(Number(a.changePercent) || 0),
    )
    .slice(0, limit);
  return { list: movers, source: 'movers' };
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/dashboardStocks.test.ts && npx tsc --noEmit`. If an expected array conflicts with the real sort/tie behavior, fix the **test expectation** (keep the impl faithful to "watchlist order; movers = |changePercent| desc").

**Step 5 — commit:**
```bash
cd /c/Users/PC/Downloads/market-pulse && git add src/lib/dashboardStocks.ts src/lib/dashboardStocks.test.ts && git -c core.safecrlf=false commit -m "feat: resolveDisplayStocks pure lib (watchlist + movers fallback)"
```

---

### Task 2: Dashboard.tsx wiring

**Files:** Modify `src/components/layout/Dashboard.tsx` only. READ the whole current file first (it was rewritten by the resilience bundle — match the *current* code, not memory).

The current All-Stocks block (post-resilience) is exactly:
```tsx
            <div className="lg:w-1/3 flex flex-col animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
              <h2 className="text-lg font-semibold tracking-tight mb-3">All Stocks</h2>
              <ErrorBoundary name="AllStocks">
                <div className="space-y-3 overflow-y-auto lg:max-h-[500px] p-1">
                  {stocks.slice(0, 10).map((stock) => (
                    <StockCardWithHistory
                      key={stock.symbol}
                      stock={stock}
                      days={chartDays}
                      isActive={activeStock.symbol === stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                      compact
                    />
                  ))}
                </div>
              </ErrorBoundary>
            </div>
```
(If it differs, STOP and report the real block.)

**Step 1 — imports.**
- Add `import { useWatchlist } from '@/hooks/useWatchlist';` and `import { resolveDisplayStocks } from '@/lib/dashboardStocks';` near the other imports.
- Add `import { Link, useSearchParams } from 'react-router-dom';` (Dashboard.tsx does not currently import from react-router-dom — add this line; if it somehow already imports `Link`, merge instead of duplicating).
- Ensure React hooks import includes `useCallback`: change the existing `import React, { useState, useMemo } from 'react';` (or whatever the real specifiers are) to also include `useCallback`. Do NOT drop existing specifiers.

**Step 2 — derive list + selection (in `Dashboard()` body, after `const { data: stocks = [], ... } = useStocks();` and the existing `selectedStock` state).** Add:
```tsx
  const { symbols: watchSymbols } = useWatchlist();
  const { list: displayStocks, source: listSource } = useMemo(
    () => resolveDisplayStocks(stocks, watchSymbols),
    [stocks, watchSymbols],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const persistedSym =
    searchParams.get('sym') ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('dash-active-sym') : null);

  const selectStock = useCallback(
    (stock: { symbol: string }) => {
      setSelectedStock(stock as typeof selectedStock);
      const sp = new URLSearchParams(searchParams);
      sp.set('sym', stock.symbol);
      setSearchParams(sp, { replace: true });
      try { localStorage.setItem('dash-active-sym', stock.symbol); } catch { /* quota */ }
    },
    [searchParams, setSearchParams],
  );
```
Then change the existing `activeStock` derivation. Find the current line (it is exactly `const activeStock = selectedStock ?? stocks[0];`) and replace with:
```tsx
  const activeStock =
    selectedStock ??
    (persistedSym
      ? stocks.find((s) => s.symbol?.toUpperCase() === persistedSym.toUpperCase())
      : undefined) ??
    stocks[0];
```
(`selectedStock`/`setSelectedStock` state already exists — keep it. Do not reorder hooks.)

**Step 3 — swap the All-Stocks block** to the watchlist-driven version (preserve the surrounding `ready` gate + `ErrorBoundary`):
```tsx
            <div className="lg:w-1/3 flex flex-col animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
              <h2 className="text-lg font-semibold tracking-tight mb-3">
                {listSource === 'watchlist' ? 'Your Watchlist' : 'Top Movers'}
              </h2>
              <ErrorBoundary name="AllStocks">
                <div className="space-y-3 overflow-y-auto lg:max-h-[500px] p-1">
                  {displayStocks.map((stock) => (
                    <StockCardWithHistory
                      key={stock.symbol}
                      stock={stock}
                      days={chartDays}
                      isActive={activeStock.symbol === stock.symbol}
                      onClick={() => selectStock(stock)}
                      compact
                    />
                  ))}
                </div>
              </ErrorBoundary>
              {listSource === 'movers' && (
                <Link
                  to="/watchlists"
                  className="mt-3 text-xs text-primary hover:underline self-start"
                >
                  Add symbols to build your watchlist →
                </Link>
              )}
            </div>
```
Change nothing else (keep the `ready` ternary, the chart column, fundamentals, all other widgets/wrappers, `StockCardWithHistory` definition).

**Step 4 — verify:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit && npm run build` — tsc 0, build `✓ built`. Fix within Dashboard.tsx only until clean. (If `activeStock` can now be `undefined` when `stocks` is empty, that's already handled by the `ready` gate — `ready` requires `!!activeStock`; do not add new guards.)

**Step 5 — commit:**
```bash
cd /c/Users/PC/Downloads/market-pulse && git add src/components/layout/Dashboard.tsx && git -c core.safecrlf=false commit -m "feat: dashboard list = watchlist (movers fallback) + sticky/shareable selection"
```

---

### Task 3: Final verification

**Step 1:** `cd /c/Users/PC/Downloads/market-pulse && npm test && npx tsc --noEmit && npm run build` — full suite green (incl. new `dashboardStocks` tests), tsc 0, build ✓.

**Step 2 — static checks (explicit path):**
- `git -C /c/Users/PC/Downloads/market-pulse grep -n "resolveDisplayStocks\|useWatchlist\|useSearchParams\|dash-active-sym" -- src/components/layout/Dashboard.tsx` → shows the wiring.
- `git -C /c/Users/PC/Downloads/market-pulse grep -n "stocks.slice(0, 10)" -- src/components/layout/Dashboard.tsx` → **no match** (old list source gone).
- `git -C /c/Users/PC/Downloads/market-pulse grep -n 'ErrorBoundary name="AllStocks"\|DeferUntilVisible\|const ready =' -- src/components/layout/Dashboard.tsx` → still present (resilience wrappers intact).
- `git -C /c/Users/PC/Downloads/market-pulse diff --stat HEAD~2 HEAD` → ONLY `src/lib/dashboardStocks.ts`, `src/lib/dashboardStocks.test.ts`, `src/components/layout/Dashboard.tsx`.

**Step 3 — WIP untouched:** `git -C /c/Users/PC/Downloads/market-pulse status --porcelain src/App.tsx src/components/layout/MobileShell.tsx src/components/layout/Sidebar.tsx src/pages/TradeJournal.tsx` → only pre-existing ` M`; never staged; no `git add -A` used.

---

## Notes for the implementer
- Only `resolveDisplayStocks` is unit-tested (node harness); the Dashboard wiring is `tsc`+`build`+static — expected, not a gap. No server.
- Keep `resolveDisplayStocks` generic so the rich `useStocks` row object flows unchanged into `StockCardWithHistory` (don't narrow it to `StockLike`).
- Preserve EVERY resilience wrapper and the `StockCardWithHistory` component; the only changes are the list source, the dynamic heading, the movers CTA, the imports, and the selection-persistence wiring.
- If a TDD expected array conflicts with real tie-ordering, fix the test expectation, never the function's documented behavior.
