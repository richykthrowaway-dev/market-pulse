
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStocks, useIndices, useCurrencies, useNews } from '@/hooks/useSupabaseData';
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
  const activeStock = selectedStock ?? stocks[0];

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
  
  const dashboardContent = (
    <>
      <ErrorBoundary name="YourSnapshot"><YourSnapshot /></ErrorBoundary>
      <h1 className="text-2xl font-bold mb-6 tracking-tight">
        Market Dashboard
      </h1>

      {/* Stats Row */}
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

      {/* Stock Cards + Chart side-by-side */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        {/* Stock cards — ~1/3 width, internal scroll */}
        <div className="lg:w-1/3 flex flex-col animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <h2 className="text-lg font-semibold tracking-tight mb-3">All Stocks</h2>
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
        </div>

        {/* Chart — ~2/3 width */}
        <div className="lg:w-2/3 min-w-0 h-64 md:h-96 lg:h-[500px]">
          <StockChart
            symbol={activeStock.symbol}
            name={activeStock.name}
            currentPrice={activeStock.price}
            onRangeChange={setChartDays}
          />
        </div>
      </div>

      {/* Fundamentals Panel — updates when a stock is clicked */}
      {activeStock && (
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
          <StockFundamentalsPanel
            symbol={activeStock.symbol}
            name={activeStock.name}
            currentPrice={activeStock.price}
          />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - News */}
        <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <NewsCard
            news={news}
            watchlistSymbols={WATCHLIST_SYMBOLS}
          />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-5 w-5 text-primary" />
                Top Stories
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <TradingViewTimeline height={500} className="w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Market overview, markets, breadth */}
        <div className="lg:col-span-1 space-y-6 animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <MarketOverviewCard />
          <MarketOverview indices={indices} />
          <MarketBreadthCards />
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
