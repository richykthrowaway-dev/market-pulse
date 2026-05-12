import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import { X } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useStocks } from '@/hooks/useSupabaseData';
import { StockCard } from '@/components/stocks/StockCard';
import { StockChart } from '@/components/stocks/StockChart';
import { useSparklineData } from '@/hooks/useSparklineData';
import { useEodhdBarsForChart } from '@/hooks/useEodhdBarsForChart';
import { useEodhdStock, type EodhdStockData } from '@/hooks/useEodhdStock';
import { Skeleton } from '@/components/ui/skeleton';
import { useStocksPrefs } from '@/hooks/useStocksPrefs';

/* ── Lazy-loaded heavy components (code-split, only fetched when needed) ── */
const TradingViewChart = React.lazy(() =>
  import('@/components/tradingview/TradingViewChart').then(m => ({ default: m.TradingViewChart }))
);

/* ── IntersectionObserver wrapper: mounts children only when near viewport ── */
function LazySection({ children, height = 500, rootMargin = '400px 0px' }: {
  children: React.ReactNode;
  height?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight: height }}>
      {visible ? (
        <React.Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height }} />}>
          {children}
        </React.Suspense>
      ) : (
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      )}
    </div>
  );
}

/**
 * Number of stock cards that eagerly fetch sparkline data on mount.
 * Cards beyond this index only fetch when scrolled into view.
 */
const EAGER_CARD_COUNT = 8;

/** Maps chartDays → TradingView range string */
function daysToTvRange(days: number): string {
  if (days <= 7)    return '5D';
  if (days <= 30)   return '1M';
  if (days <= 90)   return '3M';
  if (days <= 365)  return '12M';
  if (days <= 1825) return '60M';
  return 'ALL';
}



/** Wraps StockCard with real sparkline data from EODHD.
 *  When `externalPriceHistory` is provided (for the active stock) it uses that
 *  instead of fetching separately, guaranteeing chart/card consistency. */
function StockCardWithHistory({ stock, days, isActive, onClick, externalPriceHistory }: {
  stock: any;
  days: number;
  isActive: boolean;
  onClick: () => void;
  externalPriceHistory?: number[];
}) {
  // Skip fetch when external data is provided (empty symbol → query disabled)
  const { data: fetchedHistory = [] } = useSparklineData(
    externalPriceHistory ? '' : stock.symbol,
    days,
  );
  const priceHistory = externalPriceHistory ?? fetchedHistory;

  // Compute period change from EODHD data so the card shows accurate values
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
      className={isActive ? "ring-2 ring-primary" : ""}
    />
  );
}

/**
 * Lazy stock card: renders a plain card immediately, swaps to
 * StockCardWithHistory (with sparkline) once scrolled near viewport.
 */
