import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLogoWithFallback } from '@/hooks/useLogoWithFallback';

/**
 * Logo.dev publishable API key.
 * Safe to store client-side — it is a publishable token scoped to logo fetches.
 */
const LOGO_DEV_KEY = 'pk_BqdklI3wRoaiZF-VoNfm0w';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClasses: Record<LogoSize, string> = {
  xs: 'size-6 min-w-6 min-h-6',
  sm: 'size-8 min-w-8 min-h-8',
  md: 'size-11 min-w-11 min-h-11',
  lg: 'size-14 min-w-14 min-h-14',
};

const iconSizeClasses: Record<LogoSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
};

const imgSizes: Record<LogoSize, string> = {
  xs: '24px',
  sm: '32px',
  md: '44px',
  lg: '56px',
};

/** Stages in the logo fallback cascade. */
type LogoStage = 'logodev' | 'nvstly' | 'eodhd' | 'finnhub' | 'failed';

interface LogoImgProps {
  /** Exchange-qualified ticker, e.g. "SCD.V", "AAPL", "RY.TO" */
  ticker: string;
  size?: LogoSize;
  alt?: string;
  className?: string;
}

/**
 * Build the Logo.dev ticker URL for a given symbol.
 *
 * Params:
 *  - retina=true  → high-DPI 2× image
 *  - theme=auto   → automatically matches the site's light/dark mode
 *  - fallback=monogram → shows a text monogram when no logo exists
 */
export function getLogoDevUrl(ticker: string): string {
  return `https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=${LOGO_DEV_KEY}&retina=true&theme=auto&fallback=monogram`;
}

/**
 * Build the nvstly/icons CDN URL for a given ticker.
 *
 * nvstly hosts ~500 popular US stock logos as transparent PNGs on jsDelivr.
 * Icons are white-on-transparent, optimised for dark interfaces. In light
 * mode apply `invert` to flip them dark; in dark mode show as-is.
 *
 * jsDelivr provides proper CDN edge-caching (unlike raw.githubusercontent.com).
 * URL format: https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/{TICKER}.png
 *
 * Exchange suffix is stripped — nvstly uses bare symbols only:
 *   "AAPL.US" → AAPL.png
 *   "RY.TO"   → RY.png  (likely 404 — nvstly is US-focused; cascade continues)
 */
export function getNvstlyLogoUrl(ticker: string): string {
  const upper = ticker.toUpperCase();
  const baseTicker = upper.includes('.') ? upper.slice(0, upper.lastIndexOf('.')) : upper;
  return `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${baseTicker}.png`;
}

/**
 * Build the EODHD logo API URL for a given ticker.
 *
 * EODHD serves 40,000+ company logos via their logo API endpoint.
 * The `demo` token is EODHD's public key for logo fetches — safe to use
 * client-side since it only grants access to logo images, not financial data.
 * Logos are ~3–5 KB PNGs with transparent backgrounds.
 *
 * URL format: https://eodhd.com/api/logo/{TICKER}.{EXCHANGE}?api_token=demo
 *
 * Ticker format maps directly from our exchange-qualified tickers:
 *   "AAPL"    → AAPL.US   (no suffix = US market)
 *   "RY.TO"   → RY.TO     (Toronto Stock Exchange)
 *   "SCD.V"   → SCD.V     (TSX Venture Exchange)
 *   "BARC.L"  → BARC.L    (London Stock Exchange)
 *   "BHP.AU"  → BHP.AU    (Australian Securities Exchange)
 */
export function getEodhdLogoUrl(ticker: string): string {
  const upper = ticker.toUpperCase();
  // Add .US suffix for bare tickers (no exchange qualifier)
  const eodhdTicker = upper.includes('.') ? upper : `${upper}.US`;
  return `https://eodhd.com/api/logo/${eodhdTicker}?api_token=demo`;
}

