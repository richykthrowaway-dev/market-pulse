import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewSymbolOverviewProps {
  symbols?: Array<[string, string]>;
  chartOnly?: boolean;
  width?: number | string;
  height?: number;
  className?: string;
}

let soIdCounter = 0;

export function TradingViewSymbolOverview({
  symbols,
  chartOnly = false,
  width = '100%',
  height = 400,
  className,
}: TradingViewSymbolOverviewProps) {
  const { resolvedTheme } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-so-${++soIdCounter}`);

  const defaultSymbols: [string, string][] = [
    ['Apple', 'AAPL|1D'],
    ['Google', 'GOOGL|1D'],
    ['Microsoft', 'MSFT|1D'],
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widget.appendChild(widgetInner);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: symbols || defaultSymbols,
      chartOnly,
      width: typeof width === 'number' ? width : '100%',
      height,
      colorTheme: resolvedTheme,
      isTransparent: true,
      locale: 'en',
      largeChartUrl: '',
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, symbols, chartOnly, width, height]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
