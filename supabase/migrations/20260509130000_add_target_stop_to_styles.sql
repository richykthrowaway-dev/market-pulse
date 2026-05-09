-- Add price target + stop loss to user_ticker_styles
--
-- Stored as NUMERIC(20,4) — same precision as the rest of the price columns
-- across this codebase (e.g. ohlcv_bars). Both fields are NULL-able because
-- a user might set only one, or neither.
--
-- No CHECK constraint enforcing target > stop or target > 0 because:
--   • Short positions invert the "target above / stop below" expectation
--   • Users may want to set one threshold and add the other later
--   • Validation is a UI concern, not a data-integrity concern

ALTER TABLE public.user_ticker_styles
  ADD COLUMN IF NOT EXISTS price_target NUMERIC(20, 4),
  ADD COLUMN IF NOT EXISTS stop_loss    NUMERIC(20, 4);

COMMENT ON COLUMN public.user_ticker_styles.price_target IS
  'User-defined take-profit price target. Currency matches the holding.';
COMMENT ON COLUMN public.user_ticker_styles.stop_loss    IS
  'User-defined stop-loss price. Currency matches the holding.';
