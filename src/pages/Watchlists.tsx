import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StockLogo } from '@/components/stocks/StockLogo';
import { StockSearch } from '@/components/search/StockSearch';
import { Sparkline } from '@/components/ui/sparkline';
import { useSparklineData, useIntradaySparkline } from '@/hooks/useSparklineData';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Search, X, ExternalLink, Star, Pencil, Check,
  ArrowUpIcon, ArrowDownIcon, ChevronDown, ChevronLeft, ChevronRight,
  Eye, EyeOff, Maximize2, Minimize2,
} from 'lucide-react';
import { useWatchlists, type WatchlistEntry } from '@/hooks/useWatchlists';
import { useEodhdStock, type EodhdStockData } from '@/hooks/useEodhdStock';
import { formatCurrency, formatNumber } from '@/utils/stocksApi';
import { useNews, useStocks } from '@/hooks/useSupabaseData';
import { useDefeatBetaNews } from '@/hooks/useDefeatBeta';
import { useStockHistory } from '@/hooks/useStockHistory';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsItem, Stock } from '@/utils/stocksApi';

// ── Sparkline periods ─────────────────────────────────────────────────────────
// Trading-day approximations of each calendar period. We fetch 365 days once
// and slice client-side so each stock makes only 1 API call.

const SPARKLINE_PERIODS = [
  { label: '7D',   tradingDays:   5 },
  { label: '30D',  tradingDays:  21 },
  { label: '60D',  tradingDays:  42 },
  { label: '90D',  tradingDays:  63 },
  { label: '120D', tradingDays:  84 },
  { label: '1Y',   tradingDays: 252 },
] as const;

function WatchlistSparklines({
  symbol,
  exchange,
  open,
  expanded,
}: {
  symbol: string;
  exchange: string;
  open: boolean;
  expanded: boolean;
}) {
  // 1h bars for 1 month — covers 7D (~35 bars) and 30D (~130 bars) with rich detail
  const { data: hourlyBars = [], isLoading: hourlyLoading } = useIntradaySparkline(symbol, exchange);
  // Daily bars for the full year — covers 60D / 90D / 120D / 1Y via client-side slicing
  const { data: dailyBars  = [], isLoading: dailyLoading  } = useSparklineData(symbol, 365, exchange);

  // Supabase ohlcv_bars fallback — always available (no external API needed).
  // Only fires when EODHD daily bars are empty (quota exhausted / API down).
  // useStockHistory is disabled when ticker is '' (falsy), so passing '' when
  // EODHD already has data avoids an unnecessary Supabase round-trip.
  const { data: sbBars = [], isLoading: sbLoading } = useStockHistory(
    dailyBars.length === 0 ? symbol : '',
    365,
  );
  const effectiveDailyBars: number[] = dailyBars.length > 0
    ? dailyBars
    : (sbBars ?? []).map((b) => Number(b.close));

  // Hidden: render nothing (no queries wasted — hooks run regardless, data is cached)
  if (!open) return null;

  const h = hourlyBars.length;
  const n = effectiveDailyBars.length;
  const isLoading = hourlyLoading || dailyLoading || (dailyBars.length === 0 && sbLoading);

  // Map each period label to the right data slice.
  // 7D/30D prefer hourly bars for density; fall back to daily slices if Yahoo
  // is unavailable (e.g. cold-start crumb fetch fails). Bezier smoothing makes
  // even the 5-point daily fallback look clean.
  const hasHourly = hourlyBars.length > 0;
  const periodData: Record<string, number[]> = {
    '7D':   hasHourly ? hourlyBars.slice(Math.max(0, h -  35))        // ~35 hourly bars
                      : effectiveDailyBars.slice(Math.max(0, n -  5)), // fallback: 5 daily
    '30D':  hasHourly ? hourlyBars                                      // all ~130 hourly bars
                      : effectiveDailyBars.slice(Math.max(0, n - 21)), // fallback: 21 daily
    '60D':  effectiveDailyBars.slice(Math.max(0, n -  42)),
    '90D':  effectiveDailyBars.slice(Math.max(0, n -  63)),
    '120D': effectiveDailyBars.slice(Math.max(0, n -  84)),
    '1Y':   effectiveDailyBars,
  };

  // Dimensions — normal vs expanded
  const sparkH  = expanded ? 52  : 32;
  const sparkW  = expanded ? 64  : 44;
  const skelCls = expanded ? 'h-14 w-16' : 'h-8 w-11';

  if (isLoading) {
    return (
      <div className="hidden xl:flex items-center gap-2 shrink-0">
        {SPARKLINE_PERIODS.map(({ label }) => (
          <Skeleton key={label} className={cn('rounded', skelCls)} />
        ))}
      </div>
    );
  }

  return (
    <div className="hidden xl:flex items-center gap-2 shrink-0">
      {SPARKLINE_PERIODS.map(({ label }) => (
        <Sparkline
          key={label}
          data={periodData[label] ?? []}
          height={sparkH}
          width={sparkW}
          animate={false}
          showBaseline={false}
          ariaLabel={`${symbol} ${label} performance`}
        />
      ))}
    </div>
  );
}

