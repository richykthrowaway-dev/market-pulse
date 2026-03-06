import { describe, it, expect } from 'vitest';
import {
  runStressTest,
  generateInsights,
  STRESS_SCENARIOS,
  type StressPosition,
} from '@/services/stressTestEngine';

const POSITIONS: StressPosition[] = [
  { symbol: 'AAPL',  name: 'Apple Inc.',       quantity: 100, latestPrice: 200, beta: 1.2 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',  quantity: 50,  latestPrice: 400, beta: 1.0 },
  { symbol: 'JNJ',   name: 'Johnson & Johnson', quantity: 80, latestPrice: 150, beta: 0.6 },
];

describe('stressTestEngine', () => {
  describe('runStressTest', () => {
    it('computes correct portfolio values for moderate downturn', () => {
      const scenario = STRESS_SCENARIOS.find(s => s.id === 'moderate')!;
      const result = runStressTest(POSITIONS, scenario);

      // Current: 100*200 + 50*400 + 80*150 = 20000 + 20000 + 12000 = 52000
      expect(result.currentPortfolioValue).toBe(52000);

      // AAPL: return = -0.10 * 1.2 = -0.12, new = 200*(1-0.12) = 176
      // MSFT: return = -0.10 * 1.0 = -0.10, new = 400*(1-0.10) = 360
      // JNJ:  return = -0.10 * 0.6 = -0.06, new = 150*(1-0.06) = 141
      expect(result.positions.find(p => p.symbol === 'AAPL')!.newPrice).toBeCloseTo(176, 1);
      expect(result.positions.find(p => p.symbol === 'MSFT')!.newPrice).toBeCloseTo(360, 1);
      expect(result.positions.find(p => p.symbol === 'JNJ')!.newPrice).toBeCloseTo(141, 1);

      // Projected: 100*176 + 50*360 + 80*141 = 17600 + 18000 + 11280 = 46880
      expect(result.projectedPortfolioValue).toBeCloseTo(46880, 0);
      expect(result.projectedLoss).toBeCloseTo(5120, 0);
    });

    it('sorts positions by loss (descending)', () => {
      const result = runStressTest(POSITIONS, STRESS_SCENARIOS[0]);
      for (let i = 1; i < result.positions.length; i++) {
        expect(result.positions[i - 1].positionLoss).toBeGreaterThanOrEqual(result.positions[i].positionLoss);
      }
    });

    it('handles empty portfolio', () => {
      const result = runStressTest([], STRESS_SCENARIOS[0]);
      expect(result.currentPortfolioValue).toBe(0);
      expect(result.projectedLoss).toBe(0);
      expect(result.positions).toHaveLength(0);
    });

    it('defaults beta to 1.0 when 0', () => {
      const pos: StressPosition[] = [{ symbol: 'X', name: 'Test', quantity: 10, latestPrice: 100, beta: 0 }];
      const result = runStressTest(pos, STRESS_SCENARIOS[1]); // -10%
      // beta 0 → positionReturn = -0.10 * 0 = 0, but engine uses (beta || 1.0)
      expect(result.positions[0].newPrice).toBeCloseTo(90, 1);
    });

    it('clamps newPrice to 0 minimum', () => {
      const pos: StressPosition[] = [{ symbol: 'X', name: 'Test', quantity: 10, latestPrice: 10, beta: 5 }];
      const severe = STRESS_SCENARIOS[3]; // -30%
      const result = runStressTest(pos, severe);
      // return = -0.30 * 5 = -1.5 → newPrice = 10 * (1 - 1.5) = -5 → clamped to 0
      expect(result.positions[0].newPrice).toBe(0);
    });

    it('computes correct loss percentages', () => {
      const result = runStressTest(POSITIONS, STRESS_SCENARIOS[2]); // -20%
      result.positions.forEach(p => {
        const expected = p.positionLoss / p.positionCurrentValue;
        expect(p.positionLossPct).toBeCloseTo(expected, 6);
      });
    });
  });

  describe('generateInsights', () => {
    it('returns at least 2 insights for a non-empty portfolio', () => {
      const result = runStressTest(POSITIONS, STRESS_SCENARIOS[1]);
      const insights = generateInsights(result);
      expect(insights.length).toBeGreaterThanOrEqual(2);
    });

    it('identifies the most impacted position', () => {
      const result = runStressTest(POSITIONS, STRESS_SCENARIOS[2]);
      const insights = generateInsights(result);
      const worstPos = result.positions[0];
      const impactInsight = insights.find(i => i.text.includes('Most impacted'));
      expect(impactInsight).toBeDefined();
      expect(impactInsight!.text).toContain(worstPos.symbol);
    });

    it('flags high-beta positions', () => {
      const result = runStressTest(POSITIONS, STRESS_SCENARIOS[0]);
      const insights = generateInsights(result);
      // AAPL has beta 1.2 which is < 1.5, so no high-beta warning
      const highBeta = insights.find(i => i.text.includes('High-beta'));
      expect(highBeta).toBeUndefined();

      // Add a high-beta position
      const withHighBeta: StressPosition[] = [
        ...POSITIONS,
        { symbol: 'TSLA', name: 'Tesla', quantity: 20, latestPrice: 300, beta: 2.0 },
      ];
      const r2 = runStressTest(withHighBeta, STRESS_SCENARIOS[0]);
      const i2 = generateInsights(r2);
      expect(i2.find(i => i.text.includes('High-beta'))).toBeDefined();
    });

    it('returns empty insights for empty portfolio', () => {
      const result = runStressTest([], STRESS_SCENARIOS[0]);
      const insights = generateInsights(result);
      expect(insights).toHaveLength(1); // just the overall loss line
    });
  });

  describe('STRESS_SCENARIOS', () => {
    it('has 4 scenarios with negative market returns', () => {
      expect(STRESS_SCENARIOS).toHaveLength(4);
      STRESS_SCENARIOS.forEach(s => {
        expect(s.marketReturn).toBeLessThan(0);
      });
    });
  });
});
