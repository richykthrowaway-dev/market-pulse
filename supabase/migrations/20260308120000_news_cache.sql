-- Server-side news response cache
-- Stores the final merged+translated news for each country to avoid
-- redundant API calls (GNews, MarketAux, Google Translate).

CREATE TABLE IF NOT EXISTS news_cache (
  country_code TEXT PRIMARY KEY,
  response_json JSONB NOT NULL,
  source_labels TEXT[] NOT NULL DEFAULT '{}',
  article_count INTEGER NOT NULL DEFAULT 0,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for TTL-based cache expiry lookups
CREATE INDEX IF NOT EXISTS idx_news_cache_cached_at ON news_cache (cached_at);

-- Allow the edge function (service role) full access
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON news_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE news_cache IS 'Caches final translated news responses per country to minimize API calls (GNews, MarketAux, etc.)';
