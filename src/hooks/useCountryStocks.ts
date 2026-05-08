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

const DEFEATBETA_URL = import.meta.env.DEV ? "http://localhost:4400" : "/_/backend";

/**
 * Yahoo Finance uses slightly different country names than our metadata.
 * Map edge cases here; most match exactly via COUNTRY_META[iso2].name.
 */
const YAHOO_COUNTRY_NAME: Record<string, string> = {
  KR: "South Korea",
  GB: "United Kingdom",
  HK: "Hong Kong",
  TW: "Taiwan",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  NZ: "New Zealand",
  ZA: "South Africa",
  CZ: "Czech Republic",
};

function getYahooCountryName(iso2: string): string {
  return YAHOO_COUNTRY_NAME[iso2] ?? COUNTRY_META[iso2]?.name ?? iso2;
}

/**
 * Fetches top stocks for a country.
 *
 * Strategy:
 *   1. Call DefeatBeta backend /api/country-stocks — ranks by company size
 *      (full_time_employees from Yahoo Finance profile data, queried via DuckDB).
 *   2. Batch-fetch those symbols from Supabase `stocks` table for live
 *      price, change%, volume, market_cap.
 *   3. Merge: Supabase for display metrics, DefeatBeta for sector/industry.
 *   4. Fallback: if DefeatBeta is unreachable, use old symbols-table approach.
 */
