import { describe, it, expect } from 'vitest';
import { parseAlerts, evaluateAlerts, PriceAlert } from './priceAlerts';

describe('parseAlerts', () => {
  it('keeps valid, drops invalid', () => {
    const raw = JSON.stringify([
      { id: '1', symbol: 'AAPL', target: 200, dir: 'above' },
      { id: '2', symbol: 'X', target: 'nope', dir: 'above' },
      { bad: true },
    ]);
    expect(parseAlerts(raw)).toEqual([{ id: '1', symbol: 'AAPL', target: 200, dir: 'above' }]);
  });
  it('bad json / null → []', () => {
    expect(parseAlerts('{not json')).toEqual([]);
    expect(parseAlerts(null)).toEqual([]);
    expect(parseAlerts('{}')).toEqual([]);
  });
});

describe('evaluateAlerts', () => {
  const alerts: PriceAlert[] = [
    { id: 'a', symbol: 'AAPL', target: 200, dir: 'above' },
    { id: 'b', symbol: 'MSFT', target: 300, dir: 'below' },
    { id: 'c', symbol: 'NOPRICE', target: 1, dir: 'above' },
  ];
  it('returns crossed alerts only', () => {
    const t = evaluateAlerts(alerts, { AAPL: 210, MSFT: 290 });
    expect(t.map((a) => a.id).sort()).toEqual(['a', 'b']);
  });
  it('skips alerts without a price; non-array safe', () => {
    expect(evaluateAlerts(alerts, { AAPL: 150, MSFT: 320 })).toEqual([]);
    // @ts-expect-error intentional
    expect(evaluateAlerts(null, {})).toEqual([]);
  });
});
