import { useQuery } from '@tanstack/react-query';

/**
 * useMacroHeatmap — GDP growth (annual %) per country from EODHD.
 *
 * Used to shade globe country polygons from red (contraction) to green
 * (strong growth) when the macroHeatmap layer is active.
 *
 * staleTime: 24 hours — GDP data is annual, refreshed daily server-side.
 */

export interface MacroCountry {
  countryIso2: string;
  value:       number;   // GDP growth annual %
  year:        number;
}

export interface MacroHeatmapResponse {
  data:      MacroCountry[];
  timestamp: number;
}

const STALE = 24 * 60 * 60_000; // 24 hours — matches CACHE_TTL in api-macro-heatmap

export function useMacroHeatmap(enabled: boolean) {
  return useQuery<MacroHeatmapResponse>({
    queryKey:             ['macro-heatmap'],
    enabled,
    staleTime:            STALE,
    gcTime:               STALE * 2,
    refetchInterval:      false,   // No interval — daily data doesn't need polling
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID    as string)?.trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim();
      if (!projectId || !anonKey) {
        return { data: [], timestamp: Date.now() };
      }
      const url = `https://${projectId}.supabase.co/functions/v1/api-macro-heatmap`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      });
      if (!res.ok) return { data: [], timestamp: Date.now() };
      return (await res.json()) as MacroHeatmapResponse;
    },
  });
}
