
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { useStockHistory } from '@/hooks/useStockHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StockLogo } from '@/components/stocks/StockLogo';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { EodBar } from '@/services/eodhdApi';

const timeRanges = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
  { label: 'All', days: 9999 },
];

interface StockChartProps {
  symbol: string;
  name: string;
  currentPrice: number;
  volatility?: number;
  className?: string;
  onRangeChange?: (days: number) => void;
  /** External EODHD bars for non-local stocks */
  externalBars?: EodBar[];
  /** Exchange code for non-US logo resolution */
  exchange?: string;
  /** Explicit logo URL (e.g. from Finnhub profile) */
  logoUrl?: string;
  /** ISO 4217 currency code for axis/tooltip formatting */
  currency?: string;
}

export function StockChart({ 
  symbol, 
  name,
  currentPrice,
  className,
  onRangeChange,
  externalBars,
  exchange,
  logoUrl,
  currency = 'USD',
}: StockChartProps) {
  const [selectedRange, setSelectedRange] = useState(timeRanges[1]); // Default to 1M
  
  const { data: localBars = [], isLoading: localLoading } = useStockHistory(
    externalBars ? '' : symbol, // skip local fetch when external bars provided
    selectedRange.days
  );
  
  const isLoading = externalBars ? false : localLoading;
  
  // Use external bars filtered by selected range, or local bars
  const bars = useMemo(() => {
    if (externalBars) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - selectedRange.days);
      return externalBars.filter(b => new Date(b.date) >= cutoff);
    }
    return localBars;
  }, [externalBars, localBars, selectedRange.days]);

  const chartData = useMemo(() => {
    if (bars.length === 0) return [];
    return bars.map((bar: any) => {
      const date = new Date(bar.ts ?? bar.date);
      const days = selectedRange.days;
      return {
        date: date.toLocaleDateString('en-US', {
          month: days > 90 ? 'short' : 'numeric',
          day: 'numeric',
          year: days > 365 ? '2-digit' : undefined,
        }),
        price: Number(bar.close),
      };
    });
  }, [bars, selectedRange.days]);
  
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) * 0.98 : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) * 1.02 : 100;
  
  const formatYAxis = (value: number) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
    } catch { return `$${value.toFixed(2)}`; }
  };

  // Compute a reasonable tick interval
  const tickInterval = chartData.length > 20 ? Math.floor(chartData.length / 10) : 1;
  
  return (
    <Card className={cn("overflow-hidden h-full", className)}>
      <CardHeader className="flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <StockLogo ticker={symbol} name={name} size="md" exchange={exchange} logoUrl={logoUrl} />
          <div>
            <CardTitle className="leading-none">{symbol}</CardTitle>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <Button 
              key={range.label} 
              variant={selectedRange.label === range.label ? "default" : "outline"} 
              size="sm"
              onClick={() => {
                setSelectedRange(range);
                onRangeChange?.(range.days);
              }}
              className="h-7 px-2 text-xs"
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <div className="h-[300px] w-full px-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="w-full h-full rounded-md" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No price data available for this range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke="hsl(var(--border))" 
                />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  tickMargin={10}
                  interval={tickInterval}
                />
                <YAxis 
                  domain={[minPrice, maxPrice]} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  tickMargin={10}
                  tickFormatter={formatYAxis}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number) => {
                    try {
                      return [new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value), 'Price'];
                    } catch { return [`$${value.toFixed(2)}`, 'Price']; }
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
