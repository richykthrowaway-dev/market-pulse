import { useQuery } from '@tanstack/react-query';
import {
  fetchFinnhubQuote,
  fetchFinnhubProfile,
} from '@/services/finnhubApi';
import { fetchEodHistorical, type EodBar } from '@/services/eodhdApi';
import { fetchYahooQuote } from '@/services/yahooFinanceApi';

export interface EodhdStockData {
  stock: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    marketCap: number;
    market_cap: number;
    volume: number;
    lastUpdated: Date;
    last_updated: string;
    logoUrl?: string;
    /** ISO 4217 currency code (e.g. 'CAD', 'GBP'). Defaults to 'USD'. */
    currency: string;
  };
  priceHistory: number[];
  bars: EodBar[];
  /** True when a real-time quote was successfully fetched; false when rate-limited / unavailable. */
  liveQuoteAvailable: boolean;
}


/**
 * Fetch stock data with clear responsibility split:
 * - Finnhub  → fundamentals (quote, profile) for US stocks
 * - Yahoo Finance → fundamentals (quote, currency, name) for non-US stocks
 * - EODHD    → historical price bars for ALL stocks
 */
export function useEodhdStock(symbol: string | null, exchange: string = 'US', fallbackName?: string) {
  return useQuery<EodhdStockData | null>({
    queryKey: ['external-stock', symbol, exchange],
    queryFn: async () => {
      if (!symbol) return null;

      const isUS = exchange === 'US' || exchange === 'NYSE' || exchange === 'AMEX' || exchange === 'NASDAQ' || exchange === 'CBOE';


      // ── Step 1: Fundamentals ──
      let quote: Awaited<ReturnType<typeof fetchFinnhubQuote>> | null = null;
      let profile: Awaited<ReturnType<typeof fetchFinnhubProfile>> | null = null;
      let yahooData: Awaited<ReturnType<typeof fetchYahooQuote>> = null;

      if (isUS) {
        // Finnhub for US stocks
        [quote, profile] = await Promise.all([
          fetchFinnhubQuote(symbol).catch(() => null),
          fetchFinnhubProfile(symbol).catch(() => null),
        ]);
      } else {
        // Yahoo Finance for non-US stocks — provides currency, name, market data
        yahooData = await fetchYahooQuote(symbol, exchange).catch(() => null);
      }

      // ── Step 2: Price bars — EODHD for all stocks ──
      const eodSymbol = isUS ? `${symbol}.US` : `${symbol}.${exchange}`;
      const bars: EodBar[] = await fetchEodHistorical(eodSymbol).catch(() => [] as EodBar[]);

      const closes = bars.map(b => b.close);

      // ── Step 3: Build unified result ──
      const hasQuote = quote && (quote.c !== 0 || quote.pc !== 0);
      const hasYahoo = yahooData && yahooData.regularMarketPrice !== null;
      const liveQuoteAvailable = !!(hasQuote || hasYahoo);

      // Price resolution: Finnhub quote > Yahoo quote > EODHD bars
      let lastPrice: number;
      let change: number;
      let changePct: number;

      if (hasQuote) {
        lastPrice = quote.c;
        change = quote.d ?? 0;
        const prevPrice = quote.pc || 1;
        changePct = quote.dp ?? ((change / prevPrice) * 100);
      } else if (hasYahoo && yahooData.regularMarketPrice) {
        lastPrice = yahooData.regularMarketPrice;
        const prevClose = yahooData.previousClose || lastPrice;
        change = lastPrice - prevClose;
        changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;
      } else {
        lastPrice = closes.length > 0 ? closes[closes.length - 1] : 0;
        change = closes.length >= 2 ? closes[closes.length - 1] - closes[closes.length - 2] : 0;
        const prevPrice = closes.length >= 2 ? closes[closes.length - 2] : 1;
        changePct = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;
      }

      // Market cap: Finnhub profile > Yahoo > 0
      const marketCap = profile?.marketCapitalization
        ? profile.marketCapitalization * 1_000_000
        : (yahooData?.marketCap ?? 0);

      // Currency: Yahoo > profile currency > fallback USD
      const currency = yahooData?.currency || profile?.currency || 'USD';

      // Name: Finnhub profile > Yahoo > fallback
      const stockName = profile?.name
        || yahooData?.longName
        || yahooData?.shortName
        || fallbackName
        || symbol;

      // Volume: Yahoo > last bar > 0
      const volume = yahooData?.regularMarketVolume
        || (bars.length > 0 ? bars[bars.length - 1].volume : 0);

      if (lastPrice === 0 && bars.length === 0) {
        console.error(`No data available for ${symbol}.${exchange}`);
        return null;
      }

      return {
        stock: {
          symbol,
          name: stockName,
          price: lastPrice,
          change,
          changePercent: changePct,
          marketCap,
          market_cap: marketCap,
          volume,
          lastUpdated: new Date(),
          last_updated: new Date().toISOString(),
          logoUrl: profile?.logo || undefined,
          currency,
        },
        priceHistory: closes,
        bars,
        liveQuoteAvailable,
      } as EodhdStockData;
    },
    enabled: !!symbol,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
