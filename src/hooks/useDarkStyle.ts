/**
 * useDarkStyle — persists the user's dark-mode background preference.
 *
 * Styles:
 *   'navy'  (default) — the original navy-blue dark theme (222 47% 6% background)
 *   'black' — pure AMOLED-style black dark theme (0 0% 4% background)
 *
 * The preference is stored in localStorage under 'dark-style-v1' and applied
 * by adding/removing the class 'dark-black' on <html>. The CSS at
 * .dark.dark-black overrides the navy variables with near-black values.
 *
 * Call this hook from any component that renders on every page (PageLayout,
 * Dashboard) so the class is applied immediately on load without App.tsx.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dark-style-v1';
const CLASS_NAME  = 'dark-black';

export type DarkStyle = 'navy' | 'black';

function readStyle(): DarkStyle {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'black') return 'black';
  } catch { /* ignore */ }
  return 'navy';
}

function applyStyle(style: DarkStyle) {
  if (style === 'black') {
    document.documentElement.classList.add(CLASS_NAME);
  } else {
    document.documentElement.classList.remove(CLASS_NAME);
  }
}

export function useDarkStyle() {
  const [darkStyle, setDarkStyleState] = useState<DarkStyle>(readStyle);

  // Apply on mount (and whenever the value changes)
  useEffect(() => {
    applyStyle(darkStyle);
  }, [darkStyle]);

  const setDarkStyle = useCallback((style: DarkStyle) => {
    try { localStorage.setItem(STORAGE_KEY, style); } catch { /* ignore */ }
    setDarkStyleState(style);
  }, []);

  return { darkStyle, setDarkStyle };
}

/**
 * Lightweight "apply-only" version — call this from layout components that
 * just need to ensure the class is applied on mount without managing UI state.
 */
export function useApplyDarkStyle() {
  useEffect(() => {
    applyStyle(readStyle());
  }, []);
}
