/**
 * commodities.ts — top global producers per commodity, country-level.
 *
 * Hand-curated from public sources (USGS Mineral Commodity Summaries 2024,
 * EIA Annual Energy Outlook 2023, IEA, USDA FAS PSD, FAOSTAT, ICO, ICCO,
 * WNA, ANRPC).  Data is intentionally static: production shares change slowly
 * year-to-year and a static dataset means the card loads instantly with no
 * network.
 *
 * Each commodity lists the top 8 producers by share of global output.
 * Shares are absolute (not normalised to top 8) — they describe each
 * country's slice of the *global* total, so summing top 8 will be < 100.
 * Bar widths in the UI are scaled relative to the LARGEST share in the
 * commodity, not to 100, so the visual ranks read clearly.
 *
 * To update: replace the producers array with the latest agency figures
 * and bump the `year` field.  No code changes needed.
 */

export type CommodityCategory = 'energy' | 'metals' | 'agriculture';

export interface CommodityProducer {
  /** ISO-3166-1 alpha-2 country code, uppercase. */
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
  /** One-line description of what the commodity is used for. */
  useCase:   string;
  /** Top producers, pre-sorted descending by share. Up to 8. */
  producers: CommodityProducer[];
}

export const COMMODITIES: readonly Commodity[] = [
  // ── ENERGY ─────────────────────────────────────────────────────────────
  {
    id:       'crude-oil',
    label:    'Crude Oil',
    category: 'energy',
    unit:     'Mbpd (total liquids)',
    source:   'EIA',
    year:     2023,
    useCase:  'Refined into gasoline, diesel, jet fuel, and petrochemical feedstocks.',
    producers: [
      { iso2: 'US', share: 22.0 },
      { iso2: 'SA', share:  9.5 },
      { iso2: 'RU', share:  9.5 },
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
    useCase:  'Power generation, heating, fertilizer feedstock, and LNG export.',
    producers: [
      { iso2: 'US', share: 25.5 },
      { iso2: 'RU', share: 14.4 },
      { iso2: 'IR', share:  6.4 },
      { iso2: 'CN', share:  6.0 },
      { iso2: 'CA', share:  4.8 },
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
    useCase:  'Electricity generation and steelmaking (metallurgical coal).',
    producers: [
      { iso2: 'CN', share: 51.5 },
      { iso2: 'IN', share: 11.5 },
      { iso2: 'ID', share:  7.7 },
      { iso2: 'US', share:  6.0 },
      { iso2: 'AU', share:  5.0 },
      { iso2: 'RU', share:  4.8 },
      { iso2: 'ZA', share:  3.0 },
      { iso2: 'KZ', share:  1.4 },
    ],
  },
  {
    id:       'uranium',
    label:    'Uranium',
    category: 'energy',
    unit:     'tU',
    source:   'WNA',
    year:     2023,
    useCase:  'Fuel for nuclear power reactors; enriched for civilian and defense use.',
    producers: [
      { iso2: 'KZ', share: 39.0 },
      { iso2: 'CA', share: 24.0 },
      { iso2: 'NA', share: 12.0 },
      { iso2: 'AU', share: 10.0 },
      { iso2: 'UZ', share:  5.5 },
      { iso2: 'RU', share:  5.0 },
      { iso2: 'CN', share:  4.0 },
      { iso2: 'NE', share:  4.0 },
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
    useCase:  'Smelted into steel — backbone of construction, machinery, and infrastructure.',
    producers: [
      { iso2: 'AU', share: 38.0 },
      { iso2: 'BR', share: 17.0 },
      { iso2: 'CN', share: 11.0 },
      { iso2: 'IN', share:  8.0 },
      { iso2: 'RU', share:  3.6 },
      { iso2: 'CA', share:  2.3 },
      { iso2: 'IR', share:  2.3 },
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
    useCase:  'Electrical wiring, plumbing, EVs, and renewable energy infrastructure.',
    producers: [
      { iso2: 'CL', share: 23.0 },
      { iso2: 'CD', share: 12.5 },
      { iso2: 'PE', share: 11.5 },
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
    useCase:  'Jewelry, central bank reserves, electronics, and inflation hedge.',
    producers: [
      { iso2: 'CN', share: 12.0 },
      { iso2: 'AU', share:  9.5 },
      { iso2: 'RU', share:  9.5 },
      { iso2: 'CA', share:  6.5 },
      { iso2: 'US', share:  5.5 },
      { iso2: 'GH', share:  4.5 },
      { iso2: 'MX', share:  4.0 },
      { iso2: 'PE', share:  4.0 },
    ],
  },
  {
    id:       'silver',
    label:    'Silver',
    category: 'metals',
    unit:     'kt',
    source:   'USGS',
    year:     2023,
    useCase:  'Solar panels, electronics, EV contacts; investment and jewelry.',
    producers: [
      { iso2: 'MX', share: 23.0 },
      { iso2: 'CN', share: 14.0 },
      { iso2: 'PE', share: 13.0 },
      { iso2: 'CL', share:  6.3 },
      { iso2: 'BO', share:  5.1 },
      { iso2: 'PL', share:  5.1 },
      { iso2: 'RU', share:  4.8 },
      { iso2: 'AU', share:  4.1 },
    ],
  },
  {
    id:       'aluminum',
    label:    'Aluminum',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    useCase:  'Aircraft, automotive bodies, packaging, and construction.',
    producers: [
      { iso2: 'CN', share: 61.0 },
      { iso2: 'IN', share:  6.0 },
      { iso2: 'RU', share:  5.0 },
      { iso2: 'CA', share:  4.5 },
      { iso2: 'AE', share:  4.0 },
      { iso2: 'AU', share:  2.5 },
      { iso2: 'BH', share:  2.3 },
      { iso2: 'NO', share:  2.0 },
    ],
  },
  {
    id:       'nickel',
    label:    'Nickel',
    category: 'metals',
    unit:     'kt',
    source:   'USGS',
    year:     2023,
    useCase:  'Stainless steel and EV battery cathodes (NMC, NCA chemistries).',
    producers: [
      { iso2: 'ID', share: 48.0 },
      { iso2: 'PH', share: 11.0 },
      { iso2: 'NC', share:  6.4 },
      { iso2: 'RU', share:  6.0 },
      { iso2: 'AU', share:  5.0 },
      { iso2: 'CN', share:  4.0 },
      { iso2: 'CA', share:  4.0 },
      { iso2: 'BR', share:  3.0 },
    ],
  },
  {
    id:       'zinc',
    label:    'Zinc',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    useCase:  'Galvanizing steel against corrosion; brass alloys; die-casting.',
    producers: [
      { iso2: 'CN', share: 27.0 },
      { iso2: 'PE', share: 12.3 },
      { iso2: 'AU', share:  9.1 },
      { iso2: 'IN', share:  7.1 },
      { iso2: 'US', share:  6.3 },
      { iso2: 'MX', share:  5.0 },
      { iso2: 'BO', share:  4.0 },
      { iso2: 'KZ', share:  2.9 },
    ],
  },
  {
    id:       'tin',
    label:    'Tin',
    category: 'metals',
    unit:     'kt',
    source:   'USGS',
    year:     2023,
    useCase:  'Solder for electronics, food cans (tinplate), and chemicals.',
    producers: [
      { iso2: 'CN', share: 23.0 },
      { iso2: 'ID', share: 22.6 },
      { iso2: 'MM', share: 11.1 },
      { iso2: 'PE', share:  8.5 },
      { iso2: 'CD', share:  6.6 },
      { iso2: 'BR', share:  5.9 },
      { iso2: 'BO', share:  3.0 },
      { iso2: 'RU', share:  2.0 },
    ],
  },
  {
    id:       'lithium',
    label:    'Lithium',
    category: 'metals',
    unit:     'kt LCE',
    source:   'USGS',
    year:     2023,
    useCase:  'EV batteries, grid storage, smartphones, ceramics, and glass.',
    producers: [
      { iso2: 'AU', share: 50.0 },
      { iso2: 'CL', share: 24.0 },
      { iso2: 'CN', share: 19.0 },
      { iso2: 'AR', share:  3.5 },
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
    useCase:  'Lithium-ion battery cathodes; superalloys for jet engines.',
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
  {
    id:       'platinum',
    label:    'Platinum',
    category: 'metals',
    unit:     't',
    source:   'USGS',
    year:     2023,
    useCase:  'Catalytic converters, jewelry, and hydrogen fuel cell electrodes.',
    producers: [
      { iso2: 'ZA', share: 67.0 },
      { iso2: 'RU', share: 12.8 },
      { iso2: 'ZW', share: 10.5 },
      { iso2: 'CA', share:  3.1 },
      { iso2: 'US', share:  1.6 },
      { iso2: 'FI', share:  1.0 },
      { iso2: 'AU', share:  1.0 },
      { iso2: 'CN', share:  0.5 },
    ],
  },
  {
    id:       'palladium',
    label:    'Palladium',
    category: 'metals',
    unit:     't',
    source:   'USGS',
    year:     2023,
    useCase:  'Catalytic converters (gasoline engines), electronics, and dentistry.',
    producers: [
      { iso2: 'RU', share: 42.0 },
      { iso2: 'ZA', share: 36.0 },
      { iso2: 'CA', share:  7.5 },
      { iso2: 'ZW', share:  7.0 },
      { iso2: 'US', share:  5.0 },
      { iso2: 'AU', share:  1.0 },
      { iso2: 'FI', share:  1.0 },
      { iso2: 'CN', share:  1.0 },
    ],
  },
  {
    id:       'manganese',
    label:    'Manganese',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    useCase:  'Steel hardening; lithium-ion battery cathodes (LMO, NMC).',
    producers: [
      { iso2: 'ZA', share: 36.0 },
      { iso2: 'GA', share: 23.0 },
      { iso2: 'AU', share: 15.0 },
      { iso2: 'CN', share: 11.0 },
      { iso2: 'IN', share:  4.0 },
      { iso2: 'GH', share:  4.0 },
      { iso2: 'BR', share:  3.0 },
      { iso2: 'UA', share:  2.0 },
    ],
  },
  {
    id:       'potash',
    label:    'Potash',
    category: 'metals',
    unit:     'Mt K₂O',
    source:   'USGS',
    year:     2023,
    useCase:  'Potassium fertilizer for agriculture — essential for crop yields.',
    producers: [
      { iso2: 'CA', share: 33.0 },
      { iso2: 'RU', share: 17.0 },
      { iso2: 'CN', share: 15.0 },
      { iso2: 'BY', share:  7.5 },
      { iso2: 'DE', share:  7.0 },
      { iso2: 'IL', share:  4.0 },
      { iso2: 'JO', share:  3.0 },
      { iso2: 'CL', share:  2.0 },
    ],
  },
  {
    id:       'phosphate',
    label:    'Phosphate Rock',
    category: 'metals',
    unit:     'Mt',
    source:   'USGS',
    year:     2023,
    useCase:  'Phosphorus fertilizer for agriculture; food additives and detergents.',
    producers: [
      { iso2: 'CN', share: 39.0 },
      { iso2: 'MA', share: 15.0 },
      { iso2: 'US', share:  8.7 },
      { iso2: 'RU', share:  6.0 },
      { iso2: 'JO', share:  5.0 },
      { iso2: 'SA', share:  3.7 },
      { iso2: 'EG', share:  2.1 },
      { iso2: 'SN', share:  2.0 },
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
    useCase:  'Bread, pasta, noodles, baked goods — staple grain for ~35% of humanity.',
    producers: [
      { iso2: 'CN', share: 17.5 },
      { iso2: 'IN', share: 14.0 },
      { iso2: 'RU', share: 11.0 },
      { iso2: 'US', share:  6.1 },
      { iso2: 'FR', share:  4.6 },
      { iso2: 'CA', share:  4.3 },
      { iso2: 'AU', share:  3.5 },
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
    useCase:  'Animal feed (60%), ethanol biofuel, food, sweeteners, and starch.',
    producers: [
      { iso2: 'US', share: 35.0 },
      { iso2: 'CN', share: 23.0 },
      { iso2: 'BR', share: 11.0 },
      { iso2: 'IN', share:  3.0 },
      { iso2: 'AR', share:  3.3 },
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
    useCase:  'Animal feed protein, vegetable oil, biodiesel, tofu, and soy sauce.',
    producers: [
      { iso2: 'BR', share: 41.0 },
      { iso2: 'US', share: 28.0 },
      { iso2: 'AR', share: 12.0 },
      { iso2: 'CN', share:  5.0 },
      { iso2: 'IN', share:  3.5 },
      { iso2: 'PY', share:  2.0 },
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
    useCase:  'Daily ritual for ~2 billion drinkers; among the most-traded soft commodities.',
    producers: [
      { iso2: 'BR', share: 35.0 },
      { iso2: 'VN', share: 15.5 },
      { iso2: 'CO', share:  7.0 },
      { iso2: 'ET', share:  6.5 },
      { iso2: 'ID', share:  6.5 },
      { iso2: 'HN', share:  3.0 },
      { iso2: 'IN', share:  3.0 },
      { iso2: 'UG', share:  3.0 },
    ],
  },
  {
    id:       'sugar',
    label:    'Sugar',
    category: 'agriculture',
    unit:     'Mt raw value',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Sweetener in food and beverages; ethanol biofuel (especially in Brazil).',
    producers: [
      { iso2: 'BR', share: 25.0 },
      { iso2: 'IN', share: 20.0 },
      { iso2: 'TH', share:  7.0 },
      { iso2: 'CN', share:  7.0 },
      { iso2: 'US', share:  5.0 },
      { iso2: 'MX', share:  4.0 },
      { iso2: 'PK', share:  4.0 },
      { iso2: 'AU', share:  3.0 },
    ],
  },
  {
    id:       'cotton',
    label:    'Cotton',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Textile fiber for clothing and home goods; cottonseed oil and meal.',
    producers: [
      { iso2: 'CN', share: 24.0 },
      { iso2: 'IN', share: 23.0 },
      { iso2: 'BR', share: 13.0 },
      { iso2: 'US', share: 11.0 },
      { iso2: 'PK', share:  5.0 },
      { iso2: 'AU', share:  4.0 },
      { iso2: 'TR', share:  2.0 },
      { iso2: 'UZ', share:  2.0 },
    ],
  },
  {
    id:       'palm-oil',
    label:    'Palm Oil',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Cheapest vegetable oil — in ~50% of packaged foods, cosmetics, biofuel.',
    producers: [
      { iso2: 'ID', share: 59.0 },
      { iso2: 'MY', share: 24.0 },
      { iso2: 'TH', share:  4.0 },
      { iso2: 'CO', share:  2.0 },
      { iso2: 'NG', share:  2.0 },
      { iso2: 'GH', share:  1.5 },
      { iso2: 'PH', share:  1.0 },
      { iso2: 'HN', share:  1.0 },
    ],
  },
  {
    id:       'rice',
    label:    'Rice',
    category: 'agriculture',
    unit:     'Mt milled',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Staple food for ~3.5 billion people, primarily across Asia.',
    producers: [
      { iso2: 'CN', share: 28.0 },
      { iso2: 'IN', share: 25.0 },
      { iso2: 'BD', share:  7.0 },
      { iso2: 'ID', share:  6.7 },
      { iso2: 'VN', share:  5.3 },
      { iso2: 'TH', share:  3.8 },
      { iso2: 'MM', share:  3.5 },
      { iso2: 'PH', share:  3.0 },
    ],
  },
  {
    id:       'cocoa',
    label:    'Cocoa',
    category: 'agriculture',
    unit:     'kt',
    source:   'ICCO',
    year:     2023,
    useCase:  'Chocolate, cocoa butter, and cosmetics — climate-sensitive crop.',
    producers: [
      { iso2: 'CI', share: 45.0 },
      { iso2: 'GH', share: 13.0 },
      { iso2: 'EC', share:  9.5 },
      { iso2: 'NG', share:  5.0 },
      { iso2: 'CM', share:  5.0 },
      { iso2: 'ID', share:  4.0 },
      { iso2: 'BR', share:  4.0 },
      { iso2: 'PE', share:  2.0 },
    ],
  },
  {
    id:       'tea',
    label:    'Tea',
    category: 'agriculture',
    unit:     'Mt',
    source:   'FAOSTAT',
    year:     2022,
    useCase:  'Second most-consumed beverage globally after water.',
    producers: [
      { iso2: 'CN', share: 49.0 },
      { iso2: 'IN', share: 21.0 },
      { iso2: 'KE', share:  8.0 },
      { iso2: 'TR', share:  5.0 },
      { iso2: 'LK', share:  4.0 },
      { iso2: 'VN', share:  4.0 },
      { iso2: 'ID', share:  3.0 },
      { iso2: 'BD', share:  2.0 },
    ],
  },
  {
    id:       'natural-rubber',
    label:    'Natural Rubber',
    category: 'agriculture',
    unit:     'Mt',
    source:   'ANRPC',
    year:     2023,
    useCase:  'Tires (~70% of demand), industrial goods, gloves, and footwear.',
    producers: [
      { iso2: 'TH', share: 36.0 },
      { iso2: 'ID', share: 26.0 },
      { iso2: 'VN', share:  9.0 },
      { iso2: 'IN', share:  7.0 },
      { iso2: 'CN', share:  6.0 },
      { iso2: 'MY', share:  5.0 },
      { iso2: 'PH', share:  2.0 },
      { iso2: 'MM', share:  2.0 },
    ],
  },
  {
    id:       'barley',
    label:    'Barley',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Animal feed, beer brewing (malted barley), whisky, and food.',
    producers: [
      { iso2: 'RU', share: 14.0 },
      { iso2: 'AU', share:  9.5 },
      { iso2: 'FR', share:  8.5 },
      { iso2: 'DE', share:  7.5 },
      { iso2: 'UA', share:  7.0 },
      { iso2: 'CA', share:  6.0 },
      { iso2: 'TR', share:  5.0 },
      { iso2: 'AR', share:  4.0 },
    ],
  },
  {
    id:       'sunflower-seed',
    label:    'Sunflower Seed',
    category: 'agriculture',
    unit:     'Mt',
    source:   'USDA FAS',
    year:     2023,
    useCase:  'Cooking oil, snacks, and animal feed; key oilseed in Europe and the CIS.',
    producers: [
      { iso2: 'RU', share: 30.0 },
      { iso2: 'UA', share: 24.0 },
      { iso2: 'AR', share:  8.0 },
      { iso2: 'RO', share:  6.0 },
      { iso2: 'CN', share:  3.0 },
      { iso2: 'HU', share:  3.0 },
      { iso2: 'TR', share:  2.5 },
      { iso2: 'BG', share:  2.5 },
    ],
  },

  // ── Phase 2: new commodity entries ──────────────────────────────────────
  {
    id:       'rare-earths',
    label:    'Rare Earths',
    category: 'metals',
    unit:     'kt REO',
    source:   'USGS',
    year:     2023,
    useCase:  'Permanent magnets for EV motors, wind turbines, defense systems; phosphors for screens and lighting.',
    producers: [
      { iso2: 'CN', share: 68.0 },
      { iso2: 'US', share: 12.3 },
      { iso2: 'MM', share:  5.5 }, // Myanmar
      { iso2: 'AU', share:  5.4 },
      { iso2: 'TH', share:  2.2 },
      { iso2: 'MG', share:  1.4 }, // Madagascar
      { iso2: 'IN', share:  1.0 },
      { iso2: 'RU', share:  0.8 },
    ],
  },
  {
    id:       'steel',
    label:    'Steel',
    category: 'metals',
    unit:     'Mt crude steel',
    source:   'World Steel Association',
    year:     2023,
    useCase:  'Construction (rebar, structural), automotive, machinery, shipbuilding, appliances.',
    producers: [
      { iso2: 'CN', share: 54.0 },
      { iso2: 'IN', share:  7.3 },
      { iso2: 'JP', share:  4.7 },
      { iso2: 'US', share:  4.3 },
      { iso2: 'RU', share:  4.0 },
      { iso2: 'KR', share:  3.5 },
      { iso2: 'DE', share:  1.9 },
      { iso2: 'TR', share:  1.9 },
    ],
  },
  {
    id:       'lumber',
    label:    'Lumber',
    category: 'agriculture',
    unit:     'M m³ industrial roundwood',
    source:   'FAOSTAT',
    year:     2022,
    useCase:  'Construction framing, furniture, pulp & paper feedstock, packaging.',
    producers: [
      { iso2: 'US', share: 19.0 },
      { iso2: 'RU', share: 11.0 },
      { iso2: 'CN', share:  8.5 },
      { iso2: 'CA', share:  7.2 },
      { iso2: 'BR', share:  6.5 },
      { iso2: 'SE', share:  3.8 },
      { iso2: 'FI', share:  3.6 },
      { iso2: 'DE', share:  3.5 },
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

// ── Concentration analytics ─────────────────────────────────────────────
/**
 * Concentration metrics computed from a commodity's listed top producers.
 *
 * Why these matter:
 * - `top3Share`  — quick read on supply-chain risk.  >70% means a handful of
 *                  countries can crater global supply (cobalt: DRC alone is
 *                  73%).  <40% means production is fragmented and resilient.
 * - `restShare`  — what's NOT in the top 8.  Tells you whether the visible
 *                  ranking *is* the story or just a fragmented top slice.
 * - `level`      — categorical bucket for colour-coding the UI.
 */
export interface CommodityConcentration {
  top3Share: number;
  top8Share: number;
  restShare: number;
  level: 'high' | 'medium' | 'low';
}

export function getConcentration(c: Commodity): CommodityConcentration {
  const top3 = c.producers.slice(0, 3).reduce((s, p) => s + p.share, 0);
  const top8 = c.producers.reduce((s, p) => s + p.share, 0);
  const rest = Math.max(0, 100 - top8);
  const level: CommodityConcentration['level'] =
    top3 >= 70 ? 'high' : top3 >= 50 ? 'medium' : 'low';
  return { top3Share: top3, top8Share: top8, restShare: rest, level };
}
