
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStocks, useIndices, useCurrencies, useNews } from '@/hooks/useSupabaseData';
import { useWatchlist } from '@/hooks/useWatchlist';
import { use52Week } from '@/hooks/use52Week';
import { useEarningsCalendar } from '@/hooks/useEarningsCalendar';
import { resolveDisplayStocks, watchlistMovers } from '@/lib/dashboardStocks';
import { watchlistHeatmap } from '@/lib/watchlistHeatmap';
import { sectorExposure } from '@/lib/sectorExposure';
import { weekRangePosition } from '@/lib/weekRangePosition';
import { newsMood } from '@/lib/headlineSentiment';
import { earningsWindow } from '@/lib/earningsWindow';
import { parseAlerts, evaluateAlerts, STORAGE_KEY, type PriceAlert } from '@/lib/priceAlerts';
import { concentrationScore } from '@/lib/concentrationScore';
import { topMovers } from '@/lib/topMovers';
import { parseNotes, setNote, STORAGE_KEY as NOTES_KEY } from '@/lib/symbolNotes';
import { SECTOR_COLORS } from '@/lib/gicsColors';
import { useHistoricalPrices } from '@/hooks/useDefeatBeta';
import { useSparklineData } from '@/hooks/useSparklineData';
import { useLogoPrefetch } from '@/hooks/useLogoPrefetch';
import { formatNumber } from '@/utils/stocksApi';
import { fetchFinnhubProfile } from '@/services/finnhubApi';
import { fetchEodFundamentals } from '@/services/eodhdApi';
import { fetchFMPProfile } from '@/services/fmpApi';
import { fetchAVOverview, avNum } from '@/services/alphaVantageApi';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { StockCard } from '@/components/stocks/StockCard';
import { StockChart } from '@/components/stocks/StockChart';
import { StockFundamentalsPanel } from '@/components/stocks/StockFundamentalsPanel';
import { MarketOverview } from '@/components/markets/MarketOverview';
import { MarketBreadthCards } from '@/components/widgets/MarketBreadthCards';
import { NewsCard } from '@/components/news/NewsCard';
import { StatsCard } from '@/components/ui/StatsCard';
import { YourSnapshot } from '@/components/dashboard/YourSnapshot';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { DeferUntilVisible } from '@/components/common/DeferUntilVisible';
import { WatchlistChart } from '@/components/stocks/WatchlistChart';
import { MarketOverviewCard } from '@/components/widgets/MarketOverviewCard';
import { TopMoverCard } from '@/components/widgets/TopMoverCard';
import { useEffect } from 'react';
import { useNavbarSlot } from '@/contexts/NavbarSlotContext';
import { BarChart3, TrendingDown, TrendingUp, Wallet2, Newspaper } from 'lucide-react';
import { TradingViewTimeline } from '@/components/tradingview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileShell } from '@/components/layout/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatMarketCap(cap: number): string {
  if (!cap || isNaN(cap)) return '—';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
}

function formatVolume(vol: number): string {
  if (!vol || isNaN(vol)) return '—';
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return `${Math.round(vol).toLocaleString()}`;
}

/** Default sparkline window — syncs with the main chart range buttons */
const DEFAULT_SPARKLINE_DAYS = 30;

const WATCHLIST_DISPLAY = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
];

const WATCHLIST_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'V'];

