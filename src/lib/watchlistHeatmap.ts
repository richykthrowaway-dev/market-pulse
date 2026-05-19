export interface HeatCell {
  symbol: string;
  name: string;
  changePercent: number;
  intensity: number; // 0..4
}

/**
 * Resolve watchlist symbols (case-insensitive) against loaded stocks and
 * return heatmap cells sorted by day change descending. Pure, never throws.
 */
export function watchlistHeatmap(
  stocks: { symbol: string; name?: string; changePercent?: number }[],
  symbols: string[],
): HeatCell[] {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(symbols) ? symbols : [];
  const want = new Set(
    wl.filter((s) => typeof s === 'string').map((s) => s.trim().toUpperCase()),
  );
  const cells: HeatCell[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (!s || typeof s.symbol !== 'string') continue;
    const k = s.symbol.trim().toUpperCase();
    if (!want.has(k) || seen.has(k)) continue;
    seen.add(k);
    const cp = Number(s.changePercent) || 0;
    cells.push({
      symbol: s.symbol,
      name: String(s.name ?? s.symbol),
      changePercent: cp,
      intensity: Math.min(4, Math.floor(Math.abs(cp) / 2)),
    });
  }
  return cells.sort((a, b) => b.changePercent - a.changePercent);
}
