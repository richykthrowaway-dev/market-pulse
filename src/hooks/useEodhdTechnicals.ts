import { useQuery } from '@tanstack/react-query';

/**
 * EODHD technical indicators (RSI / SMA-50 / SMA-200) for a symbol.
 *
 * Fires three parallel calls to /technical with different `function`
 * parameters.  EODHD prices technical indicators at 5 credits per call
 * (vs 1 for plain EOD), so we cache aggressively — staleTime 1h — and
 * only fetch for the SELECTED commodity, never per-tile.
 *
 * Each call returns an array of `{ date, value }` ascending; we pick the
 * last entry as the "current" reading.  The 14-period RSI lookback is
 * universal trader convention.  SMA-50 = "trend filter"; SMA-200 =
 * "regime filter".
 */

const PROJECT_ID = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
const ANON_KEY   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();

/** Shape of one technical row from EODHD. */
interface TechRow {
  date:  string;
  value: number;
}

export interface EodhdTechnicals {
  /** Current RSI (14-period).  null if unavailable. */
  rsi:     number | null;
  /** Current 50-day SMA value (USD).  null if unavailable. */
  sma50:   number | null;
  /** Current 200-day SMA value (USD).  null if unavailable. */
  sma200:  number | null;
  /** Date of the latest reading (any indicator).  YYYY-MM-DD. */
  asOf:    string | null;
}

async function fetchOne(
  symbol: string,
  fn:     'rsi' | 'sma',
  period: number,
): Promise<TechRow[]> {
  if (!PROJECT_ID || !ANON_KEY) return [];
  const params = new URLSearchParams({
    endpoint: 'technical',
    symbol,
    function: fn,
    period:   String(period),
    order:    'd',     // descending — latest first
  });
  try {
    const res = await fetch(
      `https://${PROJECT_ID}.supabase.co/functions/v1/api-eodhd?${params}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r: any): TechRow => ({
        date:  r.date  ?? '',
        value: typeof r.value === 'number' ? r.value : Number(r.value),
      }))
      .filter((r) => r.date && Number.isFinite(r.value));
  } catch {
    return [];
  }
}

/**
 * @param symbol    EODHD symbol component (e.g. "GLD"); full ticker is built
 *                  with exchange below
 * @param exchange  EODHD exchange suffix (e.g. "US")
 * @param enabled   Gate the fetch — pass false when no commodity is selected
 */
export function useEodhdTechnicals(
  symbol:   string | null,
  exchange: string = 'US',
  enabled:  boolean = true,
) {
  const full = symbol ? `${symbol}.${exchange}` : null;

  return useQuery<EodhdTechnicals>({
    queryKey: ['eodhd-technicals', full],
    enabled:  enabled && !!full,
    // EODHD technicals are 5-credit calls; cache hard.
    staleTime:            60 * 60_000,         // 1 hour
    gcTime:               4 * 60 * 60_000,     // 4 hours
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EodhdTechnicals> => {
      if (!full) return { rsi: null, sma50: null, sma200: null, asOf: null };

      const [rsiRows, sma50Rows, sma200Rows] = await Promise.all([
        fetchOne(full, 'rsi', 14),
        fetchOne(full, 'sma', 50),
        fetchOne(full, 'sma', 200),
      ]);

      const rsiLatest   = rsiRows[0];
      const sma50Latest = sma50Rows[0];
      const sma200Latest = sma200Rows[0];

      // Most-recent date across the three series — they should agree
      // on the latest EOD bar but RSI sometimes lags by a day.
      const dates = [rsiLatest?.date, sma50Latest?.date, sma200Latest?.date]
        .filter((d): d is string => !!d)
        .sort();
      const asOf = dates.length > 0 ? dates[dates.length - 1] : null;

      return {
        rsi:    rsiLatest?.value    ?? null,
        sma50:  sma50Latest?.value  ?? null,
        sma200: sma200Latest?.value ?? null,
        asOf,
      };
    },
  });
}
