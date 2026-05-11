import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { useEodhdMacro } from '@/hooks/useEodhdMacro';
import { cn } from '@/lib/utils';

/**
 * MacroTrendChart — multi-line historical chart of 4 macro indicators.
 *
 * Layout:
 *   - Header: title + time-range pills (5Y / 10Y / 20Y / All)
 *   - Indicator chips row: 4 toggleable filters with colored dots
 *   - Recharts LineChart spanning full width, height ~260px
 *
 * Data source: `useEodhdMacro` — now exposes full history per indicator.
 * Zero extra EODHD credits vs the existing MacroSnapshot.
 */

type IndicatorKey = 'gdpGrowth' | 'inflation' | 'unemployment' | 'interestRate';
type Range        = '5Y' | '10Y' | '20Y' | 'ALL';

const INDICATORS: Record<IndicatorKey, { label: string; color: string; suffix: string }> = {
  gdpGrowth:    { label: 'GDP growth',    color: '#10b981', suffix: '%' }, // emerald
  inflation:    { label: 'Inflation',     color: '#ef4444', suffix: '%' }, // red
  unemployment: { label: 'Unemployment',  color: '#f59e0b', suffix: '%' }, // amber
  interestRate: { label: 'Real rate',     color: '#60a5fa', suffix: '%' }, // blue
};

const RANGE_YEARS: Record<Range, number | null> = {
  '5Y':  5,
  '10Y': 10,
  '20Y': 20,
  ALL:   null,
};

interface Row {
  year: number;
  gdpGrowth?:    number;
  inflation?:    number;
  unemployment?: number;
  interestRate?: number;
}

export function MacroTrendChart({ iso2 }: { iso2: string }) {
  const { data, isLoading } = useEodhdMacro(iso2);
  const [range,   setRange]   = useState<Range>('10Y');
  const [visible, setVisible] = useState<Set<IndicatorKey>>(
    new Set(['gdpGrowth', 'inflation', 'unemployment', 'interestRate']),
  );

  // Build a year-keyed union of the 4 series.  EODHD returns one record per
  // year per indicator; we merge by `Date.slice(0,4)` into a flat row array.
  const rows = useMemo<Row[]>(() => {
    if (!data?.history) return [];
    const byYear = new Map<number, Row>();
    const merge = (key: IndicatorKey, series: typeof data.history.gdpGrowth) => {
      for (const pt of series) {
        const y = parseInt(pt.Date.slice(0, 4), 10);
        if (!isFinite(y)) continue;
        const existing = byYear.get(y) ?? { year: y };
        existing[key] = pt.Value;
        byYear.set(y, existing);
      }
    };
    merge('gdpGrowth',    data.history.gdpGrowth);
    merge('inflation',    data.history.inflation);
    merge('unemployment', data.history.unemployment);
    merge('interestRate', data.history.interestRate);
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [data]);

  // Slice to selected range using the latest year in the dataset as anchor.
  const ranged = useMemo<Row[]>(() => {
    if (rows.length === 0) return [];
    const years = RANGE_YEARS[range];
    if (years === null) return rows;
    const cutoff = rows[rows.length - 1].year - (years - 1);
    return rows.filter(r => r.year >= cutoff);
  }, [rows, range]);

  const toggleIndicator = (k: IndicatorKey) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground h-72">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading macro history…
      </div>
    );
  }

  if (ranged.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-xs italic text-muted-foreground/70">
        No macro history available for this country.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          Macro Trend
        </h3>
        <div className="inline-flex rounded-md border border-border p-0.5 text-[10px] font-medium">
          {(Object.keys(RANGE_YEARS) as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2 py-0.5 rounded transition-colors',
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator toggle chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.keys(INDICATORS) as IndicatorKey[]).map(k => {
          const meta   = INDICATORS[k];
          const active = visible.has(k);
          const latest = data?.history[k][data.history[k].length - 1]?.Value;
          return (
            <button
              key={k}
              onClick={() => toggleIndicator(k)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] transition-all',
                active
                  ? 'border-border bg-card'
                  : 'border-border/40 bg-transparent text-muted-foreground/50 opacity-60',
              )}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: active ? meta.color : 'currentColor' }}
              />
              <span className="font-medium">{meta.label}</span>
              {latest != null && (
                <span className="tabular-nums font-semibold ml-0.5" style={{ color: active ? meta.color : undefined }}>
                  {latest > 0 ? '+' : ''}{latest.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ranged} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              minTickGap={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border:          '1px solid hsl(var(--border))',
                borderRadius:    '6px',
                fontSize:        '11px',
                padding:         '6px 8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: '2px' }}
              formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
            />
            {(Object.keys(INDICATORS) as IndicatorKey[]).map(k => (
              visible.has(k) && (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={INDICATORS[k].label}
                  stroke={INDICATORS[k].color}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                  connectNulls
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        Annual data · EODHD macro-indicator (World Bank source) · click an indicator to hide.
      </p>
    </div>
  );
}
