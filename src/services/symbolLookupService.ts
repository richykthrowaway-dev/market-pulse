/**
 * Exchange-aware symbol lookup service.
 *
 * Resolves symbol metadata (sector, country, GICS classification) using
 * a three-layer strategy:
 *
 *   Layer 1 — Static map (sectorMap.ts):
 *     ~300 top US stocks pre-mapped to GICS sectors. Zero API calls,
 *     O(1) lookup, works offline. Covers 95%+ of typical portfolios.
 *
 *   Layer 2 — Supabase symbols table:
 *     Tickers cached from previous Finnhub lookups. One DB round-trip
 *     for the entire batch. Also provides country, type, exchange data.
 *
 *   Layer 3 — Finnhub profile2 (api-finnhub edge function):
 *     For tickers not in the static map and lacking cached sector data.
 *     The edge function writes results back to the symbols table so
 *     subsequent loads hit Layer 2 (instant). Fire-and-forget so it
 *     never blocks the initial render.
 */

import { supabase } from '@/integrations/supabase/client';
import { getStaticSector } from '@/lib/sectorMap';

export interface SymbolMeta {
  sector: string;
  country: string;
  subIndustry: string;
  isEtf: boolean;
  gicsIndustryGroup?: string;
  gicsIndustry?: string;
}

export interface TickerWithExchange {
  ticker: string;
  exchange?: string;
}

/**
 * Maps IBKR / parsed-statement exchange codes to the exchange codes
 * stored in our `exchanges` table.
 */
const EXCHANGE_ALIAS: Record<string, string[]> = {
  VENTURE: ['V', 'TSXV', 'CVE'],
  TSE:     ['TO', 'TSX', 'TSE'],
  NYSE:    ['US', 'NYSE'],
  NASDAQ:  ['US', 'NASDAQ'],
  AMEX:    ['US', 'AMEX'],
  ARCA:    ['US', 'ARCA', 'NYSEARCA'],
  LSE:     ['L', 'LSE'],
  ASX:     ['AX', 'ASX'],
};

function normalizeExchange(exchange: string): string[] {
  const upper = exchange.toUpperCase();
  for (const [, aliases] of Object.entries(EXCHANGE_ALIAS)) {
    if (aliases.includes(upper)) return aliases;
  }
  return [upper];
}

/**
 * Maps Finnhub / EODHD / raw sector strings to canonical GICS 11 names.
 * Finnhub uses their own taxonomy (e.g. "Consumer Cyclical") so we map
 * those too.
 */
function normalizeSectorName(raw: string | null | undefined): string {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase().trim();
  const MAP: Record<string, string> = {
    // GICS canonical (pass-through)
    'information technology': 'Information Technology',
    'health care':            'Health Care',
    'financials':             'Financials',
    'consumer discretionary': 'Consumer Discretionary',
    'communication services': 'Communication Services',
    'industrials':            'Industrials',
    'consumer staples':       'Consumer Staples',
    'energy':                 'Energy',
    'utilities':              'Utilities',
    'real estate':            'Real Estate',
    'materials':              'Materials',
    // Finnhub taxonomy
    'technology':             'Information Technology',
    'healthcare':             'Health Care',
    'financial services':     'Financials',
    'finance':                'Financials',
    'consumer cyclical':      'Consumer Discretionary',
    'consumer defensive':     'Consumer Staples',
    'telecommunications':     'Communication Services',
    'communication':          'Communication Services',
    'industrial':             'Industrials',
    'basic materials':        'Materials',
    'real estate investment trust (reit)': 'Real Estate',
    // EODHD / other
    'software':               'Information Technology',
    'semiconductors':         'Information Technology',
  };
  return MAP[lower] ?? raw;
}

/**
 * Fetch sector data from Finnhub profile2 for tickers missing it.
 * Fire-and-forget: starts the requests but does NOT await results
 * before returning — the edge function caches to DB as a side-effect.
 * Returns whatever resolves within ~2s for an immediate improvement.
 */
async function fetchSectorsFromFinnhub(
  tickers: string[],
): Promise<Record<string, Partial<SymbolMeta>>> {
  if (tickers.length === 0) return {};

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const baseUrl   = `https://${projectId}.supabase.co/functions/v1/api-finnhub`;
  const headers   = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const CONCURRENCY = 6;
  const results: Record<string, Partial<SymbolMeta>> = {};

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (ticker) => {
      try {
        const res = await fetch(
          `${baseUrl}?endpoint=profile2&symbol=${ticker}`,
          { headers },
        );
        if (!res.ok) return;
        const data = await res.json();
        // Finnhub type: "ETP" = ETF/ETP, "Common Stock" = stock
        const isEtf = data.type === 'ETP' || data.type === 'ETF' || data.type === 'Mutual Fund';

        results[ticker] = {
          sector:  isEtf ? 'ETFs' : normalizeSectorName(data.finnhubIndustry),
          country: data.country || undefined,
          isEtf,
        };
      } catch {
        // Best-effort — sector enrichment never blocks the UI
      }
    }));
  }

  return results;
}

