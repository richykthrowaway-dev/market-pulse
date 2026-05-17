export type StopState = 'ok' | 'near' | 'breached';

/** Unrealized P&L. `side` flips the sign for shorts. */
export function unrealizedPnl(
  side: 'long' | 'short',
  entry: number,
  price: number,
  qty: number,
): { dollars: number; pct: number } {
  const dir = side === 'long' ? 1 : -1;
  const dollars = (price - entry) * qty * dir;
  const pct = entry > 0 ? ((price - entry) / entry) * 100 * dir : 0;
  return { dollars, pct };
}

/**
 * Where price sits relative to the stop.
 *  - 'breached': price has crossed the stop (loss side)
 *  - 'near': price within 25% of the entry→stop distance of the stop
 *  - 'ok': otherwise (or no stop set)
 *  Assumes `stop` is on the loss side of `entry` (below for long, above for short).
 */
export function stopProximity(
  side: 'long' | 'short',
  entry: number,
  stop: number | undefined,
  price: number,
): StopState {
  if (stop == null) return 'ok';
  const dist = Math.abs(entry - stop);
  if (side === 'long') {
    if (price <= stop) return 'breached';
    if (price <= stop + dist * 0.25) return 'near';
    return 'ok';
  }
  if (price >= stop) return 'breached';
  if (price >= stop - dist * 0.25) return 'near';
  return 'ok';
}
