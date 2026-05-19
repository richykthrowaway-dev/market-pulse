# Dashboard Inline Watchlist Add/Remove + Movers Callout — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users add/remove watchlist symbols directly on the dashboard list and show a one-line "your biggest gainer/loser" callout.

**Architecture:** A pure `watchlistMovers` added to the existing `dashboardStocks` lib (TDD); `Dashboard.tsx` gains a stocks-filtered add input, a hover ✕ remove overlay (watchlist-mode only, `StockCard` untouched), and the callout — preserving every shipped resilience/wiring wrapper.

**Tech Stack:** React 18 + TS + Vite + react-router-dom; Vitest (`src/lib/**`, node).

**Hard constraints (every task):**
- CRITICAL PATH: tools default to `C:\Users\PC\Downloads\world-market-beat-main`. Use the explicit `C:\Users\PC\Downloads\market-pulse` path for EVERY tool (Bash `cd` first; Read/Write/Edit absolute; Grep/Glob `path:`; `git -C`). Never declare a file missing without checking under that path.
- Edit ONLY `src/lib/dashboardStocks.ts`, `src/lib/dashboardStocks.test.ts`, `src/components/layout/Dashboard.tsx`. NEVER modify/stage `src/App.tsx`, `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/TradeJournal.tsx`.
- NEVER `git add -A`; commits LOCAL (no push). `git -c core.safecrlf=false commit`.
- No dev server. Verify: `npx vitest run`, `npm test`, `npx tsc --noEmit`, `npm run build` (pre-existing >500 kB chunk + `articles.ts` warnings EXPECTED).
- Preserve EXACTLY in Dashboard.tsx: the `ready` skeleton ternary, `<ErrorBoundary name="AllStocks">`, `DeferUntilVisible`, `selectStock`/`?sym=`+localStorage wiring, the `listSource`-driven heading, and the `listSource === 'movers'` `<Link to="/watchlists">` CTA.

---

### Task 1: `watchlistMovers` pure lib (TDD)

**Files:** Modify `src/lib/dashboardStocks.ts`; modify `src/lib/dashboardStocks.test.ts`.

**Step 1 — append failing tests** to `src/lib/dashboardStocks.test.ts` (keep existing tests; reuse the existing `S` helper if present, else define locally):
```ts
import { watchlistMovers } from './dashboardStocks';

describe('watchlistMovers', () => {
  const mk = (symbol: string, changePercent: number) => ({ symbol, changePercent, name: symbol });
  const stocks = [mk('AAPL', 1), mk('MSFT', -3), mk('NVDA', 5), mk('TSLA', -8)];

  it('best = max %, worst = min %, among resolved watchlist (case-insensitive)', () => {
    const r = watchlistMovers(stocks, ['nvda', 'tsla', 'aapl'])!;
    expect(r.best.symbol).toBe('NVDA');
    expect(r.worst.symbol).toBe('TSLA');
  });
  it('null when no symbols resolve', () => {
    expect(watchlistMovers(stocks, ['ZZZ'])).toBeNull();
    expect(watchlistMovers(stocks, [])).toBeNull();
  });
  it('single resolved → best === worst', () => {
    const r = watchlistMovers(stocks, ['AAPL'])!;
    expect(r.best.symbol).toBe('AAPL');
    expect(r.worst.symbol).toBe('AAPL');
  });
  it('non-array safe', () => {
    // @ts-expect-error intentional
    expect(watchlistMovers(null, null)).toBeNull();
  });
});
```
(If the existing test file does NOT already `import { describe, it, expect } from 'vitest'` at top, ensure it does — do not duplicate.)

**Step 2 — run, expect FAIL:** `cd /c/Users/PC/Downloads/market-pulse && npx vitest run src/lib/dashboardStocks.test.ts` (`watchlistMovers` not exported).

