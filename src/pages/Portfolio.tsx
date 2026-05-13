import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { subDays, startOfMonth, startOfYear, parseISO, isAfter } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStatement } from '@/contexts/StatementContext';
import { useMarketCaps } from '@/hooks/useMarketCaps';
import { useTickerStyles } from '@/hooks/useTickerStyles';
import { use52Week } from '@/hooks/use52Week';
import { useAnalystRatings, analystColor } from '@/hooks/useAnalystRatings';
import { TickerStyleEditor } from '@/components/portfolio/TickerStyleEditor';
import { EarningsCalendar } from '@/components/portfolio/EarningsCalendar';
import { CorrelationMatrix } from '@/components/portfolio/CorrelationMatrix';
import { SnapTradeConnectCard } from '@/components/portfolio/SnapTradeConnectCard';
import { Link2, Unlink2, ArrowUpDown } from 'lucide-react';
import { useNavbarSlot } from '@/contexts/NavbarSlotContext';

import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { batchLookupSymbols } from '@/services/symbolLookupService';
import { getGicsSectorColor, normalizeSector, getCategoryColor } from '@/lib/gicsColors';
import { Sparkline } from '@/components/ui/sparkline';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';
import { AllocationExplorer, type GroupingKey, type AllocationHolding, type SymbolMeta, type SortCol as AllocSortCol, groupColor, COUNTRY_NAMES, classifyHolding } from '@/components/portfolio/AllocationExplorer';
import {
  useLinkedSort,
  allocColToShared,
  sharedToAllocCol,
  holdingsColToShared,
  sharedToHoldingsCol,
} from '@/hooks/useLinkedSort';


function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PNL_TIMEFRAMES = ['1W', 'MTD', '1M', '3M', 'YTD', '1Y', 'All'] as const;
type PnlTimeframe = typeof PNL_TIMEFRAMES[number];

function getTimeframeCutoff(tf: PnlTimeframe): Date | null {
  const now = new Date();
  switch (tf) {
    case '1W': return subDays(now, 7);
    case 'MTD': return startOfMonth(now);
    case '1M': return subDays(now, 30);
    case '3M': return subDays(now, 90);
    case 'YTD': return startOfYear(now);
    case '1Y': return subDays(now, 365);
    case 'All': return null;
  }
}

import type { ParsedStatement } from '@/services/parser/types';

