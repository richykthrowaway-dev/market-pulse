import { describe, it, expect } from 'vitest';
import { pnlOn, realizedPnL } from './journalWindows';
import type { TradeEntry } from '@/hooks/useTradeJournal';

const t = (o: Partial<TradeEntry>): TradeEntry => ({
  id: 'x', symbol: 'X', side: 'long', quantity: 10, entryPrice: 100, exitPrice: 110,
  entryDate: '2026-05-10', exitDate: '2026-05-10', fees: 0, notes: '', tags: [],
  createdAt: '2026-05-10T00:00:00Z', ...o,
});

describe('journalWindows', () => {
  it('pnlOn sums only trades exited on the given date', () => {
    const trades = [
      t({ exitDate: '2026-05-18', exitPrice: 110 }),
      t({ exitDate: '2026-05-18', side: 'short', exitPrice: 90 }),
      t({ exitDate: '2026-05-17', exitPrice: 200 }),
    ];
    expect(pnlOn(trades, '2026-05-18')).toBe(200);
    expect(pnlOn(trades, '2026-05-19')).toBe(0);
  });
  it('realizedPnL sums trades with exitDate >= sinceISO', () => {
    const trades = [
      t({ exitDate: '2026-05-18', exitPrice: 110 }),
      t({ exitDate: '2026-05-12', exitPrice: 110 }),
      t({ exitDate: '2026-05-15', exitPrice: 105 }),
    ];
    expect(realizedPnL(trades, '2026-05-14')).toBe(150);
  });
  it('null/empty/garbage safe', () => {
    expect(pnlOn([], '2026-05-18')).toBe(0);
    // @ts-expect-error intentional
    expect(realizedPnL(null, '2026-05-18')).toBe(0);
  });
});
