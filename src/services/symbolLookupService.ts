/**
 * Exchange-aware symbol lookup service.
 *
 * Resolves symbol metadata (sector, country, GICS classification) using
 * a four-layer strategy:
 *
 *   Layer 1 — Static map (sectorMap.ts):
 *     ~300 top US stocks pre-mapped to GICS sectors. Zero API calls,
 *     O(1) lookup, works offline. Covers 95%+ of typical portfolios.
 *
 *   Layer 2 — Supabase symbols table:
 *     Tickers cached from previous lookups. One DB round-trip for the
 *     entire batch. Provides sector, full GICS hierarchy (including
 *     sub-industry), country, and type.
 *
 *   Layer 2.5 — EODHD fundamentals (api-eodhd edge function):
 *     For portfolio tickers missing gics_sub_industry in the DB.
 *     Returns the complete GICS hierarchy (sector → group → industry →
 *     sub-industry). The edge fn writes results back to the symbols table
 *     so subsequent loads hit Layer 2 (instant). Races against a 6s
 *     timeout so it never hangs the portfolio render.
 *
 *   Layer 3 — Finnhub profile2 (api-finnhub edge function):
 *     For tickers not in the static map and lacking cached sector data.
 *     The edge function writes results back to the symbols table so
 *     subsequent loads hit Layer 2 (instant). Fire-and-forget so it
 *     never blocks the initial render.
 */

import { supabase } from '@/integrations/supabase/client';
import { getStaticSector, getStaticSubIndustry, gicsSubIndustryFromFmp } from '@/lib/sectorMap';
import { normalizeSector, sectorForSubIndustry } from '@/lib/gicsColors';
import { fetchCached } from '@/lib/apiCache';

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

// normalizeSector is imported from @/lib/gicsColors — it handles all GICS,
// Finnhub, EODHD, FMP, and Alpha Vantage taxonomy strings comprehensively.

/**
 * Fetch full GICS hierarchy from EODHD /fundamentals for tickers that
 * have no gics_sub_industry in the DB yet.
 *
 * Why EODHD over Finnhub for this?  EODHD returns the complete official
 * GICS path (GicSector / GicGroup / GicIndustry / GicSubIndustry) while
 * Finnhub only provides its own coarser `finnhubIndustry` string.
 *
 * The api-eodhd edge function already has write-through caching — it
 * persists every GICS field back to the symbols table, so the second
 * time a portfolio loads these tickers, Layer 2 answers instantly.
 *
 * EODHD symbol format: plain US tickers get ".US" appended (AAPL.US);
 * tickers that already carry an exchange suffix (RY.TO) are sent as-is.
 */
