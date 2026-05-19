
import React, { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStocks, useIndices, useCurrencies, useNews } from '@/hooks/useSupabaseData';
import { useWatchlist } from '@/hooks/useWatchlist';
import { resolveDisplayStocks, watchlistMovers } from '@/lib/dashboardStocks';
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
