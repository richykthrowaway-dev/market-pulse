import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTradingView } from './TradingViewProvider';

interface TradingViewMiniChartProps {
  symbol?: string;
  width?: number | string;
  height?: number;
  dateRange?: '1D' | '1M' | '3M' | '12M' | '60M' | 'ALL';
  className?: string;
  'aria-label'?: string;
}

let miniWidgetIdCounter = 0;

/**
 * TradingView Mini Chart Widget — compact sparkline-style chart.
 * Shows symbol price, change %, and a clean area chart.
 * No API key required.
 */
export function TradingViewMiniChart({
  symbol = 'AAPL',
  width = '100%',
  height = 220,
  dateRange = '12M',
  className,
  'aria-label': ariaLabel,
}: TradingViewMiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTradingView();
  const containerId = useMemo(() => `tv_minichart_${++miniWidgetIdCounter}`, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange,
      colorTheme: resolvedTheme,
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
      noTimeScale: false,
      chartOnly: false,
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
  }, [symbol, resolvedTheme, dateRange, containerId]);

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Mini chart for ${symbol}`}
      className={cn(
        'rounded-lg overflow-hidden border border-border bg-card',
        className
      )}
      style={{
        width,
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
      <p className="sr-only">Mini chart showing {symbol} price overview.</p>
    </div>
  );
}
