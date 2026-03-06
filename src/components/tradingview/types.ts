/**
 * TradingView Widget Integration Types
 *
 * This project uses the TradingView Advanced Chart Widget (client-side embed).
 * No API key is required — TradingView widgets are free for non-commercial use
 * and load directly from TradingView's CDN via an embedded script.
 *
 * For commercial use, review TradingView's widget terms:
 * https://www.tradingview.com/widget/
 *
 * Available widget types for future expansion:
 * - Advanced Chart (implemented)
 * - Mini Chart
 * - Symbol Overview
 * - Ticker Tape
 * - Technical Analysis
 * - Market Overview
 * - Screener
 */

export type TradingViewInterval =
  | '1'
  | '3'
  | '5'
  | '15'
  | '30'
  | '60'
  | '120'
  | '180'
  | '240'
  | 'D'
  | 'W'
  | 'M';

export type TradingViewTheme = 'light' | 'dark';

export type TradingViewRange =
  | '1D'
  | '5D'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '12M'
  | '60M'
  | 'ALL';

export interface TradingViewChartConfig {
  /** Trading symbol, e.g. "NASDAQ:AAPL" or "BTCUSD" */
  symbol: string;
  /** Chart interval/timeframe */
  interval?: TradingViewInterval;
  /** Color theme — synced from app theme by default */
  theme?: TradingViewTheme;
  /** Default date range */
  range?: TradingViewRange;
  /** Auto-resize to fill container */
  autosize?: boolean;
  /** Fixed width (ignored if autosize is true) */
  width?: number;
  /** Fixed height (ignored if autosize is true) */
  height?: number;
  /** Show drawing toolbar */
  allowSymbolChange?: boolean;
  /** Show bottom toolbar with timeframes */
  hideTopToolbar?: boolean;
  /** Hide side toolbar */
  hideSideToolbar?: boolean;
  /** Hide bottom volume */
  hideVolume?: boolean;
  /** Locale for the widget */
  locale?: string;
  /** Enable saving chart layouts */
  saveImage?: boolean;
  /** Calendar display */
  hideCalendar?: boolean;
  /** Studies/indicators to load */
  studies?: string[];
  /** Container element ID */
  containerId?: string;
}

export interface TradingViewContextValue {
  /** Current resolved theme for TradingView widgets */
  resolvedTheme: TradingViewTheme;
  /** Default chart configuration */
  defaultConfig: Partial<TradingViewChartConfig>;
}
