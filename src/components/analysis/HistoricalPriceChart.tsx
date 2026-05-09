import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { LineChart as LineChartIcon, Loader2 } from 'lucide-react';
import { fetchEodHistorical, type EodBar } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Historical Price Chart — daily OHLCV area chart for the searched
 * ticker, with toggleable range (3M / 6M / 1Y / 5Y / MAX).
 *
 * Cost: 1 EODHD credit per range fetch (NOT cached server-side, but
 * cached 1h client-side via fetchCached). Each range is its own cache
 * key so users can toggle freely. Worst case 5 ranges × 1 = 5 credits
 * per ticker — well under the 10-credit fundamentals call.
 *
 * Why include this on the Analysis page:
 *   • The fundamentals card answers "is this a good company?" — but
 *     the chart answers "what is the market doing with it?"
 *   • Reference lines for 50/200 DMA pulled from the existing
 *     fundamentals payload (free) anchor the visual to the same
 *     trend signals shown in TechnicalSignalsCard.
 *   • Distance from 52w high/low gets immediate visual context that
 *     the 52-week bar in the header can only hint at.
 */

interface Props {
  symbol:     string;
  ma50?:      number | null;
  ma200?:     number | null;
  high52?:    number | null;
  low52?:     number | null;
  currency?:  string;
}

type Range = '3M' | '6M' | '1Y' | '5Y' | 'MAX';
const RANGE_DAYS: Record<Range, number> = {
  '3M': 90, '6M': 180, '1Y': 365, '5Y': 5 * 365, MAX: 0,
};

function fromDate(range: Range): string | undefined {
  if (range === 'MAX') return undefined;
  const d = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function fmtPrice(v: number, currency = 'USD'): string {
  const sym = currency === 'USD' ? '$' : '';
  return `${sym}${v.toFixed(2)}`;
}

function fmtCompact(v: number, currency = 'USD'): string {
  const sym = currency === 'USD' ? '$' : '';
  if (Math.abs(v) >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}k`;
  return `${sym}${v.toFixed(0)}`;
}

export function HistoricalPriceChart({
  symbol, ma50, ma200, high52, low52, currency = 'USD',
}: Props) {
  const [range, setRange] = useState<Range>('1Y');

  const { data, isLoading, isError } = useQuery<EodBar[]>({
    queryKey: ['eod-historical', symbol, range],
    queryFn:  () => fetchEodHistorical(symbol, fromDate(range)),
    enabled:  !!symbol,
    staleTime: 60 * 60_000, // 1h — matches fetchCached layer
    retry: 1,
  });

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    // EODHD returns ascending dates already; just pick the close
    return data.map((b) => ({ date: b.date, close: b.adjusted_close ?? b.close }));
  }, [data]);

  // Compute period change and momentum tint
  const { changePct, isUp } = useMemo(() => {
    if (chartData.length < 2) return { changePct: null, isUp: false };
    const first = chartData[0].close;
    const last  = chartData[chartData.length - 1].close;
    if (!first) return { changePct: null, isUp: false };
    const change = ((last - first) / first) * 100;
    return { changePct: change, isUp: change >= 0 };
  }, [chartData]);

  const stroke = isUp ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)';

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <LineChartIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Price History · {range}
          </span>
          {changePct != null && (
            <span className={cn(
              'text-[11px] font-mono tabular-nums ml-1',
              isUp ? 'text-emerald-400' : 'text-red-400',
            )}>
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Range selector */}
        <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2 py-0.5 transition-colors',
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading {range}…
          </div>
        ) : isError || chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
            No historical data for {symbol} in the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
              <defs>
                <linearGradient id={`hpc-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d) => d?.slice(0, 7) ?? ''}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => fmtCompact(v, currency)}
                width={48}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                formatter={(v: number) => [fmtPrice(v, currency), 'Close']}
              />

              {/* Reference lines from cached fundamentals payload — free */}
              {high52 != null && (
                <ReferenceLine y={high52} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.5}
                  label={{ value: '52w H', fontSize: 9, fill: 'hsl(var(--muted-foreground))', position: 'right' }} />
              )}
              {low52 != null && (
                <ReferenceLine y={low52} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.5}
                  label={{ value: '52w L', fontSize: 9, fill: 'hsl(var(--muted-foreground))', position: 'right' }} />
              )}
              {ma50 != null && range !== '5Y' && range !== 'MAX' && (
                <ReferenceLine y={ma50} stroke="hsl(var(--foreground))" strokeOpacity={0.4} strokeDasharray="4 4"
                  label={{ value: '50DMA', fontSize: 9, fill: 'hsl(var(--foreground))', fillOpacity: 0.6, position: 'right' }} />
              )}
              {ma200 != null && range !== '5Y' && range !== 'MAX' && (
                <ReferenceLine y={ma200} stroke="hsl(var(--foreground))" strokeOpacity={0.25} strokeDasharray="6 4"
                  label={{ value: '200DMA', fontSize: 9, fill: 'hsl(var(--foreground))', fillOpacity: 0.5, position: 'right' }} />
              )}

              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                strokeWidth={1.5}
                fill={`url(#hpc-${symbol}-${range})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Adjusted close · 1 credit per range fetch · cached 1h client-side
      </p>
    </div>
  );
}
