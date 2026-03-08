-- compute_daily_changes()
-- Computes stocks.change and stocks.change_percent from the two most recent
-- distinct dates in ohlcv_bars. Called from ingest-eod-bulk after inserting
-- today's bars, replacing the Deno-side computation that hit memory limits.
CREATE OR REPLACE FUNCTION compute_daily_changes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_ts  timestamptz;
  prev_ts   timestamptz;
  tf_id     uuid;
  updated   integer;
BEGIN
  -- 1D timeframe ID
  SELECT id INTO tf_id FROM timeframes WHERE code = '1D' LIMIT 1;
  IF tf_id IS NULL THEN
    RETURN jsonb_build_object('error', '1D timeframe not found');
  END IF;

  -- Most recent date
  SELECT ts INTO today_ts
  FROM ohlcv_bars WHERE timeframe_id = tf_id ORDER BY ts DESC LIMIT 1;

  IF today_ts IS NULL THEN
    RETURN jsonb_build_object('error', 'No ohlcv_bars data');
  END IF;

  -- Previous date
  SELECT ts INTO prev_ts
  FROM ohlcv_bars WHERE timeframe_id = tf_id AND ts < today_ts ORDER BY ts DESC LIMIT 1;

  IF prev_ts IS NULL THEN
    RETURN jsonb_build_object('message', 'Only one day of data — skipped', 'today', today_ts::date);
  END IF;

  -- UPDATE stocks using a JOIN between today's and yesterday's closes
  UPDATE stocks s
  SET
    change         = ROUND(CAST(t.close - p.close AS numeric), 2),
    change_percent = ROUND(CAST((t.close - p.close) / NULLIF(p.close, 0) * 100 AS numeric), 2)
  FROM (
    SELECT l.local_ticker AS sym, ob.close
    FROM ohlcv_bars ob
    JOIN listings l ON l.id = ob.listing_id
    WHERE ob.timeframe_id = tf_id AND ob.ts = today_ts
  ) t
  JOIN (
    SELECT l.local_ticker AS sym, ob.close
    FROM ohlcv_bars ob
    JOIN listings l ON l.id = ob.listing_id
    WHERE ob.timeframe_id = tf_id AND ob.ts = prev_ts AND ob.close > 0
  ) p ON t.sym = p.sym
  WHERE s.symbol = t.sym;

  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated',    updated,
    'today_date', today_ts::date,
    'prev_date',  prev_ts::date
  );
END;
$$;