export function useCountryStocks(iso2: string | null) {
  return useQuery({
    queryKey: ["country-stocks", iso2],
    enabled: !!iso2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CountryStock[]> => {
      if (!iso2) return [];
      const meta = COUNTRY_META[iso2];
      if (!meta) return [];

      // Try DefeatBeta backend first for smart ranking
      let rankedSymbols: Array<{
        symbol: string;
        sector: string | null;
        industry: string | null;
      }> | null = null;

      try {
        const countryName = getYahooCountryName(iso2);
        const resp = await fetch(
          `${DEFEATBETA_URL}/api/country-stocks?country=${encodeURIComponent(countryName)}&limit=100`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (resp.ok) {
          const json = await resp.json();
          if (json.data && json.data.length > 0) {
            rankedSymbols = json.data;
          }
        }
      } catch {
        // Backend unavailable — fall through to Supabase fallback
      }

      if (rankedSymbols && rankedSymbols.length > 0) {
        return await fetchWithRankedSymbols(rankedSymbols);
      }

      // Fallback 1: Supabase symbols table by country
      const fromSupabase = await fetchFromSupabase(iso2);
      if (fromSupabase.length > 0) return fromSupabase;

      // Fallback 2: hardcoded country tickers from COUNTRY_META
      // Used when neither DefeatBeta nor Supabase has stocks for this country
      // (common for non-US markets — most of our stocks data is US-only)
      return await fetchFromCountryMeta(iso2);
    },
  });
}

/**
 * Final fallback: use the curated `newsTickers` list from COUNTRY_META.
 * These are well-known, exchange-qualified tickers (e.g. "OR.PA" for L'Oreal)
 * that should resolve in the Yahoo-fed stocks table when available.
 */
async function fetchFromCountryMeta(iso2: string): Promise<CountryStock[]> {
  const meta = COUNTRY_META[iso2];
  if (!meta || !meta.newsTickers || meta.newsTickers.length === 0) return [];

  const tickers = meta.newsTickers;
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name, price, change_percent, volume, market_cap")
    .in("symbol", tickers);

  const stockMap = new Map((stocks ?? []).map((s) => [s.symbol, s]));

  // Always return one entry per curated ticker, even if the stocks table
  // doesn't have live data — at least the ticker is shown so the user
  // sees the major companies for that country.
  return tickers.map((ticker) => {
    const stock = stockMap.get(ticker);
    return {
      symbol: ticker,
      name: stock?.name ?? ticker,
      price: stock?.price ?? 0,
      change_percent: stock?.change_percent ?? 0,
      market_cap: stock?.market_cap ?? null,
      volume: stock?.volume ?? null,
      sector: null,
    };
  });
}

/**
 * Primary path: we have ranked symbols from DefeatBeta.
 * Enrich with Supabase stocks data for live prices.
 */
async function fetchWithRankedSymbols(
  ranked: Array<{
    symbol: string;
    sector: string | null;
    industry: string | null;
  }>
): Promise<CountryStock[]> {
  const tickers = ranked.map((r) => r.symbol);

  // Build all chunked queries upfront, fire in parallel.
  // Previously: stocks chunks ran sequentially, then symbols chunks ran sequentially.
  // Now: every chunk × both tables fired together via Promise.all → single round-trip latency.
  const stocksQueries: Promise<{ data: any[] | null }>[] = [];
  const symbolsQueries: Promise<{ data: any[] | null }>[] = [];
  for (let i = 0; i < tickers.length; i += 100) {
    const chunk = tickers.slice(i, i + 100);
    stocksQueries.push(
      supabase
        .from("stocks")
        .select("symbol, name, price, change_percent, volume, market_cap")
        .in("symbol", chunk)
    );
    symbolsQueries.push(
      supabase
        .from("symbols")
        .select("canonical_ticker, name, sector")
        .in("canonical_ticker", chunk)
    );
  }

  const [stocksResults, symbolsResults] = await Promise.all([
    Promise.all(stocksQueries),
    Promise.all(symbolsQueries),
  ]);

  const stockMap = new Map<
    string,
    { name: string; price: number; change_percent: number; volume: number; market_cap: number }
  >();
  for (const { data: stocks } of stocksResults) {
    if (stocks) for (const s of stocks) stockMap.set(s.symbol, s);
  }

  const nameMap = new Map<string, { name: string; sector: string | null }>();
  for (const { data: syms } of symbolsResults) {
    if (syms) for (const s of syms) nameMap.set(s.canonical_ticker, { name: s.name, sector: s.sector });
  }

  // Merge: preserve DefeatBeta ranking order
  return ranked.map((r) => {
    const stock = stockMap.get(r.symbol);
    const sym = nameMap.get(r.symbol);
    return {
      symbol: r.symbol,
      name: stock?.name ?? sym?.name ?? r.symbol,
      price: stock?.price ?? 0,
      change_percent: stock?.change_percent ?? 0,
      market_cap: stock?.market_cap ?? null,
      volume: stock?.volume ?? null,
      sector: r.sector ?? sym?.sector ?? null,
    };
  });
}

/**
 * Fallback: old Supabase-only approach (used when DefeatBeta backend is down).
 * Queries symbols table by country, enriches with stocks table.
 */
async function fetchFromSupabase(iso2: string): Promise<CountryStock[]> {
  const { data: symbols, error: symErr } = await supabase
    .from("symbols")
    .select("canonical_ticker, name, sector")
    .eq("country", iso2)
    .limit(200);

  if (symErr) throw symErr;
  if (!symbols || symbols.length === 0) return [];

  const tickers = symbols.map((s) => s.canonical_ticker);

  // Parallelize chunked fetches instead of sequential await.
  const chunkQueries: Promise<{ data: any[] | null; error: any }>[] = [];
  for (let i = 0; i < tickers.length; i += 200) {
    const chunk = tickers.slice(i, i + 200);
    chunkQueries.push(
      supabase
        .from("stocks")
        .select("symbol, name, price, change_percent, volume, market_cap")
        .in("symbol", chunk)
    );
  }
  const chunkResults = await Promise.all(chunkQueries);

  const allStocks: Array<{
    symbol: string;
    name: string;
    price: number;
    change_percent: number;
    volume: number;
    market_cap: number;
  }> = [];
  for (const { data: stocks, error: stockErr } of chunkResults) {
    if (stockErr) throw stockErr;
    if (stocks) allStocks.push(...stocks);
  }

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

  // Sort by volume/price as best available proxy
  merged.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0) || b.price - a.price);
  return merged.slice(0, 100);
}
