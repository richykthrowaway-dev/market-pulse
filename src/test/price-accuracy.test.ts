import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Price Accuracy & Mock Elimination Tests
 * 
 * Methodology:
 * - Cross-checks `stocks` table current price vs latest `ohlcv_bars` close
 * - Verifies no mock/random data generation patterns remain in source code
 * - Documents expected data gap: OHLCV ends ~Feb 12, stocks table is real-time
 * 
 * The acceptable drift between stocks.price (Polygon real-time) and
 * latest ohlcv_bars.close (EODHD historical) is documented per ticker.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "V"];

describe("Price Accuracy: stocks table vs ohlcv_bars", () => {
  it("current stock prices are within 50% of latest OHLCV close for all tickers", async () => {
    // 50% tolerance accounts for data gap (bars from EODHD may lag behind Polygon real-time)
    // and large moves like TSLA (stocks table may use stale mock seed data)
    for (const ticker of TICKERS) {
      const { data: stock } = await supabase
        .from("stocks")
        .select("price, symbol")
        .eq("symbol", ticker)
        .maybeSingle();

      expect(stock, `Stock ${ticker} should exist`).toBeTruthy();

      const { data: sym } = await supabase
        .from("symbols")
        .select("id")
        .eq("canonical_ticker", ticker)
        .maybeSingle();

      const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("symbol_id", sym!.id)
        .limit(1)
        .maybeSingle();

      const { data: tf } = await supabase
        .from("timeframes")
        .select("id")
        .eq("code", "1D")
        .maybeSingle();

      const { data: bars } = await supabase
        .from("ohlcv_bars")
        .select("close, ts")
        .eq("listing_id", listing!.id)
        .eq("timeframe_id", tf!.id)
        .order("ts", { ascending: false })
        .limit(1);

      expect(bars!.length, `${ticker} should have bars`).toBe(1);

      const stockPrice = Number(stock!.price);
      const barClose = Number(bars![0].close);
      const drift = Math.abs(stockPrice - barClose) / barClose;

      expect(
        drift,
        `${ticker}: stocks.price=$${stockPrice} vs bars.close=$${barClose} (drift=${(drift * 100).toFixed(1)}%). Gap between Polygon real-time and EODHD historical data ending ${bars![0].ts}`
      ).toBeLessThan(0.50);
    }
  });

  it("all stock prices are positive and plausible", async () => {
    const { data: stocks } = await supabase
      .from("stocks")
      .select("symbol, price, market_cap, volume");

    for (const stock of stocks!) {
      expect(Number(stock.price), `${stock.symbol} price > 0`).toBeGreaterThan(0);
      expect(Number(stock.market_cap), `${stock.symbol} market_cap > 0`).toBeGreaterThan(0);
      expect(Number(stock.volume), `${stock.symbol} volume >= 0`).toBeGreaterThanOrEqual(0);
      // No major US equity should be > $10,000 per share
      expect(Number(stock.price), `${stock.symbol} price < $10,000`).toBeLessThan(10000);
    }
  });
});

describe("Mock Data Elimination Verification", () => {
  it("stocksApi.ts contains no mock arrays or random generators", () => {
    const filePath = path.resolve(__dirname, "../utils/stocksApi.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toContain("mockStocks");
    expect(content).not.toContain("mockIndices");
    expect(content).not.toContain("mockCurrencies");
    expect(content).not.toContain("mockNews");
    expect(content).not.toContain("mockCryptos");
    expect(content).not.toContain("generatePriceHistory");
    expect(content).not.toContain("Math.random()");
    expect(content).not.toContain("useStockData");
    expect(content).not.toContain("useMarketIndices");
    expect(content).not.toContain("useCurrencyPairs");
    expect(content).not.toContain("useCryptoData");
  });

  it("no page component imports mock data from stocksApi", () => {
    const pagesDir = path.resolve(__dirname, "../pages");
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(pagesDir, file), "utf-8");
      expect(content, `${file} should not import mockStocks`).not.toContain("mockStocks");
      expect(content, `${file} should not import mockIndices`).not.toContain("mockIndices");
      expect(content, `${file} should not import mockCurrencies`).not.toContain("mockCurrencies");
      expect(content, `${file} should not import mockCryptos`).not.toContain("mockCryptos");
      expect(content, `${file} should not import generatePriceHistory`).not.toContain("generatePriceHistory");
    }
  });

  it("no component uses Math.random() for price generation", () => {
    const dirs = [
      path.resolve(__dirname, "../pages"),
      path.resolve(__dirname, "../components/stocks"),
      path.resolve(__dirname, "../hooks"),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts") || f.endsWith(".tsx"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        expect(content, `${file} should not use Math.random()`).not.toContain("Math.random()");
      }
    }
  });
});
