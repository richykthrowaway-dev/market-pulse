import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { useUstYieldCurve } from '@/hooks/useUstYieldCurve';
import { cn } from '@/lib/utils';

/**
 * YieldCurveWidget — US Treasury yield curve snapshot at the top of the
 * Trade Intel view.
 *
 * Why it's here:
 *   The 2Y-10Y spread has preceded every US recession since 1969.  When
 *   inverted (2Y > 10Y), it's a high-signal warning that global trade
 *   demand may contract in the next 6-24 months.  Traders looking at
 *   the Trade tab benefit from seeing this front and centre.
 *
 * Layout:
 *   - Header row: 2Y/10Y spread + inversion flag
 *   - Compact line chart of the full curve (1M → 30Y)
 *   - Footer note: source + date
 */

export function YieldCurveWidget() {
  // Enable only when consumed — this widget is the gate.  The hook itself
  // caches across consumers so reopening Intel view is free.
  const { data, isLoading, isError } = useUstYieldCurve(true);

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading US yield curve…
      </div>
    );
  }

  if (isError || !data || data.points.length < 2) {
    return null; // silent fail — don't push noise to the user
  }

  const { date, points, spread2y10y, spread3m10y, inverted } = data;

  // Friendly spread formatting: "+0.42 pp" / "-0.42 pp"
  const fmtSpread = (s: number | null) =>
    s == null ? '—' : `${s >= 0 ? '+' : ''}${s.toFixed(2)} pp`;

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          US Yield Curve
        </h3>
        {/* Inversion flag — only shown when the 2Y-10Y is actually inverted */}
        {inverted && (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/15 text-red-400">
            <AlertTriangle className="w-2.5 h-2.5" />
            Inverted
          </span>
        )}
      </div>

      {/* Headline spreads */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <SpreadCard label="10Y − 2Y" value={spread2y10y} inverted={inverted} />
        <SpreadCard label="10Y − 3M" value={spread3m10y} inverted={spread3m10y != null && spread3m10y < 0} />
      </div>

      {/* Compact curve chart */}
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `${v}%`}
              domain={['dataMin - 0.2', 'dataMax + 0.2']}
              width={30}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border:          '1px solid hsl(var(--border))',
                borderRadius:    '6px',
                fontSize:        '11px',
                padding:         '4px 6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Yield']}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={inverted ? '#ef4444' : '#10b981'}
              strokeWidth={1.6}
              dot={{ r: 1.5 }}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-[9px] text-muted-foreground/50 leading-snug">
        US Treasury par yields · as of {date} · EODHD
      </p>
    </div>
  );
}

function SpreadCard({
  label, value, inverted,
}: {
  label:    string;
  value:    number | null;
  inverted: boolean;
}) {
  const color =
    value == null    ? 'text-muted-foreground/60' :
    inverted         ? 'text-red-400'             :
    value < 0.5      ? 'text-amber-400'           :
                       'text-emerald-400';
  return (
    <div className="rounded border border-border bg-card/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground/70">{label}</div>
      <div className={cn('text-sm font-bold tabular-nums', color)}>
        {value == null
          ? '—'
          : `${value >= 0 ? '+' : ''}${value.toFixed(2)} pp`}
      </div>
    </div>
  );
}
