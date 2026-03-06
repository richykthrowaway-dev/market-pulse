-- ============================================================
-- MARKET PIPELINE OPTIMIZATION
-- Purpose:
--   1. Add unique constraints needed for safe bulk upserts
--   2. Add composite indexes for fast ohlcv_bars queries
--   3. Create market_returns_cache table (pre-computed per timeframe)
--   4. Create get_period_returns() — single-scan window function
--   5. Create refresh_market_returns_cache() — called by ingest
-- ============================================================

-- ── 1. Unique constraints ─────────────────────────────────────────────────────

-- symbols: canonical_ticker must be unique for upsert on conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_canonical_ticker_unique
  ON symbols (canonical_ticker);

-- listings: each symbol should appear at most once per exchange
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_symbol_exchange_unique
  ON listings (symbol_id, exchange_id);

-- ohlcv_bars: one bar per listing per timeframe per timestamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_ohlcv_bars_unique
  ON ohlcv_bars (listing_id, timeframe_id, ts);

-- ── 2. Performance indexes ────────────────────────────────────────────────────

-- Primary index for get_period_returns() window scan
-- Covers the WHERE clause and the ORDER BY inside the window
CREATE INDEX IF NOT EXISTS idx_ohlcv_listing_tf_ts
  ON ohlcv_bars (listing_id, timeframe_id, ts ASC);

-- Fast listing resolution by ticker (used in ingest + mapping cache)
CREATE INDEX IF NOT EXISTS idx_listings_local_ticker
  ON listings (local_ticker);

-- Partial index: only active listings (used in most queries)
CREATE INDEX IF NOT EXISTS idx_listings_active
  ON listings (local_ticker, symbol_id)
  WHERE is_active = true;

-- ── 3. market_returns_cache table ────────────────────────────────────────────
-- Stores pre-computed return distributions per timeframe.
-- Updated by refresh_market_returns_cache() at the end of each nightly ingest.
-- The api-market-returns edge function reads from here for non-1D timeframes,
-- falling back to live RPC computation only on cache miss (>15 min stale).