function LazyStockCard({ stock, days, isActive, onClick }: {
  stock: any;
  days: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  useEffect(() => {
    if (shouldFetch) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShouldFetch(true); observer.disconnect(); } },
      { rootMargin: '300px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldFetch]);

  if (shouldFetch) {
    return <StockCardWithHistory stock={stock} days={days} isActive={isActive} onClick={onClick} />;
  }

  return (
    <div ref={ref}>
      <StockCard stock={stock} onClick={onClick} className={isActive ? "ring-2 ring-primary" : ""} />
    </div>
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
    const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
    return externalData.bars
      .filter(bar => bar.date >= cutoff)
      .map(b => Number(b.adjusted_close ?? b.close));
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
  const baseStocks = useMemo(() => allStocks.filter(s => !hiddenSet.has(s.symbol)), [allStocks, hiddenSet]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  // chartDays drives sparkline period for ALL stock cards (local + pinned).
  // Updated via StockChart's onRangeChange when user clicks 1W/1M/3M/1Y/All buttons.
  const [chartDays, setChartDays] = React.useState(30);

  // Track which pinned symbol is "active" (selected) and its loaded data for the detail panel
  // Use "SYMBOL.EXCHANGE" as the composite key for pinned stocks
  const [activePinnedKey, setActivePinnedKey] = React.useState<string | null>(null);
  const pinnedDataRef = React.useRef<Record<string, EodhdStockData>>({});
  const [, forceUpdate] = React.useState(0);

  // Promoted symbol: searched local stock moved to top of list (not persisted)
  const [promotedSymbol, setPromotedSymbol] = React.useState<string | null>(null);

  // Reorder stocks: promoted symbol always first
  const stocks = useMemo(() => {
    if (!promotedSymbol) return baseStocks;
    const idx = baseStocks.findIndex(s => s.symbol.toUpperCase() === promotedSymbol.toUpperCase());
    if (idx <= 0) return baseStocks; // Already first or not found
    return [baseStocks[idx], ...baseStocks.slice(0, idx), ...baseStocks.slice(idx + 1)];
  }, [baseStocks, promotedSymbol]);

  const urlSymbol = searchParams.get('symbol');
  const urlExchange = searchParams.get('exchange') || 'US';
  const urlName = searchParams.get('name') || undefined;

  // Handle URL search params — wait for stocks to load before deciding local vs external
  useEffect(() => {
    if (!urlSymbol || isLoading) return;

    const localIdx = baseStocks.findIndex(s => s.symbol.toUpperCase() === urlSymbol.toUpperCase());

    if (localIdx >= 0) {
      // Local stock: promote to top of list and select it
      setPromotedSymbol(urlSymbol.toUpperCase());
      setSelectedIndex(0);
      setActivePinnedKey(null);
    } else {
      // External stock: pin it for data fetching (renders at top of card list)
      pinStock(urlSymbol, urlExchange, urlName);
      setActivePinnedKey(`${urlSymbol.toUpperCase()}.${urlExchange}`);
      setSelectedIndex(-1);
      setPromotedSymbol(null);
    }
    setSearchParams({}, { replace: true });
  }, [urlSymbol, isLoading, baseStocks.length]);

  const isExternalUrl = false; // No longer used as a separate flag

  const activePinnedData = activePinnedKey ? pinnedDataRef.current[activePinnedKey] ?? null : null;
  const activePinnedMeta = activePinnedKey
    ? pinnedStocks.find(ps => `${ps.symbol.toUpperCase()}.${ps.exchange}` === activePinnedKey)
    : null;
  const isPinnedSelected = selectedIndex === -1 && activePinnedData !== null;

  // Fetch full 5Y EODHD bars for the active LOCAL stock so StockChart uses
  // the same data source (and adjusted_close) as the sparklines.
  const activeLocalSymbol = !isPinnedSelected ? (stocks[selectedIndex >= 0 ? selectedIndex : 0]?.symbol ?? null) : null;
  const { data: activeLocalBars } = useEodhdBarsForChart(activeLocalSymbol);

  /** EODHD bars filtered to current timeframe — used for card sparkline consistency. */
  const areaChartData = useMemo(() => {
    const bars: any[] = isPinnedSelected && activePinnedData
      ? activePinnedData.bars
      : (activeLocalBars ?? []);
    if (bars.length < 2) return [];
    const cutoff = format(subDays(new Date(), chartDays), 'yyyy-MM-dd');
    return bars
      .filter((b: any) => b.date >= cutoff)
      .map((b: any) => ({
        time: b.date as string,
        value: Number(b.adjusted_close ?? b.close),
      }));
  }, [isPinnedSelected, activePinnedData, activeLocalBars, chartDays]);

  /** Sparkline (close prices only) derived from the same EODHD bars the chart uses.
   *  Passed to the active stock's card to guarantee chart ↔ card consistency. */
  const activeSparkline = useMemo(() => {
    if (areaChartData.length < 2) return undefined;
    return areaChartData.map(d => d.value);
  }, [areaChartData]);

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
              <div key={pinKey} data-stock-symbol={sym}>
              <PinnedStockCard
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
              </div>
            );
          })}

          <div className="space-y-4">
            {stocks.map((stock, idx) => (
              <div key={stock.symbol} className="relative" data-stock-symbol={stock.symbol.toUpperCase()}>
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
                {/* First EAGER_CARD_COUNT cards fetch sparkline immediately;
                    the rest lazy-load when scrolled near viewport */}
                {idx < EAGER_CARD_COUNT ? (
                  <StockCardWithHistory
                    stock={stock}
                    days={chartDays}
                    isActive={selectedIndex === idx && !isPinnedSelected}
                    onClick={() => { setSelectedIndex(idx); setActivePinnedKey(null); }}
                    externalPriceHistory={
                      idx === (selectedIndex >= 0 ? selectedIndex : 0) && !isPinnedSelected
                        ? activeSparkline
                        : undefined
                    }
                  />
                ) : (
                  <LazyStockCard
                    stock={stock}
                    days={chartDays}
                    isActive={selectedIndex === idx && !isPinnedSelected}
                    onClick={() => { setSelectedIndex(idx); setActivePinnedKey(null); }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2" aria-label="Stock details">
          {activeStock && (
            <>
              {/* ── Above-the-fold: loads immediately ── */}
              <div className="h-64 md:h-96">
                <StockChart
                  symbol={activeStock.symbol}
                  name={activeStock.name}
                  currentPrice={activeStock.price}
                  volatility={2.5}
                  onRangeChange={setChartDays}
                  externalBars={
                    isPinnedSelected && activePinnedData
                      ? activePinnedData.bars      // pinned stock — EODHD bars already fetched
                      : (activeLocalBars ?? undefined) // local stock — 5Y EODHD bars
                  }
                  exchange={isPinnedSelected && activePinnedMeta ? activePinnedMeta.exchange : undefined}
                  logoUrl={isPinnedSelected && activePinnedData ? activePinnedData.stock.logoUrl : undefined}
                  currency={isPinnedSelected && activePinnedData ? activePinnedData.stock.currency : 'USD'}
                />
              </div>

              {/* TradingView Advanced Chart — range synced to timeframe buttons.
                  key forces a full remount on symbol or range change so the
                  widget always initializes with the correct range. */}
              <LazySection height={540}>
                <div className="mt-4">
                  <TradingViewChart
                    key={`${activeStock.symbol}-${daysToTvRange(chartDays)}`}
                    symbol={activeStock.symbol}
                    interval="D"
                    range={daysToTvRange(chartDays)}
                    height={500}
                    hideSideToolbar
                    className="w-full"
                    aria-label={`TradingView advanced chart for ${activeStock.symbol}`}
                  />
                </div>
              </LazySection>


            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default Stocks;
