/**
 * EODHD API client utility
 *
 * Calls the `api-eodhd` Edge Function (never EODHD directly).
 * Wrapped with L2 (localStorage) cache via fetchCached.
 *
 * Key rotation: update the EODHD_API_KEY secret in Lovable Cloud.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchCached } from "@/lib/apiCache";

export interface EodBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

/**
 * Fetch daily OHLCV bars from EODHD via the edge function proxy.
 * @param symbol e.g. "AAPL.US"
 * @param from   ISO date string e.g. "2020-01-01"
 * @param to     ISO date string e.g. "2025-01-01"
 */
export async function fetchEodHistorical(
  symbol: string,
  from?: string,
  to?: string,
): Promise<EodBar[]> {
  return fetchCached(
    `eodhd:historical:${symbol}:${from ?? ''}:${to ?? ''}`,
    async () => {
      const params: Record<string, string> = { endpoint: "eod", symbol };
      if (from) params.from = from;
      if (to) params.to = to;
      const qs = new URLSearchParams(params).toString();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-eodhd?${qs}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        },
      );
      if (!res.ok) throw new Error(`EODHD fetch failed (${res.status}): ${await res.text()}`);
      return res.json();
    },
    // 1h TTL — historical bars only update once per day
    { ttlMs: 60 * 60_000 },
  );
}

/**
 * Fetch fundamentals JSON from EODHD via the edge function proxy.
 * @param symbol e.g. "AAPL.US"
 */
export async function fetchEodFundamentals(
  symbol: string,
): Promise<Record<string, unknown>> {
  return fetchCached(
    `eodhd:fundamentals:${symbol}`,
    async () => {
      const qs = new URLSearchParams({ endpoint: "fundamentals", symbol }).toString();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-eodhd?${qs}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        },
      );
      if (!res.ok) throw new Error(`EODHD fundamentals failed (${res.status}): ${await res.text()}`);
      return res.json();
    },
    // 12h TTL — fundamentals update quarterly
    { ttlMs: 12 * 60 * 60_000 },
  );
}
