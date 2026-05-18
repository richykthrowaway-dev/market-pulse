import { useCallback, useSyncExternalStore } from 'react';
import type { TradeSide } from '@/hooks/useTradeJournal';
import { parseOpenTrades } from '@/lib/openTradesStore';

/**
 * useOpenTrades — the single shared store for *currently-open* positions.
 *
 * Closed trades live in `useTradeJournal` (the Journal's domain). Open
 * positions are a genuinely different lifecycle the Journal's TradeEntry
 * type can't represent (it requires an exit), so they get their own store.
 *
 * Both the My-Trading-Plan Trade Tracker (read/write) and the Journal's
 * read-only "Open Positions" view consume THIS hook — one source of truth,
 * no duplicated shape, no drift. A module-level snapshot + subscriber set
 * keeps every mounted consumer in sync within a session, the same pattern
 * useTradeJournal uses.
 */

export interface OpenTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  target?: number;
  entryDate: string;   // YYYY-MM-DD
  setup?: string;
  notes?: string;
  planValid: boolean;
}

const LS_KEY = 'tp-open-trades-v1';

let snapshot: OpenTrade[] = readLS();
const listeners = new Set<() => void>();

function readLS(): OpenTrade[] {
  if (typeof localStorage === 'undefined') return [];
  return parseOpenTrades(localStorage.getItem(LS_KEY));
}

function writeLS(next: OpenTrade[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota / private mode */ }
}

function emit() { listeners.forEach((l) => l()); }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    // storage events fire only in OTHER tabs (no echo loop). Adopt the
    // latest persisted state when this key (or all keys) changed.
    if (e.key === LS_KEY || e.key == null) {
      snapshot = readLS();
      emit();
    }
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): OpenTrade[] {
  return snapshot;
}

function update(fn: (prev: OpenTrade[]) => OpenTrade[]) {
  snapshot = fn(snapshot);
  writeLS(snapshot);
  emit();
}

export function useOpenTrades() {
  const trades = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addOpen = useCallback((t: OpenTrade) => {
    update((prev) => [t, ...prev]);
  }, []);

  const removeOpen = useCallback((id: string) => {
    update((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const patchOpen = useCallback((id: string, patch: Partial<OpenTrade>) => {
    update((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  return { trades, addOpen, removeOpen, patchOpen } as const;
}
