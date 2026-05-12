# Mobile View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic mobile-optimised viewing mode that activates when the browser width is < 768px, replacing the desktop sidebar+navbar shell with a slim top-bar + hamburger-triggered overlay drawer.

**Architecture:** `useIsMobile()` hook detects phone screens. `MobileShell` component provides the mobile app shell (slim top-bar, overlay sidebar drawer, full-width content). `PageLayout` uses `useIsMobile()` internally to render MobileShell on mobile and the existing desktop layout on desktop. `Dashboard.tsx` (the one page that manages its own layout) gets the same treatment. All per-page responsive tweaks are Tailwind-only — no logic changes.

**Tech Stack:** React, Tailwind CSS, Lucide icons, next-themes (`useTheme`), React Router (`useLocation`), existing `Sidebar` + `Navbar` components.

---

## Important Context

- **`Dashboard.tsx`** (`src/components/layout/Dashboard.tsx`) is used by `src/pages/Index.tsx` and has its OWN inline `<Navbar>` + `<Sidebar>` — it does **not** use `PageLayout`. It needs the same mobile treatment as PageLayout.
- All other 14 pages use `<PageLayout>` from `src/components/layout/PageLayout.tsx`.
- `Sidebar` currently requires: `isCollapsed`, `onToggle`, and optionally `portfolioFileName`, `portfolioMeta`, `onClearStatement`, `onFileUpload`, `isParsingFile`.
- On mobile the sidebar needs an `onNavigate` callback so nav links close the drawer. Add this as an optional prop to `Sidebar`.
- `PageLayout` accepts: `children`, `title`, `description?`, `canonical?`, `hideTitle?`.
- The breakpoint `768px` matches Tailwind `md:` — keeps JS and CSS in sync.

---

## Task 1: `useIsMobile` hook

**Files:**
- Create: `src/hooks/useIsMobile.ts`

**Step 1: Create the hook**

```ts
import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is narrower than 768px (Tailwind md: breakpoint).
 * Initialises synchronously from window.innerWidth to avoid a layout flash on mount.
 * Safe in SSR environments (defaults false when window is unavailable).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches); // sync in case it changed between render and effect
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
```

**Step 2: Verify it compiles**

```bash
cd C:\Users\PC\Downloads\market-pulse
npx tsc --noEmit
```
Expected: no errors related to `useIsMobile.ts`.

**Step 3: Commit**

```bash
git add src/hooks/useIsMobile.ts
git commit -m "feat: add useIsMobile hook (768px breakpoint, MediaQueryList)"
```

---

## Task 2: Add `onNavigate` prop to `Sidebar`

The sidebar's nav links need to close the mobile drawer when tapped.

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add optional prop to interface and call it on link click**

In `SidebarProps` interface (line 14), add:
```ts
/** Called after a nav item is clicked — used by MobileShell to close the drawer. */
onNavigate?: () => void;
```

In the function signature (line 25), add `onNavigate` to destructure:
```ts
export function Sidebar({ isCollapsed, onToggle, className, portfolioFileName, portfolioMeta, onClearStatement, onFileUpload, isParsingFile, onNavigate }: SidebarProps) {
```

In the `<Link>` element (around line 80), add onClick:
```tsx
<Link
  key={index}
  to={item.href}
  onClick={onNavigate}
  className={cn(
    "flex items-center gap-3 rounded-md px-3 py-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground",
    isCollapsed && "justify-center px-0"
  )}
>
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): add optional onNavigate callback for mobile drawer close"
```

---

## Task 3: Create `MobileShell` component

**Files:**
- Create: `src/components/layout/MobileShell.tsx`

**Step 1: Create the component**

