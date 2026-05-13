import React, { useEffect, useRef, useState } from 'react';
import { useMobilePreviewFrame } from '@/hooks/useIsMobile';

interface MobilePreviewFrameProps {
  children: React.ReactNode;
}

// iPhone 15 Pro logical dimensions (CSS points)
const SCREEN_W      = 393;
const SCREEN_H      = 852;
const SAFE_TOP      = 59;   // status bar / Dynamic Island area
const SAFE_BOTTOM   = 34;   // home indicator area
const CONTENT_H     = SCREEN_H - SAFE_TOP - SAFE_BOTTOM; // 759 — actual web content area
const BEZEL         = 12;
const CORNER        = 55;
const ISLAND_W      = 126;
const ISLAND_H      = 37;
const ISLAND_TOP    = 11;

// User-agent string that `navigator.userAgent` reports inside the iframe — this
// is what an actual iPhone 15 Pro running Safari sends. Used by libraries that
// branch on UA string detection.
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Patches the iframe's window environment so the React app inside renders
 * exactly as it would on a real iPhone 15 Pro / Safari, even though we're
 * running on a desktop browser. Applied after the iframe loads.
 *
 * What gets faked:
 *   - matchMedia('(hover: hover)')  → false   (no mouse hover capability)
 *   - matchMedia('(hover: none)')   → true
 *   - matchMedia('(pointer: fine)') → false   (no precise pointer)
 *   - matchMedia('(pointer: coarse)') → true  (finger-sized targets)
 *   - navigator.maxTouchPoints → 5            (multi-touch)
 *   - navigator.userAgent → iPhone Safari UA
 *
 * Why this matters: Tailwind wraps `hover:` styles in `@media (hover: hover)`,
 * so without this patch a desktop mouse would trigger hover effects that
 * a phone never would. Same for any libraries doing pointer-type checks.
 */