CREATE TABLE IF NOT EXISTS market_returns_cache (
  timeframe_code  TEXT        PRIMARY KEY,
  returns         JSONB       NOT NULL DEFAULT '[]',
  stats           JSONB       NOT NULL DEFAULT '{"median":0,"mean":0,"up":0,"down":0}',
  stock_count     INTEGER     NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE market_returns_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market returns cache is publicly readable"
  ON market_returns_cache FOR SELECT USING (true);

-- ── 4. get_period_returns() ───────────────────────────────────────────────────
-- Single-scan window function: ONE pass over ohlcv_bars for a date range.
-- Returns NUMERIC[] of % returns (last_close - first_close) / first_close * 100
-- for every listing that has bars in the given range.
--
-- Performance: O(N) where N = rows in range. No subqueries, no per-listing loops.
-- Compare to old approach: 2 queries × N listings = O(N²) round trips.

CREATE OR REPLACE FUNCTION get_period_returns(
  p_start_date  TIMESTAMPTZ,
  p_tf_id       UUID
)
RETURNS NUMERIC[] AS $$
  WITH scanned AS (
    SELECT
      listing_id,
      -- Window functions compute first & last close in a single pass
      FIRST_VALUE(close) OVER w AS first_close,
      LAST_VALUE(close)  OVER w AS last_close,
      -- rn=1 marks the last row (most recent), used to deduplicate
      ROW_NUMBER() OVER (PARTITION BY listing_id ORDER BY ts DESC) AS rn
    FROM ohlcv_bars
    WHERE timeframe_id = p_tf_id
      AND ts >= p_start_date
    WINDOW w AS (
      PARTITION BY listing_id
      ORDER BY ts ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  )
  SELECT COALESCE(
    ARRAY_AGG(
      ROUND(
        ((last_close - first_close) / NULLIF(first_close, 0) * 100)::NUMERIC,
        4
      )
    ),
    ARRAY[]::NUMERIC[]
  )
  FROM scanned
  WHERE rn = 1
    AND first_close > 0;
$$ LANGUAGE SQL STABLE PARALLEL SAFE;

-- ── 5. refresh_market_returns_cache() ────────────────────────────────────────
-- Computes and stores return distributions for all non-1D timeframes.
-- Called as the final step of the nightly ingest-eod-bulk function.
-- Returns JSONB summary: { "1W": { "count": 5000 }, "1M": { "count": 4987 }, ... }

CREATE OR REPLACE FUNCTION refresh_market_returns_cache()
RETURNS JSONB AS $$
DECLARE
  r          RECORD;
  v_tf_id    UUID;
  v_start    TIMESTAMPTZ;
  v_now      TIMESTAMPTZ := NOW();
  v_returns  NUMERIC[];
  v_sorted   NUMERIC[];
  v_n        INTEGER;
  v_mean     NUMERIC;
  v_median   NUMERIC;
  v_up       BIGINT;
  v_down     BIGINT;
  v_summary  JSONB := '{}';
BEGIN
  FOR r IN
    SELECT code, id
    FROM timeframes
    WHERE code IN ('1W','1M','3M','6M','YTD','1Y','3Y','5Y','10Y')
  LOOP
    v_tf_id := r.id;

    -- Compute window start date for this timeframe
    CASE r.code
      WHEN '1W'  THEN v_start := v_now - INTERVAL '7 days';
      WHEN '1M'  THEN v_start := v_now - INTERVAL '1 month';
      WHEN '3M'  THEN v_start := v_now - INTERVAL '3 months';
      WHEN '6M'  THEN v_start := v_now - INTERVAL '6 months';
      WHEN 'YTD' THEN v_start := DATE_TRUNC('year', v_now);
      WHEN '1Y'  THEN v_start := v_now - INTERVAL '1 year';
      WHEN '3Y'  THEN v_start := v_now - INTERVAL '3 years';
      WHEN '5Y'  THEN v_start := v_now - INTERVAL '5 years';
      WHEN '10Y' THEN v_start := v_now - INTERVAL '10 years';
      ELSE v_start := v_now - INTERVAL '7 days';
    END CASE;

    -- Single RPC call — uses window function, one scan
    SELECT get_period_returns(v_start, v_tf_id) INTO v_returns;
    v_returns := COALESCE(v_returns, ARRAY[]::NUMERIC[]);
    v_n := COALESCE(array_length(v_returns, 1), 0);

    IF v_n = 0 THEN
      INSERT INTO market_returns_cache
        VALUES (r.code, '[]', '{"median":0,"mean":0,"up":0,"down":0}', 0, v_now)
      ON CONFLICT (timeframe_code) DO UPDATE
        SET returns     = EXCLUDED.returns,
            stats       = EXCLUDED.stats,
            stock_count = EXCLUDED.stock_count,
            computed_at = EXCLUDED.computed_at;
      CONTINUE;
    END IF;

    -- Sort for median calculation
    SELECT ARRAY_AGG(x ORDER BY x) INTO v_sorted FROM UNNEST(v_returns) AS x;

    -- Mean
    SELECT ROUND(AVG(x)::NUMERIC, 2) INTO v_mean FROM UNNEST(v_returns) AS x;

    -- Median (handle even/odd array lengths)
    IF v_n % 2 = 0 THEN
      v_median := ROUND(((v_sorted[v_n / 2] + v_sorted[v_n / 2 + 1]) / 2.0)::NUMERIC, 2);
    ELSE
      v_median := ROUND(v_sorted[(v_n + 1) / 2]::NUMERIC, 2);
    END IF;

    -- Up / down counts
    SELECT COUNT(*) INTO v_up   FROM UNNEST(v_returns) AS x WHERE x > 0;
    SELECT COUNT(*) INTO v_down FROM UNNEST(v_returns) AS x WHERE x < 0;

    INSERT INTO market_returns_cache VALUES (
      r.code,
      TO_JSONB(v_returns),
      JSONB_BUILD_OBJECT('median', v_median, 'mean', v_mean, 'up', v_up, 'down', v_down),
      v_n,
      v_now
    )
    ON CONFLICT (timeframe_code) DO UPDATE
      SET returns     = EXCLUDED.returns,
          stats       = EXCLUDED.stats,
          stock_count = EXCLUDED.stock_count,
          computed_at = EXCLUDED.computed_at;

    v_summary := v_summary || JSONB_BUILD_OBJECT(
      r.code,
      JSONB_BUILD_OBJECT('count', v_n, 'mean', v_mean, 'median', v_median)
    );
  END LOOP;

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;
