import { describe, it, expect } from 'vitest';
import { weekRangePosition } from './weekRangePosition';

describe('weekRangePosition', () => {
  it('returns the fraction within the band', () => {
    expect(weekRangePosition(10, 20, 15)).toBe(0.5);
    expect(weekRangePosition(0, 100, 25)).toBe(0.25);
  });
  it('clamps below low to 0 and above high to 1', () => {
    expect(weekRangePosition(10, 20, 5)).toBe(0);
    expect(weekRangePosition(10, 20, 99)).toBe(1);
  });
  it('returns null for degenerate band', () => {
    expect(weekRangePosition(20, 20, 20)).toBeNull();
    expect(weekRangePosition(30, 10, 20)).toBeNull();
  });
  it('returns null for non-finite inputs', () => {
    expect(weekRangePosition(NaN, 20, 15)).toBeNull();
    expect(weekRangePosition(10, Infinity, 15)).toBeNull();
    // @ts-expect-error intentional
    expect(weekRangePosition(undefined, 20, 15)).toBeNull();
  });
});
