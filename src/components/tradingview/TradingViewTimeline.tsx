import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewTimelineProps {
  height?: number;
  className?: string;
  feedMode?: 'all_symbols' | 'market' | 'symbol';
  displayMode?: 'adaptive' | 'regular' | 'compact';
}

let timelineIdCounter = 0;

export function TradingViewTimeline({
  height = 500,
  className,
  feedMode = 'all_symbols',
  displayMode = 'adaptive',
}: TradingViewTimelineProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-timeline-${++timelineIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js';
    script.async = true;
    script.textContent = JSON.stringify({
      displayMode,
      feedMode,
      colorTheme: resolvedTheme,
      isTransparent: false,
      locale: 'en',
      width: '100%',
      height,
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, height, feedMode, displayMode, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
