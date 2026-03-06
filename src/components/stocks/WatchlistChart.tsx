
import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useStockHistory } from '@/hooks/useStockHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLogo } from '@/components/stocks/StockLogo';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { resolveVariant, getColorSet, computeChangePct } from '@/components/ui/sparkline';

interface WatchlistChartProps {
  symbol: string;
  name: string;
  days?: number;
  className?: string;
}

export function WatchlistChart({ symbol, name, days = 30, className }: WatchlistChartProps) {
  const { data: bars = [], isLoading } = useStockHistory(symbol, days);

  const { chartData, baselinePrice, domainMin, domainMax, closes } = useMemo(() => {
    if (bars.length === 0) return { chartData: [], baselinePrice: 0, domainMin: 0, domainMax: 0, closes: [] as number[] };

    const baseline = Number(bars[0].close);
    const closePrices: number[] = [];
    const data = bars.map((bar: any) => {
      const date = new Date(bar.ts);
      const price = Number(bar.close);
      closePrices.push(price);
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price,
        pctChange: ((price - baseline) / baseline) * 100,
      };
    });

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = range * 0.03;

    return {
      chartData: data,
      baselinePrice: baseline,
      domainMin: min - pad,
      domainMax: max + pad,
      closes: closePrices,
    };
  }, [bars]);

  // Use sparkline system for color resolution
  const resolved = resolveVariant(closes, 'auto');
  const colors = getColorSet(resolved);
  const pctChange = computeChangePct(closes);
  const isPositive = pctChange >= 0;
  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const gradientId = `watchlist-gradient-${symbol}`;

  return (
    <Card className={cn('overflow-hidden card-hover-effect', className)} role="article" aria-label={`${name} price chart`}>
      <CardHeader className="flex-row items-center justify-between pb-2 pt-4 px-4">
        <div className="flex items-center gap-2.5">
          <StockLogo ticker={symbol} name={name} size="sm" />
          <div>
            <CardTitle className="text-sm leading-none">{symbol}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold font-mono-num">${lastPrice.toFixed(2)}</p>
          <p className={cn('text-xs font-medium font-mono-num', isPositive ? 'trend-up' : 'trend-down')}>
            {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2 px-2">
        <div className="h-[160px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full px-4">
              <Skeleton className="w-full h-full rounded-md" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.stroke} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={colors.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  interval={Math.max(1, Math.floor(chartData.length / 5))}
                />
                <YAxis
                  domain={[domainMin, domainMax]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={40}
                />
                <ReferenceLine
                  y={baselinePrice}
                  stroke="hsl(var(--spark-baseline))"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  label={{
                    value: `$${baselinePrice.toFixed(0)}`,
                    position: 'right',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 9,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                  labelFormatter={(label) => label}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={colors.stroke}
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: colors.dot }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
