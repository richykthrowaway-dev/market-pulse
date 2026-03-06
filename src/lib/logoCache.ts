/**
 * Logo Cache — in-memory + sessionStorage layer for remote stock logos.
 * Simplified for Logo.dev as the sole logo source.
 */

import { getLogoDevUrl } from '@/components/ui/LogoImg';

const STORAGE_KEY = 'logo-cache-v1';
type CacheEntry = 'ok' | 'fail';

const memoryCache = new Map<string, CacheEntry>();

function hydrate() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: Record<string, CacheEntry> = JSON.parse(raw);
    for (const [key, val] of Object.entries(parsed)) {
      memoryCache.set(key, val);
    }
  } catch { /* ignore */ }
}

hydrate();

function persist() {
  try {
    const obj: Record<string, CacheEntry> = {};
    memoryCache.forEach((v, k) => { obj[k] = v; });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* storage full */ }
}

export function getCachedStatus(url: string): CacheEntry | undefined {
  return memoryCache.get(url);
}

export function markLoaded(url: string) {
  if (memoryCache.get(url) !== 'ok') {
    memoryCache.set(url, 'ok');
    persist();
  }
}

export function markFailed(url: string) {
  if (memoryCache.get(url) !== 'fail') {
    memoryCache.set(url, 'fail');
    persist();
  }
}

const prefetchedUrls = new Set<string>();

export function prefetchLogos(urls: string[]) {
  if (typeof document === 'undefined') return;
  for (const url of urls) {
    if (prefetchedUrls.has(url)) continue;
    if (getCachedStatus(url) === 'fail') continue;
    prefetchedUrls.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }
}

/** Re-export for convenience. */
export { getLogoDevUrl };
