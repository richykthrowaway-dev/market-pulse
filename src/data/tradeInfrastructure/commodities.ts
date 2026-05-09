/**
 * commodities.ts — top global producers per commodity, country-level.
 *
 * Hand-curated from public sources (USGS Mineral Commodity Summaries 2024,
 * EIA Annual Energy Outlook 2023, IEA, USDA FAS PSD, FAOSTAT, ICO).  Data
 * is intentionally static: production shares change slowly year-to-year
 * and a static dataset means the card loads instantly with no network.
 *
 * Each commodity lists the top 8 producers by share of global output.
 * Shares are absolute (not normalised to top 8) — they describe each
 * country's slice of the *global* total, so summing top 8 will be < 100.
 * Bar widths in the UI are scaled relative to the LARGEST share in the
 * commodity, not to 100, so the visual ranks read clearly without the
 * top bar always pegged to ~12-15 %.
 *
 * To update: replace the producers array with the latest agency figures
 * and bump the `year` field.  No code changes needed.
 */

export type CommodityCategory = 'energy' | 'metals' | 'agriculture';

export interface CommodityProducer {
  /** ISO-3166-1 alpha-2 country code, lowercase or uppercase tolerated. */
  iso2:  string;
  /** Percent of global production (0–100). */
  share: number;
}

export interface Commodity {
  /** URL-safe id used as Select value. */
  id:        string;
  label:     string;
  category:  CommodityCategory;
  /** Production unit displayed in the footer caption (e.g. "Mbpd"). */
  unit:      string;
  /** Source agency, displayed as attribution. */
  source:    string;
  /** Year the figures correspond to. */
  year:      number;
  /** Top producers, pre-sorted descending by share. Up to 8. */
  producers: CommodityProducer[];
}

