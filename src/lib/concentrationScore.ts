/**
 * Herfindahl-style concentration of a watchlist's sector mix.
 * Input: the `sectorExposure` slices (`{ pct }`). Score 0..100
 * (100 = everything in one sector). Pure, never throws.
 */
export function concentrationScore(
  slices: { pct: number }[],
): { score: number; label: string } {
  const arr = Array.isArray(slices) ? slices : [];
  if (arr.length === 0) return { score: 0, label: '—' };
  let sum = 0;
  for (const s of arr) {
    const p = Number(s?.pct) || 0;
    sum += (p / 100) ** 2;
  }
  const score = Math.round(sum * 100);
  const label = score >= 50 ? 'Concentrated' : score >= 30 ? 'Moderate' : 'Diversified';
  return { score, label };
}
