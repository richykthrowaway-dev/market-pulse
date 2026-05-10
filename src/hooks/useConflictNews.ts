import { useQuery } from '@tanstack/react-query';
import type { ConflictEvent } from './useConflictEvents';
import { COUNTRY_META } from '@/data/countryMeta';

/**
 * useConflictNews — fetches recent English-language news articles about
 * a conflict event's country via the `api-conflict-news` Supabase edge fn.
 *
 * Cached for 30 minutes per country — news doesn't change that fast and
 * we don't want to hammer GDELT on every card open.
 */

export interface ConflictNewsArticle {
  url:          string;
  title:        string;
  /** GDELT compact timestamp: "20241215T120000Z" */
  seendate:     string;
  domain:       string;
  socialimage?: string | null;
}

export function useConflictNews(event: ConflictEvent | null) {
  const countryName =
    (event?.countryIso2 ? COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2 : null) ?? '';

  return useQuery<ConflictNewsArticle[]>({
    queryKey:             ['conflict-news', event?.countryIso2],
    enabled:              !!event && !!countryName,
    staleTime:            30 * 60_000,
    gcTime:               60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) return [];

      const url = `https://${projectId}.supabase.co/functions/v1/api-conflict-news` +
                  `?country=${encodeURIComponent(countryName)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) return [];

      const data = await res.json();
      return (data.articles ?? []) as ConflictNewsArticle[];
    },
  });
}
