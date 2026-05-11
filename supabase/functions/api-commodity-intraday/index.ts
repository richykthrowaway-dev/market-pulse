import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-intraday — hourly intraday bars for the 9 commodity ETF proxies.
 *
 * Used by the "1D" sparkline range in CommoditiesPanel to show today's
 * price action broken down hour-by-hour rather than showing a flat 2-bar
 * EOD line.
 *
 * EODHD endpoint: GET /intraday/{ticker}?interval=1h
 * Cost: 5 credits per ticker → 45 credits per full refresh (9 tickers).
 * Server cache: 15 minutes — intraday data refreshes throughout the session.
 *
 * Returns the last 48 hours of 1h bars for each ticker so we cover:
 *   - today's full regular session (9:30am–4pm ET)
 *   - pre/aftermarket bars
 *   - yesterday's close as context if markets are closed / pre-open
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface IntradayBar {
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** ISO datetime string in exchange local time */
  datetime:  string;
  close:     number;
}

export interface CommodityIntraday {
  id:    string;
  label: string;
  ticker: string;
  bars:  IntradayBar[];
}

export interface CommodityIntradayResponse {
  intraday:  CommodityIntraday[];
  timestamp: number;
}

// Same 9 tickers as api-commodity-prices — ids must match.
const COMMODITIES: Array<{ ticker: string; id: string; label: string }> = [
  { ticker: "GLD.US",  id: "gold",        label: "Gold"        },
  { ticker: "SLV.US",  id: "silver",      label: "Silver"      },
  { ticker: "USO.US",  id: "crude_oil",   label: "Crude Oil"   },
  { ticker: "UNG.US",  id: "natural_gas", label: "Natural Gas" },
  { ticker: "CORN.US", id: "corn",        label: "Corn"        },
  { ticker: "WEAT.US", id: "wheat",       label: "Wheat"       },
  { ticker: "SOYB.US", id: "soybeans",    label: "Soybeans"    },
  { ticker: "CPER.US", id: "copper",      label: "Copper"      },
  { ticker: "PALL.US", id: "palladium",   label: "Palladium"   },
];

const CACHE_TTL = 15 * 60_000; // 15 minutes
let cache: { payload: string; expires: number } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (cache && Date.now() < cache.expires) {
    return new Response(cache.payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("EODHD_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ intraday: [], error: "no_token" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch from 48 hours ago so we always cover a full trading session even
  // if the user opens the app before markets open.
  const fromTs = Math.floor(Date.now() / 1000) - 48 * 3600;

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        const url =
          `https://eodhd.com/api/intraday/${c.ticker}` +
          `?interval=1h&from=${fromTs}&fmt=json&api_token=${token}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return null;

        const raw = await res.json() as Array<{
          timestamp: number;
          datetime:  string;
          close:     number;
        }>;
        if (!Array.isArray(raw) || raw.length === 0) return null;

        const bars: IntradayBar[] = raw
          .filter((b) => typeof b.close === "number" && Number.isFinite(b.close))
          .map((b)  => ({ timestamp: b.timestamp, datetime: b.datetime, close: b.close }));

        return {
          id:    c.id,
          label: c.label,
          ticker: c.ticker,
          bars,
        } as CommodityIntraday;
      }),
    );

    const intraday: CommodityIntraday[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        intraday.push(r.value);
      }
    }

    const payload = JSON.stringify({ intraday, timestamp: Date.now() });
    cache = { payload, expires: Date.now() + CACHE_TTL };

    return new Response(payload, {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api-commodity-intraday]", err);
    return new Response(
      JSON.stringify({ intraday: [], error: String(err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
