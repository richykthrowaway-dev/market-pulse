/**
 * Exchange-aware symbol lookup service.
 *
 * Resolves symbol metadata (sector, country, GICS classification) by matching
 * through the listings table when exchange info is available, falling back
 * to canonical_ticker-only matching otherwise.
 *
 * This prevents incorrect data when two different companies share the same
 * ticker on different exchanges (e.g. SCD on NYSE vs SCD on TSX-V).
 */

import { supabase } from '@/integrations/supabase/client';

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
  // IBKR uses these codes; our exchanges table may store them differently
  VENTURE: ['V', 'TSXV', 'CVE'],
  TSE: ['TO', 'TSX', 'TSE'],
  NYSE: ['US', 'NYSE'],
  NASDAQ: ['US', 'NASDAQ'],
  AMEX: ['US', 'AMEX'],
  ARCA: ['US', 'ARCA', 'NYSEARCA'],
  LSE: ['L', 'LSE'],
  ASX: ['AX', 'ASX'],
};

function normalizeExchange(exchange: string): string[] {
  const upper = exchange.toUpperCase();
  // Check if this code appears in any alias group
  for (const [, aliases] of Object.entries(EXCHANGE_ALIAS)) {
    if (aliases.includes(upper)) return aliases;
  }
  return [upper];
}

/**
 * Batch-fetch symbol metadata for a set of tickers.
 *
 * When exchange info is available, tries to match via listings first
 * for disambiguation. Falls back to canonical_ticker matching.
 */
export async function batchLookupSymbols(
  items: TickerWithExchange[]
): Promise<Record<string, SymbolMeta>> {
  if (items.length === 0) return {};

  const uniqueTickers = [...new Set(items.map(i => i.ticker.toUpperCase()))];

  // Step 1: Fetch all candidate symbols by canonical_ticker
  const { data: symbolRows } = await supabase
    .from('symbols')
    .select('id, canonical_ticker, gics_sector, gics_industry_group, gics_industry, gics_sub_industry, country, type')
    .in('canonical_ticker', uniqueTickers);

  if (!symbolRows || symbolRows.length === 0) return {};

  // Build a map: ticker → candidate symbol rows
  const candidatesByTicker = new Map<string, typeof symbolRows>();
  for (const row of symbolRows) {
    const key = row.canonical_ticker.toUpperCase();
    const existing = candidatesByTicker.get(key) || [];
    existing.push(row);
    candidatesByTicker.set(key, existing);
  }

  // Step 2: For tickers with multiple candidates OR with exchange info,
  // resolve via listings → exchanges
  const ambiguousTickers = items.filter(i => {
    const candidates = candidatesByTicker.get(i.ticker.toUpperCase());
    return candidates && (candidates.length > 1 || i.exchange);
  });

  let listingMap = new Map<string, string>(); // symbolId → exchangeCode

  if (ambiguousTickers.length > 0) {
    const symbolIds = symbolRows.map(r => r.id);
    const { data: listings } = await supabase
      .from('listings')
      .select('symbol_id, local_ticker, exchanges ( code )')
      .in('symbol_id', symbolIds);

    if (listings) {
      for (const l of listings as any[]) {
        const exchCode = l.exchanges?.code;
        if (exchCode) {
          listingMap.set(l.symbol_id, exchCode);
        }
      }
    }
  }

  // Step 3: Build the result map
  const result: Record<string, SymbolMeta> = {};

  for (const item of items) {
    const key = item.ticker.toUpperCase();
    const candidates = candidatesByTicker.get(key);
    if (!candidates || candidates.length === 0) continue;

    let matched = candidates[0]; // default: first candidate

    if (candidates.length > 1 && item.exchange) {
      // Try to match by exchange
      const exchangeAliases = normalizeExchange(item.exchange);
      const found = candidates.find(c => {
        const exchCode = listingMap.get(c.id);
        return exchCode && exchangeAliases.includes(exchCode.toUpperCase());
      });
      if (found) matched = found;
    } else if (candidates.length > 1 && !item.exchange) {
      // No exchange info — prefer the one with a listing
      const withListing = candidates.find(c => listingMap.has(c.id));
      if (withListing) matched = withListing;
    } else if (candidates.length === 1 && item.exchange) {
      // Single candidate — verify it matches the exchange if possible
      const exchCode = listingMap.get(candidates[0].id);
      if (exchCode) {
        const exchangeAliases = normalizeExchange(item.exchange);
        if (!exchangeAliases.includes(exchCode.toUpperCase())) {
          // Exchange mismatch — still use it but log
          console.warn(`Symbol ${key} exchange mismatch: expected one of [${exchangeAliases}], got ${exchCode}`);
        }
      }
    }

    result[item.ticker] = {
      sector: matched.gics_sector || 'Other',
      country: matched.country || 'Unknown',
      subIndustry: matched.gics_sub_industry || '',
      isEtf: matched.type === 'etf',
      gicsIndustryGroup: matched.gics_industry_group || undefined,
      gicsIndustry: matched.gics_industry || undefined,
    };
  }

  return result;
}
