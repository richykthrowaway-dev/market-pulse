import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Stock, MarketIndex, CurrencyPair, NewsItem } from '@/utils/stocksApi';
import { QUERY_CONFIG } from '@/config/queryDefaults';

function mapStock(row: any): Stock {
  return {
    symbol: row.symbol,
    name: row.name,
    price: Number(row.price),
    change: Number(row.change),
    changePercent: Number(row.change_percent),
    volume: Number(row.volume),
    marketCap: Number(row.market_cap),
    lastUpdated: new Date(row.last_updated),
  };
}

function mapIndex(row: any): MarketIndex {
  return {
    symbol: row.symbol,
    name: row.name,
    value: Number(row.value),
    change: Number(row.change),
    changePercent: Number(row.change_percent),
    region: row.region,
    lastUpdated: new Date(row.last_updated),
  };
}

function mapCurrency(row: any): CurrencyPair {
  return {
    symbol: row.symbol,
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    rate: Number(row.rate),
    change: Number(row.change),
    changePercent: Number(row.change_percent),
    lastUpdated: new Date(row.last_updated),
  };
}

function mapNews(row: any): NewsItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    source: row.source,
    url: row.url,
    imageUrl: row.image_url ?? undefined,
    publishedAt: new Date(row.published_at),
    relatedSymbols: row.related_symbols ?? undefined,
  };
}

const DEFAULT_STOCKS = ['AAPL', 'GOOG', 'NVDA', 'AMZN', 'NFLX'];

export function useStocks(symbols?: string[]) {
  const querySymbols = symbols || DEFAULT_STOCKS;

  return useQuery({
    queryKey: ['stocks', querySymbols],
    queryFn: async () => {
      // If no symbols specified, use defaults only (no .in() filter = all rows)
      // If symbols specified, filter to only those symbols
      let query = supabase
        .from('stocks')
        .select('symbol, name, price, change, change_percent, volume, market_cap, last_updated');

      if (symbols) {
        query = query.in('symbol', symbols);
      } else {
        // Default: fetch only the top 5 by default
        query = query.in('symbol', DEFAULT_STOCKS);
      }

      const { data, error } = await query.order('market_cap', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapStock);
    },
    ...QUERY_CONFIG.stocks,
  });
}

export function useIndices() {
  return useQuery({
    queryKey: ['market_indices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_indices')
        .select('symbol, name, value, change, change_percent, region, last_updated');
      if (error) throw error;
      return (data ?? []).map(mapIndex);
    },
    ...QUERY_CONFIG.indices,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['currency_pairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currency_pairs')
        .select('symbol, from_currency, to_currency, rate, change, change_percent, last_updated');
      if (error) throw error;
      return (data ?? []).map(mapCurrency);
    },
    ...QUERY_CONFIG.currencies,
  });
}

/** Top N stocks by market cap — used for sector analysis, breadth, cap distribution */
export function useTopStocksByMarketCap(limit = 300) {
  return useQuery({
    queryKey: ['stocks', 'top', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select('symbol, name, price, change, change_percent, volume, market_cap, last_updated')
        .order('market_cap', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(mapStock);
    },
    ...QUERY_CONFIG.stocks,
  });
}

export function useNews(watchlistSymbols?: string[], country?: string) {
  return useQuery({
    queryKey: ['news', country ?? '', watchlistSymbols ?? []],
    queryFn: async (): Promise<NewsItem[]> => {
      // Trim env vars defensively — Vercel's `vercel env add` via stdin can
      // leave trailing whitespace that breaks URL construction.
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).trim();
      const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

      const url = new URL(`${supabaseUrl}/functions/v1/api-news`);
      if (country) {
        url.searchParams.set('country', country);
      }
      if (watchlistSymbols && watchlistSymbols.length > 0) {
        url.searchParams.set('symbols', watchlistSymbols.join(','));
      }
      url.searchParams.set('days', '7');

      const res = await fetch(url.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (!res.ok) throw new Error(`api-news: ${res.status}`);
      const json = await res.json();
      return (json.news ?? []).map((item: any) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        imageUrl: item.imageUrl ?? undefined,
        publishedAt: new Date(item.publishedAt),
        relatedSymbols: item.relatedSymbols ?? undefined,
      }));
    },
    ...QUERY_CONFIG.news,
  });
}

/**
 * Fetch news articles for a specific country.
 * Queries the news table by country_code (populated by news-sync-global edge function).
 */
export function useNewsByCountry(countryCode?: string) {
  return useQuery({
    queryKey: ['news', 'country', countryCode],
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from('news')
        .select('id, title, summary, source, url, image_url, published_at, related_symbols')
        .eq('country_code', countryCode!.toUpperCase())
        .order('published_at', { ascending: false })
        .limit(20);
      // Gracefully return empty if country_code column doesn't exist yet
      if (error) {
        console.warn(`useNewsByCountry(${countryCode}):`, error.message);
        return [];
      }
      return (data ?? []).map(mapNews);
    },
    enabled: !!countryCode,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
}
