import { useQuery } from '@tanstack/react-query';

/**
 * useConflictEvents — geocoded events from ACLED + GDELT.
 *
 * Backed by the `api-conflicts` Supabase edge function which merges:
 *   - ACLED (last 14 days, fatalities ≥ 1) — requires ACLED_API_KEY env
 *   - GDELT (last 24h, armed-conflict theme) — no key, always on
 *
 * Refetches every 15 minutes (matches GDELT's update cadence).
 * Tolerates upstream failures: returns [] on error so the layer just hides.
 */

export interface ConflictEvent {
  id:          string;
  date:        string;
  lat:         number;
  lng:         number;
  /** ISO 3166-1 alpha-2 country code (uppercase). May be empty for GDELT events. */
  countryIso2: string;
  eventType:   string;
  /** Estimated fatalities, 0 if unknown. */
  fatalities:  number;
  notes:       string;
  sourceUrl:   string;
  source:      'acled' | 'gdelt' | 'baseline';
}

export interface ConflictEventsResponse {
  events:    ConflictEvent[];
  sources:   string[];
  timestamp: number;
}

export function useConflictEvents() {
  return useQuery<ConflictEventsResponse>({
    queryKey:             ['conflict-events'],
    staleTime:            15 * 60_000,
    gcTime:               30 * 60_000,
    refetchInterval:      15 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        // eslint-disable-next-line no-console
        console.warn('[useConflictEvents] missing env vars', { hasProjectId: !!projectId, hasAnonKey: !!anonKey });
        return { events: [], sources: [], timestamp: Date.now() };
      }

      const url = `https://${projectId}.supabase.co/functions/v1/api-conflicts`;
      // eslint-disable-next-line no-console
      console.log('[useConflictEvents] fetching', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('[useConflictEvents] fetch failed', res.status, res.statusText);
        return { events: [], sources: [], timestamp: Date.now() };
      }
      const json = (await res.json()) as ConflictEventsResponse;
      // eslint-disable-next-line no-console
      console.log('[useConflictEvents] received', { eventCount: json.events.length, sources: json.sources });
      return json;
    },
  });
}
