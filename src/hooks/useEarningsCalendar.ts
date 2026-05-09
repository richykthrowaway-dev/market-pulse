import { useQuery } from '@tanstack/react-query';

export interface HoldingPair {
  ticker:    string;
  exchange?: string;
  /**
   * Optional GICS-style sector for the holding. Not used by the
   * earnings-calendar fetch itself — passed through so the rendering
   * component (e.g. <EarningsCalendar>) can color rows by sector
   * without needing a second data source.
   */
  sector?:   string | null;
}

export interface EarningsEvent {
  ticker:             string;
  earningsDate:       Date | null;
  epsEstimate:        number | null;
  epsLow:             number | null;
  epsHigh:            number | null;
  revenueEstimate:    number | null;
  trailingEps:        number | null;
  daysUntil:          number | null;
  beforeAfterMarket:  string | null;
}

// ── Symbol helpers ────────────────────────────────────────────────────

/**
 * Strip any exchange suffix to get a Finnhub-compatible ticker.
 * Finnhub uses bare US-style tickers (no .US, no .TO, no .L). For
 * non-US holdings the calendar still works for any symbol whose ticker
 * is unique enough — e.g. "BMW" might collide globally, but in
 * practice the bare-ticker form covers most US portfolios.
 */
function toFinnhubSymbol(ticker: string): string {
  return ticker.split('.')[0].toUpperCase();
}

// ── Date helper ───────────────────────────────────────────────────────

function dateToDays(dateStr: string): number {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  // Append noon UTC so the date doesn't shift when the local TZ is behind UTC
  const eventMs = new Date(`${dateStr}T12:00:00Z`).getTime();
  return Math.round((eventMs - todayMs) / 86_400_000);
}

// ── Finnhub raw response shape ────────────────────────────────────────

interface FinnhubEarningsItem {
  symbol:           string;
  date:             string;       // "YYYY-MM-DD"
  epsActual:        number | null;
  epsEstimate:      number | null;
  revenueActual:    number | null;
  revenueEstimate:  number | null;
  hour:             string | null; // "bmo" | "amc" | "" | null
  quarter:          number | null;
  year:             number | null;
}

// ── Fetcher ───────────────────────────────────────────────────────────

/**
 * Fetch upcoming earnings via Finnhub's calendar/earnings endpoint.
 *
 * Why Finnhub instead of EODHD:
 *   - Independent API quota; survives EODHD daily-credit exhaustion
 *     (which happens regularly on heavy fundamentals usage)
 *   - Returns BOTH revenue + EPS estimates (EODHD calendar/earnings
 *     only includes EPS; revenue is null in that path)
 *   - Single global call covers the whole portfolio — Finnhub returns
 *     all companies in the date range; we filter client-side. Avoids
 *     the per-symbol fan-out cost and bypasses Finnhub's per-symbol
 *     rate limit when the portfolio is large.
 *
 * The single-call-and-filter approach trades a bit of bandwidth (1500
 * events for 90 days = ~150 KB) for simplicity + speed. The response
 * is cached 10min via React Query so revisits within the cache window
 * are free.
 */
async function fetchEarningsCalendar(holdings: HoldingPair[]): Promise<EarningsEvent[]> {
  if (holdings.length === 0) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID  as string;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const base      = `https://${projectId}.supabase.co/functions/v1/api-finnhub`;
  const hdrs      = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const today  = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];

  // Build a portfolio symbol set for fast filtering.
  const portfolioTickers = new Set(
    holdings.map((h) => toFinnhubSymbol(h.ticker)),
  );

  try {
    const res = await fetch(
      `${base}?endpoint=calendar-earnings&from=${today}&to=${future}`,
      { headers: hdrs, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const items: FinnhubEarningsItem[] = Array.isArray(json?.earningsCalendar)
      ? json.earningsCalendar
      : [];

    return items
      .filter((item) => portfolioTickers.has((item.symbol ?? '').toUpperCase()))
      .map((item): EarningsEvent => {
        const dateStr = item.date || '';
        // Map Finnhub's `hour` ("bmo" / "amc" / "") to a standard form
        // matching EODHD's `before_after_market` so downstream UI doesn't
        // need to know which provider answered.
        const bam =
          item.hour === 'bmo' ? 'BeforeMarket'
            : item.hour === 'amc' ? 'AfterMarket'
            : null;

        return {
          ticker:            (item.symbol ?? '').toUpperCase(),
          earningsDate:      dateStr ? new Date(`${dateStr}T12:00:00Z`) : null,
          epsEstimate:       typeof item.epsEstimate === 'number' ? item.epsEstimate : null,
          epsLow:            null,
          epsHigh:           null,
          revenueEstimate:   typeof item.revenueEstimate === 'number' ? item.revenueEstimate : null,
          trailingEps:       null,
          daysUntil:         dateStr ? dateToDays(dateStr) : null,
          beforeAfterMarket: bam,
        };
      })
      .filter((e) => e.daysUntil !== null && e.daysUntil >= 0)
      .sort((a, b) => {
        if (!a.earningsDate) return 1;
        if (!b.earningsDate) return -1;
        return a.earningsDate.getTime() - b.earningsDate.getTime();
      });
  } catch {
    return [];
  }
}

// ── React Query hook ──────────────────────────────────────────────────

export function useEarningsCalendar(holdings: HoldingPair[]) {
  // Sorted-key dedup so two components asking for the same portfolio
  // share one network call. Includes ticker symbol only — exchange
  // doesn't affect Finnhub lookup.
  const sortedKey = holdings
    .map(({ ticker }) => toFinnhubSymbol(ticker))
    .sort()
    .join(',');

  return useQuery<EarningsEvent[]>({
    queryKey:             ['earnings-calendar-finnhub', sortedKey],
    queryFn:              () => fetchEarningsCalendar(holdings),
    enabled:              holdings.length > 0,
    staleTime:            10 * 60_000,   // 10 min — calendar updates slowly
    gcTime:               30 * 60_000,
    refetchOnWindowFocus: false,
    retry:                1,
  });
}
