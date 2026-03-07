import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_META } from "@/data/countryMeta";

export interface CountryStock {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  market_cap: number | null;
  volume: number | null;
  sector: string | null;
}

export function useCountryStocks(iso2: string | null) {
  return useQuery({
    queryKey: ["country-stocks", iso2],
    enabled: !!iso2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CountryStock[]> => {
      if (!iso2) return [];
      const meta = COUNTRY_META[iso2];
      if (!meta) return [];

      // Step 1: Get symbols for this country
      const { data: symbols, error: symErr } = await supabase
        .from("symbols")
        .select("canonical_ticker, name, sector")
        .eq("country", iso2)
        .limit(500);

      if (symErr) throw symErr;
      if (!symbols || symbols.length === 0) return [];

      const tickers = symbols.map((s) => s.canonical_ticker);

      // Step 2: Get stock price data for those tickers (batch in chunks of 200 for PostgREST)
      const allStocks: Array<{
        symbol: string;
        name: string;
        price: number;
        change_percent: number;
        volume: number;
        market_cap: number;
      }> = [];
      for (let i = 0; i < tickers.length; i += 200) {
        const chunk = tickers.slice(i, i + 200);
        const { data: stocks, error: stockErr } = await supabase
          .from("stocks")
          .select("symbol, name, price, change_percent, volume, market_cap")
          .in("symbol", chunk);
        if (stockErr) throw stockErr;
        if (stocks) allStocks.push(...stocks);
      }

      // Step 3: Merge — use stocks data where available, fall back to symbols data
      const stockMap = new Map(allStocks.map((s) => [s.symbol, s]));

      const merged: CountryStock[] = [];
      for (const sym of symbols) {
        const stock = stockMap.get(sym.canonical_ticker);
        merged.push({
          symbol: sym.canonical_ticker,
          name: stock?.name ?? sym.name,
          price: stock?.price ?? 0,
          change_percent: stock?.change_percent ?? 0,
          market_cap: stock?.market_cap ?? null,
          volume: stock?.volume ?? null,
          sector: sym.sector ?? null,
        });
      }

      // Sort by change_percent descending
      merged.sort((a, b) => (b.change_percent ?? 0) - (a.change_percent ?? 0));
      return merged;
    },
  });
}
