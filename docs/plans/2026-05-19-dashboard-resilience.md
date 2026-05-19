# Dashboard Resilience + Lazy Embeds Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the Dashboard's full-page spinner single-point-of-failure, isolate every widget behind the existing ErrorBoundary, and lazy-mount the two heavy embeds.

**Architecture:** One new `IntersectionObserver` wrapper (`DeferUntilVisible`); `Dashboard.tsx` drops its early-return spinner (→ `ready` flag + skeleton for the stock-only block), wraps each widget in the shipped `@/components/common/ErrorBoundary`, and defers the TradingView iframe + breadth cards.

**Tech Stack:** React 18 + TS + Vite. No Vitest work (no node-testable pure logic — `ErrorBoundary` already proven; `DeferUntilVisible` is DOM/IO UI). Verify via `tsc` + `build` + static review.

**Hard constraints (every task):**
- Edit ONLY `src/components/layout/Dashboard.tsx`; CREATE `src/components/common/DeferUntilVisible.tsx`. NEVER modify/stage `src/App.tsx`, `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/TradeJournal.tsx`.
- NEVER `git add -A`/`.` — stage only the exact file(s) per task. Commits LOCAL (no push).
- No dev server. Verify: `npx tsc --noEmit`, `npm run build` (pre-existing >500 kB chunk + `articles.ts` duplicate-key warnings are EXPECTED, not failures), static read.
- Windows; `git -c core.safecrlf=false commit`.
- `Dashboard.tsx` already imports `ErrorBoundary` (`import { ErrorBoundary } from '@/components/common/ErrorBoundary';`) and renders `<ErrorBoundary name="YourSnapshot"><YourSnapshot /></ErrorBoundary>` as the first child of the `dashboardContent` fragment — keep that line exactly.

---

### Task 1: `DeferUntilVisible` component

**Files:** Create `src/components/common/DeferUntilVisible.tsx`.

**Step 1 — Create the file EXACTLY:**
```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Reserved placeholder height (px) to avoid layout shift. */
  minHeight?: number;
  /** IntersectionObserver rootMargin — pre-mount slightly before in view. */
  rootMargin?: string;
  className?: string;
}

/**
 * Renders a reserved-height placeholder until it scrolls near the viewport,
 * then mounts `children` once and keeps them mounted. If IntersectionObserver
 * is unavailable (SSR / old engines) it renders children immediately.
 */
export function DeferUntilVisible({
  children,
  minHeight = 300,
  rootMargin = '200px',
  className,
}: Props) {
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref} className={className} style={{ minHeight }} aria-hidden="true" />;
}
```

**Step 2 — Typecheck:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit` → exit 0.

**Step 3 — Commit (only this file):**
```bash
git add src/components/common/DeferUntilVisible.tsx
git -c core.safecrlf=false commit -m "feat: DeferUntilVisible (IntersectionObserver lazy-mount wrapper)"
```

---

### Task 2: Dashboard resilience wiring

**Files:** Modify `src/components/layout/Dashboard.tsx` only. READ the whole file first.

**Step 1 — Add import** with the other component imports (next to the existing `ErrorBoundary` import line):
```tsx
import { DeferUntilVisible } from '@/components/common/DeferUntilVisible';
```

**Step 2 — Remove the full-page spinner early-return.** Find this exact block in `Dashboard()`:
```tsx
  if (stocksLoading || !activeStock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }
```
Replace the **entire block** with exactly:
```tsx
  const ready = !stocksLoading && !!activeStock;
