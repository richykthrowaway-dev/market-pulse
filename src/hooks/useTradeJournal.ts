import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { parseJournal } from '@/lib/parseJournal';

// ── Types ────────────────────────────────────────────────────────────────────

export type TradeSide = 'long' | 'short';

export type ExitReason = 'target' | 'stop' | 'time' | 'discretion' | 'panic';

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
  // NEW — Wave 1, all optional
  stopLoss?: number;
  target?: number;
  entryTime?: string;        // "HH:MM"
  exitTime?: string;
  setup?: string;
  mistakes?: string[];
  exitReason?: ExitReason;
  inPlaybook?: boolean;
  screenshot?: string;       // IDB key, not the blob itself
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
  expectancy: number;            // mean P&L per trade across all trades
  rExpectancy: number | null;    // mean R across trades with a stop, or null if none
  rTradeCount: number;           // how many trades have a stop
}

// ── P/L calculation ─────────────────────────────────────────────────────────

// Import so the names are bound in THIS module's scope (the hook's derived
// memos below call computePnL/computeR directly), and re-export so existing
// `@/hooks/useTradeJournal` consumers keep working. NOTE: a bare
// `export { … } from '…'` re-exports WITHOUT creating a local binding — that
// caused `ReferenceError: computePnL is not defined` and white-screened the
// whole app on any page that mounts this hook with a non-empty journal.
import { computePnL, computeInitialRisk, computeR } from '@/lib/tradeMath';

export { computePnL, computeInitialRisk, computeR };

// ── Persistent store (localStorage + IndexedDB dual-write) ─────────────────
//
// localStorage  — synchronous reads, used by useSyncExternalStore for speed.
// IndexedDB     — async but robust; survives origin changes, quota issues,
//                 and scenarios where localStorage is silently wiped.
//
// Write path:  every mutation writes to BOTH stores in parallel.
// Read path:   snapshot is from localStorage (sync).  On init, if localStorage
//              is empty, an async IndexedDB read hydrates the snapshot.

const LS_KEY = 'trade-journal-v1';
export const pendingJournalNotice = { dropped: 0 };
const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'trades';
const IDB_DOC = 'all';

// ── IndexedDB helpers (fire-and-forget writes, await-able reads) ────────────

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades'))      db.createObjectStore('trades');
      if (!db.objectStoreNames.contains('settings'))    db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('screenshots')) db.createObjectStore('screenshots');
      if (!db.objectStoreNames.contains('strategy'))    db.createObjectStore('strategy');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbRead(): Promise<TradeEntry[]> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_DOC);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

function idbWrite(entries: TradeEntry[]) {
  // Fire-and-forget — no await needed on the write path
  openIdb().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(entries, IDB_DOC);
  }).catch(() => {});
}

// ── localStorage helpers ────────────────────────────────────────────────────

function lsRead(): TradeEntry[] {
  try {
    const { trades, dropped } = parseJournal(localStorage.getItem(LS_KEY));
    if (dropped > 0) pendingJournalNotice.dropped += dropped;
    return trades;
  } catch { return []; }
}

function lsWrite(entries: TradeEntry[]): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
    return true;
  } catch {
    console.warn('[TradeJournal] localStorage write failed — data saved to IndexedDB only');
    return false;
  }
}

// ── Subscription & snapshot (useSyncExternalStore contract) ─────────────────

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notify() { listeners.forEach(l => l()); }

let snapshot: TradeEntry[] = lsRead();
function getSnapshot() { return snapshot; }

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) {
      snapshot = lsRead();
      notify();
    }
  });
}

// Bi-directional sync on init:
//  • localStorage empty + IndexedDB has data → hydrate localStorage (origin change / cleared)
//  • localStorage has data + IndexedDB empty → seed IndexedDB (migration from pre-IDB code)
if (typeof window !== 'undefined') {
  idbRead().then(idbEntries => {
    if (snapshot.length === 0 && idbEntries.length > 0) {
      // IDB → LS hydration
      snapshot = idbEntries;
      lsWrite(idbEntries);
      notify();
    } else if (snapshot.length > 0 && idbEntries.length === 0) {
      // LS → IDB migration (existing users before dual-write was added)
      idbWrite(snapshot);
    }
  });
}

// ── Dual-write update ───────────────────────────────────────────────────────

function update(fn: (prev: TradeEntry[]) => TradeEntry[]) {
  const next = fn(lsRead().length > 0 ? lsRead() : snapshot);
  snapshot = next;
  lsWrite(next);
  idbWrite(next); // async, fire-and-forget
  notify();
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTradeJournal() {
  const trades = useSyncExternalStore(subscribe, getSnapshot);

  const addTrade = useCallback((input: Omit<TradeEntry, 'id' | 'createdAt'>): string => {
    const id = crypto.randomUUID();
    update(prev => [
      ...prev,
      { ...input, id, createdAt: new Date().toISOString() },
    ]);
    return id;
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
      return { totalTrades: 0, winCount: 0, lossCount: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, totalPnL: 0, largestWin: 0, largestLoss: 0, expectancy: 0, rExpectancy: null, rTradeCount: 0 };
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
    const expectancy = trades.length > 0 ? totalPnL / trades.length : 0;
    let rSum = 0, rCount = 0;
    for (const t of trades) {
      const r = computeR(t);
      if (r !== null) { rSum += r; rCount += 1; }
    }
    const rExpectancy = rCount > 0 ? rSum / rCount : null;
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
      expectancy,
      rExpectancy: rExpectancy,
      rTradeCount: rCount,
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

  const currentStreak = useMemo(() => {
    if (trades.length === 0) return { kind: 'none' as const, length: 0 };
    // sorted is already exit-date descending in the existing hook — use it
    const list = sorted; // already DESC by exitDate
    const firstPnL = computePnL(list[0]);
    if (firstPnL === 0) return { kind: 'none' as const, length: 0 };
    const kind: 'win' | 'loss' = firstPnL > 0 ? 'win' : 'loss';
    let length = 0;
    for (const t of list) {
      const p = computePnL(t);
      if ((kind === 'win' && p > 0) || (kind === 'loss' && p < 0)) length++;
      else break;
    }
    return { kind, length };
  }, [trades, sorted]);

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
    currentStreak,
  } as const;
}
