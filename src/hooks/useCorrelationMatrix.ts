/**
 * useCorrelationMatrix — Pearson correlation of 3-month daily log returns.
 *
 * Two correctness requirements that the previous version missed:
 *
 *  1. Log returns, not price levels.
 *     Pearson on raw closes measures "do both stocks trend up together?"
 *     which is almost always true and useless. Pearson on log returns
 *     `ln(Pₜ/Pₜ₋₁)` measures "do their daily moves co-vary?" — stationary,
 *     mean-zero, and exactly what portfolio correlation means.
 *
 *  2. Exchange-aware Yahoo Finance symbols.
 *     Canadian stocks need `.TO`/`.V`, London needs `.L`, etc. Bare ticker
 *     lookups return 404 for foreign stocks, silently dropping them from the
 *     matrix. We reuse the same `toYahooSymbol()` helper that the
 *     TickerStyleEditor popover uses.
 */
import { useQuery } from '@tanstack/react-query';
import { toYahooSymbol } from '@/hooks/useTickerPerformance';

export interface HoldingPair {
  ticker:    string;
  exchange?: string;
}

export interface CorrelationMatrixResult {
  matrix:  number[][];
  tickers: string[];    // display labels (bare ticker, not Yahoo symbol)
}

// ── Math ──────────────────────────────────────────────────────────────────────

/** Convert a close-price series to log returns. */
function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) out.push(Math.log(curr / prev));
  }
  return out;
}

/** Pearson correlation of two equal-length arrays. Returns 0 if insufficient data. */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return 0;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const mx = sumX / n;
  const my = sumY / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchCloses(
  yahooSymbol: string,
  projectId:   string,
  anonKey:     string,
): Promise<number[]> {
  const url =
    `https://${projectId}.supabase.co/functions/v1/api-yahoo` +
    `?endpoint=chart&symbol=${encodeURIComponent(yahooSymbol)}&interval=1d&range=3mo`;
  try {
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const closes: number[] = Array.isArray(data?.closes) ? data.closes : [];
    return closes.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  } catch {
    return [];
  }
}

// ── Matrix computation ────────────────────────────────────────────────────────

async function computeMatrix(
  holdings: HoldingPair[],
): Promise<CorrelationMatrixResult> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  // Fetch all series in parallel using exchange-aware Yahoo symbols
  const allCloses = await Promise.all(
    holdings.map(({ ticker, exchange }) =>
      fetchCloses(toYahooSymbol(ticker, exchange), projectId, anonKey)
    )
  );

  // Convert to log returns and filter to tickers with enough history
  const MIN_RETURNS = 15; // ~3 weeks of trading days
  const valid = holdings
    .map(({ ticker }, i) => ({ ticker, returns: logReturns(allCloses[i]) }))
    .filter((x) => x.returns.length >= MIN_RETURNS);

  if (valid.length < 2) {
    return { matrix: [], tickers: [] };
  }

  // Align all return series to the shortest (right-aligned = most recent)
  const minLen  = Math.min(...valid.map((x) => x.returns.length));
  const aligned = valid.map((x) => x.returns.slice(x.returns.length - minLen));
  const labels  = valid.map((x) => x.ticker);

  const n = labels.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const r = pearson(aligned[i], aligned[j]);
        matrix[i][j] = r;
        matrix[j][i] = r; // symmetric
      }
    }
  }

  return { matrix, tickers: labels };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCorrelationMatrix(holdings: HoldingPair[]) {
  const sortedKey = holdings
    .map(({ ticker, exchange }) => `${ticker}:${exchange ?? ''}`)
    .sort()
    .join(',');

  return useQuery<CorrelationMatrixResult>({
    queryKey: ['correlation-matrix', sortedKey],
    queryFn:  () => computeMatrix(holdings),
    enabled:  holdings.length >= 2,
    staleTime: 10 * 60_000, // 10 min — intraday correlations don't shift quickly
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