async function fetchGicsFromEodhd(
  tickers: string[],
  // Caller passes in a shared object so partial results are visible even when
  // the caller's race-against-timeout fires before all fetches complete.
  // Without this, in-flight fetches that resolve before timeout would still be
  // discarded because `Promise.all` only returns when ALL settle.
  results: Record<string, Partial<SymbolMeta>> = {},
): Promise<Record<string, Partial<SymbolMeta>>> {
  if (tickers.length === 0) return results;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const baseUrl   = `https://${projectId}.supabase.co/functions/v1/api-eodhd`;
  const headers   = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  // Fully parallel — every ticker fires at once. The race-against-timeout in the
  // caller (batchLookupSymbols) bounds total wall time; whatever completes is
  // used immediately, the rest get written to DB by the edge fn for next load.
  // EODHD allows hundreds of req/s on paid tiers, and Supabase edge functions
  // handle the request multiplexing gracefully.

  // Each fetchCached call gives us localStorage cache + in-flight dedup +
  // stale-while-revalidate. GICS data is essentially static (changes < 1×/year)
  // so a 24h TTL with 6h stale window aggressively cuts EODHD load — 100-stock
  // portfolio reload goes from 1000 credits to 0 on warm cache.
  await Promise.all(tickers.map(async (ticker) => {
    try {
      const eodSymbol = ticker.includes('.') ? ticker : `${ticker}.US`;
      const meta = await fetchCached<Partial<SymbolMeta> | null>(
        `eodhd:gics:${eodSymbol}`,
        async () => {
          const res = await fetch(
            `${baseUrl}?endpoint=fundamentals&symbol=${encodeURIComponent(eodSymbol)}`,
            { headers },
          );
          if (!res.ok) return null;
          const data = await res.json();
          const g = data?.General;
          if (!g) return null;

          const isEtf = g.Type === 'ETF' || g.Type === 'ETP' || g.Type === 'Mutual Fund';
          return {
            sector:            isEtf ? 'ETFs' : normalizeSector(g.GicSector || g.Sector || ''),
            country:           g.CountryISO || g.CountryName || undefined,
            subIndustry:       g.GicSubIndustry || '',
            isEtf,
            gicsIndustryGroup: g.GicGroup    || undefined,
            gicsIndustry:      g.GicIndustry || g.Industry || undefined,
          };
        },
        {
          ttlMs:        24 * 60 * 60_000,   // 24h — GICS classifications are near-static
          staleAfterMs:  6 * 60 * 60_000,   // 6h  — serve stale + revalidate in background
          // Don't cache null/empty — only persist when EODHD actually returned data
          shouldCache: (v): v is Partial<SymbolMeta> => v !== null && !!v.sector,
        },
      );
      if (meta) results[ticker] = meta;
    } catch {
      // Best-effort — sub-industry enrichment never blocks the UI
    }
  }));

  return results;
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
          sector:  isEtf ? 'ETFs' : normalizeSector(data.finnhubIndustry),
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
 * Fetch sector + GICS sub-industry from FMP /profile.
 *
 * Why FMP: it covers ~30K US-listed stocks for free, the data includes both
 * sector and a fine-grained industry string, and the response is small (~1 KB)
 * — perfect as the "after-static-map fallback" for any US ticker we don't
 * recognize. FMP doesn't have GICS sub-industry directly, so we translate
 * via gicsSubIndustryFromFmp() built from a hand-curated mapping table.
 *
 * Coverage caveat: FMP doesn't reliably cover non-US small-caps (Canadian
 * .V/.TO, UK .L, AU .AX). Those still need EODHD or the static map.
 */
