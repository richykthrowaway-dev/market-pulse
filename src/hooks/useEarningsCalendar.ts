import { useQuery } from '@tanstack/react-query';

export interface HoldingPair {
  ticker:    string;
  exchange?: string;
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

// ── EODHD raw response shape ───────────────────────────────────────────────────

interface EodhdEarningsItem {
  code:                string;
  report_date:         string;
  date:                string;
  before_after_market: string | null;
  currency:            string;
  actual:              number | null;
  estimate:            number | null;
  difference:          number | null;
  percent:             number | null;
}

// ── Symbol helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a bare ticker + IBKR exchange code to the EODHD symbol format.
 * EODHD uses suffixes identical to Yahoo Finance in most cases.
 */
function toEodhdSymbol(ticker: string, exchange?: string): string {
  const ex = (exchange ?? '').toUpperCase();
  if (ex === 'TSE'  || ex === 'TSX'  || ex === 'TORONTO')   return `${ticker}.TO`;
  if (ex === 'VENTURE' || ex === 'TSXV' || ex === 'TSX-V')  return `${ticker}.V`;
  if (ex === 'LSE'  || ex === 'LONDON')                      return `${ticker}.L`;
  if (ex === 'ASX')                                          return `${ticker}.AU`;
  if (ex === 'FRA'  || ex === 'FRANKFURT')                   return `${ticker}.F`;
  if (ex === 'XETRA')                                        return `${ticker}.XETRA`;
  if (ex === 'EPA'  || ex === 'PARIS')                       return `${ticker}.PA`;
  // US exchanges (NASDAQ, NYSE, ARCA, BATS…) — EODHD uses .US suffix
  return `${ticker}.US`;
}

// ── Date helper ────────────────────────────────────────────────────────────────

function dateToDays(dateStr: string): number {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  // Append noon UTC so the date doesn't shift when the local TZ is behind UTC
  const eventMs = new Date(`${dateStr}T12:00:00Z`).getTime();
  return Math.round((eventMs - todayMs) / 86_400_000);
}

// ── Fetch all holdings in a single EODHD batch request ────────────────────────

async function fetchEarningsCalendar(holdings: HoldingPair[]): Promise<EarningsEvent[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID  as string;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const base      = `https://${projectId}.supabase.co/functions/v1/api-eodhd`;
  const hdrs      = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  // Build a reverse-lookup map: EODHD symbol → original ticker
  const symbolMap = new Map<string, string>();
  for (const { ticker, exchange } of holdings) {
    symbolMap.set(toEodhdSymbol(ticker, exchange), ticker);
  }

  const today  = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];
  const symbolsParam = [...symbolMap.keys()].join(',');

  const url =
    `${base}?endpoint=earnings` +
    `&symbols=${encodeURIComponent(symbolsParam)}` +
    `&from=${today}&to=${future}`;

  try {
    const res = await fetch(url, {
      headers: hdrs,
      signal:  AbortSignal.timeout(15_000),
    });

    if (!res.ok) return [];

    const json = await res.json();

    // EODHD wraps results under { earnings: [...] }; fall back to bare array
    const items: EodhdEarningsItem[] =
      json?.earnings ?? (Array.isArray(json) ? json : []);

    return items
      .map((item): EarningsEvent => {
        const dateStr = item.report_date || item.date || '';
        const originalTicker =
          symbolMap.get(item.code) ??
          item.code.split('.')[0];

        return {
          ticker:            originalTicker,
          earningsDate:      dateStr ? new Date(`${dateStr}T12:00:00Z`) : null,
          epsEstimate:       typeof item.estimate === 'number' ? item.estimate : null,
          epsLow:            null,
          epsHigh:           null,
          revenueEstimate:   null,
          trailingEps:       null,
          daysUntil:         dateStr ? dateToDays(dateStr) : null,
          beforeAfterMarket: item.before_after_market ?? null,
        };
      })
      .filter(e => e.daysUntil !== null && e.daysUntil >= 0)
      .sort((a, b) => {
        if (!a.earningsDate) return 1;
        if (!b.earningsDate) return -1;
        return a.earningsDate.getTime() - b.earningsDate.getTime();
      });

  } catch {
    return [];
  }
}

// ── React Query hook ───────────────────────────────────────────────────────────

export function useEarningsCalendar(holdings: HoldingPair[]) {
  const sortedKey = holdings
    .map(({ ticker, exchange }) => `${ticker}:${exchange ?? ''}`)
    .sort()
    .join(',');

  return useQuery<EarningsEvent[]>({
    queryKey:            ['earnings-calendar-eodhd', sortedKey],
    queryFn:             () => fetchEarningsCalendar(holdings),
    enabled:             holdings.length > 0,
    staleTime:           10 * 60_000,   // 10 min — EODHD calendar updates infrequently
    gcTime:              30 * 60_000,
    refetchOnWindowFocus: false,
    retry:               1,
  });
}
