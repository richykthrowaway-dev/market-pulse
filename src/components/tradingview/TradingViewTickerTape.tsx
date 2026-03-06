import React, { useEffect, useRef } from 'react';
import { useTradingView } from './TradingViewProvider';

interface TradingViewTickerTapeProps {
  symbols?: Array<{ proName: string; title: string }>;
  showSymbolLogo?: boolean;
  isTransparent?: boolean;
  displayMode?: 'adaptive' | 'regular' | 'compact';
  className?: string;
}

let tickerTapeIdCounter = 0;

export function TradingViewTickerTape({
  symbols,
  showSymbolLogo = true,
  isTransparent = true,
  displayMode = 'adaptive',
  className,
}: TradingViewTickerTapeProps) {
  const { resolvedTheme } = useTradingView();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tv-ticker-tape-${++tickerTapeIdCounter}`);

  const defaultSymbols = [
    { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
    { proName: 'FOREXCOM:NSXUSD', title: 'US 100' },
    { proName: 'FX_IDC:EURUSD', title: 'EUR to USD' },
    { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
    { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
    { proName: 'FX_IDC:GBPUSD', title: 'GBP to USD' },
    { proName: 'TVC:GOLD', title: 'Gold' },
    { proName: 'TVC:SILVER', title: 'Silver' },
    { proName: 'TVC:DXY', title: 'US Dollar Index' },
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
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: symbols || defaultSymbols,
      showSymbolLogo,
      isTransparent,
      displayMode,
      colorTheme: resolvedTheme,
      locale: 'en',
    });
    widget.appendChild(script);
    container.appendChild(widget);

    return () => { container.innerHTML = ''; };
  }, [resolvedTheme, symbols, showSymbolLogo, isTransparent, displayMode]);

  return <div ref={containerRef} id={containerId.current} className={className} />;
}
