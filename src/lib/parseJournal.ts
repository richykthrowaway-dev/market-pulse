import type { TradeEntry } from '@/hooks/useTradeJournal';

export interface JournalParseResult {
  trades: TradeEntry[];
  dropped: number;
}

const n = (v: unknown, d = 0): number => {
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
};
const s = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export function parseJournal(raw: string | null): JournalParseResult {
  if (raw == null) return { trades: [], dropped: 0 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { trades: [], dropped: 0 }; }
  if (!Array.isArray(arr)) return { trades: [], dropped: 0 };

  const trades: TradeEntry[] = [];
  let dropped = 0;
  for (const row of arr) {
    if (!row || typeof row !== 'object') { dropped++; continue; }
    const r = row as Record<string, unknown>;
    const id = s(r.id);
    const symbol = s(r.symbol);
    if (!id || !symbol) { dropped++; continue; }
    const createdAt = s(r.createdAt);
    const entryDate = s(r.entryDate);
    trades.push({
      ...(r as object),
      id,
      symbol,
      side: r.side === 'short' ? 'short' : 'long',
      quantity: n(r.quantity),
      entryPrice: n(r.entryPrice),
      exitPrice: n(r.exitPrice),
      entryDate,
      exitDate: s(r.exitDate) || entryDate || createdAt || '',
      fees: n(r.fees),
      notes: s(r.notes),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      createdAt: createdAt || new Date(0).toISOString(),
    } as TradeEntry);
  }
  return { trades, dropped };
}
