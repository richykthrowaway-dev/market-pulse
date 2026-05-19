import { describe, it, expect } from 'vitest';
import { resolveDisplayStocks, watchlistMovers } from './dashboardStocks';

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

describe('watchlistMovers', () => {
  const mk = (symbol: string, changePercent: number) => ({ symbol, changePercent, name: symbol });
  const stocks = [mk('AAPL', 1), mk('MSFT', -3), mk('NVDA', 5), mk('TSLA', -8)];

  it('best = max %, worst = min %, among resolved watchlist (case-insensitive)', () => {
    const r = watchlistMovers(stocks, ['nvda', 'tsla', 'aapl'])!;
    expect(r.best.symbol).toBe('NVDA');
    expect(r.worst.symbol).toBe('TSLA');
  });
  it('null when no symbols resolve', () => {
    expect(watchlistMovers(stocks, ['ZZZ'])).toBeNull();
    expect(watchlistMovers(stocks, [])).toBeNull();
  });
  it('single resolved → best === worst', () => {
    const r = watchlistMovers(stocks, ['AAPL'])!;
    expect(r.best.symbol).toBe('AAPL');
    expect(r.worst.symbol).toBe('AAPL');
  });
  it('non-array safe', () => {
    // @ts-expect-error intentional
    expect(watchlistMovers(null, null)).toBeNull();
  });
});
