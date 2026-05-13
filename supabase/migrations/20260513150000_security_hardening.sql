-- Security hardening from 2026-05-13 audit.
--
-- 1. news_cache: original RLS policy uses `auth.role() = 'service_role'`
--    which never matches because service-role requests bypass RLS
--    entirely (they never hit the policy). Net effect was no caller
--    could read or write through PostgREST, silently making the cache
--    non-functional. Replace with a correct setup:
--    - Service role still bypasses RLS (no explicit policy needed).
--    - No SELECT policy → PostgREST clients cannot read cache rows.
--    This is intentional: only the edge function (service role) reads.
--
-- 2. snaptrade_users: add self-DELETE policy so users can unlink their
--    SnapTrade account themselves (GDPR right-to-erasure compliance).
--    Account-unlinking from the dashboard becomes a future feature.

-- ── 1. Fix news_cache ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_all" ON public.news_cache;
-- No replacement policy — RLS enabled + no policies = service-role-only
-- access (which bypasses RLS). This is the correct configuration for
-- a server-side cache holding non-PII data.

COMMENT ON TABLE public.news_cache IS
  'Server-side cache for translated news responses. Access via edge functions only (service role bypasses RLS). No client-side reads.';

-- ── 2. snaptrade_users self-delete ────────────────────────────────────
DROP POLICY IF EXISTS "snaptrade_users_delete_own" ON public.snaptrade_users;
CREATE POLICY "snaptrade_users_delete_own"
  ON public.snaptrade_users FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snaptrade_connections_delete_own" ON public.snaptrade_connections;
CREATE POLICY "snaptrade_connections_delete_own"
  ON public.snaptrade_connections FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snaptrade_accounts_delete_own" ON public.snaptrade_accounts;
CREATE POLICY "snaptrade_accounts_delete_own"
  ON public.snaptrade_accounts FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snaptrade_holdings_delete_own" ON public.snaptrade_holdings;
CREATE POLICY "snaptrade_holdings_delete_own"
  ON public.snaptrade_holdings FOR DELETE
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
