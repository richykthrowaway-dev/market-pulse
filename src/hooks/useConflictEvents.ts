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

// staleTime matches the server-side module cache TTL in api-conflicts (5 min).
// The edge function serves all users from a single in-process cache per
// Deno isolate, so the client only re-fetches when the server data is fresh.
const STALE = 5 * 60_000; // 5 min — matches CONFLICTS_TTL in api-conflicts

/**
 * @param enabled  Gate the network call.  When false (the layer is off
 *                 or the Trade tab is hidden), no fetch fires and the
 *                 5-minute background poller is disabled.  Defaults to
 *                 true for any existing callers that haven't migrated.
 */
export function useConflictEvents(enabled: boolean = true) {
  return useQuery<ConflictEventsResponse>({
    queryKey:             ['conflict-events'],
    enabled,
    staleTime:            STALE,
    gcTime:               STALE * 2,
    // Only auto-refresh while the consumer is actually using the data.
    // Otherwise we'd burn an edge-function invocation every 5 min, per
    // user, for the entire session.
    refetchInterval:      enabled ? STALE : false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        return { events: [], sources: [], timestamp: Date.now() };
      }
      const url = `https://${projectId}.supabase.co/functions/v1/api-conflicts`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) {
        return { events: [], sources: [], timestamp: Date.now() };
      }
      return (await res.json()) as ConflictEventsResponse;
    },
  });
}
