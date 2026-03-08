import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'watchlists-v1';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  symbol: string;
  exchange: string;
  name?: string;
  addedAt: string; // ISO timestamp
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
  createdAt: string;
}

interface WatchlistsState {
  lists: Watchlist[];
  activeId: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_LIST: Watchlist = {
  id: 'default',
  name: 'My Watchlist',
  entries: [],
  createdAt: new Date().toISOString(),
};

const DEFAULT: WatchlistsState = {
  lists: [DEFAULT_LIST],
  activeId: 'default',
};

function read(): WatchlistsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<WatchlistsState>;
    const lists = parsed.lists ?? [];
    // Guarantee at least one list always exists
    if (lists.length === 0) {
      const fallback = { ...DEFAULT_LIST, id: makeId(), createdAt: new Date().toISOString() };
      return { lists: [fallback], activeId: fallback.id };
    }
    const activeId = parsed.activeId && lists.some(l => l.id === parsed.activeId)
      ? parsed.activeId
      : lists[0].id;
    return { lists, activeId };
  } catch {
    return DEFAULT;
  }
}

function write(state: WatchlistsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage full */ }
  listeners.forEach(l => l());
}

// ── External store (cross-component reactivity) ───────────────────────────────

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

function update(fn: (prev: WatchlistsState) => WatchlistsState) {
  const next = fn(read());
  snapshot = next;
  write(next);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWatchlists() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  /** Create a new watchlist and make it active. Returns the new list's id. */
  const createList = useCallback((name: string): string => {
    const id = makeId();
    update(s => ({
      lists: [...s.lists, { id, name: name.trim() || 'New Watchlist', entries: [], createdAt: new Date().toISOString() }],
      activeId: id,
    }));
    return id;
  }, []);

  /** Rename an existing watchlist. */
  const renameList = useCallback((id: string, name: string) => {
    update(s => ({
      ...s,
      lists: s.lists.map(l => l.id === id ? { ...l, name: name.trim() || l.name } : l),
    }));
  }, []);

  /** Delete a watchlist. Selects an adjacent list automatically. */
  const deleteList = useCallback((id: string) => {
    update(s => {
      const newLists = s.lists.filter(l => l.id !== id);
      if (newLists.length === 0) {
        const fallback = { ...DEFAULT_LIST, id: makeId(), createdAt: new Date().toISOString() };
        return { lists: [fallback], activeId: fallback.id };
      }
      const newActiveId = s.activeId === id ? newLists[0].id : s.activeId;
      return { lists: newLists, activeId: newActiveId };
    });
  }, []);

  /** Switch which watchlist is currently viewed. */
  const setActive = useCallback((id: string) => {
    update(s => ({ ...s, activeId: id }));
  }, []);

  /** Add a stock entry to a watchlist. Silently ignores duplicates. */
  const addEntry = useCallback((listId: string, entry: Omit<WatchlistEntry, 'addedAt'>) => {
    update(s => ({
      ...s,
      lists: s.lists.map(l => {
        if (l.id !== listId) return l;
        const already = l.entries.some(
          e => e.symbol.toUpperCase() === entry.symbol.toUpperCase() && e.exchange === entry.exchange,
        );
        if (already) return l;
        return { ...l, entries: [...l.entries, { ...entry, addedAt: new Date().toISOString() }] };
      }),
    }));
  }, []);

  /** Remove a stock entry from a watchlist. */
  const removeEntry = useCallback((listId: string, symbol: string, exchange: string) => {
    update(s => ({
      ...s,
      lists: s.lists.map(l => {
        if (l.id !== listId) return l;
        return {
          ...l,
          entries: l.entries.filter(
            e => !(e.symbol.toUpperCase() === symbol.toUpperCase() && e.exchange === exchange),
          ),
        };
      }),
    }));
  }, []);

  /** Move a stock from one watchlist to another. */
  const moveEntry = useCallback((fromId: string, toId: string, symbol: string, exchange: string) => {
    update(s => {
      let moved: WatchlistEntry | null = null;
      const lists = s.lists.map(l => {
        if (l.id === fromId) {
          const entry = l.entries.find(e => e.symbol === symbol && e.exchange === exchange);
          if (entry) moved = entry;
          return { ...l, entries: l.entries.filter(e => !(e.symbol === symbol && e.exchange === exchange)) };
        }
        return l;
      });
      if (!moved) return s;
      const capturedMoved = moved as WatchlistEntry;
      return {
        ...s,
        lists: lists.map(l => {
          if (l.id !== toId) return l;
          const already = l.entries.some(e => e.symbol === capturedMoved.symbol && e.exchange === capturedMoved.exchange);
          if (already) return l;
          return { ...l, entries: [...l.entries, { ...capturedMoved, addedAt: new Date().toISOString() }] };
        }),
      };
    });
  }, []);

  const activeList = state.lists.find(l => l.id === state.activeId) ?? state.lists[0] ?? null;

  return {
    lists: state.lists,
    activeId: state.activeId,
    activeList,
    createList,
    renameList,
    deleteList,
    setActive,
    addEntry,
    removeEntry,
    moveEntry,
  } as const;
}
