# Static Bilateral Trade Dataset

This directory contains pre-computed UN Comtrade bilateral trade data, served
from Vercel's edge CDN as the **fast path** for the Trade Partners hover
breakdown in the Global view.

## Structure

```
public/bilateral/
├── manifest.json              ← top-level pointer (which reporters are available + version)
└── v2022/                     ← versioned data directory (immutable)
    ├── US.json                ← US's top partners × HS Chapter breakdown
    ├── CN.json
    ├── DE.json
    └── ... (top 50 reporters)
```

## How it's used at runtime

1. User opens the Trade Partners dialog for a country
2. Frontend hits `/bilateral/manifest.json` once per session (~5 KB)
3. If the country is in the manifest's `reporters` list, frontend fetches
   `/bilateral/v{VERSION}/{ISO2}.json` (~10–15 KB gzipped)
4. Every partner hover within that dialog is a **synchronous Map lookup** —
   no network, no waiting
5. If the country isn't in the manifest, frontend falls through to the live
   `api-wits` Comtrade proxy (slower but covers every country)

## Performance characteristics

| Action | Time |
|---|---|
| Open partner dialog (manifest cached) | ~5 ms |
| First hover for new country | ~40–80 ms (CDN fetch) |
| All subsequent hovers in same dialog | < 5 ms (in-memory) |
| Returning visitor | < 5 ms (browser HTTP cache) |

## Cache headers

`vercel.json` configures:
- `/bilateral/v{x}/*.json` → `Cache-Control: public, max-age=31536000, immutable`
- `/bilateral/manifest.json` → `Cache-Control: public, max-age=300, stale-while-revalidate=86400`

Versioned URLs are forever-immutable. A new annual dataset bumps the version
slug (`v2022` → `v2023`); old URLs still serve from cache so in-flight sessions
never break during a rollout.

## Regenerating the dataset

Run from project root:

```bash
# Full refresh (all top 50 reporters) — slow, run annually
npm run ingest:bilateral

# Just a few reporters for testing
npm run ingest:bilateral -- --reporters US,CN,DE

# Force re-fetch even if a file already exists
npm run ingest:bilateral -- --force --reporters US
```

Comtrade preview API is rate-limited to ~100 calls/hour without an
authenticated subscription key. The script delays 3 seconds between calls
to stay well under that, so a full top-50 run takes ~6–9 hours. The script
is **resumable** — already-written files are skipped unless `--force` is
passed, so a partial run that hits the rate limit can pick up where it
left off after waiting.

After a successful run:
1. Inspect a sample file to verify shape (`cat public/bilateral/v2022/US.json | jq`)
2. Commit `public/bilateral/v{VERSION}/*.json` AND `public/bilateral/manifest.json` to git
3. Push — Vercel auto-deploys

## When to refresh

Comtrade publishes year N data around mid-year N+2 (so 2024 data lands ~mid-2026).
Plan to re-run this script:
- Annually, after July, with the latest year that has good coverage
- Whenever a major economy's data is revised (rare)

To refresh to a new data year:
1. Edit `scripts/fetch-bilateral.mjs`: bump `VERSION` (e.g. `'v2023'`) and `PRIMARY_YEAR`
2. Delete `public/bilateral/v{NEW_VERSION}/` (force from-scratch)
3. Run the ingest script
4. Commit all new files

The old version directory (`v2022/`) can stay in git for a deploy cycle
or two — anyone with cached URLs will still get a valid response — then
be deleted in a future cleanup commit.
