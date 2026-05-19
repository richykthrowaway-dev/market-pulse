import { describe, it, expect } from 'vitest';
import { headlineSentiment, newsMood } from './headlineSentiment';

describe('headlineSentiment', () => {
  it('detects bullish, bearish, neutral (case-insensitive)', () => {
    expect(headlineSentiment('Stock SURGES to record high')).toBe('bull');
    expect(headlineSentiment('Shares plunge after earnings miss')).toBe('bear');
    expect(headlineSentiment('Company announces new board member')).toBe('neutral');
  });
  it('is safe on nullish input', () => {
    // @ts-expect-error intentional
    expect(headlineSentiment(null)).toBe('neutral');
  });
});

describe('newsMood', () => {
  it('tallies and computes net', () => {
    const m = newsMood([
      { title: 'Stock rally continues' },
      { title: 'Earnings beat expectations' },
      { title: 'Shares tumble on downgrade' },
      { summary: 'Routine filing' },
    ]);
    expect(m.bull).toBe(2);
    expect(m.bear).toBe(1);
    expect(m.neutral).toBe(1);
    expect(m.net).toBe(1);
  });
  it('non-array safe', () => {
    // @ts-expect-error intentional
    expect(newsMood(null)).toEqual({ bull: 0, bear: 0, neutral: 0, net: 0 });
  });
});
