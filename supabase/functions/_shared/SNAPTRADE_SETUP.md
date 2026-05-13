# SnapTrade Integration — Setup

Phase 1 of automatic portfolio tracking via SnapTrade. Free tier: 5 brokerage
connections across the whole app (dev/demo only). Paid: $2/connected user/month.

## 1. Get API credentials

1. Sign up at <https://snaptrade.com>
2. From the dashboard, copy your **Client ID** (public) and **Consumer Key** (secret)
3. Treat the Consumer Key like a password — anyone with it can sign requests
   on behalf of any user registered under your Client ID

## 2. Store credentials as Supabase secrets

From the project root:

```bash
npx supabase secrets set SNAPTRADE_CLIENT_ID=<your-client-id>
npx supabase secrets set SNAPTRADE_CONSUMER_KEY=<your-consumer-key>
```

Or via dashboard: **Project Settings → Edge Functions → Secrets**.

Verify:

```bash
npx supabase secrets list
```

## 3. Apply the database migration

```bash
npx supabase db push --linked --yes
```

This creates four tables:

- `snaptrade_users` — per-Supabase-user SnapTrade registration
- `snaptrade_connections` — connected brokerage authorizations
- `snaptrade_accounts` — accounts exposed by each connection
- `snaptrade_holdings` — position snapshot (replaced on every sync)

All four have RLS enabled — users can only read their own rows. Writes happen
server-side via service-role key.

## 4. Deploy the edge functions

```bash
npx supabase functions deploy api-snaptrade-register
npx supabase functions deploy api-snaptrade-connect
npx supabase functions deploy api-snaptrade-sync
npx supabase functions deploy api-snaptrade-webhook
```

## 5. Configure the SnapTrade webhook (optional for Phase 1)

In the SnapTrade dashboard:

- **Webhook URL**: `https://<project-id>.supabase.co/functions/v1/api-snaptrade-webhook`
- Enable events: `CONNECTION_ADDED`, `ACCOUNT_HOLDINGS_UPDATED`,
  `CONNECTION_DELETED`, `CONNECTION_BROKEN`, `CONNECTION_FIXED`

Phase 1 logs events but does not auto-sync from them; users can manually
refresh from the Portfolio page.

## 6. Test the flow end-to-end

1. Sign in to the app
2. Navigate to **Portfolio**
3. Click **Connect Brokerage** — popup opens to SnapTrade portal
4. Use SnapTrade's sandbox/paper credentials (or a real brokerage on free tier)
5. Close the popup; the app calls `api-snaptrade-sync` automatically
6. Holdings appear in `snaptrade_holdings`; `Refresh` button re-syncs

## Architecture summary

```
Frontend (Portfolio.tsx)
├── SnapTradeConnectCard
│   ├── useConnectBrokerage  → register + connect + popup + sync
│   ├── useSnapTradeSync     → manual refresh
│   ├── useSnapTradeAccounts → reads snaptrade_accounts via RLS
│   └── useSnapTradeConnections

Edge functions
├── api-snaptrade-register  POST  →  /snapTrade/registerUser
├── api-snaptrade-connect   POST  →  /snapTrade/login (returns redirectURI)
├── api-snaptrade-sync      POST  →  /authorizations + /accounts + /accounts/{id}/positions
└── api-snaptrade-webhook   POST  ←  SnapTrade push notifications

Shared
└── _shared/snaptrade.ts — HMAC-SHA256 request signer, JWT decoder
```

## Free-tier caveat

The free Client ID supports up to **5 total brokerage connections across the
entire app** (not per user). Use it for development and demo only. Before
opening this to real users, upgrade to the pay-as-you-go plan ($2/connected
user/month).

## Phase 2 ideas (not in this PR)

- Verify webhook signatures (currently accepts all events)
- Auto-sync from `ACCOUNT_HOLDINGS_UPDATED` webhook events
- Normalize SnapTrade holdings into the same shape as IBKR CSV imports so
  downstream analytics work uniformly across import sources
- Add Schwab Developer API as a free fallback for the largest US broker
- Encrypt `user_secret` at rest via Supabase Vault
