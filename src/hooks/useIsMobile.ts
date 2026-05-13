import { useEffect, useState } from 'react';

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const VIEW_MODE_KEY   = 'view-mode';
const VIEW_MODE_EVENT = 'view-mode-change';

export type ViewMode = 'auto' | 'mobile' | 'desktop';

function detectMobileUA(): boolean {
  return typeof navigator !== 'undefined' && MOBILE_UA_REGEX.test(navigator.userAgent);
}

function readViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return 'auto';
  const v = localStorage.getItem(VIEW_MODE_KEY);
  return v === 'mobile' || v === 'desktop' ? v : 'auto';
}

/** Persist the user's manual override; 'auto' falls back to UA detection. */
export function setViewMode(mode: ViewMode) {
  if (mode === 'auto') localStorage.removeItem(VIEW_MODE_KEY);
  else localStorage.setItem(VIEW_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(VIEW_MODE_EVENT));
}

/** Current override state — used by the toggle UI to render correct icon. */
export function useViewMode(): ViewMode {
  const [mode, setMode] = useState<ViewMode>(readViewMode);
  useEffect(() => {
    const handler = () => setMode(readViewMode());
    window.addEventListener(VIEW_MODE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(VIEW_MODE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return mode;
}

/**
 * Returns true when the app should render its mobile layout.
 *
 * Priority order:
 *   1. Manual override saved in localStorage ('mobile' / 'desktop')
 *   2. User agent — true for real phones/tablets, false for desktop browsers
 *
 * Viewport width is intentionally NOT used — a narrow desktop window or
 * zoomed browser produced false positives.
 */
export function useIsMobile(): boolean {
  const mode = useViewMode();
  const [ua] = useState<boolean>(detectMobileUA);
  if (mode === 'mobile')  return true;
  if (mode === 'desktop') return false;
  return ua;
}

/**
 * True when the app should render inside a centered phone-shaped frame —
 * i.e. the user is on a desktop browser but has manually chosen mobile view.
 *
 * Returns false when we're already inside the preview iframe (otherwise we'd
 * recursively try to render another frame inside ourselves). The shared
 * localStorage between parent and iframe makes the toggle propagate both ways.
 */
export function useMobilePreviewFrame(): boolean {
  const mode = useViewMode();
  const [ua] = useState<boolean>(detectMobileUA);
  const [inIframe] = useState<boolean>(
    () => typeof window !== 'undefined' && window.self !== window.top
  );
  return mode === 'mobile' && !ua && !inIframe;
}
