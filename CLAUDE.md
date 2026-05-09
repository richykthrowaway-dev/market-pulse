# Project: Market Pulse

A React + Vite + TypeScript portfolio analytics app backed by Supabase + EODHD market data.

## Skills available in this project

This project ships with the **eodhd-api skill** at `.claude/skills/eodhd-api/`.
Whenever a task involves the EODHD API — fetching prices, fundamentals, news,
options, technicals, screener data, macro indicators, ESG, or anything else
on EODHD's 70+ endpoint surface — **use the eodhd-api skill**.

The skill bundles:
- 72 endpoint reference docs at `.claude/skills/eodhd-api/references/endpoints/`
- 7 plan-tier subscription docs at `.claude/skills/eodhd-api/references/subscriptions/`
- A zero-dependency Python client at `.claude/skills/eodhd-api/scripts/eodhd_client.py`
- Workflow templates at `.claude/skills/eodhd-api/templates/`

When proxying EODHD calls from Supabase edge functions, mirror the exact
parameter names and response shapes documented in the skill — don't invent
field names. If a parameter is plan-gated (e.g. `bulk-fundamentals` requires
Extended Fundamentals), surface the 403 cleanly to the caller.

## Project conventions (recap from MEMORY.md)

- 4-layer symbol lookup: static map (sectorMap.ts) → static sub-industry map
  → Supabase DB → EODHD `/fundamentals` → Finnhub
- Dark mode: use `resolvedTheme` + `mounted` guard
- Logo.dev: exchange-qualified tickers (`SCD.V`, `RY.TO`, `AAPL`)
- IBKR CSV parser: `cols[8]` = Listing Exch, `cols[5]` = Conid (numeric)
- PostgREST hard caps at 1000 rows — paginate large queries in edge functions
- Edge function wall-time: 25s — push heavy compute to PostgreSQL via RPC

## Supabase project

- Project ref: `fzokumkbgvwsyftwwprx`
- URL: `https://fzokumkbgvwsyftwwprx.supabase.co`
- Anon key + URL live in `.env` (committed for dev convenience)
- Service-role key lives in Supabase secrets (never client-side)

## EODHD plan + endpoint quick-reference

Confirmed from skill docs at `.claude/skills/eodhd-api/references/subscriptions/`:

| Plan | Price/mo | `/fundamentals` | `/bulk-fundamentals` | Notes |
|---|---|---|---|---|
| Free | 0 | yes (20 calls/day) | no | testing only |
| EOD All-World | 19.99 | no | no | prices only |
| Calendar Feed | 19.99 | no | no | calendars only |
| EOD+Intraday Extended | 29.99 | no | no | prices + technicals |
| Fundamentals Data Feed | 59.99 | yes (100K/day) | no | fundamentals + macro |
| All-In-One | 99.99 | yes (100K/day) | no | everything except bulk-fundamentals |
| **All-In-One Extended Fundamentals** | **119.99** | **yes (100K/day)** | **yes** | the only plan that unlocks bulk |

Endpoint cost reference (per request):
- `/fundamentals/{TICKER}` = **10 credits**
- `/bulk-fundamentals/{EXCHANGE}` = **100 credits flat** (up to 500 tickers)
- `/bulk-fundamentals/{EXCHANGE}?symbols=A,B,C` = **100 + N credits**
- `/exchange-symbol-list/{CODE}` = 1 credit
- `/eod-bulk-last-day/{EXCHANGE}` = 100 credits
- `/user` = 0 credits (always callable, even at quota = 0)

## Edge functions

- `api-eodhd` — proxy for all EODHD endpoints; supports `?endpoint=user` for plan check
- `ingest-fundamentals-bulk` — per-ticker /fundamentals loop, 50 tickers/invocation
- `ingest-bulk-fundamentals` — uses /bulk-fundamentals (plan-gated)
- `api-finnhub` — backup sector/industry source
- `ingest-eod-bulk` — nightly EOD prices, 47K stocks via `compute_daily_changes()` RPC

## Bulk ingest scripts

- `scripts/bulk-ingest-subindustries.mjs` — drives ingest-fundamentals-bulk;
  use when the user is on a plan WITHOUT bulk-fundamentals
- `scripts/bulk-ingest-via-bulk-endpoint.mjs` — drives ingest-bulk-fundamentals;
  use when the user upgrades to All-In-One Extended Fundamentals
