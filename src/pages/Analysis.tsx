
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Treemap,
} from 'recharts';
import { useTopStocksByMarketCap } from '@/hooks/useSupabaseData';
import { getStaticSector } from '@/lib/sectorMap';
import { getGicsSectorColor } from '@/lib/gicsColors';
import { fetchFinnhubQuote } from '@/services/finnhubApi';
import { TradingViewHeatmap, TradingViewTechnicalAnalysis, TradingViewScreener } from '@/components/tradingview';
import { FundamentalsLookup } from '@/components/analysis/FundamentalsLookup';
import { cn } from '@/lib/utils';

// ── 11 SPDR Sector ETFs → real-time sector performance via Finnhub ─────────
const SECTOR_ETFS = [
  { symbol: 'XLK',  sector: 'Information Technology',  label: 'Tech' },
  { symbol: 'XLV',  sector: 'Health Care',              label: 'Healthcare' },
  { symbol: 'XLF',  sector: 'Financials',               label: 'Financials' },
  { symbol: 'XLY',  sector: 'Consumer Discretionary',  label: 'Cons. Disc.' },
  { symbol: 'XLP',  sector: 'Consumer Staples',         label: 'Cons. Stpls' },
  { symbol: 'XLE',  sector: 'Energy',                   label: 'Energy' },
  { symbol: 'XLB',  sector: 'Materials',                label: 'Materials' },
  { symbol: 'XLU',  sector: 'Utilities',                label: 'Utilities' },
  { symbol: 'XLI',  sector: 'Industrials',              label: 'Industrials' },
  { symbol: 'XLRE', sector: 'Real Estate',              label: 'Real Estate' },
  { symbol: 'XLC',  sector: 'Communication Services',  label: 'Comm. Svcs' },
];

function useSectorETFQuotes() {
  return useQuery({
    queryKey: ['sector-etf-quotes'],
    queryFn: async () => {
      const results = await Promise.all(
        SECTOR_ETFS.map(async (etf) => {
          const quote = await fetchFinnhubQuote(etf.symbol);
          return {
            name: etf.sector,
            label: etf.label,
            symbol: etf.symbol,
            value: parseFloat((quote?.dp ?? 0).toFixed(2)),
          };
        })
      );
      return results.sort((a, b) => b.value - a.value);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    gcTime: 5 * 60_000,
  });
}

// ── Treemap custom cell ────────────────────────────────────────────────────
function TreemapCell(props: any) {
  const { depth, x, y, width, height, name, changePercent } = props;
  const cp: number = changePercent ?? 0;
  const color = cp > 0 ? '#4ade80' : cp < 0 ? '#f87171' : '#6b7280';
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        style={{ fill: color, stroke: '#fff', strokeWidth: 2 / (depth + 1e-10), strokeOpacity: 1 / (depth + 1e-10) }}
      />
      {width > 50 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">{name}</text>
          <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="#fff" fontSize={12}>
            {cp > 0 ? '+' : ''}{cp.toFixed(2)}%
          </text>
        </>
      )}
    </g>
  );
}

