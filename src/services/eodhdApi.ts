/**
 * EODHD API client utility
 *
 * Calls the `api-eodhd` Edge Function (never EODHD directly).
 * Ready for React Query hook integration.
 *
 * Key rotation: update the EODHD_API_KEY secret in Lovable Cloud.
 */

import { supabase } from "@/integrations/supabase/client";

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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EODHD fetch failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Fetch fundamentals JSON from EODHD via the edge function proxy.
 * @param symbol e.g. "AAPL.US"
 */
export async function fetchEodFundamentals(
  symbol: string,
): Promise<Record<string, unknown>> {
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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EODHD fundamentals failed (${res.status}): ${body}`);
  }

  return res.json();
}
