import { getStaticSector } from './sectorMap';

export interface SectorSlice {
  sector: string;
  count: number;
  pct: number;
}

/**
 * Sector breakdown of the resolved watchlist. Sector resolver is injectable
 * (defaults to the static GICS map); misses bucket into 'Unknown'.
 * Pure, never throws.
 */
export function sectorExposure(
  stocks: { symbol: string }[],
  symbols: string[],
  resolver: (sym: string) => string | null = getStaticSector,
): SectorSlice[] {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(symbols) ? symbols : [];
  const want = new Set(
    wl.filter((s) => typeof s === 'string').map((s) => s.trim().toUpperCase()),
  );
  const present: string[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (!s || typeof s.symbol !== 'string') continue;
    const k = s.symbol.trim().toUpperCase();
    if (!want.has(k) || seen.has(k)) continue;
    seen.add(k);
    present.push(s.symbol);
  }
  if (present.length === 0) return [];
  const counts = new Map<string, number>();
  for (const sym of present) {
    const sec = resolver(sym) || 'Unknown';
    counts.set(sec, (counts.get(sec) ?? 0) + 1);
  }
  const total = present.length;
  return [...counts.entries()]
    .map(([sector, count]) => ({
      sector,
      count,
      pct: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.pct - a.pct);
}
