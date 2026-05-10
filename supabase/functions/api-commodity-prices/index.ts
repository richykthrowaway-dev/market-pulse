import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-prices — latest prices for key tradeable commodities via EODHD.
 *
 * Direct commodity futures (CBOT/NYMEX/COMEX) require a higher EODHD tier,
 * so we use highly-correlated commodity ETFs as proxies:
 *
 *   GLD.US   → Gold         (SPDR Gold Shares, tracks LBMA Gold Price)
 *   SLV.US   → Silver       (iShares Silver Trust)
 *   USO.US   → Crude Oil    (United States Oil Fund, tracks WTI front-month)
 *   UNG.US   → Natural Gas  (United States Natural Gas Fund)
 *   CORN.US  → Corn         (Teucrium Corn Fund)
 *   WEAT.US  → Wheat        (Teucrium Wheat Fund)
 *   SOYB.US  → Soybeans     (Teucrium Soybean Fund)
 *   CPER.US  → Copper       (United States Copper Index Fund)
 *   PALL.US  → Palladium    (Aberdeen Standard Physical Palladium Shares ETF)
 *
 * Server cache: 1 hour — commodity ETFs update at EOD; no need to poll more often.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface CommodityPrice {
  /** Internal commodity ID (matches keys used in affectedCommodities.ts) */
  id:       string;
  label:    string;
  ticker:   string;
  price:    number;
  /** Previous close */
  prevClose: number;
  /** Change % from previous close */
  changeP:  number;
  date:     string;
  /** Unit for price display */
  unit:     string;
}

// ── Commodity ETF → commodity metadata mapping ────────────────────────────
const COMMODITIES: Array<{
  ticker: string;
  id:     string;
  label:  string;
  unit:   string;
}> = [
  { ticker: "GLD.US",  id: "gold",        label: "Gold",        unit: "USD/share" },
  { ticker: "SLV.US",  id: "silver",      label: "Silver",      unit: "USD/share" },
  { ticker: "USO.US",  id: "crude_oil",   label: "Crude Oil",   unit: "USD/share" },
  { ticker: "UNG.US",  id: "natural_gas", label: "Natural Gas", unit: "USD/share" },
  { ticker: "CORN.US", id: "corn",        label: "Corn",        unit: "USD/share" },
  { ticker: "WEAT.US", id: "wheat",       label: "Wheat",       unit: "USD/share" },
  { ticker: "SOYB.US", id: "soybeans",    label: "Soybeans",    unit: "USD/share" },
  { ticker: "CPER.US", id: "copper",      label: "Copper",      unit: "USD/share" },
  { ticker: "PALL.US", id: "palladium",   label: "Palladium",   unit: "USD/share" },
];

// ── Module-level cache ────────────────────────────────────────────────────
const CACHE_TTL = 60 * 60_000; // 1 hour
let cache: { payload: string; expires: number } | null = null;

// ── Handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (cache && Date.now() < cache.expires) {
    return new Response(cache.payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("EODHD_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ prices: [], error: "no_token" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch last 2 EOD bars for each ticker — gives us current + prev close
    // for daily change calculation. All fetches in parallel.
    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        const url = `https://eodhd.com/api/eod/${c.ticker}?limit=2&order=d&fmt=json&api_token=${token}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return null;

        const bars = await res.json() as Array<{
          date:  string;
          close: number;
          open:  number;
        }>;
        if (!bars || bars.length < 1) return null;

        const current   = bars[0];
        const prev      = bars[1] ?? bars[0];
        const changeP   = prev.close > 0
          ? ((current.close - prev.close) / prev.close) * 100
          : 0;

        return {
          id:        c.id,
          label:     c.label,
          ticker:    c.ticker,
          price:     current.close,
          prevClose: prev.close,
          changeP:   Math.round(changeP * 100) / 100,
          date:      current.date,
          unit:      c.unit,
        } as CommodityPrice;
      }),
    );

    const prices: CommodityPrice[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        prices.push(r.value);
      }
    }

    const payload = JSON.stringify({ prices, timestamp: Date.now() });
    cache = { payload, expires: Date.now() + CACHE_TTL };

    return new Response(payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api-commodity-prices]", err);
    return new Response(
      JSON.stringify({ prices: [], error: String(err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
