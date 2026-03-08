import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewForexRatesProps {
  width?: number | string;
  height?: number;
  className?: string;
}

let forexIdCounter = 0;

export function TradingViewForexRates({
  width = '100%',
  height = 400,
  className,
}: TradingViewForexRatesProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-forex-${++forexIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js';
    script.async = true;
    script.textContent = JSON.stringify({
      width: typeof width === 'number' ? width : '100%',
      height,
      currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY'],
      isTransparent: false,
      colorTheme: resolvedTheme,
      locale: 'en',
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, width, height, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
