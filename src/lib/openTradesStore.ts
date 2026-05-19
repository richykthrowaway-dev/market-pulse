import type { OpenTrade } from '@/hooks/useOpenTrades';
/** Parse the persisted open-trades payload. Malformed/missing → []. */
export function parseOpenTrades(raw: string | null): OpenTrade[] {
  try {
    const parsed = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
