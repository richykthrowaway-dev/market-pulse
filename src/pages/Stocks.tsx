import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import { X } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useStocks } from '@/hooks/useSupabaseData';
import { StockCard } from '@/components/stocks/StockCard';
import { StockChart } from '@/components/stocks/StockChart';
import { useStockHistory } from '@/hooks/useStockHistory';
import { useEodhdStock, type EodhdStockData } from '@/hooks/useEodhdStock';
import { Skeleton } from '@/components/ui/skeleton';
import { useStocksPrefs } from '@/hooks/useStocksPrefs';
import { TradingViewChart, TradingViewMiniChart, TradingViewTechnicalAnalysis } from '@/components/tradingview';
import { LightweightCandlestick } from '@/components/charts';

/** Shows real 52-week high/low from ohlcv_bars */
function Week52Range({ symbol }: { symbol: string }) {
  const { data: bars = [], isLoading } = useStockHistory(symbol, 365);
  if (isLoading) return <p className="text-xl font-semibold mt-1 text-muted-foreground">Loading…</p>;
  if (bars.length === 0) return <p className="text-xl font-semibold mt-1 text-muted-foreground">N/A</p>;
  const closes = bars.map((b: any) => Number(b.close));
  const low52 = Math.min(...closes);
  const high52 = Math.max(...closes);
  return <p className="text-xl font-semibold mt-1">${low52.toFixed(2)} - ${high52.toFixed(2)}</p>;
}

/** 52W range for external stocks using EODHD bars */
function ExternalWeek52Range({ bars, currency = 'USD' }: { bars: Array<{ close: number }>; currency?: string }) {
  if (bars.length === 0) return <p className="text-xl font-semibold mt-1 text-muted-foreground">N/A</p>;
  const closes = bars.map(b => b.close);
  const low52 = Math.min(...closes);
  const high52 = Math.max(...closes);
  const fmt = (v: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v); }
    catch { return `$${v.toFixed(2)}`; }
  };
  return <p className="text-xl font-semibold mt-1">{fmt(low52)} - {fmt(high52)}</p>;
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
      priceHistory={priceHistory}
      onClick={onClick}
      className={isActive ? "ring-2 ring-primary" : ""}
    />
  );
}

function ExternalStockCardWithHistory({ externalData, days, isActive, onClick, exchange }: {
  externalData: EodhdStockData;
  days: number;
  isActive: boolean;
  onClick: () => void;
  exchange?: string;
}) {
  const filteredCloses = useMemo(() => {
    const cutoff = subDays(new Date(), days);
    return externalData.bars
      .filter(bar => new Date(bar.date) >= cutoff)
      .map(b => b.close);
  }, [externalData.bars, days]);

  const overriddenStock = filteredCloses.length >= 2
    ? {
        ...externalData.stock,
        change: filteredCloses[filteredCloses.length - 1] - filteredCloses[0],
        changePercent: ((filteredCloses[filteredCloses.length - 1] - filteredCloses[0]) / filteredCloses[0]) * 100,
      }
    : externalData.stock;

  return (
    <StockCard
      stock={overriddenStock}
      priceHistory={filteredCloses}
      onClick={onClick}
      className={isActive ? "ring-2 ring-primary" : ""}
      exchange={exchange}
      logoUrl={externalData.stock.logoUrl}
      currency={externalData.stock.currency}
      liveQuoteAvailable={externalData.liveQuoteAvailable}
    />
  );
}

/**
 * Self-contained pinned stock card that fetches its own data via useEodhdStock.
 * Each pinned stock gets its own hook call, so data is cached in React Query
 * and survives component remounts (navigation away and back).
 */
