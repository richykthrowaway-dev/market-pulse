import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Target, ChevronDown, ChevronUp, ArrowUpDown, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Range52Data } from '@/hooks/use52Week';

/* ─── types ─── */
export interface PositionItem {
  ticker: string;
  name: string;
  price: number;
  low52: number;
  high52: number;
  pctFromLow: number;
  pctFromHigh: number;
  volatility: number;
  category: string;
  hasRealData: boolean;
  marketValue: number;
}

/* ─── constants ─── */
const CATEGORIES = [
  'At/Above High', 'Within 5% High', 'Within 10% High',
  'Mid-Range',
  'Within 10% Low', 'Within 5% Low', 'At/Below Low',
] as const;

const CATEGORY_TOOLTIPS: Record<string, string> = {
  'At/Above High': 'Trading at or above 52-week high — strong momentum or potentially overextended',
  'Within 5% High': 'Within 5% of 52-week high — near peak, watch for resistance',
  'Within 10% High': 'Within 10% of 52-week high — bullish positioning',
  'Mid-Range': 'In the middle of 52-week range — neutral territory',
  'Within 10% Low': 'Within 10% of 52-week low — approaching support levels',
  'Within 5% Low': 'Within 5% of 52-week low — near bottom, potential value or further downside',
  'At/Below Low': 'At or below 52-week low — making new lows, high risk zone',
};

const CATEGORY_COLORS: Record<string, string> = {
  'At/Above High': 'bg-success/20 text-success',
  'Within 5% High': 'bg-success/15 text-success',
  'Within 10% High': 'bg-success/10 text-success',
  'Mid-Range': 'bg-muted text-muted-foreground',
  'Within 10% Low': 'bg-danger/10 text-danger',
  'Within 5% Low': 'bg-danger/15 text-danger',
  'At/Below Low': 'bg-danger/20 text-danger',
};

const BAR_CATEGORY_COLORS: Record<string, string> = {
  'At/Above High': 'hsl(var(--success))',
  'Within 5% High': 'hsl(160 70% 45%)',
  'Within 10% High': 'hsl(160 55% 50%)',
  'Mid-Range': 'hsl(var(--primary))',
  'Within 10% Low': 'hsl(var(--warning))',
  'Within 5% Low': 'hsl(0 70% 55%)',
  'At/Below Low': 'hsl(var(--danger))',
};

type SortKey = 'ticker' | 'price' | 'pctFromHigh' | 'pctFromLow' | 'volatility';

/* ─── helpers ─── */
function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return v.toFixed(1) + '%';
}

function get52wCategory(pctFromLow: number): string {
  if (pctFromLow >= 0.95) return 'At/Above High';
  if (pctFromLow >= 0.9) return 'Within 5% High';
  if (pctFromLow >= 0.8) return 'Within 10% High';
  if (pctFromLow >= 0.2) return 'Mid-Range';
  if (pctFromLow >= 0.1) return 'Within 10% Low';
  if (pctFromLow >= 0.05) return 'Within 5% Low';
  return 'At/Below Low';
}

/* ─── props ─── */
interface MarketPositionWidgetProps {
  holdings: Array<{
    ticker: string;
    name: string;
    closePrice: number;
    marketValue: number;
  }>;
  ranges: Record<string, Range52Data> | undefined;
  isLoading: boolean;
  isError: boolean;
  totalHoldings: number;
}

