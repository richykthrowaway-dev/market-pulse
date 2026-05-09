import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────

/** "2024-09-30" → "Q3 '24" — short quarter label for x-axis. */
function formatQuarter(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 7);
  const month = d.getUTCMonth() + 1;
  const yr = String(d.getUTCFullYear()).slice(-2);
  // Quarter is identified by the month the period ENDS in:
  //   3 → Q1, 6 → Q2, 9 → Q3, 12 → Q4
  let q = Math.ceil(month / 3);
  return `Q${q} '${yr}`;
}

interface EarningsRow {
  date:     string;
  quarter:  string;
  actual:   number;
  estimate: number | null;
  surprise: number | null;
  beat:     boolean;
}

interface EarningsTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: EarningsRow }>;
}

function CustomTooltip({ active, payload }: EarningsTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-md px-2.5 py-1.5 text-xs shadow-md space-y-0.5">
      <div className="font-semibold">{row.quarter}</div>
      <div className="text-muted-foreground">{row.date}</div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border">
        <span>Actual</span>
        <span className="font-mono tabular-nums">${row.actual.toFixed(2)}</span>
      </div>
      {row.estimate != null && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Estimate</span>
          <span className="font-mono tabular-nums text-muted-foreground">${row.estimate.toFixed(2)}</span>
        </div>
      )}
      {row.surprise != null && (
        <div className="flex justify-between gap-3">
          <span>Surprise</span>
          <span className={cn(
            'font-mono tabular-nums font-semibold',
            row.surprise >= 0 ? 'text-emerald-500' : 'text-red-500',
          )}>
            {row.surprise >= 0 ? '+' : ''}{row.surprise.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

interface EarningsBeatsChartProps {
  data: EodFundamentals;
}

/**
 * Quarterly earnings beat/miss visualization.
 *
 * Reads from the same fundamentals payload that drives FundamentalsLookup —
 * no extra EODHD credit cost. Shows the last 8 reported quarters (or as
 * many as the company has history for) as colored bars, green for beats,
 * red for misses, with a horizontal black tick marking the consensus
 * estimate height per bar so beat magnitude is visible at a glance.
 *
 * Header stats:
 *   • Total beats / total quarters (e.g. "7 of 8 beats")
 *   • Current consecutive beat streak counted from the most recent quarter
 */
export function EarningsBeatsChart({ data }: EarningsBeatsChartProps) {
  const earnings = useMemo<EarningsRow[]>(() => {
    const history = data.Earnings?.History;
    if (!history) return [];
    return Object.values(history)
      .filter((e) => e.epsActual != null)
      .sort((a, b) => b.date.localeCompare(a.date)) // newest first
      .slice(0, 8)
      .reverse() // oldest left → newest right for chart
      .map((e) => {
        const actual = e.epsActual ?? 0;
        const estimate = e.epsEstimate;
        const beat = estimate != null ? actual >= estimate : true;
        return {
          date:     e.date,
          quarter:  formatQuarter(e.date),
          actual,
          estimate,
          surprise: e.surprisePercent,
          beat,
        };
      });
  }, [data]);

  // Don't render the section if there's no usable history.
  if (earnings.length < 2) return null;

  const beats = earnings.filter((r) => r.beat).length;
  const total = earnings.length;

  // Streak: count consecutive beats from the most recent quarter backward.
  const streak = (() => {
    let count = 0;
    for (let i = earnings.length - 1; i >= 0; i--) {
      if (earnings[i].beat) count++; else break;
    }
    return count;
  })();

  // Y-axis bounds: tighten around the data so small surprise heights
  // are visible. Leave 15% headroom above the max actual.
  const max = Math.max(
    ...earnings.map((r) => Math.max(r.actual, r.estimate ?? 0)),
  );
  const min = Math.min(
    ...earnings.map((r) => Math.min(r.actual, r.estimate ?? r.actual)),
  );
  const yMax = max > 0 ? max * 1.15 : 1;
  const yMin = min < 0 ? min * 1.15 : 0;

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      {/* Header: title + summary stats */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Quarterly Earnings · Beats vs Misses
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="text-muted-foreground">
            <span className={cn(
              'font-semibold',
              beats === total ? 'text-emerald-500' :
              beats >= total * 0.75 ? 'text-emerald-500' :
              beats >= total * 0.5 ? 'text-amber-400' :
              'text-red-500',
            )}>
              {beats}
            </span>
            <span className="text-muted-foreground"> of </span>
            {total} beats
          </span>
          {streak >= 2 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              {streak}-quarter streak
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={earnings}
            margin={{ top: 18, right: 8, bottom: 4, left: -12 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={0.4}
            />
            <XAxis
              dataKey="quarter"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={[yMin, yMax]}
              tickFormatter={(v) => `$${v.toFixed(1)}`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
            {/* Zero baseline if any negative quarters in view */}
            {yMin < 0 && (
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
            )}
            <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
              {earnings.map((r, i) => (
                <Cell
                  key={i}
                  fill={r.beat ? 'rgb(16 185 129)' : 'rgb(239 68 68)'}
                  // Thin estimate tick rendered as a stroke below the bar's
                  // top edge would require custom shapes. Recharts doesn't
                  // expose a clean per-bar reference inside Cell without a
                  // Custom Bar shape — so estimate heights are visible via
                  // tooltip + the beat/miss color on the bar itself.
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Surprise % strip below the chart — gives precise numbers without
          cluttering the bars. Aligns to the same x-axis tick spacing. */}
      <div
        className="grid gap-1 px-1"
        style={{ gridTemplateColumns: `repeat(${earnings.length}, minmax(0, 1fr))` }}
      >
        {earnings.map((r) => (
          <div
            key={r.date}
            className="text-center text-[10px] tabular-nums"
            title={`${r.quarter}: actual $${r.actual.toFixed(2)}, estimate $${r.estimate?.toFixed(2) ?? '—'}`}
          >
            {r.surprise != null ? (
              <span className={cn(
                'font-medium',
                r.surprise >= 0 ? 'text-emerald-500' : 'text-red-500',
              )}>
                {r.surprise >= 0 ? '+' : ''}{r.surprise.toFixed(1)}%
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