export const COMMODITIES: readonly Commodity[] = [
  // ── ENERGY ─────────────────────────────────────────────────────────────
  {
    id:       'crude-oil',
    label:    'Crude Oil',
    category: 'energy',
    unit:     'Mbpd',
    source:   'EIA',
    year:     2023,
    producers: [
      { iso2: 'US', share: 19.4 },
      { iso2: 'SA', share: 11.4 },
      { iso2: 'RU', share: 10.7 },
      { iso2: 'CA', share:  5.8 },
      { iso2: 'CN', share:  5.2 },
      { iso2: 'IQ', share:  4.6 },
      { iso2: 'IR', share:  4.5 },
      { iso2: 'AE', share:  4.0 },
    ],
  },
  {
    id:       'natural-gas',
    label:    'Natural Gas',
    category: 'energy',
    unit:     'Bcm',
    source:   'IEA',
    year:     2023,
    producers: [
      { iso2: 'US', share: 25.5 },
      { iso2: 'RU', share: 14.4 },
      { iso2: 'IR', share:  6.4 },
      { iso2: 'CN', share:  5.6 },
      { iso2: 'CA', share:  4.4 },
      { iso2: 'QA', share:  4.3 },
      { iso2: 'AU', share:  3.7 },
      { iso2: 'NO', share:  2.9 },
    ],
  },
  {
    id:       'coal',
    label:    'Coal',
    category: 'energy',
    unit:     'Mt',
    source:   'IEA',
    year:     2023,
    producers: [
      { iso2: 'CN', share: 50.5 },
      { iso2: 'IN', share: 11.0 },
      { iso2: 'ID', share:  9.2 },
      { iso2: 'US', share:  6.0 },
      { iso2: 'AU', share:  5.4 },
      { iso2: 'RU', share:  5.0 },
      { iso2: 'ZA', share:  3.0 },
      { iso2: 'KZ', share:  1.4 },
    ],
  },
  // ── METALS ─────────────────────────────────────────────────────────────
  {
    id:       'iron-ore',
    label:    'Iron Ore',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    producers: [
      { iso2: 'AU', share: 36.0 },
      { iso2: 'BR', share: 17.0 },
      { iso2: 'CN', share: 11.0 },
      { iso2: 'IN', share:  9.5 },
      { iso2: 'RU', share:  3.7 },
      { iso2: 'IR', share:  2.3 },
      { iso2: 'CA', share:  2.3 },
      { iso2: 'ZA', share:  2.0 },
    ],
  },
  {
    id:       'copper',
    label:    'Copper',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    producers: [
      { iso2: 'CL', share: 23.0 },
      { iso2: 'PE', share: 12.0 },
      { iso2: 'CD', share: 11.0 },
      { iso2: 'CN', share:  8.0 },
      { iso2: 'US', share:  5.0 },
      { iso2: 'RU', share:  4.5 },
      { iso2: 'AU', share:  4.0 },
      { iso2: 'ZM', share:  3.5 },
    ],
  },
  {
    id:       'gold',
    label:    'Gold',
    category: 'metals',
    unit:     't',
    source:   'USGS',
    year:     2023,
    producers: [
      { iso2: 'CN', share: 10.0 },
      { iso2: 'AU', share:  9.5 },
      { iso2: 'RU', share:  9.5 },
      { iso2: 'CA', share:  6.5 },
      { iso2: 'US', share:  5.5 },
      { iso2: 'GH', share:  4.5 },
      { iso2: 'PE', share:  4.0 },
      { iso2: 'MX', share:  4.0 },
    ],
  },
  {
    id:       'lithium',
    label:    'Lithium',
    category: 'metals',
    unit:     'kt LCE',
    source:   'USGS',
    year:     2023,
    producers: [
      { iso2: 'AU', share: 47.0 },
      { iso2: 'CL', share: 26.0 },
      { iso2: 'CN', share: 17.0 },
      { iso2: 'AR', share:  5.0 },
      { iso2: 'BR', share:  2.0 },
      { iso2: 'ZW', share:  1.5 },
      { iso2: 'PT', share:  0.4 },
      { iso2: 'US', share:  0.3 },
    ],
  },
  {
    id:       'cobalt',
    label:    'Cobalt',
    category: 'metals',
    unit:     'kt',
    source:   'USGS',
    year:     2023,
    producers: [
      { iso2: 'CD', share: 73.0 },
      { iso2: 'ID', share:  6.5 },
      { iso2: 'RU', share:  5.0 },
      { iso2: 'AU', share:  3.0 },
      { iso2: 'PH', share:  2.5 },
      { iso2: 'CA', share:  2.0 },
      { iso2: 'CU', share:  1.6 },
      { iso2: 'MG', share:  1.4 },
    ],
  },
  // ── AGRICULTURE ────────────────────────────────────────────────────────
  {
    id:       'wheat',
    label:    'Wheat',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    producers: [
      { iso2: 'CN', share: 17.5 },
      { iso2: 'IN', share: 14.0 },
      { iso2: 'RU', share: 11.0 },
      { iso2: 'US', share:  6.5 },
      { iso2: 'FR', share:  4.5 },
      { iso2: 'AU', share:  3.5 },
      { iso2: 'CA', share:  4.5 },
      { iso2: 'PK', share:  3.5 },
    ],
  },
  {
    id:       'corn',
    label:    'Corn (Maize)',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    producers: [
      { iso2: 'US', share: 31.0 },
      { iso2: 'CN', share: 23.0 },
      { iso2: 'BR', share: 11.0 },
      { iso2: 'AR', share:  4.5 },
      { iso2: 'IN', share:  3.5 },
      { iso2: 'UA', share:  2.5 },
      { iso2: 'MX', share:  2.5 },
      { iso2: 'ID', share:  2.0 },
    ],
  },
  {
    id:       'soybeans',
    label:    'Soybeans',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    producers: [
      { iso2: 'BR', share: 38.0 },
      { iso2: 'US', share: 28.0 },
      { iso2: 'AR', share:  9.0 },
      { iso2: 'CN', share:  5.0 },
      { iso2: 'IN', share:  3.5 },
      { iso2: 'PY', share:  3.0 },
      { iso2: 'CA', share:  2.0 },
      { iso2: 'RU', share:  1.5 },
    ],
  },
  {
    id:       'coffee',
    label:    'Coffee',
    category: 'agriculture',
    unit:     '1000 bags',
    source:   'ICO',
    year:     2023,
    producers: [
      { iso2: 'BR', share: 35.0 },
      { iso2: 'VN', share: 18.5 },
      { iso2: 'CO', share:  7.0 },
      { iso2: 'ID', share:  6.5 },
      { iso2: 'ET', share:  4.5 },
      { iso2: 'HN', share:  3.0 },
      { iso2: 'IN', share:  3.0 },
      { iso2: 'UG', share:  3.0 },
    ],
  },
] as const;

/** id → Commodity index, built once at module load. */
const COMMODITY_BY_ID: Map<string, Commodity> = new Map(
  COMMODITIES.map((c) => [c.id, c]),
);

export function getCommodity(id: string): Commodity | undefined {
  return COMMODITY_BY_ID.get(id);
}

/** Display labels for category groups in the dropdown. */
export const CATEGORY_LABELS: Record<CommodityCategory, string> = {
  energy:      'Energy',
  metals:      'Metals & Minerals',
  agriculture: 'Agriculture',
};

/** Display order — energy first, then metals, then agriculture. */
export const CATEGORY_ORDER: readonly CommodityCategory[] = [
  'energy', 'metals', 'agriculture',
] as const;
