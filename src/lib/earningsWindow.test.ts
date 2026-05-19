import { describe, it, expect } from 'vitest';
import { earningsWindow } from './earningsWindow';

describe('earningsWindow', () => {
  const ev = [
    { ticker: 'AAPL', daysUntil: 0 },
    { ticker: 'MSFT', daysUntil: 1 },
    { ticker: 'NVDA', daysUntil: 4 },
    { ticker: 'TSLA', daysUntil: 30 },
    { ticker: 'OLD', daysUntil: -2 },
    { ticker: 'NULL', daysUntil: null },
  ];
  it('filters to horizon, sorts soonest first, labels', () => {
    const out = earningsWindow(ev);
    expect(out).toEqual([
      { ticker: 'AAPL', label: 'Today' },
      { ticker: 'MSFT', label: 'Tomorrow' },
      { ticker: 'NVDA', label: 'in 4d' },
    ]);
  });
  it('respects max cap and non-array safety', () => {
    expect(earningsWindow(ev, 7, 2).map((e) => e.ticker)).toEqual(['AAPL', 'MSFT']);
    // @ts-expect-error intentional
    expect(earningsWindow(null)).toEqual([]);
  });
});