const Analysis = () => {
  const { data: topStocks = [], isLoading: stocksLoading } = useTopStocksByMarketCap(300);
  const { data: sectorData = [], isLoading: sectorLoading } = useSectorETFQuotes();

  // ── Market breadth from Supabase top stocks ───────────────────────────────
  const breadth = useMemo(() => {
    if (!topStocks.length) return null;
    const advancing = topStocks.filter(s => s.changePercent > 0);
    const declining = topStocks.filter(s => s.changePercent < 0);
    const unchanged = topStocks.length - advancing.length - declining.length;
    // Detect "no data" state (all zeros)
    const hasData = advancing.length > 0 || declining.length > 0;
    const avgGain = advancing.length
      ? advancing.reduce((acc, s) => acc + s.changePercent, 0) / advancing.length : 0;
    const avgLoss = declining.length
      ? declining.reduce((acc, s) => acc + s.changePercent, 0) / declining.length : 0;
    return { advancing: advancing.length, declining: declining.length, unchanged, total: topStocks.length, hasData, avgGain, avgLoss };
  }, [topStocks]);

  // ── Treemap: top 50 stocks by price (skip zero-price stocks) ─────────────
  const treemapData = useMemo(() =>
    topStocks
      .filter(s => s.price > 0)
      .slice(0, 50)
      .map(s => ({ name: s.symbol, value: Math.max(Math.abs(s.changePercent), 0.01), changePercent: s.changePercent })),
    [topStocks]
  );

  return (
    <PageLayout title="Market Analysis">

      {/* Stock Fundamentals — search any ticker, get a comprehensive
          single-card snapshot. Sourced from EODHD. */}
      <div className="mb-6 bg-card rounded-lg p-4 shadow border border-border">
        <FundamentalsLookup />
      </div>

      {/* NASDAQ 100 Heatmap */}
      <div className="mb-6 bg-card rounded-lg p-4 shadow border border-border">
        <h2 className="text-xl font-semibold mb-3">NASDAQ 100 Heatmap</h2>
        <TradingViewHeatmap dataSource="NASDAQ100" blockColor="change" height={450} className="w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sector Performance — real-time SPDR ETF quotes via Finnhub */}
        <div className="bg-card rounded-lg p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Sector Performance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">SPDR Sector ETFs · Live via Finnhub</p>
            </div>
            {sectorLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
          </div>
          <div className="h-48 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, _: any, p: any) => [`${v > 0 ? '+' : ''}${v}%`, p.payload.symbol]}
                  labelFormatter={(l) => l}
                />
                <Bar dataKey="value" name="Daily Change %" radius={[4, 4, 0, 0]}>
                  {sectorData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.value >= 0 ? getGicsSectorColor(entry.name) : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Technical Analysis — TradingView live */}
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Technical Analysis — S&P 500</h2>
          <TradingViewTechnicalAnalysis symbol="SP:SPX" interval="1D" height={300} />
        </div>

        {/* Stock Performance Treemap */}
        <div className="lg:col-span-2 bg-card rounded-lg p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Stock Performance (Top 50)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 50 by market cap · Cell size = absolute % change
              </p>
            </div>
            {stocksLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
          </div>
          {stocksLoading ? (
            <div className="h-48 md:h-80 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : treemapData.length === 0 ? (
            <div className="h-48 md:h-80 flex items-center justify-center text-muted-foreground">No stock data available</div>
          ) : (
            <div className="h-48 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={treemapData} dataKey="value" stroke="#fff" fill="#6b7280" content={<TreemapCell />} />
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Market Breadth — Supabase top 300 stocks */}
        <div className="bg-card rounded-lg p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Market Breadth</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top {breadth?.total ?? 300} stocks · Advancing vs Declining
              </p>
            </div>
            {stocksLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
          </div>
          {!breadth ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : !breadth.hasData ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground text-sm font-medium">No price movement data</p>
              <p className="text-muted-foreground text-xs text-center max-w-xs">
                Change data is computed nightly after market close. Check back on the next trading day.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Advancing', count: breadth.advancing, pct: (breadth.advancing / breadth.total) * 100, detail: `avg +${breadth.avgGain.toFixed(2)}%`, color: 'bg-green-500' },
                { label: 'Declining', count: breadth.declining, pct: (breadth.declining / breadth.total) * 100, detail: `avg ${breadth.avgLoss.toFixed(2)}%`, color: 'bg-red-500' },
                { label: 'Unchanged', count: breadth.unchanged, pct: (breadth.unchanged / breadth.total) * 100, detail: '—', color: 'bg-muted' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground font-mono text-xs">{row.count} · {row.detail}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={cn('h-2 rounded-full', row.color)} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                A/D ratio:{' '}
                <span className={cn('font-mono font-medium', breadth.advancing >= breadth.declining ? 'text-green-500' : 'text-red-500')}>
                  {breadth.advancing}/{breadth.declining}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Most Capitalized — TradingView Screener */}
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Most Capitalized</h2>
          <TradingViewScreener defaultScreen="most_capitalized" defaultColumn="overview" height={320} className="w-full" />
        </div>

        {/* Top Gainers — TradingView Screener */}
        <div className="lg:col-span-2 bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Top Gainers</h2>
          <TradingViewScreener defaultScreen="top_gainers" defaultColumn="performance" height={400} className="w-full" />
        </div>

      </div>
    </PageLayout>
  );
};

export default Analysis;
