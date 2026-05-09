import { useQuery } from '@tanstack/react-query';

/**
 * useEodhdQuota — surface remaining daily EODHD credits.
 *
 * Calls the **free** /user meta endpoint (cost: 0 credits) via the api-eodhd
 * edge function. Use this to:
 *   - render a quota indicator in dev menus / settings panels
 *   - early-warn the user before the daily floor blocks paid endpoints
 *   - debug why an EODHD-backed feature suddenly returned no data
 *
 * The /user endpoint is gated by EODHD per second (not per day), so polling
 * every minute is safe. We cap auto-refresh at 5 min anyway since the burn
 * rate inside any one minute is bounded by Supabase edge concurrency.
 */

export interface EodhdQuota {
  /** Total daily request quota for this account. */
  dailyLimit: number;
  /** Requests already consumed today. */
  used: number;
  /** Remaining requests before the daily ceiling. */
  remaining: number;
  /** True if remaining quota is below the safety floor — paid endpoints will refuse. */
  belowSafetyFloor: boolean;
  /** Plan tier reported by EODHD (e.g. "monthly", "trial"). */
  subscriptionType: string | null;
}

const SAFETY_FLOOR = 2000; // matches QUOTA_SAFETY_FLOOR in api-eodhd edge fn

export function useEodhdQuota(opts: { refetchMs?: number; enabled?: boolean } = {}) {
  const { refetchMs = 5 * 60_000, enabled = true } = opts;

  return useQuery<EodhdQuota>({
    queryKey: ['eodhd-quota'],
    enabled,
    staleTime:        60_000,           // 1 min — quota counter increments live
    refetchInterval:  refetchMs,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID  as string;
      const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const url = `https://${projectId}.supabase.co/functions/v1/api-eodhd?endpoint=user`;
      const res = await fetch(url, {
        headers: {
          apikey:        anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      if (!res.ok) {
        throw new Error(`api-eodhd user endpoint failed: ${res.status}`);
      }
      const d = await res.json();
      const dailyLimit = typeof d.dailyRateLimit === 'number' ? d.dailyRateLimit : 100_000;
      const used       = typeof d.apiRequests   === 'number' ? d.apiRequests   : 0;
      const remaining  = Math.max(0, dailyLimit - used);
      return {
        dailyLimit,
        used,
        remaining,
        belowSafetyFloor: remaining < SAFETY_FLOOR,
        subscriptionType: typeof d.subscriptionType === 'string' ? d.subscriptionType : null,
      };
    },
  });
}
