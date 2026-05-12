import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-prices — latest daily prices for key tradeable commodities.
 *
 * Data sources (per commodity):
 *
 *   yahoo-futures  — Yahoo Finance v8/finance/chart/{ticker}?range=1y&interval=1d
 *     Futures use "{symbol}=F" tickers (GC=F, CL=F, CC=F, etc.).  Gives real
 *     benchmark prices ($/oz, $/bbl, $/MT) rather than ETF share prices.
 *     CBOT grains (corn ZC=F, wheat ZW=F, soybeans ZS=F) and ICE softs
 *     (coffee KC=F, sugar SB=F, cotton CT=F) are quoted in cents/unit on the
 *     exchange — `scale:100` converts them to $/unit for cleaner display.
 *     Yahoo returns bars in ascending (oldest-first) order.
 *
 *   eod  — EODHD /api/eod/{ticker} (ETF / equity proxy)
 *     Used for commodities with no liquid futures accessible here:
 *     battery metals (LIT, BATT), base metals (DBB, PICK, VALE, TECK),
 *     specialty commodities (REMX, WOOD, SLX, KRBN, HYDR), coal, tin.
 *     Returns bars descending (newest-first).
 *
 * eodhdTicker (optional):
 *   For futures entries, this preserves the old EODHD ETF ticker.
 *   The chart (useEodhdBarsForChart) and news (useEodhdNews) subsystems
 *   use eodhdTicker so they keep working even after the price source changes.
 *
 * Server cache: 1 hour.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface CommodityPrice {
  id:           string;
  label:        string;
  ticker:       string;
  /** EODHD ticker for chart + news subsystems (only present for futures entries). */
  eodhdTicker?: string;
  price:        number;
  prevClose:    number;
  changeP:      number;
  date:         string;
  unit:         string;
  sparkline:    number[];
}

type DataSource = 'yahoo-futures' | 'eod';

