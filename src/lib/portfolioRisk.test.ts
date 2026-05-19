import { describe, it, expect } from 'vitest';
import { aggregateRisk } from './portfolioRisk';
import type { OpenTrade } from '@/hooks/useOpenTrades';

const t = (o: Partial<OpenTrade>): OpenTrade => ({
  id: 'x', symbol: 'X', side: 'long', quantity: 1, entryPrice: 100,
  entryDate: '2026-05-15', planValid: true, ...o,
});

describe('aggregateRisk', () => {
  it('sums |entry-stop|*qty; pct vs account; perPosition', () => {
    const r = aggregateRisk(
      [t({ id: 'a', entryPrice: 100, stopLoss: 95, quantity: 10 }),
       t({ id: 'b', side: 'short', entryPrice: 50, stopLoss: 55, quantity: 4 })],
      10000,
    );
    expect(r.totalRisk).toBe(70);
    expect(r.pct).toBeCloseTo(0.7);
    expect(r.noStopCount).toBe(0);
    expect(r.perPosition).toEqual([{ id: 'a', risk: 50 }, { id: 'b', risk: 20 }]);
  });
  it('no-stop positions contribute 0 and are counted; null pct without account', () => {
    const r = aggregateRisk([t({ id: 'a', stopLoss: 95, quantity: 2 }), t({ id: 'c' })]);
    expect(r.totalRisk).toBe(10);
    expect(r.pct).toBeNull();
    expect(r.noStopCount).toBe(1);
  });
  it('empty -> zeros', () => {
    expect(aggregateRisk([], 1000)).toEqual({ totalRisk: 0, pct: 0, noStopCount: 0, perPosition: [] });
  });
});
