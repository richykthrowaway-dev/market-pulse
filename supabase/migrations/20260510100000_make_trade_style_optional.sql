-- Make trade_style nullable
--
-- Originally required, but users should be able to save a price target or
-- reasoning note without choosing a trade style. NULL means "unclassified" —
-- the existing CHECK constraint already handles valid non-null values, and
-- PostgreSQL allows NULL to pass CHECK constraints automatically.

ALTER TABLE public.user_ticker_styles
  ALTER COLUMN trade_style DROP NOT NULL;