/**
 * Batch-fetch symbol metadata for a set of tickers.
 *
 * Flow:
 *   1. Apply static sector map (instant, zero API calls).
 *   2. Query symbols table for all tickers — country, type, cached sectors.
 *   3. For tickers still missing sector after layers 1+2, call Finnhub
 *      profile2 (free tier). Edge function caches to DB for future loads.
 *   4. Resolve exchange ambiguity via listings table when needed.
 *   5. Return merged metadata map.
 */
export async function batchLookupSymbols(
  items: TickerWithExchange[]
): Promise<Record<string, SymbolMeta>> {
  if (items.length === 0) return {};

  const uniqueTickers = [...new Set(items.map(i => i.ticker.toUpperCase()))];

  // ── Layer 1: Static sector map ────────────────────────────────────
  const staticSectors: Record<string, string> = {};
  for (const t of uniqueTickers) {
    const s = getStaticSector(t);
    if (s) staticSectors[t] = s;
  }

  // ── Layer 2: DB lookup for all tickers ───────────────────────────
  const { data: symbolRows } = await supabase
    .from('symbols')
    .select('id, canonical_ticker, gics_sector, gics_industry_group, gics_industry, gics_sub_industry, country, type')
    .in('canonical_ticker', uniqueTickers);

  const dbMap = new Map<string, NonNullable<typeof symbolRows>[number]>();
  for (const row of (symbolRows ?? [])) {
    dbMap.set(row.canonical_ticker.toUpperCase(), row);
  }

  // ── Layer 3: Finnhub for tickers missing sector in both layers ───
  const needsFinnhub = uniqueTickers.filter(t => {
    if (staticSectors[t]) return false;          // static map has it
    const row = dbMap.get(t);
    return !row?.gics_sector;                    // DB doesn't have it either
  });

  let finnhubData: Record<string, Partial<SymbolMeta>> = {};
  if (needsFinnhub.length > 0) {
    // Don't block render — race against 2s timeout
    const timeout = new Promise<Record<string, Partial<SymbolMeta>>>(
      r => setTimeout(() => r({}), 2000)
    );
    finnhubData = await Promise.race([
      fetchSectorsFromFinnhub(needsFinnhub),
      timeout,
    ]);
  }

  // ── Exchange disambiguation via listings ─────────────────────────
  const ambiguousTickers = items.filter(i => {
    const candidates = symbolRows?.filter(r => r.canonical_ticker.toUpperCase() === i.ticker.toUpperCase());
    return candidates && (candidates.length > 1 || i.exchange);
  });

  const listingMap = new Map<string, string>(); // symbolId → exchangeCode

  if (ambiguousTickers.length > 0 && symbolRows) {
    const symbolIds = symbolRows.map(r => r.id);
    const { data: listings } = await supabase
      .from('listings')
      .select('symbol_id, local_ticker, exchanges ( code )')
      .in('symbol_id', symbolIds);

    if (listings) {
      for (const l of listings as any[]) {
        const exchCode = l.exchanges?.code;
        if (exchCode) listingMap.set(l.symbol_id, exchCode);
      }
    }
  }

  // ── Build result map ─────────────────────────────────────────────
  const result: Record<string, SymbolMeta> = {};

  for (const item of items) {
    const key = item.ticker.toUpperCase();
    const candidates = (symbolRows ?? []).filter(r => r.canonical_ticker.toUpperCase() === key);

    let matched = candidates[0];

    if (candidates.length > 1 && item.exchange) {
      const aliases = normalizeExchange(item.exchange);
      const found = candidates.find(c => {
        const code = listingMap.get(c.id);
        return code && aliases.includes(code.toUpperCase());
      });
      if (found) matched = found;
    } else if (candidates.length > 1 && !item.exchange) {
      const withListing = candidates.find(c => listingMap.has(c.id));
      if (withListing) matched = withListing;
    } else if (candidates.length === 1 && item.exchange) {
      const code = listingMap.get(candidates[0]?.id);
      if (code) {
        const aliases = normalizeExchange(item.exchange);
        if (!aliases.includes(code.toUpperCase())) {
          console.warn(`Symbol ${key} exchange mismatch: expected [${aliases}], got ${code}`);
        }
      }
    }

    // Priority: static map > DB > Finnhub > 'Other'
    const staticSector  = staticSectors[key];
    const dbSector      = normalizeSectorName(matched?.gics_sector);
    const finnhub       = finnhubData[key];

    result[item.ticker] = {
      sector:            staticSector || dbSector || finnhub?.sector || 'Other',
      country:           finnhub?.country || matched?.country || 'Unknown',
      subIndustry:       matched?.gics_sub_industry || '',
      isEtf:             finnhub?.isEtf ?? (matched?.type === 'etf'),
      gicsIndustryGroup: matched?.gics_industry_group || undefined,
      gicsIndustry:      matched?.gics_industry || undefined,
    };
  }

  return result;
}
