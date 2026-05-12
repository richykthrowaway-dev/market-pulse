import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-intraday — hourly intraday bars for commodity price tiles.
 *
 * Used by the "1D" and "1W" sparkline ranges in CommoditiesPanel.
 *
 * Two data sources:
 *   eodhd        — EODHD /intraday/{ticker}?interval=1h  (ETF/equity proxies)
 *   yahoo-futures — Yahoo Finance v8/chart/{ticker}?range=5d&interval=1h
 *                   Used for futures tickers (GC=F, CL=F, etc.) that aren't
 *                   available on the EODHD intraday plan.
 *
 * IDs MUST match the ids returned by api-commodity-prices — the client
 * joins the two responses by id. Any mismatch silently produces no sparkline
 * on the 1D/1W range.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface IntradayBar {
  timestamp: number;
  datetime:  string;
  close:     number;
}

export interface CommodityIntraday {
  id:     string;
  label:  string;
  ticker: string;
  bars:   IntradayBar[];
}

export interface CommodityIntradayResponse {
  intraday:  CommodityIntraday[];
  timestamp: number;
}

type Source = "eodhd" | "yahoo-futures";

const COMMODITIES: Array<{ ticker: string; id: string; label: string; source: Source }> = [
  // ── Yahoo Finance futures ─────────────────────────────────────────────────
  // These use Yahoo Finance intraday since EODHD doesn't carry them.
  // Precious metals
  { ticker: "GC=F",  id: "gold",        label: "Gold",          source: "yahoo-futures" },
  { ticker: "SI=F",  id: "silver",      label: "Silver",        source: "yahoo-futures" },
  { ticker: "PL=F",  id: "platinum",    label: "Platinum",      source: "yahoo-futures" },
  { ticker: "PA=F",  id: "palladium",   label: "Palladium",     source: "yahoo-futures" },
  // Energy
  { ticker: "CL=F",  id: "crude_oil",   label: "Crude Oil",     source: "yahoo-futures" },
  { ticker: "BZ=F",  id: "brent",       label: "Brent Crude",   source: "yahoo-futures" },
  { ticker: "NG=F",  id: "natural_gas", label: "Natural Gas",   source: "yahoo-futures" },
  { ticker: "HO=F",  id: "heating_oil", label: "Heating Oil",   source: "yahoo-futures" },
  { ticker: "RB=F",  id: "gasoline",    label: "Gasoline",      source: "yahoo-futures" },
  // Base metals
  { ticker: "HG=F",  id: "copper",      label: "Copper",        source: "yahoo-futures" },
  // Agriculture — grains + softs via Yahoo futures
  { ticker: "ZC=F",  id: "corn",        label: "Corn",          source: "yahoo-futures" },
  { ticker: "ZW=F",  id: "wheat",       label: "Wheat",         source: "yahoo-futures" },
  { ticker: "ZS=F",  id: "soybeans",    label: "Soybeans",      source: "yahoo-futures" },
  { ticker: "KC=F",  id: "coffee",      label: "Coffee",        source: "yahoo-futures" },
  { ticker: "SB=F",  id: "sugar",       label: "Sugar",         source: "yahoo-futures" },
  { ticker: "CT=F",  id: "cotton",      label: "Cotton",        source: "yahoo-futures" },
  { ticker: "CC=F",  id: "cocoa",       label: "Cocoa",         source: "yahoo-futures" },

  // ── EODHD ETF / equity proxies ────────────────────────────────────────────
  { ticker: "BTU.US",  id: "coal",        label: "Coal",          source: "eodhd" },
  { ticker: "URA.US",  id: "uranium",     label: "Uranium",       source: "eodhd" },
  { ticker: "KRBN.US", id: "carbon",      label: "Carbon",        source: "eodhd" },
  { ticker: "HYDR.US", id: "hydrogen",    label: "Hydrogen",      source: "eodhd" },
  { ticker: "DBB.US",  id: "aluminum",    label: "Aluminum",      source: "eodhd" },
  { ticker: "PICK.US", id: "iron_ore",    label: "Iron Ore",      source: "eodhd" },
  { ticker: "VALE.US", id: "nickel",      label: "Nickel",        source: "eodhd" },
  { ticker: "TECK.US", id: "zinc",        label: "Zinc",          source: "eodhd" },
  { ticker: "AFM.V",   id: "tin",         label: "Tin",           source: "eodhd" },
  { ticker: "SLX.US",  id: "steel",       label: "Steel",         source: "eodhd" },
  { ticker: "LIT.US",  id: "lithium",     label: "Lithium",       source: "eodhd" },
  { ticker: "BATT.US", id: "cobalt",      label: "Cobalt",        source: "eodhd" },
  { ticker: "REMX.US", id: "rare_earths", label: "Rare Earths",   source: "eodhd" },
  { ticker: "MOS.US",  id: "phosphate",   label: "Phosphate",     source: "eodhd" },
  { ticker: "NTR.US",  id: "potash",      label: "Potash",        source: "eodhd" },
  { ticker: "WOOD.US", id: "lumber",      label: "Lumber",        source: "eodhd" },
];

