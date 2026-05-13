-- SnapTrade Integration
--
-- Stores per-user SnapTrade credentials and connected brokerage account
-- metadata. The `user_secret` is a long-lived token returned by SnapTrade
-- at registration time. We keep raw holdings in `snaptrade_holdings` so the
-- portfolio UI can render without hitting SnapTrade on every page load —
-- nightly cron (or on-demand sync) refreshes the cache.

-- ── 1. snaptrade_users ────────────────────────────────────────────────
-- One row per Supabase user that has registered with SnapTrade.
-- The `user_secret` MUST be treated as sensitive — it's effectively a
-- bearer token for that user's brokerage data.

CREATE TABLE IF NOT EXISTS public.snaptrade_users (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_secret  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. snaptrade_connections ──────────────────────────────────────────
-- One row per connected brokerage authorization. A user may have multiple
-- connections (e.g. one for IBKR, one for Schwab). SnapTrade calls these
-- "brokerage authorizations". A single connection can expose multiple
-- accounts (e.g. taxable + IRA at the same broker).

CREATE TABLE IF NOT EXISTS public.snaptrade_connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  authorization_id         TEXT NOT NULL,
  brokerage_name           TEXT,
  brokerage_slug           TEXT,
  disabled                 BOOLEAN NOT NULL DEFAULT false,
  last_synced_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT snaptrade_connections_unique UNIQUE (user_id, authorization_id)
);

CREATE INDEX IF NOT EXISTS idx_snaptrade_connections_user_id
  ON public.snaptrade_connections (user_id);

-- ── 3. snaptrade_accounts ─────────────────────────────────────────────
-- One row per account (cash, taxable, IRA, etc.) exposed by a connection.

CREATE TABLE IF NOT EXISTS public.snaptrade_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id            UUID REFERENCES public.snaptrade_connections(id) ON DELETE CASCADE,
  account_id               TEXT NOT NULL,
  account_number_masked    TEXT,
  account_name             TEXT,
  account_type             TEXT,
  institution_name         TEXT,
  currency                 TEXT,
  total_value              NUMERIC,
  cash_balance             NUMERIC,
  last_synced_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT snaptrade_accounts_unique UNIQUE (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_snaptrade_accounts_user_id
  ON public.snaptrade_accounts (user_id);

-- ── 4. snaptrade_holdings ─────────────────────────────────────────────
-- Position snapshots — replaced on every sync (delete + insert per account).
-- We do NOT keep history here; that lives in portfolio_holdings/journal.

CREATE TABLE IF NOT EXISTS public.snaptrade_holdings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id          TEXT NOT NULL,
  symbol              TEXT NOT NULL,
  description         TEXT,
  quantity            NUMERIC NOT NULL,
  avg_purchase_price  NUMERIC,
  current_price       NUMERIC,
  market_value        NUMERIC,
  open_pnl            NUMERIC,
  currency            TEXT,
  asset_type          TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snaptrade_holdings_user_id
  ON public.snaptrade_holdings (user_id);
CREATE INDEX IF NOT EXISTS idx_snaptrade_holdings_account_id
  ON public.snaptrade_holdings (account_id);

-- ── Auto-updated timestamp on snaptrade_users ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_snaptrade_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snaptrade_users_updated_at ON public.snaptrade_users;
CREATE TRIGGER trg_snaptrade_users_updated_at
  BEFORE UPDATE ON public.snaptrade_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_snaptrade_users();

-- ── Row-Level Security ────────────────────────────────────────────────
-- Each user can only see their own SnapTrade data. The edge functions
-- use the service-role key to bypass RLS for cross-user maintenance
-- (e.g. nightly sync, webhook handling).

ALTER TABLE public.snaptrade_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snaptrade_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snaptrade_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snaptrade_holdings    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snaptrade_users_select_own"       ON public.snaptrade_users;
DROP POLICY IF EXISTS "snaptrade_connections_select_own" ON public.snaptrade_connections;
DROP POLICY IF EXISTS "snaptrade_accounts_select_own"    ON public.snaptrade_accounts;
DROP POLICY IF EXISTS "snaptrade_holdings_select_own"    ON public.snaptrade_holdings;

CREATE POLICY "snaptrade_users_select_own"
  ON public.snaptrade_users FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "snaptrade_connections_select_own"
  ON public.snaptrade_connections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "snaptrade_accounts_select_own"
  ON public.snaptrade_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "snaptrade_holdings_select_own"
  ON public.snaptrade_holdings FOR SELECT USING (auth.uid() = user_id);

-- Writes are performed by edge functions using the service-role key,
-- which bypasses RLS. We intentionally do not grant INSERT/UPDATE/DELETE
-- to authenticated users — the data is always written server-side.

COMMENT ON TABLE public.snaptrade_users IS
  'Per-Supabase-user SnapTrade registration. user_secret is sensitive — treat as a long-lived API token.';
COMMENT ON TABLE public.snaptrade_connections IS
  'Brokerage authorizations (one per connected institution).';
COMMENT ON TABLE public.snaptrade_accounts IS
  'Individual accounts (taxable, IRA, etc.) exposed by a connection.';
COMMENT ON TABLE public.snaptrade_holdings IS
  'Position snapshot — replaced on every sync. Not history.';
