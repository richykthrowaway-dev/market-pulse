/**
 * useManualPositions — localStorage-persisted lot-level manual holdings.
 *
 * Each "lot" is one purchase event: symbol, qty, cost-per-share, date, optional notes.
 * Positions (for the holdings table) are derived by grouping lots by symbol and computing
 * weighted-average cost + total shares.
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'manual-positions-v1';

export interface ManualLot {
  id: string;
  symbol: string;
  name: string;
  qty: number;
  costBasis: number;   // cost per share
  purchaseDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface ManualPosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  lots: ManualLot[];
}

function load(): ManualLot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ManualLot[];
  } catch {
    return [];
  }
}

function save(lots: ManualLot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function useManualPositions() {
  const [lots, setLots] = useState<ManualLot[]>(load);

  // Persist on every change
  useEffect(() => {
    save(lots);
  }, [lots]);

  const addLot = useCallback((lot: Omit<ManualLot, 'id'>) => {
    const newLot: ManualLot = {
      ...lot,
      id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    setLots((prev) => [...prev, newLot]);
  }, []);

  const removeLot = useCallback((id: string) => {
    setLots((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const updateLot = useCallback((id: string, changes: Partial<Omit<ManualLot, 'id'>>) => {
    setLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  }, []);

  /** Aggregate lots → positions (one per unique symbol) */
  const positions: ManualPosition[] = (() => {
    const map = new Map<string, ManualLot[]>();
    for (const lot of lots) {
      const sym = lot.symbol.trim().toUpperCase();
      if (!map.has(sym)) map.set(sym, []);
      map.get(sym)!.push(lot);
    }
    return Array.from(map.entries()).map(([symbol, symbolLots]) => {
      const totalShares = symbolLots.reduce((s, l) => s + l.qty, 0);
      const totalCost = symbolLots.reduce((s, l) => s + l.qty * l.costBasis, 0);
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
      const name = symbolLots[symbolLots.length - 1].name || symbol;
      return { symbol, name, shares: totalShares, avgCost, lots: symbolLots };
    });
  })();

  return { lots, positions, addLot, removeLot, updateLot };
}

/** Days between purchaseDate (YYYY-MM-DD) and today */
export function daysHeld(purchaseDate: string): number {
  try {
    const ms = Date.now() - new Date(purchaseDate).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  } catch {
    return 0;
  }
}

/** ST = held < 366 days; LT = held ≥ 366 days (US tax convention) */
export function holdingPeriod(purchaseDate: string): 'Short-Term' | 'Long-Term' | 'Unknown' {
  if (!purchaseDate) return 'Unknown';
  const d = daysHeld(purchaseDate);
  return d < 366 ? 'Short-Term' : 'Long-Term';
}
