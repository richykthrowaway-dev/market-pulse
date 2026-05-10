/**
 * affectedCommodities.ts — pure helper mapping geo-located events to
 * commodities that may be affected by what's happening in that country.
 *
 * Why this exists:
 *   The "alerts" story (e.g. "tell me about anything that could affect copper")
 *   needs a generic event → commodity mapping.  This file is the foundation:
 *   one function, no I/O, works for ANY event type that has an ISO-2 country
 *   code — conflict events (ACLED/GDELT), earthquakes (USGS), sanctions, etc.
 *
 * How it works:
 *   For each event's country, find every commodity whose top producer list
 *   includes that country.  Weight by the country's share of global supply
 *   so a copper event in Chile (#1, 23% share) ranks far above one in
 *   Kazakhstan (#7, 4% share).
 *
 *   This is intentionally a producer-side proxy — not a perfect causal model
 *   of "X event will move Y commodity" — but it's the right primitive for
 *   "show me events that could matter to commodity Y".
 */

import { COMMODITIES, type Commodity } from '@/data/tradeInfrastructure/commodities';

/* ─── Reverse index built once at module load ─────────────────────────── */
/** ISO-2 country code → list of commodities it produces, with the country's share. */
type CommodityHit = { commodity: Commodity; share: number; rank: number };

const COUNTRY_TO_COMMODITIES: Map<string, CommodityHit[]> = (() => {
  const m = new Map<string, CommodityHit[]>();
  for (const commodity of COMMODITIES) {
    commodity.producers.forEach((p, rank) => {
      const iso = p.iso2.toUpperCase();
      const arr = m.get(iso) ?? [];
      arr.push({ commodity, share: p.share, rank: rank + 1 });
      m.set(iso, arr);
    });
  }
  // Sort each country's hits by share desc — the most-impactful commodity first
  for (const arr of m.values()) arr.sort((a, b) => b.share - a.share);
  return m;
})();

/* ─── Public API ──────────────────────────────────────────────────────── */

export interface AffectedCommodity {
  commodity: Commodity;
  /** The country's share of that commodity's global production (0–100). */
  share: number;
  /** The country's rank within that commodity's top producers (1 = #1). */
  rank: number;
}

/**
 * Get every commodity that could plausibly be affected by an event in `iso2`.
 * Returns sorted by share (largest first) so the most-impactful are at the top.
 *
 * @param iso2 — ISO 3166-1 alpha-2 country code (case-insensitive)
 */
export function getAffectedCommodities(iso2: string): AffectedCommodity[] {
  if (!iso2) return [];
  return COUNTRY_TO_COMMODITIES.get(iso2.toUpperCase()) ?? [];
}

/**
 * Get the commodities affected, but only those where the country is meaningful
 * (top-3 producer or share > 5%) — useful for filtering noise from minor producers.
 */
export function getMaterialAffectedCommodities(
  iso2: string,
  opts: { minShare?: number; maxRank?: number } = {},
): AffectedCommodity[] {
  const minShare = opts.minShare ?? 5;
  const maxRank  = opts.maxRank  ?? 3;
  return getAffectedCommodities(iso2).filter(
    (a) => a.share >= minShare || a.rank <= maxRank,
  );
}

/**
 * Inverse lookup: for a given commodity, which countries appear in its
 * top producers?  Returns ISO-2 codes — useful for the alerts system
 * ("alert me about events in any country that produces copper").
 */
export function getCountriesForCommodity(commodityId: string): string[] {
  const c = COMMODITIES.find((c) => c.id === commodityId);
  return c ? c.producers.map((p) => p.iso2.toUpperCase()) : [];
}

/** Quick boolean check — does an event in this country affect this commodity? */
export function eventAffectsCommodity(
  eventIso2: string,
  commodityId: string,
): boolean {
  if (!eventIso2) return false;
  return getCountriesForCommodity(commodityId).includes(eventIso2.toUpperCase());
}
