export interface StockLike {
  symbol: string;
  changePercent?: number;
}

export interface DisplayStocks<T> {
  list: T[];
  source: 'watchlist' | 'movers';
}

/**
 * Resolve the dashboard list: the user's watchlist symbols mapped onto the
 * loaded stocks (case-insensitive, watchlist order, unknown symbols dropped).
 * If nothing resolves, fall back to top movers by |changePercent|.
 * Pure, total, never throws.
 */
export function resolveDisplayStocks<T extends StockLike>(
  stocks: T[],
  watchlistSymbols: string[],
  limit = 10,
): DisplayStocks<T> {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(watchlistSymbols) ? watchlistSymbols : [];

  const bySym = new Map<string, T>();
  for (const s of all) {
    if (s && typeof s.symbol === 'string') {
      const k = s.symbol.trim().toUpperCase();
      if (k && !bySym.has(k)) bySym.set(k, s);
    }
  }

  const watch: T[] = [];
  for (const raw of wl) {
    if (typeof raw !== 'string') continue;
    const hit = bySym.get(raw.trim().toUpperCase());
    if (hit && !watch.includes(hit)) watch.push(hit);
    if (watch.length >= limit) break;
  }
  if (watch.length > 0) return { list: watch, source: 'watchlist' };

  const movers = [...all]
    .filter((s): s is T => !!s && typeof s.symbol === 'string')
    .sort(
      (a, b) =>
        Math.abs(Number(b.changePercent) || 0) - Math.abs(Number(a.changePercent) || 0),
    )
    .slice(0, limit);
  return { list: movers, source: 'movers' };
}
