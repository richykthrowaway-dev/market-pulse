-- edge_cache — generic key/value cache for slow upstream APIs.
-- Currently used by api-eonet (NASA EONET 500-2000ms cold response).
--
-- Design:
--   key         text         — composite cache key chosen by caller
--   data        jsonb        — full upstream response body
--   expires_at  timestamptz  — when the entry becomes invalid
--   updated_at  timestamptz  — for diagnostics
--
-- Indexes:
--   primary key on `key` for O(1) lookup
--   btree on `expires_at` so cleanup queries scan only stale rows

CREATE TABLE IF NOT EXISTS public.edge_cache (
  key         text         PRIMARY KEY,
  data        jsonb        NOT NULL,
  expires_at  timestamptz  NOT NULL,
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edge_cache_expires_at_idx
  ON public.edge_cache (expires_at);

-- Only the service role should touch this table; edge functions use the
-- service-role key already. Block anon/authenticated by default.
ALTER TABLE public.edge_cache ENABLE ROW LEVEL SECURITY;

-- (No public policies — service role bypasses RLS entirely.)
