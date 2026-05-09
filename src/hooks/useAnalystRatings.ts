import { useQuery } from '@tanstack/react-query';

export interface AnalystRating {
  ticker: string;
  recommendationKey: string | null;
  consensusLabel: string;
  recommendationMean: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  analystCount: number | null;
}

const CONSENSUS_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  underperform: 'Underperform',
  sell: 'Sell',
};

function toConsensusLabel(key: string | null): string {
  if (!key) return '—';
  return CONSENSUS_LABELS[key.toLowerCase()] ?? '—';
}

function rawNum(obj: unknown): number | null {
  if (obj && typeof obj === 'object' && 'raw' in obj) {
    const v = (obj as { raw: unknown }).raw;
    return typeof v === 'number' ? v : null;
  }
  return null;
}

async function fetchRatingForTicker(
  ticker: string,
  projectId: string,
  anonKey: string
): Promise<AnalystRating> {
  const url =
    `https://${projectId}.supabase.co/functions/v1/api-yahoo` +
    `?endpoint=quoteSummary&symbol=${encodeURIComponent(ticker)}&modules=financialData,recommendationTrend`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.warn(`useAnalystRatings: ${ticker} returned ${res.status}`);
      return nullRating(ticker);
    }

    const json = await res.json();
    const fd = json?.financialData ?? {};

    const recommendationKey: string | null =
      typeof fd.recommendationKey === 'string' && fd.recommendationKey
        ? fd.recommendationKey
        : null;

    return {
      ticker: ticker.toUpperCase(),
      recommendationKey,
      consensusLabel: toConsensusLabel(recommendationKey),
      recommendationMean: rawNum(fd.recommendationMean),
      targetMeanPrice: rawNum(fd.targetMeanPrice),
      targetHighPrice: rawNum(fd.targetHighPrice),
      targetLowPrice: rawNum(fd.targetLowPrice),
      analystCount: rawNum(fd.numberOfAnalystOpinions),
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
 * Data is sourced from Yahoo Finance via the `api-yahoo` edge function
 * (quoteSummary with financialData + recommendationTrend modules).
 * Tickers without ratings (ETFs, small caps) return null fields and
 * a consensusLabel of "—".
 *
 * Stale time: 1 hour — analyst ratings change infrequently.
 */
export function useAnalystRatings(tickers: string[]) {
  const sortedKey = tickers
    .map((t) => t.toUpperCase())
    .sort()
    .join(',');

  return useQuery<Record<string, AnalystRating>>({
    queryKey: ['analyst-ratings', sortedKey],
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
 * "strong_buy" | "buy"         → "text-emerald-400"
 * "hold"                       → "text-amber-400"
 * "underperform" | "sell"      → "text-rose-400"
 * null / unknown               → "text-muted-foreground"
 */
export function analystColor(key: string | null): string {
  if (!key) return 'text-muted-foreground';
  const normalized = key.toLowerCase();
  if (normalized === 'strong_buy' || normalized === 'buy') return 'text-emerald-400';
  if (normalized === 'hold') return 'text-amber-400';
  if (normalized === 'underperform' || normalized === 'sell') return 'text-rose-400';
  return 'text-muted-foreground';
}
