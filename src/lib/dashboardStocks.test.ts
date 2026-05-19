import { describe, it, expect } from 'vitest';
import { resolveDisplayStocks } from './dashboardStocks';

const S = (symbol: string, changePercent = 0) => ({ symbol, changePercent, name: symbol });

describe('resolveDisplayStocks', () => {
  const stocks = [
    S('AAPL', 1), S('MSFT', -3), S('NVDA', 5), S('TSLA', -8), S('GOOGL', 2),
  ];

  it('watchlist: resolved in watchlist order, case-insensitive, drops unknown', () => {
    const r = resolveDisplayStocks(stocks, ['nvda', 'AAPL', 'ZZZZ']);
    expect(r.source).toBe('watchlist');
    expect(r.list.map((s) => s.symbol)).toEqual(['NVDA', 'AAPL']);
  });

  it('empty watchlist → movers sorted by |changePercent| desc, capped', () => {
    const r = resolveDisplayStocks(stocks, [], 3);
    expect(r.source).toBe('movers');
    expect(r.list.map((s) => s.symbol)).toEqual(['TSLA', 'NVDA', 'MSFT']);
  });

  it('watchlist with no resolvable symbols → movers fallback', () => {
    const r = resolveDisplayStocks(stocks, ['NOPE', 'ALSO_NO']);
    expect(r.source).toBe('movers');
  });

  it('limit caps the watchlist list', () => {
    const r = resolveDisplayStocks(stocks, ['AAPL', 'MSFT', 'NVDA'], 2);
    expect(r.list.map((s) => s.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('non-array / garbage safe', () => {
    // @ts-expect-error intentional
    expect(resolveDisplayStocks(null, null)).toEqual({ list: [], source: 'movers' });
  });
});
