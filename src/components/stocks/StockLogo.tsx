import { cn } from '@/lib/utils';
import { LogoImg, type LogoSize } from '@/components/ui/LogoImg';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

const sizeClasses: Record<LogoSize, string> = {
  xs: 'size-6 min-w-6 min-h-6',
  sm: 'size-8 min-w-8 min-h-8',
  md: 'size-11 min-w-11 min-h-11',
  lg: 'size-14 min-w-14 min-h-14',
};

const imgSizes: Record<LogoSize, string> = {
  xs: '24px',
  sm: '32px',
  md: '44px',
  lg: '56px',
};

interface StockLogoProps {
  ticker: string;
  name?: string;
  size?: LogoSize;
  className?: string;
  /** EODHD-style exchange code (e.g. 'V', 'TO', 'US', 'LSE'). */
  exchange?: string;
  /** ISO country code fallback when exchange is unknown. */
  country?: string;
  /** Explicit logo URL (e.g. from Finnhub profile). */
  logoUrl?: string;
}

// ─── Exchange → Logo.dev suffix mapping ──────────────────────────────
// Logo.dev uses the same suffix convention as Yahoo Finance.
// EODHD exchange codes are mapped here so every ticker is always
// exchange-qualified, preventing cross-exchange collisions
// (e.g. SCD on NASDAQ vs SCD on TSX-V).

const EXCHANGE_TO_SUFFIX: Record<string, string> = {
  // ── North America ──
  US:     '',        // US exchanges resolve without suffix
  NYSE:   '',
  NASDAQ: '',
  AMEX:   '',
  ARCA:   '',
  BATS:   '',
  CBOE:   '',
  PINK:   '',        // OTC / Pink sheets — treat as US for Logo.dev
  OTCBB:  '',        // OTC Bulletin Board
  TO:     'TO',      // TSX
  TSX:    'TO',      // TSX (alternate code)
  V:      'V',       // TSX Venture
  VENTURE:'V',       // TSX Venture (IBKR listing exchange code)
  TSXV:   'V',       // TSX Venture (alternate)
  CVE:    'V',       // TSX Venture (alternate)
  CN:     'CN',      // CSE
  NEO:    'NE',      // NEO Exchange

  // ── Europe ──
  LSE:    'L',       // London
  L:      'L',
  PA:     'PA',      // Euronext Paris
  AS:     'AS',      // Euronext Amsterdam
  BR:     'BR',      // Euronext Brussels
  LIS:    'LS',      // Euronext Lisbon
  F:      'F',       // Frankfurt
  XETRA:  'DE',      // XETRA
  MI:     'MI',      // Milan
  MC:     'MC',      // Madrid
  SW:     'SW',      // SIX Swiss
  ST:     'ST',      // Stockholm
  HE:     'HE',      // Helsinki
  CO:     'CO',      // Copenhagen
  OL:     'OL',      // Oslo
  VI:     'VI',      // Vienna
  WAR:    'WA',      // Warsaw
  IR:     'IR',      // Ireland

  // ── Asia-Pacific ──
  AU:     'AX',      // ASX
  HK:     'HK',      // Hong Kong
  SHG:    'SS',      // Shanghai
  SHE:    'SZ',      // Shenzhen
  TSE:    'T',       // Tokyo
  KO:     'KS',      // Korea KOSPI
  KQ:     'KQ',      // Korea KOSDAQ
  TA:     'TA',      // Tel Aviv
  NSE:    'NS',      // NSE India
  BSE:    'BO',      // BSE India
  SG:     'SI',      // Singapore
  KL:     'KL',      // Kuala Lumpur
  BK:     'BK',      // Bangkok
  JK:     'JK',      // Jakarta

  // ── Other ──
  SA:     'SA',      // São Paulo
  MX:     'MX',      // Mexico
  JSE:    'JO',      // Johannesburg
  NZ:     'NZ',      // New Zealand
};

/**
 * Country → primary exchange suffix fallback.
 * Used when no exchange code is available.
 */
