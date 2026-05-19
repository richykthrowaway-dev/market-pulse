/**
 * Fractional position (0..1) of `price` within the 52-week [low, high] band.
 * null when inputs are non-finite or the band is degenerate. Pure, total.
 */
export function weekRangePosition(low: number, high: number, price: number): number | null {
  if (![low, high, price].every((n) => Number.isFinite(n))) return null;
  if (high <= low) return null;
  const f = (price - low) / (high - low);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}
