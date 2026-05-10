import { useQuery } from '@tanstack/react-query';

/**
 * useEconomicEvents — upcoming macro calendar releases from EODHD.
 *
 * Proxied via api-economic-events Supabase edge function which:
 *   - Fetches a 14-day rolling window
 *   - Filters to medium/high impact events only (CPI, NFP, GDP, PMIs, rate decisions)
 *   - Returns country centroids so events can be plotted on the globe
 *
 * staleTime matches the 1-hour server-side module cache in the edge function.
 */

export interface EconomicEvent {
  id:          string;
  type:        string;
  country:     string;  // ISO2
  date:        string;  // ISO datetime
  period:      string | null;
  comparison:  string | null;
  actual:      number | null;
  previous:    number | null;
  estimate:    number | null;
  importance:  'high' | 'medium' | 'low';
  lat:         number;
  lng:         number;
}

export interface EconomicEventsResponse {
  events:    EconomicEvent[];
  timestamp: number;
}

const STALE = 60 * 60_000; // 1 hour — matches CACHE_TTL in api-economic-events

export function useEconomicEvents(enabled: boolean) {
  return useQuery<EconomicEventsResponse>({
    queryKey:             ['economic-events'],
    enabled,
    staleTime:            STALE,
    gcTime:               STALE * 2,
    refetchInterval:      enabled ? STALE : false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        return { events: [], timestamp: Date.now() };
      }
      const url = `https://${projectId}.supabase.co/functions/v1/api-economic-events`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) return { events: [], timestamp: Date.now() };
      return (await res.json()) as EconomicEventsResponse;
    },
  });
}
