import { useQuery } from '@tanstack/react-query';
import { ISO2_TO_ISO3, fetchIndicator } from './useEodhdMacro';

/**
 * A trade-focused snapshot of a country's external sector.
 *
 * Sourced from EODHD's macro-indicator endpoint, which compiles World
 * Bank data plus secondary government sources. Trade indicators are
 * reported annually with a ~12-month publication lag, so the most
 * recent year's `date` will typically be 1-2 calendar years behind the
 * current year — that's a property of the underlying World Bank data,
 * not an issue with the fetch.
 */
export interface TradeSnapshot {
  /** Current account balance as % of GDP — net trade-balance proxy */
  currentAccount:    { value: number | null; date: string | null };
  /** Exports of goods + services as % of GDP */
  exportsPctGdp:     { value: number | null; date: string | null };
  /** Imports of goods + services as % of GDP */
  importsPctGdp:     { value: number | null; date: string | null };
  /** High-tech as % of total manufactured exports — competitiveness signal */
  highTechExports:   { value: number | null; date: string | null };
}

/**
 * Fetch a country's trade-and-external-sector snapshot from EODHD.
 *
 * Cost: 4 EODHD calls per country (1 per indicator), fanned out in
 * parallel. Cached 1 hour because trade data is annual — a fresh fetch
 * inside the same hour would be wasteful.
 *
 * Mirrors the pattern of useEodhdMacro exactly so the two hooks share
 * the same ISO2→ISO3 mapping, fetchIndicator helper, error handling,
 * and React Query lifecycle.
 */
export function useEodhdTrade(iso2: string | null) {
  const iso3 = iso2 ? (ISO2_TO_ISO3[iso2] ?? null) : null;

  return useQuery<TradeSnapshot>({
    queryKey: ['eodhd-trade', iso3],
    enabled: !!iso3,
    staleTime:            60 * 60_000,        // 1 hour
    gcTime:               4 * 60 * 60_000,    // keep 4h after stale
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TradeSnapshot> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      // 4 indicators × 1 credit = 4 EODHD credits per country click.
      // Run in parallel so the wall-time matches a single fetch.
      const [ca, exp, imp, hte] = await Promise.all([
        fetchIndicator(projectId, anonKey, iso3!, 'current_account_percent_gdp'),
        fetchIndicator(projectId, anonKey, iso3!, 'exports_of_goods_services_percent_gdp'),
        fetchIndicator(projectId, anonKey, iso3!, 'imports_of_goods_services_percent_gdp'),
        fetchIndicator(projectId, anonKey, iso3!, 'high_technology_exports_percent_total'),
      ]);

      return {
        currentAccount:  { value: ca?.Value  ?? null, date: ca?.Date  ?? null },
        exportsPctGdp:   { value: exp?.Value ?? null, date: exp?.Date ?? null },
        importsPctGdp:   { value: imp?.Value ?? null, date: imp?.Date ?? null },
        highTechExports: { value: hte?.Value ?? null, date: hte?.Date ?? null },
      };
    },
  });
}
