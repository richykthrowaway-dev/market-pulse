import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchYahooChart, type YahooBar } from '@/services/yahooFinanceApi';
import { windowChange } from '@/lib/windowChange';

/**
 * SymbolChart — area-chart price panel for the Trading page.
 *
 * Shows the selected symbol's close price over a chosen range (1D/1M/3M/1Y).
 * Colours the area by the overall move sign. Never throws — `fetchYahooChart`
 * already returns `[]` on failure.
 */

interface SymbolChartProps {
  symbol: string;
}

type Range = '1D' | '1M' | '3M' | '1Y';

const RANGES: Range[] = ['1D', '1M', '3M', '1Y'];

const BUY = 'hsl(var(--trading-buy))';
const SELL = 'hsl(var(--trading-sell))';

function fetchForRange(sym: string, range: Range): Promise<YahooBar[]> {
  switch (range) {
    case '1D':
      return fetchYahooChart(sym, '1h', '7d');
    case '1M':
      return fetchYahooChart(sym, '1d', '1mo');
    case '3M':
      return fetchYahooChart(sym, '1d', '3mo');
    case '1Y':
      return fetchYahooChart(sym, '1d', '1y');
  }
}

export function SymbolChart({ symbol }: SymbolChartProps) {
  const [range, setRange] = useState<Range>('1M');
  const sym = symbol.trim().toUpperCase();

  const { data, isLoading } = useQuery({
    queryKey: ['symchart', sym, range],
    queryFn: () => fetchForRange(sym, range),
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
    enabled: sym.length > 0,
  });

  if (!sym) {
    return (
      <Card className="trading-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            Select a symbol to chart.
          </div>
        </CardContent>
      </Card>
    );
  }

  const bars = data ?? [];
  const ch = windowChange(bars);
  const color = ch == null ? BUY : ch.abs >= 0 ? BUY : SELL;
  const gradId = `symchart-fill-${sym}`;

  return (
    <Card className="trading-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {sym}
          <div className="ml-auto flex items-center gap-1">
            {RANGES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={r === range ? 'secondary' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : bars.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            Chart unavailable for {sym}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tickFormatter={(t: number) => new Date(t * 1000).toLocaleDateString()}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Close']}
                labelFormatter={(t: number) => new Date(t * 1000).toLocaleString()}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
