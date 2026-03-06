/**
 * Stress Test Engine
 *
 * Pure functions for simulating portfolio losses under market stress scenarios.
 * No side effects — takes positions + scenario config, returns typed results.
 *
 * @module stressTestEngine
 */

/* ─── Scenario definitions ─── */

export interface StressScenario {
  id: 'minor' | 'moderate' | 'crash' | 'severe';
  name: string;
  description: string;
  marketReturn: number; // e.g. -0.05 for -5%
}

export const STRESS_SCENARIOS: StressScenario[] = [
  { id: 'minor',    name: 'Minor Correction',    description: 'A brief market pullback',            marketReturn: -0.05 },
  { id: 'moderate', name: 'Moderate Downturn',    description: 'Extended selling pressure',          marketReturn: -0.10 },
  { id: 'crash',    name: 'Significant Crash',    description: 'Major market dislocation',           marketReturn: -0.20 },
  { id: 'severe',   name: 'Severe Bear Market',   description: 'Prolonged economic contraction',     marketReturn: -0.30 },
];

/* ─── Position types ─── */

export interface StressPosition {
  symbol: string;
  name: string;
  quantity: number;
  latestPrice: number;
  beta: number; // defaults to 1.0 if unknown
}

export interface StressPositionResult {
  symbol: string;
  name: string;
  quantity: number;
  latestPrice: number;
  beta: number;
  newPrice: number;
  positionCurrentValue: number;
  positionProjectedValue: number;
  positionLoss: number;
  positionLossPct: number;
}

export interface StressTestResult {
  currentPortfolioValue: number;
  projectedPortfolioValue: number;
  projectedLoss: number;
  projectedLossPct: number;
  scenarioMeta: StressScenario;
  positions: StressPositionResult[];
}

/* ─── Core engine (pure function) ─── */

export function runStressTest(
  positions: StressPosition[],
  scenario: StressScenario,
): StressTestResult {
  const positionResults: StressPositionResult[] = positions.map(p => {
    const positionReturn = scenario.marketReturn * (p.beta || 1.0);
    const newPrice = Math.max(0, p.latestPrice * (1 + positionReturn));
    const currentValue = p.quantity * p.latestPrice;
    const projectedValue = p.quantity * newPrice;
    const loss = currentValue - projectedValue;
    const lossPct = currentValue > 0 ? loss / currentValue : 0;

    return {
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      latestPrice: p.latestPrice,
      beta: p.beta,
      newPrice,
      positionCurrentValue: currentValue,
      positionProjectedValue: projectedValue,
      positionLoss: loss,
      positionLossPct: lossPct,
    };
  });

  const currentPortfolioValue = positionResults.reduce((s, p) => s + p.positionCurrentValue, 0);
  const projectedPortfolioValue = positionResults.reduce((s, p) => s + p.positionProjectedValue, 0);
  const projectedLoss = currentPortfolioValue - projectedPortfolioValue;
  const projectedLossPct = currentPortfolioValue > 0 ? projectedLoss / currentPortfolioValue : 0;

  return {
    currentPortfolioValue,
    projectedPortfolioValue,
    projectedLoss,
    projectedLossPct,
    scenarioMeta: scenario,
    positions: positionResults.sort((a, b) => b.positionLoss - a.positionLoss),
  };
}

/* ─── Insight generator (deterministic) ─── */

export interface StressInsight {
  text: string;
  type: 'info' | 'warning' | 'danger';
}

export function generateInsights(result: StressTestResult): StressInsight[] {
  const insights: StressInsight[] = [];
  const { projectedLoss, projectedLossPct, scenarioMeta, positions } = result;

  // 1. Overall loss
  const fmtLoss = '$' + Math.abs(projectedLoss).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtPct = (Math.abs(projectedLossPct) * 100).toFixed(1);
  insights.push({
    text: `Your portfolio would lose ${fmtLoss} (${fmtPct}%) in a ${Math.abs(scenarioMeta.marketReturn * 100).toFixed(0)}% market decline.`,
    type: projectedLossPct > 0.15 ? 'danger' : 'warning',
  });

  // 2. Most impacted position
  if (positions.length > 0) {
    const worst = positions[0];
    const worstLoss = '$' + Math.abs(worst.positionLoss).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const worstPct = (Math.abs(worst.positionLossPct) * 100).toFixed(1);
    insights.push({
      text: `Most impacted position: ${worst.symbol} with a projected loss of ${worstLoss} (${worstPct}%).`,
      type: 'danger',
    });
  }

  // 3. Top three contributors
  if (positions.length >= 3) {
    const top3 = positions.slice(0, 3).map(p => p.symbol).join(', ');
    const top3Loss = positions.slice(0, 3).reduce((s, p) => s + p.positionLoss, 0);
    const top3Pct = projectedLoss > 0 ? ((top3Loss / projectedLoss) * 100).toFixed(0) : '0';
    insights.push({
      text: `Top three contributors to losses: ${top3}, accounting for ${top3Pct}% of total projected loss.`,
      type: 'warning',
    });
  }

  // 4. High-beta warning
  const highBeta = positions.filter(p => p.beta > 1.5);
  if (highBeta.length > 0) {
    const symbols = highBeta.slice(0, 3).map(p => `${p.symbol} (β${p.beta.toFixed(2)})`).join(', ');
    insights.push({
      text: `High-beta positions amplifying losses: ${symbols}. Consider hedging or reducing exposure.`,
      type: 'info',
    });
  }

  return insights;
}
