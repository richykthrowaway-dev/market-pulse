import { useCallback, useSyncExternalStore } from 'react';

const LS_KEY = 'tt-live-speed-v1';

function readLS(): boolean {
  try { return localStorage.getItem(LS_KEY) === 'fast'; } catch { return false; }
}
function writeLS(fast: boolean) {
  try { localStorage.setItem(LS_KEY, fast ? 'fast' : 'slow'); } catch { /* quota */ }
}

let snapshot: boolean = readLS();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return snapshot; }
function update(fast: boolean) { snapshot = fast; writeLS(fast); emit(); }

/**
 * Shared live-quote refresh speed (fast = 5s, slow = 30s). Backed by a single
 * external store so every mounted consumer (Watchlist, Trade Tracker) toggles
 * and re-renders together. Persisted to localStorage `tt-live-speed-v1`.
 */
export function useLiveSpeed() {
  const fast = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setFast = useCallback((f: boolean) => update(f), []);
  const intervalMs = fast ? 5_000 : 30_000;
  return { fast, setFast, intervalMs } as const;
}
