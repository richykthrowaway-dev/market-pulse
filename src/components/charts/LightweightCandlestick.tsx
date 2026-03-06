import React, { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import type { CandlestickData, Time } from 'lightweight-charts';
import { LightweightChart } from './LightweightChart';
import { useStockHistory } from '@/hooks/useStockHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TIME_RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
  { label: 'All', days: 9999 },
];

export interface LightweightCandlestickProps {
  symbol: string;
  name?: string;
  height?: number;
  className?: string;
  /** Optional external OHLC bars (e.g. from EODHD) */
  externalBars?: Array<{ date: string; open: number; high: number; low: number; close: number; volume?: number }>;
}

export function LightweightCandlestick({
  symbol,
  name,
  height = 400,
  className,
  externalBars,
}: LightweightCandlestickProps) {
  const [range, setRange] = useState(30);

  // Fetch from DB when no external bars provided
  const { data: dbBars = [], isLoading } = useStockHistory(symbol, range > 5000 ? 3650 : range);

  const chartData = useMemo<CandlestickData[]>(() => {
    if (externalBars && externalBars.length > 0) {
      const cutoff = range < 5000 ? subDays(new Date(), range) : new Date(0);
      return externalBars
        .filter(b => new Date(b.date) >= cutoff)
        .map(b => ({
          time: b.date as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }));
    }

    // DB may return duplicate dates (e.g. different UTC offsets mapping to same date).
    // Deduplicate by keeping the last bar per date string.
    const mapped = dbBars.map((b: any) => ({
      time: (b.ts as string).slice(0, 10) as Time,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
    }));
    const deduped = new Map<string, CandlestickData>();
    for (const bar of mapped) {
      deduped.set(bar.time as string, bar);
    }
    return Array.from(deduped.values());
  }, [externalBars, dbBars, range]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">
          {name || symbol} — Candlestick
        </CardTitle>
        <div className="flex gap-1">
          {TIME_RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={cn(
                'px-2 py-1 text-xs rounded-md transition-colors',
                range === r.days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && !externalBars ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
            No OHLC data available
          </div>
        ) : (
          <LightweightChart
            data={chartData}
            type="candlestick"
            height={height}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default LightweightCandlestick;
