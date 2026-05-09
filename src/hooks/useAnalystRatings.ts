import { useQuery } from '@tanstack/react-query';

export interface AnalystRating {
  ticker: string;
  recommendationKey: string | null;
  consensusLabel: string;
  /** 1.0 = Strong Buy, 5.0 = Strong Sell (Yahoo-style scale) */
  recommendationMean: number | null;
  /** Price targets — not available from Finnhub free tier; always null. */
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  /** Total number of analysts contributing to the consensus */
  analystCount: number | null;
}

const CONSENSUS_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  underperform: 'Underperform',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
};

function toConsensusLabel(key: string | null): string {
  if (!key) return '—';
  return CONSENSUS_LABELS[key.toLowerCase()] ?? '—';
}

/**
 * Convert a Finnhub recommendation row → Yahoo-style {key, mean, count}.
 *
 * Finnhub returns counts per bucket (strongBuy/buy/hold/sell/strongSell).
 * Yahoo's recommendationMean is a weighted average on a 1–5 scale where:
 *   1 = Strong Buy, 2 = Buy, 3 = Hold, 4 = Underperform/Sell, 5 = Strong Sell.
 *
 * Bucket → recommendationKey mapping based on the weighted mean:
 *   ≤ 1.5 strong_buy · ≤ 2.5 buy · ≤ 3.5 hold · ≤ 4.5 sell · else strong_sell.
 */
function finnhubToConsensus(row: {
  strongBuy: number; buy: number; hold: number; sell: number; strongSell: number;
}): { key: string | null; mean: number | null; count: number } {
  const { strongBuy, buy, hold, sell, strongSell } = row;
  const count = strongBuy + buy + hold + sell + strongSell;
  if (count === 0) return { key: null, mean: null, count: 0 };

  const mean =
    (strongBuy * 1 + buy * 2 + hold * 3 + sell * 4 + strongSell * 5) / count;

  let key: string;
  if      (mean <= 1.5) key = 'strong_buy';
  else if (mean <= 2.5) key = 'buy';
  else if (mean <= 3.5) key = 'hold';
  else if (mean <= 4.5) key = 'sell';
  else                  key = 'strong_sell';

  return { key, mean, count };
}

async function fetchRatingForTicker(
  ticker: string,
  projectId: string,
  anonKey: string
): Promise<AnalystRating> {
  const url =
    `https://${projectId}.supabase.co/functions/v1/api-finnhub` +
    `?endpoint=recommendation&symbol=${encodeURIComponent(ticker)}`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`useAnalystRatings: ${ticker} returned ${res.status}`);
      return nullRating(ticker);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return nullRating(ticker);

    // Finnhub returns rows newest-first; index 0 is the most recent month.
    const latest = rows[0];
    const { key, mean, count } = finnhubToConsensus(latest);

    return {
      ticker: ticker.toUpperCase(),
      recommendationKey: key,
      consensusLabel: toConsensusLabel(key),
      recommendationMean: mean,
      targetMeanPrice: null,   // Not available on Finnhub free tier
      targetHighPrice: null,
      targetLowPrice: null,
      analystCount: count,
    };
  } catch (err) {
    console.warn(`useAnalystRatings: failed to fetch ${ticker}`, err);
    return nullRating(ticker);
  }
}

function nullRating(ticker: string): AnalystRating {
  return {
    ticker: ticker.toUpperCase(),
    recommendationKey: null,
    consensusLabel: '—',
    recommendationMean: null,
    targetMeanPrice: null,
    targetHighPrice: null,
    targetLowPrice: null,
    analystCount: null,
  };
}

async function fetchAllRatings(
  tickers: string[],
  projectId: string,
  anonKey: string
): Promise<Record<string, AnalystRating>> {
  const BATCH_SIZE = 5;
  const results: AnalystRating[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((ticker) => fetchRatingForTicker(ticker, projectId, anonKey))
    );
    results.push(...batchResults);
  }

  const out: Record<string, AnalystRating> = {};
  for (const rating of results) {
    out[rating.ticker.toUpperCase()] = rating;
  }
  return out;
}

/**
 * Fetch analyst consensus ratings for a list of tickers.
 *
 * Source: Finnhub `/stock/recommendation` (via the `api-finnhub` edge function).
 * Yahoo's v10/quoteSummary used to provide this but Yahoo has killed v10 — see
 * the api-yahoo edge function comments for context. Finnhub's free tier provides
 * monthly buy/hold/sell counts which we collapse into a Yahoo-style consensus.
 *
 * Note: price targets (mean/high/low) are NOT available on Finnhub free tier
 * and always come back as `null`. Callers that need price targets should use
 * EODHD fundamentals (`AnalystRatings.TargetPrice`) — at 10 credits per call.
 *
 * Stale time: 1 hour — analyst ratings change infrequently.
 */
export function useAnalystRatings(tickers: string[]) {
  const sortedKey = tickers
    .map((t) => t.toUpperCase())
    .sort()
    .join(',');

  return useQuery<Record<string, AnalystRating>>({
    // Bumped to v2 so users with the broken Yahoo-quoteSummary cache get fresh data
    queryKey: ['analyst-ratings-v2', sortedKey],
    queryFn: async () => {
      if (tickers.length === 0) return {};

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      return fetchAllRatings(tickers, projectId, anonKey);
    },
    enabled: tickers.length > 0,
    staleTime: 60 * 60_000, // 1 hour
    refetchOnWindowFocus: false,
  });
}

/**
 * Returns a Tailwind text-color class for a given recommendationKey.
 *
 * "strong_buy" | "buy"             → "text-emerald-400"
 * "hold"                           → "text-amber-400"
 * "underperform" | "sell" | "strong_sell" → "text-rose-400"
 * null / unknown                   → "text-muted-foreground"
 */
export function analystColor(key: string | null): string {
  if (!key) return 'text-muted-foreground';
  const normalized = key.toLowerCase();
  if (normalized === 'strong_buy' || normalized === 'buy') return 'text-emerald-400';
  if (normalized === 'hold') return 'text-amber-400';
  if (normalized === 'underperform' || normalized === 'sell' || normalized === 'strong_sell') return 'text-rose-400';
  return 'text-muted-foreground';
}
