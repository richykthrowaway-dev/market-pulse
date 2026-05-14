// Shared risk-math helpers for the Risk Analysis tab.
// Pure functions — no side effects, easy to unit test.

export interface HoldingMin {
  ticker: string;
  sector: string;
  country: string;
  marketValue: number;
}

// ── Concentration ────────────────────────────────────────────────────────────

export interface ConcentrationMetrics {
  hhi: number;                 // Herfindahl-Hirschman Index, 0–10000 (10000 = single stock)
  effectiveN: number;          // Effective number of holdings (1 / sum(w²))
  largestPct: number;          // Largest single position as % of portfolio
  top5Pct: number;             // Top 5 positions as % of portfolio
  top10Pct: number;            // Top 10 positions as % of portfolio
  positionCount: number;
}

export function computeConcentration(holdings: HoldingMin[]): ConcentrationMetrics {
  const total = holdings.reduce((s, h) => s + h.marketValue, 0);
  if (total === 0 || holdings.length === 0) {
    return { hhi: 0, effectiveN: 0, largestPct: 0, top5Pct: 0, top10Pct: 0, positionCount: 0 };
  }
  const weights = holdings.map(h => h.marketValue / total).sort((a, b) => b - a);
  const sumSq = weights.reduce((s, w) => s + w * w, 0);
  const top5  = weights.slice(0, 5).reduce((s, w) => s + w, 0);
  const top10 = weights.slice(0, 10).reduce((s, w) => s + w, 0);
  return {
    hhi: sumSq * 10000,
    effectiveN: 1 / sumSq,
    largestPct: weights[0] * 100,
    top5Pct: top5 * 100,
    top10Pct: top10 * 100,
    positionCount: holdings.length,
  };
}

// ── Risk score (1-10) ────────────────────────────────────────────────────────

export interface RiskScoreInputs {
  portfolioBeta: number;
  hhi: number;
  largestPct: number;
  sectorHhi: number;           // sector concentration HHI (same formula on sector weights)
  positionCount: number;
  annualVol?: number;          // optional, if returns available — annualized stdDev as decimal (0.15 = 15%)
  maxDrawdownPct?: number;     // optional, max drawdown over 1Y as positive decimal
}

export interface RiskScoreResult {
  score: number;               // 1–10, integer
  breakdown: {
    name: string;
    weight: number;            // contribution share (0–1, sums to 1)
    rawScore: number;          // 0–10 component score
  }[];
  topDriver: string;           // the single biggest contributor
}

/** Compute a composite 1–10 risk score from a weighted blend of sub-metrics. */
export function computeRiskScore(inp: RiskScoreInputs): RiskScoreResult {
  // Each component scored 0 (very safe) to 10 (very risky)
  const betaScore = clamp((inp.portfolioBeta - 0.5) / 1.5 * 10, 0, 10);
  const concScore = clamp(inp.hhi / 2500 * 10, 0, 10);               // HHI 2500 = high concentration
  const largestScore = clamp((inp.largestPct - 5) / 25 * 10, 0, 10); // 5% baseline, 30%+ = max
  const sectorScore = clamp(inp.sectorHhi / 3000 * 10, 0, 10);
  const diversifyScore = clamp((20 - inp.positionCount) / 18 * 10, 0, 10); // 2 pos = max risk, 20+ = 0
  const volScore = inp.annualVol !== undefined
    ? clamp((inp.annualVol - 0.10) / 0.30 * 10, 0, 10) // 10% vol → 0, 40% → 10
    : null;
  const ddScore = inp.maxDrawdownPct !== undefined
    ? clamp((inp.maxDrawdownPct - 0.05) / 0.40 * 10, 0, 10) // 5% DD → 0, 45% DD → 10
    : null;

  // Weights (sum to 1)
  const baseWeights = volScore !== null && ddScore !== null
    ? { beta: 0.15, conc: 0.15, largest: 0.15, sector: 0.10, diversify: 0.10, vol: 0.20, dd: 0.15 }
    : volScore !== null
    ? { beta: 0.20, conc: 0.20, largest: 0.15, sector: 0.10, diversify: 0.10, vol: 0.25, dd: 0 }
    : { beta: 0.30, conc: 0.25, largest: 0.20, sector: 0.15, diversify: 0.10, vol: 0, dd: 0 };

  const components: { name: string; weight: number; rawScore: number }[] = [
    { name: 'Market beta',         weight: baseWeights.beta,      rawScore: betaScore },
    { name: 'Position concentration', weight: baseWeights.conc,   rawScore: concScore },
    { name: 'Largest position',    weight: baseWeights.largest,   rawScore: largestScore },
    { name: 'Sector concentration', weight: baseWeights.sector,   rawScore: sectorScore },
    { name: 'Diversification',     weight: baseWeights.diversify, rawScore: diversifyScore },
  ];
  if (volScore !== null) components.push({ name: 'Volatility',      weight: baseWeights.vol, rawScore: volScore });
  if (ddScore  !== null) components.push({ name: 'Max drawdown',    weight: baseWeights.dd,  rawScore: ddScore });

  // Weighted sum
  const weighted = components.reduce((s, c) => s + c.weight * c.rawScore, 0);
  const score = Math.max(1, Math.min(10, Math.round(weighted)));

  // Top driver = component with highest weight × score contribution
  let topDriver = components[0].name;
  let topContrib = -1;
  for (const c of components) {
    const contrib = c.weight * c.rawScore;
    if (contrib > topContrib) { topContrib = contrib; topDriver = c.name; }
  }

  return { score, breakdown: components, topDriver };
}

