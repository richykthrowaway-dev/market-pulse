/**
 * AllocationExplorer — tabbed grouping of portfolio holdings by
 * Position | Sector | Sub-Industry | Country | Market Cap | Investment Style.
 *
 * To add a new grouping key later, add an entry to GROUPING_KEYS and
 * implement the classifier in `classifyHolding`.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import {
  getCategoryColor,
  normalizeSector,
  sectorForSubIndustry,
  sectorForIndustryGroup,
  industryGroupForIndustry,
} from '@/lib/gicsColors';
import { SectorBadge } from '@/components/ui/SectorBadge';
import { StockLogo } from '@/components/stocks/StockLogo';

/* ─── Types ─── */

export interface AllocationHolding {
  ticker: string;
  name: string;
  marketValue: number;
  unrealizedPL: number;
  currency: string;
  exchange?: string;
}

export interface SymbolMeta {
  sector: string;
  country: string;
  /** GICS Sub-Industry (163 classifications, most granular level) */
  subIndustry: string;
  /** GICS Industry (74 classifications, level 3) */
  gicsIndustry?: string;
  /** GICS Industry Group (25 classifications, level 2) */
  gicsIndustryGroup?: string;
  marketCap?: number;
  /**
   * User-defined trade style — set in the Style editor on the holdings table.
   * Persisted in `user_ticker_styles` so it survives portfolio re-imports.
   * 'Unclassified' when the user hasn't set one yet.
   */
  tradeStyle?: 'Day Trade' | 'Swing Trade' | 'Long Term' | 'Unclassified';
  /** Freeform reasoning attached to the trade style. */
  tradeNote?: string;
  /** User-defined take-profit price target, same currency as holding. */
  priceTarget?: number | null;
  /** User-defined stop-loss price, same currency as holding. */
  stopLoss?: number | null;
  /** ISO date string (YYYY-MM-DD) of when the position was entered. */
  entryDate?: string | null;
  isEtf?: boolean;
}

/** Add new grouping keys here — the rest adapts automatically. */
const GROUPING_KEYS = ['Position', 'Sector', 'Sub-Industry', 'Country', 'Market Cap', 'Style'] as const;
export type GroupingKey = (typeof GROUPING_KEYS)[number];

export type SortCol = 'group' | 'weightPct' | 'holdingCount';

/* ─── Classifiers ─── */

const MARKET_CAP_TIERS = [
  { label: 'Mega Cap', min: 200e9 },
  { label: 'Large Cap', min: 10e9 },
  { label: 'Mid Cap', min: 2e9 },
  { label: 'Small Cap', min: 300e6 },
  { label: 'Micro Cap', min: 0 },
] as const;

function classifyMarketCap(mc: number | undefined): string {
  // Never return 'Unknown' — when no market-cap data is available, assume
  // Micro Cap. This is statistically the right prior because the only
  // tickers that escape both the DB cache AND FMP's ~30K-stock universe
  // are obscure micro-caps (Canadian Venture, OTC pinks, freshly listed
  // SPACs, delisted symbols). Defaulting to Micro Cap produces a real,
  // sortable, colorable bucket instead of a black-hole "Unknown" tier
  // that the user can't reason about.
  if (mc == null || mc <= 0) return 'Micro Cap';
  for (const tier of MARKET_CAP_TIERS) {
    if (mc >= tier.min) return tier.label;
  }
  return 'Micro Cap';
}

export function classifyHolding(
  ticker: string,
  meta: SymbolMeta | undefined,
  key: GroupingKey,
): string {
  if (!meta && key !== 'Position') return 'Unknown';
  switch (key) {
    case 'Position':
      return ticker;
    case 'Sector':
      if (meta!.isEtf) return 'ETFs';
      return normalizeSector(meta!.sector || 'Other');
    case 'Sub-Industry':
      if (meta!.isEtf) return 'ETFs';
      // GICS hierarchy fallback chain (most → least granular):
      //   sub-industry (163) → industry (74) → industry group (25) → sector (11)
      // We never want a holding to display the bare sector here — the user is
      // explicitly asking for finer-grained classification. Going industry-first
      // means a software company shows "Application Software" or "Software"
      // rather than collapsing into "Information Technology" with 14 siblings.
      return (
        meta!.subIndustry ||
        meta!.gicsIndustry ||
        meta!.gicsIndustryGroup ||
        normalizeSector(meta!.sector || 'Other')
      );
    case 'Country':
      return meta!.country || 'Unknown';
    case 'Market Cap':
      return classifyMarketCap(meta!.marketCap);
    case 'Style':
      // User-defined trade style; default to 'Unclassified' so holdings without
      // a user annotation still appear in the chart as a real bucket the user
      // can spot and act on (e.g. "23 unclassified holdings — go tag them").
      return meta!.tradeStyle || 'Unclassified';
    default:
      return 'Other';
  }
}

