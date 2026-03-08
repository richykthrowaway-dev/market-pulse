import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { TradingViewContextValue, TradingViewTheme } from './types';

const TradingViewContext = createContext<TradingViewContextValue | null>(null);

/**
 * Reads the active theme directly from the <html> element's class list.
 * next-themes injects an inline script that sets the class BEFORE React mounts,
 * so this is always accurate — unlike useTheme().resolvedTheme which resolves
 * asynchronously and can race with widget creation.
 */
function readDomTheme(): TradingViewTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Provides theme-aware configuration context for all TradingView widgets.
 *
 * Instead of relying on next-themes' useTheme() (which has a multi-tick
 * hydration delay), we read the theme straight from the DOM and watch
 * for changes via MutationObserver.  This guarantees every widget is
 * created exactly once with the correct theme.
 */
export function TradingViewProvider({ children }: { children: React.ReactNode }) {
  const [tvTheme, setTvTheme] = useState<TradingViewTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read the real theme from the DOM (set by next-themes inline script)
    setTvTheme(readDomTheme());
    setMounted(true);

    // Watch for class changes on <html> (e.g. user toggles dark mode)
    const observer = new MutationObserver(() => {
      setTvTheme(readDomTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const value = useMemo<TradingViewContextValue>(() => ({
    resolvedTheme: tvTheme,
    mounted,
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
  }), [tvTheme, mounted]);

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
      mounted: false,
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
