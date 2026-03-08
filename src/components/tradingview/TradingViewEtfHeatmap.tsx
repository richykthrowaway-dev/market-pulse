import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewEtfHeatmapProps {
  dataSource?: 'AllUSEtf';
  blockSize?: 'volume' | 'market_cap_basic';
  blockColor?: 'change' | 'Perf.W' | 'Perf.1M' | 'Perf.3M' | 'Perf.6M' | 'Perf.YTD' | 'Perf.Y';
  grouping?: 'asset_class' | 'no_group';
  width?: number | string;
  height?: number;
  className?: string;
}

let etfHeatmapIdCounter = 0;

export function TradingViewEtfHeatmap({
  dataSource = 'AllUSEtf',
  blockSize = 'volume',
  blockColor = 'change',
  grouping = 'asset_class',
  width = '100%',
  height = 500,
  className,
}: TradingViewEtfHeatmapProps) {
  const { resolvedTheme, mounted } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-etf-heatmap-${++etfHeatmapIdCounter}`);

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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-etf-heatmap.js';
    script.async = true;
    script.textContent = JSON.stringify({
      dataSource,
      blockSize,
      blockColor,
      grouping,
      locale: 'en',
      symbolUrl: '',
      colorTheme: resolvedTheme,
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: typeof width === 'number' ? width : '100%',
      height,
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, dataSource, blockSize, blockColor, grouping, width, height, mounted]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
