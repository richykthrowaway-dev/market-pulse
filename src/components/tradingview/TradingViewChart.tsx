import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTradingView } from './TradingViewProvider';
import type { TradingViewChartConfig } from './types';

/**
 * TradingView Advanced Chart Widget — client-side embed.
 *
 * No API key is required. The widget script is loaded from TradingView's CDN.
 * For commercial usage review https://www.tradingview.com/widget/
 *
 * Props mirror TradingViewChartConfig; unset props fall back to
 * TradingViewProvider defaults, then to sensible hard-coded defaults.
 */

interface TradingViewChartProps extends Partial<TradingViewChartConfig> {
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Accessible label for the chart region */
  'aria-label'?: string;
}

let widgetIdCounter = 0;

export function TradingViewChart({
  symbol = 'BTCUSD',
  interval,
  theme,
  range,
  autosize,
  width,
  height = 500,
  allowSymbolChange,
  hideTopToolbar,
  hideSideToolbar,
  hideVolume,
  hideLegend,
  chartStyle,
  overrides,
  locale,
  saveImage,
  studies,
  className,
  'aria-label': ariaLabel,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, defaultConfig, mounted } = useTradingView();

  // Stable unique ID per instance
  const containerId = useMemo(() => `tradingview_widget_${++widgetIdCounter}`, []);

  // Merge props → context defaults → hard defaults
  const config = useMemo(
    () => ({
      symbol,
      interval: interval ?? defaultConfig.interval ?? 'D',
      theme: theme ?? resolvedTheme,
      allow_symbol_change: allowSymbolChange ?? defaultConfig.allowSymbolChange ?? true,
      hide_top_toolbar: hideTopToolbar ?? defaultConfig.hideTopToolbar ?? false,
      hide_side_toolbar: hideSideToolbar ?? defaultConfig.hideSideToolbar ?? false,
      hide_volume: hideVolume ?? false,
      hide_legend: hideLegend ?? false,
      chart_style: chartStyle ?? '1',
      overrides: overrides ?? undefined,
      locale: locale ?? defaultConfig.locale ?? 'en',
      save_image: saveImage ?? defaultConfig.saveImage ?? true,
      studies: studies ?? [],
      range: range ?? undefined,
    }),
    [
      symbol, interval, theme, resolvedTheme, range,
      allowSymbolChange, hideTopToolbar, hideSideToolbar,
      hideVolume, hideLegend, chartStyle,
      // Stringify overrides so a new object with same values doesn't retrigger
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(overrides),
      locale, saveImage, studies, defaultConfig,
    ]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) return;

    // Clear previous widget
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: config.symbol,
      interval: config.interval,
      timezone: 'Etc/UTC',
      theme: config.theme,
      style: config.chart_style,
      locale: config.locale,
      allow_symbol_change: config.allow_symbol_change,
      hide_top_toolbar: config.hide_top_toolbar,
      hide_side_toolbar: config.hide_side_toolbar,
      hide_volume: config.hide_volume,
      hide_legend: config.hide_legend,
      save_image: config.save_image,
      width: '100%',
      height: '100%',
      ...(config.range ? { range: config.range } : {}),
      ...(config.studies.length ? { studies: config.studies } : {}),
      ...(config.overrides ? { overrides: config.overrides } : {}),
      support_host: 'https://www.tradingview.com',
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';

    container.appendChild(widgetDiv);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [config, containerId, mounted]);

  return (
    <section
      role="img"
      aria-label={ariaLabel ?? `TradingView chart for ${symbol}`}
      className={cn(
        'rounded-lg overflow-hidden border border-border bg-card',
        className
      )}
      style={{
        width: width ?? '100%',
        height,
        position: 'relative',
        contain: 'strict',
      }}
    >
      <div
        ref={containerRef}
        id={containerId}
        className="tradingview-widget-container"
        style={{ position: 'absolute', inset: 0 }}
      />
      <p className="sr-only">
        Interactive financial chart powered by TradingView showing {symbol} price data.
      </p>
    </section>
  );
}
