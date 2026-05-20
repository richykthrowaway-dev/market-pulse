# MarketPulse — Exhaustive Developer Site Map

> Source-verified from every component file. Last updated: 2026-05-19.
> Every route, section, card, widget, button label, input placeholder, table column, conditional render, data hook, and localStorage key.

---

## Table of Contents

1. [Global Chrome](#global-chrome)
2. [`/` — Dashboard](#---dashboard)
3. [`/stocks` — Stock Browser](#stocks---stock-browser)
4. [`/watchlists` — Watchlist Manager](#watchlists---watchlist-manager)
5. [`/markets` — Global Markets](#markets---global-markets)
6. [`/currencies` — Currencies](#currencies---currencies)
7. [`/global` — Global Investment Hub](#global---global-investment-hub)
8. [`/portfolio` — Portfolio](#portfolio---portfolio)
9. [`/performance` — Performance](#performance---performance)
10. [`/risk-analysis` — Risk Analysis](#risk-analysis---risk-analysis)
11. [`/analysis` — Market Analysis](#analysis---market-analysis)
12. [`/screener` — Screener & Calendar](#screener---screener--calendar)
13. [`/trading` — IBKR Trading](#trading---ibkr-trading)
14. [`/calculators` — Calculators](#calculators---calculators)
15. [`/journal` — Trade Journal](#journal---trade-journal)
16. [`/trading-plan` — My Trading Plan](#trading-plan---my-trading-plan)
17. [`/learn` — Learn](#learn---learn)
18. [`/settings` — Settings](#settings---settings)
19. [`*` — Not Found](#---not-found)
20. [Shared Components](#shared-components)
21. [Architecture Patterns](#architecture-patterns)

---

## Global Chrome

### `<MobilePreviewFrame>` (`src/components/layout/MobilePreviewFrame.tsx`)

Wraps the entire app. When preview mode active, renders inside an iPhone 15 Pro simulator iframe (393×759px) with titanium-bezel frame, status bar (time, signal bars, WiFi, battery), Dynamic Island pill (126×37px), home indicator pill, and a patched iframe window environment to emulate mobile Safari. When inactive, passes through `children` directly.

### `<Navbar>` (`src/components/layout/Navbar.tsx`)

Sticky 64px top bar.

| Section | Contents |
|---|---|
| Left | "MarketPulse" `<h1>` title; `<StockSearch>` (hidden `md:block` on mobile) |
| Right | `<ViewModeToggle>`; Theme toggle button (animated Sun↔Moon swap, rotation); Notifications bell (pulsing red dot, non-functional placeholder); User avatar (`User` icon in `primary/10` bg, fallback); navbar-slot from `useNavbarSlot()` for page-injected actions |

### `<Sidebar>` (`src/components/layout/Sidebar.tsx`)

Collapsible left nav, 224px expanded / 64px collapsed.

| Control | Behaviour |
|---|---|
| Title "MarketPulse" | Visible only when expanded |
| Collapse/expand chevron | `ChevronLeft` (open) / `ChevronRight` (closed). Toggles width; icons-only mode when collapsed. |
| 17 nav `<Link>` items | Active route highlighted via `useLocation`. Each item is `Icon + Title` |
| `<MarketTimeline>` strip (expanded only) | See below |
| Portfolio file upload (expanded + `/portfolio` only) | `FileText` icon + filename; `<input type="file">` → IBKR CSV parser; X button to clear; loading spinner during parse |

**Nav items in exact order:**

| # | Title | Icon | href |
|---|---|---|---|
| 1 | Dashboard | Home | `/` |
| 2 | Stocks | BarChart | `/stocks` |
| 3 | Watchlists | Star | `/watchlists` |
| 4 | Markets | BarChart3 | `/markets` |
| 5 | Currencies | DollarSign | `/currencies` |
| 6 | Global | Globe | `/global` |
| 7 | Portfolio | Wallet | `/portfolio` |
| 8 | Performance | LineChart | `/performance` |
| 9 | Risk Analysis | ShieldAlert | `/risk-analysis` |
| 10 | Analysis | PieChart | `/analysis` |
| 11 | Screener | Search | `/screener` |
| 12 | Trading | CandlestickChart | `/trading` |
| 13 | Calculators | Calculator | `/calculators` |
| 14 | Journal | BookOpen | `/journal` |
| 15 | My Trading Plan | ClipboardList | `/trading-plan` |
| 16 | Learn | GraduationCap | `/learn` |
| 17 | Settings | Settings | `/settings` |

### `<MarketTimeline>` (`src/components/layout/MarketTimeline.tsx`)

Compact market-status visualization in the sidebar (expanded mode only).

| Section | Content |
|---|---|
| Header | "Market Status" label (text-[8px], uppercase) · local time (font-mono text-[10px], bold) · local date (text-[7px] muted) |
| Market rows (5, sorted open-first) | Sydney (gold) · Tokyo (red) · Hong Kong (magenta) · London (cyan) · New York (navy). Each row: status dot · 3-letter code · timeline bar (with wrap-around handling for midnight crossings) · "now" needle (white) · countdown (e.g. "2h 15m") |
| 24-hour circular clock (SVG, viewBox -80 -80 160 160) | Hour ticks (24 radial, major at 6h opacity 0.7, minor at 1h opacity 0.3); labels 0/6/12/18; 5 concentric market rings (Sydney inner r=24 → NY outer r=60), each with background arc (opacity 0.08) and active arc (opacity 0.9 if open, 0.35 if closed); white "now" needle with glow shadow |

**Tick logic:** Updates every 1000ms via `setInterval`, gated by `document.visibilityState === 'visible'` — pauses when tab backgrounded.

### `<MobileShell>` (`src/components/layout/MobileShell.tsx`)

Drawer-based mobile navigation wrapping `<Sidebar>`. `onNavigate` callback closes the drawer after link click. Dashboard renders `<MobileShell>` when `useIsMobile()` is true.

### `<PageLayout>` (`src/components/layout/PageLayout.tsx`)

Wrapper for all pages except Dashboard. Switches between mobile (MobileShell) and desktop (Navbar + Sidebar + main) based on `useIsMobile()`. Injects SEO meta (description, canonical) via `useEffect`. `<h1>` title rendered unless `hideTitle` prop.

---

## `/` — Dashboard

**Files:** `src/pages/Index.tsx` (pass-through) → `src/components/layout/Dashboard.tsx`

### `<YourSnapshot>` strip (top)

**Header row:** "Your snapshot" label + market session badge ("US open"/"US closed" + time indicator). Badge colour: green if `session.open`, red otherwise.

**4 clickable navigation tiles** (each `<Link>` with hover opacity):

| Tile | Destination | Content |
|---|---|---|
| Open P&L | `/trading` | `money(openPnl)` or "—"; positions count, or "No open positions" |
| Open Risk | `/trading` | Risk %, or "set account in plan" if `risk.pct == null` |
| Today Realized | `/journal` | Win rate or "No trades logged" |
| This Week | `/journal` | Streak emoji (🔥 wins / 🧊 losses) or "Log your first trade" |

**Data:** `useOpenTrades()`, `useLiveQuotes(openSymbols, intervalMs)`, `useLiveSpeed()`, `useTradeJournal()`; reads `localStorage['tp-risk-v1']` for account size.

### Title

`<h1>` "Market Dashboard"

### Stats Row (4 cards via `<StatsCard>`)

| Card | Value | Trend / Description | Icon |
|---|---|---|---|
| Market Cap | Active stock's market cap (4-source waterfall: Finnhub → EODHD → FMP → Alpha Vantage) | active stock's changePercent; symbol as label | `Wallet2` |
| Trading Volume | `formatVolume(activeStock.volume)` (K/M/B) | `Rel Vol: X.XX×` (today ÷ 90-day avg) or "Today's volume" | `BarChart3` |
| Top Gainer | `<TopMoverCard direction="gainer">` | — | (internal) |
| Top Loser | `<TopMoverCard direction="loser">` | — | (internal) |

**Market Cap waterfall details:**
- 1st: Finnhub via `fetchFinnhubProfile()` — `staleTime: 24h`, `gcTime: 24h`
- 2nd: EODHD via `fetchEodFundamentals()` (symbol with `.US` suffix) — fires only if Finnhub null; staleTime 12h
- 3rd: FMP via `fetchFMPProfile()` — fires only if first two null
- 4th: Alpha Vantage via `fetchAVOverview()` — last resort

### `<TopMoverCard>` (used twice in stats row)

**Header:** Title "Top Gainer" or "Top Loser" + filter chips (removable) + filter popover trigger (sliders icon) + directional icon.

**Body:** Large symbol text (2xl) + change % with directional arrow + company name (truncated) + no-results message if filtered empty.

**Filter popover:**

| Dropdown | Options | Default |
|---|---|---|
| Sector | "All sectors" + each sector with `(count)` suffix | All sectors |
| Country | "All countries" + each country with `(count)` | All countries |
| Market Cap | Mega ($200B+), Large ($10–200B), Mid ($2–10B), Small ($300M–2B), Micro (<$300M). Disabled with "(no data yet)" suffix if market cap data unavailable | Any size |

"Clear all" button appears only if any filter active.

**Data:** `useQuery(['symbols', 'filter-options'])` staleTime 24h; `useQuery(['top-mover', direction, filters])` staleTime 60s → `fetchTopMover()`.

### Main Split (when `ready`): Stock List + Chart

#### Left column (lg:w-1/3) — Stock List

**Heading:** "Your Watchlist" (when `listSource === 'watchlist'`) or "Top Movers" (when `listSource === 'movers'`)

**Watchlist movers callout** (watchlist mode + `wlMovers` non-null):

```
▲ BEST_SYM +X.XX%  ·  ▼ WORST_SYM -X.XX%
```
Source: `watchlistMovers(stocks, watchSymbols)` from `src/lib/dashboardStocks.ts`

**Add-symbol input** (always shown):
- Placeholder: "Add symbol to watchlist…"
- Class: `w-full h-8 rounded-md border border-border bg-background px-2 text-xs`
- `aria-label="Add symbol to watchlist"`
- Autocomplete dropdown (up to 6 results) below input. Each result button: bold symbol + truncated name. Click → `addWatch(symbol)` + clears input. Filters out symbols already in watchlist.

**Stock card list** (`overflow-y-auto lg:max-h-[500px] p-1`):
- Each card via `<StockCardWithHistory>` wrapping `<StockCard>`
- Click card: `selectStock(stock)` (updates `selectedStock` + URL `?sym=` + `localStorage['dash-active-sym']`)
- Active card: ring `ring-2 ring-primary shadow-glow`
- Watchlist mode only: hover ✕ overlay (top-1 right-1). Aria-label `Remove {symbol} from watchlist`. `stopPropagation` so card click still selects.
- `<StockCardWithHistory>` uses EODHD primary, DefeatBeta fallback for sparkline; overrides change/% to match selected timeframe.

**Movers CTA** (when `listSource === 'movers'`): Text link "Add symbols to build your watchlist →" → `/watchlists`

**Earnings Strip** (when `upcomingEarnings.length > 0`):
```
📅 AAPL Tomorrow · MSFT in 3d · NVDA Today
```
Source: `useEarningsCalendar(earningsHoldings)` → `earningsWindow(events)` (7-day horizon, max 5).

**Watchlist Heatmap** (watchlist mode + cells exist):
- 3-column grid with `gap-1`
- Each cell: symbol + change% (e.g. "+1.5%")
- Background: green (HSL `142 70% 45%`) or red (HSL `0 72% 51%`) with alpha = `0.18 + intensity * 0.2`
- Intensity steps 0–4, one per 2% absolute change
- Hover tooltip: `{name} {changePercent}%`
- Source: `watchlistHeatmap(stocks, watchSymbols)`

**Sector Exposure Bar** (watchlist mode + sectors resolved):
- Full-width 2px-tall stripe, segments proportional to `sectors[i].pct`, coloured via `SECTOR_COLORS[sector]`
- Legend: top-5 sectors with coloured square + name + pct
- Source: `sectorExposure(stocks, watchSymbols)` via `getStaticSector()`

**Concentration Score** (watchlist mode + sectors resolved):
```
Concentration {score}/100 · {label}
```
Label colour: red ≥50 (`Concentrated`), yellow ≥30 (`Moderate`), green else (`Diversified`).  
Source: `concentrationScore(sectors)` — HHI-based.

#### Right column (lg:w-2/3) — Chart

`<StockChart symbol name currentPrice onRangeChange={setChartDays}>` — height `h-64 md:h-96 lg:h-[500px]`.

`<StockChart>` internals:
- **Header:** logo (md) + symbol + name (text-sm muted) + range buttons
- **Range buttons:** 1W (6 days) · 1M (30 days) · 3M (90 days) · 1Y (365 days) · 5Y (1825 days) · All (9999 days). Active variant `default`, else `outline`. Size sm, h-7 px-2 text-xs.
- **Body (300px chart):** `<LightweightChart type="area" areaLineColor areaTopColor areaBottomColor>` — band colours derived from performance.
- **Data:** 1W → `useEodhdIntraday()` hourly bars; 1M–5Y → `useHistoricalPrices()` DefeatBeta daily, fallback EODHD via `useQuery` of `fetchEodHistorical`.
- **Loading:** Skeleton h-full. **Empty:** "No price data available for this range".

### Fundamentals Panel

`<StockFundamentalsPanel symbol name currentPrice>` — 3-column grid:

**Column 1: Key Metrics** (header "Key Metrics")
- 2×4 grid of `MetricChip`: P/E RATIO · EPS (TTM) · 52W HIGH · 52W LOW · FROM 52W HI · BETA · DIV YIELD · CURRENT
- 3-layer data fallback: EODHD Highlights/Technicals → FMP (profile + key metrics) → Alpha Vantage
- Formatters: `fmt$`, `fmtN(n, dp)`, `fmtPct(n)` — all return "—" for null

**Column 2: Analyst Consensus** (header "Analyst Consensus")
- Bold consensus label (text-xl), coloured: Strong Buy (green-500) · Buy (green-400) · Hold (yellow-400) · Sell (red-400)
- Horizontal stacked bar (h-4, rounded-full, bordered): 5 segments StrongBuy / Buy / Hold / Sell / StrongSell, colours green-700 / green-500 / yellow-400 / orange-400 / red-500
- Counts row: `SB: {n}  B: {n}  H: {n}  S: {n}  SS: {n}`
- Period right-aligned (text-[11px] muted)
- 3-layer fallback: EODHD `AnalystRatings` → Finnhub Recommendations [0] → FMP

**Column 3: Earnings History** (header "Earnings History")
- Each row (border, px-3 py-2): label (`Q{q} {year}` or `YYYY-MM`) · "Est: $X" · "Act: $X" · `SurpriseChip`
- `SurpriseChip`: Beat (green) +X.X% | Miss (red) -X.X% | In-line (muted) | null
- Empty: "No earnings data."
- 2-layer fallback: EODHD quarterly (last 4) → Finnhub earnings (first 4)

### 52-Week Range Card (when `weekRange` resolves)

`mt-3 rounded-lg border border-border bg-card p-3`
- Top row: "52-Week Range — {SYMBOL}" + `{low.toFixed(2)} – {high.toFixed(2)}`
- Track: `h-1.5 w-full rounded-full bg-muted` with absolute-positioned dot (h-3 w-3, bg-primary) at `left: {pos * 100}%`
- Tooltip: `Current {price.toFixed(2)}`
- Source: `use52Week([symbol])` → `weekRangePosition(low, high, price)`

### Symbol Notes Card (when `activeStock`)

`mt-3 rounded-lg border border-border bg-card p-3`
- Label: "Notes — {SYMBOL}"
- `<textarea>` rows=3, resize-y, placeholder "Your private notes for this symbol…"
- On change: `setNotes(m => setNote(m, symbol, value))` (pure/immutable update)
- Persisted: `localStorage['dash-notes-v1']`

### Skeleton Loading (when `!ready`)

Two pulse skeletons (h-[500px] for list+chart split) + one h-40 skeleton (fundamentals).

### Main Content Grid (below split)

Two columns: `lg:col-span-2` (left, news section) + `lg:col-span-1` (right, alerts/movers/overview).

#### Left column (2/3)

**News Mood strip:**
```
News mood: 🐂 {bull} 🐻 {bear} · neutral {neutral} net {±N}
```
Net colour: green positive, red negative, muted zero. Source: `newsMood(news)` → `headlineSentiment(text)` (keyword lexicon).

**`<NewsCard>` (`src/components/news/NewsCard.tsx`):**
- Section `aria-label="Market News"`
- Header: "Live News" + live-dot indicator + article count (e.g. "23 articles", font-mono-num)
- Filter chips (only if `watchlistSymbols`): one per symbol with count. Three states: active (primary bg) / inactive with count (primary/10 bg) / disabled if 0 count (muted/40 opacity-50). "Clear filter ×" button if active.
- Articles grid (`grid gap-3`, staggered `animationDelay = index * 60ms`):
  - Each `news-card`: 12×12 logo (hidden < sm) + title (line-clamp-2) + ExternalLink icon if `url !== '#'` + summary (line-clamp-2) + meta row: symbol badges (first 4) + source ("Yahoo Finance"/"Finnhub", text-[9px]) + Clock icon + time
- Empty: "No news articles found for your watchlist symbols."
- JSON-LD ItemList schema for first 10 articles.

**Top Stories Card:**
- Header: `<Newspaper>` icon + "Top Stories"
- Body: `<DeferUntilVisible minHeight={500}>` → `<TradingViewTimeline height={500}>`

#### Right column (1/3)

**Price Alerts Card** (`<ErrorBoundary name="PriceAlerts">`):

| Control | Details |
|---|---|
| Symbol input | h-8 w-20, uppercase, placeholder "Symbol", `aria-label="Alert symbol"` |
| Direction select | h-8, options `≥` (above) / `≤` (below), `aria-label="Alert direction"` |
| Target input | h-8 w-20, `inputMode="decimal"`, placeholder "Target", Enter key calls `addAlert()`, `aria-label="Alert target price"` |
| Add button | h-8, bg-primary, text "Add" |
| Alert chips | Per alert: `{symbol} {≥/≤} {target}` + 🔔 if triggered. Triggered → red `bg-destructive/15`; un-triggered → muted. ✕ removes via `removeAlert(id)`, `aria-label="Remove alert {symbol}"` |
| Empty state | "No alerts set." |

Persistence: `localStorage['dash-price-alerts-v1']` via `parseAlerts` / `evaluateAlerts(alerts, priceMap)`.

**Market Gap Movers Card** (`<ErrorBoundary name="GapMovers">`):
- Top 3 by |changePercent| (deduped by uppercased symbol)
- Each row: button with symbol (semibold) + change% (green/red font-mono-num)
- Click row → `selectStock(m)`
- Empty: "No data."
- Source: `topMovers(stocks, 3)`

**`<MarketOverviewCard>`** (`src/components/widgets/MarketOverviewCard.tsx`):
- Header: "Market Overview" + "US Market" badge
- 10 timeframe pills: 1D · 1W · 1M · 3M · 6M · YTD · 1Y · 3Y · 5Y · 10Y
- Stats: Median % change + Up count · Mean % change + Down count
- 240px Recharts BarChart: histogram of returns. Green if midpoint ≥0, red otherwise. Tooltip: "< -10%", "-8% to -5%", etc.
- Loading: spinning loader. Source: `useMarketReturns(timeframe)` → `buildBuckets()`.

**`<MarketOverview indices>`** (`src/components/markets/MarketOverview.tsx`):
- Header: "Global Markets" + globe icon
- 2-column grid of `CompactIndexCard`:
  - Top accent bar (green/red, hover-animated)
  - Row 1: flag icon + name (bold, truncated) + symbol (uppercase, muted)
  - Row 2: value (mono) + change% with directional arrow

**`<MarketBreadthCards>`** (`<DeferUntilVisible minHeight={240}>` wrapper):
- 2 `BreadthBar` cards:
  - **Advancing / Declining** — left "Advancing" (green) + count + %, right "Declining" (red) + count + %, stacked progress bar, animated `duration-500`
  - **New High / New Low** — same structure
- Loading: 2 skeleton cards (h-20 animate-pulse)
- "—%" if total is 0
- Source: `useMarketReturns('1D')` → `data.stats.{up,down,new_high,new_low}`

### URL Params & localStorage (Dashboard)

| Key | Type | Effect |
|---|---|---|
| `?sym=TICKER` | URL search param | Pre-selects active stock; written on click |
| `localStorage['dash-active-sym']` | string | Fallback persistence of active stock |
| `localStorage['dash-notes-v1']` | `Record<string,string>` | Per-symbol notes |
| `localStorage['dash-price-alerts-v1']` | `PriceAlert[]` | Price alerts |

Active stock resolution: `selectedStock` → `?sym=` → `localStorage['dash-active-sym']` → `stocks[0]`.

---

## `/stocks` — Stock Browser

**File:** `src/pages/Stocks.tsx`  
**Layout:** 3-column grid (lg:grid-cols-3). Left col: scrollable stock card list. Right 2 cols: active stock detail (chart + TV advanced chart).

### Left Column — Stock Cards

| Section | Details |
|---|---|
| Sticky header | "All Stocks" (bg-background z-10 pb-2) |
| Pinned stocks section | Each `PinnedStockCard`: X close button (top-right, bg-muted/80), ring `ring-2 ring-primary` if active, spinner if `useEodhdStock` loading |
| Local stocks section | First 8 eager-loaded, rest lazy via `IntersectionObserver` (300px rootMargin). `StockCardWithHistory` or `LazyStockCard`. X close button to hide. |
| Promoted stock | Selected via search promoted to top (not persisted) |

### Right Column — Active Stock

| Element | Details |
|---|---|
| `<StockChart>` | Range buttons 1W/1M/3M/1Y/5Y/All; symbol/name/price; height 256px md:384px |
| `<TradingViewChart>` (lazy via `LazySection`) | symbol, interval `D`, range mapped `daysToTvRange()` (5D/1M/3M/12M/60M/ALL), height 500, `hideSideToolbar`. Key remounts on symbol/range change. |

### URL Params

| Param | Effect |
|---|---|
| `?symbol={tkr}` | Load external (non-Supabase) stock as pinned card |
| `?exchange={X}` | Default "US" |
| `?name={Name}` | Display name |

Params cleared via `setSearchParams({}, { replace: true })` after processing.

### State

`selectedIndex` (-1 default), `chartDays` (30 default), `activePinnedKey` ("SYM.EXCHANGE"), `pinnedDataRef`, `promotedSymbol`.

### Hooks

`useStocks()`, `useStocksPrefs()` (hidden/pinned), `useEodhdBarsForChart(symbol)`, `useEodhdStock(symbol, exchange, name)`, `useSparklineData(symbol, days)`.

---

## `/watchlists` — Watchlist Manager

**File:** `src/pages/Watchlists.tsx`  
**Layout:** Split card; left panel 208px (collapsible) + right panel `flex-1`.

### Left Panel

| Section | Controls |
|---|---|
| Header | Star icon + "Watchlists" + "+" create button (`aria-label="Create new watchlist"`) |
| New list input (when `creating`) | Input placeholder "List name…", "Add" button, "X" cancel, Enter/Escape keyboard handling |
| List items (scrollable nav) | Star icon (filled if active) + name + count badge. Hover reveals Trash2 button (only if `lists.length > 1`). Active: bg-sidebar-accent; hover: bg-muted/50 |
| Footer | "{total_stocks} stocks · {list_count} list(s)" |

### Right Panel

**Empty states:**
- No list selected: Star icon + "Select a watchlist on the left"
- Empty watchlist: Search icon + "This watchlist is empty" + "Search for a stock above…"

**Header row:**
- Panel toggle (ChevronLeft/Right)
- `<EditableName>`: text button + Pencil icon (opacity-0 group-hover:opacity-100). Edit mode: input with `border-b border-primary max-w-[220px]`, green checkmark to confirm, Enter/Escape handling, text auto-selected.
- Badge: "{count} stocks"
- `<StockSearch>` placeholder "Add stock to watchlist…" (max-w-xs)

**Column headers (when entries exist):**
- Logo (w-8) · Symbol (w-36)
- Sparkline controls (hidden <xl): Maximize2/Minimize2 expand button · Eye/EyeOff show/hide button · period labels "7D 30D 60D 90D 120D 1Y"
- Price (flex-1, text-right)
- Chg % (w-20, hidden <sm)
- Chg $ (w-20, hidden <md)
- Mkt Cap (w-20, hidden <lg)
- Actions (w-20)

**`WatchlistStockRow` columns:**

| Column | Details |
|---|---|
| Logo | `<StockLogo size="sm">` colour-coded by exchange |
| Symbol + name | Bold ticker + exchange badge (px-1 py-0.5 text-[9px] bg-muted) + truncated name (text-xs) |
| Sparklines (hidden <xl) | Six sparklines: 7D, 30D, 60D, 90D, 120D, 1Y. Normal: 32×44. Expanded: 52×64. |
| Price | text-sm font-semibold tabular-nums |
| Change % (hidden <sm) | Arrow icon + % to 2 dp, color-coded |
| Change $ (hidden <md) | text-xs tabular-nums |
| Market Cap (hidden <lg) | text-xs text-muted-foreground |
| Actions (revealed on hover) | "Move to" dropdown (ChevronDown) showing other lists · External link → `/stocks?symbol=…&exchange=…&name=…` · Remove X (`aria-label="Remove {symbol}"`) |

**Sparkline data sources:**
- 7D/30D: hourly bars via `useIntradaySparkline(symbol, exchange)` (Yahoo Finance, 1h interval, 1 month). Fallback to daily slices if hourly unavailable.
- 60D–1Y: daily bars via `useSparklineData(symbol, days, exchange)` (EODHD 365-day base, sliced client-side).

**News section (bottom):** Only if `watchlistSymbols.length > 0`. `<NewsCard>` with combined Finnhub + DefeatBeta news, deduplicated, mt-6 spacing.

### State

`creating`, `newName`, `panelOpen` (default true), `sparklinesOpen` (default true), `sparklinesExpanded` (default false).

### Hooks

`useWatchlists()`, `useNews(symbols)`, `useDefeatBetaNews(symbols)`, `useEodhdStock(...)`, `useSparklineData(...)`, `useIntradaySparkline(...)`.

---

## `/markets` — Global Markets

**File:** `src/pages/Markets.tsx`  
**Layout:** PageLayout("Global Markets"). Full viewport locked. 2 heatmaps + index card grid.

| Section | Details |
|---|---|
| S&P 500 Heatmap | Header "S&P 500 Heatmap" (xs uppercase semibold). `<TradingViewHeatmap dataSource="SPX500" height={calculated}>`. Card overflow-x-auto min-h-[300px] |
| ETF Heatmap | Header "ETF Heatmap". `<TradingViewEtfHeatmap height={calculated}>` |
| Index Cards Grid | grid-cols-1 sm:2 lg:3 gap-4. 12 skeleton placeholders while loading (h-4/h-6/h-3 bg-muted animate-pulse) |

**`IndexCard`:** Flag icon (size 34) + index name (bold text-sm truncated) + region (text-xs muted) + value (font-mono text-xl bold, locale formatted) + change (font-mono text-sm color-coded) + change% (font-mono text-sm color-coded with +/-) + last updated (text-[11px] muted).

**Region order (`REGION_ORDER`):** UK, US, Japan, Germany, France, Hong Kong, Australia, Canada, Europe, S. Korea, India, Brazil.

**Heatmap height:** `useHeatmapHeight()` computes `(window − 224px LAYOUT_OVERHEAD) / 2`.

### Hooks: `useIndices()`

---

## `/currencies` — Currencies

**File:** `src/pages/Currencies.tsx`  
**Layout:** PageLayout("Currency Exchange"). space-y-6 sections.

| Section | Details |
|---|---|
| Live Exchange Rates Card | Header: TrendingUp icon + "Live Exchange Rates". Timestamp "Updated {time}" if available. grid-cols-1 sm:2 lg:4 gap-3. Each pair card: 2 CurrencyIcon + pair code · Rate (font-mono text-xl bold, .toFixed(4)) · Arrow icon up/down + change + change% (.toFixed(4)). Loading: spinner + "Loading live rates...". Error: "Unable to load rates. Try refreshing." |
| `<CurrencyConverter>` | Standalone component — From/To currency dropdowns, amount input, Swap button, result display |
| Forex Cross Rates Card | Header: Globe icon + "Forex Cross Rates". `<TradingViewForexRates height={420}>` in h-48 md:h-64 container |
| Forex Heatmap Card | Header: Flame icon + "Forex Heatmap". `<TradingViewForexHeatmap height={500}>` |

**Hooks:** `useCurrencyRates()` → `{ rates, convert, getRate, isLoading, isError, timestamp }`. `POPULAR_PAIRS` array of {from, to}. `CURRENCIES` array of supported codes.

---

## `/global` — Global Investment Hub

**File:** `src/pages/Global.tsx` (1000+ lines)  
**Layout:** Full-height (`h-screen flex flex-col`). Sticky header bar + main 50/50 split (sm:flex-row stacked on mobile).  
**Background:** NASA Tycho-2 skymap photo (hidden in perf mode) + 3 overlay layers (backlight halo gradient, vignette ellipse, darkening tint).

### Header Bar Controls

| Control | Behaviour |
|---|---|
| **Back button** (`<ArrowLeft>`) | Navigate to `/`. Label: "Back to dashboard" |
| **Title** | "Global Investment Hub" |
| **Flat Map toggle** | Icon `<MapIcon>`. Label: "Flat Map" (active) / "3D Globe" (inactive). State: `flatMap` |
| **Spin toggle** | 3D only, disabled in perf mode. Icons `<RotateCw>` (spinning) / `<Pause>`. Labels: "Spin On" / "Spin Off". State: `autoRotate` |
| **Day/Night toggle** | 3D only, disabled in perf mode. Icons `<Moon>` (active) / `<Sun>`. Real UTC solar terminator. State: `dayNightCycle` |
| **Country Colours toggle** | 3D only. Icons `<Palette>` (show) / `<PaintBucket>`. State: `showCountryColors` |
| **Perf Mode toggle** | Icons `<Zap>` (on) / `<ZapOff>`. Labels: "Perf Mode" / "Full Quality". Persisted to `localStorage['globe-perf-mode']`. Auto-detected on first load: enables if `hardwareConcurrency < 4` or `deviceMemory < 4` GB. |
| **Mode segmented group** | 3 options: Flags · Performance · Exchanges |

**Perf Mode effects:**
- Drops atmosphere, bump map, day/night
- Pixel ratio: 0.5/0.65 (mobile/desktop) vs 0.7/0.85 normal
- Event render cap: 80 per layer (vs 200)
- Vessel cap: 200 (vs 600)
- Flight cap: 300 (vs 1000)
- Skips NASA skymap (4 MB download)

### Left Pane — Globe / Map

**Rendering:** `<GlobeView>` (3D Three.js) or `<MapView>` (flat 2D), lazy-loaded with `<Loader2 className="animate-spin">` fallback.

**Dynamic sizing:** `useContainerSize()` via ResizeObserver, coalesced to 1 update/frame.

### Trade Layer System (state at page level)

`tradeActiveLayers: Set<LayerKey>`, `tradeSelectedNode: TradeNode | null`, `tradeWorldwide: boolean`, `tradeTabActive: boolean` (gates whether trade data flows to globe).

**Auto-includes:** `effectiveLayers` adds seaports if connectivity enabled; chokepoints if risk enabled.

**Country scoping:** When `!tradeWorldwide && selectedCountry`, `tradeVisibleNodes`/`tradeVisibleRoutes` filter to country only.

### Trade Data Layers (with fetch gates and rendering caps)

| Layer | Hook | Render gate | Render cap | Rank by |
|---|---|---|---|---|
| Live Vessels (AIS) | `useAISStream(enabled)` WebSocket | `tradeTabActive && liveVessels layer` | 200/600 | `lastSeen` desc |
| Live Flights | `useOpenSkyFlights(enabled)` HTTP poll | `tradeTabActive && liveFlights layer` | 300/1000 | (server-side) |
| Conflict Events | `useConflictEvents(enabled)` ACLED+GDELT | `tradeTabActive && (conflicts OR risk)` | 200/80 | fatalities → date |
| Earthquakes | `useEarthquakes(enabled)` USGS | `tradeTabActive && (earthquakes OR risk)` | 200/80 | USGS `sig` |
| Natural Events | `useNaturalEvents(enabledMap)` NASA EONET — wildfires, severeStorms, volcanoes, floods | per-category OR risk | 200/80 | date desc |
| Economic Events | `useEconomicEvents(enabled)` EODHD | `tradeTabActive && economicEvents` | — | — |
| Macro Heatmap | `useMacroHeatmap(enabled)` EODHD | `tradeTabActive && macroHeatmap` | — | — |
| Risk Overlay | `computeChokepointRisk()` | `tradeTabActive && risk layer` | score ≥0.2 | (computed) |
| Connectivity | `PORT_LSCI_BY_ID` (static) | `tradeTabActive && connectivity` | — | — |
| Commodity Flows | `COMMODITY_FLOWS` (static) | `tradeTabActive && commodityFlows` | — | — |
| Pipelines | `PIPELINE_ROUTES` (static) | `tradeTabActive && pipelines` | — | — |
| LPI Scores | `LPI_SCORES` (static) | `tradeTabActive && lpi` | — | — |
| Sanctions | `SANCTIONS` (static) | `tradeTabActive && sanctions` | — | — |
| Port Congestion | `PORT_CONGESTION` (static) | `tradeTabActive && portCongestion` | — | — |
| City Labels | (static) | `cityLabelsEnabled` | — | — |
| Waterways | (static) | `waterwaysEnabled` | — | — |
| Trade Partner Arcs | `useTradeBreakdown(iso, 'exports'\|'imports', 'partners')` WITS | `tradeTabActive && country selected && tradePartnerArcs` | top 8 each | share desc |

**AIS vessel type filter:** `vesselTypeFilter` state — `all | cargo (70-79) | tanker (80-89) | fishing (30) | passenger (60-69) | untyped`. Pill UI with count per type.

### Detail Dialogs (clicked-element popovers)

| Dialog | Trigger | Contents |
|---|---|---|
| `<ExchangeDetailDialog>` | exchange pin click | Exchange details |
| `<ConflictEventDialog>` | conflict marker click | Affected commodities + onSetAlert callback (seed alert) |
| `<EarthquakeDialog>` | earthquake click | Magnitude, depth, tsunami flag, supply chain impact + onSetAlert |
| `<NaturalEventDialog>` | wildfire/storm/volcano/flood click | Per-category details + onSetAlert |
| `<EconomicEventDialog>` | economic event click | Actual vs estimate, surprise direction |
| `<CommodityFlowDialog>` | flow click | Route, volume, commodity share |
| `<TradePartnersDialog>` | partner arcs layer | Draggable card; top exports (green) + imports (amber) + year + loading state. Close X disables `tradePartnerArcs` layer |

### Right Pane

**Conditional:** When country selected → `<CountryPanel>`. Otherwise → `<GlobalSummary>` (overview).

**`<CountryPanel>` props/tabs:**
- `onTabChange(tab)`:
  - `"trade"` → `setTradeTabActive(true)`, `setShowExchangePins(false)`
  - `"exchanges"` → `setShowExchangePins(true)`, `setTradeTabActive(false)`
  - Other tabs (Summary, Economy) → both false
- Receives: tradeActiveLayers/setter, tradeSelectedNode/setter, tradeVisibleNodes/Routes, tradeWorldwide/toggle, aisStatus/vesselCount/rawMsgCount/typeFilter/typeCounts, flightStatus/count, onExchangeClick.

### Mobile responsiveness

Height: 75vh default → 50vh when country selected → desktop auto. Altitude: 1.5 (mobile) vs 2.5 (desktop).

---

## `/portfolio` — Portfolio

**File:** `src/pages/Portfolio.tsx`  
**Layout:** PageLayout("Portfolio"). space-y-3. Top: flex row with NAV + P&L + Earnings cards. Below: 2-col grid (Allocation Explorer left, Holdings table right). Bottom: Correlation Matrix (full-width, conditional).

### Navbar Slot (Top Navbar)

| Control | Details |
|---|---|
| **Link/Unlink Sort button** | Label "Linked"/"Unlinked", icons `Link2`/`Unlink2`. Colours: bg-link-active when linked, bg-muted else. Tooltip explains sync state. |
| **Separator** | h-5 w-px bg-border |
| **Brokerage status (conditional)** | If connected: badge (`CheckCircle2` + name) + Sync button (`RefreshCw`/`Loader2`, calls `snapSync.mutate()`) + Add button (`PlusCircle`/`Loader2`, calls `snapConnect.mutate()`). If not connected: "Connect Brokerage" button (`Link2`/`Loader2`, label "Connecting…" while pending) |

### NAV Summary Card (conditional: `parsedStatement.nav.endingValue > 0`)

Inline label "NAV". Compact vertical stack (py-2 px-3):

| Row | Content |
|---|---|
| NAV | label + ending value + `ChangeBadge` (click toggles $ vs %) |
| TWRR | label + % + ChangeBadge |
| Commissions | label + total + ChangeBadge |
| Timeframe pills | 1W · MTD · 1M · 3M · YTD · 1Y · All (`PNL_TIMEFRAMES` constant). Active: bg-primary, inactive: bg-muted |

### P&L Timeframe Card

Inline label "P&L". HoverCard trigger: timeframe button (link-style, `underline decoration-dotted`).

**HoverCard content (w-72):**
- "BREAKDOWN" heading
- Realized / Unrealized / Total rows
- "TOP UNREALIZED" (top 5 by symbol, if positions > 0)
- "TOP REALIZED" (top 5 by symbol, if trades > 0)

**Main display:** Large bold P&L (color: success ≥0, danger <0).

**Sparkline:** If `cumulativeCurve.length >= 2`, height 56, `showBaseline`, `highlightIndex=last`, `ariaLabel` includes timeframe + total.

### Earnings Calendar Card (conditional: `holdings.length >= 2`)

Standalone component. Receives holdings enriched with ticker/exchange/sector.

### Market Cap Distribution Card (Donut Pie)

Inline label "Market Cap". 100×100 pie, innerRadius 28, outerRadius 44.

**Segments (`MCAP_TIERS`):** Mega Cap (≥$200B) · Large Cap (≥$10B) · Mid Cap (≥$2B) · Small Cap (≥$300M) · Micro Cap (else).

**Tooltip:** name, pct%, holding count. **Legend below:** coloured dot + tier name + percentage.

Conditional: only if `buckets.length > 0`.

### Allocation Explorer Card (Left col)

`bg-card rounded-lg shadow h-[648px]` wrapper around `<AllocationExplorer>`.

Tabs: **Position · Sector · Sub-Industry · Country · Market Cap · Style** (controlled via `activeGroupingKey`). Controlled sort: `effectiveAllocSortCol`/`effectiveAllocSortAsc`.

Hooks inside: `useQuery` (symbol info, staleTime 0, refetchOnMount always), `useMarketCaps`, `useTickerStyles`, `use52Week`, `useAnalystRatings`.

### Holdings Table Card (Right col)

`bg-card rounded-lg px-3 py-3 shadow min-h-[420px]`.

**Header row:** "Holdings" title + count badge (if filtered) + Expand/Collapse button (only if > 15 holdings; labels "Expand ({count})" / "Collapse"; text-[10px] font-medium muted border bg-muted/40).

**Table aria-label:** "Portfolio holdings". `overflow-x-auto`; max-h-[596px] when collapsed.

**12 columns:**

| # | Column | Sortable | Format |
|---|---|---|---|
| 1 | Ticker | Yes | font-mono + colored sector dot + secondary line (sub-industry or company name) |
| 2 | Shares | Yes | right-aligned mono |
| 3 | Cost | Yes | right-aligned mono $ |
| 4 | Mkt Val | Yes | right-aligned mono $ |
| 5 | P&L | Yes | right-aligned mono, success/danger color |
| 6 | 52W | No | Position bar chart (low→high) with color indicator + % position |
| 7 | Target | Yes | right-aligned mono emerald-300 |
| 8 | →Tgt% | Yes | right-aligned mono emerald-400/rose-400 % |
| 9 | Stop | Yes | right-aligned mono rose-300 |
| 10 | →Stop% | Yes | right-aligned mono emerald-400/rose-400 % |
| 11 | Analyst | No | center-aligned consensus label + target + count |
| 12 | Style | No | center-aligned `<TickerStyleEditor>` |

**Sort column keys (`HoldingsSortCol`):** ticker, shares, cost, marketValue, pl, sector, country, marketCap, tradeStyle, priceTarget, stopLoss, distToTarget, distToStop, range52pos, analyst.

**Group headers** (when `activeGroupingKey !== 'Position'`): colored border-l-2 bar with group label.

### Correlation Matrix (full-width, conditional: `holdings.length >= 2`)

`<CorrelationMatrix>` with ticker, name, exchange, sector, subIndustry, marketValue per holding.

### Empty / Loading / Error states

- Loading: "Loading portfolio…" centered
- Empty: "No holdings yet. Upload a statement or use Connect Brokerage at the top to auto-import positions."

### Hooks

`usePortfolio()`, `useStatement()`, `useMarketCaps()`, `useTickerStyles()`, `use52Week()`, `useAnalystRatings()`, `useQuery` (symbol info), `useLinkedSort()`.

---

## `/performance` — Performance

**File:** `src/pages/Performance.tsx`  
**Layout:** PageLayout("Performance"). space-y-6.

### Controls Bar

Flex justify-between mb-6:

| Control | Details |
|---|---|
| Benchmark selector | `<Select>` w-48 h-8 text-sm. Options from `BENCHMARK_LABELS` (SPY, QQQ, IWM, etc.). |
| Date range pills | 3 buttons (bordered): **1Y** (default) · **3Y** · **Max**. Active: bg-primary, inactive: hover bg-muted. |

### Sections

| Section | Component | Props |
|---|---|---|
| KPI grid | `<PerformanceKpiGrid>` | summary, isLoading |
| Charts row (flex md:flex-row gap-4, each h-48 md:h-72) | `<EquityCurveChart>` + `<DrawdownChart>` | data, benchmarkLabel, isLoading |
| Performance table | `<PerformanceTable>` | rows, mode (`TableMode='returns'`), onModeChange, isLoading |
| Attribution (conditional: `attribution.length > 0`) | `<AttributionSection>` | rows, grouping (`AttributionGrouping='sector'`), onGroupingChange |
| Correlation (conditional: `holdingSymbols.length >= 2 && correlations.length > 0`) | `<CorrelationMatrix>` | entries, symbols |

### Empty / Error states

- Empty (`!isLoading && holdings.length === 0`): TrendingUp icon (h-12 w-12) + "No portfolio holdings yet" + "Add holdings…" + "Go to Portfolio" Link button
- Error: "Failed to load performance data" + error.message + Retry button (`window.location.reload()`)

### State

`benchmark: BenchmarkKey = 'SPY'`, `dateRange: DateRange = '1Y'`, `tableMode: TableMode = 'returns'`, `attributionGrouping: AttributionGrouping = 'sector'`.

### Hooks

`usePortfolioPrices(benchmark)`, `useHoldingSectors(tickers)`, `usePerformanceMetrics({ portfolioData, benchmark, dateRange, attributionGrouping, sectorMap })`.

---

## `/risk-analysis` — Risk Analysis

**File:** `src/pages/RiskAnalysis.tsx`  
**Layout:** PageLayout("Risk Analysis"). space-y-6. 11 stacked sections.

| # | Section / Component | Key Details |
|---|---|---|
| 1 | `<RiskScoreCard>` | Composite risk rating from `holdings, portfolioBeta, annualVol, maxDrawdownPct` |
| 2 | Risk Metrics card | Header: `<ShieldAlert>` + "Risk Metrics" + description "Comprehensive risk analysis and portfolio statistics". Left: 40×40 donut pie (innerRadius 45 outerRadius 70) colored by `getGicsSectorColor()`, center overlay "Positions" + count. Right: 2-col holdings grid (max-h-[300px] scroll) with `<SectorDot>` + ticker + `<SectorBadge>` + portfolio% + market value. |
| 3 | `<ConcentrationRiskCard>` | HHI, top-5 %, position warnings |
| 4 | `<CountryExposureCard>` | Stacked bar by country |
| 5 | Portfolio Beta Graph | Header: `<Activity>` + "Portfolio Beta Graph" + description. Inner card bg-muted/30. Header row: "Portfolio Beta (vs SPY, 1Y)" label. Loading: `<Loader2>` + "Calculating…". Value: text-3xl bold mono. Badge: Low Risk / Moderate / High Risk. Beta bar: h-5 rounded-full flex, each segment width `weight*100%`, bg `getGicsSectorColor(sector)`, title `{ticker}: β{beta} ({weight%})`. Scale labels 0% · 50% · 100% (text-[10px] mono muted). |
| 6 | `<ValueAtRiskCard>` | 95% VaR (1-day), CVaR — portfolioValue, returns, spyReturns, isLoading |
| 7 | `<HistoricalDrawdownCard>` | Max drawdown %, recovery, largest period — portfolioValue, returns, spyReturns, dates, isLoading |
| 8 | `<SectorCrashCard>` | Table: sector, weight, P&L impact at -10/-20/-30% |
| 9 | `<MarketPositionWidget>` | Long/short/net exposure, leverage — holdings, ranges, isLoading, isError, totalHoldings |
| 10 | `<RebalancingWidget>` | Target allocations, drift, recommendations |
| 11 | `<StressTestSection>` | Scenario sliders, real-time P&L impact |

### Data Normalization

Two paths: `normalizeFromParsed()` (ParsedStatement.openPositions) and `normalizeFromPortfolio()` (DB holdings). Parsed takes priority if available.

### Hooks

`usePortfolio()`, `useStatement()`, `useQuery` (GICS sector batch via `batchLookupSymbols()`), `useBeta(tickers, weights, enabled)`, `use52Week(tickers, enabled)`.

### States

- Loading: "Loading risk data…"
- Empty: "Upload a statement on the Portfolio page or add holdings to view risk analysis."

---

## `/analysis` — Market Analysis

**File:** `src/pages/Analysis.tsx`  
**Layout:** PageLayout("Market Analysis"). 2-column grid (lg:grid-cols-2).

| # | Section | Details |
|---|---|---|
| 1 | Stock Fundamentals Lookup | `<FundamentalsLookup>` — single search card, EODHD-sourced |
| 2 | NASDAQ 100 Heatmap | Title "NASDAQ 100 Heatmap". `<TradingViewHeatmap dataSource="NASDAQ100" blockColor="change" height={450}>` |
| 3 | Sector Performance (left col) | Title "Sector Performance" + subtitle "SPDR Sector ETFs · Live via Finnhub". Recharts BarChart h-48 md:h-80. XAxis rotated -35°. YAxis % formatter. Tooltip "${v}% / {symbol}". Bars radius [4,4,0,0]. Cells: green via `getGicsSectorColor()` if ≥0, else #ef4444 red. Loading: animated "Loading…". **11 SPDR ETFs:** XLK · XLV · XLF · XLY · XLP · XLE · XLB · XLU · XLI · XLRE · XLC. |
| 4 | Technical Analysis — S&P 500 (right col, h-300) | `<TradingViewTechnicalAnalysis symbol="SP:SPX" interval="1D" height={300}>` |
| 5 | Stock Performance Treemap (lg:col-span-2) | Title "Stock Performance (Top 50)" + subtitle "Top 50 by market cap · Cell size = absolute % change". Recharts Treemap h-48 md:h-80. Custom `TreemapCell`: green if >0, red if <0, gray if 0. White bold symbol + change% below. Text only if width>50 && height>30. Empty: "No stock data available". |
| 6 | Market Breadth (left col, h-40) | Title "Market Breadth" + subtitle "Top {count} stocks · Advancing vs Declining". 3 horizontal stacked bars: Advancing · Declining · Unchanged. Each row: label, count, % avg change, color-coded bar. A/D Ratio in mono color-coded. Empty: "No price movement data" + nightly computation note. |
| 7 | Most Capitalized (right col, h-80) | Title "Most Capitalized". `<TradingViewScreener defaultScreen="most_capitalized" defaultColumn="overview" height={320}>` |
| 8 | Top Gainers (lg:col-span-2, h-100) | Title "Top Gainers". `<TradingViewScreener defaultScreen="top_gainers" defaultColumn="performance" height={400}>` |

### Hooks

`useTopStocksByMarketCap(count)`, `useSectorETFQuotes()` (Finnhub, staleTime 60s).

---

## `/screener` — Screener & Calendar

**File:** `src/pages/Screener.tsx`  
**Layout:** PageLayout("Screener & Calendar"). Tabs (default `screener`).

| Tab | Contents |
|---|---|
| **Screener** (default) | `<StockSearch placeholder="Search by ticker or company name..." max-w-md mb-4>`. `<TradingViewScreener defaultColumn="overview" defaultScreen="most_capitalized" market="america" showToolbar height={550}>` in bordered card overflow-x-auto |
| **Calendar** | `<TradingViewEconomicCalendar height={600} importanceFilter="-1,0,1">` in bordered card overflow-x-auto |

---

## `/trading` — IBKR Trading

**File:** `src/pages/Trading.tsx`  
**Layout:** PageLayout("IBKR Trading", description="Interactive Brokers trading dashboard — manage positions, orders, and execute trades.", canonical="/trading"). space-y-5 `.trading-terminal`.

### Header Strip

| Control | Details |
|---|---|
| "Trading" title | text-base font-semibold |
| Account selector (multi-account only) | `<Select>` w-auto h-8 text-xs. Options = account IDs. |
| ConnectionStatus | Shows: "Gateway Offline" (with muted dot) if `notConfigured`; "Connected" (green pulse-live dot) or "Not Authenticated" (red pulse-live dot). Uses `useIBKRAuthStatus()` + `useIBKRTickle()`. |

### `<TradeTracker>` (always shown, broker-independent)

Wrapped in `<ErrorBoundary name="TradeTracker">`. Major component with two panels:

#### Left Panel — New Trade Entry

| Control | Details |
|---|---|
| Symbol search | Placeholder "Search ticker or company…". Autocomplete dropdown: ticker + name + exchange code. Shows `<Zap>` icon loading state during quote fetch. |
| Sparkline (conditional) | Rendered if `chartBars?.length > 0`. Shows intraday bars for selected symbol. |
| ⚡ Quick-fill button | Disabled if `draftLive == null` |
| Long/Short toggle | Segmented buttons; visual state change on select |
| Quantity input | type="number" min=0 |
| Entry input + "Market" button | type="number" min=0 step=0.01. Market button disabled if `draftLive == null`. Status indicator: "● live" or "🔒 locked" based on `entryFollowing` |
| Stop input | type="number" + 4 percent quick buttons: **−1% · −2% · −3% · −5%**. Disabled if entry ≤ 0. |
| Target input | type="number" + 3 R-multiple quick buttons: **+1R · +2R · +3R**. Disabled if entry ≤ 0 or stop null. |
| Setup input | Autocomplete from saved setups (playbook + journal) |
| Entry date input | type="date" |
| R/R bar | Visualization (rendered only if bar data exists) |
| Payoff gauge | If Stop / If Target / Now columns. Rendered only if `pay.ifStopped \|\| pay.ifTarget`. |
| Live deal preview | Risk:Reward, $ at risk, Position value, warnings/hints |
| Submit button | "Track Long/Short {symbol} trade". Disabled if incomplete. |

#### Right Panel — Open Positions

**Header:** Title + refresh-rate toggle (⚡ button, 5s ↔ 30s) + count.

**Open risk summary:** Total $ + % of account + no-stop count.

**Per-position card** (border-left: green long / red short):

| Element | Details |
|---|---|
| Header | Symbol · Side badge · R:R · Days held |
| Numbers grid | Qty · Entry · Stop · Target |
| Live row | Last price · P&L ($) · R multiple · Stop proximity · Target proximity. "waiting for price…" if `livePrice == null`. "stop hit"/"target hit" in bold if breached. |
| Sparkline | With entry/stop/target reference lines |
| Plan-valid toggle | `<CheckCircle2>` "Plan valid" / "Plan in question" |
| "Close → Journal" button | Opens inline close form |
| "Edit" button | Toggles inline edit form |
| "X" discard button | Removes without journal entry; undo toast |

**Close form (when `closingId === t.id`):**
- Exit price input (type="number" step=0.01)
- Qty to close (type="number" min=0 step=1)
- Exit date (type="date")
- Exit reason dropdown: `target | stop | time | discretion | panic`
- Fees (type="number" step=0.01)
- Close notes (type="text")
- "Confirm close & add to Journal" button

**Edit form (when `editId === t.id && !closing`):**
- Stop (type="number" step=0.01)
- Target (type="number" step=0.01)
- Notes (type="text")
- Save / Cancel buttons

**Recently Closed section** (collapsible, only if `justClosed.length > 0`, opacity-reduced):
- Per row: Symbol · Side · Qty · Entry→Exit · P&L (+/-$) · (R multiple) · Tag · Exit date

**Empty state:** Centered icon + "No open trades tracked".

**Reads localStorage:** `tp-playbook-v1` (saved setups), `tp-risk-v1` (account/risk%), `tp-entry-defaults-v1` (stop %, target R).

**Hooks:** `useTradeJournal()`, `useOpenTrades()`, `useLiveSpeed()`, `useSymbolSearch()`, `useJournalSettings()`, `useSparkline(symbol)`, `useLiveQuotes(symbols, intervalMs)`, `fetchYahooQuote()`.

### `<AccountStats>` row (IBKR connected only)

4-col grid via `<StatsCard>`:

| Card | Source field | Icon |
|---|---|---|
| Net Liquidation | `summary?.totalcashvalue?.amount ?? summary?.netliquidation?.amount` | `<Briefcase>` |
| Daily P&L | `pnl?.upnl?.dpl` | `<TrendingUp>` |
| Unrealized P&L | `pnl?.upnl?.upl` | `<Activity>` |
| Buying Power | `summary?.buyingpower?.amount` | `<DollarSign>` |

All formatted via `fmtCurrency`. P&L colored via `pnlClass`. Trend prop 1/-1.

### Main Workspace Grid (lg:grid-cols-3)

#### Left 2/3 — Tabs + Chart

**Tab strip (`<TabsList>`):**

| Tab | Icon | Visibility |
|---|---|---|
| Watchlist | `<Eye>` | Always |
| Positions | `<Briefcase>` | IBKR connected only |
| Orders | `<Zap>` | IBKR connected only |
| Trades | `<Radio>` | IBKR connected only |

When disconnected, `activeTab` forced to `watchlist`.

**Watchlist Tab — `<Watchlist>`:**

| Element | Details |
|---|---|
| Header | "Watchlist" title + Eye icon + refresh-rate toggle (only if symbols exist) |
| Add row | Search input placeholder "Add a ticker or company…", autocomplete with ticker+name+exchange |
| Each row (`role="button"`, tabIndex=0, Enter/Space) | Symbol (bold, w-16) · Last price (mono, w-20, right) · Sparkline (64×24px) · Window change ($ + %, color-coded) · Send-to-ticket arrow button · Remove X. Selected: ring-1 ring-primary/40 + bg-muted/40 |
| Gateway note (dismissible) | "Connect an IBKR gateway for live order execution." + X dismiss |
| Empty | Icon + "Add symbols to build your watchlist." |

Hooks: `useWatchlist()`, `useLiveSpeed()`, `useLiveQuotes()`, `useSymbolSearch()`, `useSparkline()`.

**Positions Table (IBKR only):** Card. 7 cols: Symbol · Description (hidden md) · Qty (right) · Mkt Price (right) · Mkt Value (right, hidden sm) · Avg Cost (right, hidden sm) · Unrealized P&L (right, with ArrowUpRight/Down icon if non-zero). Loading skeleton h-48. Empty: `<Briefcase>` icon + "No open positions".

**Orders Table (IBKR only):** 7 cols: Symbol · Side badge (BUY green / SELL red) · Type · Qty (right) · Price (right, MKT if null) · Status badge · Action (X cancel button). Cancel uses `useIBKRCancelOrder()` with toast feedback. Empty: `<Zap>` icon + "No active orders".

**Trades Table (IBKR only):** 6 cols: Symbol · Side badge · Qty (right) · Price (right) · Commission (right, hidden sm) · Time (hidden md). Empty: `<Radio>` icon + "No recent trades".

**Below tabs:** `<SymbolChart>` for `selSymbol`. Header "Chart" or symbol name + 4 range buttons (1D · 1M · 3M · 1Y, active=secondary/inactive=ghost variant). Empty: "Select a symbol to chart." / "Chart unavailable for {symbol}." Recharts AreaChart 260px with gradient fill (green if up, red if down). X-axis: time HH:MM (1D) or date M/D. Loading: skeleton. Data: `useQuery(['symchart', sym, range])` → `fetchYahooChart()`, staleTime 10min, gcTime 15min.

#### Right 1/3 — LivePrices + Order Ticket

**LivePrices Card (`trading-card` class, IBKR only):**
- Header: `<Activity>` icon + "Live Prices" + pulse-live green dot
- Up to 10 conids from positions
- Per row: symbol/conid · last price (mono) · change + change% (color-coded)
- Field map: `'31'` (last), `'84'` (change), `'85'` (changePercent)
- Empty: "Prices will appear once you have open positions."
- Source: `useIBKRSnapshot(conids)`

**Order Ticket / QuickOrder Card (`trading-card` class):**

Header: `<Zap>` + "Order Ticket".

| Control | Details |
|---|---|
| Symbol search | Placeholder "Search symbol…". `<Input className="pl-9 font-mono text-sm" autoComplete="off">`. Search icon left. Autocomplete dropdown (z-30, max-h-64): per row symbol (mono bold) + name (truncated) + exchange code (uppercase muted). `onMouseDown` selects + closes. Outside-click closes via `useEffect`. |
| Live price line (conditional) | `<Zap>` + "Live $X.XX · {name}" (if `livePrice != null`) |
| Contract result (connected only) | bg-muted/50 rounded card: company name + "conid: X · STK" |
| Buy/Sell toggle | 2-col grid. Active: `btn-buy`/`btn-sell`. Inactive: bg-muted. |
| Order type select | Options: **Market (MKT)** · **Limit (LMT)** · **Stop (STP)** |
| Quantity stepper | Label "Quantity". 3 cells: `<Button outline icon Minus>` · `<Input type="number" min=1 center font-mono-num>` · `<Button outline icon Plus>`. Auto-computes from `tp-risk-v1` via `qtyFromRisk(entry, stop, account, riskPct)` unless `qtyTouched`. |
| Entry input | Label "Entry". type="number" step=0.01 placeholder "0.00" + "Use live" inline button (disabled if `livePrice == null`) |
| Stop input | Label "Stop". type="number" step=0.01 placeholder "0.00" + 4 quick buttons: **−1% · −2% · −3% · −5%** (text-[10px] mono, disabled if entry ≤0). Each calls `applyStopPct(p)` → `stopFromPct(side, entry, p)`. |
| Target input | Label "Target". type="number" step=0.01 placeholder "0.00" + 3 quick buttons: **+1R · +2R · +3R** (disabled if entry ≤0 or stop null). Each calls `applyTargetR(r)` → `targetFromR(side, entry, stop, r)`. |
| Limit/Stop Price (conditional, orderType ≠ MKT) | Label "Limit Price" or "Stop Price". type="number" step=0.01 |
| Risk preview panel (rounded border bg-muted/30 p-3) | 3 rows: **Risk : Reward** (color: green ≥2, yellow ≥1.5, red else); **$ at risk** + ` · X.XX%` account risk; **Position value**. Over-risk warning: `<AlertTriangle>` + "Exceeds your saved max risk %." Source: `riskPreview()` from `src/lib/riskPreview.ts`. |
| Submit button | Label changes through 3 states: idle `{action} {qty} {sym}`, confirming `Confirm {action} {qty} {sym}`, pending `Submitting…`. Action word: "BUY"/"SELL" when connected, "Track BUY"/"Track SELL" when disconnected. Two-step confirm: first click sets `confirming=true`, second click executes. Reset whenever any field changes. |

**Two execution paths:**
- **Connected** (`isConnected`): `placeOrder.mutate({ accountId, orders: [{ conid, orderType, side, quantity, price (if not MKT), tif: 'DAY' }] })` via `useIBKRPlaceOrder()`. Toast on success/error.
- **Disconnected**: `addOpen({ id, symbol, side ('long'/'short'), quantity, entryPrice, stopLoss, target, entryDate, planValid: true })` via `useOpenTrades()`. Toast "Tracked — see Trade Tracker".

Reads `localStorage['tp-risk-v1']` via `readRiskParams()` for account/riskPct used in risk preview + qty auto-calc.

---

## `/calculators` — Calculators

**File:** `src/pages/Calculators.tsx`  
**Layout:** PageLayout. Left category nav (icon + label) + right calculator panel. Active via URL hash.

### 7 Categories × 27 Calculators

| Category | Icon | Calculators |
|---|---|---|
| **Wealth Building** | `TrendingUp` | Compound Interest · Dollar-Cost Averaging · FIRE / Retirement · Mortgage vs Invest · Roth vs Traditional · Inflation-Adjusted · Asset Allocation |
| **Trading** | `BarChart2` | Position Sizing · Risk / Reward · Margin & Leverage · Short Selling · Drawdown Recovery · Trade Expectancy · Kelly Criterion · Pyramiding |
| **Options** | `Layers` | Options P&L · Covered Call · Cash-Secured Put · Vertical Spread · Black-Scholes |
| **Real Estate** | `Home` | Rental Cash Flow |
| **Tax & Cost** | `Receipt` | Capital Gains Tax · Tax-Loss Harvesting · Cost Basis Methods |
| **Income** | `DollarSign` | Dividend Projector · Dividend Growth Model |
| **Fees** | `Percent` | Advisor / Manager Fee · MER / Fund Expenses · All-In Comparison |

### URL Hash Routing

`getActiveId()` reads `window.location.hash`. Listens to `hashchange` event. Default: `compound-interest`. Shareable: `/calculators#kelly-criterion`.

### Legacy Redirect

`/fee-calculators` → `<Navigate to="/calculators" replace>` (React Router).

---

## `/journal` — Trade Journal

**File:** `src/pages/TradeJournal.tsx`  
**Layout:** PageLayout("Trade Journal"). Header actions → `<HeroStatsRow>` → 8-tab `<Tabs>` → dialogs.

### Header Actions

| Button | Behaviour |
|---|---|
| **Import from IBKR** | Outline variant + `<Download>` icon. Opens `<IbkrImportDialog>` |
| **Log Trade** | Primary + `<Plus>` icon. Calls `tryOpenForm()` — guarded by **kill switch** `isDailyMaxLossHit(trades, settings)`. If hit, shows `confirm("You've hit your daily max loss. Log this trade anyway?")` — only proceeds on user confirm. |

### `<HeroStatsRow>` — 6 Tiles

| Tile | Value | Tone |
|---|---|---|
| Total P&L | cumulative profit/loss | TrendingUp green if ≥0, TrendingDown red if <0 |
| Win Rate | % of winning trades | — |
| Profit Factor | gross profits / gross losses | "∞" if infinite |
| Expectancy / trade | avg P&L per trade | green ≥0, red <0 |
| R-Expectancy | avg R won/lost | green ≥0, red <0, "—" if null |
| Streak | win/loss/none | TrendingUp (win), Flame red (loss), TrendingUp (none) |

### 8 Tabs

| # | Tab | Icon | Component / Content |
|---|---|---|---|
| 1 | **Overview** | `<Activity>` | `<OverviewTab>` |
| 2 | **Open** | `<Radar>` | `<OpenPositionsView>` (defined inline) |
| 3 | **Calendar** | `<CalendarDays>` | `<PnLCalendar>` + `<DayOfWeekHeatmap>` + `<HourOfDayHeatmap>` in Card p-6 space-y-6 |
| 4 | **Equity Curve** | `<LineChart>` | Card p-6 with "Cumulative P/L" heading + `<CumulativePnLChart>` |
| 5 | **Analytics** | `<BarChart3>` | `<AnalyticsTab>` |
| 6 | **Trades** | `<List>` | Card p-4 with `<TradeLogTable>` |
| 7 | **Rules** | `<ScrollText>` | `<RulesTab>` |
| 8 | **Strategy** | `<Map>` | `<StrategyTab>` |

### Tab 1: `<OverviewTab>` Sections

1. `<KillSwitchBanner>` (conditional)
2. **TopStatsRow** — 4 columns: **Today** (count, P&L, W/L) · **This week** (vs last week) · **This month** (total + count) · **Avg W:L Ratio**
3. **MiniEquityCurve** — Recharts AreaChart with gradient fill. X: date (M/D). Y: cumulative P&L (currency). Inline stats: Total · Peak · Drawdown. Empty state if no trades.
4. **RecentActivityCard** — Last 10 trades as circular badges + recent 5-trade list (Symbol with color badge for long/short · Setup badge · Exit date · R value · P&L). Click row to edit.
5. **BestWorstSetupCard** (conditional: ≥1 setup with ≥3 trades; worst only if 2+ setups and worst negative)
6. **PerformanceBySideCard** (conditional: both long and short trades exist) — Long vs Short P&L + win rate
7. **InsightsSection** — Pattern insights (day-of-week, after-loss). Placeholder if 5–40 trades. Nothing if <5 or ≥40.
8. **OutlierLossList** — Largest losing trades

### Tab 2: `<OpenPositionsView>` (defined inline in TradeJournal.tsx)

Read-only mirror of `useOpenTrades()` (`open-trades-v1`).

**Empty state:** Card p-8 centered: `<Radar>` icon + "No open positions tracked." + Link "Track a live trade in My Trading Plan →"

**Populated state:**
- Header: "{N} open position(s) · read-only — manage & close in My Trading Plan → Trade Tracker. Closing there files it here automatically."
- 10-column table:

| Column | Format |
|---|---|
| Symbol | semibold |
| Side | `long` green-success / `short` red-danger, uppercase |
| Qty | right tabular-nums |
| Entry | right `$X.XX` |
| Stop | right `$X` or "—" |
| Target | right `$X` or "—" |
| R:R | right `X.X:1` or "—" |
| Setup | muted, "—" if none |
| Held | right `Xd` |
| Plan | `✓ valid` green-success / `⚠ review` red-danger |

R:R computed: `|target - entry| / |entry - stop|`. Held days: `floor((now - entryDate) / 86_400_000)`.

### Tab 3: `<PnLCalendar>`

| Element | Details |
|---|---|
| Header | Previous month (`ChevronLeft`) · Month label · Next month (`ChevronRight`) · Today text button |
| Grid | 7-col × 6-row max. Empty cells (not in month) reduced bg. Today highlighted with primary circle around day number. |
| Cell colours | Green winning: bg-green-500/8, /15, /25 by P&L magnitude. Red losing: bg-red-500/8, /15, /25. |
| Cell content | P&L amount + trade count |
| Click | Triggers `onDayClick(date)` → opens `<DayDetailDialog>` |
| Footer | "Net: $X" if trades exist, else "No trades this month" |

### Tab 3 (continued): `<DayOfWeekHeatmap>`

7-column heatmap (Sun · Mon · Tue · Wed · Thu · Fri · Sat). Cell colours green/red by aggregate P&L. Intensity normalized by max |P&L|. Tooltip: "{Day}: {count} trades, {winRate}% win rate, ${P&L}". Count + label below day name.

### Tab 3 (continued): `<HourOfDayHeatmap>`

9-column heatmap (9:00 · 10:00 · ... · 17:00). Cell colours green/red by aggregate P&L. Tooltip: "{hour}:00 — {count} trades, {winRate}% win rate, ${P&L}". Off-hours bucket if entries exist outside 9–17. Empty: "No trades have an entry time set...".

### Tab 4: `<CumulativePnLChart>`

Recharts AreaChart h-72 (288px) with gradient fill. X: date (M/D). Y: cumulative P&L (currency). ReferenceLine y=0. Gradient color: `#4ade80` green if final ≥0, `#f87171` red else. Empty: "No trade data to chart".

### Tab 5: `<AnalyticsTab>` Sub-components

1. **EdgeQualityRow** — top-level edge metrics
2. **TradeAnatomyCards** — typical winner vs typical loser comparison
3. **BehavioralCard** — plan adherence, off-script trades
4. **FeeImpactCard** — fees as % of P&L
5. **BySetupTable** — win rate, P&L, count per setup
6. **BySymbolTable** — win rate, P&L, count per symbol
7. **ByMistakeTable** — win rate, loss rate per mistake category
8. **ByExitReasonChart** — P&L distribution by exit reason (target/stop/time/discretion/panic)

### Tab 6: `<TradeLogTable>`

**Filter Row (4 controls):**

| Control | Details |
|---|---|
| Symbol search | text input, placeholder "Search symbol…", w-40 h-8, live filtering |
| Setup filter | Select dropdown w-40 h-8. Options: "All setups" + each setting |
| Side filter | Select dropdown w-32 h-8. Options: All sides · Long · Short |
| Off-Script toggle | Checkbox + label "Off-script only". Filters to `inPlaybook !== false` |

**14 columns:**

| # | Column | Sortable | Format |
|---|---|---|---|
| 1 | Date | Yes (`exitDate`) | YYYY-MM-DD mono |
| 2 | Symbol | Yes | bold |
| 3 | Side | Yes | Badge Long=green / Short=red |
| 4 | Qty | No | right mono |
| 5 | Entry | No | right mono $X.XX |
| 6 | Exit | No | right mono $X.XX |
| 7 | Fees | No | right mono $X.XX muted |
| 8 | P/L | Yes (`pnl`) | right bold green/red |
| 9 | R | No | right "+R.RR" or "—" |
| 10 | Setup | No | Outline badge or "—" |
| 11 | Mistakes | No | 3 red dots + "+N" if >3 |
| 12 | Screenshot | No | Camera icon if present |
| 13 | Notes | No | Truncated 120px max-width + tooltip |
| 14 | Actions | No | Edit (`<Pencil>`) + Delete (`<Trash2>`) |

Empty: "No trades logged yet" or "No trades match the current filters."

### Tab 7: `<RulesTab>` — 4 Sections

| Section | Controls |
|---|---|
| **Account Size** | Single number input. Label "Account size". Placeholder "$0". Optional positive number. |
| **Setups (Playbook)** | Editable badge list. Add row: input placeholder "Add setup name…" + "Add" button. Per badge: text + X delete. "Reset to defaults" button per list. |
| **Mistakes Taxonomy** | Same pattern. Placeholder "Add mistake name…" |
| **Goals** | 4 `NumGoal` inputs: **Daily target** · **Weekly target** · **Monthly target** · **Daily max LOSS**. All type=number, placeholder "$0" |

State: `newSetup`, `newMistake` drafts. Hooks: `useJournalSettings()`.

### Tab 8: `<StrategyTab>` — Auto-saving Document Editor

**Strategy Name** input — type=text, placeholder "e.g. Momentum Breakout v2", save on blur. Last-saved timestamp displayed if `doc.updatedAt` exists.

**11 Textarea sections** (each saves on blur, rows 3–8):

| # | Section Title | Placeholder/Prompt |
|---|---|---|
| 1 | My Edge | Why does the strategy work? |
| 2 | Instruments I Trade | What do you trade and why? |
| 3 | Trading Hours | When do you trade? |
| 4 | Market Conditions to Trade | When is strategy in its element? |
| 5 | Conditions to Avoid | When to sit on hands? |
| 6 | Entry Criteria | What conditions must ALL be true? |
| 7 | Exit Plan | How and when you exit (winners and losers) |
| 8 | Risk Management Rules | Non-negotiable risk rules |
| 9 | Position Sizing | How you determine share/contract count |
| 10 | Strategy Notes & Refinements | Running log of observations |

Hook: `useStrategyDoc()` → `{ doc, saveDoc }`. localStorage-backed.

### `<TradeFormDialog>` — Add/Edit Trade

**Form fields (react-hook-form + Zod):**

| Section | Field | Type | Validation |
|---|---|---|---|
| **Symbol & Side** | Symbol | text Input, placeholder "AAPL", uppercase transform | Required |
| | Side | Select: Long / Short | Required, default "long" |
| **Qty & Fees** | Quantity | number, placeholder "100", step="any" | Required, > 0 |
| | Fees ($) | number, placeholder "0", step="0.01" | Optional, min 0, default 0 |
| **Entry & Exit** | Entry Price | number, placeholder "150.00" | Required, > 0 |
| | Exit Price | number, placeholder "155.00" | Required, > 0 |
| **Risk** | Stop Loss | number, placeholder "e.g. 145" | Optional positive |
| | Target | number, placeholder "e.g. 160" | Optional positive |
| **Live Risk Display** | (Computed) Shows "Risk: ${amount} ({pct}% of account)" when stop/qty/entry valid and accountSize set | — | — |
| **Dates** | Entry Date | date | Required |
| | Exit Date | date | Required |
| **Setup** | `<SetupCombobox>` | Custom autocomplete from `settings.setups` | Optional |
| **Mistakes** | `<MistakeMultiSelect>` | Multi-select from `settings.mistakes` | Optional |
| **Exit & Playbook** | Exit Reason | Select: Hit target · Stopped out · Time stop · Discretionary · Panic exit | Optional |
| | In playbook? | Checkbox | Default true |
| **Times** | Entry Time | time HH:MM | Optional |
| | Exit Time | time HH:MM | Optional |
| **Tags** | Tags | text, placeholder "swing, earnings, breakout" | Comma-split |
| **Screenshot** | `<ScreenshotPaster>` | Returns screenshot key | Optional |
| **Notes** | Notes | Textarea, placeholder "Trade rationale, lessons learned...", rows 3 | Optional |

**Buttons:** Cancel · "Log Trade" (add) / "Save Changes" (edit).

### `<IbkrImportDialog>` — Import from IBKR Statement

Header: "Import from IBKR statement".

**States:**
- No `parsedStatement`: "No IBKR statement loaded..."
- `drafts.length === 0`: "No new trades detected..."
- Has drafts: preview table

**Preview table columns:** Checkbox · Symbol (mono bold) · Side "long" · Qty · Entry $ · Exit $ · Date (YYYY-MM-DD muted) · Fees $X.XX (muted).

Auto-selects all drafts on open. Deduplicates against existing trades via key Set.

**Buttons:** Cancel · Import {N} trade(s) — disabled if `drafts.length === 0` or `selected.size === 0`.

### `<DayDetailDialog>`

Header: "Trades on {Full Date}". Scrollable max-h-400px list of trade cards. Per card: Symbol + Side badge · P&L (currency green/red) · Quantity · Entry · Exit · Fees (if >0) · Notes (italic if present). Day total row only if trades > 1. Edit button per row → opens TradeFormDialog.

### `<KillSwitchBanner>` Conditional Rendering

| Condition | Banner |
|---|---|
| No `dailyMaxLoss` set | Returns null |
| Today's P&L ≥ 0 | Returns null |
| ratio ≥ 1 | **Red destructive banner** with `<Ban>` icon: "Daily max loss hit" / "Today's loss: {amount} reached your limit of {limit}. Step away from the screen." |
| ratio ≥ 0.8 | **Amber warning banner** with `<AlertTriangle>`: "Approaching daily max loss" / "Today's loss: {amount} of {limit} limit ({percentage}%). Consider stopping." |

Exported helper: `isDailyMaxLossHit(trades, settings)` — used to gate trade logging.

### Hooks

`useTradeJournal()` → `{ trades, addTrade, updateTrade, deleteTrade, dailyPnL, stats, cumulativePnL, tradesByDate, currentStreak }`. `useOpenTrades()`. `useJournalSettings()`.

---

## `/trading-plan` — My Trading Plan

**File:** `src/pages/TradingPlan.tsx`  
**Layout:** All content in `.tp-ext` scoped div. Custom palette via `--tp-*` CSS variables mapped onto site HSL design tokens. Fonts: Instrument Serif (h2), JetBrains Mono (labels), Newsreader (body) loaded from Google Fonts.

### Sections

| # | Section | localStorage Key | Sub-content |
|---|---|---|---|
| 1 | **Setup Quality Grading Rubric** | `trading-plan:grade-scores` | 4-dimension rubric scored 0-2 each (interactive 0/1/2 buttons): **Setup Criteria** (35%) · **Market Regime** (30%) · **Risk/Reward** (20%) · **Management** (15%). Each dimension: 3 buttons for score selection. Grade tier display: **A+ · A · B · C · D** with color-coded result boxes. |
| 2 | **Market Regime Recognition & Framework Selection** | `trading-plan:regime-selection` | 3-row regime table: SPY trend + VIX + Action (Trade all / Trade selective / Stay out) · RSI + Volume + Action · Regime signal + Timeframe + Action. Regime card selection UI. |
| 3 | **Trade Journal Template & Sample Entries** | — | 3 detailed sample trades: **Sample 1: Winner with good process** (+2.7R, 10/10 process) · **Sample 2: Loser with good process** (−1.0R, "Process > Outcome") · **Sample 3: Winner with bad process** ("Profit ≠ Edge", "Lucky win masks broken process"). Each sample has: Pre-Trade Thesis, The Plan table (Entry/Stop/Target/Framework/Size), In-Trade Notes, Exit Reasoning, Post-Trade Analysis (Process Score, Outcome Score, Plan adherence, R realized), Lesson Extracted. |
| 4 | **Fit-to-Trade Daily Check** | `tp-fit-YYYY-MM-DD` (day-scoped — resets daily) | Checkbox list with editable questions. `PlanListEditor`: ▲▼ reorder · ✕ delete · Add input ("Add Fit-to-Trade question…") + "Add" button + Enter handling · Reset to defaults (confirm dialog) |
| 5 | **Pre-Trade Checklist** | `tp-pretrade` (or `trading-plan:pre-trade`) | Checkbox list with editable items, same PlanListEditor controls |
| 6 | **Mistake Categories** | `tp-mistakes` (or `trading-plan:mistakes`) | Editable category list with frequency counter buttons per category. PlanListEditor controls. |
| 7 | **Risk Parameters** | `tp-risk-v1` | Account size input + max risk % input. **Read by `/trading` Order Ticket** for auto-qty calc and risk preview percentage. |

### `PlanListEditor` Component (shared)

Per item: `ReorderBtns` (▲/▼ disabled at bounds) + text input bound to item.text + ✕ delete button. Add row: input with placeholder + "Add" button + Enter handling. Footer: "Reset to defaults" button with confirm dialog.

### `usePersistentState<T>(key, initial)` Hook

Lazy-init reads `localStorage.getItem(key)` (returns initial on parse error). Sets `localStorage.setItem(key, JSON.stringify(value))` on every value change (try-catch for quota errors).

### `todayKey()` Helper

Returns `YYYY-MM-DD` local time for daily-scoped checklists.

### `arrayMove(arr, from, to)` / `uid()`

Pure immutable reorder + random ID generator (`Math.random().toString(36).slice(2,9)`).

---

## `/learn` — Learn

**File:** `src/pages/Learn/index.tsx` + `src/pages/Learn/data/` (articles, categories, paths, types).  
**Layout:** Header → search → tab strip (3 tabs) → article grid / article reader panel. Dark `surface-*` palette.

### View Modes

| Mode | Trigger |
|---|---|
| Hub (default) | Browse all articles, paths, categories |
| Path mode | `activePath` set (clicked path card) |
| Article detail | `selectedArticle` set (clicked article card) |

### Hub View Sections

| Section | Visibility |
|---|---|
| **Header** | Title, description, article count |
| **Search Bar** | Always. Input placeholder "Search articles…". Search icon left, Clear X button right (conditional). Rounded-xl border. |
| **Continue Reading card** | Only if `!query && !activePath && lastRead exists`. CTA with `<Play>` icon: "Continue reading" + article title + description + ArrowRight |
| **Active Path Banner** | Only if `activePath`. Shows path + exit button. |
| **Learning Paths grid** | Only if `!query && !activePath`. 3-col grid of cards. Each: Icon + Title + Description + Progress `{read}/{total}` + Percentage + Progress bar. |
| **Category Grid** | Only if `!query && !activePath`. 6-col grid. Each: Icon + Name + `{read}/{total}` + percentage (if any read). Active state styling. "Show {N} more categories" / "Show less" toggle (`<ChevronDown>`). |
| **Filter Bar (sticky)** | Always. See below. |
| **Articles Section** | CategorySection (multiple, grouped by category) OR path-mode numbered articles OR empty state. |

### Filter Bar

| Control | Options |
|---|---|
| Active category chip (pill with X) | Removable. Only if `activeCat` set. |
| Difficulty toggle (3 mutually-exclusive buttons) | **Beginner · Intermediate · Advanced** |
| Status filter (4-button tab group) | **All · Unread · Read · Bookmarked** |
| Clear all filters | Text button. Only if any filter active. |

### Article Card

Clickable. Shows: Icon · Difficulty badge (color-coded: emerald-500/15 beginner, amber-500/15 intermediate, red-500/15 advanced) · Read time · Title · Description · Is-read checkmark (conditional).

### Article Detail View

| Element | Details |
|---|---|
| Back button | `<ArrowLeft>` "Back to Learn Hub" |
| Path progress indicator | Only if `activePath` |
| Article header | Title · `<DiffBadge>` · Read time · `<BookMarked>` bookmark toggle (filled amber if bookmarked) |
| Article content | Renders `ContentBlock[]` via `<BlockRenderer>` |
| Navigation | Previous (if `prev` exists in navList) · Next (if `next` exists) |
| Related articles | Grid if `related.length > 0` |

### Content Block Types (rendered by `<BlockRenderer>`)

| Type | Renders |
|---|---|
| `paragraph` | `<p>` text-sm leading-relaxed |
| `heading` | `<h2>` or `<h3>` with ID anchor `text.toLowerCase().replace(/[^a-z0-9]+/g, '-')` |
| `formula` | Bordered card with `<code>` formula + variables key/value grid (symbol w-32 + label) |
| `example` | Bordered card with: "Example · {company}" label + scenario paragraph + 2-col numbers grid |
| `callout` | Bordered card. Variants: **tip** (emerald-500/30 border) · **warning** (amber-500/30) · **info** (blue-500/30). Title + text. |
| `list` | `<ul>` or `<ol>` (if `ordered`) with space-y-1.5 |
| `keyPoints` | Bordered card "Key Points" + `<CheckCircle2>` list |
| `quiz` | Bordered card "Knowledge Check" + question + buttons (one per option). Click locks selection. Feedback color: emerald correct / red wrong / muted disabled. Per-quiz state keyed `{articleId}-quiz-{question.slice(0,20)}`. |

### Persistence (localStorage)

| Key | Content |
|---|---|
| `learn-read` | JSON array of read article IDs |
| `learn-bookmarks` | JSON array of bookmarked article IDs |
| `learn-lastread` | `{ id: string, ts: number }` for continue banner |

### State

`selectedArticle`, `activePath`, `query`, `activeCat`, `activeDiff`, `statusFilter`, `showAllCats`, `quizStates`, per-CategorySection `expanded`.

### Hooks

`useLearnState()` returns `{ readIds, bookmarkIds, lastRead, markRead, toggleBookmark }`. `useNavigate()`. Computed: `continueArticle`, `filtered`, `grouped`, `visibleCats`, `navList`.

### Error Handling

`<LearnErrorBoundary>` class component wraps the entire page. Shows error message + "Try again" reset button on render error.

---

## `/settings` — Settings

**File:** `src/pages/Settings.tsx`  
**Layout:** PageLayout("Settings"). lg:grid-cols-3. Left col 1/3: sidebar nav. Right col 2/3: main content.

### Left Sidebar Navigation

Ghost buttons (visual only, no sub-routing yet):

| Button | Icon |
|---|---|
| Account | `<User>` |
| Notifications | `<Bell>` |
| Security | `<Lock>` |
| Regional Settings | `<Globe>` |
| Preferences | `<SettingsIcon>` |

### Right Main Panel — Account Settings

**Personal Information section:**

States:
- **Loading:** `<Loader2 animate-spin>` + "Loading account details…"
- **Anonymous:** "You're browsing as a guest. Create an account to save personal information." (link to `/settings`)
- **Authenticated:** 2-col grid (md:grid-cols-2 gap-4)

**Form fields (when authenticated):**

| Field | Type | Notes |
|---|---|---|
| First Name | text, autoComplete `given-name` | Placeholder "Your first name". `<label htmlFor="firstName">` |
| Last Name | text, autoComplete `family-name` | Placeholder "Your last name" |
| Email | email, autoComplete `email` | **Read-only + disabled** (cursor-not-allowed, bg-muted/40). Note below: "Email cannot be changed here. Contact support to update it." |
| Phone | (not visible in read snippet but inferred) | — |

**Save / Cancel section** (when `dirty`):
- **Save Changes** button — primary. Triggers `supabase.auth.updateUser({ data: { first_name, last_name, phone } })`. Trim all values.
- **Cancel** button — re-seeds form from `supabase.auth.getUser()`, sets `dirty=false`.
- Save status indicator: idle (none) · saving (`<Loader2>` "Saving…") · saved (`<CheckCircle2>` "Saved" auto-resets after 3000ms) · error (`<AlertCircle>` + error.message)

### Theme Section (implicit, via `useTheme`)

Light/Dark/System toggle via `next-themes`. Uses `resolvedTheme` + `mounted` guard to avoid SSR hydration mismatch.

### Hooks

`useTheme()` (next-themes), `supabase.auth.getUser()`, `supabase.auth.updateUser()`.

### State

`email`, `isAnonymous`, `authLoading`, `form` (firstName/lastName/phone), `dirty`, `status: SaveStatus` (idle/saving/saved/error), `errMsg`, `mounted`.

---

## `*` — Not Found

**File:** `src/pages/NotFound.tsx`  
Simple 404 page. "Go back home" link to `/`.

---

## Shared Components

### `<ErrorBoundary>` (`src/components/common/ErrorBoundary.tsx`)

Class component with static `getDerivedStateFromError()`. On error: shows card titled "This panel hit an error." with description "The rest of the page is unaffected." and "Try again" button calling `this.reset()`. Custom fallback prop supported.

### `<DeferUntilVisible>` (`src/components/common/DeferUntilVisible.tsx`)

IntersectionObserver-based lazy mount. Props: `minHeight` (default 300), `rootMargin` (default '200px'). Pre-visible: renders placeholder div with reserved height. Visible: renders children fragment (kept mounted thereafter).

### `<StockCard>` (`src/components/stocks/StockCard.tsx`)

| Section | Details |
|---|---|
| Card header | `<StockLogo size={compact ? 'sm' : 'md'}>` + symbol (CardTitle font-semibold) + name (text-xs truncated max-w-[120px]) + optional sector badge + "Delayed" `<WifiOff>` badge with tooltip "Live quote unavailable due to API limits. Showing last known data." if `!liveQuoteAvailable` |
| Card content | 2-col grid: **Left** = Price (text-2xl bold, or text-lg if compact) + Change row (Arrow + currency + %) + 2×2 metrics grid (Volume, Mkt Cap, Updated if !compact); **Right** = Sparkline (h-24 or h-14 if compact, `highlightIndex=last`, `ariaLabel="{symbol} price trend"`) if `priceHistory.length > 0` |

**Props:** stock, priceHistory, exchange, logoUrl, currency (default "USD"), liveQuoteAvailable (default true), sector, compact (default false), onClick, className.

---

## Architecture Patterns

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
                ├── /global        → Global.tsx  (Three.js 1.7 MB lazy)
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

All page imports via `React.lazy()` — each is a separate async Vite chunk.

### Data Source Catalogue

| Source | Hooks / Edge Functions | Used For |
|---|---|---|
| **Supabase** | `useStocks()`, `useWatchlists()`, `useIndices()`, `usePortfolio()`, `useStatement()`, `useTradeJournal()` (via localStorage but uses supabase auth), `supabase.auth.*` | 47k stocks, market indices, watchlists CRUD, portfolio data, auth |
| **EODHD** | `useEodhdBarsForChart()`, `useEodhdStock()`, `useEodhdIntraday()`, `useSparklineData()`, `fetchEodFundamentals()`, `fetchEodHistorical()` | Price history, fundamentals (P/E, EPS, dividend, beta, market cap), ohlcv bars, sparklines, 1W hourly bars |
| **Finnhub** | `api-finnhub` edge fn → `useNews()`, `useEarningsCalendar()`, `useSectorETFQuotes()`, `fetchFinnhubProfile()`, `useQuery('finnhub-recommendations')`, `useQuery('finnhub-earnings')` | Quotes, news, earnings calendar, analyst ratings, 11 SPDR sector ETFs, profile/market cap (1st in waterfall) |
| **Yahoo Finance** | `api-52week`, `api-beta`, `useIntradaySparkline()`, `fetchYahooQuote()`, `fetchYahooChart()` | 52-week range, beta, intraday hourly sparklines, Order Ticket live price, SymbolChart |
| **FX Rates** | `api-fx-rates` → `useCurrencyRates()` | 19 FX pairs (3-strategy fallback) |
| **FMP** | `fetchFMPProfile()`, `useQuery('fmp-key-metrics')` | Market cap fallback (3rd in waterfall); fundamentals fallback (2nd layer) |
| **Alpha Vantage** | `fetchAVOverview()` | Market cap last resort (4th); fundamentals last layer |
| **DefeatBeta** (localhost:4400) | `useHistoricalPrices()`, `useDefeatBetaNews()` (disabled) | 90-day price history for RelVol calc; main StockChart fallback. News disabled (segfault on Windows). |
| **TradingView** | Embedded widgets via `<TradingViewProvider>` | Heatmaps (SPX500, NASDAQ100, ETF), Advanced Chart, Screeners, Economic Calendar, Technical Analysis, Timeline, Forex Rates, Forex Heatmap |
| **IBKR Gateway** (localhost proxy) | `useIBKRAuthStatus()`, `useIBKRTickle()`, `useIBKRAccounts()`, `useIBKRPositions()`, `useIBKRPnL()`, `useIBKROrders()`, `useIBKRTrades()`, `useIBKRContractSearch()`, `useIBKRPlaceOrder()`, `useIBKRCancelOrder()`, `useIBKRPortfolioSummary()`, `useIBKRSnapshot()` | Live positions, orders, trades, P&L, contract resolution, order placement/cancellation, account summary, live snapshots |
| **AIS Stream / OpenSky / NASA EONET / USGS / ACLED+GDELT / EODHD Calendar** | `useAISStream()`, `useOpenSkyFlights()`, `useEarthquakes()`, `useNaturalEvents()`, `useConflictEvents()`, `useEconomicEvents()`, `useMacroHeatmap()` | Global page realtime streams + event feeds |
| **WITS** | `useTradeBreakdown(iso, 'exports'\|'imports', 'partners')` | Trade partner arcs in Global |
| **SnapTrade** | `useConnectBrokerage()`, `useSnapTradeSync()` | Portfolio brokerage sync (OAuth) |
| **localStorage** | Direct read/write with self-healing parsers | All client-only persistence |

### Complete localStorage Key Registry

| Key | Page / Component | Shape |
|---|---|---|
| `dash-active-sym` | Dashboard | string (ticker) |
| `dash-notes-v1` | Dashboard | `Record<string, string>` |
| `dash-price-alerts-v1` | Dashboard | `PriceAlert[]` |
| `trade-journal-v1` | TradeJournal | `TradeEntry[]` |
| `open-trades-v1` | TradeTracker / TradeJournal Open tab | `OpenTrade[]` |
| `tp-rubric` | TradingPlan (Setup Quality) | `PlanItem[]` |
| `tp-regimes` | TradingPlan (Market Regime) | `PlanItem[]` |
| `tp-fit-YYYY-MM-DD` | TradingPlan (Fit-to-Trade, day-scoped) | `Record<string, boolean>` |
| `tp-pretrade` | TradingPlan (Pre-Trade Checklist) | `PlanItem[]` |
| `tp-mistakes` | TradingPlan (Mistake Categories) | `PlanItem[]` |
| `tp-risk-v1` | TradingPlan (Risk Parameters) → read by `/trading` | `{ account: number, riskPct: number }` |
| `tp-playbook-v1` | TradeTracker | saved setup names |
| `tp-entry-defaults-v1` | TradeTracker | `{ stopPct, targetR }` defaults |
| `trading-plan:grade-scores` | TradingPlan grade calculator | scores object |
| `trading-plan:regime-selection` | TradingPlan regime card | string |
| `trading-plan:today-fit-check` | TradingPlan daily fit | daily check state |
| `learn-read` | Learn | `string[]` (article IDs) |
| `learn-bookmarks` | Learn | `string[]` (article IDs) |
| `learn-lastread` | Learn | `{ id: string, ts: number }` |
| `logo-cache-v1` | LogoService | `Record<symbol, { url, ts }>` 30-day TTL |
| `globe-perf-mode` | Global page | boolean (perf mode persistence) |
| (watchlists state) | Watchlists / useWatchlists() | lists + entries + active list |
| (stocks prefs) | Stocks / useStocksPrefs() | hiddenStocks, pinnedStocks |

### Pure Lib Functions (`src/lib/` — node-testable, no DOM/React)

| Function | File | Description |
|---|---|---|
| `topMovers(stocks, n)` | `topMovers.ts` | Top N by \|changePercent\|, deduped by uppercased symbol, stable sort |
| `watchlistMovers(stocks, symbols)` | `dashboardStocks.ts` | Best + worst among watchlist holdings; null if none resolve |
| `resolveDisplayStocks(stocks, symbols)` | `dashboardStocks.ts` | `{ list, source: 'watchlist' \| 'movers' }` |
| `watchlistHeatmap(stocks, symbols)` | `watchlistHeatmap.ts` | `HeatCell[]` with `intensity` 0–4 (one step per 2%), sorted by \|cp\| desc |
| `sectorExposure(stocks, symbols, resolver?)` | `sectorExposure.ts` | `SectorSlice[]` with injectable resolver (defaults to `getStaticSector`); misses → 'Unknown' |
| `concentrationScore(slices)` | `concentrationScore.ts` | HHI: `round(sum((pct/100)^2)*100)`; labels: ≥50 Concentrated, ≥30 Moderate, else Diversified |
| `earningsWindow(events, horizon=7, max=5)` | `earningsWindow.ts` | Upcoming earnings 0..horizon days; labels Today / Tomorrow / in Nd |
| `headlineSentiment(text)` | `headlineSentiment.ts` | `'bull' \| 'bear' \| 'neutral'` via keyword lexicon |
| `newsMood(items)` | `headlineSentiment.ts` | `{ bull, bear, neutral, net }` from headlines |
| `weekRangePosition(low, high, price)` | `weekRangePosition.ts` | 0–1 position within 52-week band; null if non-finite/degenerate |
| `parseNotes(raw)` / `setNote(map, sym, text)` | `symbolNotes.ts` | Self-healing parse; `setNote` is pure/immutable (empty text removes key) |
| `parseAlerts(raw)` / `evaluateAlerts(alerts, prices)` | `priceAlerts.ts` | Self-healing parse; `evaluateAlerts` returns triggered subset |
| `riskPreview(params)` | `riskPreview.ts` | `{ rr, dollarRisk, posValue, acctRiskPct, overRisk }` for Order Ticket |
| `stopFromPct(side, entry, pct)` | `entryMath.ts` | Compute stop price from % distance |
| `targetFromR(side, entry, stop, r)` | `entryMath.ts` | Compute target price from R multiple |
| `qtyFromRisk(entry, stop, account, riskPct)` | `entryMath.ts` | Auto-compute qty from account risk parameters |
| `journalWindows(entries)` | `journalWindows.ts` | Streak/window stats |
| `marketSession()` | `marketSession.ts` | Current session label: Pre / Open / After / Closed |
| `planAdherence(trade)` | `planAdherence.ts` | Score trade against plan criteria |
| `portfolioRisk(trades)` | `portfolioRisk.ts` | Portfolio-level open risk metrics |
| `openR(trade)` | `tradeMetrics.ts` | Open R value for a trade |
| `splitClose(trade, exitPrice, closeQty)` | `splitClose.ts` | Partial-close: returns updated open + new closed record |
| `buildBuckets(returns)` | `marketReturns.ts` | Histogram bin builder for MarketOverviewCard |
| `getStaticSector(ticker)` | `sectorMap.ts` | Static GICS sector lookup (~300 US stocks) |
| `computeChokepointRisk()` | (Global) | Score chokepoints from conflict/earthquake/natural data |
| `matchesVesselType(vessel, filter)` | (Global) | AIS vessel filter by ship type code |

### Resilience Patterns

| Pattern | Where Used |
|---|---|
| `<ErrorBoundary name="…">` | Every Dashboard card; Trading TradeTracker, Watchlist; per-tab in `/journal`. Prevents one widget from crashing the page. |
| `<DeferUntilVisible minHeight={N}>` | Top Stories TradingViewTimeline, MarketBreadthCards. IntersectionObserver-based lazy mount. |
| Self-healing `parse*` functions | All localStorage readers; return safe defaults on bad JSON, wrong shape, null |
| `React.lazy()` + `<Suspense>` | All page chunks; spinner fallback during download |
| `useIsMobile()` → `<MobileShell>` | Dashboard + PageLayout: drawer nav on mobile |
| `<MobilePreviewFrame>` | App-level: iPhone 15 Pro simulator for responsive preview |
| `<LearnErrorBoundary>` | Class component wrapping `/learn` page |
| Ref-stabilized arrays | Global page: prevents downstream cascade re-renders |
| `visibilitychange` gated tick | MarketTimeline: pauses when tab backgrounded |
| Perf-mode auto-detect | Global page: `hardwareConcurrency < 4 \|\| deviceMemory < 4` |
| 4-source waterfall | Dashboard Market Cap (Finnhub → EODHD → FMP → Alpha Vantage); StockFundamentalsPanel (EODHD → FMP → Alpha Vantage) |
| 3-strategy FX fallback | `api-fx-rates` edge fn |

### Provider Stack (outermost → innermost)

```
ThemeProvider (next-themes, defaultTheme="dark", attribute="class")
└── QueryClientProvider (TanStack Query with queryClientDefaults)
    └── TooltipProvider
        └── TradingViewProvider
            └── StatementProvider
                └── NavbarSlotProvider
                    └── <Toaster /> (shadcn) + <Sonner /> + BrowserRouter
                        └── MobilePreviewFrame
                            └── Suspense(spinner)
                                └── Routes
```

`initBatchQuoteService(queryClient)` runs at module load — registers QueryClient with batch quote service for cache population.
