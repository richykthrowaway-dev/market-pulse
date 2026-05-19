import type { OpenTrade } from '@/hooks/useOpenTrades';

export interface AggregateRisk {
  totalRisk: number;
  pct: number | null;
  noStopCount: number;
  perPosition: { id: string; risk: number }[];
}

/** Total open risk = Σ |entry − stop| × qty over positions WITH a stop.
 *  Positions without a finite stop contribute 0 and bump noStopCount. */
export function aggregateRisk(open: OpenTrade[], account?: number): AggregateRisk {
  let totalRisk = 0;
  let noStopCount = 0;
  const perPosition: { id: string; risk: number }[] = [];
  for (const o of open) {
    const hasStop = typeof o.stopLoss === 'number' && Number.isFinite(o.stopLoss);
    const risk = hasStop ? Math.abs(o.entryPrice - (o.stopLoss as number)) * o.quantity : 0;
    if (!hasStop) noStopCount++;
    totalRisk += risk;
    perPosition.push({ id: o.id, risk });
  }
  const pct = account && account > 0 ? (totalRisk / account) * 100 : (account === undefined ? null : 0);
  return { totalRisk, pct, noStopCount, perPosition };
}
