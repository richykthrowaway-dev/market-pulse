import { unrealizedPnl } from './tradeMetrics';

type Side = 'long' | 'short';
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface RrBar {
  lo: number; hi: number;
  stopPct: number; entryPct: number; targetPct: number;
  livePct: number | null; rMultiple: number | null;
}

/** Geometry for the risk/reward bar. null unless entry>0 && stop && target. */
export function rrBar(
  side: Side, entry: number, stop: number | undefined,
  target: number | undefined, live: number | null | undefined,
): RrBar | null {
  if (entry <= 0 || stop == null || target == null) return null;
  const xs = [stop, entry, target];
  if (live != null) xs.push(live);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo;
  const pos = (x: number) => (span <= 0 ? 0 : clamp01((x - lo) / span));
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  return {
    lo, hi,
    stopPct: pos(stop), entryPct: pos(entry), targetPct: pos(target),
    livePct: live != null ? pos(live) : null,
    rMultiple: risk > 0 ? reward / risk : null,
  };
}

export interface Payoff {
  ifStopped: { dollars: number; pct: number } | null;
  ifTarget: { dollars: number; pct: number } | null;
  posValue: number;
  acctPct: number | null;
}

/** Live payoff figures. Reuses unrealizedPnl for sign correctness. */
export function payoff(
  side: Side, entry: number, stop: number | undefined,
  target: number | undefined, qty: number, account?: number,
): Payoff {
  const ok = entry > 0 && qty > 0;
  const ifStopped = ok && stop != null ? unrealizedPnl(side, entry, stop, qty) : null;
  const ifTarget = ok && target != null ? unrealizedPnl(side, entry, target, qty) : null;
  const posValue = ok ? entry * qty : 0;
  const acctPct = ok && account != null && account > 0 ? (posValue / account) * 100 : null;
  return { ifStopped, ifTarget, posValue, acctPct };
}

export interface EntryDefaults { stopPct: number; targetR: number; }

/** Parse tp-entry-defaults-v1 JSON; fall back to {stopPct:2,targetR:2}. */
export function resolveEntryDefaults(raw: string | null): EntryDefaults {
  const d: EntryDefaults = { stopPct: 2, targetR: 2 };
  if (!raw) return d;
  try {
    const p = JSON.parse(raw);
    if (typeof p?.stopPct === 'number' && p.stopPct > 0) d.stopPct = p.stopPct;
    if (typeof p?.targetR === 'number' && p.targetR > 0) d.targetR = p.targetR;
  } catch { /* keep defaults */ }
  return d;
}
