import { useQuery } from '@tanstack/react-query';

/**
 * Trade-and-external-sector snapshot sourced from the World Bank's open
 * Indicators API at api.worldbank.org/v2.
 *
 * Why the World Bank API directly (not via EODHD):
 *   - FREE, no auth, no API key required
 *   - CORS-enabled (`Access-Control-Allow-Origin: *`) so we call it
 *     directly from the browser — no Supabase edge-function hop
 *   - No daily quota — request as many countries as needed
 *   - Multi-indicator batching: 4 indicators in 1 HTTP request
 *   - Same underlying data EODHD's macro-indicator endpoint returns
 *     (EODHD's docs literally say "data sourced from World Bank")
 *   - Latest reported year typically more recent than EODHD's mirror
 *   - Accepts ISO2 codes directly (no ISO3 mapping table needed —
 *     verified live: US, GB, DE, XK, SA, AE all work the same as
 *     their ISO3 equivalents)
 *
 * Trade indicators returned (using the standard WDI codes):
 *   - BN.CAB.XOKA.GD.ZS — Current account balance (% of GDP)
 *   - NE.EXP.GNFS.ZS    — Exports of goods and services (% of GDP)
 *   - NE.IMP.GNFS.ZS    — Imports of goods and services (% of GDP)
 *   - TX.VAL.TECH.MF.ZS — High-technology exports (% of manufactured)
 */

const WB_BASE = 'https://api.worldbank.org/v2';

const INDICATORS = {
  currentAccount:  'BN.CAB.XOKA.GD.ZS',
  exportsPctGdp:   'NE.EXP.GNFS.ZS',
  importsPctGdp:   'NE.IMP.GNFS.ZS',
  highTechExports: 'TX.VAL.TECH.MF.ZS',
} as const;

export interface TradeSnapshot {
  currentAccount:    { value: number | null; date: string | null };
  exportsPctGdp:     { value: number | null; date: string | null };
  importsPctGdp:     { value: number | null; date: string | null };
  highTechExports:   { value: number | null; date: string | null };
}

/** A single observation as returned by api.worldbank.org/v2. */
interface WBObservation {
  indicator:        { id: string; value: string };
  country:          { id: string; value: string };
  countryiso3code:  string;
  date:             string;        // "2024", "2023" — the data year
  value:            number | null; // null for years not yet reported
  unit:             string;
  obs_status:       string;
  decimal:          number;
}

/** Empty result shape — used on fetch failure or country-not-found. */
function emptySnapshot(): TradeSnapshot {
  return {
    currentAccount:  { value: null, date: null },
    exportsPctGdp:   { value: null, date: null },
    importsPctGdp:   { value: null, date: null },
    highTechExports: { value: null, date: null },
  };
}

/**
 * Fetch a country's trade snapshot from the World Bank Open Data API.
 *
 * Single HTTP request for all 4 indicators; `MRV=1` returns just the
 * most recent year that has reported data per indicator (which can
 * legitimately differ across indicators — e.g. high-tech exports
 * often lags current account by 1-2 years).
 *
 * `source=2` pins the WDI (World Development Indicators) database
 * specifically, so multi-source indicators don't return duplicate
 * observations from alternative datasets.
 *
 * Cached 6 hours: World Bank publishes once per year, so a fresh
 * fetch within 6h is wasteful.
 */
export function useWorldBankTrade(iso2: string | null) {
  return useQuery<TradeSnapshot>({
    queryKey: ['worldbank-trade', iso2],
    enabled:  !!iso2,
    staleTime:            6  * 60 * 60_000,  // 6 hours
    gcTime:               24 * 60 * 60_000,  // 24 hours
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TradeSnapshot> => {
      if (!iso2) return emptySnapshot();

      const indicatorList = Object.values(INDICATORS).join(';');
      const url =
        `${WB_BASE}/country/${encodeURIComponent(iso2)}` +
        `/indicator/${encodeURIComponent(indicatorList)}` +
        `?format=json&MRV=1&source=2`;

      let json: unknown;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return emptySnapshot();
        json = await res.json();
      } catch {
        return emptySnapshot();
      }

      // WB v2 success shape: [meta, [observations]]
      // WB v2 error shape:   [{ message: [...] }]
      if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
        return emptySnapshot();
      }
      const observations = json[1] as WBObservation[];

      // Index observations by indicator ID for O(1) lookup. The API
      // returns an array; ordering isn't documented as stable so we
      // don't rely on positional access.
      const byId = new Map<string, WBObservation>();
      for (const obs of observations) {
        if (obs?.indicator?.id) byId.set(obs.indicator.id, obs);
      }

      const pick = (id: string) => {
        const obs = byId.get(id);
        return {
          value: typeof obs?.value === 'number' ? obs.value : null,
          date:  obs?.date ?? null,
        };
      };

      return {
        currentAccount:  pick(INDICATORS.currentAccount),
        exportsPctGdp:   pick(INDICATORS.exportsPctGdp),
        importsPctGdp:   pick(INDICATORS.importsPctGdp),
        highTechExports: pick(INDICATORS.highTechExports),
      };
    },
  });
}
