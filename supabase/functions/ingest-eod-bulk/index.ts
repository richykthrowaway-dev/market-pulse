import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ingest-eod-bulk — Nightly US Market Data Ingestion
 *
 * Efficiency profile (vs old per-ticker approach):
 *   API calls:    2 total (symbol list + bulk EOD)  vs  N individual calls
 *   DB upserts:   ~20-40 batched queries             vs  N×4 sequential queries
 *   Coverage:     ~8,000 US tickers                  vs  20 hardcoded
 *
 * Flow:
 *   1. EODHD exchange-symbol-list/US  → names + types (1 API call)
 *   2. EODHD eod-bulk-last-day/US     → prices + changes (1 API call)
 *   3. Parallel DB setup queries      → exchange_id, timeframe_id, existing listings
 *   4. Batch upsert: stocks           → ~20 queries (500 rows/batch, 5 concurrent)
 *   5. Batch create: symbols+listings → only for new tickers (incremental)
 *   6. Batch upsert: ohlcv_bars       → today's bars for all tickers
 *   7. refresh_market_returns_cache() → pre-computes 1W/1M/3M/6M/YTD/1Y/3Y/5Y/10Y
 *
 * Trigger: POST /functions/v1/ingest-eod-bulk
 *   Body (optional): { "mode": "stocks_only" }  — skips ohlcv + cache refresh
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE  = "https://eodhd.com/api";
const BATCH_SIZE  = 500;   // rows per DB upsert batch
const CONCURRENCY = 5;     // max parallel batch requests

// ── EODHD types ───────────────────────────────────────────────────────────────

interface EodSymbolEntry {
  Code:     string;
  Name:     string;
  Country:  string;
  Currency: string;
  Type:     string;
  Isin?:    string;
}

