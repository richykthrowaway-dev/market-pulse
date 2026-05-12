import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-commodity-intraday — hourly intraday bars for the commodity ETF proxies.
 *
 * Used by the "1D" sparkline range in CommoditiesPanel to show today's
 * price action broken down hour-by-hour rather than showing a flat 2-bar
 * EOD line.
 *
 * Ticker list MUST stay in sync with api-commodity-prices — both functions
 * share the `id` keying that the client uses to join EOD + intraday data
 * per-tile. Adding a commodity in one without the other leaves the new
 * tiles with no 1D sparkline (silent failure, graceful skip).
 *
 * EODHD endpoint: GET /intraday/{ticker}?interval=1h
 * Cost: 5 credits per ticker. With 29 tickers a full refresh costs 145
 * credits, gated by the 15-min server cache + `enabled: false` on the
 * client when not on the 1D tab.
 *
 * Returns the last 48 hours of 1h bars for each ticker so we cover:
 *   - today's full regular session
 *   - pre/aftermarket bars (where supported by EODHD)
 *   - yesterday's close as context if markets are closed / pre-open
 *
 * Note: some thin-volume / LSE small-cap proxies (e.g. AFM.LSE for tin)
 * may not have intraday data on EODHD. Those tickers return an empty
 * bars array — the client falls back to the "mkt closed" placeholder.
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

// MUST match api-commodity-prices ticker list — ids are the join key on
// the client. When you add/remove a commodity here, update there too.
const COMMODITIES: Array<{ ticker: string; id: string; label: string }> = [
  // Core
  { ticker: "GLD.US",  id: "gold",        label: "Gold"        },
  { ticker: "SLV.US",  id: "silver",      label: "Silver"      },
  { ticker: "USO.US",  id: "crude_oil",   label: "Crude Oil"   },
  { ticker: "UNG.US",  id: "natural_gas", label: "Natural Gas" },
  { ticker: "CORN.US", id: "corn",        label: "Corn"        },
  { ticker: "WEAT.US", id: "wheat",       label: "Wheat"       },
  { ticker: "SOYB.US", id: "soybeans",    label: "Soybeans"    },
  { ticker: "CPER.US", id: "copper",      label: "Copper"      },
  { ticker: "PALL.US", id: "palladium",   label: "Palladium"   },

  // Phase 1 — already-tracked commodities, ETF/equity proxy
  { ticker: "PPLT.US", id: "platinum",   label: "Platinum"   },
  { ticker: "URA.US",  id: "uranium",    label: "Uranium"    },
  { ticker: "LIT.US",  id: "lithium",    label: "Lithium"    },
  { ticker: "BATT.US", id: "cobalt",     label: "Cobalt"     },
  { ticker: "DBB.US",  id: "aluminum",   label: "Aluminum"   },
  { ticker: "PICK.US", id: "iron-ore",   label: "Iron Ore"   },
  { ticker: "VALE.US", id: "nickel",     label: "Nickel"     },
  { ticker: "TECK.US", id: "zinc",       label: "Zinc"       },
  { ticker: "BTU.US",  id: "coal",       label: "Coal"       },
  { ticker: "JVA.US",  id: "coffee",     label: "Coffee"     },
  { ticker: "CANE.US", id: "sugar",      label: "Sugar"      },
  { ticker: "GIL.US",  id: "cotton",     label: "Cotton"     },
  { ticker: "MOS.US",  id: "phosphate",  label: "Phosphate"  },
  { ticker: "NTR.US",  id: "potash",     label: "Potash"     },
  { ticker: "AFM.V",   id: "tin",        label: "Tin"        },

  // Phase 2 — new commodity entries
  { ticker: "REMX.US", id: "rare-earths",    label: "Rare Earths"    },
  { ticker: "WOOD.US", id: "lumber",         label: "Lumber"         },
  { ticker: "SLX.US",  id: "steel",          label: "Steel"          },
  { ticker: "KRBN.US", id: "carbon-credits", label: "Carbon Credits" },
  { ticker: "HYDR.US", id: "hydrogen",       label: "Hydrogen"       },
];

const CACHE_TTL = 15 * 60_000; // 15 minutes
let cache: { payload: string; expires: number } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const bust  = url.searchParams.get("bust")  === "1";

  if (!bust && !debug && cache && Date.now() < cache.expires) {
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

  // Fetch from 7 days ago. 48h was too short — if it's Monday morning the
  // last bars from Friday's close fall outside the window and the response
  // is empty. A week covers all weekend/holiday gaps with plenty of margin;
  // the client only renders the last ~12-24 hourly bars anyway.
  const fromTs = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  // Per-ticker diagnostics so we can find the silent failure mode.
  const diag: Array<{ id: string; ticker: string; status: number; barCount: number; sample?: unknown; err?: string }> = [];

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(async (c) => {
        const apiUrl =
          `https://eodhd.com/api/intraday/${c.ticker}` +
          `?interval=1h&from=${fromTs}&fmt=json&api_token=${token}`;
        try {
          const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12_000) });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            diag.push({ id: c.id, ticker: c.ticker, status: res.status, barCount: 0, err: body.slice(0, 200) });
            return null;
          }

          const raw = await res.json() as Array<{
            timestamp: number;
            datetime:  string;
            close:     number;
          }>;
          if (!Array.isArray(raw) || raw.length === 0) {
            diag.push({ id: c.id, ticker: c.ticker, status: res.status, barCount: 0, err: "empty array" });
            return null;
          }

          const bars: IntradayBar[] = raw
            .filter((b) => typeof b.close === "number" && Number.isFinite(b.close))
            .map((b)  => ({ timestamp: b.timestamp, datetime: b.datetime, close: b.close }));

          diag.push({ id: c.id, ticker: c.ticker, status: res.status, barCount: bars.length, sample: raw[0] });

          return {
            id:    c.id,
            label: c.label,
            ticker: c.ticker,
            bars,
          } as CommodityIntraday;
        } catch (e) {
          diag.push({ id: c.id, ticker: c.ticker, status: 0, barCount: 0, err: String(e) });
          return null;
        }
      }),
    );

    const intraday: CommodityIntraday[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        intraday.push(r.value);
      }
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
