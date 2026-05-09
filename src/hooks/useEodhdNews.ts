import { useQuery } from '@tanstack/react-query';

/**
 * EODHD financial news article with AI-generated sentiment scores.
 *
 * Sentiment is unique to EODHD — Finnhub and other sources don't include it.
 * `polarity` is the dominant label; `pos`/`neg`/`neu` are raw probability scores
 * that sum to ~1.0 and can be used to draw sentiment bars.
 */
export interface EodhdNewsArticle {
  date: string;          // ISO 8601, e.g. "2024-05-09T14:30:00+00:00"
  title: string;
  content: string;       // full article text (can be long)
  link: string;          // original article URL
  tickers: string[];     // EODHD-format tickers, e.g. ["AAPL.US", "MSFT.US"]
  tags: string[];        // topic tags, e.g. ["earnings", "technology"]
  sentiment: {
    polarity: 'Positive' | 'Negative' | 'Neutral';
    pos: number;         // 0–1
    neg: number;         // 0–1
    neu: number;         // 0–1
  } | null;
}

/**
 * Map ISO 3166-1 alpha-2 country codes → EODHD primary index symbol.
 *
 * When a country code is provided, we pass this as the `s` param so EODHD
 * returns news articles tagged with that index ticker, giving naturally
 * country-scoped results. Countries not in this map fall back to general
 * financial news (no `s` param).
 */
const COUNTRY_INDEX_SYMBOL: Record<string, string> = {
  US: '',             // General financial news — broad US coverage already
  GB: 'FTSE.INDX',
  DE: 'GDAXI.INDX',
  JP: 'N225.INDX',
  CA: 'GSPTSE.INDX',
  AU: 'AXJO.INDX',
  FR: 'FCHI.INDX',
  HK: 'HSI.INDX',
  CN: '000001.SHG',
  IN: 'SENSEX.BSE',
  KR: 'KS11.INDX',
  BR: 'BVSP.SA',
  IT: 'FTSEMIB.INDX',
  ES: 'IBEX.INDX',
  NL: 'AEX.INDX',
  CH: 'SSMI.INDX',
  SG: 'STI.INDX',
  ZA: 'J203.INDX',
  MX: 'MXX.INDX',
  SE: 'OMXS30.INDX',
  NO: 'OBX.INDX',
  DK: 'OMXC25.INDX',
};

interface UseEodhdNewsOptions {
  /** ISO 3166-1 alpha-2 country code. Maps to a primary index for targeted news. */
  iso2?: string;
  /** Explicit EODHD ticker to filter news by (overrides iso2 mapping). */
  symbol?: string;
  /** Max articles to fetch (default 40). */
  limit?: number;
}

export function useEodhdNews({ iso2, symbol, limit = 40 }: UseEodhdNewsOptions = {}) {
  // Resolve the `s` param: explicit symbol > country index map > empty (general news)
  const s = symbol ?? (iso2 ? (COUNTRY_INDEX_SYMBOL[iso2] ?? '') : '');

  return useQuery<EodhdNewsArticle[]>({
    queryKey: ['eodhd-news', s, limit],
    staleTime:            10 * 60_000,   // 10 min — news trickles in slowly
    gcTime:               30 * 60_000,
    refetchOnWindowFocus: false,         // never auto-refetch on tab focus
    queryFn: async (): Promise<EodhdNewsArticle[]> => {
      const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string).trim();
      const anonKey   = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      const params = new URLSearchParams({ endpoint: 'news', limit: String(limit) });
      if (s) params.set('s', s);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-eodhd?${params}`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );

      if (!res.ok) throw new Error(`EODHD news ${res.status}`);

      const raw: any[] = await res.json();
      if (!Array.isArray(raw)) return [];

      return raw.map((item): EodhdNewsArticle => ({
        date:     item.date    ?? '',
        title:    item.title   ?? '',
        content:  item.content ?? '',
        link:     item.link    ?? '',
        tickers:  Array.isArray(item.tickers) ? item.tickers : [],
        tags:     Array.isArray(item.tags)    ? item.tags    : [],
        sentiment: item.sentiment
          ? {
              polarity: item.sentiment.polarity ?? 'Neutral',
              pos:      Number(item.sentiment.pos ?? 0),
              neg:      Number(item.sentiment.neg ?? 0),
              neu:      Number(item.sentiment.neu ?? 0),
            }
          : null,
      }));
    },
  });
}
