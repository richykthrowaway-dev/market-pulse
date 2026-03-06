import { supabase } from '@/integrations/supabase/client';
import { resolveTimeframeId as resolveTimeframeIdCached } from '@/services/symbolMappingCache';

export interface Bar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  trades: number | null;
}

export interface AdjustedBar extends Bar {
  adjOpen: number;
  adjHigh: number;
  adjLow: number;
  adjClose: number;
  adjVolume: number;
}

interface BarsQuery {
  listingId: string;
  timeframeCode: string;
  from: string; // ISO timestamp
  to: string;
}

async function resolveTimeframeId(code: string): Promise<string> {
  const tfId = await resolveTimeframeIdCached(code);
  if (!tfId) throw new Error(`Unknown timeframe code: ${code}`);
  return tfId;
}

export async function getBars(q: BarsQuery): Promise<Bar[]> {
  const tfId = await resolveTimeframeId(q.timeframeCode);

  const { data, error } = await supabase
    .from('ohlcv_bars')
    .select('ts, open, high, low, close, volume, vwap, trades')
    .eq('listing_id', q.listingId)
    .eq('timeframe_id', tfId)
    .gte('ts', q.from)
    .lte('ts', q.to)
    .order('ts', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    ts: r.ts,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
    vwap: r.vwap != null ? Number(r.vwap) : null,
    trades: r.trades != null ? Number(r.trades) : null,
  }));
}

export async function getAdjustedBars(q: BarsQuery): Promise<AdjustedBar[]> {
  const bars = await getBars(q);

  // Fetch splits for this listing up to the end date
  const { data: actions, error } = await supabase
    .from('corporate_actions')
    .select('effective_date, split_ratio')
    .eq('listing_id', q.listingId)
    .eq('action_type', 'split')
    .lte('effective_date', q.to)
    .order('effective_date', { ascending: true });

  if (error) throw error;

  const splits = (actions ?? [])
    .filter((a) => a.split_ratio != null)
    .map((a) => ({
      date: a.effective_date,
      ratio: Number(a.split_ratio!),
    }));

  // Walk bars chronologically, accumulating split ratios
  let splitIdx = 0;
  let cumRatio = 1.0;

  return bars.map((bar) => {
    const barDate = bar.ts.slice(0, 10); // YYYY-MM-DD
    while (splitIdx < splits.length && splits[splitIdx].date <= barDate) {
      cumRatio *= splits[splitIdx].ratio;
      splitIdx++;
    }
    return {
      ...bar,
      adjOpen: bar.open / cumRatio,
      adjHigh: bar.high / cumRatio,
      adjLow: bar.low / cumRatio,
      adjClose: bar.close / cumRatio,
      adjVolume: bar.volume * cumRatio,
    };
  });
}

export async function getLatestQuote(listingId: string): Promise<Bar | null> {
  const { data, error } = await supabase
    .from('ohlcv_bars')
    .select('ts, open, high, low, close, volume, vwap, trades')
    .eq('listing_id', listingId)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ts: data.ts,
    open: Number(data.open),
    high: Number(data.high),
    low: Number(data.low),
    close: Number(data.close),
    volume: Number(data.volume),
    vwap: data.vwap != null ? Number(data.vwap) : null,
    trades: data.trades != null ? Number(data.trades) : null,
  };
}