```
(Do not remove or reorder any hook above it — hook order must stay intact.)

**Step 3 — Replace the `dashboardContent` body.** Find `const dashboardContent = (` then `<>` … up to the matching `</>\n  );` that ends it (immediately before `if (isMobile) {`). Replace the WHOLE JSX returned into `dashboardContent` with exactly:
```tsx
  const dashboardContent = (
    <>
      <ErrorBoundary name="YourSnapshot"><YourSnapshot /></ErrorBoundary>

      <h1 className="text-2xl font-bold mb-6 tracking-tight">
        Market Dashboard
      </h1>

      {/* Stats Row */}
      <ErrorBoundary name="StatsRow">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          <StatsCard
            title="Market Cap"
            value={activeMarketCap != null ? formatMarketCap(activeMarketCap) : '…'}
            trend={activeStock?.changePercent}
            trendLabel={activeStock?.symbol}
            icon={<Wallet2 />}
            className="bg-card"
          />
          <StatsCard
            title="Trading Volume"
            value={formatVolume(activeStock?.volume ?? 0)}
            description={
              relativeVolume != null
                ? `Rel Vol: ${relativeVolume.toFixed(2)}×`
                : 'Today\'s volume'
            }
            icon={<BarChart3 />}
            className="bg-card"
          />
          <TopMoverCard direction="gainer" className="bg-card" />
          <TopMoverCard direction="loser"  className="bg-card" />
        </div>
      </ErrorBoundary>

      {ready ? (
        <>
          {/* Stock Cards + Chart side-by-side */}
          <div className="flex flex-col lg:flex-row gap-6 mb-6 animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
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

            <div className="lg:w-2/3 min-w-0 h-64 md:h-96 lg:h-[500px]">
              <ErrorBoundary name="StockChart">
                <StockChart
                  symbol={activeStock.symbol}
                  name={activeStock.name}
                  currentPrice={activeStock.price}
                  onRangeChange={setChartDays}
                />
              </ErrorBoundary>
            </div>
          </div>

          {/* Fundamentals Panel */}
          <div className="mb-6 animate-slide-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
            <ErrorBoundary name="Fundamentals">
              <StockFundamentalsPanel
                symbol={activeStock.symbol}
                name={activeStock.name}
                currentPrice={activeStock.price}
              />
            </ErrorBoundary>
          </div>
        </>
      ) : (
        <div className="space-y-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/3 h-[500px] rounded-lg bg-muted/40 animate-pulse" />
            <div className="lg:w-2/3 h-[500px] rounded-lg bg-muted/40 animate-pulse" />
          </div>
          <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <ErrorBoundary name="News">
            <NewsCard
              news={news}
              watchlistSymbols={WATCHLIST_SYMBOLS}
            />
          </ErrorBoundary>
          <ErrorBoundary name="TopStories">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Newspaper className="h-5 w-5 text-primary" />
                  Top Stories
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden rounded-b-lg">
                <DeferUntilVisible minHeight={500}>
                  <TradingViewTimeline height={500} className="w-full" />
                </DeferUntilVisible>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </div>

        <div className="lg:col-span-1 space-y-6 animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <ErrorBoundary name="MarketOverviewCard"><MarketOverviewCard /></ErrorBoundary>
          <ErrorBoundary name="MarketOverview"><MarketOverview indices={indices} /></ErrorBoundary>
          <ErrorBoundary name="MarketBreadth">
            <DeferUntilVisible minHeight={240}>
              <MarketBreadthCards />
            </DeferUntilVisible>
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
```
Notes: this preserves every existing className / `animationDelay` / prop. The only changes vs. the original are: `ErrorBoundary` wrappers, the `{ready ? (...) : <skeleton>}` gate around the stock-dependent block (was previously guarded by the now-removed full-page early return), and `DeferUntilVisible` around the TradingView timeline + `MarketBreadthCards`. The original `{activeStock && (...)}` guard on the fundamentals panel is replaced by the outer `ready` gate (equivalent — `ready` implies `activeStock`). Do not change `StockCardWithHistory` (below the component) or anything else in the file.

**Step 4 — Verify:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit && npm run build` — tsc 0; build `✓ built`. Fix within this file only until clean.

**Step 5 — Commit (only this file):**
```bash
git add src/components/layout/Dashboard.tsx
git -c core.safecrlf=false commit -m "feat: dashboard resilience — drop full-page spinner, per-widget ErrorBoundary, lazy embeds"
```

---

### Task 3: Final verification

**Step 1:** `npm test && npx tsc --noEmit && npm run build` — full suite still green (no test changes; nothing should regress), tsc 0, build ✓.

**Step 2 — static checks:**
- `grep -n "Loading dashboard" src/components/layout/Dashboard.tsx` → **no match** (full-page spinner gone).
- `grep -c "ErrorBoundary name=" src/components/layout/Dashboard.tsx` → ≥ 9 (YourSnapshot + the new wrappers).
- `grep -n "DeferUntilVisible" src/components/layout/Dashboard.tsx` → 2 usages (TradingView + breadth) + the import.
- `git diff --stat HEAD~2 HEAD` shows ONLY `src/components/common/DeferUntilVisible.tsx` (new) and `src/components/layout/Dashboard.tsx`.

**Step 3 — WIP untouched:** `git status --porcelain src/App.tsx src/components/layout/MobileShell.tsx src/components/layout/Sidebar.tsx src/pages/TradeJournal.tsx` shows only pre-existing ` M`; never staged by us; no `git add -A` used.

---

## Notes for the implementer
- No unit tests (no node-testable pure logic) — `ErrorBoundary` is already proven by prior use; `DeferUntilVisible` is DOM/IO UI. Verified by `tsc` + `build` + static read. Expected, not a gap. No server needed.
- The big `dashboardContent` replacement must keep **every** original className, `animationDelay`, and widget prop — the only diffs are wrappers + the `ready` gate + the two `DeferUntilVisible`. Do not "improve" markup.
- Hooks above the removed early-return must remain in the same order — only the `if (...) return <spinner>` block becomes `const ready = ...;`.
- `WATCHLIST_SYMBOLS`, `formatMarketCap`, `formatVolume`, `StockCardWithHistory`, `activeMarketCap`, `relativeVolume`, `chartDays`, `setSelectedStock`, `stocks`, `news`, `indices` are all already defined in scope — reuse, do not redeclare.