**Step 3 — append to `src/lib/dashboardStocks.ts`** (do not alter existing exports):
```ts
/**
 * Best/worst performer among the watchlist symbols resolved against `stocks`
 * (same case-insensitive match as resolveDisplayStocks). null if none resolve.
 * Pure, never throws.
 */
export function watchlistMovers<T extends StockLike>(
  stocks: T[],
  symbols: string[],
): { best: T; worst: T } | null {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(symbols) ? symbols : [];
  const bySym = new Map<string, T>();
  for (const s of all) {
    if (s && typeof s.symbol === 'string') {
      const k = s.symbol.trim().toUpperCase();
      if (k && !bySym.has(k)) bySym.set(k, s);
    }
  }
  const resolved: T[] = [];
  for (const raw of wl) {
    if (typeof raw !== 'string') continue;
    const hit = bySym.get(raw.trim().toUpperCase());
    if (hit && !resolved.includes(hit)) resolved.push(hit);
  }
  if (resolved.length === 0) return null;
  let best = resolved[0];
  let worst = resolved[0];
  for (const s of resolved) {
    const c = Number(s.changePercent) || 0;
    if (c > (Number(best.changePercent) || 0)) best = s;
    if (c < (Number(worst.changePercent) || 0)) worst = s;
  }
  return { best, worst };
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/dashboardStocks.test.ts && npx tsc --noEmit`. If a tie/expectation conflicts with real behavior, fix the **test expectation**, not the function.

**Step 5 — commit:**
```bash
cd /c/Users/PC/Downloads/market-pulse && git add src/lib/dashboardStocks.ts src/lib/dashboardStocks.test.ts && git -c core.safecrlf=false commit -m "feat: watchlistMovers pure lib (best/worst of resolved watchlist)"
```

---

### Task 2: Dashboard.tsx — add input, remove overlay, callout

**Files:** Modify `src/components/layout/Dashboard.tsx` only. READ the whole current file first; match the CURRENT code (post watchlist-list bundle).

Current relevant code:
- `import { resolveDisplayStocks } from '@/lib/dashboardStocks';`
- `const { symbols: watchSymbols } = useWatchlist();`
- The list `<div className="lg:w-1/3 …">` block contains the `listSource` heading, `<ErrorBoundary name="AllStocks">` with `{displayStocks.map((stock) => (<StockCardWithHistory … onClick={() => selectStock(stock)} … />))}`, then `{listSource === 'movers' && (<Link to="/watchlists" …>…</Link>)}`.
If these differ, STOP and report the real code.

**Step 1 — imports/hook:**
- Change `import { resolveDisplayStocks } from '@/lib/dashboardStocks';` → `import { resolveDisplayStocks, watchlistMovers } from '@/lib/dashboardStocks';`
- Change `const { symbols: watchSymbols } = useWatchlist();` → `const { symbols: watchSymbols, add: addWatch, remove: removeWatch } = useWatchlist();`
- Ensure `useState` is in the existing React import (it is — used elsewhere). No new imports otherwise.

**Step 2 — derived state** (add near the existing `displayStocks` `useMemo`):
```tsx
  const [wlQuery, setWlQuery] = useState('');
  const wlMovers = useMemo(() => watchlistMovers(stocks, watchSymbols), [stocks, watchSymbols]);
  const wlMatches = useMemo(() => {
    const q = wlQuery.trim().toLowerCase();
    if (!q) return [] as typeof stocks;
    const have = new Set(watchSymbols.map((s) => s.toUpperCase()));
    return stocks
      .filter(
        (s) =>
          !have.has(String(s.symbol).toUpperCase()) &&
          (String(s.symbol).toLowerCase().includes(q) ||
            String(s.name ?? '').toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [wlQuery, stocks, watchSymbols]);
```

