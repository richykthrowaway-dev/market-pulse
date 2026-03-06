import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMarketReturns, buildBuckets } from '@/hooks/useMarketReturns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface MarketOverviewCardProps {
  className?: string;
}

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'] as const;

const TIMEFRAME_LABELS: Record<string, string> = {
  '1D': "Day's Change Stats",
  '1W': "Week's Change Stats",
  '1M': "Month's Change Stats",
  '3M': "3-Month Change Stats",
  '6M': "6-Month Change Stats",
  'YTD': "YTD Change Stats",
  '1Y': "1-Year Change Stats",
  '3Y': "3-Year Change Stats",
  '5Y': "5-Year Change Stats",
  '10Y': "10-Year Change Stats",
};

export function MarketOverviewCard({ className }: MarketOverviewCardProps) {
  const [timeframe, setTimeframe] = useState<string>('1D');
  const { data, isLoading } = useMarketReturns(timeframe);

  const buckets = data ? buildBuckets(data.returns) : [];
  const stats = data?.stats ?? { median: 0, mean: 0, up: 0, down: 0 };

  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      <div className="px-4 pt-4 pb-0">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-card-foreground">Market Overview</h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
              US Market
            </span>
          </div>
        </div>

        {/* Timeframe pills */}
        <div className="flex items-center gap-1 mb-4">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                tf === timeframe
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-card-foreground mb-1">
            {TIMEFRAME_LABELS[timeframe]}
          </p>
          <div className="flex items-center gap-6 text-xs">
            <span>
              Median{' '}
              <span className={cn('font-mono-num font-semibold', stats.median >= 0 ? 'text-success' : 'text-danger')}>
                {stats.median >= 0 ? '+' : ''}{stats.median.toFixed(2)}
              </span>
            </span>
            <span>
              Up{' '}
              <span className="font-mono-num font-semibold text-success">{stats.up.toLocaleString()}</span>
            </span>
            <span>
              Mean{' '}
              <span className={cn('font-mono-num font-semibold', stats.mean >= 0 ? 'text-success' : 'text-danger')}>
                {stats.mean >= 0 ? '+' : ''}{stats.mean.toFixed(2)}
              </span>
            </span>
            <span>
              Down{' '}
              <span className="font-mono-num font-semibold text-danger">{stats.down.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="w-full" style={{ height: 240 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
              barCategoryGap="8%"
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval={0}
                angle={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                  color: 'hsl(var(--card-foreground))',
                }}
                formatter={(value: number, _name: string, props: any) => {
                  const bucket = props.payload as { from: number; to: number };
                  const rangeLabel =
                    bucket.from === -Infinity
                      ? '< -10%'
                      : bucket.to === Infinity
                      ? '> 10%'
                      : `${bucket.from}% to ${bucket.to}%`;
                  return [`${value} stocks`, rangeLabel];
                }}
                labelFormatter={() => ''}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={40}>
                {buckets.map((bucket, i) => {
                  const midpoint = bucket.from === -Infinity ? -11 : bucket.to === Infinity ? 11 : (bucket.from + bucket.to) / 2;
                  return (
                    <Cell
                      key={i}
                      fill={midpoint >= 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* X-axis label */}
      <p className="text-center text-[10px] text-muted-foreground pb-3 -mt-3">
        {timeframe === '1D' ? "Day's" : timeframe} Change %
      </p>
    </Card>
  );
}
