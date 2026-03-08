import { supabase } from '@/integrations/supabase/client';

export interface AutocompleteResult {
  symbol: string;
  name: string;
  exchange: string | null;
  /** Raw EODHD exchange code for API calls (e.g. 'US', 'LSE') */
  exchangeCode: string | null;
  type: string;
  country: string | null;
  currency: string | null;
  /** Relevance score — lower = better match */
  relevance: number;
}

/**
 * Rank a search result by how well it matches the query.
 * 0 = exact ticker match, 1 = ticker starts-with, 2 = name starts-with, 3 = ticker contains, 4 = name contains
 */
function computeRelevance(
  ticker: string,
  name: string,
  query: string
): number {
  const q = query.toLowerCase();
  const t = ticker.toLowerCase();
  const n = name.toLowerCase();

  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (n.startsWith(q)) return 2;
  if (t.includes(q)) return 3;
  return 4;
}

/** Map EODHD exchange codes to readable labels */
function exchangeLabel(code: string | null): string {
  if (!code) return '';
  const map: Record<string, string> = {
    US: 'NASDAQ',
    NYSE: 'NYSE',
    AMEX: 'AMEX',
    PINK: 'OTC',
    LSE: 'LSE',
    TSX: 'TSX',
    V: 'TSX-V',
    TO: 'TSX',
    NEO: 'NEO',
    CBOE: 'CBOE',
    NASDAQ: 'NASDAQ',
    ASX: 'ASX',
    HK: 'HKEX',
    SHG: 'SSE',
    SHE: 'SZSE',
    TYO: 'TSE',
    CC: 'Crypto',
    FOREX: 'Forex',
    COMM: 'Futures',
  };
  return map[code] ?? code;
}

/**
 * Global autocomplete search via EODHD Search API (proxied through edge function).
 * Falls back to local DB search if the edge function is unavailable.
 */
export async function autocompleteSearch(
  query: string,
  limit = 10
): Promise<AutocompleteResult[]> {
  const sanitized = query.replace(/[^a-zA-Z0-9. ]/g, '').trim();
  if (!sanitized) return [];

  try {
    // Call EODHD search via the api-eodhd edge function proxy
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const qs = new URLSearchParams({
      endpoint: 'search',
      query: sanitized,
      limit: String(limit),
    }).toString();

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/api-eodhd?${qs}`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          symbol: item.Code ?? '',
          name: item.Name ?? '',
          exchange: exchangeLabel(item.Exchange),
          exchangeCode: item.Exchange ?? null,
          type: item.Type ?? 'Common Stock',
          country: item.Country ?? null,
          currency: item.Currency ?? null,
          relevance: computeRelevance(item.Code ?? '', item.Name ?? '', sanitized),
        }));
      }
    }
  } catch {
    // Fall through to local search
  }

  // Fallback: search local symbols table
  return localSearch(sanitized, limit);
}

/**
 * Local DB fallback search against symbols + stocks tables.
 */
async function localSearch(sanitized: string, limit: number): Promise<AutocompleteResult[]> {
  const pattern = `%${sanitized}%`;

  const { data: symbols, error } = await supabase
    .from('symbols')
    .select('canonical_ticker, name, type, sector, country, currency')
    .or(`canonical_ticker.ilike.${pattern},name.ilike.${pattern}`)
    .limit(50);

  if (error || !symbols) return [];

  const results: AutocompleteResult[] = symbols.map((s: any) => ({
    symbol: s.canonical_ticker,
    name: s.name,
    exchange: null,
    exchangeCode: null,
    type: s.type,
    country: s.country,
    currency: s.currency,
    relevance: computeRelevance(s.canonical_ticker, s.name, sanitized),
  }));

  results.sort((a, b) => {
    if (a.relevance !== b.relevance) return a.relevance - b.relevance;
    return a.symbol.localeCompare(b.symbol);
  });

  return results.slice(0, limit);
}
