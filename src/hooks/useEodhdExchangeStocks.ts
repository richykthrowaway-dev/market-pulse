import { useQuery } from '@tanstack/react-query';

export interface EodhdScreenerStock {
  code: string;          // e.g. "AAPL.US"
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;    // USD
  price: number | null;
  change: number | null;       // daily change %
  volume: number | null;
  pe: number | null;
  eps: number | null;
}

/**
 * ISO 3166-1 alpha-2 → primary EODHD exchange code.
 * Used to filter the EODHD screener to stocks listed in a specific country.
 */
export const ISO2_TO_EODHD_EXCHANGE: Record<string, string> = {
  US: 'US',     GB: 'LSE',   DE: 'XETRA', JP: 'TSE',   CA: 'TO',
  AU: 'AU',     FR: 'PA',    HK: 'HK',    CN: 'SHG',   IN: 'BSE',
  KR: 'KS',    BR: 'SA',    IT: 'MI',    ES: 'MC',    NL: 'AS',
  CH: 'SW',    SG: 'SI',    ZA: 'JSE',   MX: 'MX',    SE: 'ST',
  NO: 'OL',    DK: 'CO',    AT: 'VI',    BE: 'BR',    PL: 'WSE',
  PT: 'LB',    IE: 'IR',    GR: 'AT',    FI: 'HE',    TW: 'TWO',
  TH: 'BKK',   MY: 'KLSE',  PH: 'PSE',  ID: 'JKT',   VN: 'HOSE',
  IL: 'TASE',  SA: 'SR',    QA: 'QATAR', AE: 'DFM',   EG: 'EGPT',
  NG: 'LAGOS', KE: 'NSE',   GH: 'GSE',  ZA: 'JSE',
};

/**
 * Fetch top stocks for a country's primary exchange via EODHD screener.
 * Sorted by market cap descending — shows the most significant companies.
 *
 * Cost: 1 EODHD credit per call. 30-min staleTime.
 */
export function useEodhdExchangeStocks(
  /** ISO2 country code OR direct EODHD exchange code (e.g. "LSE") */
  exchangeOrIso2: string | null,
  limit = 15,
) {
  // Resolve to EODHD exchange code
  const exchange = exchangeOrIso2
    ? (ISO2_TO_EODHD_EXCHANGE[exchangeOrIso2] ?? exchangeOrIso2)
    : null;

  return useQuery<EodhdScreenerStock[]>({
    queryKey: ['eodhd-exchange-stocks', exchange, limit],
    enabled:  !!exchange,
    staleTime:            30 * 60_000,
    gcTime:               60 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EodhdScreenerStock[]> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      // EODHD screener `filters` param expects an array of [field, op, value]
      // tuples — NOT an array of objects. Object form is silently ignored
      // (returns []). Sort uses dot-separated `field.direction` form.
      const filters = JSON.stringify([
        ['exchange', '=', exchange],
      ]);

      const params = new URLSearchParams({
        endpoint: 'screener',
        filters,
        sort:  'market_capitalization.desc',
        limit: String(limit),
        offset: '0',
      });

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-eodhd?${params}`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );

      if (!res.ok) throw new Error(`EODHD screener ${res.status}`);
      const raw = await res.json();

      const rows: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);

      return rows.map((r): EodhdScreenerStock => ({
        code:      r.code      ?? '',
        name:      r.name      ?? '',
        exchange:  r.exchange  ?? exchange ?? '',
        sector:    r.sector    ?? null,
        industry:  r.industry  ?? null,
        // EODHD returns market cap as `market_capitalization` (not `_basic`).
        // Keep the legacy field as a fallback for older cache entries.
        marketCap: r.market_capitalization != null
          ? Number(r.market_capitalization)
          : (r.market_cap_basic != null ? Number(r.market_cap_basic) : null),
        price:     r.price          != null ? Number(r.price)          : null,
        change:    r.change_p       != null ? Number(r.change_p)       : null,
        volume:    r.volume         != null ? Number(r.volume)         : null,
        pe:        r.pe             != null ? Number(r.pe)             : null,
        eps:       r.eps            != null ? Number(r.eps)            : null,
      }));
    },
  });
}