const COMMODITIES: Array<{
  ticker:       string;
  id:           string;
  label:        string;
  unit:         string;
  source:       DataSource;
  eodhdTicker?: string;
  /** Divide raw price/close values by this factor (100 for ¢-quoted futures). */
  scale?:       number;
}> = [
  // ── Yahoo Finance futures ─────────────────────────────────────────────────
  // Precious metals
  { ticker: "GC=F",  id: "gold",        label: "Gold",        unit: "USD/oz",    source: "yahoo-futures", eodhdTicker: "GLD.US"  },
  { ticker: "SI=F",  id: "silver",      label: "Silver",      unit: "USD/oz",    source: "yahoo-futures", eodhdTicker: "SLV.US"  },
  { ticker: "PL=F",  id: "platinum",    label: "Platinum",    unit: "USD/oz",    source: "yahoo-futures", eodhdTicker: "PPLT.US" },
  { ticker: "PA=F",  id: "palladium",   label: "Palladium",   unit: "USD/oz",    source: "yahoo-futures", eodhdTicker: "PALL.US" },
  // Energy
  { ticker: "CL=F",  id: "crude_oil",   label: "Crude Oil",   unit: "USD/bbl",   source: "yahoo-futures", eodhdTicker: "USO.US"  },
  { ticker: "BZ=F",  id: "brent",       label: "Brent Crude", unit: "USD/bbl",   source: "yahoo-futures"                         },
  { ticker: "NG=F",  id: "natural_gas", label: "Natural Gas", unit: "USD/MMBtu", source: "yahoo-futures", eodhdTicker: "UNG.US"  },
  { ticker: "HO=F",  id: "heating_oil", label: "Heating Oil", unit: "USD/gal",   source: "yahoo-futures"                         },
  { ticker: "RB=F",  id: "gasoline",    label: "Gasoline",    unit: "USD/gal",   source: "yahoo-futures"                         },
  // Base metals (futures)
  { ticker: "HG=F",  id: "copper",      label: "Copper",      unit: "USD/lb",    source: "yahoo-futures", eodhdTicker: "CPER.US" },
  // Agriculture — grains quoted in ¢/bu → scale:100 converts to $/bu
  { ticker: "ZC=F",  id: "corn",        label: "Corn",        unit: "USD/bu",    source: "yahoo-futures", eodhdTicker: "CORN.US", scale: 100 },
  { ticker: "ZW=F",  id: "wheat",       label: "Wheat",       unit: "USD/bu",    source: "yahoo-futures", eodhdTicker: "WEAT.US", scale: 100 },
  { ticker: "ZS=F",  id: "soybeans",    label: "Soybeans",    unit: "USD/bu",    source: "yahoo-futures", eodhdTicker: "SOYB.US", scale: 100 },
  // Softs — quoted in ¢/unit → scale:100 converts to $/unit
  { ticker: "KC=F",  id: "coffee",      label: "Coffee",      unit: "USD/lb",    source: "yahoo-futures",                        scale: 100 },
  { ticker: "SB=F",  id: "sugar",       label: "Sugar",       unit: "USD/lb",    source: "yahoo-futures", eodhdTicker: "CANE.US", scale: 100 },
  { ticker: "CT=F",  id: "cotton",      label: "Cotton",      unit: "USD/lb",    source: "yahoo-futures",                        scale: 100 },
  { ticker: "CC=F",  id: "cocoa",       label: "Cocoa",       unit: "USD/MT",    source: "yahoo-futures"                         },

  // ── EODHD ETF / equity proxies (no accessible futures) ───────────────────
  // Energy (specialty)
  { ticker: "BTU.US",  id: "coal",        label: "Coal",        unit: "USD/share", source: "eod" },
  { ticker: "URA.US",  id: "uranium",     label: "Uranium",     unit: "USD/share", source: "eod" },
  { ticker: "KRBN.US", id: "carbon",      label: "Carbon",      unit: "USD/share", source: "eod" },
  { ticker: "HYDR.US", id: "hydrogen",    label: "Hydrogen",    unit: "USD/share", source: "eod" },
  // Base / industrial metals (LME — not accessible via EODHD EOD plan)
  { ticker: "DBB.US",  id: "aluminum",    label: "Aluminum",    unit: "USD/share", source: "eod" },
  { ticker: "PICK.US", id: "iron_ore",    label: "Iron Ore",    unit: "USD/share", source: "eod" },
  { ticker: "VALE.US", id: "nickel",      label: "Nickel",      unit: "USD/share", source: "eod" },
  { ticker: "TECK.US", id: "zinc",        label: "Zinc",        unit: "USD/share", source: "eod" },
  { ticker: "AFM.V",   id: "tin",         label: "Tin",         unit: "CAD/share", source: "eod" },
  { ticker: "SLX.US",  id: "steel",       label: "Steel",       unit: "USD/share", source: "eod" },
  // Battery / tech metals
  { ticker: "LIT.US",  id: "lithium",     label: "Lithium",     unit: "USD/share", source: "eod" },
  { ticker: "BATT.US", id: "cobalt",      label: "Cobalt",      unit: "USD/share", source: "eod" },
  { ticker: "REMX.US", id: "rare_earths", label: "Rare Earths", unit: "USD/share", source: "eod" },
  // Agriculture (fertilisers + forestry — no liquid futures)
  { ticker: "MOS.US",  id: "phosphate",   label: "Phosphate",   unit: "USD/share", source: "eod" },
  { ticker: "NTR.US",  id: "potash",      label: "Potash",      unit: "USD/share", source: "eod" },
  { ticker: "WOOD.US", id: "lumber",      label: "Lumber",      unit: "USD/share", source: "eod" },
];

const CACHE_TTL = 60 * 60_000; // 1 hour
let cache: { payload: string; expires: number } | null = null;

// ── Data fetchers ─────────────────────────────────────────────────────────────

/**
 * Yahoo Finance v8 chart — 1 year of daily closes for a futures ticker.
 * Returns bars in ascending order (oldest first).
 * `scale` divides each close (use 100 for ¢-quoted contracts like ZC=F).
 */
async function fetchYahooFutures(
  ticker: string,
  scale = 1,
): Promise<{ date: string; close: number }[] | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=1y&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[]          = result.timestamp ?? [];
    const closes: (number | null)[]     = result.indicators?.quote?.[0]?.close ?? [];
    if (!timestamps.length || !closes.length) return null;

    const bars: { date: string; close: number }[] = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
      bars.push({ date, close: c / scale });
    }
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  }
}

