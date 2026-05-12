import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-prices — latest prices for key tradeable commodities via EODHD.
 *
 * All prices use ETF/equity proxies via the standard /eod endpoint.  This
 * gives daily granularity required for in-tile sparklines and the CommodityPriceChart
 * (which also uses the ticker to fetch chart bars and news).
 *
 * NOTE on the EODHD Commodities Beta API (FRED-backed):
 *   GET /api/commodities/historical/{CODE}  →  { meta, data:[{date,value}] }
 *   Energy codes (WTI, BRENT, NATURAL_GAS) are daily; agricultural/metals are monthly.
 *   `fetchCommodityApi()` below is wired up but currently unused — it is kept as
 *   infrastructure for a future "spot price comparison" mode where physical-unit
 *   benchmark prices could be shown alongside the ETF proxy returns.  Using it
 *   as the primary price source would break the chart and news components that
 *   expect an exchange-listed ticker (e.g. "GLD.US", not "WTI").
 *
 * Core:
 *     GLD.US   → Gold         (SPDR Gold Shares)
 *     SLV.US   → Silver       (iShares Silver Trust)
 *     USO.US   → Crude Oil    (United States Oil Fund — WTI)
 *     UNG.US   → Natural Gas  (United States Natural Gas Fund)
 *     CORN.US  → Corn         (Teucrium Corn Fund)
 *     WEAT.US  → Wheat        (Teucrium Wheat Fund)
 *     SOYB.US  → Soybeans     (Teucrium Soybean Fund)
 *     CPER.US  → Copper       (United States Copper Index Fund)
 *     PALL.US  → Palladium    (Aberdeen Physical Palladium)
 *
 * Phase 1 — already-tracked commodities, ETF/equity proxy:
 *     PPLT.US  → Platinum     (Aberdeen Physical Platinum)
 *     URA.US   → Uranium      (Global X Uranium ETF)
 *     LIT.US   → Lithium      (Global X Lithium & Battery Tech)
 *     BATT.US  → Cobalt       (Amplify Battery Metals — Co/Li/Ni proxy)
 *     DBB.US   → Aluminum     (Invesco DB Base Metals — Al/Zn/Cu basket)
 *     PICK.US  → Iron Ore     (iShares MSCI Metals & Mining Producers)
 *     VALE.US  → Nickel       (Vale SA — world's largest nickel producer)
 *     TECK.US  → Zinc         (Teck Resources — major zinc producer)
 *     BTU.US   → Coal         (Peabody Energy — pure-play coal)
 *     JVA.US   → Coffee       (Coffee Holding Co — JO.US delisted Jul-2023)
 *     CANE.US  → Sugar        (Teucrium Sugar)
 *     GIL.US   → Cotton       (Gildan Activewear — BAL.US delisted Jul-2023)
 *     MOS.US   → Phosphate    (Mosaic)
 *     NTR.US   → Potash       (Nutrien)
 *     AFM.V    → Tin          (Alphamin Resources, TSX-V — AFM.LSE delisted Aug-2024)
 *
 * Phase 2 — new commodity entries:
 *     REMX.US  → Rare Earths  (VanEck Rare Earth & Strategic Metals)
 *     WOOD.US  → Lumber       (iShares Global Timber & Forestry)
 *     SLX.US   → Steel        (VanEck Steel ETF)
 *     KRBN.US  → Carbon       (KraneShares Global Carbon Strategy)
 *     HYDR.US  → Hydrogen     (Global X Hydrogen ETF)
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
  /** Last ~252 daily closes, oldest → newest. Used to render in-tile sparklines. */
  sparkline: number[];
}

// ── Commodity data-source type ────────────────────────────────────────────
type DataSource = 'eod' | 'commodity';

