import { describe, it, expect } from 'vitest';
import { computePnL, computeInitialRisk, computeR } from './tradeMath';

const base = { side: 'long' as const, entryPrice: 100, exitPrice: 110,
  quantity: 10, fees: 5 };

describe('computePnL', () => {
  it('long nets fees', () => { expect(computePnL(base)).toBe(95); });
  it('short flips direction', () => {
    expect(computePnL({ ...base, side: 'short', exitPrice: 90 })).toBe(95);
  });
});
describe('computeInitialRisk', () => {
  it('null without a stop', () => { expect(computeInitialRisk(base)).toBeNull(); });
  it('abs(entry-stop)*qty', () => {
    expect(computeInitialRisk({ ...base, stopLoss: 98 })).toBe(20);
  });
});
describe('computeR', () => {
  it('null when no stop', () => { expect(computeR(base)).toBeNull(); });
  it('pnl / initialRisk', () => {
    expect(computeR({ ...base, stopLoss: 98 })).toBe(95 / 20);
  });
});
