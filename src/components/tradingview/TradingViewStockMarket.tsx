import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewStockMarketProps {
  exchange?: string;
  dateRange?: '1D' | '1M' | '3M' | '12M';
  showChart?: boolean;
  showSymbolLogo?: boolean;
  showFloatingTooltip?: boolean;
  width?: number | string;
  height?: number;
  className?: string;
}

let stockMarketIdCounter = 0;

export function TradingViewStockMarket({
  exchange = 'US',
  dateRange = '1D',
  showChart = true,
  showSymbolLogo = true,
  showFloatingTooltip = true,
  width = '100%',
  height = 550,
  className,
}: TradingViewStockMarketProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-stock-market-${++stockMarketIdCounter}`);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) return;
    container.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widget.appendChild(widgetInner);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js';
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: resolvedTheme,
      dateRange,
      exchange,
      showChart,
      locale: 'en',
      width: typeof width === 'number' ? width : '100%',
      height,
      largeChartUrl: '',
      isTransparent: false,
      showSymbolLogo,
      showFloatingTooltip,
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, dateRange, exchange, showChart, showSymbolLogo, showFloatingTooltip, width, height, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