function PinnedStockCard({ pin, days, isActive, onClick, onRemove, onDataReady }: {
  pin: { symbol: string; exchange: string; name?: string };
  days: number;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
  onDataReady: (data: EodhdStockData) => void;
}) {
  const { data, isLoading } = useEodhdStock(pin.symbol, pin.exchange, pin.name);

  // Use a ref to avoid re-triggering the effect when the callback identity changes
  const onDataReadyRef = React.useRef(onDataReady);
  onDataReadyRef.current = onDataReady;

  useEffect(() => {
    if (data) onDataReadyRef.current(data);
  }, [data]);

  if (isLoading || !data) {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  return (
    <div className="relative" aria-live="polite">
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 z-10 rounded-full p-1 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Remove ${pin.symbol}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <article>
        <ExternalStockCardWithHistory
          externalData={data}
          days={days}
          isActive={isActive}
          onClick={onClick}
          exchange={pin.exchange}
        />
      </article>
    </div>
  );
}

const Stocks = () => {
  const { data: allStocks = [], isLoading } = useStocks();
  const { hiddenSymbols, pinnedStocks, hideSymbol, pinStock, unpinStock } = useStocksPrefs();
  const hiddenSet = useMemo(() => new Set(hiddenSymbols), [hiddenSymbols]);
  const stocks = useMemo(() => allStocks.filter(s => !hiddenSet.has(s.symbol)), [allStocks, hiddenSet]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [chartDays, setChartDays] = React.useState(30);

  // Track which pinned symbol is "active" (selected) and its loaded data for the detail panel
  // Use "SYMBOL.EXCHANGE" as the composite key for pinned stocks
  const [activePinnedKey, setActivePinnedKey] = React.useState<string | null>(null);
  const pinnedDataRef = React.useRef<Record<string, EodhdStockData>>({});
  const [, forceUpdate] = React.useState(0);

  const urlSymbol = searchParams.get('symbol');
  const urlExchange = searchParams.get('exchange') || 'US';
  const urlName = searchParams.get('name') || undefined;

  const localIndex = urlSymbol
    ? stocks.findIndex(s => s.symbol.toUpperCase() === urlSymbol.toUpperCase())
    : -1;

  const isExternalUrl = !!urlSymbol && localIndex === -1;

  // When arriving via URL with an external symbol, pin it
  useEffect(() => {
    if (isExternalUrl && urlSymbol) {
      pinStock(urlSymbol, urlExchange, urlName);
      setActivePinnedKey(`${urlSymbol.toUpperCase()}.${urlExchange}`);
      setSelectedIndex(-1);
      setSearchParams({}, { replace: true });
    }
  }, [isExternalUrl, urlSymbol]);

  // Auto-select local stock from URL
  useEffect(() => {
    if (urlSymbol && localIndex >= 0) {
      setSelectedIndex(localIndex);
      setSearchParams({}, { replace: true });
    }
  }, [urlSymbol, localIndex]);

  const activePinnedData = activePinnedKey ? pinnedDataRef.current[activePinnedKey] ?? null : null;
  const activePinnedMeta = activePinnedKey
    ? pinnedStocks.find(ps => `${ps.symbol.toUpperCase()}.${ps.exchange}` === activePinnedKey)
    : null;
  const isPinnedSelected = selectedIndex === -1 && activePinnedData !== null;

  // SEO
  useEffect(() => {
    const active = isPinnedSelected && activePinnedData
      ? activePinnedData.stock
      : stocks[selectedIndex];
    if (active) {
      document.title = `${active.symbol} - Stocks | Dashboard`;
    } else {
      document.title = 'Stocks | Dashboard';
    }
    return () => { document.title = 'Dashboard'; };
  }, [selectedIndex, activePinnedData, stocks]);

  const activeStock = isPinnedSelected && activePinnedData
    ? activePinnedData.stock
    : stocks[selectedIndex >= 0 ? selectedIndex : 0];

  if (isLoading) {
    return (
      <PageLayout title="Stocks">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading stocks…</p>
        </div>
      </PageLayout>
    );
  }

  if (!activeStock && pinnedStocks.length === 0 && !isExternalUrl) {
    return (
      <PageLayout title="Stocks">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No stocks available</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Stocks">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2" aria-label="Stock cards">
          <h2 className="text-xl font-semibold sticky top-0 bg-background z-10 pb-2">All Stocks</h2>

          {pinnedStocks.map(ps => {
            const sym = ps.symbol.toUpperCase();
            const pinKey = `${sym}.${ps.exchange}`;
            const isActive = isPinnedSelected && activePinnedKey === pinKey;
            return (
              <PinnedStockCard
                key={pinKey}
                pin={ps}
                days={chartDays}
                isActive={isActive}
                onClick={() => { setSelectedIndex(-1); setActivePinnedKey(pinKey); }}
                onRemove={() => {
                  unpinStock(ps.symbol, ps.exchange);
                  delete pinnedDataRef.current[pinKey];
                  if (activePinnedKey === pinKey) {
                    setActivePinnedKey(null);
                    if (stocks.length > 0) setSelectedIndex(0);
                  }
                }}
                onDataReady={(data) => {
                  pinnedDataRef.current[pinKey] = data;
                  // If this is the active pinned symbol, trigger re-render for detail panel
                  if (activePinnedKey === pinKey) forceUpdate(n => n + 1);
                }}
              />
            );
          })}

          <div className="space-y-4">
            {stocks.map((stock, idx) => (
              <div key={stock.symbol} className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hideSymbol(stock.symbol);
                    if (selectedIndex === idx) {
                      setSelectedIndex(stocks.length > 1 ? Math.min(idx, stocks.length - 2) : -1);
                    } else if (selectedIndex > idx) {
                      setSelectedIndex(selectedIndex - 1);
                    }
                  }}
                  className="absolute top-2 right-2 z-10 rounded-full p-1 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Remove ${stock.symbol}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <StockCardWithHistory
                  stock={stock}
                  days={chartDays}
                  isActive={selectedIndex === idx && !isPinnedSelected}
                  onClick={() => { setSelectedIndex(idx); setActivePinnedKey(null); }}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2" aria-label="Stock details">
          {activeStock && (
            <>
              <StockChart
                symbol={activeStock.symbol}
                name={activeStock.name}
                currentPrice={activeStock.price}
                volatility={2.5}
                onRangeChange={setChartDays}
                externalBars={isPinnedSelected && activePinnedData ? activePinnedData.bars : undefined}
                exchange={isPinnedSelected && activePinnedMeta ? activePinnedMeta.exchange : undefined}
                logoUrl={isPinnedSelected && activePinnedData ? activePinnedData.stock.logoUrl : undefined}
                currency={isPinnedSelected && activePinnedData ? activePinnedData.stock.currency : 'USD'}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-card rounded-lg p-4 shadow">
                  <h3 className="font-medium text-sm text-muted-foreground">Market Cap</h3>
                  <p className="text-xl font-semibold mt-1">
                    {(activeStock.marketCap || (activeStock as any).market_cap || 0) > 0
                      ? (() => {
                          const mc = activeStock.marketCap || (activeStock as any).market_cap || 0;
                          const cur = isPinnedSelected && activePinnedData ? activePinnedData.stock.currency : 'USD';
                          const sym = cur === 'USD' ? '$' : cur + ' ';
                          return mc >= 1e12 ? `${sym}${(mc / 1e12).toFixed(2)}T`
                               : mc >= 1e9  ? `${sym}${(mc / 1e9).toFixed(2)}B`
                               : mc >= 1e6  ? `${sym}${(mc / 1e6).toFixed(2)}M`
                               : `${sym}${mc.toFixed(0)}`;
                        })()
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow">
                  <h3 className="font-medium text-sm text-muted-foreground">Volume</h3>
                  <p className="text-xl font-semibold mt-1">
                    {activeStock.volume > 0
                      ? `${(activeStock.volume / 1_000_000).toFixed(2)}M`
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow">
                  <h3 className="font-medium text-sm text-muted-foreground">52W Range</h3>
                  {isPinnedSelected && activePinnedData
                    ? <ExternalWeek52Range bars={activePinnedData.bars} currency={activePinnedData.stock.currency} />
                    : <Week52Range symbol={activeStock.symbol} />
                  }
                </div>
              </div>

              {/* Lightweight Charts Candlestick */}
              <div className="mt-6">
                <LightweightCandlestick
                  symbol={activeStock.symbol}
                  name={activeStock.name}
                  height={400}
                  externalBars={isPinnedSelected && activePinnedData ? activePinnedData.bars : undefined}
                />
              </div>

              {/* TradingView Mini Chart */}
              <div className="mt-4">
                <TradingViewMiniChart
                  symbol={activeStock.symbol}
                  height={500}
                  dateRange="12M"
                  className="w-full"
                  aria-label={`Mini chart for ${activeStock.symbol}`}
                />
              </div>

              {/* TradingView Advanced Chart */}
              <div className="mt-4">
                <TradingViewChart
                  symbol={activeStock.symbol}
                  interval="D"
                  height={500}
                  hideTopToolbar
                  hideSideToolbar
                  className="w-full"
                  aria-label={`TradingView advanced chart for ${activeStock.symbol}`}
                />
              </div>

              {/* TradingView Technical Analysis */}
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Technical Analysis</h3>
                <TradingViewTechnicalAnalysis
                  symbol={activeStock.symbol}
                  interval="1D"
                  height={425}
                  className="w-full"
                />
              </div>
            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default Stocks;
