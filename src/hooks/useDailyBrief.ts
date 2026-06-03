import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyBriefSector {
  symbol: string;
  name: string;
  pct_change: number | null;
}

export interface DailyBriefFearGreed {
  score: number;
  label: string;
  vix: number | null;
  interpretation: string;
}

export interface DailyBriefCalendarItem {
  time: string;
  name: string;
  estimate?: string;
  prior?: string;
}

export type MarketRegime = 'trending_up' | 'range_bound' | 'volatile' | 'risk_off';

export interface DailyBrief {
  id: string;
  date: string;                           // "YYYY-MM-DD"
  headline: string;
  market_regime: MarketRegime;
  sentiment_score: number;                // 0–100
  vix: number | null;
  summary: string;
  sectors: DailyBriefSector[];
  fear_greed: DailyBriefFearGreed;
  current_events: string;
  calendar: DailyBriefCalendarItem[];
  watch_today: string;
  generated_at: string;
  model: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches the most recent daily brief row with date ≤ today.
 * On weekends and holidays this returns Friday's brief, which the
 * DailyBriefCard marks with a "Previous session" badge.
 *
 * staleTime: 1 hour — the brief doesn't change during the day.
 */
export function useDailyBrief() {
  return useQuery<DailyBrief | null>({
    queryKey: ['daily-brief'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_briefs')
        .select('*')
        .lte('date', today)          // today or earlier — handles weekends/holidays
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();              // returns null (not throws) when no rows exist

      if (error) {
        console.error('useDailyBrief error:', error);
        throw error;
      }
      return data as DailyBrief | null;
    },
    staleTime: 60 * 60_000,          // 1 hour — brief doesn't change intraday
    gcTime:    4 * 60 * 60_000,      // keep in cache 4 hours
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