/**
 * Reusable logo component with 3-source fallback cascade.
 *
 * Load chain:
 * 1. logo.dev    — fast, covers ~95% of US stocks; auto light/dark mode
 * 2. EODHD       — free static CDN, 40k+ tickers across 60+ global exchanges,
 *                  no API key or credits needed, resolves instantly
 * 3. Finnhub     — serialised queue (500 ms between calls) via edge function;
 *                  last resort for tickers missed by both sources above
 * 4. Building2 icon — all sources exhausted
 *
 * EODHD and Finnhub PNGs have white backgrounds and get a white wrapper span
 * so they render correctly in dark mode.
 */
export function LogoImg({ ticker, size = 'sm', alt, className }: LogoImgProps) {
  const [stage, setStage] = useState<LogoStage>('logodev');

  const { fallbackUrl } = useLogoWithFallback(ticker);

  // Reset stage when ticker changes
  useEffect(() => {
    setStage('logodev');
  }, [ticker]);

  // When Finnhub URL arrives and we're already past EODHD, flip to finnhub
  useEffect(() => {
    if (fallbackUrl && stage === 'finnhub') {
      // already set — nothing to do, src is derived below
    }
    // If we hit EODHD failure before Finnhub arrived, retry now that it's here
    if (fallbackUrl && stage === 'failed') {
      // edge case: EODHD failed but Finnhub just arrived — show it
      setStage('finnhub');
    }
  }, [fallbackUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const altText = alt || `${ticker.toUpperCase()} logo`;

  const handleImgError = () => {
    if (stage === 'logodev') {
      setStage('nvstly');
    } else if (stage === 'nvstly') {
      setStage('eodhd');
    } else if (stage === 'eodhd') {
      if (fallbackUrl) {
        setStage('finnhub');
      } else {
        // Finnhub URL not yet fetched — mark as failed for now;
        // the useEffect above will flip to 'finnhub' once it arrives.
        setStage('failed');
      }
    } else {
      // Finnhub also failed — give up
      setStage('failed');
    }
  };

  // ── Derive current src ──────────────────────────────────────────────────────
  let logoSrc: string | null = null;
  if (stage === 'logodev') logoSrc = getLogoDevUrl(ticker);
  if (stage === 'nvstly')  logoSrc = getNvstlyLogoUrl(ticker);
  if (stage === 'eodhd')   logoSrc = getEodhdLogoUrl(ticker);
  if (stage === 'finnhub') logoSrc = fallbackUrl ?? null;

  if (stage === 'failed' || (stage === 'finnhub' && !logoSrc)) {
    return (
      <span
        className={cn(
          sizeClasses[size],
          'inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0',
          className
        )}
        role="img"
        aria-label={altText}
      >
        <Building2 className={iconSizeClasses[size]} />
      </span>
    );
  }

  // ── Per-source rendering treatment ─────────────────────────────────────────
  //
  // logo.dev   – native theme=auto, no treatment needed
  //
  // nvstly     – white-on-transparent PNGs optimised for dark interfaces.
  //              Light mode: `invert` flips white → black so logos are visible.
  //              Dark mode:  `invert-0` shows them as-is (white on dark = ✓).
  //
  // EODHD      – coloured-on-transparent PNGs. Works natively on both modes.
  //              `mix-blend-multiply` in light mode removes any residual white;
  //              `mix-blend-normal` in dark mode — transparent bg just works.
  //
  // Finnhub    – white-background PNGs. Wrap with white container so they look
  //              correct on dark backgrounds too.
  //
  const isFinnhub = stage === 'finnhub';
  const isNvstly  = stage === 'nvstly';
  const isEodhd   = stage === 'eodhd';

  return (
    <span
      className={cn(
        sizeClasses[size],
        isFinnhub
          ? 'inline-flex items-center justify-center rounded-lg bg-white dark:bg-white/90 shrink-0 overflow-hidden'
          : 'inline-flex items-center justify-center rounded-lg shrink-0 overflow-hidden',
        className
      )}
      role="img"
      aria-label={altText}
    >
      <img
        src={logoSrc!}
        alt={altText}
        loading="lazy"
        decoding="async"
        sizes={imgSizes[size]}
        onError={handleImgError}
        className={cn(
          'h-full w-full object-contain p-1',
          isNvstly && 'invert dark:invert-0',
          isEodhd  && 'mix-blend-multiply dark:mix-blend-normal',
        )}
      />
    </span>
  );
}
