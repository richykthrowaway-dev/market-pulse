-- Corrective migration after 2026-05-13 data audit found:
--
--   1. `news.country_code` column missing despite migration 20260307120000
--      claiming to add it. The DO $$ guarded ALTER TABLE silently failed.
--   2. `news_sync_state` table missing despite same migration claiming to
--      create it. Same silent-failure mode.
--   3. `ohlcv_bars(ts DESC)` not indexed — "latest row" queries time out
--      against the 994k-row table.
--
-- Plain idempotent statements (no DO $$) so failures surface loudly.

-- ── 1. news.country_code ──────────────────────────────────────────────
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);

CREATE INDEX IF NOT EXISTS idx_news_country_published
  ON public.news (country_code, published_at DESC);

UPDATE public.news SET country_code = 'US' WHERE country_code IS NULL;

-- ── 2. news_sync_state ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_sync_state (
  id                    TEXT          PRIMARY KEY,
  current_batch         INT           NOT NULL DEFAULT 0,
  total_batches         INT           NOT NULL DEFAULT 8,
  last_synced_at        TIMESTAMPTZ,
  countries_last_synced TEXT[]
);

ALTER TABLE public.news_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS news_sync_state_public_read ON public.news_sync_state;
CREATE POLICY news_sync_state_public_read
  ON public.news_sync_state FOR SELECT USING (true);

DROP POLICY IF EXISTS news_sync_state_service_write ON public.news_sync_state;
CREATE POLICY news_sync_state_service_write
  ON public.news_sync_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.news_sync_state (id, current_batch, total_batches)
VALUES ('global', 0, 8)
ON CONFLICT (id) DO NOTHING;

-- ── 3. ohlcv_bars(ts DESC) index ──────────────────────────────────────
-- Powers "latest row per listing" queries; without this the audit's
-- `order=ts.desc&limit=1` probe hit a statement timeout.
CREATE INDEX IF NOT EXISTS idx_ohlcv_bars_ts_desc
  ON public.ohlcv_bars (ts DESC);

-- ── 4. Refresh PostgREST schema cache so REST clients see new columns/tables
NOTIFY pgrst, 'reload schema';
