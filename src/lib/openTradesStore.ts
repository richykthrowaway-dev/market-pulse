import type { OpenTrade } from '@/hooks/useOpenTrades';

export interface ParseResult {
  trades: OpenTrade[];
  dropped: number;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

/** Parse the persisted open-trades payload. Self-healing: repairs salvageable
 *  rows, drops unsalvageable ones, and reports how many were dropped. */
export function parseOpenTrades(raw: string | null): ParseResult {
  if (raw == null) return { trades: [], dropped: 0 };
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return { trades: [], dropped: 0 }; }
  if (!Array.isArray(arr)) return { trades: [], dropped: 0 };

  const trades: OpenTrade[] = [];
  let dropped = 0;
  for (const row of arr) {
    if (!row || typeof row !== 'object') { dropped++; continue; }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id ? r.id : undefined;
    const symbol = typeof r.symbol === 'string' && r.symbol.trim() ? r.symbol.trim().toUpperCase() : undefined;
    const entryPrice = num(r.entryPrice);
    const quantity = num(r.quantity);
    if (!id || !symbol || entryPrice == null || quantity == null) { dropped++; continue; }
    trades.push({
      id,
      symbol,
      side: r.side === 'short' ? 'short' : 'long',
      quantity,
      entryPrice,
      stopLoss: num(r.stopLoss),
      target: num(r.target),
      entryDate: typeof r.entryDate === 'string' ? r.entryDate : '',
      setup: typeof r.setup === 'string' ? r.setup : undefined,
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      planValid: r.planValid !== false,
    });
  }
  return { trades, dropped };
}
