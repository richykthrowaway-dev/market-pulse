import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL = `
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
  SELECT id INTO tf_id FROM timeframes WHERE code = '1D' LIMIT 1;
  IF tf_id IS NULL THEN
    RETURN jsonb_build_object('error', '1D timeframe not found');
  END IF;

  SELECT ts INTO today_ts
  FROM ohlcv_bars WHERE timeframe_id = tf_id ORDER BY ts DESC LIMIT 1;

  IF today_ts IS NULL THEN
    RETURN jsonb_build_object('error', 'No ohlcv_bars data');
  END IF;

  SELECT ts INTO prev_ts
  FROM ohlcv_bars WHERE timeframe_id = tf_id AND ts < today_ts ORDER BY ts DESC LIMIT 1;

  IF prev_ts IS NULL THEN
    RETURN jsonb_build_object('message', 'Only one day of data — skipped', 'today', today_ts::date);
  END IF;

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
  RETURN jsonb_build_object('updated', updated, 'today_date', today_ts::date, 'prev_date', prev_ts::date);
END;
$$;
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Accept custom SQL from request body, or fall back to the hardcoded SQL
  let sqlToRun = SQL;
  let label = "compute_daily_changes() function created";
  try {
    const body = await req.json();
    if (body?.sql && typeof body.sql === "string") {
      sqlToRun = body.sql;
      label = "custom SQL executed";
    }
  } catch {
    // No body or invalid JSON — use default SQL
  }

  const pool = new Pool(dbUrl, 1, true);
  const client = await pool.connect();
  try {
    await client.queryObject(sqlToRun);
    return new Response(
      JSON.stringify({ ok: true, message: label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    client.release();
    await pool.end();
  }
});
