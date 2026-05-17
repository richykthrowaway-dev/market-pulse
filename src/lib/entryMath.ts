type Side = 'long' | 'short';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stop a given % away from entry (below for long, above for short). */
export function stopFromPct(side: Side, entry: number, pct: number): number | null {
  if (entry <= 0) return null;
  const d = entry * (pct / 100);
  return round2(side === 'long' ? entry - d : entry + d);
}

/** Target at R multiples of the entry→stop risk distance. */
export function targetFromR(
  side: Side,
  entry: number,
  stop: number | undefined,
  rMult: number,
): number | null {
  if (entry <= 0 || stop == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return null;
  return round2(side === 'long' ? entry + rMult * risk : entry - rMult * risk);
}

/** Position size so that |entry-stop|*qty ≈ account*riskPct%. Floored. */
export function qtyFromRisk(
  entry: number,
  stop: number,
  account: number,
  riskPct: number,
): number {
  const perShare = Math.abs(entry - stop);
  if (entry <= 0 || account <= 0 || riskPct <= 0 || perShare <= 0) return 0;
  return Math.floor((account * (riskPct / 100)) / perShare);
}
