// Advanced trade-analytics math helpers.
// Pure, side-effect-free, deterministic — easy to unit-test if you ever want to.

import { TradeEntry, computePnL, computeR } from '@/hooks/useTradeJournal';

// ── Hold-time helpers ────────────────────────────────────────────────────────

/**
 * Returns hold duration in minutes if computable, else null.
 * Uses entryTime/exitTime when present; falls back to whole-day deltas otherwise.
 */
export function getHoldTimeMinutes(t: TradeEntry): number | null {
  // Same day with both intraday times → minute-precision diff
  if (t.entryDate === t.exitDate) {
    if (!t.entryTime || !t.exitTime) return null;
    const [eh, em] = t.entryTime.split(':').map(Number);
    const [xh, xm] = t.exitTime.split(':').map(Number);
    const diff = (xh * 60 + xm) - (eh * 60 + em);
    return diff > 0 ? diff : null;
  }
  // Multi-day: combine date + (optional) times
  const entry = new Date(`${t.entryDate}T${t.entryTime ?? '00:00'}:00`).getTime();
  const exit  = new Date(`${t.exitDate}T${t.exitTime ?? '23:59'}:00`).getTime();
  if (!isFinite(entry) || !isFinite(exit) || exit <= entry) return null;
  return (exit - entry) / 60_000;
}

export function fmtHoldTime(minutes: number): string {
  if (minutes < 1)    return '<1m';
  if (minutes < 60)   return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
  }
  return `${(minutes / 1440).toFixed(1)}d`;
}

// ── Generic helpers ──────────────────────────────────────────────────────────

export function mostCommon<T>(items: T[]): { value: T; count: number } | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Max drawdown (peak-to-trough) ────────────────────────────────────────────