**Step 3 — replace the list `<div className="lg:w-1/3 …">…</div>` block** with EXACTLY (preserving heading/ErrorBoundary/CTA, adding add-input + callout + per-row ✕):
```tsx
            <div className="lg:w-1/3 flex flex-col animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
              <h2 className="text-lg font-semibold tracking-tight mb-2">
                {listSource === 'watchlist' ? 'Your Watchlist' : 'Top Movers'}
              </h2>

              {listSource === 'watchlist' && wlMovers && (
                <p className="text-xs mb-2 font-mono-num">
                  <span className="text-green-500">▲ {wlMovers.best.symbol} {Number(wlMovers.best.changePercent) >= 0 ? '+' : ''}{Number(wlMovers.best.changePercent).toFixed(2)}%</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-red-500">▼ {wlMovers.worst.symbol} {Number(wlMovers.worst.changePercent).toFixed(2)}%</span>
                </p>
              )}

              <div className="relative mb-3">
                <input
                  value={wlQuery}
                  onChange={(e) => setWlQuery(e.target.value)}
                  placeholder="Add symbol to watchlist…"
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  aria-label="Add symbol to watchlist"
                />
                {wlQuery.trim() && wlMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {wlMatches.map((m) => (
                      <button
                        key={m.symbol}
                        type="button"
                        onClick={() => { addWatch(m.symbol); setWlQuery(''); }}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                      >
                        <span className="font-semibold">{m.symbol}</span>
                        <span className="truncate text-muted-foreground">{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ErrorBoundary name="AllStocks">
                <div className="space-y-3 overflow-y-auto lg:max-h-[500px] p-1">
                  {displayStocks.map((stock) => (
                    <div key={stock.symbol} className="relative group">
                      <StockCardWithHistory
                        stock={stock}
                        days={chartDays}
                        isActive={activeStock.symbol === stock.symbol}
                        onClick={() => selectStock(stock)}
                        compact
                      />
                      {listSource === 'watchlist' && (
                        <button
                          type="button"
                          aria-label={`Remove ${stock.symbol} from watchlist`}
                          onClick={(e) => { e.stopPropagation(); removeWatch(stock.symbol); }}
                          className="absolute top-1 right-1 z-10 rounded-full p-1 text-muted-foreground bg-background/70 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-opacity"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
                        </button>
                      )}
                    </div>
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
Notes: the `key` moved to the wrapping `<div>` (was on `StockCardWithHistory`); the inline ✕ uses a raw `<svg>` so no new import. Change NOTHING else in the file.

**Step 4 — verify:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit && npm run build` — tsc 0; build `✓ built`. Fix within Dashboard.tsx only.

**Step 5 — commit:**
```bash
cd /c/Users/PC/Downloads/market-pulse && git add src/components/layout/Dashboard.tsx && git -c core.safecrlf=false commit -m "feat: inline watchlist add/remove + movers callout on dashboard"
```

---

### Task 3: Final verification

**Step 1:** `cd /c/Users/PC/Downloads/market-pulse && npm test && npx tsc --noEmit && npm run build` — full suite green (incl. new `watchlistMovers` tests), tsc 0, build ✓.

**Step 2 — static checks (explicit path):**
- `git -C /c/Users/PC/Downloads/market-pulse grep -nE "watchlistMovers|addWatch|removeWatch|wlMatches|Add symbol to watchlist" -- src/components/layout/Dashboard.tsx` → wiring present.
- `git -C /c/Users/PC/Downloads/market-pulse grep -cE 'ErrorBoundary name=|DeferUntilVisible|const ready =|selectStock\(|to="/watchlists"' -- src/components/layout/Dashboard.tsx` → resilience/wiring wrappers still present (unchanged).
- `git -C /c/Users/PC/Downloads/market-pulse diff --stat HEAD~2 HEAD` → ONLY `dashboardStocks.ts`, `dashboardStocks.test.ts`, `Dashboard.tsx`.

**Step 3 — WIP untouched:** `git -C /c/Users/PC/Downloads/market-pulse status --porcelain src/App.tsx src/components/layout/MobileShell.tsx src/components/layout/Sidebar.tsx src/pages/TradeJournal.tsx` → only pre-existing ` M`; never staged; no `git add -A`.

---

## Notes for the implementer
- Only `watchlistMovers` is unit-tested; Dashboard wiring is `tsc`+`build`+static (expected, not a gap). No server.
- Moving `key` to the wrapping `<div>` is required (React keys belong on the outermost mapped element) — verify no console key warning would arise.
- The ✕ must `e.stopPropagation()` so removing a row doesn't also trigger `selectStock`.
- Keep `watchlistMovers` generic so rich `useStocks` rows flow through (don't narrow to `StockLike`).
- Preserve every shipped wrapper/CTA verbatim; only the listed additions change.
