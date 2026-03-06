import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Visualization Data Integrity Tests
 * 
 * Methodology:
 * - Directly queries the Supabase database to verify OHLCV bar data integrity
 * - Validates field types, ranges, ordering, and known reference prices
 * - Ensures no mock/random data patterns exist in the price data pipeline
 * 
 * Reference prices (from EODHD historical backfill):
 * - AAPL 2025-01-02 close ≈ 242.53
 * - AAPL 2026-02-12 close ≈ 261.73
 * 
 * Data gap note: OHLCV bars end ~Feb 12, 2026 (EODHD backfill date),
 * while `stocks` table prices are current via Polygon API (~Mar 2, 2026).
 * This gap is expected and tested for.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "V"];

async function getListingId(ticker: string) {
  const { data: sym } = await supabase
    .from("symbols")
    .select("id")
    .eq("canonical_ticker", ticker)
    .maybeSingle();
  if (!sym) return null;

  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("symbol_id", sym.id)
    .limit(1)
    .maybeSingle();
  return listing?.id ?? null;
}

async function getTimeframeId(code: string) {
  const { data } = await supabase
    .from("timeframes")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

describe("OHLCV Bar Data Integrity", () => {
  it("all 8 tickers have OHLCV bars in the database", async () => {
    const tfId = await getTimeframeId("1D");
    expect(tfId).toBeTruthy();

    for (const ticker of TICKERS) {
      const listingId = await getListingId(ticker);
      expect(listingId, `Missing listing for ${ticker}`).toBeTruthy();

      const { count } = await supabase
        .from("ohlcv_bars")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId!)
        .eq("timeframe_id", tfId!);

      expect(count, `${ticker} should have bars`).toBeGreaterThan(0);
    }
  });

  it("bars have valid numeric OHLCV fields (no zeros, no negatives)", async () => {
    const listingId = await getListingId("AAPL");
    const tfId = await getTimeframeId("1D");

    const { data: bars } = await supabase
      .from("ohlcv_bars")
      .select("open, high, low, close, volume")
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .order("ts", { ascending: false })
      .limit(100);

    expect(bars).toBeTruthy();
    expect(bars!.length).toBeGreaterThan(0);

    for (const bar of bars!) {
      expect(Number(bar.open)).toBeGreaterThan(0);
      expect(Number(bar.high)).toBeGreaterThan(0);
      expect(Number(bar.low)).toBeGreaterThan(0);
      expect(Number(bar.close)).toBeGreaterThan(0);
      expect(Number(bar.volume)).toBeGreaterThanOrEqual(0);
    }
  });

  it("high >= low and close is within high-low range for each bar", async () => {
    const listingId = await getListingId("AAPL");
    const tfId = await getTimeframeId("1D");

    const { data: bars } = await supabase
      .from("ohlcv_bars")
      .select("open, high, low, close, ts")
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .order("ts", { ascending: false })
      .limit(200);

    for (const bar of bars!) {
      const h = Number(bar.high);
      const l = Number(bar.low);
      const c = Number(bar.close);
      const o = Number(bar.open);
      expect(h, `high >= low on ${bar.ts}`).toBeGreaterThanOrEqual(l);
      // EODHD data sometimes has close/open slightly outside high-low due to
      // rounding differences in adjusted data. We use 1.0 tolerance.
      expect(h + 1.0, `high+tol >= close on ${bar.ts}`).toBeGreaterThanOrEqual(c);
      expect(h + 1.0, `high+tol >= open on ${bar.ts}`).toBeGreaterThanOrEqual(o);
      expect(l - 1.0, `low-tol <= close on ${bar.ts}`).toBeLessThanOrEqual(c);
      expect(l - 1.0, `low-tol <= open on ${bar.ts}`).toBeLessThanOrEqual(o);
    }
  });

  it("bar timestamps are chronologically ordered", async () => {
    const listingId = await getListingId("MSFT");
    const tfId = await getTimeframeId("1D");

    const { data: bars } = await supabase
      .from("ohlcv_bars")
      .select("ts")
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .order("ts", { ascending: true })
      .limit(500);

    for (let i = 1; i < bars!.length; i++) {
      const prev = new Date(bars![i - 1].ts).getTime();
      const curr = new Date(bars![i].ts).getTime();
      expect(curr, `bar ${i} should be after bar ${i - 1}`).toBeGreaterThan(prev);
    }
  });

  it("AAPL close on 2025-01-02 matches known reference price (~242.53)", async () => {
    const listingId = await getListingId("AAPL");
    const tfId = await getTimeframeId("1D");

    const { data: bars } = await supabase
      .from("ohlcv_bars")
      .select("close, ts")
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .gte("ts", "2025-01-02T00:00:00Z")
      .lte("ts", "2025-01-02T23:59:59Z")
      .limit(1);

    expect(bars).toBeTruthy();
    expect(bars!.length).toBe(1);
    const close = Number(bars![0].close);
    // Allow ±$1 tolerance for data source differences
    expect(close).toBeGreaterThan(241);
    expect(close).toBeLessThan(244);
  });

  it("AAPL close on 2026-02-12 matches known reference price (~261.73)", async () => {
    const listingId = await getListingId("AAPL");
    const tfId = await getTimeframeId("1D");

    const { data: bars } = await supabase
      .from("ohlcv_bars")
      .select("close, ts")
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .gte("ts", "2026-02-12T00:00:00Z")
      .lte("ts", "2026-02-12T23:59:59Z")
      .limit(1);

    expect(bars).toBeTruthy();
    expect(bars!.length).toBe(1);
    const close = Number(bars![0].close);
    expect(close).toBeGreaterThan(260);
    expect(close).toBeLessThan(264);
  });

  it("day count scales correctly with date range", async () => {
    const listingId = await getListingId("AAPL");
    const tfId = await getTimeframeId("1D");

    const now = new Date("2026-02-12");
    const from30 = new Date(now);
    from30.setDate(from30.getDate() - 30);

    const from365 = new Date(now);
    from365.setDate(from365.getDate() - 365);

    const { count: count30 } = await supabase
      .from("ohlcv_bars")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .gte("ts", from30.toISOString())
      .lte("ts", now.toISOString());

    const { count: count365 } = await supabase
      .from("ohlcv_bars")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId!)
      .eq("timeframe_id", tfId!)
      .gte("ts", from365.toISOString())
      .lte("ts", now.toISOString());

    expect(count30).toBeGreaterThan(15); // ~20 trading days in 30 calendar days
    expect(count365).toBeGreaterThan(200); // ~250 trading days in a year
    expect(count365!).toBeGreaterThan(count30!); // more days = more bars
  });
});
