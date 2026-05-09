import { useState } from 'react';
import { Flag } from '@/components/ui/Flag';

/**
 * CurrencyIcon — dark-mode currency icon with country-flag fallback.
 *
 * Load chain:
 *  1. nvstly/icons forex_icons via jsDelivr CDN
 *     - White-on-transparent PNGs, optimised for dark interfaces
 *     - `invert dark:invert-0` makes them dark in light mode, white in dark mode
 *     - Covers: USD EUR GBP JPY CAD AUD CHF NZD SGD HKD NOK SEK DKK
 *               PLN RUB TRY HUF MXN ZAR JMD XAU XAG (23 currencies)
 *  2. flagcdn.com country flag (Flag component)
 *     - Colourful, geographically recognisable
 *     - Covers everything nvstly misses (CNY, KRW, INR, BRL, etc.)
 *
 * Drop-in replacement for <Flag> — identical props API.
 */

const NVSTLY_FOREX_BASE = 'https://cdn.jsdelivr.net/gh/nvstly/icons@main/forex_icons';

function getNvstlyForexUrl(code: string): string {
  return `${NVSTLY_FOREX_BASE}/${code.toUpperCase()}.png`;
}

interface CurrencyIconProps {
  /** ISO 4217 currency code, e.g. "USD", "EUR", "JPY" */
  code: string;
  size?: number;
  className?: string;
}

export function CurrencyIcon({ code, size = 28, className }: CurrencyIconProps) {
  const [nvstlyFailed, setNvstlyFailed] = useState(false);

  if (nvstlyFailed) {
    // nvstly doesn't have this currency — fall through to country flag
    return <Flag code={code} size={size} className={className} />;
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src={getNvstlyForexUrl(code)}
        alt={code}
        loading="lazy"
        decoding="async"
        onError={() => setNvstlyFailed(true)}
        // invert: flips white→dark in light mode so icons are visible
        // dark:invert-0: reverts to original white-on-transparent in dark mode
        className="h-full w-full object-contain invert dark:invert-0"
        style={{ padding: 2 }}
      />
    </div>
  );
}