```tsx
import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { useStatement } from '@/contexts/StatementContext';
import { cn } from '@/lib/utils';

interface MobileShellProps {
  children: React.ReactNode;
  title: string;
}

/** Route path → page title map (mirrors Sidebar navItems). */
const TITLE_MAP: Record<string, string> = {
  '/':                'Dashboard',
  '/stocks':          'Stocks',
  '/watchlists':      'Watchlists',
  '/markets':         'Markets',
  '/currencies':      'Currencies',
  '/global':          'Global',
  '/portfolio':       'Portfolio',
  '/performance':     'Performance',
  '/risk-analysis':   'Risk Analysis',
  '/analysis':        'Analysis',
  '/screener':        'Screener',
  '/trading':         'Trading',
  '/fee-calculators': 'Fee Calculators',
  '/journal':         'Journal',
  '/settings':        'Settings',
};

export function MobileShell({ children, title }: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  const location = useLocation();
  const pageTitle = TITLE_MAP[location.pathname] ?? title;

  const { parsedStatement, fileName, isParsingFile, handleFileUpload, clearStatement } = useStatement();
  const portfolioMeta = parsedStatement
    ? `${parsedStatement.meta.broker || 'Statement'} • ${parsedStatement.openPositions.length} pos`
    : null;

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur-sm z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <span className="font-semibold text-sm tracking-tight">{pageTitle}</span>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </header>

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 animate-fade-in">
          {children}
        </div>
      </main>

      {/* ── Drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar drawer ── */}
      <aside className={cn(
        "fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out",
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          isCollapsed={false}
          onToggle={() => setDrawerOpen(false)}
          onNavigate={() => setDrawerOpen(false)}
          portfolioFileName={fileName}
          portfolioMeta={portfolioMeta}
          onClearStatement={clearStatement}
          onFileUpload={handleFileUpload}
          isParsingFile={isParsingFile}
        />
      </aside>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/layout/MobileShell.tsx
git commit -m "feat: add MobileShell component (hamburger drawer, slim top-bar)"
```

---

## Task 4: Wire `MobileShell` into `PageLayout`

**Files:**
- Modify: `src/components/layout/PageLayout.tsx`

**Step 1: Import `useIsMobile` and `MobileShell`, add mobile branch**

Replace the entire file contents with:

```tsx
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileShell } from '@/components/layout/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStatement } from '@/contexts/StatementContext';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  /** Meta description for SEO */
  description?: string;
  /** Canonical path (e.g. "/portfolio") */
  canonical?: string;
  /** When true, suppresses the visible h1 heading */
  hideTitle?: boolean;
}

export function PageLayout({ children, title, description, canonical, hideTitle }: PageLayoutProps) {
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { parsedStatement, fileName, isParsingFile, handleFileUpload, clearStatement } = useStatement();

  // SEO meta tags
  useEffect(() => {
    if (description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = `${window.location.origin}${canonical}`;
    }
  }, [description, canonical]);

  const portfolioMeta = parsedStatement
    ? `${parsedStatement.meta.broker || 'Statement'} • ${parsedStatement.openPositions.length} pos • ${parsedStatement.trades.length} trades`
    : null;

  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileShell title={title}>
        {!hideTitle && <h1 className="text-xl font-bold mb-4">{title}</h1>}
        {children}
      </MobileShell>
    );
  }

  // ── Desktop layout (unchanged) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 flex">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          portfolioFileName={fileName}
          portfolioMeta={portfolioMeta}
          onClearStatement={clearStatement}
          onFileUpload={handleFileUpload}
          isParsingFile={isParsingFile}
        />

        <main className="flex-1 transition-all duration-300">
          <div className={`container max-w-full animate-fade-in ${hideTitle ? 'p-4 lg:p-4' : 'p-4 lg:p-6'}`}>
            {!hideTitle && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/layout/PageLayout.tsx
git commit -m "feat(PageLayout): auto-switch to MobileShell on screens < 768px"
```

---

## Task 5: Wire `MobileShell` into `Dashboard.tsx`

`Dashboard.tsx` is the only page that manages its own layout (does not use `PageLayout`). It renders `<Navbar>` and `<Sidebar>` directly.

**Files:**
- Modify: `src/components/layout/Dashboard.tsx`

**Step 1: Add imports at top of file (after existing imports)**

```tsx
import { MobileShell } from '@/components/layout/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
```

**Step 2: Add `isMobile` call inside the component**

Add after the `toggleSidebar` function (around line 141):
```tsx
const isMobile = useIsMobile();
```

**Step 3: Replace the return statement**

Find the existing return (around line 155):
```tsx
return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    
    <div className="flex-1 flex">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      
      <main className="flex-1 transition-all duration-300">
        <div className="container max-w-full p-4 lg:p-6 animate-fade-in">
          <h1 className="text-2xl font-bold mb-6 tracking-tight">
            Market Dashboard
          </h1>
          {/* ... rest of content ... */}
        </div>
      </main>
    </div>
  </div>
);
```

Wrap the inner content (everything INSIDE `<div className="container ...">`) in a fragment and add a mobile branch:

