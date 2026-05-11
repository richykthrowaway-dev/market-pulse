/**
 * Per-commodity catalyst keyword map.
 *
 * For each commodity (matched by the `id` used by useCommodityPrices),
 * lists keywords we substring-match (case-insensitive) against the
 * `type` field of EODHD economic events to surface upcoming market-
 * moving releases.
 *
 * Strategy:
 *   - Bias toward false negatives over false positives — a missed
 *     event is better than a wrong one in the trader's face.
 *   - Keep the keyword lists short and uncommon enough that they
 *     won't match unrelated releases (e.g. "Sales" alone would
 *     match retail/manufacturing/auto/etc., useless).
 *   - Most catalysts that move commodities are US-released (FOMC,
 *     CPI, NFP, PCE, PPI, GDP), so the consumer hook fetches the
 *     US economic calendar.  Region-specific catalysts (China PMI
 *     for copper, ECB for euro-denominated golds) are a v2 expansion.
 */

import type { EodhdEconomicEvent } from '@/hooks/useEodhdEconomicEvents';

/** Universal macro catalysts that move ~all commodities (rates + inflation prints). */
const UNIVERSAL_MACRO = [
  'cpi', 'core cpi', 'pce', 'core pce', 'ppi',     // inflation
  'fomc', 'fed funds', 'federal funds',             // rate decision
  'nonfarm', 'nfp',                                 // jobs / labour
  'gdp',                                            // growth
];

/**
 * Keyword list per commodity id (matches useCommodityPrices `id`).
 * Match logic: lowercased event.type contains ANY keyword from the list.
 */
export const COMMODITY_CATALYSTS: Record<string, string[]> = {
  gold: [
    ...UNIVERSAL_MACRO,
    'real yield', 'treasury yield', 'ism manufacturing',
  ],
  silver: [
    ...UNIVERSAL_MACRO,
    'industrial production', 'ism manufacturing',
  ],
  palladium: [
    ...UNIVERSAL_MACRO,
    'auto sales', 'vehicle sales', 'industrial production',
  ],
  copper: [
    ...UNIVERSAL_MACRO,
    'ism manufacturing', 'manufacturing pmi', 'industrial production',
  ],
  crude_oil: [
    'fomc', 'fed funds', 'federal funds',
    'cpi',
    // Note: EODHD's economic calendar may not cover OPEC announcements
    // or EIA Crude Stocks reliably — these are weekly inventory releases
    // that appear sporadically.  Keyword tuned for what does appear.
    'crude oil inventories', 'crude stocks', 'eia crude',
    'manufacturing pmi', 'ism manufacturing',
  ],
  natural_gas: [
    'natural gas stocks', 'eia natural gas',
    'gdp',
  ],
  corn: [
    'wasde', 'crop production', 'grain stocks', 'planting intentions',
  ],
  wheat: [
    'wasde', 'crop production', 'grain stocks', 'planting intentions',
  ],
  soybeans: [
    'wasde', 'crop production', 'grain stocks', 'planting intentions',
    'oilseeds',
  ],
};

/** Default empty list — used for commodities not in the explicit map. */
const NO_CATALYSTS: string[] = [];

/**
 * Filter a list of economic events to those matching the given commodity's
 * catalyst keywords.  Returns events in chronological order, future-first
 * is the caller's responsibility (we sort ascending by date here).
 */
export function filterCatalystsForCommodity(
  events:      EodhdEconomicEvent[],
  commodityId: string,
  /** ISO timestamp threshold.  Only events with date >= this are kept. Defaults to now. */
  sinceUtc?:   Date,
): EodhdEconomicEvent[] {
  const keywords = COMMODITY_CATALYSTS[commodityId] ?? NO_CATALYSTS;
  if (keywords.length === 0) return [];
  const since = sinceUtc ?? new Date();

  return events
    .filter((e) => {
      // Parse EODHD date "YYYY-MM-DD HH:MM:SS" as UTC.
      const eventDate = new Date(e.date.replace(' ', 'T') + 'Z');
      if (isNaN(eventDate.getTime())) return false;
      if (eventDate.getTime() < since.getTime()) return false;
      const t = e.type.toLowerCase();
      return keywords.some((kw) => t.includes(kw));
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Map event.impact to a 1-3 stars count for display. */
export function impactStars(impact: EodhdEconomicEvent['impact']): number {
  if (impact === 'High')   return 3;
  if (impact === 'Medium') return 2;
  if (impact === 'Low')    return 1;
  return 1;
}
