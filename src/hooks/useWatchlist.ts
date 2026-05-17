import { useCallback, useSyncExternalStore } from 'react';

const LS_KEY = 'tp-watchlist-v1';

export function addSym(list: string[], raw: string): string[] {
  const s = raw.trim().toUpperCase();
  if (!s) return list;
  return list.some((x) => x.toUpperCase() === s) ? list : [...list, s];
}
export function removeSym(list: string[], raw: string): string[] {
  const s = raw.trim().toUpperCase();
  return list.filter((x) => x.toUpperCase() !== s);
}

function readLS(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const p = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function writeLS(next: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota */ }
}

let snapshot: string[] = readLS();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return snapshot; }
function update(fn: (p: string[]) => string[]) { snapshot = fn(snapshot); writeLS(snapshot); emit(); }

export function useWatchlist() {
  const symbols = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const add = useCallback((raw: string) => update((p) => addSym(p, raw)), []);
  const remove = useCallback((raw: string) => update((p) => removeSym(p, raw)), []);
  return { symbols, add, remove } as const;
}
