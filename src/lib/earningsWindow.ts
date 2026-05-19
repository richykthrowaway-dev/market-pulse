export interface EarningsLite {
  ticker: string;
  daysUntil: number | null;
}

/**
 * Upcoming earnings within `horizon` days, soonest first, capped at `max`.
 * Pure, never throws.
 */
export function earningsWindow<T extends EarningsLite>(
  events: T[],
  horizon = 7,
  max = 5,
): { ticker: string; label: string }[] {
  const arr = Array.isArray(events) ? events : [];
  return arr
    .filter(
      (e) =>
        e &&
        typeof e.daysUntil === 'number' &&
        e.daysUntil >= 0 &&
        e.daysUntil <= horizon,
    )
    .sort((a, b) => (a.daysUntil as number) - (b.daysUntil as number))
    .slice(0, max)
    .map((e) => {
      const d = e.daysUntil as number;
      const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d}d`;
      return { ticker: e.ticker, label };
    });
}