/* ─── Color helper — delegates entirely to centralized registry in gicsColors.ts ─── */

export function groupColor(key: GroupingKey, groupName: string, meta?: SymbolMeta): string {
  switch (key) {
    case 'Position':
      return getCategoryColor('sector', meta?.isEtf ? 'ETFs' : (meta?.sector ?? ''));
    case 'Sector':
      return getCategoryColor('sector', groupName);
    case 'Sub-Industry': {
      // The Sub-Industry tab can display any of four GICS levels depending on
      // what data is available for the holding. Try each walk-up in order so
      // we always anchor to the correct parent-sector color:
      //   1. sub-industry → industry → industry group → sector
      //   2. industry      → industry group → sector
      //   3. industry group → sector
      //   4. raw sector name (last-resort fallback)
      if (groupName === 'ETFs') return getCategoryColor('sector', 'ETFs');
      const fromSubIndustry = sectorForSubIndustry(groupName);
      if (fromSubIndustry) return getCategoryColor('sector', fromSubIndustry);

      const parentGroup = industryGroupForIndustry(groupName);
      if (parentGroup) {
        const sec = sectorForIndustryGroup(parentGroup);
        if (sec) return getCategoryColor('sector', sec);
      }

      const fromGroup = sectorForIndustryGroup(groupName);
      if (fromGroup) return getCategoryColor('sector', fromGroup);

      // Last resort: maybe groupName is itself a sector (unenriched fallback)
      return getCategoryColor('sector', groupName);
    }
    case 'Country':
      return getCategoryColor('country', groupName);
    case 'Market Cap':
      return getCategoryColor('cap', groupName);
    case 'Style':
      return getCategoryColor('style', groupName);
    default:
      return getCategoryColor('sector', '');
  }
}

/* ─── Grouped data ─── */

interface GroupRow {
  group: string;
  weightPct: number;
  holdingCount: number;
  totalValue: number;
  tickers: string[];
  color: string;
  subIndustry?: string;
}

function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', AU: 'Australia', CN: 'China',
  IE: 'Ireland', QA: 'Qatar', GB: 'United Kingdom', JP: 'Japan',
  DE: 'Germany', FR: 'France', HK: 'Hong Kong', KR: 'South Korea',
  IN: 'India', BR: 'Brazil', CH: 'Switzerland', SG: 'Singapore',
  NL: 'Netherlands', UY: 'Uruguay', MX: 'Mexico', TW: 'Taiwan',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', NZ: 'New Zealand',
  ZA: 'South Africa', IL: 'Israel', AR: 'Argentina', CL: 'Chile',
};

/* ─── Props ─── */

export interface AllocationExplorerProps {
  holdings: AllocationHolding[];
  symbolInfo: Record<string, SymbolMeta>;
  totalValue: number;
  holdingCount: number;
  /** Callback when the user clicks a group to filter the external holdings table */
  onGroupFilter?: (key: GroupingKey, group: string | null) => void;
  /** Controlled sort column — when provided, overrides internal sort state */
  controlledSortCol?: SortCol;
  /** Controlled sort direction */
  controlledSortAsc?: boolean;
  /** Callback fired whenever sort changes (click on header) */
  onSortChange?: (col: SortCol, asc: boolean) => void;
  /** Callback fired when the active grouping tab changes */
  onTabChange?: (key: GroupingKey) => void;
}

/* ─── Component ─── */