/**
 * EODHD EOD endpoint (ETF / equity proxy).
 * Returns bars in descending order (newest first).
 * Filters out EODHD's 999999.9999 missing-data sentinel.
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
  const bars = await res.json() as Array<{ date: string; close: number }>;
  if (!Array.isArray(bars) || bars.length === 0) return null;
  return bars.filter(b =>
    typeof b.close === "number" && Number.isFinite(b.close) && b.close < 99_999,
  ).map(b => ({ date: b.date, close: b.close }));
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url   = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const bust  = url.searchParams.get("bust")  === "1";
  const probe = url.searchParams.get("probe");

  // Probe mode: test arbitrary tickers against EODHD EOD or Yahoo
  if (probe) {
    const token   = Deno.env.get("EODHD_API_TOKEN");
    const tickers = probe.split(",").map(t => t.trim()).filter(Boolean);
    const results = await Promise.all(tickers.map(async (t) => {
      // =F tickers → Yahoo Finance probe
      if (t.endsWith("=F")) {
        try {
          const bars = await fetchYahooFutures(t, 1);
          return { ticker: t, source: "yahoo", hasBars: !!bars?.length, firstBar: bars?.[bars.length - 1] ?? null };
        } catch (e) {
          return { ticker: t, source: "yahoo", err: String(e) };
        }
      }
      // Everything else → EODHD probe
      if (!token) return { ticker: t, status: 0, err: "no_token" };
      try {
        const r = await fetch(
          `https://eodhd.com/api/eod/${t}?limit=5&order=d&fmt=json&api_token=${token}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const body = await r.text();
        let parsed: unknown = body;
        try { parsed = JSON.parse(body); } catch { /* keep as text */ }
        return {
          ticker: t, status: r.status,
          hasBars: Array.isArray(parsed) && parsed.length > 0,
          firstBar: Array.isArray(parsed) ? parsed[0] : null,
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

  type Diag = { id: string; ticker: string; source: string; status: string; barCount: number; firstBar?: unknown; lastBar?: unknown; err?: string };
  const diag: Diag[] = [];

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        try {
          // ── Fetch bars ──────────────────────────────────────────────────
          let bars: { date: string; close: number }[] | null = null;

          if (c.source === "yahoo-futures") {
            bars = await fetchYahooFutures(c.ticker, c.scale ?? 1);
          } else {
            if (!token) {
              diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: "no_token", barCount: 0 });
              return null;
            }
            bars = await fetchEodApi(c.ticker, token);
          }

          if (!bars || bars.length < 2) {
            diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: "empty", barCount: bars?.length ?? 0, err: "insufficient bars" });
            return null;
          }

          // ── Normalise to descending (newest-first) ─────────────────────
          // yahoo-futures → ascending (oldest-first) → reverse
          // eod           → descending (newest-first) → no change
          const descBars = c.source === "yahoo-futures"
            ? [...bars].reverse()
            : bars;

          const current = descBars[0];
          const prev    = descBars[1];
          const changeP = prev.close > 0
            ? ((current.close - prev.close) / prev.close) * 100
            : 0;

          // Sparkline: oldest → newest for left-to-right rendering.
          // For Yahoo (already ascending), just take the raw array.
          // For EOD (descending), reverse to get ascending.
          const sparkline = c.source === "yahoo-futures"
            ? bars.slice(-252).map(b => b.close)
            : [...bars].reverse().slice(-252).map(b => b.close);

          diag.push({
            id: c.id, ticker: c.ticker, source: c.source,
            status: "ok", barCount: bars.length,
            firstBar: descBars[descBars.length - 1],
            lastBar:  current,
          });

          return {
            id:           c.id,
            label:        c.label,
            ticker:       c.ticker,
            eodhdTicker:  c.eodhdTicker,
            price:        current.close,
            prevClose:    prev.close,
            changeP:      Math.round(changeP * 100) / 100,
            date:         current.date,
            unit:         c.unit,
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
      if (r.status === "fulfilled" && r.value !== null) prices.push(r.value);
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
