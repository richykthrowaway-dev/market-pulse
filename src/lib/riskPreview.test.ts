import { describe, it, expect } from 'vitest';
import { riskPreview } from './riskPreview';

describe('riskPreview', () => {
  it('long: rr, dollarRisk, posValue', () => {
    expect(riskPreview({ side: 'long', entry: 100, stop: 90, target: 130, qty: 10 }))
      .toEqual({ rr: 3, dollarRisk: 100, posValue: 1000, acctRiskPct: null, overRisk: false });
  });
  it('short: risk above entry', () => {
    const r = riskPreview({ side: 'short', entry: 100, stop: 110, target: 80, qty: 5 });
    expect(r.rr).toBe(2);
    expect(r.dollarRisk).toBe(50);
    expect(r.posValue).toBe(500);
  });
  it('account-relative risk + over-risk flag', () => {
    const r = riskPreview({ side: 'long', entry: 100, stop: 90, target: 120, qty: 10, account: 10000, riskPct: 0.5 });
    expect(r.acctRiskPct).toBeCloseTo(1, 5);
    expect(r.overRisk).toBe(true);
  });
  it('missing stop/target → nulls, no throw', () => {
    expect(riskPreview({ side: 'long', entry: 100, qty: 10 }))
      .toEqual({ rr: null, dollarRisk: null, posValue: 1000, acctRiskPct: null, overRisk: false });
  });
  it('zero qty → posValue 0', () => {
    expect(riskPreview({ side: 'long', entry: 100, stop: 90, qty: 0 }).posValue).toBe(0);
  });
});
