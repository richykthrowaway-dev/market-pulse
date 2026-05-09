-- Server-side cache for EODHD fundamentals payloads.
--
-- Each row stores the full /api/fundamentals/{ticker} response keyed by
-- the EODHD-format ticker (e.g. "AAPL.US", "BMW.XETRA"). The api-eodhd
-- edge function reads from this table BEFORE checking EODHD's daily
-- quota — if a fresh row exists, it returns the cached payload and
-- never calls EODHD, costing 0 credits.
--
-- Why server-side instead of just per-browser localStorage:
--   - Browser caches don't share between users. Two users searching
--     AAPL in the same 12h window cost 20 EODHD credits (10 each)
--     even though the data is identical.
--   - This table makes the FIRST user pay 10 credits; everyone else
--     within the TTL window gets free reads.
--   - Even single-user benefits: incognito sessions, multiple devices,
--     and post-cache-clear sessions all share this cache.
--
-- TTL is enforced READ-SIDE in the edge function based on `cached_at`
-- so stale rows simply get overwritten on next miss. No Postgres
-- timer / cron job needed.
create table if not exists public.fundamentals_cache (
  ticker      text         primary key,
  payload     jsonb        not null,
  cached_at   timestamptz  not null default now()
);

-- Speeds up the eventual cleanup query if we ever add a vacuum task
create index if not exists fundamentals_cache_cached_at_idx
  on public.fundamentals_cache (cached_at);

-- RLS: edge function uses the service role key which bypasses RLS, so
-- enabling RLS without policies means ONLY the edge function can read
-- or write this table. The client cannot bypass and read directly via
-- the anon key — defence-in-depth in case the table grows sensitive.
alter table public.fundamentals_cache enable row level security;
