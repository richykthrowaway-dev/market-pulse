import { useState, useCallback } from 'react';

const STORAGE_KEY = 'portfolio-sort-linked';

export type SharedSortCol = 'name' | 'value' | 'weight' | 'count' | 'sector' | 'country' | 'marketCap';
export type SharedSortState = { col: SharedSortCol; asc: boolean };

export function useLinkedSort() {
  const [isLinked, setIsLinked] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [sharedSort, setSharedSort] = useState<SharedSortState>({ col: 'value', asc: false });

  const toggleLinked = useCallback(() => {
    setIsLinked((prev) => {
      const next = !prev;
      try { sessionStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  return { isLinked, toggleLinked, sharedSort, setSharedSort };
}

/* ─── Column mapping helpers ─── */

// AllocationExplorer sort columns → shared columns
export function allocColToShared(col: string): SharedSortCol {
  switch (col) {
    case 'group': return 'name';
    case 'weightPct': return 'weight';
    case 'holdingCount': return 'count';
    default: return 'value';
  }
}

export function sharedToAllocCol(col: SharedSortCol): string {
  switch (col) {
    case 'name': return 'group';
    case 'weight': return 'weightPct';
    case 'count': return 'holdingCount';
    default: return 'weightPct';
  }
}

// Holdings sort columns → shared columns
export function holdingsColToShared(col: string): SharedSortCol {
  switch (col) {
    case 'ticker': return 'name';
    case 'shares': return 'count';
    case 'cost': return 'value';
    case 'marketValue': return 'value';
    case 'pl': return 'value';
    case 'sector': return 'sector';
    case 'country': return 'country';
    case 'marketCap': return 'marketCap';
    default: return 'value';
  }
}

export function sharedToHoldingsCol(col: SharedSortCol): string {
  switch (col) {
    case 'name': return 'ticker';
    case 'count': return 'shares';
    case 'weight': return 'marketValue';
    case 'value': return 'marketValue';
    case 'sector': return 'sector';
    case 'country': return 'country';
    case 'marketCap': return 'marketCap';
    default: return 'marketValue';
  }
}
