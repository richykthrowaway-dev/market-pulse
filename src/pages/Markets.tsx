
import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useIndices } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';
import { Flag } from '@/components/ui/Flag';
import { formatPercentage } from '@/utils/stocksApi';
import type { MarketIndex } from '@/utils/stocksApi';
import { TradingViewHeatmap, TradingViewEtfHeatmap } from '@/components/tradingview';

const REGION_ORDER = [
  'United Kingdom',
  'United States',
  'Japan',
  'Germany',
  'France',
  'Hong Kong',
  'Australia',
  'Canada',
  'Europe',
  'South Korea',
  'India',
  'Brazil',
];

function IndexCard({ index }: { index: MarketIndex }) {
  const isPositive = index.changePercent >= 0;
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Flag code={index.region} size={34} className="shrink-0" />
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{index.name}</h3>
            <span className="text-xs text-muted-foreground">{index.region}</span>
          </div>
        </div>
        <span className={cn("font-mono text-sm font-semibold shrink-0", isPositive ? "text-success" : "text-danger")}>
          {isPositive ? '+' : ''}{formatPercentage(index.changePercent)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold leading-tight">
          {index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={cn("font-mono text-sm", isPositive ? "text-success" : "text-danger")}>
          {isPositive ? '+' : ''}{index.change.toFixed(2)}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">
        Last updated: {new Date(index.lastUpdated).toLocaleTimeString()}
      </span>
    </div>
  );
}

// Overhead: navbar(64) + content-pad-top(24) + small-h1+mb-2(28) + 2×card(36px each=72) + gap(8) + content-pad-bottom(24)
const LAYOUT_OVERHEAD = 224;

function useHeatmapHeight() {
  const [height, setHeight] = useState(() =>
    Math.max(180, Math.floor((window.innerHeight - LAYOUT_OVERHEAD) / 2))
  );
  useEffect(() => {
    function update() {
      setHeight(Math.max(180, Math.floor((window.innerHeight - LAYOUT_OVERHEAD) / 2)));
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

const Markets = () => {
  const { data: indices = [], isLoading } = useIndices();
  const heatmapHeight = useHeatmapHeight();

  // Lock page scroll & shrink the PageLayout h1 title
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const h1 = document.querySelector('main h1') as HTMLElement | null;
    let prevClass = '';
    if (h1) {
      prevClass = h1.className;
      h1.className = 'text-sm font-medium text-muted-foreground mb-2 tracking-wide';
    }
    return () => {
      document.body.style.overflow = '';
      if (h1) h1.className = prevClass;
    };
  }, []);

  const sorted = [...indices].sort((a, b) => {
    const ai = REGION_ORDER.indexOf(a.region);
    const bi = REGION_ORDER.indexOf(b.region);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <PageLayout title="Global Markets">

      {/* Heatmaps — stacked, sized to fill viewport without scrolling */}
      <div className="flex flex-col gap-2">
        <div className="bg-card rounded-lg px-3 pt-2 pb-2 shadow border border-border">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">S&P 500 Heatmap</h2>
          <div className="overflow-x-auto min-h-[300px]">
            <TradingViewHeatmap dataSource="SPX500" height={heatmapHeight} className="w-full" />
          </div>
        </div>
        <div className="bg-card rounded-lg px-3 pt-2 pb-2 shadow border border-border">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">ETF Heatmap</h2>
          <div className="overflow-x-auto min-h-[300px]">
            <TradingViewEtfHeatmap height={heatmapHeight} className="w-full" />
          </div>
        </div>
      </div>

      {/* Index Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse-gentle">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-6 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((index) => (
            <IndexCard key={index.symbol} index={index} />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default Markets;