export function computeMaxDrawdown(trades: TradeEntry[]): number {
  if (trades.length === 0) return 0;
  const sorted = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  let peak = 0, cum = 0, maxDD = 0;
  for (const t of sorted) {
    cum += computePnL(t);
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ── Edge-quality metric bundle ───────────────────────────────────────────────

export interface EdgeMetrics {
  profitFactor: number;       // grossWins / grossLosses
  sharpe: number;             // per-trade, mean / stdDev
  sortino: number;            // per-trade, mean / downside-stdDev
  sqn: number | null;         // Van Tharp: √N × mean(R) / stdDev(R). null if <5 R values.
  sqnSampleSize: number;
  recoveryFactor: number;     // netPnL / maxDD
  kellyPct: number;           // Kelly criterion %
  maxDrawdown: number;
  stdDevPnL: number;
  totalPnL: number;
}

export function computeEdgeMetrics(trades: TradeEntry[]): EdgeMetrics {
  if (trades.length === 0) {
    return { profitFactor: 0, sharpe: 0, sortino: 0, sqn: null, sqnSampleSize: 0,
             recoveryFactor: 0, kellyPct: 0, maxDrawdown: 0, stdDevPnL: 0, totalPnL: 0 };
  }
  const pnls = trades.map(computePnL);
  const totalPnL = pnls.reduce((s, v) => s + v, 0);
  const mean    = totalPnL / pnls.length;
  const sd      = stdDev(pnls);
  const sharpe  = sd > 0 ? mean / sd : 0;

  // Sortino: downside semivariance — only penalise below-mean (or below-zero) deviations
  const downsideSquares = pnls.map(v => v < 0 ? v * v : 0);
  const downsideVar = downsideSquares.reduce((s, v) => s + v, 0) / pnls.length;
  const downsideSd  = Math.sqrt(downsideVar);
  const sortino     = downsideSd > 0 ? mean / downsideSd : 0;

  // Profit factor
  const grossWins   = pnls.filter(v => v > 0).reduce((s, v) => s + v, 0);
  const grossLosses = Math.abs(pnls.filter(v => v < 0).reduce((s, v) => s + v, 0));
  const profitFactor = grossLosses > 0
    ? grossWins / grossLosses
    : grossWins > 0 ? Infinity : 0;

  // SQN (R-multiple based) — only meaningful with ≥5 R values
  const rValues = trades.map(computeR).filter((r): r is number => r !== null);
  let sqn: number | null = null;
  if (rValues.length >= 5) {
    const rMean = rValues.reduce((s, r) => s + r, 0) / rValues.length;
    const rSd   = stdDev(rValues);
    sqn = rSd > 0 ? Math.sqrt(rValues.length) * rMean / rSd : 0;
  }

  // Recovery factor
  const maxDrawdown    = computeMaxDrawdown(trades);
  const recoveryFactor = maxDrawdown > 0
    ? totalPnL / maxDrawdown
    : totalPnL > 0 ? Infinity : 0;

  // Kelly: K = W − (1 − W) / R, where R = avgWin / avgLoss
  const wins  = pnls.filter(v => v > 0);
  const losses = pnls.filter(v => v < 0);
  const winRate = wins.length / pnls.length;
  const avgWin  = wins.length  > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0;
  let kellyPct = 0;
  if (avgWin > 0 && avgLoss > 0) {
    const ratio = avgWin / avgLoss;
    kellyPct = (winRate - (1 - winRate) / ratio) * 100;
  }

  return {
    profitFactor, sharpe, sortino, sqn, sqnSampleSize: rValues.length,
    recoveryFactor, kellyPct, maxDrawdown, stdDevPnL: sd, totalPnL,
  };
}

// ── Quality tiering (used for color coding) ──────────────────────────────────

export type Quality = 'poor' | 'ok' | 'good' | 'excellent' | 'neutral';

export function qualityForProfitFactor(pf: number): Quality {
  if (!isFinite(pf)) return 'excellent';
  if (pf < 1)    return 'poor';
  if (pf < 1.5)  return 'ok';
  if (pf < 2.5)  return 'good';
  return 'excellent';
}

export function qualityForSharpe(s: number): Quality {
  if (s < 0)     return 'poor';
  if (s < 0.10)  return 'ok';
  if (s < 0.25)  return 'good';
  return 'excellent';
}

export function qualityForSortino(s: number): Quality {
  if (s < 0)     return 'poor';
  if (s < 0.15)  return 'ok';
  if (s < 0.35)  return 'good';
  return 'excellent';
}

export function qualityForSQN(s: number | null): Quality {
  if (s === null) return 'neutral';
  if (s < 1.6)    return 'poor';
  if (s < 2.5)    return 'ok';
  if (s < 3.0)    return 'good';
  return 'excellent';
}

export function qualityForRecovery(r: number): Quality {
  if (!isFinite(r)) return 'excellent';
  if (r < 1)        return 'poor';
  if (r < 3)        return 'ok';
  if (r < 5)        return 'good';
  return 'excellent';
}

export function qualityForKelly(k: number): Quality {
  if (k < 0)   return 'poor';
  if (k < 5)   return 'ok';
  if (k < 15)  return 'good';
  return 'excellent';
}

// ── Anatomy (typical-winner / typical-loser breakdowns) ──────────────────────

export interface TradeAnatomy {
  count: number;
  avgPnL: number;
  avgHoldMinutes: number | null;
  topSetup: { value: string; count: number } | null;
  topMistake: { value: string; count: number } | null;
  longCount: number;
  shortCount: number;
  avgR: number | null;
  largestAbs: number;     // largest winner or largest loser by abs value
}

export function computeAnatomy(
  trades: TradeEntry[],
  predicate: (pnl: number) => boolean,
): TradeAnatomy {
  const filtered = trades.filter(t => predicate(computePnL(t)));
  if (filtered.length === 0) {
    return { count: 0, avgPnL: 0, avgHoldMinutes: null, topSetup: null, topMistake: null,
             longCount: 0, shortCount: 0, avgR: null, largestAbs: 0 };
  }
  const pnls = filtered.map(computePnL);
  const avgPnL = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const largestAbs = pnls.reduce((max, v) => Math.abs(v) > Math.abs(max) ? v : max, 0);

  const holdTimes = filtered.map(getHoldTimeMinutes).filter((m): m is number => m !== null && m > 0);
  const avgHoldMinutes = holdTimes.length > 0
    ? holdTimes.reduce((s, m) => s + m, 0) / holdTimes.length
    : null;

  const setups   = filtered.map(t => t.setup).filter((s): s is string => !!s);
  const mistakes = filtered.flatMap(t => t.mistakes ?? []);
  const rValues  = filtered.map(computeR).filter((r): r is number => r !== null);

  return {
    count: filtered.length,
    avgPnL,
    avgHoldMinutes,
    topSetup:   mostCommon(setups),
    topMistake: mostCommon(mistakes),
    longCount:  filtered.filter(t => t.side === 'long').length,
    shortCount: filtered.filter(t => t.side === 'short').length,
    avgR: rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null,
    largestAbs,
  };
}

// ── Behavioural / compliance bundle ──────────────────────────────────────────

export interface BehavioralMetrics {
  inPlaybook:  { count: number; pnl: number; winRate: number };
  offScript:   { count: number; pnl: number; winRate: number };
  tilt:        { count: number; pnl: number; winRate: number };
  maxWinStreak: number;
  maxLossStreak: number;
  totalTagged:  number;  // trades with any inPlaybook flag (true or false)
}

export function computeBehavioral(trades: TradeEntry[]): BehavioralMetrics {
  const inPlaybookTrades = trades.filter(t => t.inPlaybook === true);
  const offScriptTrades  = trades.filter(t => t.inPlaybook === false);
  const totalTagged      = trades.filter(t => t.inPlaybook !== undefined).length;

  const stat = (ts: TradeEntry[]) => {
    const pnl = ts.reduce((s, t) => s + computePnL(t), 0);
    const wins = ts.filter(t => computePnL(t) > 0).length;
    return { count: ts.length, pnl, winRate: ts.length > 0 ? wins / ts.length : 0 };
  };

  // Streaks + tilt detection, walking chronologically
  const sorted = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  const tiltTrades: TradeEntry[] = [];
  let consecLosses = 0;
  for (const t of sorted) {
    // Record THIS trade as tilt if 2+ losses preceded it
    if (consecLosses >= 2) tiltTrades.push(t);
    const pnl = computePnL(t);
    if (pnl > 0)      { curWin++;  curLoss = 0; if (curWin  > maxWin)  maxWin  = curWin;  consecLosses = 0; }
    else if (pnl < 0) { curLoss++; curWin  = 0; if (curLoss > maxLoss) maxLoss = curLoss; consecLosses++; }
    // Break-even trades: don't extend either streak, don't reset tilt
  }

  return {
    inPlaybook: stat(inPlaybookTrades),
    offScript:  stat(offScriptTrades),
    tilt:       stat(tiltTrades),
    maxWinStreak:  maxWin,
    maxLossStreak: maxLoss,
    totalTagged,
  };
}

// ── Fee-impact bundle ────────────────────────────────────────────────────────

export interface FeeImpact {
  totalFees:     number;
  grossPnL:      number;   // before fees
  netPnL:        number;   // after fees (= totalPnL)
  feeRatio:      number;   // fees ÷ grossWinAmount, as %
  avgFee:        number;
  grossWinRate:  number;
  netWinRate:    number;
  flippedTrades: number;   // gross-positive but net-negative trades
}

export function computeFeeImpact(trades: TradeEntry[]): FeeImpact {
  if (trades.length === 0) {
    return { totalFees: 0, grossPnL: 0, netPnL: 0, feeRatio: 0, avgFee: 0,
             grossWinRate: 0, netWinRate: 0, flippedTrades: 0 };
  }
  let totalFees = 0, grossPnL = 0, netPnL = 0;
  let grossWins = 0, netWins = 0, grossWinAmount = 0;
  let flipped = 0;
  for (const t of trades) {
    const gross = t.side === 'long'
      ? (t.exitPrice - t.entryPrice) * t.quantity
      : (t.entryPrice - t.exitPrice) * t.quantity;
    const net = gross - t.fees;
    totalFees += t.fees;
    grossPnL  += gross;
    netPnL    += net;
    if (gross > 0) { grossWins++; grossWinAmount += gross; }
    if (net   > 0) netWins++;
    if (gross > 0 && net <= 0) flipped++;
  }
  return {
    totalFees,
    grossPnL,
    netPnL,
    feeRatio: grossWinAmount > 0 ? (totalFees / grossWinAmount) * 100 : 0,
    avgFee:   totalFees / trades.length,
    grossWinRate: grossWins / trades.length,
    netWinRate:   netWins   / trades.length,
    flippedTrades: flipped,
  };
}
