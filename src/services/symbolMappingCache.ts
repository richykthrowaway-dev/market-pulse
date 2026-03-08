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

/**
 * In-memory cache — avoids repeated localStorage reads + JSON.parse within a page session.
 * Every useStockHistory call invokes resolveListingId + resolveTimeframeId, so without
 * this layer, rendering 50 stock cards fires 100 localStorage reads.
 */
const memSymbols = new Map<string, SymbolMapping>();
const memTimeframes = new Map<string, TimeframeMapping>();

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
 *
 * Cache priority: in-memory Map → localStorage → Supabase
 */
export async function resolveListingId(
  ticker: string,
): Promise<{ symbolId: string; listingId: string } | null> {
  // 1. In-memory fast path (no I/O)
  const mem = memSymbols.get(ticker);
  if (mem && !isExpired(mem.resolvedAt)) {
    return { symbolId: mem.symbolId, listingId: mem.listingId };
  }

  // 2. localStorage (cold start or page refresh)
  const cache = loadCache();
  const cached = cache.symbols[ticker];
  if (cached && !isExpired(cached.resolvedAt)) {
    memSymbols.set(ticker, cached); // promote to in-memory
    return { symbolId: cached.symbolId, listingId: cached.listingId };
  }

  // 3. Cache miss — resolve from Supabase
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

  const entry: SymbolMapping = {
    symbolId: sym.id,
    listingId: listing.id,
    resolvedAt: Date.now(),
  };
  memSymbols.set(ticker, entry);
  cache.symbols[ticker] = entry;
  saveCache(cache);

  return { symbolId: sym.id, listingId: listing.id };
}

/**
 * Resolve a timeframe code (e.g., '1D') to its ID, using cache when possible.
 *
 * Cache priority: in-memory Map → localStorage → Supabase
 */
export async function resolveTimeframeId(code: string): Promise<string | null> {
  // 1. In-memory fast path
  const mem = memTimeframes.get(code);
  if (mem && !isExpired(mem.resolvedAt)) {
    return mem.timeframeId;
  }

  // 2. localStorage
  const cache = loadCache();
  const cached = cache.timeframes[code];
  if (cached && !isExpired(cached.resolvedAt)) {
    memTimeframes.set(code, cached); // promote to in-memory
    return cached.timeframeId;
  }

  // 3. Cache miss — resolve from Supabase
  const { data: tf } = await supabase
    .from('timeframes')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (!tf) return null;

  const entry: TimeframeMapping = { timeframeId: tf.id, resolvedAt: Date.now() };
  memTimeframes.set(code, entry);
  cache.timeframes[code] = entry;
  saveCache(cache);

  return tf.id;
}

/**
 * Clear all cached mappings (useful when data model changes).
 */
export function clearMappingCache(): void {
  memSymbols.clear();
  memTimeframes.clear();
  localStorage.removeItem(STORAGE_KEY);
}
