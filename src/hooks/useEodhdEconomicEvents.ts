import { useQuery } from '@tanstack/react-query';

export interface EodhdEconomicEvent {
  date: string;          // "YYYY-MM-DD HH:MM:SS" UTC
  country: string;       // ISO2, e.g. "US"
  type: string;          // event name, e.g. "GDP Growth Rate QoQ"
  actual: number | null;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  estimate: number | null;  // consensus forecast
  impact: 'High' | 'Medium' | 'Low' | null;
  unit: string | null;      // e.g. "%", "B", "K"
  currency: string | null;
}

/**
 * Fetch upcoming (and recent past) economic events for a country from EODHD.
 *
 * Shows GDP, CPI, unemployment, interest-rate, PMI releases etc. with
 * actual / forecast / previous values — a proper economic calendar.
 *
 * Cost: 1 EODHD credit per call. 30-min staleTime to avoid repeat burns.
 */
export function useEodhdEconomicEvents(iso2: string | null) {
  // Fetch ±30 days window: past releases have actuals, future have estimates
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];

  return useQuery<EodhdEconomicEvent[]>({
    queryKey: ['eodhd-economic-events', iso2, from, to],
    enabled:  !!iso2,
    staleTime:            30 * 60_000,
    gcTime:               60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EodhdEconomicEvent[]> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      const params = new URLSearchParams({
        endpoint: 'economic-events',
        country:  iso2!.toUpperCase(),
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
        country:       e.country       ?? iso2 ?? '',
        type:          e.type          ?? e.event ?? '',
        actual:        e.actual        != null ? Number(e.actual)  : null,
        previous:      e.previous      != null ? Number(e.previous): null,
        change:        e.change        != null ? Number(e.change)  : null,
        changePercent: e.change_p      != null ? Number(e.change_p): null,
        estimate:      e.estimate      != null ? Number(e.estimate): null,
        impact:        e.impact        ?? null,
        unit:          e.unit          ?? null,
        currency:      e.currency      ?? null,
      })).sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
