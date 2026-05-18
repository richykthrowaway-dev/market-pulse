import { describe, it, expect } from 'vitest';
import { rrBar, payoff, resolveEntryDefaults } from './entryViz';

describe('rrBar', () => {
  it('positions stop/entry/target/live as 0..1 fractions of the span', () => {
    const b = rrBar('long', 100, 90, 120, 110)!;
    expect(b.lo).toBe(90);
    expect(b.hi).toBe(120);
    expect(b.stopPct).toBeCloseTo(0, 5);
    expect(b.entryPct).toBeCloseTo((100 - 90) / 30, 5);
    expect(b.targetPct).toBeCloseTo(1, 5);
    expect(b.livePct).toBeCloseTo((110 - 90) / 30, 5);
    expect(b.rMultiple).toBeCloseTo(2, 5);
  });
  it('live clamps into [0,1]', () => {
    const b = rrBar('long', 100, 90, 120, 200)!;
    expect(b.livePct).toBe(1);
  });
  it('null when entry<=0 / no stop / no target', () => {
    expect(rrBar('long', 0, 90, 120, undefined)).toBeNull();
    expect(rrBar('long', 100, undefined, 120, undefined)).toBeNull();
    expect(rrBar('long', 100, 90, undefined, undefined)).toBeNull();
  });
});

describe('payoff', () => {
  it('long: ifStopped negative, ifTarget positive', () => {
    const p = payoff('long', 100, 90, 120, 10, 10000);
    expect(p.ifStopped).toEqual({ dollars: -100, pct: -10 });
    expect(p.ifTarget).toEqual({ dollars: 200, pct: 20 });
    expect(p.posValue).toBe(1000);
    expect(p.acctPct).toBeCloseTo(10, 5);
  });
  it('short: signs flip', () => {
    const p = payoff('short', 100, 110, 80, 5);
    expect(p.ifStopped).toEqual({ dollars: -50, pct: -10 });
    expect(p.ifTarget).toEqual({ dollars: 100, pct: 20 });
    expect(p.acctPct).toBeNull();
  });
  it('missing stop/target → null legs, posValue still computed', () => {
    const p = payoff('long', 100, undefined, undefined, 10);
    expect(p.ifStopped).toBeNull();
    expect(p.ifTarget).toBeNull();
    expect(p.posValue).toBe(1000);
  });
});

describe('resolveEntryDefaults', () => {
  it('falls back to {stopPct:2,targetR:2} on bad/missing input', () => {
    expect(resolveEntryDefaults(null)).toEqual({ stopPct: 2, targetR: 2 });
    expect(resolveEntryDefaults('not json')).toEqual({ stopPct: 2, targetR: 2 });
    expect(resolveEntryDefaults('{"stopPct":-1}')).toEqual({ stopPct: 2, targetR: 2 });
  });
  it('uses valid positive overrides', () => {
    expect(resolveEntryDefaults('{"stopPct":3,"targetR":2.5}')).toEqual({ stopPct: 3, targetR: 2.5 });
  });
});
