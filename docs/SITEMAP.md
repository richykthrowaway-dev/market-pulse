# MarketPulse — Developer Site Map

> Auto-generated from source code analysis. Last updated: 2026-05-19.
> Every route, section, widget, interactive control, and data source.

---

## Table of Contents

1. [Global Chrome](#global-chrome)
2. [`/` — Dashboard](#---dashboard)
3. [`/stocks` — Stock Browser](#stocks---stock-browser)
4. [`/watchlists` — Watchlist Manager](#watchlists---watchlist-manager)
5. [`/markets` — Global Markets](#markets---global-markets)
6. [`/currencies` — Currencies](#currencies---currencies)
7. [`/global` — Global Trade & Risk](#global---global-trade--risk)
8. [`/portfolio` — Portfolio](#portfolio---portfolio)
9. [`/performance` — Performance](#performance---performance)
10. [`/risk-analysis` — Risk Analysis](#risk-analysis---risk-analysis)
11. [`/analysis` — Market Analysis](#analysis---market-analysis)
12. [`/screener` — Screener](#screener---screener)
13. [`/trading` — Live Trading](#trading---live-trading)
14. [`/calculators` — Calculators](#calculators---calculators)
15. [`/journal` — Trade Journal](#journal---trade-journal)
16. [`/trading-plan` — My Trading Plan](#trading-plan---my-trading-plan)
17. [`/learn` — Learn](#learn---learn)
18. [`/settings` — Settings](#settings---settings)
19. [`*` — Not Found](#---not-found)
20. [Key Architecture Patterns](#key-architecture-patterns)

---

## Global Chrome

### Sidebar (`src/components/layout/Sidebar.tsx`)

Collapsible left nav, 224px expanded / 64px collapsed. Persists collapse state.

| Control | Behaviour |
|---|---|
| Collapse/expand toggle (ChevronLeft/Right) | Toggles `isCollapsed` state; icons only in collapsed mode |
| 17 nav links (active highlight) | React Router `<Link>` with `useLocation` active detection |
| MarketTimeline strip (expanded only) | Shows current market session pill; hides when collapsed |
| Portfolio file upload widget (expanded + `/portfolio` only) | `<input type="file">` → `onFileUpload()` → IBKR CSV parse; shows filename + meta; X to clear |

**Nav items in order:**
Dashboard · Stocks · Watchlists · Markets · Currencies · Global · Portfolio · Performance · Risk Analysis · Analysis · Screener · Trading · Calculators · Journal · My Trading Plan · Learn · Settings

### MobileShell (`src/components/layout/MobileShell.tsx`)

Drawer-based mobile nav. Renders Sidebar inside a slide-in sheet; `onNavigate` closes drawer on link click.

### Navbar / PageLayout

Sticky top bar (64px). Contains: MarketPulse logo/title, optional slot content via `NavbarSlotContext`, theme toggle.

---

## `/` — Dashboard

**File:** `src/pages/Index.tsx` → `src/components/layout/Dashboard.tsx`  
**Layout:** Vertically-scrolling single-column. Left/centre column for stocks+charts; right column for news, alerts, movers.

### Widgets & Sections

| Widget / Card | Interactive Controls | Data Hook / Source |
|---|---|---|
| **YourSnapshot strip** | Net liquidation value, timeframe context, market-session pill | `usePortfolio()`, `useStatement()`, `useMarketSession()` |
| **Market Stats Row** | Display: Market Cap, Volume, Top Movers count | `useIndices()`, `useStocks()` |
| **List source selector** | Button group: All Stocks / Watchlist; watchlist dropdown to pick list | `useWatchlists()`, `listSource` state |
| **Stock search + add** | Text input to filter or add to watchlist (watchlist mode only) | `useWatchlist().add()` |
| **Stock Card List** | Click to select; hover ✕ overlay removes from watchlist (watchlist mode); sparkline expand/minimize; pin/unpin | `useStocks()`, `useWatchlist()`, `useSparklineData()` |
| **StockChart** | Range buttons 1W/1M/3M/1Y/All; symbol/name/price display | `useEodhdBarsForChart()` |
| **Fundamentals Panel** | Display: P/E, EPS, dividend, beta; 52-week range slider below | `useEodhdStock()`, `use52Week()` |
| **52-Week Range Bar** | Visual slider: 52W low → current → 52W high | `use52Week()` (api-52week edge fn) |
| **Symbol Notes** | Textarea: free-form per-symbol notes; persisted to localStorage | `localStorage` (`dash-notes-v1`) via `parseNotes` / `setNote` |
| **Earnings Strip** | Upcoming earnings for watchlist holdings, labelled Today/Tomorrow/in Nd | `useEarningsCalendar()` (api-finnhub `calendar-earnings`) |
| **Watchlist Heatmap** | Colour-coded grid of watchlist stocks by % change intensity (0–4) | Derived: `watchlistHeatmap()` from `useStocks()` |
| **Sector Exposure Bar** | Stacked proportional bar by GICS sector; concentration score + label | `sectorExposure()` + `concentrationScore()` via `getStaticSector()` |
| **News Mood Strip** | Bull/Bear/Neutral counts + net score from headlines | `useNews()` → `newsMood()` → `headlineSentiment()` |
| **NewsCard** | Scrollable article list with title, source, timestamp | `useNews()` (Finnhub api-news) |
| **Top Stories** | TradingView Timeline embed | TradingViewTimeline widget |
| **Price Alerts Card** | Symbol input, target price, above/below direction toggle, Add button; triggered alerts highlighted; Remove (✕) per alert | `localStorage` (`dash-price-alerts-v1`) via `parseAlerts` / `evaluateAlerts` |
| **Gap Movers Card** | Top 3 stocks by absolute % change across all loaded stocks | `topMovers()` from `useStocks()` |
| **MarketOverviewCard** | Advancing/declining/unchanged breadth stats | `useIndices()` |
| **Market Heatmap (TradingView)** | Embedded S&P 500 heatmap | TradingViewHeatmap(`SPX500`) |

### URL Params

| Param | Effect |
|---|---|
| `?sym=AAPL` | Pre-selects stock in the card list on load |

### Notes

- Every card is wrapped in `<ErrorBoundary>` — one card throwing won't crash the page.
- Below-fold embeds (TradingView, NewsCard) use `<DeferUntilVisible>` (`IntersectionObserver`) to defer mount until scrolled into view.
- Watchlist-mode: add via input, remove via hover ✕ overlay (stopPropagation so card click-through still selects the stock for the chart).
- Movers callout appears only when `listSource === 'watchlist'` and at least one stock resolved — shows best/worst from `watchlistMovers()`.

---

## `/stocks` — Stock Browser

**File:** `src/pages/Stocks.tsx`  
**Layout:** 3-column grid (lg). Left: searchable stock list. Right 2/3: chart + TradingView advanced chart.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Stock list header** | "All Stocks" sticky title | — |
| **Search / promote** | Text input; matching stock floated to top | `useStocks()` |
| **Stock cards** (first 8 eager, rest lazy) | Click to select; expand/minimize sparkline; remove (✕) | `useStocks()`, `useSparklineData()` |
| **Pinned external stocks** | Remove (✕) per card | `useEodhdStock(symbol, exchange)` |
| **StockChart** | Range buttons 1W/1M/3M/1Y/All; symbol + price display | `useEodhdBarsForChart()` |
| **TradingView Advanced Chart** | Full-featured chart widget; range synced via `daysToTvRange()` | TradingViewChart (lazy, code-split) |

### URL Params

| Param | Effect |
|---|---|
| `?symbol=AAPL&exchange=US&name=Apple+Inc` | Loads an external (non-Supabase) stock as a pinned card |

---

## `/watchlists` — Watchlist Manager

**File:** `src/pages/Watchlists.tsx`  
**Layout:** 2-panel horizontal split. Left sidebar 208px (collapsible). Right: stock table.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Left sidebar header** | Star icon + "Watchlists" label; "+" create new list button | — |
| **New list input** | Text input, Add button, Cancel (✕) | `createList(name)` |
| **Watchlist items** | Click to select; hover Trash to delete; count badge | `useWatchlists()` |
| **Sidebar footer** | Total stocks + total lists count | Computed |
| **Right panel header** | Collapse/expand sidebar; inline editable list name (pencil → Enter/Esc); stock count; stock search to add | `StockSearch` component |
| **Column header controls** | Sparkline expand/minimize; show/hide (Eye/EyeOff); period pills 7D/30D/60D/90D/120D/1Y | Toggle state |
| **Stock rows** | Logo + ticker + exchange badge; 6 sparklines; price; change %; change $; market cap; move-to-list dropdown; external link; remove | `useEodhdStock()`, `useIntradaySparkline()`, `useSparklineData()` |
| **NewsCard** | Scrollable news below list for watchlist symbols | `useNews()` (Finnhub) |

### Notes

- 7D/30D: hourly bars via `useIntradaySparkline` (Yahoo Finance). 60D–1Y: daily bars sliced client-side via `useSparklineData`.
- Move-to-list dropdown appears on hover.

---

## `/markets` — Global Markets

**File:** `src/pages/Markets.tsx`  
**Layout:** Full-viewport locked (body overflow hidden). Two stacked heatmaps + index card grid below.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **S&P 500 Heatmap** | Display only | TradingViewHeatmap(`SPX500`) |
| **ETF Heatmap** | Display only | TradingViewEtfHeatmap |
| **Index Cards** (up to 12) | Display: flag, region, index name, value, change%, last-update | `useIndices()` (Supabase) |

### Notes

- `useHeatmapHeight()` computes heatmap height dynamically: `(viewport − 224px) / 2`.
- Region ordering via `REGION_ORDER` array; unknowns sort to end.
- Skeleton cards animate with `pulse-gentle` while loading.

---

## `/currencies` — Currencies

**File:** `src/pages/Currencies.tsx`  
**Layout:** Single-column scrollable: Popular Pairs → Converter → TradingView Cross-Rates → TradingView Forex Heatmap.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Popular Pairs Grid** | Display: pair, flag icons, rate (4dp), change (4dp), change%, directional arrow | `useCurrencyRates()` → `getRate(from, to)` |
| **Currency Converter** | From/To currency dropdowns; amount input; Swap button; result display | `useCurrencyRates()` → `convert()` |
| **Forex Cross Rates** | Display only (TradingView embed) | TradingViewForexRates widget |
| **Forex Heatmap** | Display only (TradingView embed) | TradingViewForexHeatmap widget |

### Notes

- Rates via `api-fx-rates` edge function (19 FX pairs, Yahoo Finance, 3-strategy fallback).
- Error state shows retry message; loading state shows spinner.

---

## `/global` — Global Trade & Risk

**File:** `src/pages/Global.tsx`  
**Layout:** 50/50 viewport split. Left: 3D globe or flat SVG map. Right: country detail panel with tabs.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **3D Globe / Flat Map** | Toggle flat map; spin toggle; day/night cycle toggle; performance mode; country colors; mode selector (Flags / Performance / Exchanges) | Globe internal state; TopoJSON map data |
| **Layer toggles** | Checkboxes: seaports, maritime routes, airports, chokepoints, live vessels, live flights, conflict events, earthquakes, natural events, economic events, pipelines, sanctions, LPI scores, port congestion, commodity flows, trade partner arcs | `useAISStream()`, `useOpenSkyFlights()`, `useConflictEvents()`, `useEarthquakes()`, `useNaturalEvents()`, `useEconomicEvents()`, `useMacroHeatmap()`, `useTradeBreakdown()` |
| **Country Detail Panel** | Click country on map to populate; tabs: Trade / Economy / Exchanges | Computed from selected country + above hooks |
| **Risk Overlay** | Chokepoint risk scoring visualization | Custom risk calc on infrastructure data |

### Notes

- >1000-line file; heavy `useMemo` throughout.
- AIS vessels: real-time WebSocket. Flights: real-time polling.
- 3D library (Three.js ~1.7 MB) is lazy-loaded — only downloaded on first visit.

---

## `/portfolio` — Portfolio

**File:** `src/pages/Portfolio.tsx`  
**Layout:** Summary row → pie chart → sortable holdings table → AllocationExplorer → CorrelationMatrix.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **NAV Summary Card** | Timeframe buttons: 1W/MTD/1M/3M/YTD/1Y/All | `usePortfolio()`, `useStatement()` |
| **P&L Timeframe Card** | Timeframe buttons; sparkline | `usePortfolioPrices()` |
| **Market Cap Pie** | Display only | `usePortfolio()` |
| **Holdings Table** | Sort toggle (P&L); columns: Ticker, Shares, Cost, Market Value, P&L $, P&L %, 52W %, Target %, Distance to Target, Stop %, Distance to Stop, Analyst Rating, Trade Style. Connect / Sync (SnapTrade) buttons. Collapse/expand rows. | `usePortfolio()`, `use52Week()`, `useAnalystRatings()`, `useSnapTradeSync()`, `useConnectBrokerage()` |
| **Allocation Explorer** | Tabs: Position / Sector / Sub-Industry / Country / Market Cap / Style; collapse/expand | Internal tab state |
| **Correlation Matrix** | Heatmap; click to drill into pairs | `usePortfolioPrices()` → correlations |

### Notes

- Portfolio data: Supabase. Prices: EODHD. Analyst ratings: Finnhub. Brokerage sync: SnapTrade OAuth.

---

## `/performance` — Performance

**File:** `src/pages/Performance.tsx`  
**Layout:** Control bar → KPI grid → equity curve → drawdown chart → performance table → attribution → correlation matrix.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Benchmark selector** | Dropdown: SPY / QQQ / IWDA / etc. | `usePerformanceMetrics(benchmark)` |
| **Date range pills** | Buttons: 1Y (default) / 3Y / Max | State |
| **PerformanceKpiGrid** | Display: Total Return, Annualized Return, Sharpe, Max Drawdown, Win Rate, Best Day, Worst Day, Avg Win, Avg Loss, Beta, Alpha | `usePerformanceMetrics()` |
| **EquityCurveChart** | Line chart portfolio vs benchmark; legend toggle | `usePerformanceMetrics()` → `equityCurve` |
| **DrawdownChart** | Area chart cumulative drawdown from peak | `usePerformanceMetrics()` → `drawdownData` |
| **PerformanceTable** | Mode toggle: Returns / Attribution; columns vary by mode | `usePerformanceMetrics()` → `periods` |
| **AttributionSection** | Grouping toggle: Sector / Position; stacked bar or table | `usePerformanceMetrics()` → `attribution` |
| **CorrelationMatrix** | Heatmap | `usePerformanceMetrics()` → `correlations` |

### Notes

- Empty state: icon + message + link to `/portfolio`.
- Error state: message + Retry button.

---

## `/risk-analysis` — Risk Analysis

**File:** `src/pages/RiskAnalysis.tsx`  
**Layout:** Single-column scrollable. Multiple risk dimension cards.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Composite Risk Score** | Display: 0–100 gauge | `usePortfolio()` + custom risk calculation |
| **Risk Metrics Pie** | Breakdown by type (concentration, sector, country, currency, liquidity, leverage); holdings list sorted by risk contribution | Custom risk scoring |
| **Concentration Risk Card** | Herfindahl index, top-5 %, position warnings | `usePortfolio()`, `useStatement()` |
| **Country Exposure Card** | Stacked bar by country | `usePortfolio()` + country mapping |
| **Portfolio Beta Graph** | Horizontal bar chart by sector | `useBeta()` per holding (api-beta edge fn) |
| **Value at Risk (VaR) Card** | 95% VaR (1-day), CVaR in $ and % | Custom VaR calc from prices + volatility |
| **Historical Drawdown Card** | Max drawdown %, recovery time, largest drawdown period | `usePortfolioPrices()` |
| **Sector Crash Scenarios** | Table: sector, weight, 10/20/30% decline impact | `usePortfolio()` + stress simulation |
| **Market Position Widget** | Long/short/net exposure, leverage ratio | `usePortfolio()` |
| **Rebalancing Widget** | Target allocations, drift, rebalance recommendations | `usePortfolio()` |
| **Stress Test Section** | Sliders: market down X%, volatility up X%, rates up X%; real-time P&L impact | Custom scenario engine |

---

## `/analysis` — Market Analysis

**File:** `src/pages/Analysis.tsx`  
**Layout:** Single-column scrollable. Fundamentals lookup → heatmap → sector ETFs → technical analysis → treemap → breadth → screeners.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **FundamentalsLookup** | Symbol search input; displays P/E, EPS, dividend, beta, market cap | Finnhub API via `FundamentalsLookup` component |
| **NASDAQ 100 Heatmap** | Display only | TradingViewHeatmap(`NASDAQ100`) |
| **Sector ETF Bar Chart** | Display: 11 SPDR ETFs sorted by % change (XLK, XLV, XLF, XLY, XLP, XLE, XLB, XLU, XLI, XLRE, XLC) | `useSectorETFQuotes()` (Finnhub; stale 60s) |
| **Technical Analysis** | TradingView TA widget for S&P 500 | TradingViewTechnicalAnalysis embed |
| **Stock Treemap** | Top 50 by market cap; colour by % change; size by market cap; click shows ticker + change% | `useTopStocksByMarketCap(300)` + custom TreemapCell |
| **Market Breadth Stats** | Advancing/declining/unchanged counts, A/D ratio, average gains/losses | Computed from `useTopStocksByMarketCap()` |
| **Stock Screener (Most Capitalized)** | TradingView screener widget with toolbar; default: overview column | TradingViewScreener(`most_capitalized`) |
| **Stock Screener (Top Gainers)** | TradingView screener widget | TradingViewScreener(`top_gainers`) |

---

## `/screener` — Screener

**File:** `src/pages/Screener.tsx`  
**Layout:** Tab strip → tab content. Tab 1: Screener. Tab 2: Economic Calendar.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Tab: Screener** | Default active tab | — |
| ↳ StockSearch bar | Text input + autocomplete dropdown; selects symbol | `StockSearch` component |
| ↳ TradingView Screener | Embedded widget; default: most_capitalized; toolbar enabled | TradingViewScreener (america) |
| **Tab: Economic Calendar** | Switch to calendar tab | — |
| ↳ TradingView Economic Calendar | Importance filter: all levels; height: 600px | TradingViewEconomicCalendar |

---

## `/trading` — Live Trading

**File:** `src/pages/Trading.tsx`  
**Layout:** Connection status bar → AccountStats row → horizontal tabs + chart → sticky right panel (LivePrices + QuickOrder).

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **ConnectionStatus** | Reconnect button; indicator icon | `useIBKRAuthStatus()` |
| **AccountStats Row** | Display: Net Liquidation, Daily P&L, Unrealized P&L, Buying Power | `useIBKRAccounts()`, `useIBKRPnL()`, `useIBKRPortfolioSummary()` |
| **Tab: Watchlist** | Stock cards with prices, change, sparkline | `useStocks()` |
| **Tab: Positions** | Sortable table: Symbol, Shares, Avg Cost, Current Price, Position Value, Unrealized P&L, P&L %, Market Value; click row to select | `useIBKRPositions()` |
| **Tab: Orders** | Table: Order ID, Symbol, Type, Quantity, Price, Status, Timestamp; Cancel button per row | `useIBKROrders()`, `useIBKRCancelOrder()` |
| **Tab: Trades** | Table: Trade ID, Symbol, Quantity, Entry, Exit, P&L, P&L %, Duration | `useIBKRTrades()` |
| **SymbolChart** | Range buttons 1D/1W/1M/3M/1Y; price + volume axes | `useEodhdBarsForChart()` for selected symbol |
| **LivePrices Card** (sticky right) | Scrollable bid/ask/last per open position; real-time updates | `useIBKRSnapshot()` |
| **QuickOrder Form** (sticky right) | Symbol autocomplete; Buy/Sell toggle; Order type: Market/Limit/Stop; Quantity stepper; Entry/Stop/Target inputs with % quick-fill buttons; Risk preview (R:R, $ at risk, position value); over-risk warning; Place Order button | `useSymbolSearch()`, `fetchYahooQuote()`, `useIBKRPlaceOrder()` |

### Notes

- Risk preview formula: `$ at risk = |entry − stop| × qty`; `R:R = (target − entry) / (entry − stop)`. Over-risk warning if `$ at risk > buying power × 2%`.
- TradeTracker integration: monitors open trades, tracks stop/target crossing, plan adherence.

---

## `/calculators` — Calculators

**File:** `src/pages/Calculators.tsx`  
**Layout:** Left category sidebar (icon + label) + right calculator panel. URL hash preserves active calculator.

### Categories & Calculators

| Category | Calculators |
|---|---|
| **Wealth Building** | Compound Interest, Dollar-Cost Averaging, FIRE / Retirement, Mortgage vs Invest, Roth vs Traditional, Inflation-Adjusted, Asset Allocation |
| **Trading** | Position Sizing, Risk / Reward, Margin & Leverage, Short Selling, Drawdown Recovery, Trade Expectancy, Kelly Criterion, Pyramiding |
| **Options** | Options P&L, Covered Call, Cash-Secured Put, Vertical Spread, Black-Scholes |
| **Real Estate** | Rental Cash Flow |
| **Tax & Cost** | Capital Gains Tax, Tax-Loss Harvesting, Cost Basis Methods |
| **Income** | Dividend Projector, Dividend Growth Model |
| **Fees** | Advisor / Manager Fee, MER / Fund Expenses, All-In Comparison |

### Controls

| Control | Behaviour |
|---|---|
| Category sidebar links | Click to expand category; highlights active item |
| Calculator panel | Each calculator is a self-contained component with its own inputs/outputs |
| URL hash | `#kelly-criterion`, `#black-scholes`, etc. — shareable deep links; survives refresh |

### Notes

- `getActiveId()` reads `window.location.hash` on mount; `hashchange` event syncs state. Default: `compound-interest`.
- Legacy redirect: `/fee-calculators` → `/calculators` (React Router `<Navigate>`).

---

## `/journal` — Trade Journal

**File:** `src/pages/TradeJournal.tsx`  
**Layout:** Table of journal entries + entry detail panel.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Journal entries table** | Sort by date/symbol/P&L; click row to expand detail | `useTradeJournal()` (localStorage `trade-journal-v1`) |
| **Entry detail panel** | Display: symbol, direction, entry/exit, P&L, duration, plan adherence score, notes | Same hook |
| **Add/edit form** | Symbol, direction, entry price, exit price, qty, date, notes inputs; Save / Cancel buttons | `useTradeJournal().addEntry()` / `.updateEntry()` |
| **Filter bar** | Symbol filter, date range, direction filter, P&L filter | Local filter state |
| **Stats summary** | Win rate, avg P&L, total trades, best/worst trade | Computed from journal entries |

### Notes

- All data in localStorage; `parseJournal()` is self-healing (bad JSON → `[]`).
- `addTrade()` returns the new entry id for downstream linking.
- "Closed trade" records from Trading page auto-populate journal via shared hook.

---

## `/trading-plan` — My Trading Plan

**File:** `src/pages/TradingPlan.tsx`  
**Layout:** Three editorial sections with custom serif/mono typography. All state persisted in localStorage.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Setup Quality Grading Rubric** | Interactive grade calculator; editable rubric criteria items (add/edit/delete/reorder via ▲▼) | `usePersistentState('tp-rubric', [...])` |
| **Market Regime Recognition** | Framework selector; editable regime criteria list; reorder with ▲▼ buttons | `usePersistentState('tp-regimes', [...])` |
| **Fit-to-Trade Daily Check** | Checkbox list; editable questions (add/edit/delete/reorder); day-scoped state resets daily | `usePersistentState('tp-fit-' + todayKey(), {})` |
| **Pre-Trade Checklist** | Checkbox list; editable items | `usePersistentState('tp-pretrade', [...])` |
| **Mistake Tracker** | Editable mistake category list; frequency counters; reset button | `usePersistentState('tp-mistakes', [...])` |
| **Add item inputs** | Text input + Add button per list; Enter key submits | Local draft state per list |
| **Reset to defaults** | Confirm dialog → restores factory defaults for that section | `confirm()` → `onReset()` callback |

### Notes

- `usePersistentState<T>(key, initial)` is a local hook: lazy-init reads localStorage; writes on every value change.
- Scoped CSS via injected `<style>` tag using `--tp-*` CSS custom properties mapped onto site HSL design tokens.
- Fonts: Instrument Serif (headings), JetBrains Mono (labels), Newsreader (body) loaded from Google Fonts.

---

## `/learn` — Learn

**File:** `src/pages/Learn/index.tsx`  
**Layout:** Search bar + tab strip (Explore / Learning Paths / Bookmarks) → article grid → article reader panel.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Search bar** | Text input with X clear button; filters articles by title/tags | Local `query` state |
| **Tab: Explore** | Category filter chips; article cards grid with difficulty badge, read-time, bookmark toggle | `getArticlesByCategory()`, `categories` static data |
| **Tab: Learning Paths** | Path cards with progress bar (read articles / total); Start / Continue button | `paths` static data + `readIds` set |
| **Tab: Bookmarks** | Grid of bookmarked articles; same card format as Explore | `bookmarkIds` set from localStorage |
| **Article Reader** | Renders `ContentBlock[]` array: paragraphs, headings, formulas (with variable key), examples (with numbers grid), callouts (tip/warning/info), lists, key-points, quiz; Prev/Next navigation; Back button; bookmark toggle; mark-read on open | `getArticleById()` static data |
| **Quiz blocks** | Multiple-choice buttons; one attempt per session; shows correct/incorrect feedback | Local `quizStates` map keyed by `articleId + question` |
| **"Continue where you left off" banner** | Shows last-read article; link to reopen | `lastRead` from localStorage |

### Persistence (localStorage)

| Key | Content |
|---|---|
| `learn-read` | JSON array of read article IDs |
| `learn-bookmarks` | JSON array of bookmarked article IDs |
| `learn-lastread` | `{ id, ts }` object for "continue" banner |

### Notes

- Zero Supabase dependency; works for anonymous users.
- `LearnErrorBoundary` (class component) wraps the whole page.
- Article data lives in `src/pages/Learn/data/` (articles, categories, paths, types).

---

## `/settings` — Settings

**File:** `src/pages/Settings.tsx`  
**Layout:** 1/3 left nav sidebar + 2/3 main content. Currently one active section: Account Settings.

### Sections

| Section | Controls | Data Hook / Source |
|---|---|---|
| **Settings sidebar nav** | Ghost buttons: Account, Notifications, Security, Regional Settings, Preferences (visual only; no routing yet) | — |
| **Account Settings — Personal Information** | First Name input, Last Name input; Email (read-only, disabled); Phone input; Save Changes button; Cancel button; save status indicator (idle / saving / saved / error) | `supabase.auth.getUser()` / `supabase.auth.updateUser()` |
| **Theme toggle** | Light / Dark / System via `next-themes` `setTheme()` | `useTheme()` + `resolvedTheme` |

### Notes

- Anonymous users see a "browsing as guest" message instead of the personal info form.
- Email is read-only — changing it requires re-verification via Supabase auth flow.
- `dirty` flag tracks unsaved changes; Cancel re-seeds form from current auth state.
- Save uses `supabase.auth.updateUser({ data: {...} })` writing to `user_metadata`.

---

## `*` — Not Found

**File:** `src/pages/NotFound.tsx`  
Simple 404 page. "Go back home" link to `/`.

---

## Key Architecture Patterns

### Routing

```
App.tsx
└── React Router <BrowserRouter>
    └── <MobilePreviewFrame>
        └── <Suspense fallback={spinner}>
            └── <Routes>
                ├── /              → Index → Dashboard
                ├── /stocks        → Stocks
                ├── /watchlists    → Watchlists
                ├── /markets       → Markets
                ├── /currencies    → Currencies
                ├── /global        → Global
                ├── /portfolio     → Portfolio
                ├── /performance   → Performance
                ├── /risk-analysis → RiskAnalysis
                ├── /analysis      → Analysis
                ├── /screener      → Screener
                ├── /trading       → Trading
                ├── /fee-calculators → redirect → /calculators
                ├── /calculators   → Calculators
                ├── /journal       → TradeJournal
                ├── /trading-plan  → TradingPlan
                ├── /learn         → Learn
                ├── /settings      → Settings
                └── *              → NotFound
```

All page imports are `React.lazy()` — each route is a separate async Vite chunk.

### Provider Stack (outermost → innermost)

```
ThemeProvider (next-themes)
└── QueryClientProvider (TanStack Query)
    └── TooltipProvider
        └── TradingViewProvider
            └── StatementProvider
                └── NavbarSlotProvider
```

### Data Layer Summary

| Source | Used For | Hook Pattern |
|---|---|---|
| **Supabase** | Stocks, indices, watchlists, portfolio, auth | `useStocks()`, `useWatchlists()`, `usePortfolio()` |
| **EODHD** | Price history, fundamentals, ohlcv bars | `useEodhdBarsForChart()`, `useEodhdStock()` |
| **Finnhub** (via edge fn) | Quotes, news, analyst ratings, earnings calendar | `useNews()`, `useEarningsCalendar()`, `useSectorETFQuotes()` |
| **Yahoo Finance** (via edge fns) | 52-week range, beta, intraday sparklines | `use52Week()`, `useBeta()`, `useIntradaySparkline()` |
| **FX rates edge fn** | Currency pairs | `useCurrencyRates()` |
| **TradingView widgets** | Heatmaps, charts, screeners, economic calendar | Embedded widgets via `TradingViewProvider` |
| **IBKR** | Live positions, orders, trades, P&L | `useIBKRPositions()`, `useIBKROrders()`, etc. |
| **localStorage** | Notes, price alerts, journal, trading plan, learn progress, theme | Direct read/write with self-healing parse helpers |

### Pure Lib Functions (`src/lib/`)

All business logic extracted to pure, node-testable functions — no DOM, no React:

| Function | Description |
|---|---|
| `topMovers(stocks, n)` | Top N by |changePercent|, deduped by symbol |
| `watchlistMovers(stocks, symbols)` | Best + worst among watchlist holdings |
| `watchlistHeatmap(stocks, symbols)` | Colour-intensity cells for watchlist grid |
| `sectorExposure(stocks, symbols, resolver?)` | Sector allocation slices (injectable resolver) |
| `concentrationScore(slices)` | HHI-based score + label |
| `earningsWindow(events, horizon?, max?)` | Upcoming earnings filtered to N days |
| `headlineSentiment(text)` | bull / bear / neutral from keyword lexicon |
| `newsMood(items)` | Aggregate bull/bear/neutral/net from headline array |
| `weekRangePosition(low, high, price)` | 0–1 position within 52-week band |
| `parseNotes(raw)` / `setNote(map, sym, text)` | Symbol notes CRUD (immutable, self-healing) |
| `parseAlerts(raw)` / `evaluateAlerts(alerts, prices)` | Price alert parse + trigger detection |
| `journalWindows(entries)` | Journal streak/window stats |
| `marketSession()` | Current market session label (Pre / Open / After / Closed) |
| `planAdherence(trade)` | Score trade against plan criteria |
| `topMovers`, `splitClose`, `portfolioRisk`, `openR` | Trading-specific risk + position helpers |

### Resilience

- **Per-widget `<ErrorBoundary>`**: each Dashboard card can throw independently without crashing the page.
- **`<DeferUntilVisible>`**: heavy embeds (TradingView, news) use `IntersectionObserver` to defer mount until scrolled into view — reduces initial JS work and API calls.
- **Self-healing parsers**: every `parse*` function (notes, alerts, journal, open trades) returns a safe default on bad JSON, wrong shape, or null input.
- **`<MobilePreviewFrame>`**: wraps the entire app for responsive mobile preview in desktop browsers.
