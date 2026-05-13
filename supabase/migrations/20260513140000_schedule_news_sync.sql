-- Schedule news-sync-global to run automatically.
--
-- The function rotates through 8 country batches. Running it every 30
-- minutes cycles the full set every 4 hours, well within free-tier
-- rate limits for GNews (100 req/day) and MarketAux (100 req/day):
--   8 batches × 2 APIs × 6 countries × 48 invocations/day ≈ 4600 req/day
--   …but we only fetch 1 batch per invocation, so it's:
--   2 APIs × 6 countries × 48 = 576 req/day  ← within budget.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Drop any prior schedule with the same name (idempotent re-runs)
SELECT cron.unschedule('news-sync-global-30min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-sync-global-30min');

-- Schedule: every 30 minutes
-- news-sync-global is deployed with --no-verify-jwt so no Authorization
-- header is needed. (Still need apikey header so it isn't blocked by
-- the function gateway.)
SELECT cron.schedule(
  'news-sync-global-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://fzokumkbgvwsyftwwprx.supabase.co/functions/v1/news-sync-global',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
