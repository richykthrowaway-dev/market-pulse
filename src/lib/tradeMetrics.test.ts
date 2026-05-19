import { describe, it, expect } from 'vitest';
import { unrealizedPnl, stopProximity, openR } from './tradeMetrics';

describe('unrealizedPnl', () => {
  it('long gain', () => {
    expect(unrealizedPnl('long', 100, 110, 10)).toEqual({ dollars: 100, pct: 10 });
  });
  it('long loss', () => {
    expect(unrealizedPnl('long', 100, 90, 10)).toEqual({ dollars: -100, pct: -10 });
  });
  it('short gain (price falls)', () => {
    expect(unrealizedPnl('short', 100, 90, 10)).toEqual({ dollars: 100, pct: 10 });
  });
  it('short loss (price rises)', () => {
    expect(unrealizedPnl('short', 100, 110, 10)).toEqual({ dollars: -100, pct: -10 });
  });
});

describe('stopProximity', () => {
  // long: entry 100, stop 90 → band = 90 + 0.25*(100-90) = 92.5
  it('far → ok', () => {
    expect(stopProximity('long', 100, 90, 99)).toBe('ok');
  });
  it('within band → near', () => {
    expect(stopProximity('long', 100, 90, 92)).toBe('near');
  });
  it('crossed → breached', () => {
    expect(stopProximity('long', 100, 90, 89)).toBe('breached');
  });
  it('short crossed (price above stop)', () => {
    expect(stopProximity('short', 100, 110, 111)).toBe('breached');
  });
  it('no stop → ok', () => {
    expect(stopProximity('long', 100, undefined, 50)).toBe('ok');
  });
  it('exact band edge → near (long, 92.5)', () => {
    expect(stopProximity('long', 100, 90, 92.5)).toBe('near');
  });
  it('price exactly at stop → breached (long)', () => {
    expect(stopProximity('long', 100, 90, 90)).toBe('breached');
  });
  it('zero-width stop (stop === entry): no near zone', () => {
    expect(stopProximity('long', 100, 100, 100)).toBe('breached');
    expect(stopProximity('long', 100, 100, 101)).toBe('ok');
  });
});

describe('openR', () => {
  it('long: +1R at target distance, negative below entry', () => {
    expect(openR('long', 100, 90, 110)).toBeCloseTo(1);
    expect(openR('long', 100, 90, 95)).toBeCloseTo(-0.5);
  });
  it('short: signed correctly', () => {
    expect(openR('short', 100, 110, 90)).toBeCloseTo(1);
  });
  it('null when no stop or entry===stop or non-finite', () => {
    expect(openR('long', 100, undefined, 110)).toBeNull();
    expect(openR('long', 100, 100, 110)).toBeNull();
    expect(openR('long', 100, 90, NaN)).toBeNull();
  });
});
