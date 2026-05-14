import { useCallback, useSyncExternalStore } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StrategyDoc {
  name: string;
  edge: string;
  entryCriteria: string;
  exitRules: string;
  riskManagement: string;
  positionSizing: string;
  marketConditions: string;
  avoidConditions: string;
  tradingHours: string;
  instruments: string;
  notes: string;
  updatedAt: string;  // ISO timestamp of last save
}

const DEFAULT_DOC: StrategyDoc = {
  name: '',
  edge: '',
  entryCriteria: '',
  exitRules: '',
  riskManagement: '',
  positionSizing: '',
  marketConditions: '',
  avoidConditions: '',
  tradingHours: '',
  instruments: '',
  notes: '',
  updatedAt: '',
};

// ── Storage keys ─────────────────────────────────────────────────────────────

const LS_KEY = 'trade-journal-strategy-v1';
const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'strategy';
const IDB_DOC = 'all';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
// Version 3 — adds the 'strategy' store to the shared journal database.
// All four hooks (useTradeJournal, useJournalSettings, useJournalScreenshots,
// useStrategyDoc) must agree on version=3 and create all four stores
// idempotently so whichever opens first wins the upgrade.

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades'))      db.createObjectStore('trades');
      if (!db.objectStoreNames.contains('settings'))    db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('screenshots')) db.createObjectStore('screenshots');
      if (!db.objectStoreNames.contains(IDB_STORE))    db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

async function idbRead(): Promise<StrategyDoc | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_DOC);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

function idbWrite(doc: StrategyDoc) {
  openIdb().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(doc, IDB_DOC);
  }).catch(() => {});
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsRead(): StrategyDoc {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_DOC;
    return { ...DEFAULT_DOC, ...JSON.parse(raw) };
  } catch { return DEFAULT_DOC; }
}

function lsWrite(doc: StrategyDoc) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch {}
}

// ── useSyncExternalStore plumbing ─────────────────────────────────────────────

const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function notify() { listeners.forEach(l => l()); }

let snapshot: StrategyDoc = lsRead();
function getSnapshot() { return snapshot; }

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) { snapshot = lsRead(); notify(); }
  });

  // IDB → LS hydration (same pattern as settings hook)
  idbRead().then(idb => {
    if (idb && JSON.stringify(idb) !== localStorage.getItem(LS_KEY)) {
      snapshot = { ...DEFAULT_DOC, ...idb };
      lsWrite(snapshot);
      notify();
    } else if (!idb && snapshot.updatedAt) {
      idbWrite(snapshot); // seed IDB on first run
    }
  });
}

function update(fn: (prev: StrategyDoc) => StrategyDoc) {
  const next = fn(snapshot);
  snapshot = next;
  lsWrite(next);
  idbWrite(next);
  notify();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStrategyDoc() {
  const doc = useSyncExternalStore(subscribe, getSnapshot);

  const saveDoc = useCallback((patch: Partial<Omit<StrategyDoc, 'updatedAt'>>) => {
    update(prev => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
  }, []);

  return { doc, saveDoc } as const;
}
