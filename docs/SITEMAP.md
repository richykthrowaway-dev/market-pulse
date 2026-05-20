# MarketPulse — Developer Site Map

> Source-verified from component files. Last updated: 2026-05-19.
> Every route, section, widget, interactive control, data hook, and localStorage key.

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
13. [`/trading` — IBKR Trading](#trading---ibkr-trading)
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

Collapsible left nav — 224px expanded / 64px collapsed. Active route highlighted via `useLocation`.

| Control | Behaviour |
|---|---|
| Collapse/expand chevron (ChevronLeft/Right) | Toggles width; shows icons-only in collapsed mode |
| 17 nav `<Link>` items | React Router navigation; active item highlighted |
| MarketTimeline strip | Shows current market session pill; only rendered when expanded |
| Portfolio file upload (expanded + `/portfolio` only) | `<input type="file">` → IBKR CSV parse via `onFileUpload`; shows filename + meta + X (clear) button |

**Nav items in order:**  
Dashboard · Stocks · Watchlists · Markets · Currencies · Global · Portfolio · Performance · Risk Analysis · Analysis · Screener · Trading · Calculators · Journal · My Trading Plan · Learn · Settings

### Navbar (`src/components/layout/Navbar.tsx`)

Sticky 64px top bar. Logo/title, optional slot content injected via `NavbarSlotContext`, theme toggle.

### MobileShell (`src/components/layout/MobileShell.tsx`)

Drawer-based mobile navigation wrapping the same `<Sidebar>`. `onNavigate` prop closes drawer after link click. Dashboard renders `<MobileShell>` when `useIsMobile()` is true.

---

## `/` — Dashboard

**Files:** `src/pages/Index.tsx` (pass-through) → `src/components/layout/Dashboard.tsx`  
**Layout:** Sidebar (collapsible) + Navbar + main content. Mobile: `<MobileShell>`. Content: stock-list/chart column (1/3) + chart (2/3) side-by-side; below that, 2/3 left column (news) + 1/3 right column (alerts, movers, overview).

### State & URL Params

| Key | Type | Description |
|---|---|---|
| `?sym=TICKER` | URL search param | Pre-selects active stock; written on click via `setSearchParams` |
| `localStorage['dash-active-sym']` | string | Fallback persistence of active stock across sessions |
| `localStorage['dash-notes-v1']` | JSON object | Per-symbol notes map (`Record<string, string>`) |
| `localStorage['dash-price-alerts-v1']` | JSON array | Price alert list (`PriceAlert[]`) |

Active stock resolution order: `selectedStock` state → `?sym=` URL param → `localStorage['dash-active-sym']` → first stock.

### Sections (top to bottom, left to right)

#### YourSnapshot strip
`<YourSnapshot />` — net liquidation value, timeframe context, market-session pill.  
Data: `usePortfolio()`, `useStatement()`, `useMarketSession()`

#### Stats Row (4 cards)
| Card | Value | Data |
|---|---|---|
| Market Cap | Active stock's market cap via 4-source waterfall: Finnhub (`fetchFinnhubProfile`) → EODHD (`fetchEodFundamentals`) → FMP (`fetchFMPProfile`) → Alpha Vantage (`fetchAVOverview`). Each source only fires if previous returns null. Stale: 12–24h. | 4 `useQuery` hooks in cascade |
| Trading Volume | Today's volume + Relative Volume (`today ÷ 90-day avg`). RelVol computed from `useHistoricalPrices(symbol, 90)`. | DefeatBeta backend |
| Top Gainer | `<TopMoverCard direction="gainer" />` | `useStocks()` |
| Top Loser | `<TopMoverCard direction="loser" />` | `useStocks()` |

#### Stock List Column (1/3 width)

**Header:** "Your Watchlist" (watchlist mode) or "Top Movers" (movers mode)

**Watchlist movers callout** (watchlist mode only, when `wlMovers` is non-null):  
One line: `▲ BEST_SYM +X.XX% · ▼ WORST_SYM -X.XX%`  
Source: `watchlistMovers(stocks, watchSymbols)` from `src/lib/dashboardStocks.ts`

**Add to watchlist input:**  
- Text input, placeholder "Add symbol to watchlist…"  
- Autocomplete dropdown: up to 6 matching stocks (not already in watchlist), click adds via `addWatch(symbol)`  
- Always shown (search hides naturally when no query)

**Stock card list** (`<StockCardWithHistory>`):  
Each card: sparkline (EODHD primary, DefeatBeta fallback), price, change overridden to match chart period.  
- Click: `selectStock(stock)` — updates chart + URL param + localStorage  
- Active card: `ring-2 ring-primary shadow-glow`  
- Watchlist mode: hover ✕ overlay → `removeWatch(symbol)` (stopPropagation)  
- List scrolls to `lg:max-h-[500px]`  
Data: `useStocks()`, `useSparklineData(symbol, days)`, `useHistoricalPrices(symbol, days)`

**Movers CTA** (movers mode only): "Add symbols to build your watchlist →" link to `/watchlists`

**Earnings Strip** (when upcoming earnings exist):  
`📅 AAPL Tomorrow · MSFT in 3d` — one line below the card list.  
Source: `useEarningsCalendar(earningsHoldings)` → `earningsWindow(events)`

**Watchlist Heatmap** (watchlist mode + cells exist):  
3-column grid of colour-coded cells. Green/red background, alpha scales with `intensity` (0–4, one step per 2% move).  
Hover shows tooltip: `SYMBOL NAME X.XX%`  
Source: `watchlistHeatmap(stocks, watchSymbols)` from `src/lib/watchlistHeatmap.ts`

**Sector Exposure Bar** (watchlist mode + sectors resolved):  
Full-width proportional coloured strip, legend of top-5 sectors (name + %).  
Source: `sectorExposure(stocks, watchSymbols)` → `SECTOR_COLORS` from `src/lib/gicsColors.ts`

**Concentration Score** (watchlist mode + sectors resolved):  
Inline text: `Concentration 42/100 · Moderate` (colour: red ≥50, yellow ≥30, green else)  
Source: `concentrationScore(sectors)` from `src/lib/concentrationScore.ts`

#### StockChart (2/3 width)
Range buttons: 1W / 1M / 3M / 1Y / All. `onRangeChange` → `chartDays` state → propagates to all sparklines.  
Height: 256px (mobile) / 384px (md) / 500px (lg).  
Data: `useEodhdBarsForChart()`

#### Fundamentals Panel
`<StockFundamentalsPanel symbol name currentPrice />` — P/E, EPS, dividend, beta, market cap, sector.  
Data: EODHD fundamentals.

**52-Week Range Bar** (when `weekRange` resolves):  
Rounded track with a dot positioned at `pos × 100%`. Labels: symbol, `LOW – HIGH`.  
Source: `use52Week([symbol])` → `weekRangePosition(low, high, price)` from `src/lib/weekRangePosition.ts`

**Symbol Notes textarea** (always when activeStock):  
`<textarea>` rows=3, resizable. Keyed to `notes[SYMBOL]`. On change: `setNote(map, symbol, value)` (pure/immutable).  
Persistence: localStorage `dash-notes-v1` via `parseNotes` / `setNote` from `src/lib/symbolNotes.ts`

#### Left column below the chart/list split (2/3)

**News Mood Strip:**  
`News mood: 🐂 N 🐻 N · neutral N net ±N` — green/red/neutral colour for net.  
Source: `newsMood(news)` → `headlineSentiment(text)` from `src/lib/headlineSentiment.ts`

**NewsCard:**  
Scrollable article list with title, source, timestamp.  
Data: `useNews(WATCHLIST_SYMBOLS)` (Finnhub api-news edge function)

**Top Stories:**  
TradingViewTimeline embed (500px height). Wrapped in `<DeferUntilVisible>`.

#### Right column (1/3)

**Price Alerts Card:**

| Control | Behaviour |
|---|---|
| Symbol text input (uppercase) | Sets `alSym` state |
| Direction select (`≥` / `≤`) | Sets `alDir` state (above/below) |
| Target number input (Enter submits) | Sets `alTarget` state |
| Add button | Calls `addAlert()` → appends to alerts array |
| Alert chips (one per alert) | Shows `SYMBOL ≥/≤ TARGET`; triggered alerts turn red + 🔔; ✕ removes via `removeAlert(id)` |

Storage: localStorage `dash-price-alerts-v1`. Parsing: `parseAlerts` / `evaluateAlerts` from `src/lib/priceAlerts.ts`.

**Market Gap Movers Card:**  
Top 3 largest absolute movers market-wide. Click a row → `selectStock(m)`.  
Source: `topMovers(stocks, 3)` from `src/lib/topMovers.ts`

**MarketOverviewCard:**  
Advancing/declining/unchanged breadth stats.  
Data: `useIndices()` + breadth calculation

**MarketOverview (indices):**  
`<MarketOverview indices={indices} />`  
Data: `useIndices()` (Supabase)

**MarketBreadthCards:**  
Wrapped in `<DeferUntilVisible minHeight={240}>`.  
Data: `<MarketBreadthCards />`

### Loading / Empty States
- While `stocksLoading || !activeStock`: two full-height pulse skeletons (list column + chart column) + one shorter skeleton (fundamentals).
- Zero-stock state: doesn't occur (Supabase returns market stocks).

---

## `/stocks` — Stock Browser

**File:** `src/pages/Stocks.tsx`  
**Layout:** PageLayout → 3-column grid (lg). Left 1/3: scrollable stock card list. Right 2/3: active stock detail (chart + TradingView advanced chart).

| Section | Controls | Data |
|---|---|---|
| **Search bar** | Text input; matching local stock floated to top | `useStocks()` |
| **Stock cards** (first 8 eager-loaded, rest `IntersectionObserver`-lazy at 300px margin) | Click to select; expand/minimize sparkline; remove (✕) | `useStocks()`, `useSparklineData()` |
| **Pinned external stock cards** | Remove (✕); display real-time data | `useEodhdStock(symbol, exchange)` |
| **StockChart** | Range buttons 1W/1M/3M/1Y/All; symbol + current price | `useEodhdBarsForChart()` |
| **TradingView Advanced Chart** | Full-featured chart widget; range synced via `daysToTvRange()` | TradingViewChart (lazy, code-split) |

**URL Params:** `?symbol=AAPL&exchange=US&name=Apple+Inc` — loads external (non-Supabase) stock as pinned card.

---

## `/watchlists` — Watchlist Manager

**File:** `src/pages/Watchlists.tsx`  
**Layout:** 2-panel horizontal split. Left sidebar 208px (collapsible via button). Right: stock table.

| Section | Controls | Data |
|---|---|---|
| **Left: header** | Star icon + label; "+" create new list button | — |
| **New list input** | Text input, Add button, Cancel (✕) | `createList(name)` |
| **Watchlist list items** | Click to switch active list; hover Trash to delete; count badge | `useWatchlists()` |
| **Left: footer** | Total stocks + total lists count | Computed |
| **Right: header** | Collapse/expand sidebar button; inline editable list name (pencil → Enter/Esc to confirm/cancel); stock count badge; `<StockSearch>` to add symbol | `useWatchlists()` rename |
| **Column header controls** | Sparkline expand/minimize button; show/hide (Eye/EyeOff); period pills 7D/30D/60D/90D/120D/1Y | Toggle state |
| **Stock rows** | Logo + ticker + exchange badge; 6 sparklines; price; change %; change $; market cap; move-to-list dropdown; external link button; remove button | `useEodhdStock()`, `useIntradaySparkline()` (Yahoo Finance 7D/30D), `useSparklineData()` (daily, 60D–1Y) |
| **NewsCard (bottom)** | Scrollable news for watchlist symbols | `useNews()` (Finnhub) |

**Notes:**
- 7D/30D sparklines prefer hourly bars (Yahoo Finance via `useIntradaySparkline`); fallback to daily slices.
- Move-to-list dropdown appears on hover per row.

---

## `/markets` — Global Markets

**File:** `src/pages/Markets.tsx`  
**Layout:** Full-viewport locked (body overflow hidden). Stacked heatmaps fill upper viewport; index card grid below.

| Section | Controls | Data |
|---|---|---|
| **S&P 500 Heatmap** | Display only | TradingViewHeatmap(`SPX500`) |
| **ETF Heatmap** | Display only | TradingViewEtfHeatmap |
| **Index Cards** (up to 12) | Display: flag, region, name, value, change%, last-update | `useIndices()` (Supabase) |

**Notes:** Heights computed via `useHeatmapHeight()` — `(viewport − 224px) / 2`. Region ordering via `REGION_ORDER` constant. Skeleton cards animate with `pulse-gentle` during load.

---

## `/currencies` — Currencies

**File:** `src/pages/Currencies.tsx`  
**Layout:** Single-column scrollable. Popular Pairs → Currency Converter → TradingView Cross-Rates → TradingView Forex Heatmap.

| Section | Controls | Data |
|---|---|---|
| **Popular Pairs Grid** | Display: pair, flag icons, rate (4dp), change (4dp), change%, directional arrow | `useCurrencyRates()` → `getRate(from, to)` |
| **Currency Converter** | From/To currency dropdowns; amount input; Swap button (swaps the two currencies); result display | `useCurrencyRates()` → `convert()` |
| **Forex Cross Rates** | Display only (TradingView embed) | TradingViewForexRates widget |
| **Forex Heatmap** | Display only (TradingView embed) | TradingViewForexHeatmap widget |

**Notes:** Rates via `api-fx-rates` edge fn (19 FX pairs, Yahoo Finance, 3-strategy fallback). Error state shows "Unable to load rates. Try refreshing." Loading state shows spinner.

---

## `/global` — Global Trade & Risk

**File:** `src/pages/Global.tsx` (>1000 lines)  
**Layout:** 50/50 viewport split. Left: interactive globe/map. Right: country detail panel with tabs.

| Section | Controls | Data |
|---|---|---|
| **3D Globe / Flat Map** | Toggle flat map; spin; day/night cycle; performance mode; country colours; mode selector (Flags / Performance / Exchanges) | Globe internal state; TopoJSON |
| **Layer toggles** (checkboxes) | Seaports, maritime routes, airports, chokepoints, live vessels, live flights, conflict events, earthquakes, natural events, economic events, pipelines, sanctions, LPI scores, port congestion, commodity flows, trade partner arcs | `useAISStream()`, `useOpenSkyFlights()`, `useConflictEvents()`, `useEarthquakes()`, `useNaturalEvents()`, `useEconomicEvents()`, `useMacroHeatmap()`, `useTradeBreakdown()` |
| **Country Detail Panel** | Click country on map; tabs: Trade / Economy / Exchanges | Computed from selected country + above hooks |
| **Risk Overlay** | Chokepoint risk scoring | Custom calculation on infrastructure data |

**Notes:** AIS vessels: real-time WebSocket. Flights: real-time polling. Three.js (~1.7 MB) lazy-loaded on first visit. Heavy `useMemo` throughout.

---

## `/portfolio` — Portfolio

**File:** `src/pages/Portfolio.tsx`  
**Layout:** Summary row → pie → sortable holdings table → AllocationExplorer → CorrelationMatrix.

| Section | Controls | Data |
|---|---|---|
| **NAV Summary Card** | Timeframe buttons: 1W / MTD / 1M / 3M / YTD / 1Y / All | `usePortfolio()`, `useStatement()` |
| **P&L Timeframe Card** | Timeframe buttons; sparkline | `usePortfolioPrices()` |
| **Market Cap Distribution Pie** | Display only (legend-less) | `usePortfolio()` |
| **Holdings Table** | Columns: Ticker (sort toggle), Shares, Cost, Market Value, P&L $, P&L %, 52W %, Target %, Distance to Target, Stop %, Distance to Stop, Analyst Rating, Trade Style. Sort toggle (P&L). Connect Brokerage / Sync buttons. Collapse/expand rows. | `usePortfolio()`, `useStatement()`, `use52Week()`, `useAnalystRatings()`, `useConnectBrokerage()` (SnapTrade OAuth), `useSnapTradeSync()` |
| **Allocation Explorer** | Tabs: Position / Sector / Sub-Industry / Country / Market Cap / Style; collapse/expand | Internal tab state |
| **Correlation Matrix** | Heatmap; click to drill into pairs | `usePortfolioPrices()` → correlations |

---

## `/performance` — Performance

**File:** `src/pages/Performance.tsx`  
**Layout:** Control bar → KPI grid → equity curve → drawdown chart → performance table → attribution → correlation.

| Section | Controls | Data |
|---|---|---|
| **Benchmark selector** | Dropdown: SPY / QQQ / IWDA / etc. (`BENCHMARK_LABELS`) | `usePerformanceMetrics(benchmark)` |
| **Date range pills** | 1Y (default) / 3Y / Max | State |
| **PerformanceKpiGrid** | 11 KPI cards: Total Return, Annualized Return, Sharpe, Max Drawdown, Win Rate, Best Day, Worst Day, Avg Win, Avg Loss, Beta, Alpha | `usePerformanceMetrics()` |
| **EquityCurveChart** | Line chart portfolio vs benchmark; legend toggle | → `equityCurve` |
| **DrawdownChart** | Area chart cumulative drawdown from peak | → `drawdownData` |
| **PerformanceTable** | Mode toggle: Returns / Attribution; columns vary by mode | → `periods` |
| **AttributionSection** | Grouping toggle: Sector / Position; stacked bar or table | → `attribution` |
| **CorrelationMatrix** | Heatmap | → `correlations` |

**Notes:** Empty state: icon + message + `/portfolio` link. Error state: message + Retry button.

---

## `/risk-analysis` — Risk Analysis

**File:** `src/pages/RiskAnalysis.tsx`  
**Layout:** Single-column scrollable.

| Section | Controls | Data |
|---|---|---|
| **Composite Risk Score** | Display: 0–100 multi-colour gauge | `usePortfolio()` + custom scoring |
| **Risk Metrics Pie** | Breakdown by type (concentration, sector, country, currency, liquidity, leverage); holdings sorted by risk contribution | Custom |
| **Concentration Risk Card** | HHI, top-5 %, position warnings | `usePortfolio()`, `useStatement()` |
| **Country Exposure Card** | Stacked bar by country | `usePortfolio()` + country mapping |
| **Portfolio Beta Graph** | Horizontal bar chart coloured by sector | `useBeta()` per holding (api-beta edge fn → Yahoo Finance) |
| **Value at Risk Card** | 95% VaR (1-day), CVaR in $ and % | Custom VaR calc |
| **Historical Drawdown Card** | Max drawdown %, recovery time, largest drawdown period | `usePortfolioPrices()` |
| **Sector Crash Scenarios** | Table: sector, current weight, P&L impact at −10/−20/−30% | `usePortfolio()` + stress simulation |
| **Market Position Widget** | Long/short/net exposure, leverage ratio | `usePortfolio()` |
| **Rebalancing Widget** | Target allocations, drift, recommendations | `usePortfolio()` |
| **Stress Test Section** | Sliders: market down X%, volatility up X%, rates up X%; real-time P&L impact | Custom scenario engine |

---

## `/analysis` — Market Analysis

**File:** `src/pages/Analysis.tsx`  
**Layout:** Single-column scrollable.

| Section | Controls | Data |
|---|---|---|
| **FundamentalsLookup** | Symbol search input; displays P/E, EPS, dividend, beta, market cap | Finnhub API via `FundamentalsLookup` component |
| **NASDAQ 100 Heatmap** | Display only | TradingViewHeatmap(`NASDAQ100`) |
| **Sector ETF Bar Chart** | Display: 11 SPDR ETFs sorted by % change (XLK XLV XLF XLY XLP XLE XLB XLU XLI XLRE XLC) | `useSectorETFQuotes()` (Finnhub; staleTime 60s) |
| **Technical Analysis** | TradingView TA widget for S&P 500 | TradingViewTechnicalAnalysis embed |
| **Stock Treemap (Top 50)** | Colour by % change; sized by market cap; click shows ticker + change% | `useTopStocksByMarketCap(300)` + custom `TreemapCell` renderer |
| **Market Breadth Stats** | Advancing/declining/unchanged, A/D ratio, avg gains/losses | Computed from `useTopStocksByMarketCap()` |
| **Screener: Most Capitalized** | TradingView screener; toolbar enabled; default: overview column | TradingViewScreener(`most_capitalized`, `america`) |
| **Screener: Top Gainers** | TradingView screener | TradingViewScreener(`top_gainers`, `america`) |

---

## `/screener` — Screener

**File:** `src/pages/Screener.tsx`  
**Layout:** Tab strip with 2 tabs.

| Tab | Section | Controls | Data |
|---|---|---|---|
| **Screener** (default) | StockSearch bar | Text input + autocomplete; selects symbol | `StockSearch` component |
| | TradingView Screener | Embedded widget; default: most_capitalized; toolbar enabled | TradingViewScreener |
| **Economic Calendar** | TradingView Economic Calendar | Importance filter: all levels (`-1,0,1`); height 600px | TradingViewEconomicCalendar |

---

## `/trading` — IBKR Trading

**File:** `src/pages/Trading.tsx`  
**Layout:** PageLayout (title "IBKR Trading"). Vertical: header strip → TradeTracker → AccountStats (IBKR only) → 2/3 left (tabs + chart) + 1/3 right (LivePrices + Order Ticket).

### Header Strip
- "Trading" title
- Account selector dropdown (shown only when multiple IBKR accounts)
- ConnectionStatus indicator (animated pulse dot + status text)

### TradeTracker (`src/components/trading/TradeTracker.tsx`)
Always shown (broker-independent). Manages open trades throughout their lifecycle.

| Section | Controls | Data |
|---|---|---|
| **Open Positions list** | Per-position: Symbol, Side, Qty, Entry, Stop, Target, R:R, Setup, Plan Adherence score; sparkline; inline edit (pencil icon → entry/stop/target fields → Save); Close button (opens close dialog) | `useOpenTrades()` (localStorage `open-trades-v1`) |
| **Close dialog** | Partial or full close; exit price input; P&L preview; Confirm + Undo (5s) | `useOpenTrades().closeOpen()` → auto-files to `useTradeJournal()` |
| **Recently Closed section** | Last N closed trades with P&L, duration, plan adherence badge | `useOpenTrades()` → `closedTrades` |
| **Open Risk Strip** | Total $ at risk, portfolio risk %, stop/target crossing toast | `openR()`, `evaluateAlerts()` |

### AccountStats Row *(IBKR connected only)*
4 cards: Net Liquidation · Daily P&L · Unrealized P&L · Buying Power.  
Data: `useIBKRPnL()`, `useIBKRPortfolioSummary(accountId)`

### Main Tabs (left 2/3)

| Tab | Visibility | Content | Data |
|---|---|---|---|
| **Watchlist** | Always | `<Watchlist>` component: stock cards with price, change, sparkline; click or "→ Ticket" button prefills Order Ticket | `useStocks()` |
| **Positions** | IBKR connected only | Table: Symbol, Description, Qty, Mkt Price, Mkt Value, Avg Cost, Unrealized P&L | `useIBKRPositions(accountId)` |
| **Orders** | IBKR connected only | Table: Symbol, Side badge, Type, Qty, Price (or MKT), Status badge, Cancel (✕) button | `useIBKROrders()`, `useIBKRCancelOrder()` |
| **Trades** | IBKR connected only | Table: Symbol, Side badge, Qty, Price, Commission, Time | `useIBKRTrades()` |

**Below tabs:** `<SymbolChart>` for `selSymbol` (set by Watchlist row-select or Order Ticket symbol).

### Right Panel (1/3, sticky)

**LivePrices Card** *(IBKR connected only)*  
Real-time bid/ask/last for open IBKR positions (up to 10 conids).  
Data: `useIBKRSnapshot(conids)` — fields `31` (last), `84` (change), `85` (change%)

**Order Ticket / QuickOrder Card**  

| Control | Behaviour |
|---|---|
| Symbol search input (autocomplete) | Broker-independent `useSymbolSearch()`; shows canonicalTicker + name + exchange; `onMouseDown` selects. Auto-syncs from Watchlist "→ Ticket". |
| Live price display | Auto-fetched via `fetchYahooQuote(symbol)`; "Use live" button prefills Entry field |
| IBKR contract info *(connected only)* | Shows company name + conid + secType from `useIBKRContractSearch()` |
| Buy / Sell toggle | Sets `side` state (BUY/SELL); button styled green/red |
| Order type select | Market / Limit / Stop (`MKT/LMT/STP`) |
| Quantity stepper | − / input / + buttons. **Auto-computes from risk params** (`tp-risk-v1` in localStorage) when stop is set and qty not manually touched. Manual touch locks it. |
| Entry input + "Use live" button | Prefills from `livePrice` if entry is empty/0 |
| Stop input + quick buttons | Manual or click −1% / −2% / −3% / −5% quick buttons (calls `stopFromPct`) |
| Target input + quick buttons | Manual or click +1R / +2R / +3R quick buttons (calls `targetFromR`) |
| Limit/Stop price input | Only shown when orderType ≠ MKT |
| **Risk Preview panel** | R:R ratio (green ≥2, yellow ≥1.5, red else) · $ at risk + account risk % · Position value · Over-risk warning (⚠) if exceeds saved `riskPct` |
| Submit button | First click: shows confirm text (`Confirm BUY 10 AAPL…`). Second click: places IBKR order (connected) or calls `addOpen()` → TradeTracker (disconnected). Label: "Track BUY/SELL" when offline, "BUY/SELL" when connected. |

Risk params read from: `localStorage['tp-risk-v1']` (set in My Trading Plan → Risk Parameters section).

---

## `/calculators` — Calculators

**File:** `src/pages/Calculators.tsx`  
**Layout:** Left category nav (icon + label) + right calculator panel. Active calculator persisted in URL hash.

### Categories & Calculators (27 total)

| Category | Calculators |
|---|---|
| **Wealth Building** (7) | Compound Interest · Dollar-Cost Averaging · FIRE / Retirement · Mortgage vs Invest · Roth vs Traditional · Inflation-Adjusted · Asset Allocation |
| **Trading** (8) | Position Sizing · Risk / Reward · Margin & Leverage · Short Selling · Drawdown Recovery · Trade Expectancy · Kelly Criterion · Pyramiding |
| **Options** (5) | Options P&L · Covered Call · Cash-Secured Put · Vertical Spread · Black-Scholes |
| **Real Estate** (1) | Rental Cash Flow |
| **Tax & Cost** (3) | Capital Gains Tax · Tax-Loss Harvesting · Cost Basis Methods |
| **Income** (2) | Dividend Projector · Dividend Growth Model |
| **Fees** (3) | Advisor / Manager Fee · MER / Fund Expenses · All-In Comparison |

### Controls

| Control | Behaviour |
|---|---|
| Category sidebar items | Click to navigate; active item highlighted |
| Calculator panel | Each calculator is a self-contained component with its own inputs, outputs, and charts |
| URL hash | `#kelly-criterion`, `#black-scholes`, etc. Shareable deep links, survive page refresh. |

**Notes:** `getActiveId()` reads `window.location.hash` on mount. `hashchange` event syncs state. Default: `compound-interest`. Legacy redirect: `/fee-calculators` → `/calculators` (React Router `<Navigate replace>`).

---

## `/journal` — Trade Journal

**File:** `src/pages/TradeJournal.tsx`  
**Layout:** PageLayout → header buttons → `<HeroStatsRow>` → 8-tab `<Tabs>` → dialogs.

### Header Actions

| Control | Behaviour |
|---|---|
| **Log Trade** button | Opens `<TradeFormDialog>` (add mode). Guarded by **kill switch**: if daily max loss hit (`isDailyMaxLossHit`), shows `confirm()` dialog before opening. |
| **Import from IBKR** button | Opens `<IbkrImportDialog>` — parses IBKR trade CSV/statement → drafts mapped to `TradeEntry` shape → `addTrade()` for each on confirm. |

### HeroStatsRow
Computed from `useTradeJournal()`:
- Win Rate · Total P&L · Total Trades · Avg P&L per trade · Current Streak · Best Trade · Worst Trade

### Tabs (8)

| Tab | Icon | Content |
|---|---|---|
| **Overview** | Activity | `<OverviewTab>` — combined stats, recent trades list, kill-switch banner, link to edit trade |
| **Open** | Radar | `<OpenPositionsView>` — read-only mirror of TradeTracker open positions. Columns: Symbol, Side, Qty, Entry, Stop, Target, R:R, Setup, Held (days), Plan (✓ valid / ⚠ review). Link to `/trading-plan` to manage. Empty state: card + link to TradeTracker. |
| **Calendar** | CalendarDays | `<PnLCalendar>` (click day → `<DayDetailDialog>`), `<DayOfWeekHeatmap>`, `<HourOfDayHeatmap>` |
| **Equity Curve** | LineChart | `<CumulativePnLChart data={cumulativePnL}>` |
| **Analytics** | BarChart3 | `<AnalyticsTab trades={trades}>` — trade distributions, averages, charts |
| **Trades** | List | `<TradeLogTable>` — sortable/filterable trade log; edit (pencil) + delete (trash) per row |
| **Rules** | ScrollText | `<RulesTab>` — editable trading rules list |
| **Strategy** | Map | `<StrategyTab>` — strategy notes and framework |

### Dialogs
- `<TradeFormDialog>` — add/edit mode. Fields: symbol, side, entry, exit, qty, date, setup, plan adherence, notes.
- `<IbkrImportDialog>` — import from IBKR statement CSV.
- `<DayDetailDialog>` — drill-down for a calendar day's trades.

### Data
- `useTradeJournal()` (localStorage `trade-journal-v1`) → `{ trades, addTrade, updateTrade, deleteTrade, dailyPnL, stats, cumulativePnL, tradesByDate, currentStreak }`
- `useOpenTrades()` (localStorage `open-trades-v1`) → read-only in Open tab
- `useJournalSettings()` — max loss settings for kill switch

---

## `/trading-plan` — My Trading Plan

**File:** `src/pages/TradingPlan.tsx`  
**Layout:** All content in `.tp-ext` scoped div. Custom typography: Instrument Serif (h2), JetBrains Mono (labels), Newsreader (body). CSS vars remapped onto site HSL design tokens.

### Sections & Controls

| Section | localStorage Key | Controls |
|---|---|---|
| **Setup Quality Grading Rubric** + grade calculator | `tp-rubric` | Editable rubric criteria list; ▲▼ reorder; ✕ delete; Add input + Enter; Reset to defaults; interactive grade calculator inputs |
| **Market Regime Recognition** | `tp-regimes` | Framework selector; editable regime criteria; ▲▼ reorder; ✕ delete; Add + Enter; Reset |
| **Fit-to-Trade Daily Check** | `tp-fit-YYYY-MM-DD` (day-scoped) | Checkbox list; editable questions; ▲▼ reorder; ✕ delete; Add + Enter; Reset. Scoped to current date — resets daily. |
| **Pre-Trade Checklist** | `tp-pretrade` | Checkbox list; editable items; ▲▼ reorder; ✕ delete; Add + Enter; Reset |
| **Mistake Tracker** | `tp-mistakes` | Editable category list; frequency counter buttons (+1 / reset per category); ▲▼ reorder; ✕ delete; Add + Enter; Reset |
| **Risk Parameters** | `tp-risk-v1` | Account size input + max risk % input. Read by `/trading` Order Ticket for auto-qty and risk preview. |

**`PlanListEditor` component:** shared by all editable lists. Renders items with inline text inputs, ▲▼ reorder buttons, ✕ delete, draft input + Add button, Reset to defaults button (confirm dialog).

**`usePersistentState<T>(key, initial)`:** local hook — lazy-init reads localStorage; syncs to localStorage on every value change.

**`todayKey()`:** returns `YYYY-MM-DD` — used to scope the daily fit-to-trade checklist key.

---

## `/learn` — Learn

**File:** `src/pages/Learn/index.tsx` + `src/pages/Learn/data/` (articles, categories, paths, types)  
**Layout:** Search bar → tab strip (3 tabs) → article grid / article reader panel. Dark custom palette (surface-* tokens).

### Tabs

| Tab | Content | Controls |
|---|---|---|
| **Explore** (default) | Category filter chips + article card grid | Category chip (click to filter); article card (click to read); bookmark toggle (bookmark icon); difficulty badge (beginner/intermediate/advanced); read-time display |
| **Learning Paths** | Path cards with progress bar | Start / Continue button; progress shows `read / total` articles |
| **Bookmarks** | Grid of bookmarked articles | Same card format; unbookmark via toggle |

### Article Reader
Opens inline (replaces grid). Prev/Next navigation buttons. Back button. Bookmark toggle. Mark-read automatically on open.

**Content block types rendered:**

| Block Type | Render |
|---|---|
| `paragraph` | `<p>` body text |
| `heading` | `<h2>` or `<h3>` with ID anchor |
| `formula` | Code block + variables key/value grid |
| `example` | Highlighted card: title, company, scenario, numbers grid |
| `callout` | Bordered card with variant: tip (green) / warning (amber) / info (blue) |
| `list` | `<ul>` or `<ol>` |
| `keyPoints` | CheckCircle2 icon list |
| `quiz` | Multiple-choice buttons; one attempt per session; correct/incorrect feedback |

### Search
Text input + X clear. Filters articles by title/tags. Local `query` state.

### "Continue where you left off" banner
Shows last-read article title. Link to reopen. Source: `localStorage['learn-lastread']`.

### Persistence (localStorage — zero Supabase dependency)

| Key | Content |
|---|---|
| `learn-read` | JSON array of read article IDs |
| `learn-bookmarks` | JSON array of bookmarked article IDs |
| `learn-lastread` | `{ id: string, ts: number }` for "continue" banner |

**Notes:** `LearnErrorBoundary` (class component) wraps the entire page. Static data in `src/pages/Learn/data/`.

---

## `/settings` — Settings

**File:** `src/pages/Settings.tsx`  
**Layout:** 1/3 left nav sidebar + 2/3 main panel.

### Left Sidebar Navigation
Ghost buttons: **Account** · **Notifications** · **Security** · **Regional Settings** · **Preferences**  
(Visual only — no sub-routing yet; all buttons present but only Account section has live content.)

### Account Settings Panel

| Section | Controls | Data |
|---|---|---|
| **Personal Information** | First Name input; Last Name input; Email (read-only, disabled with note); Phone input; **Save Changes** button (disabled when not dirty); **Cancel** button (re-seeds from auth); save status indicator (idle / saving ✓ / error) | `supabase.auth.getUser()` on mount; `supabase.auth.updateUser({ data: {...} })` on save |
| **Theme** | Light / Dark / System toggle | `useTheme()` (`next-themes`); uses `resolvedTheme` + `mounted` guard to avoid hydration mismatch |

**States:**
- **Loading:** spinner + "Loading account details…"
- **Anonymous user:** "You're browsing as a guest. Create an account to save personal information."
- **Save error:** error message displayed below Save button.

**Notes:** Email is read-only — changing requires Supabase auth flow. `dirty` flag tracks unsaved changes. Cancel re-fetches `user_metadata` and reseeds form.

---

## `*` — Not Found

**File:** `src/pages/NotFound.tsx`  
Simple 404 page. "Go back home" link to `/`.

---

## Key Architecture Patterns

### Route Map

```
App.tsx
└── ThemeProvider → QueryClientProvider → TooltipProvider → TradingViewProvider
    └── StatementProvider → NavbarSlotProvider
        └── BrowserRouter → MobilePreviewFrame → Suspense(spinner)
            └── Routes
                ├── /              → Index.tsx → Dashboard.tsx
                ├── /stocks        → Stocks.tsx
                ├── /watchlists    → Watchlists.tsx
                ├── /markets       → Markets.tsx
                ├── /currencies    → Currencies.tsx
                ├── /global        → Global.tsx  (lazy: Three.js 1.7 MB)
                ├── /portfolio     → Portfolio.tsx
                ├── /performance   → Performance.tsx
                ├── /risk-analysis → RiskAnalysis.tsx
                ├── /analysis      → Analysis.tsx
                ├── /screener      → Screener.tsx
                ├── /trading       → Trading.tsx
                ├── /fee-calculators → <Navigate to="/calculators" replace />
                ├── /calculators   → Calculators.tsx
                ├── /journal       → TradeJournal.tsx
                ├── /trading-plan  → TradingPlan.tsx
                ├── /learn         → Learn/index.tsx
                ├── /settings      → Settings.tsx
                └── *              → NotFound.tsx
```

All page imports use `React.lazy()` — each is a separate async Vite chunk downloaded on first visit.

### Data Sources

| Source | Edge Function / Hook | Used For |
|---|---|---|
| **Supabase** | `useStocks()`, `useWatchlists()`, `useIndices()`, `usePortfolio()`, `supabase.auth.*` | Stocks DB (47k rows), watchlists, market indices, portfolio, auth |
| **EODHD** | `useEodhdBarsForChart()`, `useEodhdStock()`, `useSparklineData()` | Price history, fundamentals, ohlcv bars, sparklines |
| **Finnhub** | `api-finnhub` edge fn → `useNews()`, `useEarningsCalendar()`, `useSectorETFQuotes()`, `fetchFinnhubProfile()` | Quotes, news, earnings calendar, analyst ratings, profile/market cap |
| **Yahoo Finance** | `api-52week`, `api-beta`, `useIntradaySparkline()`, `fetchYahooQuote()` | 52-week range, beta, intraday sparklines, Order Ticket live price |
| **FX rates** | `api-fx-rates` → `useCurrencyRates()` | 19 FX pairs (3-strategy fallback) |
| **FMP** | `fetchFMPProfile()` | Market cap fallback (3rd in cascade) |
| **Alpha Vantage** | `fetchAVOverview()` | Market cap fallback (4th/last in cascade) |
| **DefeatBeta** | `useHistoricalPrices()`, `useDefeatBetaNews()` (disabled) | 90-day price history for RelVol calc; news disabled (segfault on Windows) |
| **TradingView** | Embedded widgets via `TradingViewProvider` | Heatmaps, advanced chart, screeners, economic calendar, technical analysis, timeline, forex |
| **IBKR Gateway** | `useIBKR*` hooks (localhost proxy) | Positions, orders, trades, P&L, live snapshots, order placement |
| **localStorage** | Direct read/write with self-healing parsers | Notes, price alerts, journal, open trades, trading plan sections, learn progress, calculator state |

### localStorage Key Registry

| Key | Page / Hook | Shape |
|---|---|---|
| `dash-active-sym` | Dashboard | string (ticker) |
| `dash-notes-v1` | Dashboard | `Record<string, string>` |
| `dash-price-alerts-v1` | Dashboard | `PriceAlert[]` |
| `trade-journal-v1` | TradeJournal | `TradeEntry[]` |
| `open-trades-v1` | Trading / TradeTracker | `OpenTrade[]` |
| `tp-rubric` | TradingPlan | `PlanItem[]` |
| `tp-regimes` | TradingPlan | `PlanItem[]` |
| `tp-fit-YYYY-MM-DD` | TradingPlan | `Record<string, boolean>` |
| `tp-pretrade` | TradingPlan | `PlanItem[]` |
| `tp-mistakes` | TradingPlan | `PlanItem[]` |
| `tp-risk-v1` | TradingPlan (written) / Trading (read) | `{ account: number, riskPct: number }` |
| `learn-read` | Learn | `string[]` (article IDs) |
| `learn-bookmarks` | Learn | `string[]` (article IDs) |
| `learn-lastread` | Learn | `{ id: string, ts: number }` |
| `logo-cache-v1` | LogoService | `Record<string, { url: string, ts: number }>` (30-day TTL) |

### Pure Lib Functions (`src/lib/` — node-testable, no DOM/React)

| Function | File | Description |
|---|---|---|
| `topMovers(stocks, n)` | `topMovers.ts` | Top N by \|changePercent\|, deduped by uppercased symbol, stable sort |
| `watchlistMovers(stocks, symbols)` | `dashboardStocks.ts` | Best + worst among watchlist holdings; null if none resolve |
| `resolveDisplayStocks(stocks, symbols)` | `dashboardStocks.ts` | Returns `{ list, source }` — watchlist stocks or top movers |
| `watchlistHeatmap(stocks, symbols)` | `watchlistHeatmap.ts` | `HeatCell[]` with `intensity` 0–4 (one step per 2%), sorted by \|cp\| desc |
| `sectorExposure(stocks, symbols, resolver?)` | `sectorExposure.ts` | `SectorSlice[]` with injectable sector resolver; defaults to `getStaticSector`; misses → 'Unknown' |
| `concentrationScore(slices)` | `concentrationScore.ts` | HHI: `round(sum((pct/100)^2)*100)`; labels: ≥50 Concentrated, ≥30 Moderate, else Diversified |
| `earningsWindow(events, horizon?, max?)` | `earningsWindow.ts` | Upcoming earnings 0..horizon days; labels: Today / Tomorrow / in Nd |
| `headlineSentiment(text)` | `headlineSentiment.ts` | `'bull'|'bear'|'neutral'` via keyword lexicon scoring |
| `newsMood(items)` | `headlineSentiment.ts` | Aggregate `{ bull, bear, neutral, net }` from headline array |
| `weekRangePosition(low, high, price)` | `weekRangePosition.ts` | 0–1 position within 52-week band; null if non-finite or degenerate |
| `parseNotes(raw)` / `setNote(map, sym, text)` | `symbolNotes.ts` | Self-healing parse; `setNote` is pure/immutable (empty text removes key) |
| `parseAlerts(raw)` / `evaluateAlerts(alerts, prices)` | `priceAlerts.ts` | Self-healing parse; `evaluateAlerts` returns triggered subset |
| `riskPreview(params)` | `riskPreview.ts` | `{ rr, dollarRisk, posValue, acctRiskPct, overRisk }` for Order Ticket |
| `stopFromPct(side, entry, pct)` | `entryMath.ts` | Compute stop price from % distance |
| `targetFromR(side, entry, stop, r)` | `entryMath.ts` | Compute target price from R multiple |
| `qtyFromRisk(entry, stop, account, riskPct)` | `entryMath.ts` | Auto-compute qty from account risk parameters |
| `journalWindows(entries)` | `journalWindows.ts` | Streak/window stats from journal entries |
| `marketSession()` | `marketSession.ts` | Current session label: Pre / Open / After / Closed |
| `planAdherence(trade)` | `planAdherence.ts` | Score trade against plan criteria |
| `portfolioRisk(trades)` | `portfolioRisk.ts` | Portfolio-level open risk metrics |
| `openR(trade)` | `tradeMetrics.ts` | Open R value for a trade |
| `splitClose(trade, exitPrice, closeQty)` | `splitClose.ts` | Partial-close logic: returns updated open + new closed record |

### Resilience

| Pattern | Where |
|---|---|
| `<ErrorBoundary name="…">` | Every Dashboard card; Trading widgets; prevents one card from crashing the page |
| `<DeferUntilVisible minHeight={N}>` | TradingView embeds, MarketBreadthCards; defers mount until scrolled into viewport via `IntersectionObserver` |
| Self-healing `parse*` functions | All localStorage readers; return safe defaults on bad JSON, wrong shape, or null |
| `React.lazy()` + `<Suspense>` | All page chunks; spinner fallback during chunk download |
| `useIsMobile()` → `<MobileShell>` | Dashboard switches to drawer nav on mobile |
| `MobilePreviewFrame` | Wraps entire app; enables responsive mobile preview in desktop browsers |
