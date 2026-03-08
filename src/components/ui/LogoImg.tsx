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
 *
 * Supports exchange-qualified tickers like SCD.V or RY.TO.
 */
export function getLogoDevUrl(ticker: string): string {
  return `https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=${LOGO_DEV_KEY}&retina=true&theme=auto&fallback=monogram`;
}

/**
 * Reusable logo component with multi-source fallback.
 *
 * Load chain:
 * 1. logo.dev (primary — fast, covers 95% of stocks)
 * 2. Finnhub (fallback — for lesser-known stocks)
 * 3. Building2 icon (last resort)
 *
 * Fetches Finnhub logos in the background to cache for future visits.
 */
export function LogoImg({ ticker, size = 'sm', alt, className }: LogoImgProps) {
  const [failed, setFailed] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string>(getLogoDevUrl(ticker));

  const { handleLogoDevLoad, handleLogoDevError, fallbackUrl } = useLogoWithFallback(ticker);

  const altText = alt || `${ticker.toUpperCase()} logo`;

  // Only swap to Finnhub when Logo.dev actually failed — not just because Finnhub responded
  useEffect(() => {
    if (fallbackUrl && failed) {
      setLogoSrc(fallbackUrl);
      setFailed(false);
    }
  }, [fallbackUrl, failed]);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Notify the hook that logo.dev loaded (might queue Finnhub fetch)
    handleLogoDevLoad(e);
  };

  const handleImgError = () => {
    // If logo.dev fails, try Finnhub
    handleLogoDevError();
    setFailed(true);
  };

  if (failed && !fallbackUrl) {
    // All sources exhausted — show Building icon
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

  // Detect if the current src is a Finnhub PNG (has white background)
  const isFinnhubPng = logoSrc.includes('finnhub.io');

  return (
    <span
      className={cn(
        sizeClasses[size],
        // Use white background for Finnhub PNGs so they look correct in dark mode
        isFinnhubPng
          ? 'inline-flex items-center justify-center rounded-lg bg-white dark:bg-white/90 shrink-0 overflow-hidden'
          : 'inline-flex items-center justify-center rounded-lg shrink-0 overflow-hidden',
        className
      )}
      role="img"
      aria-label={altText}
    >
      <img
        src={logoSrc}
        alt={altText}
        loading="lazy"
        decoding="async"
        sizes={imgSizes[size]}
        onLoad={handleImgLoad}
        onError={handleImgError}
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}
