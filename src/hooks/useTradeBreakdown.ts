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
 * Fetch a country's product-level trade breakdown from the api-wits
 * edge function (proxies WITS for sections, Comtrade for chapters).
 *
 * @param level  'section' (default, ~16 broad HS Section categories from
 *               WITS — fastest, drives the headline stacked bar) or
 *               'chapter' (~99 HS 2-digit chapters from Comtrade — used
 *               by hover drill-downs to show what's inside each section).
 *
 * Cached 24 hours: trade data publishes annually with a 1-2 year lag,
 * so a fresh fetch within a day is wasteful.
 */
export function useTradeBreakdown(
  iso2: string | null,
  direction: TradeDirection,
  level: 'section' | 'chapter' | 'partners' | 'trend' | 'bilateral' = 'section',
  /**
   * Required when `level === 'bilateral'`.  ISO 3166-1 alpha-2 code of the
   * trade partner.  The edge function converts this to Comtrade's M49
   * numeric code and sets it as `partnerCode` so the returned product
   * breakdown reflects ONLY trade between the two countries (not vs world).
   */
  partner?: string | null,
) {
  const iso3 = toIso3(iso2);
  // Bilateral queries require BOTH reporter and partner — disable the query
  // until we have both.  Other levels only need the reporter.
  const ready = !!iso3 && (level !== 'bilateral' || !!partner);

  return useQuery<TradeBreakdown>({
    queryKey: ['trade-breakdown', iso3, direction, level, partner ?? null],
    enabled: ready,
    staleTime:            24 * 60 * 60_000,
    gcTime:               48 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TradeBreakdown> => {
      const empty: TradeBreakdown = {
        reporter: iso3 ?? '', direction, year: null, totalUsd: null, products: [],
      };
      if (!iso3) return empty;

      const params = new URLSearchParams({ reporter: iso3, direction, level });
      if (partner) params.set('partner', partner);
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
