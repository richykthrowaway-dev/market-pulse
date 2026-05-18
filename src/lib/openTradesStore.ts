import type { OpenTrade } from '@/hooks/useOpenTrades';

/** Parse the persisted open-trades payload. Always returns an array;
 *  malformed/missing input yields []. */
export function parseOpenTrades(raw: string | null): OpenTrade[] {
  try {
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
