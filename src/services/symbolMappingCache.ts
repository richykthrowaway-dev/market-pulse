/**
 * Client-side cache for symbol → listing → timeframe ID mappings.
 *
 * These mappings rarely change (only when a stock is re-listed or a new
 * timeframe is added). Caching them in localStorage avoids 3 of the 4
 * sequential Supabase queries that useStockHistory previously required.
 *
 * Cache entries expire after 24 hours.
 */

import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'symbol-mapping-cache';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SymbolMapping {
  symbolId: string;
  listingId: string;
  resolvedAt: number; // timestamp
}

interface TimeframeMapping {
  timeframeId: string;
  resolvedAt: number;
}

interface CacheStore {
  symbols: Record<string, SymbolMapping>;
  timeframes: Record<string, TimeframeMapping>;
}

function loadCache(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted cache, reset
  }
  return { symbols: {}, timeframes: {} };
}

function saveCache(cache: CacheStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable, ignore
  }
}

function isExpired(resolvedAt: number): boolean {
  return Date.now() - resolvedAt > TTL_MS;
}

/**
 * Resolve a canonical ticker to its listing ID, using cache when possible.
 * Returns null if the symbol doesn't exist in the database.
 */
export async function resolveListingId(
  ticker: string,
): Promise<{ symbolId: string; listingId: string } | null> {
  const cache = loadCache();
  const cached = cache.symbols[ticker];

  if (cached && !isExpired(cached.resolvedAt)) {
    return { symbolId: cached.symbolId, listingId: cached.listingId };
  }

  // Cache miss — resolve from Supabase
  const { data: sym } = await supabase
    .from('symbols')
    .select('id')
    .eq('canonical_ticker', ticker)
    .maybeSingle();

  if (!sym) return null;

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('symbol_id', sym.id)
    .limit(1)
    .maybeSingle();

  if (!listing) return null;

  // Store in cache
  cache.symbols[ticker] = {
    symbolId: sym.id,
    listingId: listing.id,
    resolvedAt: Date.now(),
  };
  saveCache(cache);

  return { symbolId: sym.id, listingId: listing.id };
}

/**
 * Resolve a timeframe code (e.g., '1D') to its ID, using cache when possible.
 */
export async function resolveTimeframeId(code: string): Promise<string | null> {
  const cache = loadCache();
  const cached = cache.timeframes[code];

  if (cached && !isExpired(cached.resolvedAt)) {
    return cached.timeframeId;
  }

  // Cache miss
  const { data: tf } = await supabase
    .from('timeframes')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (!tf) return null;

  cache.timeframes[code] = {
    timeframeId: tf.id,
    resolvedAt: Date.now(),
  };
  saveCache(cache);

  return tf.id;
}

/**
 * Clear all cached mappings (useful when data model changes).
 */
export function clearMappingCache(): void {
  localStorage.removeItem(STORAGE_KEY);
}
