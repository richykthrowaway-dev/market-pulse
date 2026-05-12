# Mobile View Design — Market Pulse

**Date:** 2026-05-11
**Approach:** B — Mobile layout wrapper + `useIsMobile` hook

---

## Goal

Add a mobile-optimised viewing mode to Market Pulse. The site is currently desktop-only. On phones it should automatically switch to a mobile shell with a hamburger-triggered sidebar drawer. All 15 existing pages must work. Content is mobile-optimised (slight responsive tweaks only — no extreme architectural changes).

---

## Architecture

### New Files (3)

| File | Purpose |
|------|---------|
| `src/hooks/useIsMobile.ts` | ResizeObserver hook. Returns `true` when `window.innerWidth < 768`. Synchronous init (no layout flash). SSR-safe. |
| `src/components/layout/MobileShell.tsx` | Mobile app shell. Slim top bar (☰ + page title + theme icon), full-width content area, overlay sidebar drawer with backdrop. Replaces `PageLayout` on mobile. |
| *(modified)* `src/App.tsx` | Single `useIsMobile()` call. Swaps `PageLayout` → `MobileShell` for all 15 routes automatically. |

### Reused As-Is
- `src/components/layout/Sidebar.tsx` — rendered inside `MobileShell` as overlay drawer
- `src/components/layout/Navbar.tsx` — **not** used in `MobileShell` (replaced by slim top bar)
- All 15 page components — unchanged except Tailwind class tweaks

---

## Component Design

### `useIsMobile.ts`
- Breakpoint: `768px` (matches Tailwind `md:`)
- Initialises from `window.innerWidth` synchronously before first render
- Uses `ResizeObserver` (or `window.resize` event) for live updates
- Cleans up on unmount

### `MobileShell.tsx`
```
<div class="flex flex-col h-screen overflow-hidden">
  <header class="h-14 flex items-center px-4 border-b shrink-0">
    <button onClick={openSidebar}>☰</button>
    <span class="flex-1 text-center font-semibold">{pageTitle}</span>
    <ThemeToggle />
  </header>

  <main class="flex-1 overflow-y-auto p-4">
    <Outlet />
  </main>

  {/* Sidebar overlay */}
  {sidebarOpen && (
    <div class="fixed inset-0 z-40 bg-black/50" onClick={closeSidebar} />
    <aside class="fixed left-0 top-0 h-full w-56 z-50 bg-background">
      <Sidebar onNavigate={closeSidebar} />
    </aside>
  )}
</div>
```

### `App.tsx` change
```tsx
const isMobile = useIsMobile();
const Shell = isMobile ? MobileShell : PageLayout;
// Replace <PageLayout> wrapper with <Shell> in route tree
```

---

## Per-Page Responsive Tweaks (Tailwind-only)

### Pattern A — Card grids
```
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```
Applied to: Dashboard, Markets, Currencies, Watchlists

### Pattern B — Data tables
```
<div class="overflow-x-auto">
  <table class="min-w-[600px]"> ... </table>
</div>
```
Applied to: Stocks, Screener, TradeJournal, Trading

### Pattern C — Two-panel layouts
```
flex flex-col md:flex-row
```
Applied to: Portfolio, Performance, RiskAnalysis, Analysis

### Pattern D — Charts
```
h-48 md:h-64 lg:h-80
```
Applied across all chart containers

### Pattern E — Global/Trade map
```
h-[60vh] w-full
```
Globe/map container; side panels stack below (`flex-col`)

### Pattern F — Form/utility pages
```
w-full  (inputs)
flex flex-col sm:flex-row  (button groups)
```
Applied to: Settings, FeeCalculators

---

## Auto-Detection

`useIsMobile()` reads `window.innerWidth` synchronously on mount — no flash of wrong layout. On resize, updates reactively. The `< 768px` threshold aligns with Tailwind's `md:` breakpoint so CSS and JS stay in sync.

---

## What Does NOT Change

- All page logic, data fetching, React Query hooks
- Supabase edge functions
- Route structure in `App.tsx` (routes stay the same, only shell swaps)
- `Sidebar.tsx` internals (just receives a `onNavigate` close callback)
- Desktop layout (zero regression risk — `PageLayout` untouched)

---

## Pages Covered

1. Dashboard
2. Stocks
3. Watchlists
4. Markets
5. Currencies
6. Global (Trade Infrastructure)
7. Portfolio
8. Performance
9. RiskAnalysis
10. Analysis
11. Screener
12. Trading
13. FeeCalculators
14. TradeJournal
15. Settings
