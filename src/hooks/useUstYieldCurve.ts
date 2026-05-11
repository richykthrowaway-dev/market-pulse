import { useQuery } from '@tanstack/react-query';

/**
 * useUstYieldCurve — fetches the latest US Treasury par yield curve from
 * EODHD's `ust/yield-rates` endpoint (already proxied via api-eodhd).
 *
 * Why this matters for the Trade tab:
 *   The 2Y-10Y spread is one of the most-watched recession predictors in
 *   finance.  When 2Y > 10Y (an "inverted" curve) it has reliably preceded
 *   every US recession since 1969 by 6-24 months.  Recessions hammer
 *   global trade demand — container shipping, energy, base metals all
 *   contract.  A trader looking at the Trade tab should see this signal.
 *
 * Response shape (EODHD's `ust/yield-rates`):
 *   The endpoint returns daily rows with one field per maturity.  Field
 *   names vary slightly across the response — we extract them defensively
 *   by checking a few likely keys per maturity (e.g. "year2Year",
 *   "2 yr", etc.).  Latest row is taken (response is date-sorted desc).
 *
 * Cached 1 hour — par-yield rates are published once per business day.
 */

export interface YieldPoint {
  /** Maturity in years (e.g. 0.083 for 1M, 2 for 2Y, 10 for 10Y). */
  years:     number;
  /** Display label ("1M", "2Y", "10Y", "30Y"). */
  label:     string;
  /** Yield in percent (e.g. 4.52 for 4.52%). */
  rate:      number;
}

export interface UstYieldCurve {
  /** ISO date for the curve snapshot. */
  date:        string;
  /** Maturity-ordered yield points. */
  points:      YieldPoint[];
  /** 10Y − 2Y spread (negative = inverted, classic recession indicator). */
  spread2y10y: number | null;
  /** 10Y − 3M spread (Fed's preferred recession indicator per Powell). */
  spread3m10y: number | null;
  /** True if 10Y yield is below 2Y yield (curve is inverted). */
  inverted:    boolean;
}

/**
 * Field-name candidates per maturity.  EODHD's UST endpoint has varied
 * over time and across documents — we try several keys to find each
 * maturity's rate.  First non-null wins.
 */
const MATURITIES: Array<{ years: number; label: string; keys: string[] }> = [
  { years: 1/12,  label: '1M',  keys: ['1 Mo',  '1mo',  '1month',  'monthOne',     'oneMonth'    ] },
  { years: 2/12,  label: '2M',  keys: ['2 Mo',  '2mo',  '2month',  'monthTwo',     'twoMonth'    ] },
  { years: 3/12,  label: '3M',  keys: ['3 Mo',  '3mo',  '3month',  'monthThree',   'threeMonth'  ] },
  { years: 6/12,  label: '6M',  keys: ['6 Mo',  '6mo',  '6month',  'monthSix',     'sixMonth'    ] },
  { years: 1,     label: '1Y',  keys: ['1 Yr',  '1yr',  '1year',   'yearOne',      'oneYear'     ] },
  { years: 2,     label: '2Y',  keys: ['2 Yr',  '2yr',  '2year',   'yearTwo',      'twoYear'     ] },
  { years: 3,     label: '3Y',  keys: ['3 Yr',  '3yr',  '3year',   'yearThree',    'threeYear'   ] },
  { years: 5,     label: '5Y',  keys: ['5 Yr',  '5yr',  '5year',   'yearFive',     'fiveYear'    ] },
  { years: 7,     label: '7Y',  keys: ['7 Yr',  '7yr',  '7year',   'yearSeven',    'sevenYear'   ] },
  { years: 10,    label: '10Y', keys: ['10 Yr', '10yr', '10year',  'yearTen',      'tenYear'     ] },
  { years: 20,    label: '20Y', keys: ['20 Yr', '20yr', '20year',  'yearTwenty',   'twentyYear'  ] },
  { years: 30,    label: '30Y', keys: ['30 Yr', '30yr', '30year',  'yearThirty',   'thirtyYear'  ] },
];

/** Extract a rate from a row object using the first key that yields a number. */
function pickRate(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number' && isFinite(v))             return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (isFinite(n)) return n;
    }
  }
  return null;
}

export function useUstYieldCurve(enabled: boolean) {
  return useQuery<UstYieldCurve | null>({
    queryKey: ['ust-yield-curve-latest'],
    enabled,
    staleTime:            60 * 60_000,        // 1 hour
    gcTime:               4  * 60 * 60_000,   // 4 hours
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<UstYieldCurve | null> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID       as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      const currentYear = new Date().getFullYear();
      const params = new URLSearchParams({
        endpoint:    'ust/yield-rates',
        'filter-year': String(currentYear),
        limit:        '50',
      });

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-eodhd?${params}`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );
      if (!res.ok) throw new Error(`UST yields ${res.status}`);

      const raw = await res.json() as unknown;
      // Endpoint sometimes wraps the array in `{ data: [...] }` and other
      // times returns the array directly — handle both.
      const rows = Array.isArray(raw)
        ? raw as Array<Record<string, unknown>>
        : Array.isArray((raw as { data?: unknown[] })?.data)
          ? (raw as { data: Array<Record<string, unknown>> }).data
          : [];
      if (rows.length === 0) return null;

      // Find the row with the most recent date.  Date field name varies:
      // sometimes "date", sometimes "Date", sometimes embedded in record_date.
      const dateKey = ['date', 'Date', 'record_date', 'reportDate']
        .find(k => k in rows[0]) ?? 'date';
      const sorted = [...rows].sort((a, b) =>
        String(b[dateKey] ?? '').localeCompare(String(a[dateKey] ?? '')),
      );
      const latest  = sorted[0];
      const dateStr = String(latest[dateKey] ?? '').slice(0, 10);

      const points: YieldPoint[] = [];
      for (const m of MATURITIES) {
        const rate = pickRate(latest, m.keys);
        if (rate != null) points.push({ years: m.years, label: m.label, rate });
      }

      // Compute headline spreads when the legs are available.
      const find = (yr: number) => points.find(p => Math.abs(p.years - yr) < 0.01)?.rate ?? null;
      const y2  = find(2);
      const y10 = find(10);
      const m3  = find(3/12);
      const spread2y10y = (y10 != null && y2  != null) ? (y10 - y2)  : null;
      const spread3m10y = (y10 != null && m3  != null) ? (y10 - m3)  : null;
      const inverted    = spread2y10y != null && spread2y10y < 0;

      return {
        date:        dateStr,
        points,
        spread2y10y,
        spread3m10y,
        inverted,
      };
    },
  });
}
