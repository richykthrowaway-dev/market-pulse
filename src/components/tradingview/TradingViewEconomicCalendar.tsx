import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewEconomicCalendarProps {
  width?: number | string;
  height?: number;
  importanceFilter?: '-1,0,1' | '0,1' | '1';
  countryFilter?: string;
  className?: string;
}

let calendarIdCounter = 0;

export function TradingViewEconomicCalendar({
  width = '100%',
  height = 500,
  importanceFilter = '-1,0,1',
  countryFilter,
  className,
}: TradingViewEconomicCalendarProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-calendar-${++calendarIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    const config: Record<string, unknown> = {
      width: typeof width === 'number' ? width : '100%',
      height,
      colorTheme: resolvedTheme,
      isTransparent: false,
      locale: 'en',
      importanceFilter,
    };
    if (countryFilter) config.countryFilter = countryFilter;
    script.textContent = JSON.stringify(config);
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, width, height, importanceFilter, countryFilter, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
