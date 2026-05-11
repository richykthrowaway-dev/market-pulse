import { useQueries } from '@tanstack/react-query';
import { getRegionFor, WB_WORLD, WB_REGION_LABEL, type WBRegionCode } from '@/data/countryRegions';

/**
 * useWorldBankComparison — fetches the same indicator basket for three
 * entities at once: the country, its World Bank region aggregate, and the
 * world aggregate.  Lets the Compare view render a "country vs region vs
 * world" scorecard.
 *
 * Indicators chosen for the comparison:
 *   - NY.GDP.MKTP.KD.ZG  GDP growth (annual %)
 *   - FP.CPI.TOTL.ZG     Inflation, consumer prices (annual %)
 *   - SL.UEM.TOTL.ZS     Unemployment, total (% of labor force, modeled ILO)
 *   - BN.CAB.XOKA.GD.ZS  Current account balance (% of GDP)
 *   - GC.DOD.TOTL.GD.ZS  Central government debt (% of GDP)
 *   - NY.GDP.PCAP.CD     GDP per capita (current US$)
 *
 * Three parallel HTTP calls (country, region, world), each batching all 6
 * indicators with `MRV=1`.  Free, CORS-open, no auth.  Cached 6h.
 */

const WB_BASE = 'https://api.worldbank.org/v2';

export const COMPARISON_INDICATORS = {
  gdpGrowth:      { id: 'NY.GDP.MKTP.KD.ZG',  label: 'GDP growth',       unit: '%', lowerBetter: false },
  inflation:      { id: 'FP.CPI.TOTL.ZG',     label: 'Inflation',         unit: '%', lowerBetter: true  },
  unemployment:   { id: 'SL.UEM.TOTL.ZS',     label: 'Unemployment',      unit: '%', lowerBetter: true  },
  currentAccount: { id: 'BN.CAB.XOKA.GD.ZS',  label: 'Current account',   unit: '%', lowerBetter: false },
  debtGdp:        { id: 'GC.DOD.TOTL.GD.ZS',  label: 'Debt / GDP',        unit: '%', lowerBetter: true  },
  gdpPerCapita:   { id: 'NY.GDP.PCAP.CD',     label: 'GDP per capita',    unit: '$', lowerBetter: false },
} as const;

type IndicatorKey = keyof typeof COMPARISON_INDICATORS;

interface WBObservation {
  indicator: { id: string };
  date:      string;
  value:     number | null;
}

export interface ComparisonValue {
  value: number | null;
  date:  string | null;
}

export interface ComparisonRow {
  key:         IndicatorKey;
  label:       string;
  unit:        string;
  lowerBetter: boolean;
  country:     ComparisonValue;
  region:      ComparisonValue;
  world:       ComparisonValue;
}

export interface ComparisonResult {
  /** Resolved World Bank region code for the country (e.g. EAS, ECS). */
  regionCode:  WBRegionCode | null;
  /** Display label, e.g. "East Asia & Pacific". */
  regionLabel: string | null;
  rows:        ComparisonRow[];
  isLoading:   boolean;
  isError:     boolean;
}

const EMPTY_VALUE: ComparisonValue = { value: null, date: null };

async function fetchBasket(entityCode: string): Promise<Map<string, ComparisonValue>> {
  const indicatorList = Object.values(COMPARISON_INDICATORS).map(i => i.id).join(';');
  const url =
    `${WB_BASE}/country/${encodeURIComponent(entityCode)}` +
    `/indicator/${encodeURIComponent(indicatorList)}` +
    `?format=json&MRV=1&source=2`;

  const out = new Map<string, ComparisonValue>();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return out;
    const json = await res.json() as unknown;
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return out;
    for (const obs of json[1] as WBObservation[]) {
      if (!obs?.indicator?.id) continue;
      out.set(obs.indicator.id, {
        value: typeof obs.value === 'number' ? obs.value : null,
        date:  obs.date ?? null,
      });
    }
  } catch {
    // Swallow — empty map is the correct "no data" answer.
  }
  return out;
}

export function useWorldBankComparison(iso2: string | null): ComparisonResult {
  const regionCode  = iso2 ? getRegionFor(iso2) : null;
  const regionLabel = regionCode ? WB_REGION_LABEL[regionCode] : null;

  const queries = useQueries({
    queries: [
      {
        queryKey: ['worldbank-comparison', 'country', iso2],
        enabled:  !!iso2,
        staleTime:            6  * 60 * 60_000,
        gcTime:               24 * 60 * 60_000,
        refetchOnWindowFocus: false,
        queryFn: () => fetchBasket(iso2!),
      },
      {
        queryKey: ['worldbank-comparison', 'region', regionCode],
        enabled:  !!regionCode,
        staleTime:            6  * 60 * 60_000,
        gcTime:               24 * 60 * 60_000,
        refetchOnWindowFocus: false,
        queryFn: () => fetchBasket(regionCode!),
      },
      {
        queryKey: ['worldbank-comparison', 'world'],
        enabled:  !!iso2,
        staleTime:            24 * 60 * 60_000,   // world doesn't change daily — cache longer
        gcTime:               48 * 60 * 60_000,
        refetchOnWindowFocus: false,
        queryFn: () => fetchBasket(WB_WORLD),
      },
    ],
  });

  const [countryQ, regionQ, worldQ] = queries;
  const isLoading = queries.some(q => q.isLoading);
  const isError   = countryQ.isError && regionQ.isError && worldQ.isError;

  const countryMap = countryQ.data ?? new Map<string, ComparisonValue>();
  const regionMap  = regionQ.data  ?? new Map<string, ComparisonValue>();
  const worldMap   = worldQ.data   ?? new Map<string, ComparisonValue>();

  const rows: ComparisonRow[] = (Object.keys(COMPARISON_INDICATORS) as IndicatorKey[]).map(key => {
    const meta = COMPARISON_INDICATORS[key];
    return {
      key,
      label:       meta.label,
      unit:        meta.unit,
      lowerBetter: meta.lowerBetter,
      country:     countryMap.get(meta.id) ?? EMPTY_VALUE,
      region:      regionMap.get(meta.id)  ?? EMPTY_VALUE,
      world:       worldMap.get(meta.id)   ?? EMPTY_VALUE,
    };
  });

  return { regionCode, regionLabel, rows, isLoading, isError };
}
