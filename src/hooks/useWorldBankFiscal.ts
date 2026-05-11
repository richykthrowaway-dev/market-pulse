import { useQuery } from '@tanstack/react-query';

/**
 * Fiscal health snapshot from the World Bank's open Indicators API.
 *
 * Returns HISTORY (not just MRV) for two key indicators so the Economy
 * tab's Fiscal Health view can render sparklines + the latest value:
 *
 *   - GC.DOD.TOTL.GD.ZS  Central government debt, total (% of GDP)
 *   - GC.BAL.CASH.GD.ZS  Cash surplus/deficit (% of GDP)
 *
 * Notes on coverage:
 *   - Government debt: ~110 reporting countries.  Major economies all covered.
 *     Smaller / less-data-rich countries (some PG islands, sanctioned regimes)
 *     may return all-null.
 *   - Fiscal balance: ~130 reporting countries.
 *   - Latest reported year is typically 1-2 years behind real-time.
 *
 * Same direct-CORS approach as `useWorldBankTrade` — no edge function, no
 * key, no quota.
 */

const WB_BASE = 'https://api.worldbank.org/v2';

const INDICATORS = {
  debtGdp:        'GC.DOD.TOTL.GD.ZS',
  fiscalBalance:  'GC.BAL.CASH.GD.ZS',
} as const;

/** Year range to request — 25 years is plenty for a sparkline + trend reading. */
const YEAR_RANGE = '2000:2025';

export interface FiscalDataPoint {
  /** Year as a string, e.g. "2023" — matches the WB response format. */
  date:  string;
  /** % of GDP — null when not reported. */
  value: number | null;
}

export interface FiscalSnapshot {
  /** Government debt as % of GDP — full series oldest→newest, nulls dropped. */
  debtGdp:       FiscalDataPoint[];
  /** Cash surplus/deficit as % of GDP — full series oldest→newest, nulls dropped. */
  fiscalBalance: FiscalDataPoint[];
  /** Convenience: most recent non-null debt value. */
  latestDebt:    FiscalDataPoint | null;
  /** Convenience: most recent non-null balance value. */
  latestBalance: FiscalDataPoint | null;
}

interface WBObservation {
  indicator: { id: string };
  date:      string;
  value:     number | null;
}

function emptySnapshot(): FiscalSnapshot {
  return {
    debtGdp:       [],
    fiscalBalance: [],
    latestDebt:    null,
    latestBalance: null,
  };
}

/** Series order from WB is newest→oldest; we reverse to oldest→newest for charts. */
function extractSeries(observations: WBObservation[], indicatorId: string): FiscalDataPoint[] {
  return observations
    .filter(o => o?.indicator?.id === indicatorId && o.value !== null)
    .map(o => ({ date: o.date, value: o.value as number }))
    .reverse();
}

export function useWorldBankFiscal(iso2: string | null) {
  return useQuery<FiscalSnapshot>({
    queryKey: ['worldbank-fiscal', iso2],
    enabled:  !!iso2,
    staleTime:            6  * 60 * 60_000,
    gcTime:               24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<FiscalSnapshot> => {
      if (!iso2) return emptySnapshot();

      const indicatorList = Object.values(INDICATORS).join(';');
      const url =
        `${WB_BASE}/country/${encodeURIComponent(iso2)}` +
        `/indicator/${encodeURIComponent(indicatorList)}` +
        `?format=json&date=${YEAR_RANGE}&source=2&per_page=200`;

      let json: unknown;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return emptySnapshot();
        json = await res.json();
      } catch {
        return emptySnapshot();
      }

      if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
        return emptySnapshot();
      }
      const observations = json[1] as WBObservation[];

      const debtGdp       = extractSeries(observations, INDICATORS.debtGdp);
      const fiscalBalance = extractSeries(observations, INDICATORS.fiscalBalance);

      return {
        debtGdp,
        fiscalBalance,
        latestDebt:    debtGdp.length       > 0 ? debtGdp[debtGdp.length - 1]             : null,
        latestBalance: fiscalBalance.length > 0 ? fiscalBalance[fiscalBalance.length - 1] : null,
      };
    },
  });
}