function patchIframeWindow(win: Window) {
  try {
    // matchMedia — intercept hover/pointer queries
    const origMM = win.matchMedia.bind(win);
    Object.defineProperty(win, 'matchMedia', {
      configurable: true,
      value: (q: string) => {
        const mql = origMM(q);
        const override = (val: boolean) => ({
          ...mql,
          matches: val,
          media:   q,
          onchange: null,
          addListener:    () => {}, addEventListener:    () => {},
          removeListener: () => {}, removeEventListener: () => {},
          dispatchEvent:  () => false,
        });
        if (/\(hover:\s*hover\)/.test(q))   return override(false);
        if (/\(hover:\s*none\)/.test(q))    return override(true);
        if (/\(pointer:\s*fine\)/.test(q))  return override(false);
        if (/\(pointer:\s*coarse\)/.test(q))return override(true);
        if (/\(any-hover:\s*hover\)/.test(q))    return override(false);
        if (/\(any-pointer:\s*fine\)/.test(q))   return override(false);
        if (/\(any-pointer:\s*coarse\)/.test(q)) return override(true);
        return mql;
      },
    });

    // navigator — touch + iOS UA
    Object.defineProperty(win.navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
    Object.defineProperty(win.navigator, 'userAgent',      { configurable: true, get: () => IPHONE_UA });
    Object.defineProperty(win.navigator, 'platform',       { configurable: true, get: () => 'iPhone' });
    Object.defineProperty(win.navigator, 'vendor',         { configurable: true, get: () => 'Apple Computer, Inc.' });
  } catch {
    /* some props may already be frozen — best-effort */
  }
}

/**
 * Inject CSS into the iframe document for mobile-native scroll/tap behaviour.
 *   - No visible scrollbars (mobile uses overlay scrollbars that auto-fade)
 *   - Transparent tap-highlight (-webkit-tap-highlight-color)
 *   - Momentum scrolling on iOS Safari
 *   - Disable user-select on chrome (matches mobile default)
 *   - Disable pull-to-refresh / overscroll bounce
 */
function injectIframeStyles(doc: Document) {
  if (doc.getElementById('mobile-preview-emulation')) return;
  const style = doc.createElement('style');
  style.id = 'mobile-preview-emulation';
  style.textContent = `
    /* Hide all scrollbars (mobile uses overlay scrollbars) */
    *::-webkit-scrollbar { display: none; width: 0; height: 0; }
    * { scrollbar-width: none; -ms-overflow-style: none; }

    /* iOS-style momentum scrolling */
    html, body, * { -webkit-overflow-scrolling: touch; }

    /* No tap highlight (transparent, matching modern iOS Safari) */
    * { -webkit-tap-highlight-color: transparent; }

    /* Disable text-selection on chrome by default (inputs/textarea opt in) */
    *:not(input):not(textarea):not([contenteditable]):not(p):not(span):not(h1):not(h2):not(h3):not(h4):not(h5):not(h6) {
      -webkit-user-select: none;
      user-select: none;
    }

    /* Contain overscroll (no pull-to-refresh bounce on the document) */
    html, body { overscroll-behavior: contain; touch-action: manipulation; }

    /* Match Safari's default 16px text size to avoid auto-zoom on inputs */
    input, select, textarea { font-size: 16px; }
  `;
  doc.head.appendChild(style);
}

export function MobilePreviewFrame({ children }: MobilePreviewFrameProps) {
  const framed = useMobilePreviewFrame();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Track parent URL so the iframe reloads when the user navigates outside it.
  const [parentUrl, setParentUrl] = useState<string>('');
  useEffect(() => {
    if (!framed) return;
    const sync = () => setParentUrl(window.location.pathname + window.location.search + window.location.hash);
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [framed]);

  // Patch the iframe BEFORE React inside it boots. Loading happens fast on
  // same-origin so we attach listeners that fire on every load.
  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const win = iframe.contentWindow as Window | null;
    const doc = iframe.contentDocument;
    if (!win || !doc) return;
    patchIframeWindow(win);
    injectIframeStyles(doc);
  };

  // Run the patch as early as possible — for same-origin iframes the
  // contentWindow becomes available synchronously when the element is
  // inserted, so we patch on mount in addition to onload. This catches
  // initial app boot (React reading matchMedia/navigator at startup).
  useEffect(() => {
    if (!framed) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Try patching immediately and again after load to be safe.
    const tryPatch = () => {
      const win = iframe.contentWindow as Window | null;
      const doc = iframe.contentDocument;
      if (win) patchIframeWindow(win);
      if (doc) injectIframeStyles(doc);
    };
    tryPatch();
    iframe.addEventListener('load', tryPatch);
    return () => iframe.removeEventListener('load', tryPatch);
  }, [framed, parentUrl]);

  if (!framed) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-neutral-900/95 flex items-center justify-center overflow-auto p-4 z-[1000]">
      {/* Titanium bezel */}
      <div
        className="relative shadow-2xl"
        style={{
          width:        SCREEN_W + BEZEL * 2,
          height:       SCREEN_H + BEZEL * 2,
          padding:      BEZEL,
          borderRadius: CORNER + BEZEL,
          background:   'linear-gradient(145deg, #4a4a4a 0%, #2a2a2a 50%, #555 100%)',
          boxShadow:    '0 30px 60px -15px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Black screen background — visible behind status bar / home indicator */}
        <div
          className="relative bg-black overflow-hidden"
          style={{
            width:        SCREEN_W,
            height:       SCREEN_H,
            borderRadius: CORNER,
          }}
        >
          {/* iframe occupies ONLY the safe content area (393 × 759), positioned
              below the Dynamic Island and above the home indicator. This is
              what a non-edge-to-edge web app actually gets as its viewport. */}
          <iframe
            ref={iframeRef}
            title="iPhone 15 Pro preview"
            src={parentUrl || '/'}
            onLoad={handleIframeLoad}
            style={{
              position: 'absolute',
              top:    SAFE_TOP,
              left:   0,
              width:  SCREEN_W,
              height: CONTENT_H,
              border: 'none',
              display: 'block',
              colorScheme: 'normal',
            }}
          />

          {/* Status bar — time, signal, battery (cosmetic). Sits ABOVE the
              iframe so it always shows, just like the real device. */}
          <StatusBar />

          {/* Dynamic Island — drawn over the status bar */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 bg-black pointer-events-none"
            style={{
              top:          ISLAND_TOP,
              width:        ISLAND_W,
              height:       ISLAND_H,
              borderRadius: ISLAND_H / 2,
              zIndex:       9999,
            }}
          />

          {/* Home indicator — bottom 34px area, white pill centered */}
          <div
            aria-hidden
            className="absolute left-0 right-0 bottom-0 flex items-end justify-center pb-2 pointer-events-none"
            style={{ height: SAFE_BOTTOM }}
          >
            <div className="w-32 h-1 rounded-full bg-white/85" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cosmetic iOS status bar — time on left, wifi/signal/battery on right. */
function StatusBar() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 top-0 flex items-center justify-between text-white text-[15px] font-semibold pointer-events-none select-none"
      style={{
        height:      SAFE_TOP,
        paddingLeft:  28,
        paddingRight: 28,
        paddingTop:   14,
        fontFeatureSettings: '"tnum"',
        zIndex: 9998,
      }}
    >
      <span>{time}</span>
      <span style={{ width: ISLAND_W }} /> {/* spacer for Dynamic Island */}
      <span className="flex items-center gap-1.5">
        {/* Signal bars */}
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor">
          <rect x="0"  y="7" width="3" height="4" rx="1" />
          <rect x="5"  y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        {/* Wifi */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <path d="M8.5 2C5.5 2 2.8 3.1 0.8 5L2.2 6.4C3.9 4.9 6.1 4 8.5 4S13.1 4.9 14.8 6.4L16.2 5C14.2 3.1 11.5 2 8.5 2Z" />
          <path d="M8.5 6C6.7 6 5.1 6.7 4 7.9L5.4 9.3C6.2 8.5 7.3 8 8.5 8S10.8 8.5 11.6 9.3L13 7.9C11.9 6.7 10.3 6 8.5 6Z" />
          <circle cx="8.5" cy="10.5" r="1.5" />
        </svg>
        {/* Battery */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3" stroke="currentColor" strokeOpacity="0.5" />
          <rect x="2" y="2" width="20" height="9" rx="1.5" fill="currentColor" />
          <rect x="24" y="4" width="2" height="5" rx="1" fill="currentColor" fillOpacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

function formatTime(d: Date): string {
  // 12-hour clock without leading zero, no AM/PM (matches iOS status bar)
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
