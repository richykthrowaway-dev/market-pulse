export interface PriceAlert {
  id: string;
  symbol: string;
  target: number;
  dir: 'above' | 'below';
}

export const STORAGE_KEY = 'dash-price-alerts-v1';

/** Self-healing parse: bad JSON / wrong shape → []. Pure, never throws. */
export function parseAlerts(raw: string | null): PriceAlert[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (a): a is PriceAlert =>
        !!a &&
        typeof a.id === 'string' &&
        typeof a.symbol === 'string' &&
        typeof a.target === 'number' &&
        Number.isFinite(a.target) &&
        (a.dir === 'above' || a.dir === 'below'),
    );
  } catch {
    return [];
  }
}

/** Alerts whose target has been crossed given current prices. Pure. */
export function evaluateAlerts(
  alerts: PriceAlert[],
  priceBySym: Record<string, number>,
): PriceAlert[] {
  const list = Array.isArray(alerts) ? alerts : [];
  return list.filter((a) => {
    const p = priceBySym?.[a.symbol.toUpperCase()];
    if (typeof p !== 'number' || !Number.isFinite(p)) return false;
    return a.dir === 'above' ? p >= a.target : p <= a.target;
  });
}
