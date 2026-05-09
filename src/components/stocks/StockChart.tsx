
import React, { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { subDays, format } from 'date-fns';
import { useHistoricalPrices, useEodhdIntraday } from '@/hooks/useDefeatBeta';
import { fetchEodHistorical } from '@/services/eodhdApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StockLogo } from '@/components/stocks/StockLogo';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { LightweightChart } from '@/components/charts/LightweightChart';
import { resolveBand, getBandHex, getBandRgba } from '@/lib/sparklineTvColors';
import type { EodBar } from '@/services/eodhdApi';

const timeRanges = [
  { label: '1W', days: 6 },
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
  const [selectedRange, setSelectedRange] = useState(timeRanges[1]); // Default 1M
  const { resolvedTheme } = useTheme();

  const is1W = selectedRange.label === '1W';

  // Fetch daily bars from DefeatBeta backend — React Query caches per (symbol, days).
  // The backend caps at 3650 rows (≈14 years of trading days).
  // Skipped for 1W — we use hourly bars from Yahoo instead.
  const { data: allLocalBars = [], isLoading: localLoading } = useHistoricalPrices(
    externalBars || is1W ? undefined : symbol,
    Math.min(selectedRange.days, 3650),
  );

  // EODHD fallback — fires when DefeatBeta returns nothing (backend not running / prod env).
  // EODHD symbols use TICKER.US format for US-listed stocks.
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.US`;
  const fromDate = useMemo(
    () => format(subDays(new Date(), Math.min(selectedRange.days, 3650)), 'yyyy-MM-dd'),
    [selectedRange.days],
  );
  const needsEodFallback = !externalBars && !is1W && !localLoading && allLocalBars.length === 0;
  const { data: eodBars = [], isLoading: eodLoading } = useQuery({
    queryKey: ['eodhd', 'chart', eodSymbol, fromDate],
    queryFn: () => fetchEodHistorical(eodSymbol, fromDate),
    enabled: needsEodFallback,
    staleTime: 60 * 60_000,
    gcTime: 30 * 60_000,
  });

  // Merge: prefer DefeatBeta if available, fall back to EODHD
  const effectiveDailyBars = allLocalBars.length > 0 ? allLocalBars : eodBars;

  // Fetch hourly bars from EODHD for 1W (replaces Yahoo Finance)
  const { data: hourlyBars = [], isLoading: hourlyLoading } = useEodhdIntraday(
    externalBars ? undefined : symbol,
    is1W,
  );

  const isLoading = externalBars ? false : (is1W ? hourlyLoading : (localLoading || (needsEodFallback && eodLoading)));

  // The cutoff date string for the selected range (used for band colour + visible range).
  // For 1W (hourly data) we fitContent() instead — all fetched data IS the window.
  const visibleFrom = useMemo(
    () => (is1W || selectedRange.days >= 9999) ? undefined : format(subDays(new Date(), selectedRange.days), 'yyyy-MM-dd'),
    [selectedRange.days, is1W],
  );

  // All available bars mapped to AreaData[] — the chart holds the full history
  // so the user can scroll/zoom freely beyond the selected timeframe window.
  const lwData = useMemo(() => {
    // For 1W, use Yahoo hourly bars (Unix timestamps as seconds — lightweight-charts UTCTimestamp)
    if (is1W && hourlyBars.length > 0) {
      return hourlyBars.map((bar) => ({
        time: bar.t as unknown as string, // UTCTimestamp (number) — lightweight-charts accepts this
        value: bar.c,
      }));
    }
    const src: any[] = externalBars ?? effectiveDailyBars;
    return src.map((bar: any) => ({
      time: String(bar.date ?? bar.report_date ?? new Date(bar.ts).toISOString()).slice(0, 10) as string,
      value: Number(bar.adjusted_close ?? bar.close),
    }));
  }, [is1W, hourlyBars, externalBars, allLocalBars]);

  // Slice to selected range for band-colour computation only
  const windowData = useMemo(() => {
    if (!visibleFrom) return lwData;
    return lwData.filter(d => (d.time as string) >= visibleFrom);
  }, [lwData, visibleFrom]);

  // Resolve performance-band colour from the visible window's period return
  const bandColor = useMemo(() => {
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
    if (windowData.length < 2) {
      return { hex: '#3b82f6', top: 'rgba(59,130,246,0.4)', bottom: 'rgba(59,130,246,0.05)' };
    }
    const first = windowData[0].value;
    const last  = windowData[windowData.length - 1].value;
    const pct   = first ? ((last - first) / first) * 100 : 0;
    const band  = resolveBand(pct);
    return {
      hex:    getBandHex(band, theme),
      top:    getBandRgba(band, theme, 0.4),
      bottom: getBandRgba(band, theme, 0.05),
    };
  }, [windowData, resolvedTheme]);

  return (
    <Card className={cn('overflow-hidden', className)}>
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
              variant={selectedRange.label === range.label ? 'default' : 'outline'}
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

      <CardContent className="p-0 pb-0">
        {isLoading ? (
          <Skeleton className="w-full rounded-none" style={{ height: 300 }} />
        ) : lwData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            No price data available for this range
          </div>
        ) : (
          <LightweightChart
            data={lwData}
            type="area"
            height={300}
            areaLineColor={bandColor.hex}
            areaTopColor={bandColor.top}
            areaBottomColor={bandColor.bottom}
            visibleFrom={visibleFrom}
            timeVisible={is1W}
            className="rounded-none"
          />
        )}
      </CardContent>
    </Card>
  );
}