const COUNTRY_EXCHANGE_SUFFIX: Record<string, string> = {
  CA: 'TO', AU: 'AX', GB: 'L', DE: 'F', FR: 'PA', JP: 'T',
  HK: 'HK', KR: 'KS', IN: 'NS', BR: 'SA', CH: 'SW',
  NL: 'AS', SE: 'ST', NO: 'OL', DK: 'CO', NZ: 'NZ',
  ZA: 'JO', IL: 'TA', MX: 'MX', AR: 'BA', CL: 'SN',
  TW: 'TW', SG: 'SI', IT: 'MI', ES: 'MC', BE: 'BR',
  AT: 'VI', FI: 'HE', PT: 'LS', IE: 'IR',
};

/**
 * Build the full exchange-qualified ticker for Logo.dev.
 *
 * Every ticker is qualified with its exchange suffix so that
 * Logo.dev returns the correct logo even when the same bare
 * ticker exists on multiple exchanges (e.g. SCD → NASDAQ vs SCD.V → TSX-V).
 *
 * US exchanges resolve without a suffix because Logo.dev defaults to US.
 *
 * Examples:
 *   buildQualifiedTicker("SCD", "V")       → "SCD.V"
 *   buildQualifiedTicker("AAPL", "US")      → "AAPL"
 *   buildQualifiedTicker("RY", "TO")        → "RY.TO"
 *   buildQualifiedTicker("SCD", "NASDAQ")   → "SCD"       (US default)
 *   buildQualifiedTicker("SCD.V")           → "SCD.V"     (already qualified)
 */
export function buildQualifiedTicker(
  ticker: string,
  exchange?: string,
  country?: string,
): string {
  const upper = ticker.toUpperCase();

  // If ticker already contains a dot (e.g. SCD.V), use as-is
  if (upper.includes('.')) return upper;

  // Map EODHD exchange code → Logo.dev suffix
  if (exchange) {
    const suffix = EXCHANGE_TO_SUFFIX[exchange.toUpperCase()];
    // suffix === '' means US exchange → no suffix needed
    if (suffix === '') return upper;
    // suffix is defined and non-empty → append
    if (suffix) return `${upper}.${suffix}`;
    // Unknown exchange code (e.g. a Conid number) → return bare ticker
    // Never append unrecognized codes — they produce garbage URLs like NFLX.15124833
    return upper;
  }

  // Fallback: infer from country
  if (country) {
    const suffix = COUNTRY_EXCHANGE_SUFFIX[country.toUpperCase()];
    if (suffix) return `${upper}.${suffix}`;
  }

  return upper;
}

export function StockLogo({
  ticker,
  name,
  size = 'sm',
  className,
  exchange,
  country,
  logoUrl,
}: StockLogoProps) {
  const [logoUrlFailed, setLogoUrlFailed] = useState(false);
  const altText = name
    ? `${name} (${ticker.toUpperCase()}) stock logo`
    : `${ticker.toUpperCase()} stock logo`;

  // If an explicit logoUrl is provided and hasn't failed, render it directly.
  // key=logoUrl resets logoUrlFailed state when the URL changes.
  if (logoUrl && !logoUrlFailed) {
    return (
      <span
        key={logoUrl}
        className={cn(
          sizeClasses[size],
          'inline-flex items-center justify-center rounded-lg shrink-0 overflow-hidden',
          className,
        )}
        role="img"
        aria-label={altText}
      >
        <img
          src={logoUrl}
          alt={altText}
          loading="lazy"
          decoding="async"
          sizes={imgSizes[size]}
          onError={() => setLogoUrlFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  }

  // Delegate to LogoImg with exchange-qualified ticker.
  // key= forces a full remount when the ticker changes so useState
  // inside LogoImg resets to the new ticker's URL instead of keeping
  // the previous stock's cached src.
  const qualifiedTicker = buildQualifiedTicker(ticker, exchange, country);
  return (
    <LogoImg
      key={qualifiedTicker}
      ticker={qualifiedTicker}
      size={size}
      alt={altText}
      className={className}
    />
  );
}