// ── Commodity list ────────────────────────────────────────────────────────
// All entries use source: 'eod' (ETF/equity proxies) to ensure the ticker
// is compatible with chart, news, and intraday subsystems.
const COMMODITIES: Array<{
  ticker: string;
  id:     string;
  label:  string;
  unit:   string;
  source: DataSource;
}> = [
  // ── Core (already shipped) ────────────────────────────────────────────
  { ticker: "GLD.US",  id: "gold",        label: "Gold",        unit: "USD/share", source: "eod" },
  { ticker: "SLV.US",  id: "silver",      label: "Silver",      unit: "USD/share", source: "eod" },
  { ticker: "USO.US",  id: "crude_oil",   label: "Crude Oil",   unit: "USD/share", source: "eod" },
  { ticker: "UNG.US",  id: "natural_gas", label: "Natural Gas", unit: "USD/share", source: "eod" },
  { ticker: "CORN.US", id: "corn",        label: "Corn",        unit: "USD/share", source: "eod" },
  { ticker: "WEAT.US", id: "wheat",       label: "Wheat",       unit: "USD/share", source: "eod" },
  { ticker: "SOYB.US", id: "soybeans",    label: "Soybeans",    unit: "USD/share", source: "eod" },
  { ticker: "CPER.US", id: "copper",      label: "Copper",      unit: "USD/share", source: "eod" },
  { ticker: "PALL.US", id: "palladium",   label: "Palladium",   unit: "USD/share", source: "eod" },

  // ── Phase 1: already-tracked commodities, ETF/equity proxy ───────────
  { ticker: "PPLT.US", id: "platinum",   label: "Platinum",   unit: "USD/share", source: "eod" },
  { ticker: "URA.US",  id: "uranium",    label: "Uranium",    unit: "USD/share", source: "eod" },
  { ticker: "LIT.US",  id: "lithium",    label: "Lithium",    unit: "USD/share", source: "eod" },
  { ticker: "BATT.US", id: "cobalt",     label: "Cobalt",     unit: "USD/share", source: "eod" },
  { ticker: "DBB.US",  id: "aluminum",   label: "Aluminum",   unit: "USD/share", source: "eod" },
  { ticker: "PICK.US", id: "iron-ore",   label: "Iron Ore",   unit: "USD/share", source: "eod" },
  { ticker: "VALE.US", id: "nickel",     label: "Nickel",     unit: "USD/share", source: "eod" },
  { ticker: "TECK.US", id: "zinc",       label: "Zinc",       unit: "USD/share", source: "eod" },
  { ticker: "BTU.US",  id: "coal",       label: "Coal",       unit: "USD/share", source: "eod" },
  // JO.US (iPath Coffee ETN) delisted Jul-2023. FRED coffee data is monthly only.
  // JVA.US (Coffee Holding Co) is the best daily-tradeable proxy.
  { ticker: "JVA.US",  id: "coffee",     label: "Coffee",     unit: "USD/share", source: "eod" },
  { ticker: "CANE.US", id: "sugar",      label: "Sugar",      unit: "USD/share", source: "eod" },
  // BAL.US (iPath Cotton ETN) delisted Jul-2023. FRED cotton data is monthly only.
  // GIL.US (Gildan Activewear) is the best daily-tradeable proxy.
  { ticker: "GIL.US",  id: "cotton",     label: "Cotton",     unit: "USD/share", source: "eod" },
  { ticker: "MOS.US",  id: "phosphate",  label: "Phosphate",  unit: "USD/share", source: "eod" },
  { ticker: "NTR.US",  id: "potash",     label: "Potash",     unit: "USD/share", source: "eod" },
  // AFM.LSE delisted Aug-2024 when Alphamin moved to TSX-Venture.
  { ticker: "AFM.V",   id: "tin",        label: "Tin",        unit: "CAD/share", source: "eod" },

  // ── Phase 2: new commodity entries (formerly untracked) ──────────────
  { ticker: "REMX.US", id: "rare-earths",    label: "Rare Earths",    unit: "USD/share", source: "eod" },
  { ticker: "WOOD.US", id: "lumber",         label: "Lumber",         unit: "USD/share", source: "eod" },
  { ticker: "SLX.US",  id: "steel",          label: "Steel",          unit: "USD/share", source: "eod" },
  { ticker: "KRBN.US", id: "carbon-credits", label: "Carbon Credits", unit: "USD/share", source: "eod" },
  { ticker: "HYDR.US", id: "hydrogen",       label: "Hydrogen",       unit: "USD/share", source: "eod" },
];

// ── Module-level cache ────────────────────────────────────────────────────
const CACHE_TTL = 60 * 60_000; // 1 hour
let cache: { payload: string; expires: number } | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Fetch from the EODHD Commodities Beta API (FRED-backed).
 * Response: { meta: {...}, data: [{date: string, value: number}] }
 * Data is ascending (oldest first).  Limit via `from` date to avoid
 * pulling decades of history for a 252-bar sparkline.
 */
async function fetchCommodityApi(
  ticker: string,
  token: string,
): Promise<{ date: string; close: number }[] | null> {
  // ~14 months back — enough for 252 trading days with holidays
  const fromDate = new Date(Date.now() - 430 * 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];

  const url =
    `https://eodhd.com/api/commodities/historical/${ticker}` +
    `?api_token=${token}&from=${fromDate}&fmt=json`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;

  const json = await res.json() as {
    meta?: unknown;
    data?: Array<{ date: string; value: number }>;
  };

  if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
    return null;
  }

  // Normalize to the same shape as EOD bars, ascending order preserved.
  return json.data
    .filter(d => typeof d.value === "number" && Number.isFinite(d.value))
    .map(d => ({ date: d.date, close: d.value }));
}

