/**
 * Largest absolute day movers across all loaded stocks (market-wide).
 * Distinct by symbol, sorted by |changePercent| desc (stable). Pure.
 */
export function topMovers<T extends { symbol: string; changePercent?: number }>(
  stocks: T[],
  n = 3,
): T[] {
  const all = Array.isArray(stocks) ? stocks : [];
  const seen = new Set<string>();
  const rows: { row: T; abs: number }[] = [];
  for (const s of all) {
    if (!s || typeof s.symbol !== 'string') continue;
    const cp = Number(s.changePercent);
    if (!Number.isFinite(cp)) continue;
    const k = s.symbol.trim().toUpperCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    rows.push({ row: s, abs: Math.abs(cp) });
  }
  return rows
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => b.abs - a.abs || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map((r) => r.row);
}