export function AllocationExplorer({
  holdings, symbolInfo, totalValue, holdingCount, onGroupFilter,
  controlledSortCol, controlledSortAsc, onSortChange, onTabChange,
}: AllocationExplorerProps) {
  const [activeKey, setActiveKey] = useState<GroupingKey>('Position');
  const [internalSortCol, setInternalSortCol] = useState<SortCol>('weightPct');
  const [internalSortAsc, setInternalSortAsc] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Use controlled sort when provided, otherwise internal
  const isControlled = controlledSortCol !== undefined;
  const sortCol = controlledSortCol ?? internalSortCol;
  const sortAsc = controlledSortAsc ?? internalSortAsc;

  const isPositionMode = activeKey === 'Position';

  const rows: GroupRow[] = useMemo(() => {
    if (isPositionMode) {
      return holdings.map((h) => ({
        group: h.ticker,
        weightPct: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
        holdingCount: 1,
        totalValue: h.marketValue,
        tickers: [h.ticker],
        color: groupColor('Position', h.ticker, symbolInfo[h.ticker]),
        subIndustry: symbolInfo[h.ticker]?.subIndustry || symbolInfo[h.ticker]?.sector || '',
      }));
    }
    const map = new Map<string, { value: number; tickers: string[] }>();
    for (const h of holdings) {
      const grp = classifyHolding(h.ticker, symbolInfo[h.ticker], activeKey);
      const entry = map.get(grp) ?? { value: 0, tickers: [] };
      entry.value += h.marketValue;
      entry.tickers.push(h.ticker);
      map.set(grp, entry);
    }
    return Array.from(map.entries()).map(([group, g]) => ({
      group,
      weightPct: totalValue > 0 ? (g.value / totalValue) * 100 : 0,
      holdingCount: g.tickers.length,
      totalValue: g.value,
      tickers: g.tickers,
      color: groupColor(activeKey, group),
    }));
  }, [holdings, symbolInfo, activeKey, totalValue, isPositionMode]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'group') cmp = a.group.localeCompare(b.group);
      else if (sortCol === 'weightPct') cmp = a.weightPct - b.weightPct;
      else cmp = a.holdingCount - b.holdingCount;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortCol, sortAsc]);

  const handleSort = useCallback((col: SortCol) => {
    const newAsc = sortCol === col ? !sortAsc : false;
    if (isControlled) {
      // Controlled mode — always delegate to parent
      onSortChange?.(col, newAsc);
    } else {
      // Uncontrolled mode — update internal state, notify parent if interested
      if (internalSortCol === col) setInternalSortAsc((p) => !p);
      else { setInternalSortCol(col); setInternalSortAsc(false); }
      onSortChange?.(col, newAsc);
    }
  }, [sortCol, sortAsc, isControlled, internalSortCol, onSortChange]);

  const handleGroupClick = useCallback((group: string) => {
    if (isPositionMode) return;
    const next = selectedGroup === group ? null : group;
    setSelectedGroup(next);
    onGroupFilter?.(activeKey, next);
  }, [selectedGroup, activeKey, onGroupFilter, isPositionMode]);

  const handleTabChange = useCallback((key: GroupingKey) => {
    setActiveKey(key);
    setSelectedGroup(null);
    onGroupFilter?.(key, null);
    onTabChange?.(key);
  }, [onGroupFilter, onTabChange]);

  const displayGroupName = useCallback((group: string) => {
    if (activeKey === 'Country') return COUNTRY_NAMES[group] || group;
    return group;
  }, [activeKey]);

  if (holdings.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Summary stats + tab pills */}
      <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-baseline gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Value</p>
            <p className="text-lg font-bold font-mono">{fmtCurrency(totalValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Positions</p>
            <p className="text-lg font-bold font-mono">{holdingCount}</p>
          </div>
        </div>
        <div
          className="flex gap-0.5 flex-wrap"
          role="tablist"
          aria-label="Allocation grouping"
        >
          {GROUPING_KEYS.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeKey === key}
              tabIndex={activeKey === key ? 0 : -1}
              onClick={() => handleTabChange(key)}
              onKeyDown={(e) => {
                const idx = GROUPING_KEYS.indexOf(activeKey);
                if (e.key === 'ArrowRight') handleTabChange(GROUPING_KEYS[(idx + 1) % GROUPING_KEYS.length]);
                if (e.key === 'ArrowLeft') handleTabChange(GROUPING_KEYS[(idx - 1 + GROUPING_KEYS.length) % GROUPING_KEYS.length]);
              }}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                activeKey === key
                  ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                  : 'border-border/50 text-muted-foreground hover:text-foreground'
              )}
            >
              {key === 'Position' ? 'Position %' : key}
            </button>
          ))}
        </div>
      </div>

      {/* Donut chart + breakdown — flex-1 consumes the fixed card height minus the stats row */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2">
        {/* Donut — 60% width on desktop; zero PieChart margin removes Recharts' built-in padding */}
        <div className="h-[340px] md:h-auto md:flex-[3] min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={sorted}
                dataKey="totalValue"
                nameKey="group"
                cx="50%"
                cy="50%"
                innerRadius={90}
                outerRadius={190}
                strokeWidth={1.5}
                stroke="hsl(var(--card))"
                minAngle={2}
                onClick={!isPositionMode ? (_, idx) => handleGroupClick(sorted[idx].group) : undefined}
                style={!isPositionMode ? { cursor: 'pointer' } : undefined}
                activeShape={false}
              >
                {sorted.map((row, i) => (
                  <Cell
                    key={i}
                    fill={row.color}
                    opacity={selectedGroup && selectedGroup !== row.group ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as GroupRow;
                  return (
                    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="font-mono font-semibold">{displayGroupName(d.group)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{fmtCurrency(d.totalValue)}</span>
                        <span className="text-muted-foreground font-mono text-xs">({d.weightPct.toFixed(1)}%)</span>
                      </div>
                      {!isPositionMode && (
                        <p className="text-muted-foreground text-xs">{d.holdingCount} holding{d.holdingCount !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown: legend in Position mode, sortable table otherwise — 40% width on desktop */}
        <div className="md:flex-[2] overflow-x-auto overflow-y-auto min-w-0" role="tabpanel" aria-label={`${activeKey} allocation breakdown`}>
          {isPositionMode ? (
            <div className="space-y-0.5">
              {sorted.map((row) => (
                <div key={row.group} className="flex items-center gap-2 py-0.5">
                  <StockLogo ticker={row.group} exchange={holdings.find(h => h.ticker === row.group)?.exchange} country={symbolInfo[row.group]?.country} size="sm" className="ring-0 bg-transparent" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium">{row.group}</span>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">{row.weightPct.toFixed(1)}%</span>
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                        aria-label={symbolInfo[row.group]?.sector || ''}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">{row.subIndustry || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-[11px]" aria-label={`${activeKey} allocation table`}>
              <thead>
                <tr className="border-b border-border">
                  <SortableTh label="Group" col="group" active={sortCol} asc={sortAsc} onSort={handleSort} align="left" />
                  <SortableTh label="Weight %" col="weightPct" active={sortCol} asc={sortAsc} onSort={handleSort} align="right" />
                  <SortableTh label="Holdings" col="holdingCount" active={sortCol} asc={sortAsc} onSort={handleSort} align="right" />
                  <th className="text-right py-1.5 px-1.5 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.group}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedGroup === row.group}
                    onClick={() => handleGroupClick(row.group)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGroupClick(row.group); } }}
                    className={cn(
                      'border-b border-border/50 cursor-pointer transition-colors',
                      selectedGroup === row.group
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <td className="py-1.5 px-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                        {activeKey === 'Sector' ? (
                          <SectorBadge sector={row.group} size="xs" />
                        ) : (
                          <span className="font-medium truncate max-w-[140px]">{displayGroupName(row.group)}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono">{row.weightPct.toFixed(1)}%</td>
                    <td className="py-1.5 px-1.5 text-right font-mono">{row.holdingCount}</td>
                    <td className="py-1.5 px-1.5 text-right font-mono">{fmtCurrency(row.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Active filter indicator */}
      {selectedGroup && (
        <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
          <span>
            Filtering by <strong className="text-foreground">{displayGroupName(selectedGroup)}</strong>
          </span>
          <button
            onClick={() => { setSelectedGroup(null); onGroupFilter?.(activeKey, null); }}
            className="text-primary hover:underline text-[10px]"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Sortable table header ─── */

function SortableTh({
  label, col, active, asc, onSort, align,
}: {
  label: string; col: SortCol; active: SortCol; asc: boolean;
  onSort: (col: SortCol) => void; align: 'left' | 'right';
}) {
  const isActive = active === col;
  return (
    <th
      className={cn(
        'py-1.5 px-1.5 font-medium text-muted-foreground cursor-pointer select-none transition-colors hover:text-foreground',
        align === 'right' ? 'text-right' : 'text-left',
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
