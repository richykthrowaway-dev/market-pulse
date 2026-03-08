import { useState, useEffect } from 'react';
import { requestLogoUrl, getLogoCache } from '@/services/logoService';

/**
 * Hook: useLogoWithFallback
 *
 * Returns the best available logo URL for a ticker:
 * 1. Instantly from localStorage cache (if previously fetched).
 * 2. From a serial Finnhub queue (avoids rate limiting by processing
 *    one request every 500 ms).
 *
 * The returned `fallbackUrl` is used by LogoImg to replace the
 * logo.dev monogram once a real logo is available.
 */
export function useLogoWithFallback(ticker: string) {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(() => {
    // Synchronous cache read — shows cached logo instantly on first render
    const cached = getLogoCache()[ticker];
    return cached?.url || null;
  });

  useEffect(() => {
    let cancelled = false;

    // Re-check cache synchronously in case ticker changed
    const cached = getLogoCache()[ticker];
    if (cached !== undefined) {
      setFallbackUrl(cached.url || null);
      return;
    }

    // Enqueue a serial Finnhub fetch
    requestLogoUrl(ticker, (url) => {
      if (!cancelled) setFallbackUrl(url);
    });

    return () => { cancelled = true; };
  }, [ticker]);

  // Kept for LogoImg compatibility (no-ops now — queue fires on mount)
  const handleLogoDevLoad = (_e: React.SyntheticEvent<HTMLImageElement>) => {};
  const handleLogoDevError = () => {};

  return { handleLogoDevLoad, handleLogoDevError, fallbackUrl, isLoading: false };
}
