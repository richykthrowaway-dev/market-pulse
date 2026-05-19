import { describe, it, expect } from 'vitest';
import { sectorExposure } from './sectorExposure';

const stocks = [
  { symbol: 'AAPL' }, { symbol: 'MSFT' }, { symbol: 'JPM' }, { symbol: 'ZZZ' },
];
const fakeResolver = (s: string): string | null =>
  ({ AAPL: 'Information Technology', MSFT: 'Information Technology', JPM: 'Financials' } as Record<string, string>)[s] ?? null;

describe('sectorExposure', () => {
  it('aggregates and sorts by pct desc; unknown bucket', () => {
    const out = sectorExposure(stocks, ['aapl', 'msft', 'jpm', 'zzz'], fakeResolver);
    expect(out[0]).toEqual({ sector: 'Information Technology', count: 2, pct: 50 });
    expect(out.find((s) => s.sector === 'Financials')).toEqual({ sector: 'Financials', count: 1, pct: 25 });
    expect(out.find((s) => s.sector === 'Unknown')).toEqual({ sector: 'Unknown', count: 1, pct: 25 });
  });
  it('empty / non-array safe', () => {
    expect(sectorExposure(stocks, ['nope'], fakeResolver)).toEqual([]);
    // @ts-expect-error intentional
    expect(sectorExposure(null, null, fakeResolver)).toEqual([]);
  });
});