const CACHE_TTL = 15 * 60_000; // 15 minutes
let cache: { payload: string; expires: number } | null = null;

// ── Fetchers ──────────────────────────────────────────────────────────────────

/**
 * Yahoo Finance v8 chart — 5 days of 1h bars for a futures ticker.
 * Same response shape as the daily endpoint used in api-commodity-prices.
 * Returns bars in ascending order (oldest first).
 */
async function fetchYahooIntraday(
  ticker: string,
): Promise<IntradayBar[] | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=5d&interval=1h`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
        "Accept":     "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[]      = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    if (!timestamps.length || !closes.length) return null;

    const bars: IntradayBar[] = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;
      const ts = timestamps[i];
      const dt = new Date(ts * 1000).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
      bars.push({ timestamp: ts, datetime: dt, close: c });
    }
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url   = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const bust  = url.searchParams.get("bust")  === "1";

  if (!bust && !debug && cache && Date.now() < cache.expires) {
    return new Response(cache.payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("EODHD_API_TOKEN");

  // Fetch from 7 days ago. Covers weekend/holiday gaps for the 1W 4h sparkline.
  const fromTs = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  const diag: Array<{
    id: string; ticker: string; source: string;
    status: number; barCount: number; sample?: unknown; err?: string;
  }> = [];

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        try {
          let bars: IntradayBar[] | null = null;

          if (c.source === "yahoo-futures") {
            bars = await fetchYahooIntraday(c.ticker);
          } else {
            if (!token) {
              diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: 0, barCount: 0, err: "no_token" });
              return null;
            }
            const apiUrl =
              `https://eodhd.com/api/intraday/${c.ticker}` +
              `?interval=1h&from=${fromTs}&fmt=json&api_token=${token}`;
            const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12_000) });
            if (!res.ok) {
              const body = await res.text().catch(() => "");
              diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: res.status, barCount: 0, err: body.slice(0, 200) });
              return null;
            }
            const raw = await res.json() as Array<{ timestamp: number; datetime: string; close: number }>;
            if (!Array.isArray(raw) || raw.length === 0) {
              diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: 200, barCount: 0, err: "empty array" });
              return null;
            }
            bars = raw
              .filter(b => typeof b.close === "number" && Number.isFinite(b.close))
              .map(b  => ({ timestamp: b.timestamp, datetime: b.datetime, close: b.close }));
          }

          if (!bars || bars.length === 0) {
            diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: 200, barCount: 0, err: "no bars" });
            return null;
          }

          diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: 200, barCount: bars.length, sample: bars[0] });

          return { id: c.id, label: c.label, ticker: c.ticker, bars } as CommodityIntraday;
        } catch (e) {
          diag.push({ id: c.id, ticker: c.ticker, source: c.source, status: 0, barCount: 0, err: String(e) });
          return null;
        }
      }),
    );

    const intraday: CommodityIntraday[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) intraday.push(r.value);
    }

    if (debug) {
      return new Response(JSON.stringify({ diag, fromTs, hadToken: !!token }, null, 2), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ intraday, timestamp: Date.now() });
    cache = { payload, expires: Date.now() + CACHE_TTL };

    return new Response(payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api-commodity-intraday]", err);
    return new Response(
      JSON.stringify({ intraday: [], error: String(err), diag }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
