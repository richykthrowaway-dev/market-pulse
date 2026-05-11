/**
 * Lightweight correlation helpers for the commodities driver block.
 *
 * No external deps — pure math.  Operates on `{ date, close }` time
 * series (matches EodBar shape).  Date-alignment is done by Map keys
 * so we don't require both series to have identical lengths.
 */

export interface DatedClose {
  date:  string;     // ISO YYYY-MM-DD
  close: number;
}

/**
 * Log returns of a series: r[i] = ln(close[i] / close[i-1]).
 * Returns an array of length (series.length - 1), keyed by the LATER
 * date so it aligns naturally with the consumer's expectations
 * ("return on day X" = move from day X-1 to day X).
 */
export function logReturns(series: DatedClose[]): DatedClose[] {
  const out: DatedClose[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].close;
    const curr = series[i].close;
    if (prev > 0 && curr > 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      out.push({ date: series[i].date, close: Math.log(curr / prev) });
    }
  }
  return out;
}

/**
 * Pearson correlation coefficient between two equal-length number arrays.
 * Returns null if either array has fewer than 2 elements or zero variance.
 */
export function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += x[i];
    sumY  += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const numerator   = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  return numerator / denominator;
}

/**
 * Compute rolling Pearson correlation between two log-return series over the
 * most recent `window` days where dates align.
 *
 * Steps:
 *   1. Index both series by date
 *   2. Walk a's dates in reverse, take the last `window` dates that exist in
 *      both series
 *   3. Pair up the values and call pearson()
 *
 * Returns null if there are fewer than `window` aligned dates.
 *
 * @param windowDays  Lookback window (default 30).  Trader convention is 30
 *                    for "current regime", 90 for "medium-term", 252 for
 *                    "long-term".
 */
export function rollingCorrelation(
  aReturns: DatedClose[],
  bReturns: DatedClose[],
  windowDays = 30,
): number | null {
  if (aReturns.length === 0 || bReturns.length === 0) return null;

  const bByDate = new Map(bReturns.map((r) => [r.date, r.close]));
  const aVals: number[] = [];
  const bVals: number[] = [];

  // Walk a's returns from newest to oldest, collecting up to `windowDays`
  // points where b also has a value for the same date.
  for (let i = aReturns.length - 1; i >= 0 && aVals.length < windowDays; i--) {
    const a = aReturns[i];
    const bv = bByDate.get(a.date);
    if (bv != null) {
      aVals.push(a.close);
      bVals.push(bv);
    }
  }

  if (aVals.length < windowDays) return null;
  return pearson(aVals, bVals);
}

/** Compact helper: take raw bars → returns → correlate vs a baseline. */
export function correlateAgainst(
  baselineReturns: DatedClose[],
  candidateBars:   DatedClose[],
  windowDays = 30,
): number | null {
  if (candidateBars.length < 2) return null;
  return rollingCorrelation(baselineReturns, logReturns(candidateBars), windowDays);
}
