import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewTechnicalAnalysisProps {
  symbol?: string;
  interval?: '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1D' | '1W' | '1M';
  width?: number | string;
  height?: number;
  showIntervalTabs?: boolean;
  className?: string;
}

let taWidgetIdCounter = 0;

export function TradingViewTechnicalAnalysis({
  symbol = 'NASDAQ:AAPL',
  interval = '1D',
  width = '100%',
  height = 425,
  showIntervalTabs = true,
  className,
}: TradingViewTechnicalAnalysisProps) {
  const { resolvedTheme } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-ta-${++taWidgetIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.textContent = JSON.stringify({
      interval,
      width: typeof width === 'number' ? width : '100%',
      height,
      symbol,
      showIntervalTabs,
      isTransparent: true,
      colorTheme: resolvedTheme,
      locale: 'en',
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, symbol, interval, width, height, showIntervalTabs]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
