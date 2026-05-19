import { describe, it, expect } from 'vitest';
import { parseOpenTrades } from './openTradesStore';
describe('parseOpenTrades', () => {
  it('returns [] for null, invalid JSON, or non-array', () => {
    expect(parseOpenTrades(null)).toEqual([]);
    expect(parseOpenTrades('not json')).toEqual([]);
    expect(parseOpenTrades('{"a":1}')).toEqual([]);
  });
  it('passes through a valid array', () => {
    const t = [{ id:'a', symbol:'AAPL', side:'long', quantity:1, entryPrice:10, entryDate:'2026-05-18', planValid:true }];
    expect(parseOpenTrades(JSON.stringify(t))).toEqual(t);
  });
});
