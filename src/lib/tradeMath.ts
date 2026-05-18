/** Minimal structural input shared by the Journal and the close preview.
 *  TradeEntry (in useTradeJournal) is a superset and is assignable here. */
export interface TradeMathInput {
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees: number;
  stopLoss?: number;
}

export function computePnL(t: TradeMathInput): number {
  const gross = t.side === 'long'
    ? (t.exitPrice - t.entryPrice) * t.quantity
    : (t.entryPrice - t.exitPrice) * t.quantity;
  return gross - t.fees;
}

export function computeInitialRisk(t: TradeMathInput): number | null {
  if (t.stopLoss === undefined || t.stopLoss === null) return null;
  return Math.abs(t.entryPrice - t.stopLoss) * t.quantity;
}

export function computeR(t: TradeMathInput): number | null {
  const risk = computeInitialRisk(t);
  if (risk === null || risk === 0) return null;
  return computePnL(t) / risk;
}