async function fetchFromFmp(
  tickers: string[],
  results: Record<string, Partial<SymbolMeta>> = {},
): Promise<Record<string, Partial<SymbolMeta>>> {
  if (tickers.length === 0) return results;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const baseUrl   = `https://${projectId}.supabase.co/functions/v1/api-fmp`;
  const headers   = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  // Fully parallel — FMP free tier handles 250 calls/day at high rate
  await Promise.all(tickers.map(async (ticker) => {
    try {
      const res = await fetch(
        `${baseUrl}?endpoint=profile&symbol=${encodeURIComponent(ticker)}`,
        { headers },
      );
      if (!res.ok) return;
      const data = await res.json();
      const p = data?.profile;
      if (!p) return;  // FMP returned []  — ticker not in their universe

      // Translate FMP's industry → GICS sub-industry via the lookup table
      const fmpIndustry = String(p.industry || '');
      const subIndustry = gicsSubIndustryFromFmp(fmpIndustry) || '';

      // Sector: FMP uses non-GICS names ("Consumer Cyclical") — normalizeSector
      // handles the alias mapping. If FMP returns a sub-industry we recognize,
      // we can also derive the sector via sectorForSubIndustry as a backup.
      const sector = subIndustry
        ? (sectorForSubIndustry(subIndustry) || normalizeSector(p.sector || ''))
        : normalizeSector(p.sector || '');

      const isEtf = String(p.isEtf || '').toLowerCase() === 'true' || p.isFund === true;

      results[ticker] = {
        sector:       isEtf ? 'ETFs' : sector,
        country:      p.country || undefined,
        subIndustry,
        isEtf,
        gicsIndustry: fmpIndustry || undefined,  // store raw FMP industry for transparency
      };
    } catch {
      // Best-effort — never blocks the UI
    }
  }));

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

  // First-seen exchange per ticker — used to disambiguate Canadian/UK/AU
  // small-caps in the static sub-industry map. We lower-priority overwrite
  // so the first occurrence (typically the user's actual holding) wins
  // when the same ticker appears multiple times across portfolio rows.
  const exchangeFor: Record<string, string | undefined> = {};
  for (const i of items) {
    const key = i.ticker.toUpperCase();
    if (!exchangeFor[key] && i.exchange) exchangeFor[key] = i.exchange;
  }

  // ── Layer 1: Static sector map ────────────────────────────────────
  const staticSectors: Record<string, string> = {};
  for (const t of uniqueTickers) {
    const s = getStaticSector(t);
    if (s) staticSectors[t] = s;
  }

  // ── Layer 1.5: Static SUB-INDUSTRY map ────────────────────────────
  // Hand-curated GICS 163 mapping for ~1,400 commonly-held tickers across
  // US/Canada/UK/AU. This is the only layer that resolves instantly with
  // NO network call. Passing the exchange through means a Canadian "TUNG"
  // (American Tungsten on TSX-V) is looked up as "TUNG.V" automatically,
  // rather than getting confused with any US ticker of the same name.
  const staticSubIndustries: Record<string, string> = {};
  for (const t of uniqueTickers) {
    const si = getStaticSubIndustry(t, exchangeFor[t]);
    if (si) staticSubIndustries[t] = si;
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

  // ── Layer 2.5: EODHD for tickers missing sub-industry ──────────────
  // Targets portfolio holdings that have no gics_sub_industry in DB yet.
  // ETFs are skipped — they have no GICS sub-industry by definition.
  // Static sub-industry hits are also skipped — Layer 1.5 already resolved them.
  // The edge fn writes all GICS fields back to symbols as a side effect,
  // so the very next portfolio load finds everything in Layer 2 (instant).
  const needsEodhd = uniqueTickers.filter(t => {
    if (staticSectors[t] === 'ETFs') return false;  // ETFs have no sub-industry
    if (staticSubIndustries[t]) return false;       // Layer 1.5 already covered
    const row = dbMap.get(t);
    return !row?.gics_sub_industry;                  // missing the granular level
  });

  // Shared accumulator — fetchGicsFromEodhd populates this object as each
  // ticker resolves. Even if the timeout fires first, we still see whatever
  // tickers completed in time (instead of losing them all to Promise.race).
  const eodhdData: Record<string, Partial<SymbolMeta>> = {};
  if (needsEodhd.length > 0) {
    // Race against 25s — fully-parallel EODHD fetches typically resolve in 2–5s
    // for ~30 tickers, but first-load enrichment of a fresh portfolio with no
    // DB cache needs enough headroom that EVERY ticker has a chance to populate
    // its sub-industry on the initial render rather than falling back to sector.
    // Whatever resolves in time is used immediately; the rest are written to
    // DB by the edge fn (write-through caching) and picked up on the next load.
    const timeout = new Promise<void>(r => setTimeout(r, 25000));
    await Promise.race([
      fetchGicsFromEodhd(needsEodhd, eodhdData),
      timeout,
    ]);
  }

  // ── Layer 2.6: FMP for tickers STILL missing sub-industry ─────────
  // Catches tickers that aren't in the static map AND that EODHD couldn't
  // resolve (often because EODHD's daily quota is exhausted). FMP's free
  // tier covers ~30K US stocks with sector + industry. Their industry strings
  // ("Software - Infrastructure") are translated to canonical GICS 2023
  // sub-industries via `gicsSubIndustryFromFmp` in sectorMap.ts.
  //
  // Why this layer matters: it's the difference between "company name fallback"
  // and proper GICS classification for any US ticker not yet in our DB cache.
  // FMP doesn't reliably cover non-US small-caps — those still need EODHD or
  // the static map.
  const needsFmp = uniqueTickers.filter(t => {
    if (staticSectors[t] === 'ETFs') return false;
    if (staticSubIndustries[t]) return false;
    const row = dbMap.get(t);
    if (row?.gics_sub_industry) return false;
    if (eodhdData[t]?.subIndustry) return false;
    return true;
  });

  const fmpData: Record<string, Partial<SymbolMeta>> = {};
  if (needsFmp.length > 0) {
    // Race against 8s — FMP responses are small and fast (~200-500ms each)
    const timeout = new Promise<void>(r => setTimeout(r, 8000));
    await Promise.race([
      fetchFromFmp(needsFmp, fmpData),
      timeout,
    ]);
  }

  // ── Layer 3: Finnhub for tickers missing sector after every prior layer ──
  // Only fires when neither static map, DB, EODHD, nor FMP resolved the sector.
  const needsFinnhub = uniqueTickers.filter(t => {
    if (staticSectors[t]) return false;          // static map has it
    const row = dbMap.get(t);
    if (row?.gics_sector) return false;          // DB has it
    if (eodhdData[t]?.sector) return false;     // EODHD has it
    return !fmpData[t]?.sector;                 // FMP didn't resolve it either
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

    // Priority: static map > derived-from-static-sub-industry > DB > EODHD > Finnhub > 'Other'
    // EODHD sits above Finnhub because it provides the full canonical GICS
    // hierarchy rather than Finnhub's coarser proprietary industry strings.
    //
    // The "derived from sub-industry" step matters for foreign small-caps:
    // STATIC_SUBINDUSTRY_MAP has TUNG.V → 'Diversified Metals & Mining' but
    // STATIC_SECTOR_MAP doesn't list TUNG. Without this step, the sector would
    // fall through to DB (likely empty) → EODHD (rate-limited) → 'Other'
    // even though we KNOW the parent sector of every sub-industry.
    //
    // CRITICAL: only treat the DB sector as "found" when the row actually has
    // a gics_sector value. Otherwise normalizeSector(undefined) returns 'Other'
    // — a truthy string that would short-circuit the EODHD/Finnhub fallbacks.
    const staticSector       = staticSectors[key];
    const staticSubIndustry  = staticSubIndustries[key];
    const derivedFromSubInd  = staticSubIndustry ? (sectorForSubIndustry(staticSubIndustry) ?? '') : '';
    const dbSector           = matched?.gics_sector ? normalizeSector(matched.gics_sector) : '';
    const eodhd              = eodhdData[key];
    const fmp                = fmpData[key];
    const finnhub            = finnhubData[key];

    const resolvedSector = staticSector
      || derivedFromSubInd
      || dbSector
      || eodhd?.sector
      || fmp?.sector              // FMP layer between EODHD and Finnhub
      || finnhub?.sector
      || 'Other';

    // isEtf: true if static map tagged it as ETF, or any source says so
    const resolvedIsEtf  = staticSector === 'ETFs'
      || eodhd?.isEtf   === true
      || finnhub?.isEtf === true
      || matched?.type  === 'etf'
      || matched?.type  === 'ETF'
      || matched?.type  === 'ETP';

    // Sub-industry priority: static map > DB > EODHD > FMP > empty.
    // Static map wins because (a) it's instant and (b) it's hand-validated
    // against canonical GICS 2023 names, so no normalization issues.
    // FMP comes last because its industry → GICS-sub-industry translation
    // is approximate (some FMP industries map to multiple GICS sub-industries
    // and we have to pick one), whereas static/DB/EODHD use canonical names.
    const resolvedSubIndustry = resolvedIsEtf
      ? ''
      : (staticSubIndustries[key]
         || matched?.gics_sub_industry
         || eodhd?.subIndustry
         || fmp?.subIndustry
         || '');

    result[item.ticker] = {
      sector:            resolvedIsEtf ? 'ETFs' : resolvedSector,
      country:           eodhd?.country  || fmp?.country || finnhub?.country || matched?.country || 'Unknown',
      subIndustry:       resolvedSubIndustry,
      isEtf:             resolvedIsEtf,
      gicsIndustryGroup: matched?.gics_industry_group || eodhd?.gicsIndustryGroup || undefined,
      gicsIndustry:      matched?.gics_industry || eodhd?.gicsIndustry || fmp?.gicsIndustry || undefined,
    };
  }

  return result;
}
