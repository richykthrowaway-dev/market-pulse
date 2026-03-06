import { useEffect } from 'react';
import { getLogoDevUrl, prefetchLogos } from '@/lib/logoCache';

/**
 * Prefetches Logo.dev logos for all tickers once the
 * stock list is available.
 */
export function useLogoPrefetch(tickers: string[]) {
  useEffect(() => {
    if (tickers.length === 0) return;
    const urls = tickers.map((t) => getLogoDevUrl(t.toUpperCase()));
    if (urls.length > 0) {
      prefetchLogos(urls);
    }
  }, [tickers]);
}