/**
 * Fetch from the EODHD EOD endpoint (ETF / equity proxy).
 * Response: [{date, open, close, …}]  — descending order (newest first).
 *
 * EODHD uses 999999.9999 as a sentinel for missing/corrupted bar data.
 * We filter those out here so they don't corrupt sparkline min/max.
 */
async function fetchEodApi(
  ticker: string,
  token: string,
): Promise<{ date: string; close: number }[] | null> {
  const url =
    `https://eodhd.com/api/eod/${ticker}` +
    `?limit=252&order=d&fmt=json&api_token=${token}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;

  const bars = await res.json() as Array<{ date: string; close: number; open: number }>;
  if (!Array.isArray(bars) || bars.length === 0) return null;

  // Already newest-first; project to {date, close} and drop sentinel values.
  // EODHD encodes missing data as 999999.9999 — exclude any bar whose close
  // is >= 99999 to catch this sentinel regardless of floating-point rounding.
  return bars
    .filter(b =>
      typeof b.close === "number" &&
      Number.isFinite(b.close) &&
      b.close < 99_999,           // excludes EODHD's 999999.9999 sentinel
    )
    .map(b => ({ date: b.date, close: b.close }));
}

// ── Handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url  = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const bust  = url.searchParams.get("bust")  === "1";
  const probe = url.searchParams.get("probe");

  // Probe mode: hit EODHD /eod for an arbitrary ticker — useful for finding
  // working symbols when a primary proxy gets delisted.
  if (probe) {
    const token = Deno.env.get("EODHD_API_TOKEN");
    if (!token) return new Response(JSON.stringify({ error: "no_token" }), { headers: CORS });
    const tickers = probe.split(",").map(t => t.trim()).filter(Boolean);
    const results = await Promise.all(tickers.map(async (t) => {
      try {
        const r = await fetch(
          `https://eodhd.com/api/eod/${t}?limit=5&order=d&fmt=json&api_token=${token}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const body = await r.text();
        let parsed: unknown = body;
        try { parsed = JSON.parse(body); } catch { /* keep as text */ }
        const firstBar = Array.isArray(parsed) ? parsed[0] : null;
        return {
          ticker: t,
          status: r.status,
          hasBars: Array.isArray(parsed) && parsed.length > 0,
          firstBar,
          raw: typeof parsed === "string" ? body.slice(0, 200) : undefined,
        };
      } catch (e) {
        return { ticker: t, status: 0, err: String(e) };
      }
    }));
    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!bust && !debug && cache && Date.now() < cache.expires) {
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
    const diag: Array<{
      id: string; ticker: string; source: string;
      status: string; barCount: number;
      firstBar?: unknown; lastBar?: unknown; err?: string;
    }> = [];

    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        try {
          // ── Fetch bars (all current entries use 'eod' source) ─────────────
          // fetchCommodityApi() is available for future FRED spot-price mode.
          let bars: { date: string; close: number }[] | null = null;

          if (c.source === "commodity") {
            bars = await fetchCommodityApi(c.ticker, token);
          } else {
            bars = await fetchEodApi(c.ticker, token);
          }

          if (!bars || bars.length < 1) {
            diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: "empty", barCount: 0, err: "no bars" });
            return null;
          }

          // ── Normalize to descending (newest-first) ────────────────────
          // commodity API → ascending (oldest first) → reverse
          // eod API       → descending (newest first) → no change
          const descBars = c.source === "commodity"
            ? [...bars].reverse()
            : bars;

          const current = descBars[0];
          const prev    = descBars[1] ?? descBars[0];

          const changeP = prev.close > 0
            ? ((current.close - prev.close) / prev.close) * 100
            : 0;

          // Sparkline: oldest → newest for left-to-right chart rendering.
          const sparkline = c.source === "commodity"
            ? bars.slice(-252).map(b => b.close)
            : [...bars].reverse().map(b => b.close);

          diag.push({
            id: c.id, ticker: c.ticker, source: c.source,
            status: "ok", barCount: bars.length,
            firstBar: descBars[descBars.length - 1],
            lastBar:  current,
          });

          return {
            id:        c.id,
            label:     c.label,
            ticker:    c.ticker,
            price:     current.close,
            prevClose: prev.close,
            changeP:   Math.round(changeP * 100) / 100,
            date:      current.date,
            unit:      c.unit,
            sparkline,
          } as CommodityPrice;

        } catch (e) {
          diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: "error", barCount: 0, err: String(e) });
          return null;
        }
      }),
    );

    const prices: CommodityPrice[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        prices.push(r.value);
      }
    }

    if (debug) {
      return new Response(JSON.stringify({ diag, hadToken: !!token }, null, 2), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
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
