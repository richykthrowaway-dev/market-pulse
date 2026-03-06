import React, { createContext, useContext, useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { TradingViewContextValue, TradingViewTheme } from './types';

const TradingViewContext = createContext<TradingViewContextValue | null>(null);

/**
 * Provides theme-aware configuration context for all TradingView widgets.
 * Wrap your app (or a subtree) with this provider so that every
 * <TradingViewChart /> automatically picks up the correct theme.
 */
export function TradingViewProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  const value = useMemo<TradingViewContextValue>(() => {
    const tvTheme: TradingViewTheme = resolvedTheme === 'light' ? 'light' : 'dark';
    return {
      resolvedTheme: tvTheme,
      defaultConfig: {
        theme: tvTheme,
        autosize: true,
        interval: 'D',
        locale: 'en',
        allowSymbolChange: true,
        hideTopToolbar: false,
        hideSideToolbar: false,
        hideVolume: false,
        saveImage: true,
      },
    };
  }, [resolvedTheme]);

  return (
    <TradingViewContext.Provider value={value}>
      {children}
    </TradingViewContext.Provider>
  );
}

/**
 * Access TradingView context (resolved theme + default config).
 * Falls back to dark theme if used outside the provider.
 */
export function useTradingView(): TradingViewContextValue {
  const ctx = useContext(TradingViewContext);
  if (!ctx) {
    return {
      resolvedTheme: 'dark',
      defaultConfig: {
        theme: 'dark',
        autosize: true,
        interval: 'D',
        locale: 'en',
      },
    };
  }
  return ctx;
}
