import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Shares Outstanding Chart — quarterly trend of shares outstanding.
 * Buybacks (downward slope) and dilution (upward slope) jump out
 * visually. Sourced from `data.outstandingShares.quarterly` —
 * 0 extra EODHD credits.
 *
 * Investing context:
 *   • Falling line = buybacks. Each remaining share owns a bigger
 *     slice of the company → mechanical EPS uplift.
 *   • Rising line = dilution. Stock-based comp at a tech company can
 *     dilute 2-4%/yr quietly; capital raises spike it sharply.
 *   • Flat line for years = neither buying back nor diluting.
 */

interface Props { data: EodFundamentals }

function fmtSharesM(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return n.toLocaleString();
}

export function SharesOutstandingChart({ data }: Props) {
  const series = useMemo(() => {
    const q = data.outstandingShares?.quarterly;
    if (!q) return [];
    try {
      return Object.values(q)
        .filter((p) => p && p.shares != null && isFinite(p.shares) && p.dateFormatted)
        .sort((a, b) => (a.dateFormatted ?? '').localeCompare(b.dateFormatted ?? ''))
        .slice(-20) // last 5 years
        .map((p) => ({ date: p.dateFormatted, shares: p.shares }));
    } catch {
      return [];
    }
  }, [data]);

  if (series.length < 2) return null;

  const first = series[0].shares;
  const last  = series[series.length - 1].shares;
  const totalChangePct = ((last - first) / first) * 100;
  const yearsSpan = series.length / 4;          // quarters → years
  const annualizedPct = yearsSpan > 0
    ? (Math.pow(last / first, 1 / yearsSpan) - 1) * 100
    : 0;

  const Trend = totalChangePct > 0.5  ? TrendingUp
              : totalChangePct < -0.5 ? TrendingDown
                                       : Minus;
  const trendColor = totalChangePct >  0.5 ? 'text-red-400'
                   : totalChangePct < -0.5 ? 'text-emerald-400'
                                            : 'text-muted-foreground';
  const verdict =
    annualizedPct > 1  ? 'Diluting'      :
    annualizedPct < -1 ? 'Buying back'   :
                         'Stable';

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Shares Outstanding · {series.length}Q
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] tabular-nums">
          <span className={cn('inline-flex items-center gap-0.5 font-medium', trendColor)}>
            <Trend className="w-3 h-3" />
            {totalChangePct >= 0 ? '+' : ''}{totalChangePct.toFixed(2)}% total
          </span>
          <span className="text-muted-foreground">
            · {annualizedPct >= 0 ? '+' : ''}{annualizedPct.toFixed(2)}%/yr · <span className={trendColor}>{verdict}</span>
          </span>
        </div>
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
            <defs>
              <linearGradient id="sharesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(0, 7) ?? ''} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtSharesM} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 4, fontSize: 11 }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              formatter={(v: number) => [fmtSharesM(v), 'Shares']}
            />
            <Area type="monotone" dataKey="shares" stroke="hsl(var(--primary))" fill="url(#sharesGrad)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
