import type { TradeEntry } from '@/hooks/useTradeJournal';
import { computePnL } from '@/lib/tradeMath';

/** Σ realized P&L of trades whose exitDate is exactly `dateISO` (YYYY-MM-DD). */
export function pnlOn(trades: TradeEntry[], dateISO: string): number {
  if (!Array.isArray(trades)) return 0;
  let sum = 0;
  for (const t of trades) {
    if (t && typeof t.exitDate === 'string' && t.exitDate === dateISO) sum += computePnL(t);
  }
  return sum;
}

/** Σ realized P&L of trades with exitDate >= sinceISO (lexical YYYY-MM-DD compare). */
export function realizedPnL(trades: TradeEntry[], sinceISO: string): number {
  if (!Array.isArray(trades)) return 0;
  let sum = 0;
  for (const t of trades) {
    if (t && typeof t.exitDate === 'string' && t.exitDate >= sinceISO) sum += computePnL(t);
  }
  return sum;
}
