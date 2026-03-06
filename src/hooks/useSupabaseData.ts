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

export function useStocks() {
  return useQuery({
    queryKey: ['stocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select('symbol, name, price, change, change_percent, volume, market_cap, last_updated')
        .order('market_cap', { ascending: false });
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

export function useNews(watchlistSymbols?: string[]) {
  return useQuery({
    queryKey: ['news', watchlistSymbols],
    queryFn: async () => {
      let query = supabase
        .from('news')
        .select('id, title, summary, source, url, image_url, published_at, related_symbols')
        .order('published_at', { ascending: false })
        .limit(50);

      // If watchlist symbols provided, filter using overlaps
      if (watchlistSymbols && watchlistSymbols.length > 0) {
        query = query.overlaps('related_symbols', watchlistSymbols);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapNews);
    },
    ...QUERY_CONFIG.news,
  });
}
