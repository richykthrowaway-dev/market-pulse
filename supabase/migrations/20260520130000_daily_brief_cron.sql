-- Schedule the daily market brief generation via pg_cron.
--
-- This migration is committed to git and replays cleanly in ANY environment,
-- because it contains NO secrets. The project URL and service-role key are read
-- at run time from Supabase Vault (vault.decrypted_secrets), not hardcoded here.
--
-- ── One-time per-environment setup (see docs/DEPLOYMENT.md) ──────────────────
-- Before this cron job can fire, create the two Vault secrets ONCE in the
-- target project's SQL editor (values never enter git):
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co', 'project_url',
--     'Base URL for edge-function calls from pg_cron');
--
--   select vault.create_secret(
--     '<service-role-key>', 'service_role_key',
--     'Service role key for authenticating pg_cron → edge function calls');
--
-- If the secrets are absent the cron command no-ops gracefully (it logs and
-- skips), so applying this migration never breaks a fresh environment.

-- Required extensions (idempotent — Supabase ships both)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: trigger the generate-daily-brief edge function.
-- Reads URL + key from Vault at call time; no secrets stored in this function body.
CREATE OR REPLACE FUNCTION public.trigger_daily_brief()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text;
  v_key   text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Gracefully skip if Vault secrets aren't configured yet (fresh environment)
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'trigger_daily_brief: Vault secrets project_url/service_role_key not set — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Unschedule prior versions if they exist (makes this migration re-runnable)
DO $$
BEGIN
  PERFORM cron.unschedule('generate-daily-brief')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-brief');
  PERFORM cron.unschedule('generate-daily-brief-retry')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-brief-retry');
END $$;

-- Primary run: 6:00 AM ET (10:00 UTC) on weekdays
SELECT cron.schedule(
  'generate-daily-brief',
  '0 10 * * 1-5',
  $$SELECT public.trigger_daily_brief();$$
);

-- Retry run: 6:15 AM ET (10:15 UTC) on weekdays — catches EODHD data lag.
-- The edge function's idempotency check makes this a no-op if 6:00 succeeded.
SELECT cron.schedule(
  'generate-daily-brief-retry',
  '15 10 * * 1-5',
  $$SELECT public.trigger_daily_brief();$$
);

COMMENT ON FUNCTION public.trigger_daily_brief() IS
  'Triggers the generate-daily-brief edge function. Reads project_url + service_role_key from Supabase Vault. Scheduled by pg_cron weekdays at 6:00 and 6:15 AM ET.';
