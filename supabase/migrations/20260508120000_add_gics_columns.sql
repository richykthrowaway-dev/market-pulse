-- Add GICS sector/industry columns to symbols table
-- These are populated by the ingest-fundamentals-bulk edge function via EODHD

ALTER TABLE symbols
  ADD COLUMN IF NOT EXISTS gics_sector          TEXT,
  ADD COLUMN IF NOT EXISTS gics_industry_group  TEXT,
  ADD COLUMN IF NOT EXISTS gics_industry        TEXT,
  ADD COLUMN IF NOT EXISTS gics_sub_industry    TEXT;

-- Index for fast sector-based filtering
CREATE INDEX IF NOT EXISTS idx_symbols_gics_sector
  ON symbols (gics_sector)
  WHERE gics_sector IS NOT NULL;

-- Comment
COMMENT ON COLUMN symbols.gics_sector         IS 'GICS Level 1 sector (e.g. Information Technology)';
COMMENT ON COLUMN symbols.gics_industry_group IS 'GICS Level 2 industry group';
COMMENT ON COLUMN symbols.gics_industry       IS 'GICS Level 3 industry';
COMMENT ON COLUMN symbols.gics_sub_industry   IS 'GICS Level 4 sub-industry';
