import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewHeatmapProps {
  dataSource?: 'SPX500' | 'NASDAQ100' | 'DJI' | 'RUS2000';
  grouping?: 'sector' | 'no_group';
  blockSize?: 'market_cap_basic' | 'number_of_employees';
  blockColor?: 'change' | 'Perf.W' | 'Perf.1M' | 'Perf.3M' | 'Perf.6M' | 'Perf.YTD' | 'Perf.Y';
  width?: number | string;
  height?: number;
  className?: string;
}

let heatmapIdCounter = 0;

export function TradingViewHeatmap({
  dataSource = 'SPX500',
  grouping = 'sector',
  blockSize = 'market_cap_basic',
  blockColor = 'change',
  width = '100%',
  height = 500,
  className,
}: TradingViewHeatmapProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-heatmap-${++heatmapIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    script.async = true;
    script.textContent = JSON.stringify({
      exchanges: [],
      dataSource,
      grouping,
      blockSize,
      blockColor,
      locale: 'en',
      symbolUrl: '',
      colorTheme: resolvedTheme,
      hasTopBar: true,
      isDataSet498Enabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: typeof width === 'number' ? width : '100%',
      height,
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, dataSource, grouping, blockSize, blockColor, width, height, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
