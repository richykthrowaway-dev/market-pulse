# Market Pulse — OpenSky Cloudflare Worker

A ~100-line Cloudflare Worker that proxies the [OpenSky Network](https://opensky-network.org/) `/states/all` REST endpoint so the Market Pulse browser app can use it as a live global flight feed.

## Why a Worker

OpenSky has the best free global flight data (~12,000 airborne aircraft worldwide), but two layers of defence stop us from calling it from a browser app hosted on Vercel:

1. **CORS** — they pin `Access-Control-Allow-Origin` to their own domain, blocking direct browser fetches.
2. **Cloud-IP filtering** — they drop connections from AWS / Azure / GCP / Vercel / Supabase Edge at the TCP level. We confirmed both Vercel serverless and Supabase Edge Functions time out at 60 s when calling OpenSky.

Cloudflare Workers run on **Cloudflare's anycast network**, which OpenSky does not block. The Worker is a pinhole that:

- Forwards browser requests to OpenSky.
- Adds `Access-Control-Allow-Origin: *` so the Market Pulse origin can read the response.
- Caches the response at the Cloudflare edge for 10 s — so 1,000 concurrent users worldwide cost the same OpenSky credits as 1 user.

## One-time deploy

```bash
cd cloudflare-worker
npm install
npx wrangler login            # opens a browser; uses your Cloudflare account
npx wrangler deploy           # deploys to https://market-pulse-opensky.<your-subdomain>.workers.dev
```

The deploy output prints the public URL. Copy it.

### (Optional) Authenticated tier

Anonymous OpenSky gives 400 credits/day. With Cloudflare's 10 s edge cache that's plenty for personal use. For the 4,000-credit/day authenticated tier:

1. Sign up at <https://opensky-network.org/>.
2. Go to *Account → API Client* and create OAuth2 client credentials.
3. Set them as Worker secrets:

   ```bash
   npx wrangler secret put OPENSKY_CLIENT_ID
   npx wrangler secret put OPENSKY_CLIENT_SECRET
   ```

The Worker will auto-detect them and switch to Bearer-token auth.

## Wire it into the app

Add the Worker URL to `.env.local` (and Vercel env vars for production):

```
VITE_OPENSKY_PROXY_URL=https://market-pulse-opensky.<your-subdomain>.workers.dev
```

Restart the dev server. `useOpenSkyFlights` detects the env var on startup and switches from airplanes.live (regional ADS-B) to OpenSky (global). You should see ~10× more aircraft and proper coverage over Africa/Russia/oceans.

## Limits

| Metric | Free plan |
|---|---|
| Worker requests | 100,000 / day |
| OpenSky credits (anonymous) | 400 / day |
| OpenSky credits (authenticated) | 4,000 / day |
| Edge cache TTL | 10 s |
| Effective polling on the client | 10 s (matches cache) |

The edge cache is doing the heavy lifting: at 10 s polling, one client uses ~6 OpenSky credits/min. Without the cache that exhausts the anonymous budget in ~70 minutes; with the cache, a thousand users still draw the same 6/min because they all share one upstream call per window.