```tsx
const dashboardContent = (
  <>
    <h1 className="text-2xl font-bold mb-6 tracking-tight">Market Dashboard</h1>
    {/* Stats Row */}
    {/* ... (all existing JSX from inside the container div, unchanged) ... */}
  </>
);

if (isMobile) {
  return <MobileShell title="Dashboard">{dashboardContent}</MobileShell>;
}

return (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <div className="flex-1 flex">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      <main className="flex-1 transition-all duration-300">
        <div className="container max-w-full p-4 lg:p-6 animate-fade-in">
          {dashboardContent}
        </div>
      </main>
    </div>
  </div>
);
```

> **Note:** Do not move or restructure any of the existing content JSX. Just extract it into `dashboardContent` and add the `if (isMobile)` branch above the existing return.

**Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "feat(Dashboard): auto-switch to MobileShell on mobile screens"
```

---

## Task 6: Responsive tweaks — Dashboard card grid

The stats row and content grids in `Dashboard.tsx` already use responsive classes. Verify they look correct. The main issue on mobile is the stock card + chart side-by-side section (uses `flex flex-col lg:flex-row` which is already correct).

Check and fix if needed:
- Stats cards row: should be `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — already is (line ~169)
- Stock cards + chart: `flex-col lg:flex-row` — already is (line ~194)
- Chart height on mobile: find `<StockChart` and ensure its container has `h-48 md:h-64 lg:h-[500px]` or similar

If chart height is fixed/hardcoded, wrap it:
```tsx
<div className="h-64 md:h-96 lg:h-[500px]">
  <StockChart ... />
</div>
```

**Commit:**
```bash
git add src/components/layout/Dashboard.tsx
git commit -m "fix(Dashboard): cap chart height on mobile screens"
```

---

## Task 7: Responsive tweaks — Stocks page

**Files:**
- Modify: `src/pages/Stocks.tsx`

Key areas to check and fix:

1. **Stock list + chart side-by-side layout**: find the container div. If it uses `flex` without `flex-col`, add `flex-col md:flex-row`.

2. **Any fixed-height or fixed-width containers**: add mobile height cap where needed.

3. **Tables**: wrap any `<table>` elements in `<div className="overflow-x-auto">`.

After fixing, verify:
```bash
npx tsc --noEmit
```

**Commit:**
```bash
git add src/pages/Stocks.tsx
git commit -m "fix(Stocks): responsive layout for mobile screens"
```

---

## Task 8: Responsive tweaks — Markets & Currencies pages

**Files:**
- Modify: `src/pages/Markets.tsx`
- Modify: `src/pages/Currencies.tsx`

**Markets.tsx:**
- Find the index card grid. Ensure it uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- TradingView heatmap widget: wrap in `<div className="overflow-x-auto min-h-[300px]">`.

**Currencies.tsx:**
- Find currency card/row grid. Ensure `grid-cols-1 sm:grid-cols-2`.
- Any FX rate tables: wrap in `overflow-x-auto`.

Verify and commit:
```bash
npx tsc --noEmit
git add src/pages/Markets.tsx src/pages/Currencies.tsx
git commit -m "fix(Markets, Currencies): responsive grid and overflow for mobile"
```

---

## Task 9: Responsive tweaks — Portfolio & Performance pages

**Files:**
- Modify: `src/pages/Portfolio.tsx`
- Modify: `src/pages/Performance.tsx`

**Portfolio.tsx:**
- Any two-column layout (`grid-cols-2` or `flex` side-by-side): change to `grid-cols-1 md:grid-cols-2`.
- Pie/donut chart containers: add `max-w-xs mx-auto md:max-w-none` so charts don't overflow on mobile.
- Holdings table: wrap in `overflow-x-auto`.

**Performance.tsx:**
- Chart containers: ensure height is responsive (`h-48 md:h-64`).
- Metric cards grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

Verify and commit:
```bash
npx tsc --noEmit
git add src/pages/Portfolio.tsx src/pages/Performance.tsx
git commit -m "fix(Portfolio, Performance): responsive layout for mobile"
```

---

## Task 10: Responsive tweaks — Analysis, RiskAnalysis, Screener

**Files:**
- Modify: `src/pages/Analysis.tsx`
- Modify: `src/pages/RiskAnalysis.tsx`
- Modify: `src/pages/Screener.tsx`

**Common patterns to apply:**
- Two-panel side-by-side layouts → `flex-col md:flex-row`
- Correlation matrix / heatmap containers → `overflow-x-auto` wrapper
- Filter/control bars with many buttons → `flex-wrap gap-2`
- Data tables → `overflow-x-auto` wrapper
- Chart heights → `h-48 md:h-72`

