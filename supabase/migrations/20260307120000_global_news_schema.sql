-- ============================================================
-- GLOBAL NEWS SCHEMA
-- Purpose:
--   1. Add country_code column to news table
--   2. Create composite index for fast country+date queries
--   3. Backfill existing articles with 'US' country code
--   4. Create news_sync_state table for tracking ingestion
--   5. Enable RLS on news_sync_state
--   6. Seed initial sync state row
-- ============================================================

-- ── 1. Add country_code column ──────────────────────────────────────────────
-- CHAR(2) ISO 3166-1 alpha-2 code (e.g. 'US', 'GB', 'JP')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE news ADD COLUMN country_code CHAR(2);
  END IF;
END
$$;

-- ── 2. Composite index for country + date queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_news_country_published
  ON news (country_code, published_at DESC);

-- ── 3. Backfill existing articles with 'US' ─────────────────────────────────
-- All existing articles came from the US-centric Finnhub API
UPDATE news
SET country_code = 'US'
WHERE country_code IS NULL;

-- ── 4. Create news_sync_state table ─────────────────────────────────────────
-- Tracks the current ingestion batch position and last sync metadata.
-- A single row (id = 'global') is used for the round-robin batch cursor.
CREATE TABLE IF NOT EXISTS news_sync_state (
  id                    TEXT          PRIMARY KEY,
  current_batch         INT           NOT NULL DEFAULT 0,
  total_batches         INT           NOT NULL DEFAULT 8,
  last_synced_at        TIMESTAMPTZ,
  countries_last_synced TEXT[]
);

-- ── 5. RLS on news_sync_state ───────────────────────────────────────────────
ALTER TABLE news_sync_state ENABLE ROW LEVEL SECURITY;

-- Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'news_sync_state'
      AND policyname = 'news_sync_state_public_read'
  ) THEN
    CREATE POLICY news_sync_state_public_read
      ON news_sync_state
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Service role write access (INSERT, UPDATE, DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'news_sync_state'
      AND policyname = 'news_sync_state_service_write'
  ) THEN
    CREATE POLICY news_sync_state_service_write
      ON news_sync_state
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ── 6. Seed initial sync state row ──────────────────────────────────────────
INSERT INTO news_sync_state (id, current_batch, total_batches)
VALUES ('global', 0, 8)
ON CONFLICT (id) DO NOTHING;