// ── Geography ────────────────────────────────────────────────────────────────

export interface CountryRow {
  country: string;
  value: number;
  pct: number;
}

export function computeCountryExposure(holdings: HoldingMin[]): CountryRow[] {
  const total = holdings.reduce((s, h) => s + h.marketValue, 0);
  if (total === 0) return [];
  const map = new Map<string, number>();
  for (const h of holdings) {
    const c = (h.country || 'Unknown').toUpperCase();
    map.set(c, (map.get(c) ?? 0) + h.marketValue);
  }
  return [...map.entries()]
    .map(([country, value]) => ({ country, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

const DEVELOPED_MARKETS = new Set([
  'US', 'CA', 'GB', 'UK', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'SE', 'NO', 'DK', 'FI', 'AT',
  'AU', 'NZ', 'JP', 'HK', 'SG', 'IE', 'IL', 'KR', 'PT', 'GR', 'LU',
]);

export function isDeveloped(country: string): boolean {
  return DEVELOPED_MARKETS.has(country.toUpperCase());
}

// ── Returns-based risk metrics ───────────────────────────────────────────────

/** Annualised standard deviation from daily LOG returns. Assumes ~252 trading days. */
export function annualVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const m = returns.reduce((s, r) => s + r, 0) / returns.length;
  const v = returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length;
  return Math.sqrt(v) * Math.sqrt(252);
}

/** Annualised mean return from daily log returns. */
export function annualReturn(returns: number[]): number {
  if (returns.length === 0) return 0;
  const m = returns.reduce((s, r) => s + r, 0) / returns.length;
  return m * 252;
}

/** Sharpe ratio (annualised). Risk-free expressed as annual decimal. */
export function sharpe(returns: number[], riskFree = 0.05): number {
  const r = annualReturn(returns);
  const v = annualVolatility(returns);
  return v > 0 ? (r - riskFree) / v : 0;
}

/** Sortino ratio (annualised). Downside-only stdDev. */
export function sortino(returns: number[], riskFree = 0.05): number {
  if (returns.length === 0) return 0;
  const r = annualReturn(returns);
  const downside = returns.filter(x => x < 0);
  if (downside.length === 0) return r > 0 ? Infinity : 0;
  const ds = downside.reduce((s, x) => s + x * x, 0) / returns.length;
  const v = Math.sqrt(ds) * Math.sqrt(252);
  return v > 0 ? (r - riskFree) / v : 0;
}

// ── Value at Risk & CVaR ────────────────────────────────────────────────────

export interface VarMetrics {
  parametric95: number;    // 1-day parametric VaR at 95%, as decimal LOSS (positive number = loss)
  parametric99: number;
  historical95: number;    // 1-day historical VaR at 95%
  historical99: number;
  cvar95: number;          // 1-day historical CVaR (expected loss when VaR breached)
  cvar99: number;
  tenDay95: number;        // 10-day parametric VaR at 95% (scaled by √10)
  tenDay99: number;
}

// Z-scores for one-tailed normal distribution
const Z95 = 1.645;
const Z99 = 2.326;

export function computeVaR(returns: number[]): VarMetrics {
  if (returns.length < 30) {
    return { parametric95: 0, parametric99: 0, historical95: 0, historical99: 0,
             cvar95: 0, cvar99: 0, tenDay95: 0, tenDay99: 0 };
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const sd = Math.sqrt(variance);

  // Parametric (Gaussian) — VaR_α = −(μ − Z_α × σ); expressed as positive loss decimal
  const parametric95 = Math.max(0, -(mean - Z95 * sd));
  const parametric99 = Math.max(0, -(mean - Z99 * sd));

  // Historical — 5th and 1st percentile of sorted returns (negative tail)
  const sorted = [...returns].sort((a, b) => a - b);
  const idx95 = Math.floor(returns.length * 0.05);
  const idx99 = Math.floor(returns.length * 0.01);
  const historical95 = Math.max(0, -sorted[idx95]);
  const historical99 = Math.max(0, -sorted[idx99]);

  // CVaR — average of returns worse than VaR threshold
  const tail95 = sorted.slice(0, idx95 + 1);
  const tail99 = sorted.slice(0, idx99 + 1);
  const cvar95 = tail95.length > 0 ? Math.max(0, -tail95.reduce((s, r) => s + r, 0) / tail95.length) : 0;
  const cvar99 = tail99.length > 0 ? Math.max(0, -tail99.reduce((s, r) => s + r, 0) / tail99.length) : 0;

  // 10-day VaR — scale by √10 (assumes IID, simple but standard)
  const tenDay95 = parametric95 * Math.sqrt(10);
  const tenDay99 = parametric99 * Math.sqrt(10);

  return { parametric95, parametric99, historical95, historical99, cvar95, cvar99, tenDay95, tenDay99 };
}

// ── Drawdown ────────────────────────────────────────────────────────────────

export interface DrawdownPoint {
  date: string;
  cumReturn: number;     // 1.0 = no change, 1.10 = +10%
  drawdown: number;      // negative or zero (e.g. -0.15 = currently 15% below peak)
}

export interface DrawdownMetrics {
  series: DrawdownPoint[];
  maxDrawdownPct: number;     // positive decimal, e.g. 0.27 = 27%
  maxDrawdownDate: string;    // date of trough
  maxDrawdownDuration: number; // calendar days from peak to trough
  currentDrawdownPct: number;
  totalReturnPct: number;     // overall return over the series (decimal)
}

/** Compute a cumulative-return + drawdown series from daily LOG returns + dates. */
export function computeDrawdown(returns: number[], dates: string[]): DrawdownMetrics {
  if (returns.length === 0 || dates.length !== returns.length) {
    return { series: [], maxDrawdownPct: 0, maxDrawdownDate: '',
             maxDrawdownDuration: 0, currentDrawdownPct: 0, totalReturnPct: 0 };
  }
  const series: DrawdownPoint[] = [];
  let cumLog = 0;
  let peak = 1;
  let peakDate = dates[0];
  let maxDD = 0;
  let maxDDDate = dates[0];
  let maxDDPeakDate = dates[0];
  for (let i = 0; i < returns.length; i++) {
    cumLog += returns[i];
    const cum = Math.exp(cumLog);
    if (cum > peak) { peak = cum; peakDate = dates[i]; }
    const dd = (cum - peak) / peak; // ≤ 0
    if (dd < maxDD) { maxDD = dd; maxDDDate = dates[i]; maxDDPeakDate = peakDate; }
    series.push({ date: dates[i], cumReturn: cum, drawdown: dd });
  }
  const last = series[series.length - 1];
  const totalReturn = last.cumReturn - 1;
  const currentDD = last.drawdown;
  // Duration in calendar days
  const dur = maxDDDate && maxDDPeakDate
    ? Math.round((new Date(maxDDDate).getTime() - new Date(maxDDPeakDate).getTime()) / 86400000)
    : 0;
  return {
    series,
    maxDrawdownPct: Math.abs(maxDD),
    maxDrawdownDate: maxDDDate,
    maxDrawdownDuration: dur,
    currentDrawdownPct: Math.abs(currentDD),
    totalReturnPct: totalReturn,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
