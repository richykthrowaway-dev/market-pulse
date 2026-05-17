# Trading Tab — Always-On Workspace Design

**Date:** 2026-05-17
**Status:** Approved (brainstorm)
**Page:** `src/pages/Trading.tsx`

## Goal

Make the Trading tab valuable whether or not the IBKR gateway is
connected. Today every panel except the Trade Tracker is IBKR-gated, so
an offline user sees a near-blank page. Restructure around an always-on,
broker-independent core; IBKR becomes a purely additive enhancement.

## Approach (chosen)

**A — Unified single-screen workspace.** One layout; IBKR connection
swaps the data source of the left panel and lights up account stats —
nothing relocates. Maximizes reuse of the live-monitoring infra already
built (`useLiveQuotes`, `useSymbolSearch`, `tradeMetrics`,
`fetchYahooQuote`/`fetchYahooChart`, `useOpenTrades`).

## Sections

### 1. Layout & always-on structure
Top→bottom: Header + ConnectionStatus → AccountStats (connected only) →
Trade Tracker (unchanged, always) → 3-column workspace (always shown):
- **Left (2 col):** tab strip — `Watchlist` (always), plus
  `Positions`/`Orders`/`Trades` (present only when IBKR connected).
  Offline default = Watchlist.
- **Right (1 col):** Chart panel (top) + Order Ticket (bottom).

Remove the page-level `isGatewayOffline` "hide everything" gate; each
IBKR-only piece self-gates. `GatewayGuide` becomes a dismissible inline
note inside the Watchlist tab.

### 2. Watchlist (broker-independent, always-on)
New component. Add symbols via `useSymbolSearch` autocomplete; persist to
`tp-watchlist-v1` via a `useSyncExternalStore` store mirroring
`useOpenTrades`. Live rows via existing `useLiveQuotes(symbols,
intervalMs)` (+ the 5s/30s speed-toggle pattern). Row = symbol, name,
last, day change $/%, sparkline from `fetchYahooChart(sym,'1d','1mo')`.
Row click selects the symbol (Chart + Order Ticket). Row actions: remove,
"→ Ticket". Empty state replaces the old blank offline screen.

### 3. Chart panel
Right-column card driven by the selected symbol. api-yahoo chart via
`fetchYahooChart` with a range toggle (1D/1M/3M/1Y), reusing the existing
chart component. If the selected symbol matches an open tracked trade,
overlay entry/stop/target lines (Wave 2 if Wave 1 grows large). No
selection → prompt.

### 4. Order Ticket (upgraded QuickOrder)
`useSymbolSearch` autocomplete (replaces blind `contracts[0]`); live
price via api-yahoo quote; risk preview reusing `tradeMetrics` +
`tp-risk-v1` ($ risk, R:R, % of account, position value) with optional
stop/target; explicit confirm step. IBKR connected → real order (+
contract-disambiguation dropdown when multiple results, Wave 2);
offline → primary action "Track in Trade Tracker" (writes shared
`useOpenTrades`). The ticket is never dead.

### 5. IBKR panel polish (connected only)
`LivePrices` resolves conids → symbols; Positions/Orders/Trades get a
totals row + client-side column sort. No schema changes.

### 6. Error handling & testing
Broker-independent features degrade gracefully (failed quote/chart →
"—"/"unavailable", never blocking); watchlist store quota-safe like
`useOpenTrades`; IBKR pieces keep existing error toasts. Pure logic
(risk-preview math, watchlist store add/remove/dedup) → vitest unit
tests in `src/lib`/hook. UI verified via `npm run build` + preview:
offline path (watchlist add → live quote + sparkline → select → chart →
ticket risk preview → Track → Journal) and connected path (self-gated
panels).

## Phasing (YAGNI)
- **Wave 1:** Sections 1–4 (offline-value core).
- **Wave 2:** Section 5 + chart line-overlays + contract disambiguation.

## Reuse (no new data layer for Wave 1)
`useLiveQuotes`, `useSymbolSearch`, `tradeMetrics`, `fetchYahooQuote`,
`fetchYahooChart`, `useOpenTrades`, the 5s/30s speed-toggle pattern, the
existing chart component.