export function MarketPositionWidget({
  holdings, ranges, isLoading, isError, totalHoldings,
}: MarketPositionWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pctFromHigh');
  const [sortAsc, setSortAsc] = useState(true);
  const [highlightCat, setHighlightCat] = useState<string | null>(null);
  const [isStocksOpen, setIsStocksOpen] = useState(true);

  /* ── build position data ── */
  const positionData: PositionItem[] = useMemo(() => {
    return holdings.map(h => {
      const r = ranges?.[h.ticker];
      const price = r?.price ?? h.closePrice;
      const low52 = r?.low52 ?? h.closePrice * 0.85;
      const high52 = r?.high52 ?? h.closePrice * 1.15;
      const range = high52 - low52;
      const pctFromLow = range > 0 ? (price - low52) / range : 0.5;
      const pctFromHigh = high52 > 0 ? ((high52 - price) / high52) * 100 : 0;
      const pctFromLowPct = low52 > 0 ? ((price - low52) / low52) * 100 : 0;
      const volatility = price > 0 ? (range / price) * 100 : 0;
      const category = get52wCategory(pctFromLow);
      return {
        ticker: h.ticker, name: h.name, price, low52, high52,
        pctFromLow: Math.max(0, Math.min(1, pctFromLow)),
        pctFromHigh,
        volatility,
        category,
        hasRealData: !!r,
        marketValue: h.marketValue,
      };
    });
  }, [holdings, ranges]);

  /* ── sorting ── */
  const sortedData = useMemo(() => {
    const filtered = highlightCat
      ? positionData.filter(p => p.category === highlightCat)
      : positionData;
    return [...filtered].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      switch (sortKey) {
        case 'ticker': return mul * a.ticker.localeCompare(b.ticker);
        case 'price': return mul * (a.price - b.price);
        case 'pctFromHigh': return mul * (a.pctFromHigh - b.pctFromHigh);
        case 'pctFromLow': return mul * (a.pctFromLow - b.pctFromLow);
        case 'volatility': return mul * (a.volatility - b.volatility);
        default: return 0;
      }
    });
  }, [positionData, sortKey, sortAsc, highlightCat]);

  /* ── category counts ── */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    positionData.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, [positionData]);

  /* ── summary stats ── */
  const nearHighsPct = useMemo(() => {
    const nearHighs = positionData.filter(p =>
      p.category === 'At/Above High' || p.category === 'Within 5% High'
    ).length;
    return totalHoldings > 0 ? (nearHighs / totalHoldings) * 100 : 0;
  }, [positionData, totalHoldings]);

  const nearLowsPct = useMemo(() => {
    const nearLows = positionData.filter(p =>
      p.category === 'At/Below Low' || p.category === 'Within 5% Low'
    ).length;
    return totalHoldings > 0 ? (nearLows / totalHoldings) * 100 : 0;
  }, [positionData, totalHoldings]);

  const dataFetched = positionData.filter(p => p.hasRealData).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function handleBarClick(cat: string) {
    setHighlightCat(prev => prev === cat ? null : cat);
  }

  /* ── skeleton loading state ── */
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Market Position Analysis</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                Fetching 52-week data for {totalHoldings} stocks…
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
            {CATEGORIES.map(cat => (
              <Skeleton key={cat} className="h-[72px] rounded-md" />
            ))}
          </div>
          <Skeleton className="h-6 rounded-md mb-5" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Market Position Analysis</CardTitle>
              <CardDescription>
                {isError
                  ? <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" /> Some data may be estimated — fetch error occurred</span>
                  : `${dataFetched}/${totalHoldings} stocks with live 52-week data`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="font-mono font-semibold text-success">{fmtPct(nearHighsPct)}</span>
              <span className="text-muted-foreground">near highs</span>
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-danger" />
              <span className="font-mono font-semibold text-danger">{fmtPct(nearLowsPct)}</span>
              <span className="text-muted-foreground">near lows</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* ── Category cards ── */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
            {CATEGORIES.map((cat, idx) => {
              const count = categoryCounts[cat] || 0;
              const pct = totalHoldings ? ((count / totalHoldings) * 100).toFixed(1) : '0.0';
              const isGreen = cat.includes('High') || cat === 'At/Above High';
              const isRed = cat.includes('Low');
              const isActive = highlightCat === cat;
              return (
                <Tooltip key={cat}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleBarClick(cat)}
                      className={cn(
                        'rounded-md p-2.5 border text-left transition-all duration-200',
                        isGreen ? 'border-success/30 bg-success/5 hover:bg-success/10' : isRed ? 'border-danger/30 bg-danger/5 hover:bg-danger/10' : 'border-border bg-muted/30 hover:bg-muted/50',
                        isActive && 'ring-2 ring-primary/50 scale-[1.02]',
                      )}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <p className={cn('text-[10px] uppercase tracking-wider font-medium truncate', isGreen ? 'text-success' : isRed ? 'text-danger' : 'text-muted-foreground')}>{cat}</p>
                      <p className="text-xl font-bold font-mono mt-0.5">{count}</p>
                      <p className={cn('text-[10px] font-mono', isGreen ? 'text-success/70' : isRed ? 'text-danger/70' : 'text-muted-foreground')}>{pct}%</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {CATEGORY_TOOLTIPS[cat]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* ── Distribution bar ── */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Market Position Distribution
            {highlightCat && <span className="ml-1 text-primary">— filtering: {highlightCat}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{totalHoldings} stocks analyzed</p>
        </div>
        <div className="h-6 rounded-md overflow-hidden flex mb-5">
          {CATEGORIES.map(cat => {
            const count = categoryCounts[cat] || 0;
            if (!count) return null;
            const widthPct = (count / totalHoldings) * 100;
            const isActive = highlightCat === cat;
            return (
              <button
                key={cat}
                onClick={() => handleBarClick(cat)}
                className={cn(
                  'flex items-center justify-center text-[10px] font-bold text-white/90 transition-all duration-200',
                  isActive ? 'brightness-125 ring-1 ring-white/50' : highlightCat ? 'opacity-40' : '',
                )}
                style={{ width: `${widthPct}%`, backgroundColor: BAR_CATEGORY_COLORS[cat], minWidth: count ? 24 : 0 }}
              >
                {count}
              </button>
            );
          })}
        </div>

        {/* ── Sort controls ── */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {([
            ['ticker', 'Symbol'],
            ['price', 'Price'],
            ['pctFromHigh', '% from High'],
            ['pctFromLow', 'Position'],
            ['volatility', 'Volatility'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={cn(
                'text-[11px] px-2 py-0.5 rounded-full border transition-all duration-150',
                sortKey === key
                  ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/30',
              )}
            >
              {label}
              {sortKey === key && (
                <ArrowUpDown className="inline h-3 w-3 ml-0.5" />
              )}
            </button>
          ))}
          {highlightCat && (
            <button
              onClick={() => setHighlightCat(null)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-medium"
            >
              ✕ Clear filter
            </button>
          )}
        </div>

        {/* ── Stock rows ── */}
        <Collapsible open={isStocksOpen} onOpenChange={setIsStocksOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors">
            {isStocksOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {sortedData.length} holdings
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {sortedData.map((p, idx) => (
                <div
                  key={p.ticker}
                  className="bg-muted/30 rounded-lg p-3 transition-all duration-200 hover:bg-muted/50 hover:scale-[1.005] group"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono">{p.ticker}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">{p.name}</span>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className={cn('text-[10px] px-1.5 py-0', CATEGORY_COLORS[p.category])} variant="outline">
                              {p.category}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            {CATEGORY_TOOLTIPS[p.category]}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {!p.hasRealData && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3 w-3 text-warning" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Estimated — live data unavailable for this ticker</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-success">{fmtPct(p.pctFromHigh)} from high</span>
                      <span>Vol: {fmtPct(p.volatility)}</span>
                    </div>
                  </div>

                  <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${p.pctFromLow * 100}%`,
                        background: `linear-gradient(90deg, hsl(var(--danger)), hsl(var(--warning)), hsl(var(--success)))`,
                      }}
                    />
                    {/* Marker at current position */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-foreground/70 rounded-full"
                      style={{ left: `${p.pctFromLow * 100}%`, transform: `translateX(-50%) translateY(-50%)` }}
                    />
                  </div>

                  <div className="flex justify-between mt-1.5 items-center">
                    <div className="text-left">
                      <span className="text-[10px] text-muted-foreground font-mono block">52W Low</span>
                      <span className="text-[11px] font-mono font-medium text-danger">{fmtCurrency(p.low52)}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold font-mono">{fmtCurrency(p.price)}</span>
                      <div className="flex items-center gap-2 justify-center">
                        <span className={cn('text-[10px] font-mono', p.pctFromHigh < 5 ? 'text-success' : 'text-muted-foreground')}>
                          ↓{fmtPct(p.pctFromHigh)} from high
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground font-mono block">52W High</span>
                      <span className="text-[11px] font-mono font-medium text-success">{fmtCurrency(p.high52)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
