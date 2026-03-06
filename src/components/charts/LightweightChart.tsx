import React, { useRef, useEffect, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type DeepPartial,
  type ChartOptions,
  type CandlestickData,
  type LineData,
  type AreaData,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export type ChartType = 'candlestick' | 'area' | 'line';

export interface LightweightChartProps {
  data: CandlestickData[] | LineData[] | AreaData[];
  type?: ChartType;
  height?: number;
  width?: number | string;
  className?: string;
  /** Override bull candle color */
  upColor?: string;
  /** Override bear candle color */
  downColor?: string;
}

/**
 * Reusable wrapper around TradingView Lightweight Charts.
 * Syncs with app light/dark theme and handles resize + cleanup.
 */
export function LightweightChart({
  data,
  type = 'candlestick',
  height = 400,
  className,
  upColor,
  downColor,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Resolve colors from CSS variables or props
  const colors = useMemo(() => {
    const root = document.documentElement;
    const get = (v: string) => getComputedStyle(root).getPropertyValue(v).trim();
    return {
      bg: 'transparent',
      text: isDark ? '#d1d5db' : '#374151',
      grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      crosshair: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      up: upColor || `hsl(${get('--success')})`,
      down: downColor || `hsl(${get('--danger')})`,
      area: `hsl(${get('--primary')})`,
    };
  }, [isDark, upColor, downColor]);

  // Create / recreate chart on theme change
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair, width: 1, style: 3 },
        horzLine: { color: colors.crosshair, width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: colors.border,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    };

    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Add series based on type
    if (type === 'candlestick') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: colors.up,
        downColor: colors.down,
        borderUpColor: colors.up,
        borderDownColor: colors.down,
        wickUpColor: colors.up,
        wickDownColor: colors.down,
      });
      series.setData(data as CandlestickData[]);
      seriesRef.current = series;
    } else if (type === 'area') {
      const series = chart.addSeries(AreaSeries, {
        lineColor: colors.area,
        topColor: colors.area.replace(')', ' / 0.4)').replace('hsl(', 'hsla('),
        bottomColor: colors.area.replace(')', ' / 0.05)').replace('hsl(', 'hsla('),
        lineWidth: 2,
      });
      series.setData(data as AreaData[]);
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: colors.area,
        lineWidth: 2,
      });
      series.setData(data as LineData[]);
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w } = entry.contentRect;
        if (w > 0) chart.applyOptions({ width: w });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [colors, type, height, data]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full rounded-lg overflow-hidden', className)}
      style={{ height }}
      role="img"
      aria-label="Price chart"
    />
  );
}

export default LightweightChart;
