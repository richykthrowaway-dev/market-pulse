-- RPC: get_new_highs_lows()
-- Computes how many stocks hit a new 52-week high or low on the latest trading day.
-- Compares each stock's latest-day high/low against max(high)/min(low) over
-- available ohlcv_bars history (up to 252 trading days).
-- Requires at least 2 bars per stock to avoid inflated counts on sparse data.

CREATE OR REPLACE FUNCTION get_new_highs_lows()
RETURNS json
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result json;
  v_tf_id int;
  v_latest_ts timestamptz;
BEGIN
  -- Get 1D timeframe ID
  SELECT id INTO v_tf_id FROM timeframes WHERE code = '1D';
  IF v_tf_id IS NULL THEN
    RETURN json_build_object('new_high', 0, 'new_low', 0);
  END IF;

  -- Get latest available date in ohlcv_bars
  SELECT MAX(ts) INTO v_latest_ts FROM ohlcv_bars WHERE timeframe_id = v_tf_id;
  IF v_latest_ts IS NULL THEN
    RETURN json_build_object('new_high', 0, 'new_low', 0);
  END IF;

  -- Single scan: for each listing with data on the latest date,
  -- compare today's high/low against the historical max/min.
  -- bar_count > 1 filter prevents marking every stock as new high/low
  -- when we only have 1 bar of history.
  SELECT json_build_object(
    'new_high', COALESCE(COUNT(*) FILTER (WHERE today_high >= hist_max_high AND bar_count > 1), 0),
    'new_low',  COALESCE(COUNT(*) FILTER (WHERE today_low  <= hist_min_low  AND bar_count > 1), 0)
  ) INTO result
  FROM (
    SELECT
      listing_id,
      MAX(CASE WHEN ts = v_latest_ts THEN high END) AS today_high,
      MAX(CASE WHEN ts = v_latest_ts THEN low  END) AS today_low,
      MAX(high) AS hist_max_high,
      MIN(low)  AS hist_min_low,
      COUNT(*)  AS bar_count
    FROM ohlcv_bars
    WHERE timeframe_id = v_tf_id
      AND ts >= v_latest_ts - INTERVAL '252 days'
    GROUP BY listing_id
    HAVING MAX(CASE WHEN ts = v_latest_ts THEN 1 END) = 1
  ) sub;

  RETURN COALESCE(result, json_build_object('new_high', 0, 'new_low', 0));
END;
$$;
