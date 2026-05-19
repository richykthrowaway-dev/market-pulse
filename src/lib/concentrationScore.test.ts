import { describe, it, expect } from 'vitest';
import { concentrationScore } from './concentrationScore';

describe('concentrationScore', () => {
  it('single sector → 100 / Concentrated', () => {
    expect(concentrationScore([{ pct: 100 }])).toEqual({ score: 100, label: 'Concentrated' });
  });
  it('even 4-way → 25 / Diversified', () => {
    expect(concentrationScore([{ pct: 25 }, { pct: 25 }, { pct: 25 }, { pct: 25 }]))
      .toEqual({ score: 25, label: 'Diversified' });
  });
  it('50/30/20 → 38 / Moderate', () => {
    expect(concentrationScore([{ pct: 50 }, { pct: 30 }, { pct: 20 }]))
      .toEqual({ score: 38, label: 'Moderate' });
  });
  it('empty / non-array safe', () => {
    expect(concentrationScore([])).toEqual({ score: 0, label: '—' });
    // @ts-expect-error intentional
    expect(concentrationScore(null)).toEqual({ score: 0, label: '—' });
  });
});
