import { describe, it, expect } from 'vitest';
import { isValidExit } from './exitValidation';
describe('isValidExit', () => {
  it('rejects blank/zero/negative/non-numeric', () => {
    expect(isValidExit('')).toBe(false);
    expect(isValidExit('0')).toBe(false);
    expect(isValidExit('-5')).toBe(false);
    expect(isValidExit('abc')).toBe(false);
    expect(isValidExit('  ')).toBe(false);
  });
  it('accepts a positive price', () => {
    expect(isValidExit('12.5')).toBe(true);
    expect(isValidExit('100')).toBe(true);
  });
});