Verify and commit:
```bash
npx tsc --noEmit
git add src/pages/Analysis.tsx src/pages/RiskAnalysis.tsx src/pages/Screener.tsx
git commit -m "fix(Analysis, RiskAnalysis, Screener): responsive tweaks for mobile"
```

---

## Task 11: Responsive tweaks — Global (Trade Infrastructure) page

**Files:**
- Modify: `src/pages/Global.tsx`

The Global page contains the 3D globe and trade route map — the heaviest page.

Key fixes:
- Globe/map container: `h-[60vh] md:h-[80vh] w-full`
- Side panels (commodity strip, route info): stack below globe on mobile with `flex-col md:flex-row`
- Any horizontal scrolling tabs or filter bars: `flex-wrap` or `overflow-x-auto`

Verify and commit:
```bash
npx tsc --noEmit
git add src/pages/Global.tsx
git commit -m "fix(Global): globe height cap and stacked panels for mobile"
```

---

## Task 12: Responsive tweaks — Remaining pages

**Files:**
- Modify: `src/pages/Watchlists.tsx`
- Modify: `src/pages/Trading.tsx`
- Modify: `src/pages/FeeCalculators.tsx`
- Modify: `src/pages/TradeJournal.tsx`
- Modify: `src/pages/Settings.tsx`

These pages are utility-oriented and generally narrower. Minimal changes needed:

**Watchlists.tsx:** Watchlist cards grid → `grid-cols-1 sm:grid-cols-2`.

**Trading.tsx:** Any trading panel side-by-side → `flex-col md:flex-row`. Order form inputs → `w-full`.

**FeeCalculators.tsx:** Calculator cards → `grid-cols-1 md:grid-cols-2`. Inputs → `w-full`.

**TradeJournal.tsx:** Journal table → `overflow-x-auto`. Filter row → `flex-wrap gap-2`.

**Settings.tsx:** Settings form → already narrow, likely fine. Inputs → `w-full`. Button groups → `flex-wrap`.

Verify and commit:
```bash
npx tsc --noEmit
git add src/pages/Watchlists.tsx src/pages/Trading.tsx src/pages/FeeCalculators.tsx src/pages/TradeJournal.tsx src/pages/Settings.tsx
git commit -m "fix(Watchlists, Trading, FeeCalculators, TradeJournal, Settings): mobile responsive tweaks"
```

---

## Task 13: Final build verification

**Step 1: Full TypeScript check**

```bash
cd C:\Users\PC\Downloads\market-pulse
npx tsc --noEmit
```
Expected: 0 errors.

**Step 2: Production build**

```bash
npm run build
```
Expected: build succeeds (chunk size warnings are OK, TS errors are not).

**Step 3: Dev server smoke test**

```bash
npm run dev
```

Open browser DevTools → Toggle device toolbar → Select iPhone SE (375px wide).

Verify on each page:
- [ ] Dashboard: top-bar shows ☰ and theme toggle; hamburger opens sidebar drawer; tapping nav link closes drawer
- [ ] Stocks: content stacks vertically, no horizontal overflow
- [ ] Markets: index cards stack, heatmap scrolls
- [ ] Portfolio: charts and tables fit within screen
- [ ] Global: globe capped at 60vh, panels stack below
- [ ] All pages: no content clipped outside screen edge

**Step 4: Desktop regression check**

Widen browser to 1280px. Verify sidebar + navbar still appear correctly on all pages.

**Step 5: Final commit if any last fixes were made**

```bash
git add -A
git commit -m "fix: final mobile polish after smoke test"
```

---

## Summary of New/Modified Files

| File | Change |
|------|--------|
| `src/hooks/useIsMobile.ts` | **NEW** — 768px MediaQueryList hook |
| `src/components/layout/MobileShell.tsx` | **NEW** — mobile app shell (top-bar + overlay drawer) |
| `src/components/layout/PageLayout.tsx` | Modified — uses `useIsMobile()`, renders MobileShell on mobile |
| `src/components/layout/Sidebar.tsx` | Modified — optional `onNavigate` prop on nav links |
| `src/components/layout/Dashboard.tsx` | Modified — uses `useIsMobile()`, renders MobileShell on mobile |
| `src/pages/Stocks.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Markets.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Currencies.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Portfolio.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Performance.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Analysis.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/RiskAnalysis.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Screener.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Global.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Watchlists.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Trading.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/FeeCalculators.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/TradeJournal.tsx` | Modified — Tailwind responsive classes only |
| `src/pages/Settings.tsx` | Modified — Tailwind responsive classes only |
