import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Filter constants ─────────────────────────────────────────────────────────

interface MarketCapBucket {
  label: string;
  min?: number;
  max?: number;
}

const MARKET_CAP_BUCKETS: Record<string, MarketCapBucket> = {
  mega:  { label: 'Mega ($200B+)',     min: 2e11 },
  large: { label: 'Large ($10–200B)',  min: 1e10, max: 2e11 },
  mid:   { label: 'Mid ($2–10B)',      min: 2e9,  max: 1e10 },
  small: { label: 'Small ($300M–2B)',  min: 3e8,  max: 2e9 },
  micro: { label: 'Micro (<$300M)',    max: 3e8 },
};

// ── Filter state ─────────────────────────────────────────────────────────────

export interface TopMoverFilters {
  sector?: string;
  country?: string;
  marketCap?: keyof typeof MARKET_CAP_BUCKETS;
}

// ── Data fetching ────────────────────────────────────────────────────────────

interface TopMoverRow {
  symbol: string;
  name: string;
  change_percent: number;
}

async function fetchTopMover(
  direction: 'gainer' | 'loser',
  filters: TopMoverFilters,
): Promise<TopMoverRow | null> {
  // If sector/country filters are active, first get the matching tickers from `symbols`,
  // then narrow the `stocks` query to that set. Otherwise hit `stocks` directly.
  let tickerWhitelist: string[] | null = null;

  if (filters.sector || filters.country) {
    let symQuery = supabase
      .from('symbols')
      .select('canonical_ticker')
      .limit(2000); // hard cap so we don't blow PostgREST's row limit

    if (filters.sector)  symQuery = symQuery.eq('gics_sector', filters.sector);
    if (filters.country) symQuery = symQuery.eq('country', filters.country);

    const { data: symRows, error: symErr } = await symQuery;
    if (symErr) throw new Error(symErr.message);
    tickerWhitelist = (symRows ?? []).map((r) => r.canonical_ticker).filter(Boolean);
    if (tickerWhitelist.length === 0) return null;
  }

  let q = supabase
    .from('stocks')
    .select('symbol, name, change_percent, market_cap')
    .not('change_percent', 'is', null)
    .neq('change_percent', 0)
    .order('change_percent', { ascending: direction === 'loser' })
    .limit(1);

  if (tickerWhitelist) q = q.in('symbol', tickerWhitelist);

  // Market cap bucket — these only filter when the DB has real market caps populated.
  // (Currently many rows are 0; the bucket selector is wired up so it works once data lands.)
  if (filters.marketCap) {
    const bucket = MARKET_CAP_BUCKETS[filters.marketCap];
    if (bucket.min != null) q = q.gte('market_cap', bucket.min);
    if (bucket.max != null) q = q.lt('market_cap', bucket.max);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data?.[0] as TopMoverRow) ?? null;
}

// ── Filter option lists ──────────────────────────────────────────────────────
//
// We only surface filter options that are *guaranteed to return a result*.
// In our DB only ~422 of 47K stocks have non-zero change_percent and only a
// fraction of those have sector/country tagging, so a naïve dropdown built
// from "all symbols" produces options that look populated but match nothing.
//
// The two-step query: (1) get tickers with real change data, (2) look up
// their sector/country tags. Each option's count = stocks that will actually
// match that filter.
//
// Market cap bucket is special: the DB column is currently all zeros, so
// every market-cap filter returns empty. We detect this and disable that
// dropdown entirely until the column gets populated by the ingest pipeline.

interface FilterOption { name: string; count: number; }

interface FilterOptions {
  sectors: FilterOption[];
  countries: FilterOption[];
  /** True if any stock in the DB has market_cap > 0. If false, market-cap filter is disabled. */
  marketCapAvailable: boolean;
}

async function fetchFilterOptions(): Promise<FilterOptions> {
  // 1. Tickers that have real change data — these are the only stocks the cards can ever surface
  const { data: liveStocks, error: e1 } = await supabase
    .from('stocks')
    .select('symbol, market_cap')
    .not('change_percent', 'is', null)
    .neq('change_percent', 0)
    .limit(1000);

  if (e1 || !liveStocks || liveStocks.length === 0) {
    return { sectors: [], countries: [], marketCapAvailable: false };
  }

  const liveTickers = liveStocks.map((r) => r.symbol);
  const marketCapAvailable = liveStocks.some((r) => Number(r.market_cap) > 0);

  // 2. Sector/country tags for ONLY those tickers — chunk to stay under PostgREST's URL limit
  const sectorCounts  = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  const CHUNK = 200;
  for (let i = 0; i < liveTickers.length; i += CHUNK) {
    const slice = liveTickers.slice(i, i + CHUNK);
    const { data: meta } = await supabase
      .from('symbols')
      .select('gics_sector, country')
      .in('canonical_ticker', slice);
    for (const row of meta ?? []) {
      const s = row.gics_sector;
      if (s && s !== 'N/A' && typeof s === 'string') {
        sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1);
      }
      if (row.country && typeof row.country === 'string') {
        countryCounts.set(row.country, (countryCounts.get(row.country) ?? 0) + 1);
      }
    }
  }

  const toSorted = (m: Map<string, number>): FilterOption[] =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

  return {
    sectors: toSorted(sectorCounts),
    countries: toSorted(countryCounts),
    marketCapAvailable,
  };
}

// ── Filter popover ───────────────────────────────────────────────────────────

