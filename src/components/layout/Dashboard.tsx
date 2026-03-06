
import React, { useState, useMemo } from 'react';
import { useStocks, useIndices, useCurrencies, useNews } from '@/hooks/useSupabaseData';
import { useStockHistory } from '@/hooks/useStockHistory';
import { useLogoPrefetch } from '@/hooks/useLogoPrefetch';
import { formatNumber } from '@/utils/stocksApi';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { StockCard } from '@/components/stocks/StockCard';
import { StockChart } from '@/components/stocks/StockChart';
import { MarketOverview } from '@/components/markets/MarketOverview';
import { CurrencyExchange } from '@/components/currencies/CurrencyExchange';
import { NewsCard } from '@/components/news/NewsCard';
import { StatsCard } from '@/components/ui/StatsCard';
import { WatchlistChart } from '@/components/stocks/WatchlistChart';
import { MarketOverviewCard } from '@/components/widgets/MarketOverviewCard';
import { BarChart3, TrendingDown, TrendingUp, Wallet2 } from 'lucide-react';

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
  const { data: currencies = [] } = useCurrencies();
  const { data: news = [] } = useNews(WATCHLIST_SYMBOLS);

  // Prefetch remote logos as soon as the stock list arrives
  const tickers = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
  useLogoPrefetch(tickers);

  const [selectedStock, setSelectedStock] = useState<typeof stocks[0] | null>(null);
  const activeStock = selectedStock ?? stocks[0];
  
  // Calculate market statistics
  const gainers = stocks.filter(stock => stock.changePercent > 0);
  const losers = stocks.filter(stock => stock.changePercent < 0);
  
  const topGainer = [...stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
  const topLoser = [...stocks].sort((a, b) => a.changePercent - b.changePercent)[0];
  
  const totalMarketCap = stocks.reduce((sum, stock) => sum + stock.marketCap, 0);
  const totalVolume = stocks.reduce((sum, stock) => sum + stock.volume, 0);
  
  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

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
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
              <StatsCard 
                title="Market Cap" 
                value={`$${(totalMarketCap / 1e12).toFixed(2)}T`}
                trend={0.47}
                icon={<Wallet2 />}
                className="bg-card"
              />
              <StatsCard 
                title="Trading Volume" 
                value={`${(totalVolume / 1e6).toFixed(2)}M`}
                description="Today's volume"
                icon={<BarChart3 />}
                className="bg-card"
              />
              <StatsCard 
                title="Top Gainer" 
                value={topGainer.symbol}
                trend={topGainer.changePercent}
                trendLabel={topGainer.name}
                icon={<TrendingUp />}
                className="bg-card"
              />
              <StatsCard 
                title="Top Loser" 
                value={topLoser.symbol}
                trend={topLoser.changePercent}
                trendLabel={topLoser.name}
                icon={<TrendingDown />}
                className="bg-card"
              />
            </div>

            {/* Market Overview Card */}
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
              <MarketOverviewCard />
            </div>


            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left column - Stock list */}
              <div className="lg:col-span-1 space-y-4 animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                <h2 className="text-lg font-semibold tracking-tight">All Stocks</h2>
                <div className="space-y-3">
                  {stocks.slice(0, 5).map((stock) => (
                    <StockCardWithHistory
                      key={stock.symbol}
                      stock={stock}
                      days={chartDays}
                      isActive={activeStock.symbol === stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                    />
                  ))}
                </div>
              </div>
              
              {/* Middle column - Chart and news */}
              <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                <StockChart 
                  symbol={activeStock.symbol} 
                  name={activeStock.name} 
                  currentPrice={activeStock.price}
                  onRangeChange={setChartDays}
                />
                <NewsCard
                  news={news}
                  watchlistSymbols={WATCHLIST_SYMBOLS}
                />
              </div>
              
              {/* Right column - Markets and currencies */}
              <div className="lg:col-span-1 space-y-6 animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
                <MarketOverview indices={indices} />
                <CurrencyExchange currencies={currencies} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Wraps StockCard with real sparkline data from ohlcv_bars */
function StockCardWithHistory({ stock, days, isActive, onClick }: {
  stock: any;
  days: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: bars = [] } = useStockHistory(stock.symbol, days);
  const priceHistory = bars.map((b: any) => Number(b.close));

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
      priceHistory={priceHistory.length > 0 ? priceHistory : undefined}
      onClick={onClick}
      className={isActive ? "ring-2 ring-primary shadow-glow" : ""}
    />
  );
}
