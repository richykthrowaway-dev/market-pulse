import { describe, it, expect } from 'vitest';
import { windowChange } from './windowChange';

describe('windowChange', () => {
  it('computes abs + pct from first to last close', () => {
    expect(windowChange([{ c: 100 }, { c: 110 }] as any)).toEqual({ abs: 10, pct: 10 });
  });
  it('negative move', () => {
    expect(windowChange([{ c: 200 }, { c: 150 }] as any)).toEqual({ abs: -50, pct: -25 });
  });
  it('empty → null', () => {
    expect(windowChange([])).toBeNull();
  });
  it('single bar → zero change', () => {
    expect(windowChange([{ c: 50 }] as any)).toEqual({ abs: 0, pct: 0 });
  });
  it('first close 0 → pct 0 (no divide-by-zero)', () => {
    expect(windowChange([{ c: 0 }, { c: 5 }] as any)).toEqual({ abs: 5, pct: 0 });
  });
});
