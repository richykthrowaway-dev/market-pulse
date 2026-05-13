import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';

export interface DayOfWeekInsight {
  kind: 'dayOfWeek';
  bestDay: string; bestWinRate: number;
  worstDay: string; worstWinRate: number;
  worstTradeCount: number; worstPnL: number;
}

export interface AfterLossInsight {
  kind: 'afterLoss';
  afterLossWinRate: number;
  afterWinWinRate: number;
}

export interface OutlierLossEntry {
  tradeId: string;
  date: string;
  symbol: string;
  loss: number;
  multiplier: number;
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function computeDayOfWeekInsight(trades: TradeEntry[]): DayOfWeekInsight | null {
  const buckets = DAYS.map(() => ({ count: 0, wins: 0, pnl: 0 }));
  for (const t of trades) {
    const d = new Date(t.exitDate + 'T12:00:00').getDay();
    const pnl = computePnL(t);
    buckets[d].count += 1;
    buckets[d].pnl += pnl;
    if (pnl > 0) buckets[d].wins += 1;
  }
  const eligible = buckets
    .map((b, i) => ({ day: DAYS[i], ...b, winRate: b.count > 0 ? b.wins / b.count : 0 }))
    .filter(b => b.count >= 5);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => b.winRate - a.winRate);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  if (best.winRate - worst.winRate < 0.20) return null;
  return {
    kind: 'dayOfWeek',
    bestDay: best.day, bestWinRate: best.winRate * 100,
    worstDay: worst.day, worstWinRate: worst.winRate * 100,
    worstTradeCount: worst.count, worstPnL: worst.pnl,
  };
}

export function computeAfterLossInsight(trades: TradeEntry[]): AfterLossInsight | null {
  if (trades.length < 21) return null;
  const sorted = [...trades].sort((a, b) =>
    (a.exitDate + (a.exitTime ?? '00:00')).localeCompare(b.exitDate + (b.exitTime ?? '00:00'))
  );
  let afterLossWins = 0, afterLossTotal = 0, afterWinWins = 0, afterWinTotal = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevPnL = computePnL(sorted[i - 1]);
    const curPnL = computePnL(sorted[i]);
    if (prevPnL < 0) {
      afterLossTotal += 1;
      if (curPnL > 0) afterLossWins += 1;
    } else if (prevPnL > 0) {
      afterWinTotal += 1;
      if (curPnL > 0) afterWinWins += 1;
    }
  }
  if (afterLossTotal < 10 || afterWinTotal < 10) return null;
  const afterLossWinRate = afterLossWins / afterLossTotal;
  const afterWinWinRate = afterWinWins / afterWinTotal;
  if (afterWinWinRate - afterLossWinRate < 0.15) return null;
  return { kind: 'afterLoss', afterLossWinRate: afterLossWinRate * 100, afterWinWinRate: afterWinWinRate * 100 };
}

export function computeOutlierLosses(trades: TradeEntry[]): OutlierLossEntry[] {
  const losses = trades.map(t => ({ t, pnl: computePnL(t) })).filter(x => x.pnl < 0);
  if (losses.length < 5) return [];
  const magnitudes = losses.map(x => Math.abs(x.pnl)).sort((a, b) => a - b);
  const median = magnitudes[Math.floor(magnitudes.length / 2)];
  if (median === 0) return [];
  const outliers: OutlierLossEntry[] = [];
  for (const { t, pnl } of losses) {
    const mult = Math.abs(pnl) / median;
    if (mult > 3) {
      outliers.push({ tradeId: t.id, date: t.exitDate, symbol: t.symbol, loss: pnl, multiplier: mult });
    }
  }
  return outliers.sort((a, b) => b.multiplier - a.multiplier).slice(0, 3);
}
