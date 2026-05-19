import { describe, it, expect } from 'vitest';
import { classifyExit } from './planAdherence';

describe('classifyExit', () => {
  it('stopped (long/short)', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 89 })).toBe('stopped');
    expect(classifyExit({ side: 'short', entry: 100, stop: 110, target: 80, exitPrice: 111 })).toBe('stopped');
  });
  it('target hit exactly; let it run beyond', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 120 })).toBe('target hit');
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 130 })).toBe('let it run');
  });
  it('between: loss -> cut early; profit -> overstayed', () => {
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 97 })).toBe('cut early');
    expect(classifyExit({ side: 'long', entry: 100, stop: 90, target: 120, exitPrice: 110 })).toBe('overstayed');
  });
  it('never throws on partial inputs', () => {
    expect(() => classifyExit({ side: 'long', entry: 100, exitPrice: 105 })).not.toThrow();
  });
});
