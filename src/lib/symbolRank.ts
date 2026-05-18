import type { SymbolSearchResult } from '@/services/symbolsService';

/**
 * Relevance tier (lower = better):
 *  0 exact ticker · 1 ticker-prefix · 2 name-prefix · 3 ticker-contains
 *  4 name-contains · 5 no direct match (kept, deprioritised).
 */
function tier(q: string, t: string, n: string): number {
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (n.startsWith(q)) return 2;
  if (t.includes(q)) return 3;
  if (n.includes(q)) return 4;
  return 5;
}

/**
 * Sort symbol-search rows by query relevance so an exact ticker match wins.
 * Pure: returns a new array, never mutates input. Stable tiebreak:
 * shorter ticker first, then alphabetical ticker.
 */
export function rankSymbols(
  query: string,
  rows: SymbolSearchResult[],
): SymbolSearchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [...rows];
  return [...rows].sort((a, b) => {
    const ta = (a.canonicalTicker ?? '').toUpperCase();
    const tb = (b.canonicalTicker ?? '').toUpperCase();
    const sa = tier(q, ta, (a.name ?? '').toUpperCase());
    const sb = tier(q, tb, (b.name ?? '').toUpperCase());
    if (sa !== sb) return sa - sb;
    if (ta.length !== tb.length) return ta.length - tb.length;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}
