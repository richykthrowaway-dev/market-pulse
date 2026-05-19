import { describe, it, expect } from 'vitest';
import { planClose } from './splitClose';

describe('planClose', () => {
  it('full when closeQty == positionQty', () => {
    expect(planClose({ positionQty: 10, closeQty: 10 })).toEqual({ mode: 'full', closeQty: 10, remainder: 0 });
  });
  it('partial when 0 < closeQty < positionQty', () => {
    expect(planClose({ positionQty: 10, closeQty: 3 })).toEqual({ mode: 'partial', closeQty: 3, remainder: 7 });
  });
  it('invalid for <=0, > position, NaN', () => {
    expect(planClose({ positionQty: 10, closeQty: 0 }).mode).toBe('invalid');
    expect(planClose({ positionQty: 10, closeQty: 11 }).mode).toBe('invalid');
    expect(planClose({ positionQty: 10, closeQty: NaN }).mode).toBe('invalid');
  });
});
