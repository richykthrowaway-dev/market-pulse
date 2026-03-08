import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewScreenerProps {
  defaultColumn?: 'overview' | 'performance' | 'oscillators' | 'moving_averages';
  defaultScreen?: 'most_capitalized' | 'volume_leaders' | 'top_gainers' | 'top_losers' | 'ath' | 'atl' | 'above_52wk_high' | 'below_52wk_low';
  market?: 'america' | 'uk' | 'japan' | 'germany' | 'australia' | 'canada';
  showToolbar?: boolean;
  width?: number | string;
  height?: number;
  className?: string;
}

let screenerIdCounter = 0;

export function TradingViewScreener({
  defaultColumn = 'overview',
  defaultScreen = 'most_capitalized',
  market = 'america',
  showToolbar = true,
  width = '100%',
  height = 550,
  className,
}: TradingViewScreenerProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-screener-${++screenerIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
    script.async = true;
    script.textContent = JSON.stringify({
      width: typeof width === 'number' ? width : '100%',
      height,
      defaultColumn,
      defaultScreen,
      market,
      showToolbar,
      colorTheme: resolvedTheme,
      locale: 'en',
      isTransparent: false,
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, defaultColumn, defaultScreen, market, showToolbar, width, height, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
