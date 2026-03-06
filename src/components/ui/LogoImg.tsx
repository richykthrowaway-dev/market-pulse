import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 * Reusable logo component powered by Logo.dev.
 * Renders a retina-quality logo with monogram fallback,
 * automatic light/dark theme, lazy loading, and a Building2 icon
 * fallback if the image fails entirely.
 */
export function LogoImg({ ticker, size = 'sm', alt, className }: LogoImgProps) {
  const [failed, setFailed] = useState(false);
  const url = getLogoDevUrl(ticker);
  const altText = alt || `${ticker.toUpperCase()} logo`;

  if (failed) {
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

  return (
    <span
      className={cn(
        sizeClasses[size],
        'inline-flex items-center justify-center rounded-lg bg-muted ring-1 ring-border shrink-0 overflow-hidden',
        className
      )}
      role="img"
      aria-label={altText}
    >
      <img
        src={url}
        alt={altText}
        loading="lazy"
        decoding="async"
        sizes={imgSizes[size]}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}