export function Dashboard() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chartDays, setChartDays] = useState(30);

  // Inject compact snapshot chips into the navbar (desktop only, clears on unmount)
  const { setSlot } = useNavbarSlot();
  useEffect(() => {
    setSlot(<YourSnapshot variant="inline" />);
    return () => setSlot(null);
  }, [setSlot]);
  
  const { data: stocks = [], isLoading: stocksLoading } = useStocks();
  const { data: indices = [] } = useIndices();
  const { data: currencies = [] } = useCurrencies(); // kept for potential future use
  const { data: news = [] } = useNews(WATCHLIST_SYMBOLS);

  // Prefetch logos for visible stocks only — prefetching all 1000+ fires 1000 concurrent requests
  const visibleTickers = useMemo(() => stocks.slice(0, 20).map((s) => s.symbol), [stocks]);
  useLogoPrefetch(visibleTickers);

  const [selectedStock, setSelectedStock] = useState<typeof stocks[0] | null>(null);

  const { symbols: watchSymbols, add: addWatch, remove: removeWatch } = useWatchlist();
  const { list: displayStocks, source: listSource } = useMemo(
    () => resolveDisplayStocks(stocks, watchSymbols),
    [stocks, watchSymbols],
  );

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

  // ── Insights widgets derived state ─────────────────────────────────────────
  const heatCells = useMemo(() => watchlistHeatmap(stocks, watchSymbols), [stocks, watchSymbols]);
  const sectors = useMemo(() => sectorExposure(stocks, watchSymbols), [stocks, watchSymbols]);
  const mood = useMemo(() => newsMood(news), [news]);
  const conc = useMemo(() => concentrationScore(sectors), [sectors]);
  const gapMovers = useMemo(() => topMovers(stocks), [stocks]);

  const [notes, setNotes] = useState(() =>
    parseNotes(typeof localStorage !== 'undefined' ? localStorage.getItem(NOTES_KEY) : null),
  );
  useEffect(() => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* quota */ }
  }, [notes]);

  const earningsHoldings = useMemo(
    () => watchSymbols.map((t) => ({ ticker: t })),
    [watchSymbols],
  );
  const { data: earningsEvents = [] } = useEarningsCalendar(earningsHoldings);
  const upcomingEarnings = useMemo(
    () => earningsWindow(earningsEvents.map((e) => ({ ticker: e.ticker, daysUntil: e.daysUntil }))),
    [earningsEvents],
  );

  const [alerts, setAlerts] = useState<PriceAlert[]>(() =>
    parseAlerts(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null),
  );
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch { /* quota */ }
  }, [alerts]);
  const [alSym, setAlSym] = useState('');
  const [alTarget, setAlTarget] = useState('');
  const [alDir, setAlDir] = useState<'above' | 'below'>('above');
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stocks) m[String(s.symbol).toUpperCase()] = Number(s.price);
    return m;
  }, [stocks]);
  const triggeredIds = useMemo(
    () => new Set(evaluateAlerts(alerts, priceMap).map((a) => a.id)),
    [alerts, priceMap],
  );
  const addAlert = useCallback(() => {
    const t = parseFloat(alTarget);
    if (!alSym.trim() || !Number.isFinite(t)) return;
    setAlerts((a) => [
      ...a,
      { id: `${Date.now()}-${a.length}`, symbol: alSym.trim().toUpperCase(), target: t, dir: alDir },
    ]);
    setAlSym('');
    setAlTarget('');
  }, [alSym, alTarget, alDir]);
  const removeAlert = useCallback((id: string) => {
    setAlerts((a) => a.filter((x) => x.id !== id));
  }, []);

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

  const activeStock =
    selectedStock ??
    (persistedSym
      ? stocks.find((s) => s.symbol?.toUpperCase() === persistedSym.toUpperCase())
      : undefined) ??
    stocks[0];

  const { data: range52 } = use52Week(activeStock ? [activeStock.symbol] : []);
  const weekRange = useMemo(() => {
    const d = activeStock ? range52?.ranges?.[activeStock.symbol] : undefined;
    if (!d) return null;
    const pos = weekRangePosition(d.low52, d.high52, d.price);
    return pos === null ? null : { pos, low52: d.low52, high52: d.high52, price: d.price };
  }, [range52, activeStock]);

  // ── Per-stock metrics (Market Cap + Volume cards) ──────────────────────────
  // Fetch 90 days of history for the active stock to compute average daily volume.
  // This drives Relative Volume = today's volume ÷ 90-day average.
  const { data: activeBars = [] } = useHistoricalPrices(activeStock?.symbol, 90);

  const avgDailyVolume = useMemo(() => {
    if (!activeBars || activeBars.length === 0) return 0;
    const total = activeBars.reduce((sum, b) => sum + Number(b.volume ?? 0), 0);
    return total / activeBars.length;
  }, [activeBars]);

  // Relative volume: today's volume relative to the 90-day daily average (1.0 = average)
  const relativeVolume = avgDailyVolume > 0
    ? (activeStock?.volume ?? 0) / avgDailyVolume
    : null;

  // Finnhub profile — used for real market cap (DB stores 0; Finnhub returns millions USD)
  // Cached 24h so clicking different stocks doesn't hammer the API
  const { data: activeProfile } = useQuery({
    queryKey: ['finnhub', 'profile', activeStock?.symbol],
    queryFn: () => fetchFinnhubProfile(activeStock!.symbol),
    enabled: !!activeStock?.symbol,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
  // Finnhub marketCapitalization is in millions USD → multiply by 1e6 for raw dollars
  const finnhubMarketCap = activeProfile?.marketCapitalization
    ? activeProfile.marketCapitalization * 1e6
    : null;

  // EODHD fundamentals — All-in-One plan provides MarketCapitalization directly
  const eodSymbol = activeStock?.symbol
    ? (activeStock.symbol.includes('.') ? activeStock.symbol : `${activeStock.symbol}.US`)
    : undefined;
  const { data: eodFund } = useQuery({
    queryKey: ['eodhd', 'fundamentals', eodSymbol],
    queryFn:  () => fetchEodFundamentals(eodSymbol!),
    enabled:  !!eodSymbol && finnhubMarketCap == null,
    staleTime: 12 * 60 * 60_000,
    gcTime:    12 * 60 * 60_000,
  });
  const eodMarketCap = eodFund?.Highlights?.MarketCapitalization ?? null;

  // FMP fallback — fires when Finnhub + EODHD both return null
  const { data: fmpProfile } = useQuery({
    queryKey: ['fmp', 'profile', activeStock?.symbol],
    queryFn:  () => fetchFMPProfile(activeStock!.symbol),
    enabled:  !!activeStock?.symbol && finnhubMarketCap == null && eodMarketCap == null,
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
  });
  const fmpMarketCap = fmpProfile?.mktCap ?? null;

  // Alpha Vantage — last resort
  const { data: avOverview } = useQuery({
    queryKey: ['alphavantage', 'overview', activeStock?.symbol],
    queryFn:  () => fetchAVOverview(activeStock!.symbol),
    enabled:  !!activeStock?.symbol && finnhubMarketCap == null && eodMarketCap == null && fmpMarketCap == null,
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
  });
  const avMarketCap = avOverview ? avNum(avOverview.MarketCapitalization) : null;

  const activeMarketCap = finnhubMarketCap ?? eodMarketCap ?? fmpMarketCap ?? avMarketCap;

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const isMobile = useIsMobile();

  const ready = !stocksLoading && !!activeStock;
  
  const dashboardContent = (
    <>
      {/* Mobile only: show snapshot grid (on desktop it lives in the navbar) */}
      <div className="xl:hidden mb-4">
        <ErrorBoundary name="YourSnapshot"><YourSnapshot /></ErrorBoundary>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Market Dashboard
      </p>

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

              {upcomingEarnings.length > 0 && (
                <ErrorBoundary name="EarningsStrip">
                  <p className="mt-3 text-xs text-muted-foreground">
                    📅 {upcomingEarnings.map((u) => `${u.ticker} ${u.label}`).join(' · ')}
                  </p>
                </ErrorBoundary>
              )}

              {listSource === 'watchlist' && heatCells.length > 0 && (
                <ErrorBoundary name="WatchlistHeatmap">
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {heatCells.map((c) => {
                      const up = c.changePercent >= 0;
                      const alpha = 0.18 + c.intensity * 0.2;
                      return (
                        <div
                          key={c.symbol}
                          title={`${c.name} ${c.changePercent.toFixed(2)}%`}
                          className="rounded px-1.5 py-1 text-center"
                          style={{ backgroundColor: `hsl(${up ? '142 70% 45%' : '0 72% 51%'} / ${alpha})` }}
                        >
                          <div className="text-[10px] font-semibold leading-tight">{c.symbol}</div>
                          <div className="text-[10px] font-mono-num leading-tight">
                            {up ? '+' : ''}{c.changePercent.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ErrorBoundary>
              )}

              {listSource === 'watchlist' && sectors.length > 0 && (
                <ErrorBoundary name="SectorExposure">
                  <div className="mt-3">
                    <div className="flex h-2 w-full overflow-hidden rounded-full">
                      {sectors.map((s) => (
                        <div
                          key={s.sector}
                          title={`${s.sector} ${s.pct}%`}
                          style={{
                            width: `${s.pct}%`,
                            backgroundColor: `hsl(${SECTOR_COLORS[s.sector] ?? '0 0% 50%'})`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {sectors.slice(0, 5).map((s) => (
                        <span key={s.sector} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span
                            className="inline-block h-2 w-2 rounded-sm"
                            style={{ backgroundColor: `hsl(${SECTOR_COLORS[s.sector] ?? '0 0% 50%'})` }}
                          />
                          {s.sector} {s.pct}%
                        </span>
                      ))}
                    </div>
                  </div>
                </ErrorBoundary>
              )}

              {listSource === 'watchlist' && sectors.length > 0 && (
                <ErrorBoundary name="Concentration">
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Concentration{' '}
                    <span className="font-semibold text-foreground">{conc.score}/100</span> ·{' '}
                    <span
                      className={
                        conc.label === 'Concentrated'
                          ? 'text-red-500'
                          : conc.label === 'Moderate'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                      }
                    >
                      {conc.label}
                    </span>
                  </p>
                </ErrorBoundary>
              )}
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

            {weekRange && (
              <ErrorBoundary name="WeekRange52">
                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                  <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>52-Week Range — {activeStock.symbol}</span>
                    <span className="font-mono-num">
                      {weekRange.low52.toFixed(2)} – {weekRange.high52.toFixed(2)}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow"
                      style={{ left: `${weekRange.pos * 100}%` }}
                      title={`Current ${weekRange.price.toFixed(2)}`}
                    />
                  </div>
                </div>
              </ErrorBoundary>
            )}

            {activeStock && (
              <ErrorBoundary name="SymbolNotes">
                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                  <label className="mb-1.5 block text-[11px] text-muted-foreground">
                    Notes — {activeStock.symbol}
                  </label>
                  <textarea
                    value={notes[activeStock.symbol.toUpperCase()] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNotes((m) => setNote(m, activeStock.symbol, v));
                    }}
                    placeholder="Your private notes for this symbol…"
                    rows={3}
                    className="w-full resize-y rounded-md border border-border bg-background p-2 text-xs"
                  />
                </div>
              </ErrorBoundary>
            )}
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
          <ErrorBoundary name="NewsMood">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold">News mood:</span>
              <span className="text-green-500">🐂 {mood.bull}</span>
              <span className="text-red-500">🐻 {mood.bear}</span>
              <span className="text-muted-foreground">· neutral {mood.neutral}</span>
              <span className={mood.net > 0 ? 'text-green-500' : mood.net < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                net {mood.net >= 0 ? '+' : ''}{mood.net}
              </span>
            </div>
          </ErrorBoundary>
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
          <ErrorBoundary name="PriceAlerts">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Price Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1.5">
                  <input
                    value={alSym}
                    onChange={(e) => setAlSym(e.target.value)}
                    placeholder="Symbol"
                    aria-label="Alert symbol"
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs uppercase"
                  />
                  <select
                    value={alDir}
                    onChange={(e) => setAlDir(e.target.value as 'above' | 'below')}
                    aria-label="Alert direction"
                    className="h-8 rounded-md border border-border bg-background px-1 text-xs"
                  >
                    <option value="above">≥</option>
                    <option value="below">≤</option>
                  </select>
                  <input
                    value={alTarget}
                    onChange={(e) => setAlTarget(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addAlert(); }}
                    placeholder="Target"
                    inputMode="decimal"
                    aria-label="Alert target price"
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addAlert}
                    className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No alerts set.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {alerts.map((a) => {
                      const hit = triggeredIds.has(a.id);
                      return (
                        <span
                          key={a.id}
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                            hit
                              ? 'bg-destructive/15 text-destructive font-semibold'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {a.symbol} {a.dir === 'above' ? '≥' : '≤'} {a.target}
                          {hit && ' 🔔'}
                          <button
                            type="button"
                            aria-label={`Remove alert ${a.symbol}`}
                            onClick={() => removeAlert(a.id)}
                            className="hover:text-foreground"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </ErrorBoundary>
          <ErrorBoundary name="GapMovers">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Market Gap Movers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {gapMovers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data.</p>
                ) : (
                  gapMovers.map((m) => {
                    const cp = Number(m.changePercent) || 0;
                    return (
                      <button
                        key={m.symbol}
                        type="button"
                        onClick={() => selectStock(m)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        <span className="font-semibold">{m.symbol}</span>
                        <span className={cp >= 0 ? 'text-green-500 font-mono-num' : 'text-red-500 font-mono-num'}>
                          {cp >= 0 ? '+' : ''}{cp.toFixed(2)}%
                        </span>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </ErrorBoundary>
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
}

/** Wraps StockCard with real sparkline data from ohlcv_bars */
function StockCardWithHistory({ stock, days, isActive, onClick, compact }: {
  stock: any;
  days: number;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  // Primary: EODHD sparkline (reliable, doesn't need local backend running)
  const { data: eodHistory = [] } = useSparklineData(stock.symbol, days);

  // Fallback: DefeatBeta local backend (only fires when EODHD returns nothing)
  const { data: bars = [] } = useHistoricalPrices(
    eodHistory.length === 0 ? stock.symbol : undefined,
    days,
  );
  const defeatBetaHistory = (bars ?? []).map((b: any) => Number(b.close));

  const priceHistory = eodHistory.length > 0 ? eodHistory : defeatBetaHistory;

  // Override change/changePercent with actual timeframe performance
  const overriddenStock = priceHistory.length >= 2
    ? {
        ...stock,
        change: priceHistory[priceHistory.length - 1] - priceHistory[0],
        changePercent: ((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100,
      }
    : stock;

  return (
    <StockCard
      stock={overriddenStock}
      priceHistory={priceHistory.length >= 2 ? priceHistory : undefined}
      onClick={onClick}
      compact={compact}
      className={isActive ? "ring-2 ring-primary shadow-glow" : ""}
    />
  );
}
