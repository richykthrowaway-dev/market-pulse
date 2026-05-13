// src/components/calculators/calcUtils.ts

export const fmtDollar = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

export const fmtCompact = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    notation: 'compact', maximumFractionDigits: 2,
  }).format(n);

export const yFmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v.toFixed(0)}`;

export const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Year-by-year portfolio growth. netPct already has fee deducted. */
export function growSeries(initial: number, contrib: number, netPct: number, years: number): number[] {
  const rate = netPct / 100;
  const vals = [initial];
  for (let y = 1; y <= years; y++) vals.push(vals[y - 1] * (1 + rate) + contrib);
  return vals;
}