// ── Single stock row ──────────────────────────────────────────────────────────

function WatchlistStockRow({
  entry,
  listId,
  allLists,
  onRemove,
  onMove,
  sparklinesOpen,
  sparklinesExpanded,
  fallbackStock,
}: {
  entry: WatchlistEntry;
  listId: string;
  allLists: { id: string; name: string }[];
  onRemove: () => void;
  onMove: (toId: string) => void;
  sparklinesOpen: boolean;
  sparklinesExpanded: boolean;
  /** Supabase nightly-data fallback — used when EODHD/Yahoo return nothing. */
  fallbackStock?: Stock;
}) {
  const { data, isLoading } = useEodhdStock(entry.symbol, entry.exchange, entry.name);

  // ── Supabase fallback ──────────────────────────────────────────────────────
  // When EODHD + Yahoo both fail (quota, outage, bad crumb), useEodhdStock
  // returns null. Rather than showing "No data", we synthesise an
  // EodhdStockData object from the nightly-ingested Supabase row so that
  // price / change / marketCap columns are always populated.
  const fallbackData: EodhdStockData | null =
    !data && fallbackStock && fallbackStock.price > 0
      ? {
          stock: {
            symbol:        fallbackStock.symbol,
            name:          fallbackStock.name,
            price:         fallbackStock.price,
            change:        fallbackStock.change,
            changePercent: fallbackStock.changePercent,
            marketCap:     fallbackStock.marketCap,
            market_cap:    fallbackStock.marketCap,
            volume:        fallbackStock.volume,
            lastUpdated:   fallbackStock.lastUpdated,
            last_updated:  fallbackStock.lastUpdated.toISOString(),
            currency:      'USD',
          },
          priceHistory:      [],
          bars:              [],
          liveQuoteAvailable: false,
        }
      : null;

  /** Resolved data: live EODHD data, then Supabase fallback, then null. */
  const effectiveData = data ?? fallbackData;

  const [moveOpen, setMoveOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) setMoveOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const stocksHref = `/stocks?symbol=${entry.symbol}&exchange=${entry.exchange}${entry.name ? `&name=${encodeURIComponent(entry.name)}` : ''}`;
  const otherLists = allLists.filter(l => l.id !== listId);

  // ── Loading ──
  if (isLoading) {
    const skelCls = sparklinesExpanded ? 'h-14 w-16' : 'h-8 w-11';
    return (
      <div className="flex items-center gap-3 py-3 px-2">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
        {sparklinesOpen && (
          <div className="hidden xl:flex items-center gap-2 shrink-0">
            {SPARKLINE_PERIODS.map(({ label }) => (
              <Skeleton key={label} className={cn('rounded', skelCls)} />
            ))}
          </div>
        )}
        <Skeleton className="h-4 w-16 hidden sm:block" />
        <Skeleton className="h-4 w-14 hidden sm:block" />
        <Skeleton className="h-4 w-12 hidden md:block" />
        <Skeleton className="h-7 w-7" />
      </div>
    );
  }

  // ── No data ──
  if (!effectiveData) {
    return (
      <div className="flex items-center gap-3 py-3 px-2 group">
        <StockLogo ticker={entry.symbol} name={entry.name ?? entry.symbol} size="sm" exchange={entry.exchange} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <p className="text-sm font-semibold">{entry.symbol}</p>
            <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">{entry.exchange}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.name ?? '—'}</p>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">No data</span>
        <button
          onClick={onRemove}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Remove ${entry.symbol}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const { stock } = effectiveData;
  const isUp = stock.changePercent >= 0;

  // ── Data row ──
  return (
    <div className="flex items-center gap-2 py-2.5 px-2 hover:bg-muted/30 rounded-lg group transition-colors">

      {/* Logo */}
      <StockLogo
        ticker={entry.symbol}
        name={stock.name}
        size="sm"
        exchange={entry.exchange}
        logoUrl={stock.logoUrl}
      />

      {/* Symbol + Name */}
      <div className="w-36 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 leading-none">
          <p className="text-sm font-semibold">{entry.symbol}</p>
          <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">{entry.exchange}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{stock.name}</p>
      </div>

      {/* Sparklines: 7D / 30D / 60D / 90D / 120D / 1Y */}
      <WatchlistSparklines
        symbol={entry.symbol}
        exchange={entry.exchange}
        open={sparklinesOpen}
        expanded={sparklinesExpanded}
      />

      {/* Price */}
      <div className="flex-1 text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatCurrency(stock.price, stock.currency)}
        </p>
      </div>

      {/* Change % */}
      <div className={cn(
        'w-20 text-right text-sm font-medium tabular-nums shrink-0 hidden sm:flex items-center justify-end gap-0.5',
        isUp ? 'text-green-500' : 'text-red-500',
      )}>
        {isUp
          ? <ArrowUpIcon className="h-3 w-3" />
          : <ArrowDownIcon className="h-3 w-3" />
        }
        {Math.abs(stock.changePercent).toFixed(2)}%
      </div>

      {/* Change $ */}
      <div className={cn(
        'w-20 text-right text-xs tabular-nums shrink-0 hidden md:block',
        isUp ? 'text-green-500' : 'text-red-500',
      )}>
        {isUp ? '+' : ''}{formatCurrency(stock.change, stock.currency)}
      </div>

      {/* Market Cap */}
      <div className="w-20 text-right text-xs text-muted-foreground tabular-nums shrink-0 hidden lg:block">
        {stock.marketCap > 0 ? formatNumber(stock.marketCap, stock.currency) : '—'}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">

        {/* Move to another list */}
        {otherLists.length > 0 && (
          <div ref={moveRef} className="relative">
            <button
              onClick={() => setMoveOpen(v => !v)}
              className="h-7 px-1.5 flex items-center gap-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Move to another watchlist"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {moveOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border bg-popover shadow-lg overflow-hidden">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Move to
                </p>
                {otherLists.map(l => (
                  <button
                    key={l.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 truncate transition-colors"
                    onClick={() => { onMove(l.id); setMoveOpen(false); }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigate to stock detail */}
        <Link
          to={stocksHref}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={`View ${entry.symbol} detail`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Remove ${entry.symbol}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Watchlist name — inline editable ─────────────────────────────────────────

function EditableName({ value, onSave, className }: {
  value: string;
  onSave: (name: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
          className="text-lg font-bold bg-transparent border-b border-primary outline-none w-full max-w-[220px]"
        />
        <button onClick={commit} className="text-primary hover:text-primary/80">
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn('flex items-center gap-1.5 group text-left', className)}
      aria-label="Rename watchlist"
    >
      <span className="text-lg font-bold">{value}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const Watchlists = () => {
  const {
    lists, activeId, activeList,
    createList, renameList, deleteList,
    setActive, addEntry, removeEntry, moveEntry,
  } = useWatchlists();

  const [creating, setCreating]             = useState(false);
  const [newName, setNewName]               = useState('');
  const [panelOpen, setPanelOpen]           = useState(true);
  const [sparklinesOpen, setSparklinesOpen] = useState(true);
  const [sparklinesExpanded, setSparklinesExpanded] = useState(false);
  const newInputRef                         = useRef<HTMLInputElement>(null);

  const watchlistSymbols = useMemo(
    () => activeList?.entries.map(e => e.symbol) ?? [],
    [activeList],
  );

  // ── Supabase bulk fallback ─────────────────────────────────────────────────
  // One query for all active watchlist symbols — used as fallback when the
  // per-row useEodhdStock calls fail (EODHD quota exhausted, Yahoo crumb stale,
  // API key missing, etc.). Nightly data is far better than "No data".
  const { data: dbStocks = [] } = useStocks(
    watchlistSymbols.length > 0 ? watchlistSymbols : undefined,
  );
  const dbStockMap = useMemo<Record<string, Stock>>(() => {
    const m: Record<string, Stock> = {};
    for (const s of dbStocks) m[s.symbol.toUpperCase()] = s;
    return m;
  }, [dbStocks]);

  const { data: finnhubNews = [] } = useNews(watchlistSymbols.length > 0 ? watchlistSymbols : undefined);
  const { data: dbNews = [] }      = useDefeatBetaNews(watchlistSymbols);

  const news = useMemo(() => {
    const seen = new Set<string>();
    const combined: NewsItem[] = [];
    for (const item of [...finnhubNews, ...dbNews]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      combined.push(item);
    }
    combined.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return combined;
  }, [finnhubNews, dbNews]);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  function handleCreateConfirm() {
    const name = newName.trim();
    if (name) createList(name);
    setCreating(false);
    setNewName('');
  }

  function handleAddStock(symbol: string, exchange: string, name: string) {
    if (!activeList) return;
    addEntry(activeList.id, { symbol: symbol.toUpperCase(), exchange, name });
  }

  return (
    <PageLayout title="Watchlists" description="Track and monitor your favourite stocks across multiple named watchlists.">
      <Card className="flex overflow-hidden min-h-[500px]">

        {/* ── Left panel: watchlist list ── */}
        <div className={cn(
          'shrink-0 border-r flex flex-col transition-all duration-200 overflow-hidden',
          panelOpen ? 'w-52' : 'w-0 border-r-0',
        )}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Watchlists</span>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Create new watchlist"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* New list input */}
          {creating && (
            <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
              <Input
                ref={newInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateConfirm();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder="List name…"
                className="h-7 text-xs"
              />
              <button onClick={handleCreateConfirm} className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/90 shrink-0">
                Add
              </button>
              <button onClick={() => { setCreating(false); setNewName(''); }} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* List items — scrollable */}
          <nav className="flex-1 overflow-y-auto py-1">
            {lists.map(list => {
              const isActive = list.id === activeId;
              return (
                <div
                  key={list.id}
                  className={cn(
                    'flex items-center gap-2 mx-2 px-2 py-2 rounded-md cursor-pointer group transition-colors',
                    isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActive(list.id)}
                  role="button"
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Star className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'fill-primary text-primary' : 'fill-none')} />
                  <span className={cn('flex-1 text-sm font-medium truncate', isActive ? 'text-foreground' : '')}>
                    {list.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {list.entries.length}
                  </Badge>
                  {lists.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      aria-label={`Delete ${list.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer summary */}
          <div className="px-4 py-2.5 border-t shrink-0">
            <p className="text-[10px] text-muted-foreground">
              {lists.reduce((n, l) => n + l.entries.length, 0)} stocks · {lists.length} list{lists.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Right panel: active list content ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Active list header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 h-auto sm:h-14 py-3 sm:py-0 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Panel toggle */}
              <button
                onClick={() => setPanelOpen(v => !v)}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label={panelOpen ? 'Collapse watchlist panel' : 'Expand watchlist panel'}
              >
                {panelOpen
                  ? <ChevronLeft className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </button>

              {activeList ? (
                <>
                  <EditableName
                    value={activeList.name}
                    onSave={name => renameList(activeList.id, name)}
                  />
                  <Badge variant="outline" className="text-xs shrink-0">
                    {activeList.entries.length} stock{activeList.entries.length !== 1 ? 's' : ''}
                  </Badge>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No watchlist selected</span>
              )}
            </div>
            {activeList && (
              <StockSearch
                onSelect={(symbol, exchange, name) => handleAddStock(symbol, exchange, name)}
                placeholder="Add stock to watchlist…"
                className="w-full max-w-xs"
              />
            )}
          </div>

          {/* Active list body */}
          {!activeList ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
              <Star className="h-10 w-10 opacity-20" />
              <p className="text-sm">Select a watchlist on the left</p>
            </div>
          ) : activeList.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
              <Search className="h-9 w-9 opacity-20" />
              <p className="text-sm font-medium">This watchlist is empty</p>
              <p className="text-xs">Search for a stock above to add it here</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <div className="w-8 shrink-0" />
                <div className="w-36 shrink-0">Symbol</div>

                {/* Sparkline controls + period labels — always visible at xl+ */}
                <div className="hidden xl:flex items-center gap-1 shrink-0">
                  {/* Expand / minimise */}
                  <button
                    onClick={() => setSparklinesExpanded(v => !v)}
                    disabled={!sparklinesOpen}
                    className={cn(
                      'h-5 w-5 flex items-center justify-center rounded transition-colors',
                      sparklinesOpen
                        ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        : 'text-muted-foreground/30 cursor-not-allowed',
                    )}
                    title={sparklinesExpanded ? 'Minimise sparklines' : 'Expand sparklines'}
                  >
                    {sparklinesExpanded
                      ? <Minimize2 className="h-3 w-3" />
                      : <Maximize2 className="h-3 w-3" />}
                  </button>
                  {/* Show / hide */}
                  <button
                    onClick={() => { setSparklinesOpen(v => !v); if (sparklinesOpen) setSparklinesExpanded(false); }}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={sparklinesOpen ? 'Hide sparklines' : 'Show sparklines'}
                  >
                    {sparklinesOpen
                      ? <EyeOff className="h-3 w-3" />
                      : <Eye    className="h-3 w-3" />}
                  </button>
                  {/* Period labels — only when sparklines are visible */}
                  {sparklinesOpen && (
                    <div className="flex items-center gap-2 ml-1">
                      {SPARKLINE_PERIODS.map(({ label }) => (
                        <div
                          key={label}
                          className={cn('text-center transition-all duration-200', sparklinesExpanded ? 'w-16' : 'w-11')}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 text-right">Price</div>
                <div className="w-20 text-right shrink-0 hidden sm:block">Chg %</div>
                <div className="w-20 text-right shrink-0 hidden md:block">Chg $</div>
                <div className="w-20 text-right shrink-0 hidden lg:block">Mkt Cap</div>
                <div className="w-20 shrink-0" />
              </div>

              {/* Stock rows */}
              <div className="px-3 py-1 divide-y divide-border/40 overflow-y-auto">
                {activeList.entries.map(entry => (
                  <WatchlistStockRow
                    key={`${entry.symbol}-${entry.exchange}`}
                    entry={entry}
                    listId={activeList.id}
                    allLists={lists}
                    onRemove={() => removeEntry(activeList.id, entry.symbol, entry.exchange)}
                    onMove={toId => moveEntry(activeList.id, toId, entry.symbol, entry.exchange)}
                    sparklinesOpen={sparklinesOpen}
                    sparklinesExpanded={sparklinesExpanded}
                    fallbackStock={dbStockMap[entry.symbol.toUpperCase()]}
                  />
                ))}
              </div>
            </>
          )}
        </div>

      </Card>

      {/* News for active watchlist */}
      {watchlistSymbols.length > 0 && (
        <div className="mt-6">
          <NewsCard news={news} watchlistSymbols={watchlistSymbols} />
        </div>
      )}
    </PageLayout>
  );
};

export default Watchlists;
