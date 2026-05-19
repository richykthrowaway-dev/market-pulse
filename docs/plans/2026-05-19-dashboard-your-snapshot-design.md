# Dashboard "Your Snapshot" + Market Session — Design

**Date:** 2026-05-19
**Status:** Approved (design)
**Scope:** Dashboard home page (`/` → `Index` → `components/layout/Dashboard.tsx`).

## Goal

The home page is currently a generic market overview that says nothing about
how the *user* is doing. Add a personalized **"Your Snapshot"** strip at the
top (live open P&L, open risk, today/week realized P&L, win rate, streak) plus
a **US market-session** pill — composed almost entirely from already-shipped,
unit-tested pieces, and wrapped in the existing ErrorBoundary so it cannot
blank the dashboard.

## Constraints

- `src/components/layout/Dashboard.tsx` is editable (NOT user WIP).
- Do **not** modify user WIP: `src/App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`,
  `TradeJournal.tsx`, etc. The new strip lives inside `dashboardContent`,
  which already flows into both the desktop layout and `<MobileShell>` with
  no change to those files.
- Never `git add -A`; commits local until the user says push.
- No running server required for verification (keep port 8080 free): pure
  libs via Vitest `src/lib/**` node harness; UI via `tsc` + `build` + static
  review.

## Components & data

**New** `src/components/dashboard/YourSnapshot.tsx` (presentational +
hook-driven). Rendered as the first child of `dashboardContent` in
`Dashboard.tsx`, wrapped in `<ErrorBoundary name="YourSnapshot">`
(`@/components/common/ErrorBoundary`, already shipped).

Tiles (reuse existing hooks/libs — all shipped & tested):
1. **Open P&L** — `useOpenTrades()` positions × `useLiveQuotes(openSymbols, intervalMs)`
   (`useLiveSpeed` for interval), summed via `unrealizedPnl` (`@/lib/tradeMetrics`).
   Shows `N open`, green/red, links to `/trading`. Empty → "No open positions".
2. **Open risk** — `aggregateRisk(open, account)` (`@/lib/portfolioRisk`),
   account from `readRiskParams()` (`tp-risk-v1`). `$X · Y% acct`, red if over plan.
3. **Today realized** — `pnlOn(journalTrades, todayISO)` + win rate from
   `useTradeJournal().stats`.
4. **This week + streak** — `realizedPnL(journalTrades, sevenDaysAgoISO)` +
   `useTradeJournal().currentStreak` (e.g. `🔥 3W` / `3L`). Empty journal →
   "No trades logged" link to `/journal`.
5. **Market session pill** — `usMarketSession(new Date())` →
   `🟢 US open · closes 2h 14m` / `🔴 Closed · opens Mon 9:30`. Top-right of
   the strip.

The strip uses a compact responsive grid (reuse `StatsCard` where it fits, or
lightweight tiles consistent with the existing stats row styling). No new
network calls beyond the live-quote polling already used on Trading.

## New pure libs (TDD)

- `src/lib/journalWindows.ts` (+ `journalWindows.test.ts`)
  - `pnlOn(trades: TradeEntry[], dateISO: string): number` — Σ `computePnL`
    for `t.exitDate === dateISO`.
  - `realizedPnL(trades: TradeEntry[], sinceISO: string): number` — Σ
    `computePnL` for `t.exitDate >= sinceISO`.
  - Reuses `computePnL` from `@/lib/tradeMath`; never throws on partial data.
- `src/lib/marketSession.ts` (+ `marketSession.test.ts`)
  - `usMarketSession(now: Date): { open: boolean; label: string; minsToChange: number }`
  - Regular session America/New_York 09:30–16:00, Mon–Fri; weekend-aware
    "opens Mon"; pure (timezone via `toLocaleString`, like the existing
    `MarketTimeline` helper). Self-contained — does not import the WIP
    `Sidebar`/`MarketTimeline`.

## Testing

- `journalWindows` + `marketSession`: TDD, failing test first, in the
  `src/lib/**/*.test.ts` Vitest node harness (`npm test`).
- `YourSnapshot` + Dashboard wiring: `npx tsc --noEmit` + `npm run build` +
  static review. No browser/server needed.
- Whole strip sits inside the shipped per-widget ErrorBoundary and reads
  self-healed stores (`parseOpenTrades`/`parseJournal`) → cannot reintroduce
  the white-screen class.

## Out of scope (YAGNI)

Per-tile configuration, sparklines inside the strip, multi-market session
(US only), notifications, dashboard-wide resilience/skeleton refactor (a
separate possible bundle), "All Stocks → watchlist" (separate).

## Files

New: `src/components/dashboard/YourSnapshot.tsx`,
`src/lib/journalWindows.ts` (+test), `src/lib/marketSession.ts` (+test).
Modified: `src/components/layout/Dashboard.tsx` (import + render the
ErrorBoundary-wrapped strip at the top of `dashboardContent`).
Never touched: `App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `TradeJournal.tsx`.
