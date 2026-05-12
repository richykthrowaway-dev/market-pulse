import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is narrower than 768px (Tailwind md: breakpoint).
 * Initialises synchronously from window.innerWidth to avoid a layout flash on mount.
 * Safe in SSR environments (defaults false when window is unavailable).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches); // sync in case it changed between render and effect
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
