import { useQueries } from '@tanstack/react-query';
import type { EodhdEconomicEvent } from './useEodhdEconomicEvents';

/**
 * useGlobalPolicyEvents — pulls the next-7-days of high-impact macro events
 * across the world's major monetary blocs.
 *
 * ── Why a separate hook ────────────────────────────────────────────────────
 * `useEodhdEconomicEvents` is country-scoped (one ISO2 → one EODHD call).
 * The Trade Intel view wants a global policy ticker: "next Fed meeting, next
 * ECB decision, next BoJ rate call, plus headline GDP/CPI prints from major
 * economies."  We fan out one EODHD call per major country, in parallel via
 * React Query's `useQueries`, then merge and filter client-side.
 *
 * ── Cost ──────────────────────────────────────────────────────────────────
 * 7 EODHD credits per cold cache load (1 per country).  Cached 30 minutes
 * per country, shared across hook instances.  In practice the cache is warm
 * after the first user navigates anywhere with `useEodhdEconomicEvents`, so
 * incremental cost is near zero.
 *
 * ── Filtering ──────────────────────────────────────────────────────────────
 * Returns only events:
 *   - Within ±7 days of today
 *   - Impact === 'High' OR event type matches a keyword whitelist
 *     (rate decision / FOMC / GDP / CPI / unemployment / PMI / NFP)
 *
 * Sorted ascending by date so the consumer can split past vs upcoming on
 * its own.
 */

/**
 * Major monetary blocs whose calendars matter for global markets.
 * Ordered so the hook lazily warms higher-impact calendars first.
 */
const POLICY_COUNTRIES = ['US', 'EU', 'CN', 'JP', 'GB', 'IN', 'BR'] as const;

/** Substrings that qualify a medium-impact event for promotion. */
const POLICY_KEYWORDS = [
  'interest rate',
  'rate decision',
  'fomc',
  'ecb',
  'boe',
  'boj',
  'pboc',
  'gdp',
  'cpi',
  'inflation',
  'unemployment',
  'non-farm payroll',
  'nonfarm payroll',
  'nfp',
  'payroll',
  'pmi',
];

function matchesPolicyKeyword(type: string): boolean {
  const lower = type.toLowerCase();
  return POLICY_KEYWORDS.some(k => lower.includes(k));
}

export function useGlobalPolicyEvents() {
  const today = new Date();
  const from  = new Date(today.getTime() - 7  * 86_400_000).toISOString().split('T')[0];
  const to    = new Date(today.getTime() + 7  * 86_400_000).toISOString().split('T')[0];

  const queries = useQueries({
    queries: POLICY_COUNTRIES.map(country => ({
      queryKey: ['eodhd-economic-events', country, from, to],
      staleTime:            30 * 60_000,
      gcTime:               60 * 60_000,
      refetchOnWindowFocus: false,
      queryFn: async (): Promise<EodhdEconomicEvent[]> => {
        const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID        as string).trim();
        const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY  as string).trim();

        const params = new URLSearchParams({
          endpoint: 'economic-events',
          country,
          from,
          to,
          limit: '50',
        });

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/api-eodhd?${params}`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
        );

        if (!res.ok) throw new Error(`EODHD economic-events ${res.status}`);

        const raw = await res.json();
        const arr: any[] = Array.isArray(raw) ? raw : (raw?.events ?? []);

        return arr.map((e): EodhdEconomicEvent => ({
          date:          e.date          ?? '',
          country:       e.country       ?? country,
          type:          e.type          ?? e.event ?? '',
          actual:        e.actual        != null ? Number(e.actual)  : null,
          previous:      e.previous      != null ? Number(e.previous): null,
          change:        e.change        != null ? Number(e.change)  : null,
          changePercent: e.change_p      != null ? Number(e.change_p): null,
          estimate:      e.estimate      != null ? Number(e.estimate): null,
          impact:        e.impact        ?? null,
          unit:          e.unit          ?? null,
          currency:      e.currency      ?? null,
        }));
      },
    })),
  });

  const isLoading = queries.some(q => q.isLoading);
  const isError   = queries.every(q => q.isError);

  // Merge, filter, sort.
  const merged: EodhdEconomicEvent[] = [];
  for (const q of queries) {
    if (!q.data) continue;
    for (const ev of q.data) {
      if (ev.impact === 'High' || matchesPolicyKeyword(ev.type)) {
        merged.push(ev);
      }
    }
  }
  merged.sort((a, b) => a.date.localeCompare(b.date));

  return { data: merged, isLoading, isError };
}