function NavSummaryCard({ parsedStatement, timeframe, setTimeframe }: { parsedStatement: ParsedStatement; timeframe: PnlTimeframe; setTimeframe: (tf: PnlTimeframe) => void }) {
  const [showDollar, setShowDollar] = useState(false);
  const toggleDisplay = () => setShowDollar(prev => !prev);

  const navDelta = parsedStatement.nav.endingValue - parsedStatement.nav.startingValue;
  const navPct = parsedStatement.nav.startingValue !== 0
    ? (navDelta / parsedStatement.nav.startingValue) * 100
    : 0;

  const cutoff = getTimeframeCutoff(timeframe);
  const windowTrades = parsedStatement.trades.filter((t) => {
    if (!cutoff || !t.dateTime) return true;
    try { return isAfter(parseISO(t.dateTime), cutoff); } catch { return false; }
  });
  const commissionsDelta = windowTrades.reduce((sum, t) => sum + (t.commission || 0), 0);
  const totalCommissions = Math.abs(parsedStatement.nav.commissions);
  const commissionsPct = totalCommissions !== 0
    ? (Math.abs(commissionsDelta) / totalCommissions) * 100
    : 0;

  const twrrDollar = parsedStatement.nav.markToMarket;

  const ChangeBadge = ({ value, pct, negative }: { value: number; pct: number; negative?: boolean }) => {
    const displayValue = showDollar
      ? ((value >= 0 && !negative ? '+' : '') + fmtCurrency(negative ? Math.abs(value) : value))
      : ((pct >= 0 && !negative ? '+' : '') + pct.toFixed(1) + '%');
    const isNeg = negative ? true : value < 0;
    return (
      <button
        onClick={toggleDisplay}
        className={cn(
          'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors',
          isNeg ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
        )}
        title="Click to toggle $ / %"
      >
        {displayValue}
      </button>
    );
  };

  return (
    <Card>
      <CardContent className="py-2 px-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">NAV</p>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold font-mono">{fmtCurrency(parsedStatement.nav.endingValue)}</p>
            <ChangeBadge value={navDelta} pct={navPct} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">TWRR</p>
          <div className="flex items-center gap-1.5">
            <p className={cn('text-sm font-bold font-mono', parsedStatement.nav.twrr >= 0 ? 'text-success' : 'text-danger')}>
              {parsedStatement.nav.twrr.toFixed(1)}%
            </p>
            <ChangeBadge value={twrrDollar} pct={parsedStatement.nav.twrr} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Commissions</p>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold font-mono text-danger">{fmtCurrency(totalCommissions)}</p>
            <ChangeBadge value={commissionsDelta} pct={commissionsPct} negative />
          </div>
        </div>
        <div className="flex flex-wrap gap-0.5 pt-1 border-t border-border">
          {PNL_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-colors',
                tf === timeframe
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PnlTimeframeCard({ parsedStatement, timeframe }: { parsedStatement: ParsedStatement; timeframe: PnlTimeframe }) {

  const breakdown = useMemo(() => {
    const cutoff = getTimeframeCutoff(timeframe);
    const windowTrades = parsedStatement.trades.filter((t) => {
      if (!cutoff || !t.dateTime) return true;
      try { return isAfter(parseISO(t.dateTime), cutoff); } catch { return false; }
    });

    const realizedPL = windowTrades.reduce((sum, t) => sum + (t.realizedPL || 0) + (t.mtmPL || 0), 0);
    const unrealizedPL = parsedStatement.openPositions.reduce(
      (sum, p) => sum + (p.unrealizedPL || 0), 0
    );

    const total = (timeframe === 'All' && parsedStatement.nav.markToMarket !== 0)
      ? parsedStatement.nav.markToMarket
      : realizedPL + unrealizedPL;

    const sorted = [...windowTrades]
      .filter(t => t.dateTime)
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    const cumulativeCurve: number[] = [0];
    let running = 0;
    for (const t of sorted) {
      running += (t.realizedPL || 0) + (t.mtmPL || 0);
      cumulativeCurve.push(running);
    }
    cumulativeCurve.push(running + unrealizedPL);

    const unrealizedBySymbol = [...parsedStatement.openPositions]
      .filter(p => p.unrealizedPL !== 0)
      .sort((a, b) => Math.abs(b.unrealizedPL) - Math.abs(a.unrealizedPL))
      .slice(0, 5);

    const realizedMap = new Map<string, number>();
    for (const t of windowTrades) {
      realizedMap.set(t.symbol, (realizedMap.get(t.symbol) || 0) + (t.realizedPL || 0) + (t.mtmPL || 0));
    }
    const topRealized = [...realizedMap.entries()]
      .filter(([, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5);

    return { realizedPL, unrealizedPL, total, unrealizedBySymbol, topRealized, cumulativeCurve };
  }, [parsedStatement, timeframe]);

  const formatted = (breakdown.total >= 0 ? '+' : '') + fmtCurrency(breakdown.total);
  const fmtSigned = (v: number) => (v >= 0 ? '+' : '') + fmtCurrency(v);

  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L</p>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button className="text-[9px] text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted cursor-help">
                {timeframe}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 p-3" side="bottom" align="end">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Breakdown</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Realized</span>
                    <span className={cn('font-mono font-medium', breakdown.realizedPL >= 0 ? 'text-success' : 'text-danger')}>
                      {fmtSigned(breakdown.realizedPL)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-0.5">
                    <span className="text-muted-foreground">Unrealized</span>
                    <span className={cn('font-mono font-medium', breakdown.unrealizedPL >= 0 ? 'text-success' : 'text-danger')}>
                      {fmtSigned(breakdown.unrealizedPL)}
                    </span>
                  </div>
                  <div className="border-t border-border mt-1.5 pt-1 flex justify-between text-xs font-semibold">
                    <span>Total</span>
                    <span className={cn('font-mono', breakdown.total >= 0 ? 'text-success' : 'text-danger')}>
                      {fmtSigned(breakdown.total)}
                    </span>
                  </div>
                </div>

                {breakdown.unrealizedBySymbol.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Top Unrealized</p>
                    {breakdown.unrealizedBySymbol.map((p) => (
                      <div key={p.symbol} className="flex justify-between text-[11px] py-0.5">
                        <span className="font-medium">{p.symbol}</span>
                        <span className={cn('font-mono', p.unrealizedPL >= 0 ? 'text-success' : 'text-danger')}>
                          {fmtSigned(p.unrealizedPL)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {breakdown.topRealized.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Top Realized</p>
                    {breakdown.topRealized.map(([sym, val]) => (
                      <div key={sym} className="flex justify-between text-[11px] py-0.5">
                        <span className="font-medium">{sym}</span>
                        <span className={cn('font-mono', val >= 0 ? 'text-success' : 'text-danger')}>
                          {fmtSigned(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <p className={cn('text-lg font-bold font-mono mb-2', breakdown.total >= 0 ? 'text-success' : 'text-danger')}>
          {formatted}
        </p>
        {breakdown.cumulativeCurve.length >= 2 && (
          <div className="mb-2 -mx-1">
            <Sparkline
              data={breakdown.cumulativeCurve}
              height={56}
              showBaseline
              highlightIndex={breakdown.cumulativeCurve.length - 1}
              ariaLabel={`Cumulative P&L sparkline for ${timeframe} timeframe, total ${formatted}`}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Market Cap Distribution Card ─── */

const MCAP_TIERS: { label: string; min: number }[] = [
  { label: 'Mega Cap',  min: 200e9  },
  { label: 'Large Cap', min: 10e9   },
  { label: 'Mid Cap',   min: 2e9    },
  { label: 'Small Cap', min: 300e6  },
  { label: 'Micro Cap', min: 0      },
];

function classifyMcap(mc: number | undefined): string {
  // Never return 'Unknown' — defaulting to Micro Cap when data is missing
  // gives the user a real bucket (sortable, colorable, filterable) instead
  // of a black-hole tier. The only tickers that escape every market-cap
  // data source are obscure micro-caps anyway, so the default is usually
  // close to the truth statistically.
  if (!mc || mc <= 0) return 'Micro Cap';
  for (const t of MCAP_TIERS) {
    if (mc >= t.min) return t.label;
  }
  return 'Micro Cap';   // any positive value below the smallest tier
}

function mcapColor(label: string): string {
  return label === 'Unknown' ? 'hsl(var(--muted))' : getCategoryColor('cap', label);
}

function MarketCapCard({ holdings, marketCaps }: { holdings: { ticker: string; marketValue: number }[]; marketCaps: Record<string, number> }) {
  const buckets = useMemo(() => {
    const map: Record<string, { value: number; count: number }> = {};
    let total = 0;
    for (const h of holdings) {
      const mc = marketCaps[h.ticker];
      const tier = classifyMcap(mc);
      if (!map[tier]) map[tier] = { value: 0, count: 0 };
      map[tier].value += h.marketValue;
      map[tier].count += 1;
      total += h.marketValue;
    }
    // Build ordered array
    const ordered = MCAP_TIERS.map((t) => ({
      name: t.label,
      value: map[t.label]?.value || 0,
      count: map[t.label]?.count || 0,
      pct: total > 0 ? ((map[t.label]?.value || 0) / total) * 100 : 0,
      color: getCategoryColor('cap', t.label),
    })).filter((b) => b.value > 0);
    // Add unknown if present
    if (map['Unknown']) {
      ordered.push({
        name: 'Unknown',
        value: map['Unknown'].value,
        count: map['Unknown'].count,
        pct: total > 0 ? (map['Unknown'].value / total) * 100 : 0,
        color: 'hsl(var(--muted))',
      });
    }
    return ordered;
  }, [holdings, marketCaps]);

  if (buckets.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-2 px-3 space-y-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Market Cap</p>
        <div className="flex justify-center w-full">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie
                data={buckets}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={44}
                strokeWidth={1}
                stroke="hsl(var(--background))"
              >
                {buckets.map((b) => (
                  <Cell key={b.name} fill={b.color} />
                ))}
              </Pie>
              <ReTooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded px-2 py-1 text-xs shadow-md">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">{d.pct.toFixed(1)}% · {d.count} holding{d.count !== 1 ? 's' : ''}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-0.5">
          {buckets.map((b) => (
            <div key={b.name} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                <span className="text-muted-foreground">{b.name}</span>
              </div>
              <span className="font-mono font-medium">{b.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Holdings sortable header ─── */

type HoldingsSortCol =
  | 'ticker' | 'shares' | 'cost' | 'marketValue' | 'pl'
  | 'sector' | 'country' | 'marketCap'
  | 'tradeStyle' | 'priceTarget' | 'stopLoss'
  | 'distToTarget' | 'distToStop'
  | 'range52pos' | 'analyst';

function HoldingsSortableTh({
  label, col, active, asc, onSort, align,
}: {
  label: string; col: HoldingsSortCol; active: HoldingsSortCol; asc: boolean;
  onSort: (col: HoldingsSortCol) => void; align: 'left' | 'right' | 'center';
}) {
  const isActive = active === col;
  return (
    <th
      className={cn(
        'py-1.5 px-1.5 font-medium text-muted-foreground cursor-pointer select-none transition-colors hover:text-foreground',
        'sticky top-0 z-10 bg-card border-b border-border',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
      )}
      onClick={() => onSort(col)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSort(col); }}
      tabIndex={0}
      role="columnheader"
      aria-sort={isActive ? (asc ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {isActive && <span className="ml-0.5 text-[8px]">{asc ? '▲' : '▼'}</span>}
    </th>
  );
}

/* ─── SEO Hook ─── */

function usePageMeta(title: string, description: string, canonical?: string) {
  useEffect(() => {
    document.title = title;
    
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    return () => {
      document.title = 'Portfolio';
    };
  }, [title, description, canonical]);
}

const Portfolio = () => {
  const { data: dbHoldings = [], isLoading: isDbLoading } = usePortfolio();
  const { parsedStatement } = useStatement();
  const [navTimeframe, setNavTimeframe] = useState<PnlTimeframe>('All');

  // SEO
  usePageMeta(
    'Portfolio Overview — Holdings & Allocation Analysis',
    'Analyze your investment portfolio with interactive allocation charts, P&L tracking, sector breakdowns, and sortable holdings. Monitor NAV, TWRR, and performance across timeframes.',
    typeof window !== 'undefined' ? window.location.href.split('?')[0] : undefined,
  );

  // Linked sort state
  const { isLinked, toggleLinked, sharedSort, setSharedSort } = useLinkedSort();
  const { setSlot } = useNavbarSlot();

  // Inject the Link/Unlink sort button into the Navbar slot while on this page
  useEffect(() => {
    setSlot(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLinked}
              aria-label={`Sort synchronization: currently ${isLinked ? 'linked' : 'unlinked'}`}
              aria-pressed={isLinked}
              className={cn(
                'gap-1.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring',
                isLinked
                  ? 'bg-link-active text-link-active-foreground hover:bg-link-active/90 border-link-active/50'
                  : 'bg-muted text-link-inactive hover:bg-muted/80 border-border'
              )}
            >
              {isLinked ? (
                <>
                  <Link2 className={cn('h-3.5 w-3.5', isLinked && 'animate-pulse-gentle')} aria-hidden="true" />
                  <span className="hidden sm:inline">Linked</span>
                </>
              ) : (
                <>
                  <Unlink2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Unlinked</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isLinked ? 'Sorting is synchronized between cards. Click to unlink.' : 'Cards sort independently. Click to synchronize sorting.'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    return () => setSlot(null);
  }, [isLinked, toggleLinked, setSlot]);

  // Active grouping key from AllocationExplorer
  const [activeGroupingKey, setActiveGroupingKey] = useState<GroupingKey>('Position');

  // Holdings local sort
  const [holdingsSortCol, setHoldingsSortCol] = useState<HoldingsSortCol>('marketValue');
  const [holdingsSortAsc, setHoldingsSortAsc] = useState(false);

  // Effective holdings sort
  const effectiveHoldingsCol = isLinked ? sharedToHoldingsCol(sharedSort.col) as HoldingsSortCol : holdingsSortCol;
  const effectiveHoldingsAsc = isLinked ? sharedSort.asc : holdingsSortAsc;

  // Effective allocation sort (primitives to avoid stale closure issues)
  const effectiveAllocSortCol: AllocSortCol | undefined = isLinked
    ? sharedToAllocCol(sharedSort.col) as AllocSortCol
    : undefined;
  const effectiveAllocSortAsc: boolean | undefined = isLinked ? sharedSort.asc : undefined;

  // When linked, tab change updates the holdings sort to group by that factor
  const handleAllocTabChange = useCallback((key: GroupingKey) => {
    setActiveGroupingKey(key);
    if (isLinked) {
      // Map grouping key to holdings sort column
      const colMap: Record<GroupingKey, HoldingsSortCol> = {
        'Position': 'marketValue',
        'Sector': 'sector',
        'Sub-Industry': 'sector',  // sub-industries belong to sectors — sector sort groups them naturally
        'Country': 'country',
        'Market Cap': 'marketCap',
        'Style': 'ticker',
      };
      const mappedCol = colMap[key];
      const sharedCol = holdingsColToShared(mappedCol);
      setSharedSort({ col: sharedCol, asc: false });
    }
  }, [isLinked, setSharedSort]);

  const handleHoldingsSort = useCallback((col: HoldingsSortCol) => {
    if (isLinked) {
      const sharedCol = holdingsColToShared(col);
      const newAsc = sharedSort.col === sharedCol ? !sharedSort.asc : false;
      setSharedSort({ col: sharedCol, asc: newAsc });
    } else {
      if (holdingsSortCol === col) setHoldingsSortAsc((p) => !p);
      else { setHoldingsSortCol(col); setHoldingsSortAsc(false); }
    }
  }, [isLinked, sharedSort, holdingsSortCol, setSharedSort]);

  const handleAllocSortChange = useCallback((col: AllocSortCol, asc: boolean) => {
    const sharedCol = allocColToShared(col);
    setSharedSort({ col: sharedCol, asc });
  }, [setSharedSort]);

  /* Merge: parsed statement positions take priority over DB holdings */
  const holdings = useMemo(() => {
    if (parsedStatement && parsedStatement.openPositions.length > 0) {
      return parsedStatement.openPositions.
      filter((p) => p.quantity > 0 && p.assetCategory === 'Stocks').
      map((p) => ({
        id: p.symbol,
        ticker: p.symbol,
        name: p.description,
        shares: p.quantity,
        avgCost: p.costPrice,
        marketValue: p.marketValue,
        unrealizedPL: p.unrealizedPL,
        currency: p.currency,
        purchaseDate: '',
        exchange: p.exchange || ''
      }));
    }
    return dbHoldings.map((h: any) => ({
      id: h.id,
      ticker: h.localTicker || h.canonicalTicker || '?',
      name: h.symbolName || '',
      shares: h.shares,
      avgCost: h.avg_cost_basis,
      marketValue: h.shares * h.avg_cost_basis,
      unrealizedPL: 0,
      currency: h.currency || 'USD',
      purchaseDate: h.purchase_date || '',
      exchange: h.exchangeCode || ''
    }));
  }, [parsedStatement, dbHoldings]);

  const isLoading = isDbLoading && !parsedStatement;

  const tickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);

  // Batch fetch market caps
  const { data: marketCapsRaw = {} } = useMarketCaps(tickers);

  // Build ticker+exchange pairs for exchange-aware lookup
  const tickerExchangePairs = useMemo(() =>
    holdings.map(h => ({ ticker: h.ticker, exchange: h.exchange || undefined })),
    [holdings]
  );

  const { data: symbolInfoBase = {}, refetch: refetchSymbolInfo } = useQuery({
    queryKey: ['portfolio-symbol-info', tickers, holdings.map(h => h.exchange).join(',')],
    queryFn: () => batchLookupSymbols(tickerExchangePairs),
    enabled: tickers.length > 0,
    // Always refetch on mount — EODHD writes to the symbols table as a side
    // effect of the lookup, so each fresh page load can pick up newly enriched
    // gics_sub_industry data that was missing on the previous render.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Once the initial lookup completes, kick off a delayed refetch to pick up
  // sub-industry data that the EODHD edge fn wrote back to the DB AFTER the
  // 25-second race-against-timeout fired. Without this, holdings whose EODHD
  // call resolved late stay stuck on the "sector fallback" until manual reload.
  useEffect(() => {
    if (tickers.length === 0) return;
    const subIndustryCount = Object.values(symbolInfoBase).filter(
      (m: any) => m?.subIndustry,
    ).length;
    // If most holdings still lack sub-industry, schedule a refetch in 30s so
    // the in-flight EODHD writes have time to land in the DB.
    if (subIndustryCount < tickers.length * 0.8) {
      const t = setTimeout(() => { refetchSymbolInfo(); }, 30_000);
      return () => clearTimeout(t);
    }
  }, [tickers, symbolInfoBase, refetchSymbolInfo]);

  // User-defined trade styles + notes (persisted in user_ticker_styles, RLS).
  // Survives every portfolio re-import — keyed to the ticker, not the holding.
  const { data: tickerStyles = {} } = useTickerStyles();
  const { data: ranges52 }          = use52Week(tickers);
  const { data: analystRatings = {} } = useAnalystRatings(tickers);

  // Merge market cap + user style/note into symbolInfo
  const symbolInfo: Record<string, SymbolMeta> = useMemo(() => {
    const merged: Record<string, SymbolMeta> = {};
    for (const t of tickers) {
      const base = symbolInfoBase[t] || { sector: 'Other', country: 'Unknown', subIndustry: '' };
      const style = tickerStyles[t.toUpperCase()];
      merged[t] = {
        ...base,
        marketCap:   marketCapsRaw[t],
        tradeStyle:  style?.tradeStyle ?? 'Unclassified',
        tradeNote:   style?.note ?? undefined,
        priceTarget: style?.priceTarget ?? null,
        stopLoss:    style?.stopLoss    ?? null,
        entryDate:   style?.entryDate   ?? null,
      };
    }
    return merged;
  }, [tickers, symbolInfoBase, marketCapsRaw, tickerStyles]);

  // Helper: effective sector respecting ETF override
  const effectiveSector = useCallback((ticker: string) => {
    const meta = symbolInfo[ticker];
    if (meta?.isEtf) return 'ETFs';
    return normalizeSector(meta?.sector || 'Other');
  }, [symbolInfo]);

  const sectorMap = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(symbolInfo).forEach(([k, v]) => {
      // Always normalize through the canonical GICS map so color lookups
      // get a valid sector key even when the raw DB/API string is non-canonical.
      m[k] = v.isEtf ? 'ETFs' : normalizeSector(v.sector || 'Other');
    });
    return m;
  }, [symbolInfo]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.marketValue, 0), [holdings]);

  // Allocation Explorer group filter
  const [allocFilter,       setAllocFilter]       = useState<{ key: GroupingKey; group: string } | null>(null);
  const [holdingsCollapsed, setHoldingsCollapsed] = useState(true);
  const handleGroupFilter = useCallback((key: GroupingKey, group: string | null) => {
    setAllocFilter(group ? { key, group } : null);
  }, []);

  // Pre-compute group weights for sector/country/marketCap sorting by total value
  const groupWeights = useMemo(() => {
    const sectorWeights: Record<string, number> = {};
    const countryWeights: Record<string, number> = {};
    const mcapTierWeights: Record<string, number> = {};
    for (const h of holdings) {
      const meta = symbolInfo[h.ticker];
      const sec = effectiveSector(h.ticker);
      const cty = meta?.country || 'Unknown';
      const tier = classifyMcap(meta?.marketCap);
      sectorWeights[sec] = (sectorWeights[sec] || 0) + h.marketValue;
      countryWeights[cty] = (countryWeights[cty] || 0) + h.marketValue;
      mcapTierWeights[tier] = (mcapTierWeights[tier] || 0) + h.marketValue;
    }
    return { sectorWeights, countryWeights, mcapTierWeights };
  }, [holdings, symbolInfo]);

  const filteredHoldings = useMemo(() => {
    const base = allocFilter
      ? holdings.filter((h) => {
          const meta = symbolInfo[h.ticker];
          if (!meta) return false;
          switch (allocFilter.key) {
            case 'Sector': return effectiveSector(h.ticker) === allocFilter.group;
            case 'Sub-Industry': {
              if (meta.isEtf) return allocFilter.group === 'ETFs';
              // Mirror the AllocationExplorer fallback chain: sub-industry →
              // industry → industry group → sector. The filter must use the
              // same level the chart used, otherwise clicking a group shows
              // an empty holdings list.
              const si = (meta as any).subIndustry
                || (meta as any).gicsIndustry
                || (meta as any).gicsIndustryGroup
                || normalizeSector(meta.sector || 'Other');
              return si === allocFilter.group;
            }
            case 'Country': return meta.country === allocFilter.group;
            case 'Market Cap': return classifyMcap(meta.marketCap) === allocFilter.group;
            default: return true;
          }
        })
      : holdings;

    // Sort — sector/country sort by group total value (largest group first), then by individual value within group
    const sorted = [...base];
    const col = effectiveHoldingsCol;
    const asc = effectiveHoldingsAsc;
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'ticker': cmp = a.ticker.localeCompare(b.ticker); break;
        case 'shares': cmp = a.shares - b.shares; break;
        case 'cost': cmp = a.avgCost - b.avgCost; break;
        case 'marketValue': cmp = a.marketValue - b.marketValue; break;
        case 'pl': cmp = a.unrealizedPL - b.unrealizedPL; break;
        case 'sector': {
          const sa = effectiveSector(a.ticker);
          const sb = effectiveSector(b.ticker);
          // Primary: sort by sector group total value (largest first)
          const wa = groupWeights.sectorWeights[sa] || 0;
          const wb = groupWeights.sectorWeights[sb] || 0;
          cmp = wa - wb;
          // Secondary: within same sector, sort by individual market value
          if (cmp === 0) cmp = a.marketValue - b.marketValue;
          break;
        }
        case 'country': {
          const ca = symbolInfo[a.ticker]?.country || 'Unknown';
          const cb = symbolInfo[b.ticker]?.country || 'Unknown';
          const wa = groupWeights.countryWeights[ca] || 0;
          const wb = groupWeights.countryWeights[cb] || 0;
          cmp = wa - wb;
          if (cmp === 0) cmp = a.marketValue - b.marketValue;
          break;
        }
        case 'marketCap': {
          const ta = classifyMcap(symbolInfo[a.ticker]?.marketCap);
          const tb = classifyMcap(symbolInfo[b.ticker]?.marketCap);
          // Primary: sort by tier group total portfolio value (largest tier first)
          const wa = groupWeights.mcapTierWeights[ta] || 0;
          const wb = groupWeights.mcapTierWeights[tb] || 0;
          cmp = wa - wb;
          // Secondary: within same tier, sort by individual market value
          if (cmp === 0) cmp = a.marketValue - b.marketValue;
          break;
        }
        case 'tradeStyle': {
          // Sort by user-defined trade style (alphabetical), unclassified last
          const sa = symbolInfo[a.ticker]?.tradeStyle || 'Unclassified';
          const sb = symbolInfo[b.ticker]?.tradeStyle || 'Unclassified';
          const rank: Record<string, number> = {
            'Day Trade': 0, 'Swing Trade': 1, 'Long Term': 2, 'Unclassified': 99,
            // Legacy keys for any in-flight pre-migration data
            'Swing': 1, 'Long Term Hold': 2,
          };
          cmp = (rank[sa] ?? 99) - (rank[sb] ?? 99);
          if (cmp === 0) cmp = a.marketValue - b.marketValue;
          break;
        }
        case 'priceTarget': {
          // Sort by raw target price; nulls last
          const ta = symbolInfo[a.ticker]?.priceTarget;
          const tb = symbolInfo[b.ticker]?.priceTarget;
          if (ta == null && tb == null) cmp = 0;
          else if (ta == null) cmp = 1;
          else if (tb == null) cmp = -1;
          else cmp = ta - tb;
          break;
        }
        case 'stopLoss': {
          const sa = symbolInfo[a.ticker]?.stopLoss;
          const sb = symbolInfo[b.ticker]?.stopLoss;
          if (sa == null && sb == null) cmp = 0;
          else if (sa == null) cmp = 1;
          else if (sb == null) cmp = -1;
          else cmp = sa - sb;
          break;
        }
        case 'distToTarget': {
          // "Closest to target" = smallest absolute % distance from current price.
          // currentPrice = marketValue / shares. Tickers without a target sort last.
          const priceA = a.shares > 0 ? a.marketValue / a.shares : 0;
          const priceB = b.shares > 0 ? b.marketValue / b.shares : 0;
          const tgtA   = symbolInfo[a.ticker]?.priceTarget;
          const tgtB   = symbolInfo[b.ticker]?.priceTarget;
          const distA  = tgtA && priceA > 0 ? Math.abs((tgtA - priceA) / priceA) : Infinity;
          const distB  = tgtB && priceB > 0 ? Math.abs((tgtB - priceB) / priceB) : Infinity;
          cmp = distA - distB;
          break;
        }
        case 'distToStop': {
          // "Closest to stop" = smallest absolute % distance from current price
          const priceA = a.shares > 0 ? a.marketValue / a.shares : 0;
          const priceB = b.shares > 0 ? b.marketValue / b.shares : 0;
          const stopA  = symbolInfo[a.ticker]?.stopLoss;
          const stopB  = symbolInfo[b.ticker]?.stopLoss;
          const distA  = stopA && priceA > 0 ? Math.abs((stopA - priceA) / priceA) : Infinity;
          const distB  = stopB && priceB > 0 ? Math.abs((stopB - priceB) / priceB) : Infinity;
          cmp = distA - distB;
          break;
        }
        case 'range52pos': {
          // Sort by position in 52W range (0 = near low, 1 = near high); no-data sorts last
          const rA = ranges52?.ranges?.[a.ticker];
          const rB = ranges52?.ranges?.[b.ticker];
          const pA = rA && rA.high52 > rA.low52 ? (rA.price - rA.low52) / (rA.high52 - rA.low52) : -1;
          const pB = rB && rB.high52 > rB.low52 ? (rB.price - rB.low52) / (rB.high52 - rB.low52) : -1;
          cmp = pA - pB;
          break;
        }
        case 'analyst': {
          // Sort by analyst mean score: 1=Strong Buy … 5=Sell. No rating sorts last.
          const mA = analystRatings[a.ticker]?.recommendationMean ?? 6;
          const mB = analystRatings[b.ticker]?.recommendationMean ?? 6;
          cmp = mA - mB;
          break;
        }
      }
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, [holdings, allocFilter, symbolInfo, effectiveHoldingsCol, effectiveHoldingsAsc, groupWeights]);

  return (
    <PageLayout title="Portfolio" description="Analyze your investment portfolio with interactive allocation charts, P&L tracking, and sortable holdings." canonical="/portfolio" hideTitle>
      <div className="space-y-3">

        {/* ── NAV summary ── */}
        {parsedStatement && parsedStatement.nav.endingValue > 0 &&
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 sm:items-stretch">
            <NavSummaryCard parsedStatement={parsedStatement} timeframe={navTimeframe} setTimeframe={setNavTimeframe} />
            <PnlTimeframeCard parsedStatement={parsedStatement} timeframe={navTimeframe} />
            {holdings.length >= 2 && (
              <EarningsCalendar
                className="h-full"
                holdings={holdings.map(h => ({
                  ticker:   h.ticker,
                  exchange: h.exchange || undefined,
                  // Enrich with the GICS sector that drives the dot color
                  // in EarningsCalendar rows. symbolInfo is built from the
                  // 3-layer sector lookup (static map → Supabase → Finnhub).
                  sector:   symbolInfo[h.ticker]?.sector ?? null,
                }))}
              />
            )}
          </div>
        }

        {/* Loading */}
        {isLoading &&
        <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading portfolio…</p>
          </div>
        }

        {/* Empty */}
        {!isLoading && holdings.length === 0 &&
        <div className="flex flex-col items-center justify-center gap-3 py-8">
            <p className="text-muted-foreground text-sm">No holdings yet. Upload a statement or connect a brokerage.</p>
            <div className="w-full max-w-sm">
              <SnapTradeConnectCard />
            </div>
          </div>
        }

        {/* SnapTrade controls — visible whenever the user has any holdings,
            so they can connect another broker or refresh. */}
        {holdings.length > 0 &&
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div /> {/* spacer to right-align */}
            <div className="w-full sm:w-[280px]">
              <SnapTradeConnectCard />
            </div>
          </div>
        }

        {holdings.length > 0 &&
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
            <div>
              <div className="bg-card rounded-lg p-4 shadow h-[648px]">
                <AllocationExplorer
                  holdings={holdings as AllocationHolding[]}
                  symbolInfo={symbolInfo as Record<string, SymbolMeta>}
                  totalValue={totalValue}
                  holdingCount={holdings.length}
                  onGroupFilter={handleGroupFilter}
                  controlledSortCol={effectiveAllocSortCol}
                  controlledSortAsc={effectiveAllocSortAsc}
                  onSortChange={handleAllocSortChange}
                  onTabChange={handleAllocTabChange}
                />
              </div>
            </div>

            <div>
              <div className="bg-card rounded-lg px-3 py-3 shadow min-h-[420px]">
                {/* Header row: title + collapse toggle */}
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">
                    Holdings
                    {allocFilter && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                        ({filteredHoldings.length} of {holdings.length})
                      </span>
                    )}
                  </h2>
                  {filteredHoldings.length > 15 && (
                    <button
                      type="button"
                      onClick={() => setHoldingsCollapsed(v => !v)}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted/70 shrink-0"
                    >
                      {holdingsCollapsed ? `Expand (${filteredHoldings.length})` : 'Collapse'}
                    </button>
                  )}
                </div>

                {/* Scrollable table — max-height when collapsed, unconstrained when expanded */}
                <div
                  className={cn(
                    'overflow-x-auto',
                    holdingsCollapsed && filteredHoldings.length > 15
                      ? 'overflow-y-auto max-h-[596px] pb-2'
                      : '',
                  )}
                >
                  <table className="w-full text-[11px]" aria-label="Portfolio holdings">
                     <thead>
                      <tr className="border-b">
                        <HoldingsSortableTh label="Ticker"  col="ticker"      active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="left" />
                        <HoldingsSortableTh label="Shares"  col="shares"      active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="Cost"    col="cost"        active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="Mkt Val" col="marketValue" active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="P&L"     col="pl"          active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="52W"     col="range52pos"  active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="center" />
                        <HoldingsSortableTh label="Target"  col="priceTarget" active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="→Tgt%"   col="distToTarget" active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="Stop"    col="stopLoss"    active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="→Stop%"  col="distToStop"  active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="right" />
                        <HoldingsSortableTh label="Analyst" col="analyst"     active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="center" />
                        <HoldingsSortableTh label="Style"   col="tradeStyle"  active={effectiveHoldingsCol} asc={effectiveHoldingsAsc} onSort={handleHoldingsSort} align="center" />
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const isGrouped = activeGroupingKey !== 'Position';
                        let lastGroup = '';
                        return filteredHoldings.map((h) => {
                          const meta = symbolInfo[h.ticker];
                          const group = isGrouped ? classifyHolding(h.ticker, meta, activeGroupingKey) : '';
                          const showHeader = isGrouped && group !== lastGroup;
                          if (isGrouped) lastGroup = group;
                          const color = isGrouped ? groupColor(activeGroupingKey, group, meta) : '';
                          const displayGroup = activeGroupingKey === 'Country' ? (COUNTRY_NAMES[group] || group) : group;
                          return (
                            <React.Fragment key={h.id}>
                              {showHeader && (
                                <tr>
                                  <td colSpan={12} className="pt-2.5 pb-1 px-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{displayGroup}</span>
                                      <span className="flex-1 border-b border-border/30" />
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr className={cn('border-b border-border/50', isGrouped && 'border-l-2')} style={isGrouped ? { borderLeftColor: color } : undefined}>
                                <td className="py-1.5 px-1.5">
                                  <div className="flex items-start gap-1.5">
                                    <span className="h-2 w-2 rounded-full flex-shrink-0 mt-[3px]" style={{ backgroundColor: isGrouped ? color : getGicsSectorColor(sectorMap[h.ticker] || null) }} />
                                    <div className="min-w-0">
                                      <span className="font-medium font-mono block leading-tight">{h.ticker}</span>
                                      {/* Secondary line: always show the most-granular GICS classification.
                                          When grouped, the section header already shows the parent group, so
                                          repeating it here is redundant — instead show one level deeper:
                                            • on the Sector tab → show sub-industry (or industry, then group)
                                            • on the Sub-Industry tab → row IS already the sub-industry, so
                                              fall back to the company name for variety
                                            • on Country / Market Cap / Style → show the sector for context
                                          ETFs always show "ETFs" since they have no sub-industry. */}
                                      <span className="text-[9px] text-muted-foreground leading-tight truncate block max-w-[140px]">
                                        {(() => {
                                          if (meta?.isEtf) return 'ETFs';
                                          const finest =
                                            meta?.subIndustry ||
                                            (meta as any)?.gicsIndustry ||
                                            (meta as any)?.gicsIndustryGroup ||
                                            sectorMap[h.ticker] ||
                                            '';
                                          if (!isGrouped) return finest || h.name || '—';
                                          // Grouped: avoid echoing the section header
                                          if (activeGroupingKey === 'Sub-Industry') {
                                            // Row IS already the sub-industry — show company name instead
                                            return h.name || '—';
                                          }
                                          // For Sector / Country / Market Cap / Style: show finest GICS level
                                          return finest && finest !== displayGroup ? finest : (h.name || '—');
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{h.shares}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">${h.avgCost.toFixed(2)}</td>
                                <td className="py-1.5 px-1.5 text-right font-mono">{fmtCurrency(h.marketValue)}</td>
                                <td className={cn('py-1.5 px-1.5 text-right font-mono', h.unrealizedPL >= 0 ? 'text-success' : 'text-danger')}>
                                  {h.unrealizedPL >= 0 ? '+' : ''}{fmtCurrency(h.unrealizedPL)}
                                </td>
                                {/* 52-week range bar — shows where current price sits between low and high */}
                                <td className="py-1.5 px-2">
                                  {(() => {
                                    const r = ranges52?.ranges?.[h.ticker];
                                    if (!r || r.high52 <= r.low52) return <span className="text-muted-foreground text-[9px]">—</span>;
                                    const pos = Math.max(0, Math.min(100, ((r.price - r.low52) / (r.high52 - r.low52)) * 100));
                                    const color = pos >= 80 ? '#34d399' : pos <= 20 ? '#f87171' : '#94a3b8';
                                    return (
                                      <div className="w-14 space-y-0.5" title={`52W: $${r.low52.toFixed(2)} – $${r.high52.toFixed(2)}`}>
                                        <div className="relative h-1 bg-muted/60 rounded-full">
                                          <div
                                            className="absolute top-0 h-full rounded-full opacity-30"
                                            style={{ width: `${pos}%`, backgroundColor: color }}
                                          />
                                          <div
                                            className="absolute top-1/2 -translate-y-1/2 h-2.5 w-0.5 rounded-full"
                                            style={{ left: `${pos}%`, backgroundColor: color }}
                                          />
                                        </div>
                                        <div className="flex justify-between text-[8px] font-mono text-muted-foreground/60">
                                          <span>L</span><span className="font-medium" style={{ color }}>{pos.toFixed(0)}%</span><span>H</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </td>
                                {/* Target / Stop columns + their % distance from current price.
                                    currentPrice = marketValue / shares; both fields are nullable. */}
                                {(() => {
                                  const currentPrice = h.shares > 0 ? h.marketValue / h.shares : 0;
                                  const target = meta?.priceTarget ?? null;
                                  const stop   = meta?.stopLoss    ?? null;
                                  const tgtPct = target && currentPrice > 0 ? ((target - currentPrice) / currentPrice) * 100 : null;
                                  const stpPct = stop   && currentPrice > 0 ? ((stop   - currentPrice) / currentPrice) * 100 : null;
                                  return (
                                    <>
                                      <td className="py-1.5 px-1.5 text-right font-mono text-emerald-300">
                                        {target == null ? '—' : `$${target.toFixed(2)}`}
                                      </td>
                                      <td className={cn(
                                        'py-1.5 px-1.5 text-right font-mono text-[10px]',
                                        tgtPct == null ? 'text-muted-foreground' :
                                          tgtPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      )}>
                                        {tgtPct == null ? '—' : `${tgtPct >= 0 ? '+' : ''}${tgtPct.toFixed(1)}%`}
                                      </td>
                                      <td className="py-1.5 px-1.5 text-right font-mono text-rose-300">
                                        {stop == null ? '—' : `$${stop.toFixed(2)}`}
                                      </td>
                                      <td className={cn(
                                        'py-1.5 px-1.5 text-right font-mono text-[10px]',
                                        stpPct == null ? 'text-muted-foreground' :
                                          stpPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      )}>
                                        {stpPct == null ? '—' : `${stpPct >= 0 ? '+' : ''}${stpPct.toFixed(1)}%`}
                                      </td>
                                    </>
                                  );
                                })()}
                                {/* Analyst consensus — rating label + mean price target from Yahoo Finance */}
                                <td className="py-1.5 px-1.5 text-center">
                                  {(() => {
                                    const rating = analystRatings[h.ticker];
                                    if (!rating || rating.consensusLabel === '—') {
                                      return <span className="text-[9px] text-muted-foreground/50">—</span>;
                                    }
                                    return (
                                      <div className="space-y-0.5">
                                        <span className={cn('text-[9px] font-medium block', analystColor(rating.recommendationKey))}>
                                          {rating.consensusLabel}
                                        </span>
                                        {rating.targetMeanPrice != null && (
                                          <span className="text-[8px] text-muted-foreground font-mono block">
                                            ${rating.targetMeanPrice.toFixed(0)}
                                            {rating.analystCount != null && ` ·${rating.analystCount}`}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="py-1.5 px-1.5 text-center">
                                  {/* Per-ticker trade-style annotation. Click to edit / delete.
                                      Persists across portfolio re-imports via user_ticker_styles. */}
                                  <TickerStyleEditor
                                    ticker={h.ticker}
                                    exchange={h.exchange}
                                    current={meta?.tradeStyle as any}
                                    note={meta?.tradeNote}
                                    priceTarget={meta?.priceTarget}
                                    stopLoss={meta?.stopLoss}
                                    entryDate={meta?.entryDate}
                                    shares={h.shares > 0 ? h.shares : undefined}
                                    currentPrice={h.shares > 0 ? h.marketValue / h.shares : undefined}
                                  />
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ── Correlation Matrix (full width) ───────────────────────────── */}
          {holdings.length >= 2 && (
            <CorrelationMatrix holdings={holdings.map(h => ({
              ticker:      h.ticker,
              name:        h.name || undefined,
              exchange:    h.exchange || undefined,
              sector:      effectiveSector(h.ticker),
              subIndustry: (symbolInfo[h.ticker] as any)?.subIndustry || undefined,
              marketValue: h.marketValue,
            }))} />
          )}
        </>
        }
      </div>
    </PageLayout>);

};

export default Portfolio;
