import type { YahooBar } from '@/services/yahooFinanceApi';

/** Change from the first to the last bar's close. null if no bars. */
export function windowChange(
  bars: Pick<YahooBar, 'c'>[],
): { abs: number; pct: number } | null {
  if (bars.length === 0) return null;
  const first = bars[0].c;
  const last = bars[bars.length - 1].c;
  const abs = last - first;
  const pct = first > 0 ? (abs / first) * 100 : 0;
  return { abs, pct };
}
