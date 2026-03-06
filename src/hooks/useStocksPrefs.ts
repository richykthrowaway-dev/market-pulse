import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'stocks-prefs-v1';

interface StocksPrefs {
  hiddenSymbols: string[];
  /** Serialisable subset of pinned external stocks (symbol + exchange + name) so
   *  the EODHD hook can re-fetch on mount. Full bar data is NOT persisted. */
  pinnedStocks: Array<{ symbol: string; exchange: string; name?: string }>;
}

const DEFAULT: StocksPrefs = { hiddenSymbols: [], pinnedStocks: [] };

function read(): StocksPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function write(prefs: StocksPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* storage full */ }
  // Notify all subscribers
  listeners.forEach(l => l());
}

// --- External store plumbing so React re-renders on changes ---
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

let snapshot = read();
function getSnapshot() { return snapshot; }

// Re-read on storage events from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      snapshot = read();
      listeners.forEach(l => l());
    }
  });
}

function update(fn: (prev: StocksPrefs) => StocksPrefs) {
  const next = fn(read());
  snapshot = next;
  write(next);
}

/**
 * Persistent preferences for the Stocks page.
 * Survives navigation and page reloads via localStorage.
 */
export function useStocksPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot);

  const hideSymbol = useCallback((symbol: string) => {
    update(p => ({
      ...p,
      hiddenSymbols: p.hiddenSymbols.includes(symbol) ? p.hiddenSymbols : [...p.hiddenSymbols, symbol],
    }));
  }, []);

  const unhideSymbol = useCallback((symbol: string) => {
    update(p => ({
      ...p,
      hiddenSymbols: p.hiddenSymbols.filter(s => s !== symbol),
    }));
  }, []);

  const pinStock = useCallback((symbol: string, exchange: string, name?: string) => {
    update(p => {
      // Don't duplicate
      if (p.pinnedStocks.some(ps => ps.symbol === symbol && ps.exchange === exchange)) return p;
      return { ...p, pinnedStocks: [...p.pinnedStocks, { symbol, exchange, name }] };
    });
  }, []);

  const unpinStock = useCallback((symbol: string, exchange?: string) => {
    update(p => ({
      ...p,
      pinnedStocks: p.pinnedStocks.filter(ps =>
        exchange ? !(ps.symbol === symbol && ps.exchange === exchange) : ps.symbol !== symbol
      ),
    }));
  }, []);

  return {
    hiddenSymbols: prefs.hiddenSymbols,
    pinnedStocks: prefs.pinnedStocks,
    hideSymbol,
    unhideSymbol,
    pinStock,
    unpinStock,
  } as const;
}