interface EodBulkBar {
  code:           string;
  date:           string;
  open:           number;
  high:           number;
  low:            number;
  close:          number;
  adjusted_close: number;
  volume:         number;
  change:         number;
  change_p:       number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch JSON from EODHD with automatic fmt=json and error logging. */
async function eodGet<T>(path: string, apiKey: string): Promise<T | null> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${EODHD_BASE}${path}${sep}api_token=${apiKey}&fmt=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`EODHD ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`EODHD ${path} fetch error:`, e);
    return null;
  }
}

/**
 * Splits items into BATCH_SIZE chunks and processes them with up to
 * CONCURRENCY chunks in parallel. Returns total error count.
 */
async function runBatches<T>(
  items: T[],
  fn: (batch: T[]) => Promise<void>,
  concurrency = CONCURRENCY,
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }
  // Process in windows of `concurrency` concurrent chunks
  for (let i = 0; i < chunks.length; i += concurrency) {
    await Promise.all(chunks.slice(i, i + concurrency).map(fn));
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0  = Date.now();
  const log: Record<string, unknown> = {};

  // ── Auth & config ──────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("EODHD_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY secret not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional mode from request body
  let mode = "full";
  try {
    const body = await req.json();
    if (body?.mode) mode = body.mode;
  } catch { /* no body */ }
  log.mode = mode;

  try {
    // ── Step 1: Fetch EODHD data (2 API calls in parallel) ────────────────────
    console.log("ingest-eod-bulk: fetching EODHD symbol list + bulk EOD...");
    const [symbolList, bulkBars] = await Promise.all([
      eodGet<EodSymbolEntry[]>("/exchange-symbol-list/US", apiKey),
      eodGet<EodBulkBar[]>("/eod-bulk-last-day/US", apiKey),
    ]);

    if (!bulkBars || !Array.isArray(bulkBars) || bulkBars.length === 0) {
      return new Response(
        JSON.stringify({ error: "No bulk EOD data returned from EODHD" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log.eodhd_symbol_list_count = symbolList?.length ?? 0;
    log.eodhd_bulk_bars_count   = bulkBars.length;
    console.log(`EODHD: ${bulkBars.length} bulk bars, ${symbolList?.length ?? 0} symbol entries`);

    // ── Step 2: Build name/type lookup map ────────────────────────────────────
    // O(N), done once — avoids per-row lookups later
    const nameMap = new Map<string, { name: string; type: string; currency: string }>();
    for (const s of (symbolList ?? [])) {
      if (s.Code) {
        nameMap.set(s.Code.toUpperCase(), {
          name:     s.Name     || s.Code,
          type:     s.Type     || "Common Stock",
          currency: s.Currency || "USD",
        });
      }
    }

    // ── Step 3: Filter to bars with valid close prices ─────────────────────────
    const validBars = bulkBars.filter((b) => {
      const close = b.adjusted_close ?? b.close;
      return b.code && close != null && Number(close) > 0;
    });
    log.valid_bars = validBars.length;
    console.log(`Valid bars after filter: ${validBars.length}`);

    // ── Step 4: DB setup queries (3 in parallel) ───────────────────────────────
    const [tfRes, exRes, listingsRes] = await Promise.all([
      // 1D timeframe ID
      supabase.from("timeframes").select("id").eq("code", "1D").single(),
      // US exchange ID
      supabase.from("exchanges").select("id, code").eq("code", "US").maybeSingle(),
      // All existing active listings: ticker → {listing_id, symbol_id}
      supabase.from("listings").select("id, local_ticker, symbol_id").eq("is_active", true),
    ]);

    const dailyTfId    = tfRes.data?.id as string | undefined;
    const usExchangeId = exRes.data?.id as string | undefined;

    if (!dailyTfId) {
      return new Response(
        JSON.stringify({ error: "1D timeframe not found in DB — run base migration first" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build O(1) lookup map for existing listings
    const existingMap = new Map<string, { listingId: string; symbolId: string }>();
    for (const row of (listingsRes.data ?? [])) {
      existingMap.set(row.local_ticker.toUpperCase(), {
        listingId: row.id,
        symbolId:  row.symbol_id,
      });
    }
    log.existing_listings = existingMap.size;
    log.us_exchange_found  = !!usExchangeId;

    const today = new Date().toISOString();

    // ── Step 5: Batch upsert stocks table ────────────────────────────────────
    // This is the primary goal — enables the 1D Market Overview for all US stocks.
    // Upserts by symbol (unique). No FK dependencies.
    console.log("Upserting stocks table...");
    const stockRows = validBars.map((b) => {
      const code  = b.code.toUpperCase();
      const info  = nameMap.get(code);
      const close = b.adjusted_close ?? b.close;
      return {
        symbol:         code,
        name:           info?.name || code,
        price:          Math.round(Number(close) * 100) / 100,
        change:         Math.round(Number(b.change  ?? 0) * 100) / 100,
        change_percent: Math.round(Number(b.change_p ?? 0) * 100) / 100,
        volume:         Math.round(Number(b.volume)  || 0),
        market_cap:     0,   // updated separately by api-market-caps
        last_updated:   today,
      };
    });

    let stocksUpserted = 0;
    await runBatches(stockRows, async (batch) => {
      const { error } = await supabase
        .from("stocks")
        .upsert(batch, { onConflict: "symbol" });
      if (error) console.error("stocks upsert error:", error.message);
      else       stocksUpserted += batch.length;
    });
    log.stocks_upserted = stocksUpserted;
    console.log(`Upserted ${stocksUpserted} stocks`);

    // Skip symbol/listing/ohlcv work if mode = stocks_only
    if (mode === "stocks_only") {
      log.elapsed_ms = Date.now() - t0;
      return new Response(JSON.stringify({ ok: true, ...log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 6: Create symbols + listings for new tickers ─────────────────────
    // Only runs for tickers not already in the existingMap (incremental).
    if (usExchangeId) {
      const newCodes = validBars
        .map((b) => b.code.toUpperCase())
        .filter((code) => !existingMap.has(code));

      log.new_tickers = newCodes.length;
      console.log(`New tickers to register: ${newCodes.length}`);

      if (newCodes.length > 0) {
        // 6a. Batch upsert symbols (on conflict: canonical_ticker)
        const newSymbolRows = newCodes.map((code) => {
          const info = nameMap.get(code);
          return {
            canonical_ticker: code,
            name:             info?.name     || code,
            type:             info?.type     || "Common Stock",
            currency:         info?.currency || "USD",
            country:          "US",
          };
        });

        const insertedSymbolIds = new Map<string, string>(); // code → symbol_id

        await runBatches(newSymbolRows, async (batch) => {
          const { data, error } = await supabase
            .from("symbols")
            .upsert(batch, { onConflict: "canonical_ticker" })
            .select("id, canonical_ticker");
          if (error) {
            console.error("symbols upsert error:", error.message);
          } else {
            for (const row of (data ?? [])) {
              insertedSymbolIds.set(row.canonical_ticker.toUpperCase(), row.id);
            }
          }
        });

        // Re-fetch any symbol IDs that weren't returned (already existed)
        const missing = newCodes.filter((c) => !insertedSymbolIds.has(c));
        if (missing.length > 0) {
          for (let i = 0; i < missing.length; i += 100) {
            const chunk = missing.slice(i, i + 100);
            const { data } = await supabase
              .from("symbols")
              .select("id, canonical_ticker")
              .in("canonical_ticker", chunk);
            for (const row of (data ?? [])) {
              insertedSymbolIds.set(row.canonical_ticker.toUpperCase(), row.id);
            }
          }
        }

        // 6b. Batch upsert listings (on conflict: symbol_id, exchange_id)
        const newListingRows = newCodes
          .filter((code) => insertedSymbolIds.has(code))
          .map((code) => {
            const info = nameMap.get(code);
            return {
              symbol_id:       insertedSymbolIds.get(code)!,
              exchange_id:     usExchangeId,
              local_ticker:    code,
              currency:        info?.currency || "USD",
              listing_type:    "equity",
              primary_listing: true,
              is_active:       true,
            };
          });

        let listingsCreated = 0;
        await runBatches(newListingRows, async (batch) => {
          const { data, error } = await supabase
            .from("listings")
            .upsert(batch, { onConflict: "symbol_id,exchange_id" })
            .select("id, local_ticker");
          if (error) {
            console.error("listings upsert error:", error.message);
          } else {
            for (const row of (data ?? [])) {
              const code = row.local_ticker.toUpperCase();
              existingMap.set(code, {
                listingId: row.id,
                symbolId:  insertedSymbolIds.get(code) ?? "",
              });
            }
            listingsCreated += batch.length;
          }
        });

        log.symbols_upserted  = insertedSymbolIds.size;
        log.listings_created  = listingsCreated;
        console.log(`Registered ${insertedSymbolIds.size} symbols, ${listingsCreated} listings`);
      }
    } else {
      console.warn("US exchange not found — skipping symbol/listing creation");
      log.warning = "US exchange not found in exchanges table";
    }

    // ── Step 7: Batch upsert today's ohlcv_bars ───────────────────────────────
    // Inserts today's daily bar for every ticker we have a listing for.
    console.log("Upserting ohlcv_bars...");
    const ohlcvRows: Record<string, unknown>[] = [];
    for (const b of validBars) {
      const code    = b.code.toUpperCase();
      const mapping = existingMap.get(code);
      if (!mapping) continue;

      ohlcvRows.push({
        listing_id:   mapping.listingId,
        timeframe_id: dailyTfId,
        ts:           new Date(b.date + "T00:00:00Z").toISOString(),
        open:         b.open,
        high:         b.high,
        low:          b.low,
        close:        b.adjusted_close ?? b.close,
        volume:       Math.round(Number(b.volume) || 0),
        vwap:         null,
        trades:       null,
        source:       "eodhd_bulk",
      });
    }

    let barsUpserted = 0;
    await runBatches(ohlcvRows, async (batch) => {
      const { error } = await supabase
        .from("ohlcv_bars")
        .upsert(batch, { onConflict: "listing_id,timeframe_id,ts" });
      if (error) console.error("ohlcv_bars upsert error:", error.message);
      else       barsUpserted += batch.length;
    });
    log.bars_upserted = barsUpserted;
    console.log(`Upserted ${barsUpserted} OHLCV bars`);

    // ── Step 8: Refresh multi-timeframe returns cache ──────────────────────────
    // Pre-computes 1W/1M/3M/6M/YTD/1Y/3Y/5Y/10Y return distributions.
    // After this, non-1D histogram queries are served from cache (1 row read).
    console.log("Refreshing market_returns_cache...");
    const { data: cacheResult, error: cacheErr } = await supabase
      .rpc("refresh_market_returns_cache");
    if (cacheErr) {
      console.error("Cache refresh error:", cacheErr.message);
      log.cache_refresh = { error: cacheErr.message };
    } else {
      log.cache_refresh = cacheResult;
    }

    log.elapsed_ms = Date.now() - t0;
    console.log("ingest-eod-bulk complete in", log.elapsed_ms, "ms:", JSON.stringify(log));

    return new Response(JSON.stringify({ ok: true, ...log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("ingest-eod-bulk fatal error:", err);
    return new Response(
      JSON.stringify({ error: String(err), ...log }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
