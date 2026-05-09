import { useQuery } from '@tanstack/react-query';

/** Single data point returned by the macro-indicator endpoint. */
export interface MacroDataPoint {
  Date: string;     // "YYYY-MM-DD"
  Period: string;   // e.g. "2023"
  Value: number;
  CountryCode: string;
  Indicator: string;
}

export interface MacroSnapshot {
  gdpGrowth:    { value: number | null; date: string | null };
  inflation:    { value: number | null; date: string | null };
  unemployment: { value: number | null; date: string | null };
  interestRate: { value: number | null; date: string | null };
}

/**
 * ISO 3166-1 alpha-2 → alpha-3 map for EODHD macro-indicator endpoint.
 * EODHD requires the 3-letter country code in the URL path.
 *
 * Exported so other EODHD macro-indicator hooks (useEodhdTrade, etc.)
 * can reuse the same mapping rather than duplicate it.
 */
export const ISO2_TO_ISO3: Record<string, string> = {
  US: 'USA', GB: 'GBR', DE: 'DEU', JP: 'JPN', CA: 'CAN', AU: 'AUS',
  FR: 'FRA', HK: 'HKG', CN: 'CHN', IN: 'IND', KR: 'KOR', BR: 'BRA',
  IT: 'ITA', ES: 'ESP', NL: 'NLD', CH: 'CHE', SG: 'SGP', ZA: 'ZAF',
  MX: 'MEX', SE: 'SWE', NO: 'NOR', DK: 'DNK', AT: 'AUT', BE: 'BEL',
  PL: 'POL', RU: 'RUS', TR: 'TUR', AR: 'ARG', CL: 'CHL', CO: 'COL',
  EG: 'EGY', ID: 'IDN', IL: 'ISR', MY: 'MYS', NG: 'NGA', NZ: 'NZL',
  PE: 'PER', PH: 'PHL', PK: 'PAK', QA: 'QAT', SA: 'SAU', TH: 'THA',
  TW: 'TWN', UA: 'UKR', VN: 'VNM', GH: 'GHA', KE: 'KEN', PT: 'PRT',
  GR: 'GRC', IE: 'IRL', FI: 'FIN', HU: 'HUN', CZ: 'CZE', RO: 'ROU',
  AE: 'ARE', KW: 'KWT', BH: 'BHR', OM: 'OMN', JO: 'JOR',
};

/**
 * Fetch the most recent value for a single macro indicator + ISO3 country.
 * Returns null on any error or empty response — never throws.
 *
 * Exported for reuse by sibling hooks (useEodhdTrade, etc.) that need to
 * fan out across the same `/api/macro-indicator/{ISO3}?indicator=...`
 * endpoint with different indicator codes.
 */
export async function fetchIndicator(
  projectId: string,
  anonKey: string,
  iso3: string,
  indicator: string,
): Promise<MacroDataPoint | null> {
  try {
    const params = new URLSearchParams({
      endpoint: 'macro-indicator',
      country: iso3,
      indicator,
    });
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/api-eodhd?${params}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return null;
    const data: MacroDataPoint[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // Most recent value is the last element (EODHD returns oldest→newest)
    return data[data.length - 1];
  } catch {
    return null;
  }
}

/**
 * Fetches a macro economic snapshot for a country — GDP growth, inflation,
 * unemployment, and real interest rate — in parallel (3–4 EODHD credits total).
 *
 * Cached for 1 hour: macro data is published monthly/quarterly, so daily
 * re-fetching is unnecessary and would drain the daily EODHD quota.
 */
export function useEodhdMacro(iso2: string | null) {
  const iso3 = iso2 ? (ISO2_TO_ISO3[iso2] ?? null) : null;

  return useQuery<MacroSnapshot>({
    queryKey: ['eodhd-macro', iso3],
    enabled: !!iso3,
    staleTime:            60 * 60_000,    // 1 hour — macro data is monthly/quarterly
    gcTime:               4 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MacroSnapshot> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      // Fetch all 4 indicators in parallel — 4 × 1 credit = 4 credits per country
      const [gdp, cpi, unemp, rate] = await Promise.all([
        fetchIndicator(projectId, anonKey, iso3!, 'gdp_growth_rate'),
        fetchIndicator(projectId, anonKey, iso3!, 'inflation_consumer_prices_annual'),
        fetchIndicator(projectId, anonKey, iso3!, 'unemployment_total_percent'),
        fetchIndicator(projectId, anonKey, iso3!, 'real_interest_rate'),
      ]);

      return {
        gdpGrowth:    { value: gdp?.Value   ?? null, date: gdp?.Date   ?? null },
        inflation:    { value: cpi?.Value   ?? null, date: cpi?.Date   ?? null },
        unemployment: { value: unemp?.Value ?? null, date: unemp?.Date ?? null },
        interestRate: { value: rate?.Value  ?? null, date: rate?.Date  ?? null },
      };
    },
  });
}
