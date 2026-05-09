import { useQuery } from '@tanstack/react-query';
import { toIso3 } from '@/lib/iso3';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const ANON_KEY   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/api-wits`;

export type TradeDirection = 'exports' | 'imports';

export interface TradeProduct {
  /** HS Section code, e.g. "27-27_Fuels" */
  code: string;
  /** Human-readable name, e.g. "Fuels" */
  name: string;
  /** Trade value in USD (already converted from WITS' "thousands of USD") */
  valueUsd: number;
  /** Fraction of HS-section total (0..1). Sum of all visible shares ≈ 1.0. */
  share: number;
}

export interface TradeBreakdown {
  reporter:   string;     // ISO3
  direction:  TradeDirection;
  /** Year of the data — typically lags 1-2 years behind current. */
  year:       number | null;
  /** Sum of all HS-section values, in USD. Null when no data found. */
  totalUsd:   number | null;
  /** Products sorted by valueUsd descending. Empty array on no-data. */
  products:   TradeProduct[];
}

/**
 * Fetch a country's product-level export or import breakdown from the
 * World Bank's WITS Trade Stats API (proxied through our `api-wits`
 * edge function which handles SDMX parsing).
 *
 * The product breakdown uses HS Sections (`01-05_Animal`, `27-27_Fuels`,
 * `84-85_MachElec`, etc.) — ~16 mutually-exclusive categories that
 * partition all merchandise trade. Aggregates like "Total" and
 * "Manufactures" are filtered out server-side so percentages always
 * sum to ~100%.
 *
 * Cached 24 hours: trade data publishes annually with a 1-2 year lag,
 * so a fresh fetch within a day is wasteful.
 */
export function useTradeBreakdown(
  iso2: string | null,
  direction: TradeDirection,
) {
  const iso3 = toIso3(iso2);

  return useQuery<TradeBreakdown>({
    queryKey: ['trade-breakdown', iso3, direction],
    enabled: !!iso3,
    staleTime:            24 * 60 * 60_000,
    gcTime:               48 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TradeBreakdown> => {
      const empty: TradeBreakdown = {
        reporter: iso3 ?? '', direction, year: null, totalUsd: null, products: [],
      };
      if (!iso3) return empty;

      const params = new URLSearchParams({ reporter: iso3, direction });
      const url = `${ENDPOINT}?${params}`;

      try {
        const res = await fetch(url, {
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return empty;
        const json = await res.json();
        return {
          reporter:  json?.reporter  ?? iso3,
          direction,
          year:      typeof json?.year     === 'number' ? json.year : null,
          totalUsd:  typeof json?.totalUsd === 'number' ? json.totalUsd : null,
          products:  Array.isArray(json?.products) ? json.products : [],
        };
      } catch {
        return empty;
      }
    },
  });
}
