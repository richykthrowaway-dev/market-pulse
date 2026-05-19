import { describe, it, expect } from 'vitest';
import { parseOpenTrades } from './openTradesStore';
describe('parseOpenTrades', () => {
  it('returns [] for null, invalid JSON, or non-array', () => {
    expect(parseOpenTrades(null).trades).toEqual([]);
    expect(parseOpenTrades('not json').trades).toEqual([]);
    expect(parseOpenTrades('{"a":1}').trades).toEqual([]);
  });
  it('passes through a valid array', () => {
    const t = [{ id:'a', symbol:'AAPL', side:'long', quantity:1, entryPrice:10, entryDate:'2026-05-18', planValid:true }];
    expect(parseOpenTrades(JSON.stringify(t)).trades).toEqual(t);
  });
});

describe('parseOpenTrades hardening', () => {
  it('returns empty + dropped 0 for null / non-array / bad JSON', () => {
    expect(parseOpenTrades(null)).toEqual({ trades: [], dropped: 0 });
    expect(parseOpenTrades('not json')).toEqual({ trades: [], dropped: 0 });
    expect(parseOpenTrades('{}')).toEqual({ trades: [], dropped: 0 });
  });
  it('drops malformed rows and counts them', () => {
    const raw = JSON.stringify([
      { id: 'a', symbol: 'AAPL', side: 'long', quantity: 10, entryPrice: 190, entryDate: '2026-05-15', planValid: true },
      { id: 'b', symbol: 'TSLA' },
      null,
      { symbol: 'NVDA', quantity: 1, entryPrice: 9 },
    ]);
    const r = parseOpenTrades(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].symbol).toBe('AAPL');
    expect(r.dropped).toBe(3);
  });
  it('coerces side and defaults planValid', () => {
    const raw = JSON.stringify([
      { id: 'x', symbol: 'msft', side: 'BUY', quantity: 2, entryPrice: 400, entryDate: '2026-05-15' },
    ]);
    const r = parseOpenTrades(raw);
    expect(r.trades[0].side).toBe('long');
    expect(r.trades[0].planValid).toBe(true);
  });
});
