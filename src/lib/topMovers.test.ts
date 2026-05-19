import { describe, it, expect } from 'vitest';
import { topMovers } from './topMovers';

const stocks = [
  { symbol: 'AAPL', changePercent: 1.2 },
  { symbol: 'MSFT', changePercent: -8.4 },
  { symbol: 'NVDA', changePercent: 5.1 },
  { symbol: 'TSLA', changePercent: -2.0 },
  { symbol: 'DUP', changePercent: 9 },
  { symbol: 'dup', changePercent: 3 },
  { symbol: 'BAD', changePercent: NaN },
];

describe('topMovers', () => {
  it('picks largest absolute movers incl. negatives', () => {
    expect(topMovers(stocks, 3).map((s) => s.symbol)).toEqual(['DUP', 'MSFT', 'NVDA']);
  });
  it('respects n cap and dedups by symbol', () => {
    expect(topMovers(stocks, 1).map((s) => s.symbol)).toEqual(['DUP']);
    const syms = topMovers(stocks, 99).map((s) => s.symbol);
    expect(syms.filter((s) => s.toUpperCase() === 'DUP')).toHaveLength(1);
  });
  it('non-array safe', () => {
    // @ts-expect-error intentional
    expect(topMovers(null)).toEqual([]);
  });
});
