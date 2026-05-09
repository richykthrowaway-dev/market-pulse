-- User Ticker Styles
--
-- Per-user, per-ticker annotations: trade style + freeform note.
-- Lives in its own table (NOT in `holdings`) so the data survives every
-- portfolio re-import — when a user uploads a new IBKR statement, holdings
-- get nuked and replaced, but the styles/notes attached to each ticker
-- persist until the user explicitly deletes them.
--
-- Identity: keyed by (user_id, ticker). Tickers are stored bare-uppercase
-- (no exchange suffix) so styles transfer when a user moves a position
-- between brokers/exchanges (e.g. RY held on TSX on day 1 and on NYSE on day 2
-- still gets the same note).

CREATE TABLE IF NOT EXISTS public.user_ticker_styles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker      TEXT NOT NULL CHECK (ticker = upper(ticker) AND length(ticker) BETWEEN 1 AND 16),
  trade_style TEXT NOT NULL CHECK (trade_style IN ('Swing', 'Day Trade', 'Long Term Hold')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One style per (user, ticker) — upsert-friendly
  CONSTRAINT user_ticker_styles_unique UNIQUE (user_id, ticker)
);

-- Index for fast per-user batch lookups (used on every portfolio render)
CREATE INDEX IF NOT EXISTS idx_user_ticker_styles_user_id
  ON public.user_ticker_styles (user_id);

-- Auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at_user_ticker_styles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_ticker_styles_updated_at ON public.user_ticker_styles;
CREATE TRIGGER trg_user_ticker_styles_updated_at
  BEFORE UPDATE ON public.user_ticker_styles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_user_ticker_styles();

-- ── Row-Level Security ────────────────────────────────────────────────
-- Each user can only read / insert / update / delete their own rows.

ALTER TABLE public.user_ticker_styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_ticker_styles_select_own" ON public.user_ticker_styles;
CREATE POLICY "user_ticker_styles_select_own"
  ON public.user_ticker_styles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_ticker_styles_insert_own" ON public.user_ticker_styles;
CREATE POLICY "user_ticker_styles_insert_own"
  ON public.user_ticker_styles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_ticker_styles_update_own" ON public.user_ticker_styles;
CREATE POLICY "user_ticker_styles_update_own"
  ON public.user_ticker_styles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_ticker_styles_delete_own" ON public.user_ticker_styles;
CREATE POLICY "user_ticker_styles_delete_own"
  ON public.user_ticker_styles FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_ticker_styles IS
  'Per-user trade style + note annotations attached to a ticker symbol. Persists across portfolio re-imports.';
COMMENT ON COLUMN public.user_ticker_styles.trade_style IS
  'One of: Swing | Day Trade | Long Term Hold';
COMMENT ON COLUMN public.user_ticker_styles.ticker IS
  'Bare uppercase ticker (e.g. AAPL, TUNG) — no exchange suffix.';
