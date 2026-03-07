import { useCallback, useMemo, useSyncExternalStore } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type TradeSide = 'long' | 'short';

export interface TradeEntry {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: string;   // "YYYY-MM-DD"
  exitDate: string;    // "YYYY-MM-DD" — calendar placement date
  fees: number;
  notes: string;
  tags: string[];
  createdAt: string;   // ISO timestamp
}

export interface DayPnL {
  pnl: number;
  count: number;
}

export interface JournalStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalPnL: number;
  largestWin: number;
  largestLoss: number;
}

// ── P/L calculation ─────────────────────────────────────────────────────────

export function computePnL(t: TradeEntry): number {
  const gross = t.side === 'long'
    ? (t.exitPrice - t.entryPrice) * t.quantity
    : (t.entryPrice - t.exitPrice) * t.quantity;
  return gross - t.fees;
}

// ── localStorage store ──────────────────────────────────────────────────────

const STORAGE_KEY = 'trade-journal-v1';

function read(): TradeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TradeEntry[];
  } catch {
    return [];
  }
}

function write(entries: TradeEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* storage full */ }
  listeners.forEach(l => l());
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

let snapshot = read();
function getSnapshot() { return snapshot; }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      snapshot = read();
      listeners.forEach(l => l());
    }
  });
}

function update(fn: (prev: TradeEntry[]) => TradeEntry[]) {
  const next = fn(read());
  snapshot = next;
  write(next);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTradeJournal() {
  const trades = useSyncExternalStore(subscribe, getSnapshot);

  const addTrade = useCallback((input: Omit<TradeEntry, 'id' | 'createdAt'>) => {
    update(prev => [
      ...prev,
      { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
    ]);
  }, []);

  const updateTrade = useCallback((id: string, patch: Partial<TradeEntry>) => {
    update(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const deleteTrade = useCallback((id: string) => {
    update(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────

  const sorted = useMemo(
    () => [...trades].sort((a, b) => b.exitDate.localeCompare(a.exitDate)),
    [trades],
  );

  const dailyPnL = useMemo(() => {
    const map = new Map<string, DayPnL>();
    for (const t of trades) {
      const pnl = computePnL(t);
      const existing = map.get(t.exitDate);
      if (existing) {
        existing.pnl += pnl;
        existing.count += 1;
      } else {
        map.set(t.exitDate, { pnl, count: 1 });
      }
    }
    return map;
  }, [trades]);

  const stats = useMemo((): JournalStats => {
    if (trades.length === 0) {
      return { totalTrades: 0, winCount: 0, lossCount: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, totalPnL: 0, largestWin: 0, largestLoss: 0 };
    }
    let winCount = 0, lossCount = 0, grossWins = 0, grossLosses = 0;
    let largestWin = 0, largestLoss = 0, totalPnL = 0;
    for (const t of trades) {
      const pnl = computePnL(t);
      totalPnL += pnl;
      if (pnl > 0) {
        winCount++;
        grossWins += pnl;
        if (pnl > largestWin) largestWin = pnl;
      } else if (pnl < 0) {
        lossCount++;
        grossLosses += Math.abs(pnl);
        if (pnl < largestLoss) largestLoss = pnl;
      }
    }
    return {
      totalTrades: trades.length,
      winCount,
      lossCount,
      winRate: trades.length > 0 ? winCount / trades.length : 0,
      avgWin: winCount > 0 ? grossWins / winCount : 0,
      avgLoss: lossCount > 0 ? -(grossLosses / lossCount) : 0,
      profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
      totalPnL,
      largestWin,
      largestLoss,
    };
  }, [trades]);

  const cumulativePnL = useMemo(() => {
    if (trades.length === 0) return [];
    const byDate = new Map<string, number>();
    for (const t of trades) {
      byDate.set(t.exitDate, (byDate.get(t.exitDate) ?? 0) + computePnL(t));
    }
    const entries = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let cum = 0;
    return entries.map(([date, pnl]) => {
      cum += pnl;
      return { date, cumPnL: cum };
    });
  }, [trades]);

  const tradesByDate = useMemo(() => {
    const map = new Map<string, TradeEntry[]>();
    for (const t of trades) {
      const arr = map.get(t.exitDate) ?? [];
      arr.push(t);
      map.set(t.exitDate, arr);
    }
    return map;
  }, [trades]);

  return {
    trades: sorted,
    addTrade,
    updateTrade,
    deleteTrade,
    dailyPnL,
    stats,
    cumulativePnL,
    tradesByDate,
  } as const;
}
