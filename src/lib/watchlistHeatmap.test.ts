import { describe, it, expect } from 'vitest';
import { watchlistHeatmap } from './watchlistHeatmap';

const stocks = [
  { symbol: 'AAPL', name: 'Apple', changePercent: 1.2 },
  { symbol: 'MSFT', name: 'Microsoft', changePercent: -3.4 },
  { symbol: 'NVDA', name: 'Nvidia', changePercent: 9.1 },
];

describe('watchlistHeatmap', () => {
  it('resolves case-insensitively and sorts by change desc', () => {
    const cells = watchlistHeatmap(stocks, ['msft', 'nvda', 'aapl']);
    expect(cells.map((c) => c.symbol)).toEqual(['NVDA', 'AAPL', 'MSFT']);
  });
  it('buckets intensity 0..4', () => {
    const cells = watchlistHeatmap(stocks, ['NVDA', 'AAPL']);
    expect(cells.find((c) => c.symbol === 'NVDA')!.intensity).toBe(4);
    expect(cells.find((c) => c.symbol === 'AAPL')!.intensity).toBe(0);
  });
  it('drops unresolved and is non-array safe', () => {
    expect(watchlistHeatmap(stocks, ['ZZZ'])).toEqual([]);
    // @ts-expect-error intentional
    expect(watchlistHeatmap(null, null)).toEqual([]);
  });
});
