import { useCallback, useSyncExternalStore } from 'react';

export interface JournalSettings {
  setups: string[];
  mistakes: string[];
  accountSize?: number;
  goals: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    dailyMaxLoss?: number;
  };
}

const DEFAULT_SETTINGS: JournalSettings = {
  setups: ['Breakout', 'Pullback', 'Mean Reversion', 'Gap Fill'],
  mistakes: ['FOMO', 'Moved stop', 'Oversized', 'No setup', 'Revenge trade'],
  goals: {},
};

const LS_KEY = 'trade-journal-settings-v1';
const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'settings';
const IDB_DOC = 'all';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3); // v3 adds strategy store
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades'))      db.createObjectStore('trades');
      if (!db.objectStoreNames.contains(IDB_STORE))    db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains('screenshots')) db.createObjectStore('screenshots');
      if (!db.objectStoreNames.contains('strategy'))    db.createObjectStore('strategy');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRead(): Promise<JournalSettings | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_DOC);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

function idbWrite(s: JournalSettings) {
  openIdb().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(s, IDB_DOC);
  }).catch(() => {});
}

function lsRead(): JournalSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
}

function lsWrite(s: JournalSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function notify() { listeners.forEach(l => l()); }

let snapshot: JournalSettings = lsRead();
function getSnapshot() { return snapshot; }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) { snapshot = lsRead(); notify(); }
  });
  idbRead().then(idb => {
    if (idb && JSON.stringify(idb) !== localStorage.getItem(LS_KEY)) {
      snapshot = { ...DEFAULT_SETTINGS, ...idb };
      lsWrite(snapshot);
      notify();
    } else if (!idb) {
      idbWrite(snapshot); // seed IDB on first run
    }
  });
}

function update(fn: (prev: JournalSettings) => JournalSettings) {
  const next = fn(snapshot);
  snapshot = next;
  lsWrite(next);
  idbWrite(next);
  notify();
}

export function useJournalSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const setSettings = useCallback((patch: Partial<JournalSettings>) => {
    update(prev => ({ ...prev, ...patch }));
  }, []);

  const addSetup = useCallback((name: string) => {
    update(prev => prev.setups.includes(name) ? prev : { ...prev, setups: [...prev.setups, name] });
  }, []);

  const addMistake = useCallback((name: string) => {
    update(prev => prev.mistakes.includes(name) ? prev : { ...prev, mistakes: [...prev.mistakes, name] });
  }, []);

  return { settings, setSettings, addSetup, addMistake } as const;
}