const PLACEHOLDER_ALL = '__all__';

function FilterPopover({
  filters,
  onChange,
  sectors,
  countries,
  marketCapAvailable,
}: {
  filters: TopMoverFilters;
  onChange: (next: TopMoverFilters) => void;
  sectors: FilterOption[];
  countries: FilterOption[];
  marketCapAvailable: boolean;
}) {
  const update = <K extends keyof TopMoverFilters>(key: K, raw: string) => {
    const value = raw === PLACEHOLDER_ALL ? undefined : (raw as TopMoverFilters[K]);
    onChange({ ...filters, [key]: value });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </div>

        {/* Sector */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sector</label>
          <Select value={filters.sector ?? PLACEHOLDER_ALL} onValueChange={(v) => update('sector', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All sectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLACEHOLDER_ALL}>All sectors</SelectItem>
              {sectors.length === 0 ? (
                <SelectItem value="__loading__" disabled>Loading…</SelectItem>
              ) : (
                sectors.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name} <span className="text-muted-foreground">({s.count})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Country */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Country</label>
          <Select value={filters.country ?? PLACEHOLDER_ALL} onValueChange={(v) => update('country', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLACEHOLDER_ALL}>All countries</SelectItem>
              {countries.length === 0 ? (
                <SelectItem value="__loading__" disabled>Loading…</SelectItem>
              ) : (
                countries.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} <span className="text-muted-foreground">({c.count})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Market cap — only enabled when the DB has populated values */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Market Cap
            {!marketCapAvailable && (
              <span className="ml-1 italic">(no data yet)</span>
            )}
          </label>
          <Select
            value={filters.marketCap ?? PLACEHOLDER_ALL}
            onValueChange={(v) => update('marketCap', v)}
            disabled={!marketCapAvailable}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Any size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLACEHOLDER_ALL}>Any size</SelectItem>
              {Object.entries(MARKET_CAP_BUCKETS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(filters.sector || filters.country || filters.marketCap) && (
          <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => onChange({})}>
            Clear all
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Active filter chips ──────────────────────────────────────────────────────

function FilterChips({
  filters,
  onChange,
}: {
  filters: TopMoverFilters;
  onChange: (next: TopMoverFilters) => void;
}) {
  const chips: { key: keyof TopMoverFilters; label: string }[] = [];
  if (filters.sector)    chips.push({ key: 'sector',    label: filters.sector });
  if (filters.country)   chips.push({ key: 'country',   label: filters.country });
  if (filters.marketCap) chips.push({ key: 'marketCap', label: MARKET_CAP_BUCKETS[filters.marketCap].label });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="h-5 px-1.5 text-[10px] gap-0.5 cursor-pointer hover:bg-muted"
          onClick={() => onChange({ ...filters, [chip.key]: undefined })}
        >
          {chip.label}
          <X className="h-2.5 w-2.5" />
        </Badge>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface TopMoverCardProps {
  direction: 'gainer' | 'loser';
  className?: string;
}

export function TopMoverCard({ direction, className }: TopMoverCardProps) {
  const [filters, setFilters] = useState<TopMoverFilters>({});

  const { data: filterOptions } = useQuery({
    queryKey: ['symbols', 'filter-options'],
    queryFn: fetchFilterOptions,
    staleTime: 24 * 60 * 60_000,
  });
  const sectors            = filterOptions?.sectors   ?? [];
  const countries          = filterOptions?.countries ?? [];
  const marketCapAvailable = filterOptions?.marketCapAvailable ?? false;

  const { data: mover, isLoading } = useQuery({
    queryKey: ['top-mover', direction, filters],
    queryFn: () => fetchTopMover(direction, filters),
    staleTime: 60_000, // 1 min — these change minute-to-minute during market hours
  });

  const hasActiveFilters = !!(filters.sector || filters.country || filters.marketCap);
  const noResults = !isLoading && !mover && hasActiveFilters;

  const title = direction === 'gainer' ? 'Top Gainer' : 'Top Loser';
  const Icon  = direction === 'gainer' ? ArrowUpIcon : ArrowDownIcon;

  const trendColor =
    mover?.change_percent != null && mover.change_percent > 0
      ? 'text-success'
      : mover?.change_percent != null && mover.change_percent < 0
      ? 'text-danger'
      : 'text-muted-foreground';

  return (
    <Card className={cn('transition-all duration-300 hover:shadow-md overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <FilterChips filters={filters} onChange={setFilters} />
        </div>
        <div className="flex items-center gap-1">
          <FilterPopover
            filters={filters}
            onChange={setFilters}
            sectors={sectors}
            countries={countries}
            marketCapAvailable={marketCapAvailable}
          />
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight truncate" style={{ lineHeight: '1.5' }}>
          {isLoading ? '…' : mover?.symbol ?? '—'}
        </div>
        <div className="flex items-center text-xs mt-1">
          {mover?.change_percent != null && (
            <span className={cn('inline-flex items-center mr-1', trendColor)}>
              {mover.change_percent > 0 ? (
                <ArrowUpIcon className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 mr-1" />
              )}
              {mover.change_percent > 0 ? '+' : ''}
              {mover.change_percent.toFixed(2)}%
            </span>
          )}
          {mover?.name && (
            <span className="text-muted-foreground ml-1 truncate">{mover.name}</span>
          )}
          {noResults && (
            <span className="text-muted-foreground italic">
              No stocks match these filters
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
