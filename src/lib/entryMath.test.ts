import { describe, it, expect } from 'vitest';
import { stopFromPct, targetFromR, qtyFromRisk } from './entryMath';

describe('stopFromPct', () => {
  it('long stop is below entry', () => {
    expect(stopFromPct('long', 100, 2)).toBe(98);
  });
  it('short stop is above entry', () => {
    expect(stopFromPct('short', 100, 2)).toBe(102);
  });
  it('rounds to 2 decimals', () => {
    expect(stopFromPct('long', 99.99, 3)).toBe(96.99);
  });
  it('entry<=0 → null', () => {
    expect(stopFromPct('long', 0, 2)).toBeNull();
  });
});

describe('targetFromR', () => {
  it('long target = entry + R*|entry-stop|', () => {
    expect(targetFromR('long', 100, 90, 2)).toBe(120);
  });
  it('short target = entry - R*|entry-stop|', () => {
    expect(targetFromR('short', 100, 110, 2)).toBe(80);
  });
  it('no stop / zero risk → null', () => {
    expect(targetFromR('long', 100, 100, 2)).toBeNull();
    expect(targetFromR('long', 100, undefined, 2)).toBeNull();
  });
});

describe('qtyFromRisk', () => {
  it('floors account*riskPct%/perShareRisk', () => {
    expect(qtyFromRisk(100, 90, 10000, 1)).toBe(10);
  });
  it('rounds down', () => {
    expect(qtyFromRisk(100, 93, 10000, 1)).toBe(14);
  });
  it('invalid inputs → 0', () => {
    expect(qtyFromRisk(100, 100, 10000, 1)).toBe(0);
    expect(qtyFromRisk(100, 90, 0, 1)).toBe(0);
    expect(qtyFromRisk(0, 90, 10000, 1)).toBe(0);
  });
});
