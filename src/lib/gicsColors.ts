/**
 * GICS (Global Industry Classification Standard) full hierarchy & color system.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CENTRALIZED COLOR REGISTRY
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ALL category colors live here. To change any color app-wide, edit a
 * single value in the relevant map below:
 *
 *   SECTOR_COLORS   – GICS 11 sectors + ETFs
 *   COUNTRY_COLORS  – ISO-2 country codes
 *   CAP_COLORS      – Market-cap tiers
 *   STYLE_COLORS    – Investment style (Value / Growth / Core)
 *
 * Values are raw HSL triplets, e.g. '210 65% 55%'.
 * Generic accessors derive hsl(), bg (0.12 opacity), and border (0.3 opacity).
 *
 * To add a new category type:
 *   1. Create a new Record<string, string> map
 *   2. Add it to CATEGORY_REGISTRY
 *   3. Extend the CategoryType union
 *
 * GICS 11 = 11 sectors
 * GICS 25 = 25 industry groups
 * GICS 74 = 74 industries
 * GICS 163 = 163 sub-industries
 */

/* ─── GICS 11 Sectors ─── */
export const GICS_SECTORS = [
  'Energy',
  'Materials',
  'Industrials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Health Care',
  'Financials',
  'Information Technology',
  'Communication Services',
  'Utilities',
  'Real Estate',
] as const;

export type GicsSector = (typeof GICS_SECTORS)[number];

/**
 * All display sectors: the 11 canonical GICS sectors plus the 'ETFs' pseudo-sector.
 * Use this when you need to enumerate every possible sector label in the app —
 * e.g. for filter dropdowns, color palettes, or legend lists.
 * Keep `GICS_SECTORS` as the pure 11 for hierarchy lookups.
 */
export const ALL_SECTORS = [...GICS_SECTORS, 'ETFs'] as const;
export type AllSector = (typeof ALL_SECTORS)[number];

/* ─── GICS 25 Industry Groups ─── */
export const GICS_INDUSTRY_GROUPS: Record<GicsSector, string[]> = {
  'Energy': ['Energy'],
  'Materials': ['Materials'],
  'Industrials': ['Capital Goods', 'Commercial & Professional Services', 'Transportation'],
  'Consumer Discretionary': ['Automobiles & Components', 'Consumer Durables & Apparel', 'Consumer Services', 'Consumer Discretionary Distribution & Retail'],
  'Consumer Staples': ['Consumer Staples Distribution & Retail', 'Food, Beverage & Tobacco', 'Household & Personal Products'],
  'Health Care': ['Health Care Equipment & Services', 'Pharmaceuticals, Biotechnology & Life Sciences'],
  'Financials': ['Banks', 'Financial Services', 'Insurance'],
  'Information Technology': ['Software & Services', 'Technology Hardware & Equipment', 'Semiconductors & Semiconductor Equipment'],
  'Communication Services': ['Telecommunication Services', 'Media & Entertainment'],
  'Utilities': ['Utilities'],
  'Real Estate': ['Equity Real Estate Investment Trusts (REITs)', 'Real Estate Management & Development'],
};

/* ─── GICS 74 Industries (grouped by Industry Group) ─── */
/**
 * GICS 2023 canonical industry hierarchy.
 * Keys are industry GROUP names (from GICS_INDUSTRY_GROUPS).
 * Values list every INDUSTRY that belongs to that group.
 * Backward-compat aliases (old industry names) are included so
 * normalizeSector() hierarchy walk never misses a string from an older DB.
 */
export const GICS_INDUSTRIES: Record<string, string[]> = {
  // ── Energy ──────────────────────────────────────────────────────────────
  'Energy': ['Oil, Gas & Consumable Fuels', 'Energy Equipment & Services'],

  // ── Materials ────────────────────────────────────────────────────────────
  'Materials': ['Chemicals', 'Construction Materials', 'Containers & Packaging', 'Metals & Mining', 'Paper & Forest Products'],

  // ── Industrials ──────────────────────────────────────────────────────────
  'Capital Goods': [
    'Aerospace & Defense', 'Building Products', 'Construction & Engineering',
    'Electrical Equipment', 'Industrial Conglomerates', 'Machinery',
    'Trading Companies & Distributors',
  ],
  'Commercial & Professional Services': ['Commercial Services & Supplies', 'Professional Services'],
  'Transportation': [
    'Air Freight & Logistics', 'Passenger Airlines', 'Marine Transportation',
    'Ground Transportation', 'Transportation Infrastructure',
  ],

  // ── Consumer Discretionary ───────────────────────────────────────────────
  // GICS 2023: industry is 'Automobiles' (not 'Automobile Manufacturers')
  // Old name kept for backward compat with pre-2023 DB entries.
  'Automobiles & Components': ['Automobiles', 'Automobile Components', 'Automobile Manufacturers'],
  'Consumer Durables & Apparel': ['Household Durables', 'Leisure Products', 'Textiles, Apparel & Luxury Goods'],
  'Consumer Services': ['Hotels, Restaurants & Leisure', 'Diversified Consumer Services'],
  // GICS 2023: 'Home Improvement Retail' rolled into Specialty Retail sub-industry
  'Consumer Discretionary Distribution & Retail': ['Distributors', 'Broadline Retail', 'Specialty Retail'],

  // ── Consumer Staples ─────────────────────────────────────────────────────
  // GICS 2023: single industry shares the group name; sub-industries are Drug Retail etc.
  'Consumer Staples Distribution & Retail': ['Consumer Staples Distribution & Retail'],
  // GICS 2023: Beverages / Food Products / Tobacco; old flat names kept for compat
  'Food, Beverage & Tobacco': [
    'Beverages', 'Food Products', 'Tobacco',
    // backward compat — old industry-level names still in some DBs
    'Brewers', 'Distillers & Vintners', 'Soft Drinks & Non-alcoholic Beverages',
    'Agricultural Products & Services', 'Packaged Foods & Meats',
  ],
  'Household & Personal Products': ['Household Products', 'Personal Care Products'],

  // ── Health Care ──────────────────────────────────────────────────────────
  'Health Care Equipment & Services': ['Health Care Equipment & Supplies', 'Health Care Providers & Services', 'Health Care Technology'],
  'Pharmaceuticals, Biotechnology & Life Sciences': ['Biotechnology', 'Pharmaceuticals', 'Life Sciences Tools & Services'],

  // ── Financials ───────────────────────────────────────────────────────────
  'Banks': ['Diversified Banks', 'Regional Banks'],
  'Financial Services': [
    'Diversified Financial Services', 'Consumer Finance', 'Capital Markets',
    'Mortgage Real Estate Investment Trusts (REITs)', 'Transaction & Payment Processing Services',
    'Financial Exchanges & Data',
  ],
  'Insurance': ['Insurance Brokers', 'Life & Health Insurance', 'Multi-line Insurance', 'Property & Casualty Insurance', 'Reinsurance'],

  // ── Information Technology ───────────────────────────────────────────────
  // GICS 2023: IT Services / Software (old flat names kept for compat)
  'Software & Services': [
    'IT Services', 'Software',
    // backward compat
    'IT Consulting & Other Services', 'Internet Services & Infrastructure',
    'Application Software', 'Systems Software',
  ],
  'Technology Hardware & Equipment': [
    'Communications Equipment', 'Technology Hardware, Storage & Peripherals',
    'Electronic Equipment, Instruments & Components',
  ],
  'Semiconductors & Semiconductor Equipment': ['Semiconductor Materials & Equipment', 'Semiconductors'],

  // ── Communication Services ───────────────────────────────────────────────
  // GICS 2023: Diversified Telecommunication Services replaces Alternative Carriers +
  // Integrated Telecommunication Services; old names kept for compat.
  'Telecommunication Services': [
    'Diversified Telecommunication Services', 'Wireless Telecommunication Services',
    'Alternative Carriers', 'Integrated Telecommunication Services',
  ],
  // GICS 2023: Media / Entertainment / Interactive Media & Services industries;
  // old flat names kept for compat.
  'Media & Entertainment': [
    'Media', 'Entertainment', 'Interactive Media & Services',
    // backward compat
    'Advertising', 'Broadcasting', 'Cable & Satellite', 'Publishing',
    'Movies & Entertainment', 'Interactive Home Entertainment',
  ],

  // ── Utilities ────────────────────────────────────────────────────────────
  // GICS 2023: merged into 'Independent Power and Renewable Electricity Producers'
  // old separate names kept for compat.
  'Utilities': [
    'Electric Utilities', 'Gas Utilities', 'Multi-Utilities', 'Water Utilities',
    'Independent Power and Renewable Electricity Producers',
    'Independent Power Producers & Energy Traders', 'Renewable Electricity',
  ],

  // ── Real Estate ──────────────────────────────────────────────────────────
  // GICS 2023: Specialized REITs sub-types (Timber, Data Center, etc.) are
  // sub-industries of Specialized REITs, NOT separate industries.
  'Equity Real Estate Investment Trusts (REITs)': [
    'Diversified REITs', 'Industrial REITs', 'Hotel & Resort REITs',
    'Office REITs', 'Health Care REITs', 'Residential REITs',
    'Retail REITs', 'Specialized REITs',
  ],
  'Real Estate Management & Development': [
    'Diversified Real Estate Activities', 'Real Estate Operating Companies',
    'Real Estate Development', 'Real Estate Services',
  ],
};

/* ─── GICS 163 Sub-Industries (grouped by Industry) ─── */
/**
 * GICS 2023 canonical sub-industry mapping.
 * Keys are INDUSTRY names (matching values in GICS_INDUSTRIES).
 * Values are the SUB-INDUSTRY names within that industry.
 *
 * This map drives sectorForSubIndustry() 3-hop walk:
 *   sub-industry value → key (industry) → GICS_INDUSTRIES (group) → GICS_INDUSTRY_GROUPS (sector)
 *
 * All 163 active GICS 2023 sub-industries are reachable through this map.
 */
export const GICS_SUB_INDUSTRIES: Record<string, string[]> = {
  // ── Energy ──────────────────────────────────────────────────────────────
  'Oil, Gas & Consumable Fuels': [
    'Integrated Oil & Gas', 'Oil & Gas Exploration & Production',
    'Oil & Gas Refining & Marketing', 'Oil & Gas Storage & Transportation',
    'Coal & Consumable Fuels',
  ],
  'Energy Equipment & Services': ['Oil & Gas Drilling', 'Oil & Gas Equipment & Services'],

  // ── Materials ────────────────────────────────────────────────────────────
  'Chemicals': [
    'Commodity Chemicals', 'Diversified Chemicals', 'Fertilizers & Agricultural Chemicals',
    'Industrial Gases', 'Specialty Chemicals',
  ],
  'Construction Materials': ['Construction Materials'],
  'Containers & Packaging': ['Metal, Glass & Plastic Containers', 'Paper & Plastic Packaging Products & Materials'],
  'Metals & Mining': ['Aluminum', 'Copper', 'Diversified Metals & Mining', 'Gold', 'Precious Metals & Minerals', 'Silver', 'Steel'],
  'Paper & Forest Products': ['Forest Products', 'Paper Products'],

  // ── Industrials ──────────────────────────────────────────────────────────
  'Aerospace & Defense': ['Aerospace & Defense'],
  'Building Products': ['Building Products'],
  'Construction & Engineering': ['Construction & Engineering'],
  'Electrical Equipment': ['Electrical Components & Equipment', 'Heavy Electrical Equipment'],
  'Industrial Conglomerates': ['Industrial Conglomerates'],
  // GICS 2023 added 'Construction Machinery & Heavy Transportation Equipment'
  'Machinery': [
    'Construction Machinery & Heavy Transportation Equipment',
    'Agricultural & Farm Machinery',
    'Industrial Machinery & Supplies & Components',
  ],
  'Trading Companies & Distributors': ['Trading Companies & Distributors'],
  'Commercial Services & Supplies': [
    'Commercial Printing', 'Environmental & Facilities Services',
    'Office Services & Supplies', 'Diversified Support Services', 'Security & Alarm Services',
  ],
  // 'Data Processing & Outsourced Services' moved from IT → Industrials in GICS 2023
  'Professional Services': [
    'Human Resource & Employment Services', 'Research & Consulting Services',
    'Data Processing & Outsourced Services',
  ],
  'Air Freight & Logistics': ['Air Freight & Logistics'],
  'Passenger Airlines': ['Passenger Airlines'],
  'Marine Transportation': ['Marine Transportation'],
  'Ground Transportation': ['Rail Transportation', 'Cargo Ground Transportation', 'Passenger Ground Transportation'],
  'Transportation Infrastructure': ['Airport Services', 'Highways & Railtracks', 'Marine Ports & Services'],

  // ── Consumer Discretionary ───────────────────────────────────────────────
  // GICS 2023: industry is 'Automobiles' (added 'Motorcycle Manufacturers')
  'Automobiles': ['Automobile Manufacturers', 'Motorcycle Manufacturers'],
  // backward-compat key so old DB entries still resolve
  'Automobile Manufacturers': ['Automobile Manufacturers', 'Motorcycle Manufacturers'],
  'Automobile Components': ['Automotive Parts & Equipment', 'Tires & Rubber'],
  'Household Durables': [
    'Consumer Electronics', 'Home Furnishings', 'Homebuilding',
    'Household Appliances', 'Housewares & Specialties',
  ],
  'Leisure Products': ['Leisure Products'],
  // GICS 2023 added 'Textiles'
  'Textiles, Apparel & Luxury Goods': ['Apparel, Accessories & Luxury Goods', 'Footwear', 'Textiles'],
  'Hotels, Restaurants & Leisure': ['Casinos & Gaming', 'Hotels, Resorts & Cruise Lines', 'Leisure Facilities', 'Restaurants'],
  'Diversified Consumer Services': ['Education Services', 'Specialized Consumer Services'],
  'Distributors': ['Distributors'],
  'Broadline Retail': ['Broadline Retail'],
  // GICS 2023 added 'Homefurnishing Retail'; 'Home Improvement Retail' sub-industry kept
  'Specialty Retail': [
    'Apparel Retail', 'Automotive Retail', 'Computer & Electronics Retail',
    'Home Improvement Retail', 'Homefurnishing Retail',
    'Home Furnishing Retail',   // alternate spelling — maps to same color bucket
    'Other Specialty Retail',
  ],

  // ── Consumer Staples ─────────────────────────────────────────────────────
  // GICS 2023: single industry shares the group name; all prior sub-industries live here
  'Consumer Staples Distribution & Retail': [
    'Drug Retail', 'Food Distributors', 'Food Retail', 'Consumer Staples Merchandise Retail',
    'Hypermarkets & Super Centers',   // old name for Consumer Staples Merchandise Retail
  ],
  // GICS 2023: Beverages industry
  'Beverages': ['Brewers', 'Distillers & Vintners', 'Soft Drinks & Non-alcoholic Beverages'],
  // GICS 2023: Food Products industry
  'Food Products': ['Agricultural Products & Services', 'Packaged Foods & Meats'],
  // backward-compat keys — old DB entries that stored these as industry names
  'Brewers': ['Brewers'],
  'Distillers & Vintners': ['Distillers & Vintners'],
  'Soft Drinks & Non-alcoholic Beverages': ['Soft Drinks & Non-alcoholic Beverages'],
  'Agricultural Products & Services': ['Agricultural Products & Services'],
  'Packaged Foods & Meats': ['Packaged Foods & Meats', 'Packaged Foods', 'Meat, Poultry & Fish'],
  'Tobacco': ['Tobacco'],
  'Household Products': ['Household Products'],
  'Personal Care Products': ['Personal Care Products'],

  // ── Health Care ──────────────────────────────────────────────────────────
  'Health Care Equipment & Supplies': ['Health Care Equipment', 'Health Care Supplies'],
  'Health Care Providers & Services': [
    'Health Care Distributors', 'Health Care Services',
    'Health Care Facilities', 'Managed Health Care',
  ],
  'Health Care Technology': ['Health Care Technology'],
  'Biotechnology': ['Biotechnology'],
  'Pharmaceuticals': ['Pharmaceuticals'],
  'Life Sciences Tools & Services': ['Life Sciences Tools & Services'],

  // ── Financials ───────────────────────────────────────────────────────────
  'Diversified Banks': ['Diversified Banks'],
  'Regional Banks': ['Regional Banks'],
  'Diversified Financial Services': ['Multi-Sector Holdings', 'Specialized Finance'],
  'Consumer Finance': ['Consumer Finance'],
  'Capital Markets': [
    'Asset Management & Custody Banks', 'Investment Banking & Brokerage',
    'Diversified Capital Markets', 'Financial Exchanges & Data',
  ],
  'Mortgage Real Estate Investment Trusts (REITs)': [
    'Commercial Mortgage REITs', 'Residential Mortgage REITs',
    'Commercial & Residential Mortgage Finance',
  ],
  'Transaction & Payment Processing Services': ['Transaction & Payment Processing Services'],
  'Financial Exchanges & Data': ['Financial Exchanges & Data'],
  'Insurance Brokers': ['Insurance Brokers'],
  'Life & Health Insurance': ['Life & Health Insurance'],
  'Multi-line Insurance': ['Multi-line Insurance'],
  'Property & Casualty Insurance': ['Property & Casualty Insurance'],
  'Reinsurance': ['Reinsurance'],

  // ── Information Technology ───────────────────────────────────────────────
  // GICS 2023: IT Services / Software industries (replacing flat industry list)
  'IT Services': ['IT Consulting & Other Services', 'Internet Services & Infrastructure'],
  'Software': ['Application Software', 'Systems Software'],
  // backward-compat keys for old DB entries that used pre-2023 industry names
  'IT Consulting & Other Services': ['IT Consulting & Other Services'],
  'Internet Services & Infrastructure': ['Internet Services & Infrastructure'],
  'Application Software': ['Application Software'],
  'Systems Software': ['Systems Software'],
  'Communications Equipment': ['Communications Equipment'],
  'Technology Hardware, Storage & Peripherals': ['Technology Hardware, Storage & Peripherals'],
  'Electronic Equipment, Instruments & Components': [
    'Electronic Equipment & Instruments', 'Electronic Components', 'Electronic Manufacturing Services',
  ],
  'Semiconductor Materials & Equipment': ['Semiconductor Materials & Equipment'],
  'Semiconductors': ['Semiconductors'],

  // ── Communication Services ───────────────────────────────────────────────
  // GICS 2023: 'Diversified Telecommunication Services' replaces old Alternative/Integrated split
  'Diversified Telecommunication Services': [
    'Alternative Carriers', 'Integrated Telecommunication Services',
    'Diversified Telecommunication Services',
  ],
  'Wireless Telecommunication Services': ['Wireless Telecommunication Services'],
  // backward-compat keys
  'Alternative Carriers': ['Alternative Carriers'],
  'Integrated Telecommunication Services': ['Integrated Telecommunication Services'],
  // GICS 2023: Media / Entertainment / Interactive Media & Services industries
  'Media': ['Advertising', 'Broadcasting', 'Cable & Satellite', 'Publishing'],
  'Entertainment': ['Movies & Entertainment', 'Interactive Home Entertainment'],
  'Interactive Media & Services': ['Interactive Media & Services'],
  // backward-compat keys for old flat structure
  'Advertising': ['Advertising'],
  'Broadcasting': ['Broadcasting'],
  'Cable & Satellite': ['Cable & Satellite'],
  'Publishing': ['Publishing'],
  'Movies & Entertainment': ['Movies & Entertainment'],
  'Interactive Home Entertainment': ['Interactive Home Entertainment'],

  // ── Utilities ────────────────────────────────────────────────────────────
  'Electric Utilities': ['Electric Utilities'],
  'Gas Utilities': ['Gas Utilities'],
  'Multi-Utilities': ['Multi-Utilities'],
  'Water Utilities': ['Water Utilities'],
  // GICS 2023: merged into one industry; old separate names kept as values for compat
  'Independent Power and Renewable Electricity Producers': [
    'Independent Power Producers & Energy Traders', 'Renewable Electricity',
    'Independent Power and Renewable Electricity Producers',
  ],
  // backward-compat keys
  'Independent Power Producers & Energy Traders': ['Independent Power Producers & Energy Traders'],
  'Renewable Electricity': ['Renewable Electricity'],

  // ── Real Estate ──────────────────────────────────────────────────────────
  'Diversified REITs': ['Diversified REITs'],
  'Industrial REITs': ['Industrial REITs'],
  'Hotel & Resort REITs': ['Hotel & Resort REITs'],
  'Office REITs': ['Office REITs'],
  'Health Care REITs': ['Health Care REITs'],
  // GICS 2023: split into Multi-Family and Single-Family
  'Residential REITs': ['Multi-Family Residential REITs', 'Single-Family Residential REITs', 'Residential REITs'],
  'Retail REITs': ['Retail REITs'],
  // GICS 2023: Specialized REITs sub-types are sub-industries, not separate industries
  'Specialized REITs': [
    'Other Specialized REITs', 'Self-Storage REITs', 'Telecom Tower REITs',
    'Data Center REITs', 'Timber REITs', 'Specialized REITs',
  ],
  'Diversified Real Estate Activities': ['Diversified Real Estate Activities'],
  'Real Estate Operating Companies': ['Real Estate Operating Companies'],
  'Real Estate Development': ['Real Estate Development'],
  'Real Estate Services': ['Real Estate Services'],
};

/* ═══════════════════════════════════════════════════════════════════════
 * CENTRALIZED COLOR PALETTES
 *
 * To change a color app-wide, edit the HSL triplet here.
 * All charts, badges, donut slices, and legends derive from these maps.
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * GICS sector colors + ETFs pseudo-sector.
 * Values are raw HSL triplets: 'H S% L%'
 */
export const SECTOR_COLORS: Record<string, string> = {
  'Energy':                   '16 90% 55%',   // warm orange
  'Materials':                '45 85% 52%',   // golden amber
  'Industrials':              '210 65% 55%',  // steel blue
  'Consumer Discretionary':   '290 60% 58%',  // violet
  'Consumer Staples':         '155 65% 44%',  // jade green
  'Health Care':              '340 72% 56%',  // rose pink
  'Financials':               '230 70% 58%',  // royal blue
  'Information Technology':   '180 70% 44%',  // teal
  'Communication Services':   '55 75% 50%',   // warm yellow
  'Utilities':                '100 50% 48%',  // olive green
  'Real Estate':              '0 65% 55%',    // brick red
  'ETFs':                     '280 65% 55%',  // purple
};

/**
 * Country colors keyed by ISO-2 code.
 * Unknown countries fall back to a deterministic hash.
 */
export const COUNTRY_COLORS: Record<string, string> = {
  US: '220 60% 50%',   CA: '0 65% 50%',    GB: '340 55% 45%',
  DE: '45 70% 45%',    FR: '225 55% 55%',   JP: '0 70% 55%',
  AU: '160 50% 40%',   CN: '5 75% 48%',     CH: '0 60% 55%',
  IN: '25 75% 50%',    BR: '140 55% 40%',   KR: '210 50% 50%',
  HK: '350 60% 45%',   SG: '0 55% 52%',     NL: '20 70% 50%',
  IE: '145 55% 42%',   TW: '240 45% 50%',   SE: '50 70% 48%',
};

/**
 * Market-cap tier colors.
 */
export const CAP_COLORS: Record<string, string> = {
  'Mega Cap':  '220 65% 50%',
  'Large Cap': '190 55% 45%',
  'Mid Cap':   '45 65% 50%',
  'Small Cap': '25 60% 50%',
  'Micro Cap': '0 50% 55%',
  'Unknown':   '0 0% 55%',
};

/**
 * Investment style colors.
 */
/**
 * User-defined trade-style colors.
 *
 * The Style tab on the portfolio's allocation chart shows holdings grouped
 * by the user's manually-set trade style (set per ticker via the holdings
 * table editor). Colors picked to be visually distinct from the GICS sector
 * palette so the chart reads at a glance.
 *
 * Legacy 'Value' / 'Growth' / 'Core' kept as defensive aliases so any cached
 * or in-flight data using the old style names still gets a real color.
 */
export const STYLE_COLORS: Record<string, string> = {
  // Per-user trade styles
  'Day Trade':    '15 80% 55%',   // hot orange — aggressive
  'Swing Trade':  '195 75% 50%',  // cyan-blue — quick in-and-out
  'Long Term':    '155 55% 42%',  // deep green — slow growth
  'Unclassified': '220 8% 55%',   // neutral gray — needs tagging
  // Legacy keys retained so any cached/mid-flight data using the old
  // names ('Swing', 'Long Term Hold') still resolves to a real color.
  'Swing':           '195 75% 50%',
  'Long Term Hold': '155 55% 42%',
  // Older "investment style" naming (Value/Growth/Core)
  Value:  '210 55% 50%',
  Growth: '150 55% 45%',
  Core:   '45 55% 50%',
};

/* ─── Fallback for unknown entries in any category ─── */
const FALLBACK_HSL = '220 10% 50%';

/* ─── Category Registry ─── */

/**
 * Supported category types. Extend this union + CATEGORY_REGISTRY to add new ones.
 */
export type CategoryType = 'sector' | 'country' | 'cap' | 'style';

const CATEGORY_REGISTRY: Record<CategoryType, Record<string, string>> = {
  sector:  SECTOR_COLORS,
  country: COUNTRY_COLORS,
  cap:     CAP_COLORS,
  style:   STYLE_COLORS,
};

/* ─── Generic Accessors ─── */

/**
 * Deterministic fallback for unknown keys (e.g. unlisted country codes).
 */
function hashFallback(key: string): string {
  const h = (key.charCodeAt(0) * 47 + (key.charCodeAt(1) || 0) * 31) % 360;
  return `${h} 50% 50%`;
}

/**
 * Returns raw HSL triplet for any category type + key.
 * Falls back to FALLBACK_HSL for sectors, or deterministic hash for countries.
 */
export function getCategoryHsl(type: CategoryType, key: string): string {
  const map = CATEGORY_REGISTRY[type];
  if (!key) return FALLBACK_HSL;

  // For sectors, normalize first
  if (type === 'sector') {
    const normalized = key === 'ETFs' ? 'ETFs' : normalizeSector(key);
    return map[normalized] ?? FALLBACK_HSL;
  }

  // For countries, use hash fallback for unknown codes
  if (type === 'country') {
    return map[key] ?? hashFallback(key);
  }

  return map[key] ?? FALLBACK_HSL;
}

/** Returns `hsl(...)` CSS color string. */
export function getCategoryColor(type: CategoryType, key: string): string {
  return `hsl(${getCategoryHsl(type, key)})`;
}

/** Returns `hsl(... / 0.12)` for badge/pill backgrounds. */
export function getCategoryBg(type: CategoryType, key: string): string {
  return `hsl(${getCategoryHsl(type, key)} / 0.12)`;
}

/** Returns `hsl(... / 0.3)` for borders. */
export function getCategoryBorder(type: CategoryType, key: string): string {
  return `hsl(${getCategoryHsl(type, key)} / 0.3)`;
}

/* ─── Backward-compatible sector-specific accessors ─── */

/**
 * Returns raw HSL values (no `hsl()` wrapper) for a GICS sector.
 */
export function getGicsSectorHsl(sector: string | null | undefined): string {
  return getCategoryHsl('sector', sector ?? '');
}

/**
 * Returns a full `hsl(...)` CSS color string for a GICS sector.
 */
export function getGicsSectorColor(sector: string | null | undefined): string {
  return getCategoryColor('sector', sector ?? '');
}

/**
 * Returns a lighter background version of the sector color (for badges/pills).
 */
export function getGicsSectorBg(sector: string | null | undefined): string {
  return getCategoryBg('sector', sector ?? '');
}

/**
 * Returns border color at reduced opacity.
 */
export function getGicsSectorBorder(sector: string | null | undefined): string {
  return getCategoryBorder('sector', sector ?? '');
}

/**
 * Normalize common sector name variations to GICS 11 names.
 * Handles official GICS names, SIC-style descriptions, and common aliases.
 * Also passes through 'ETFs' unchanged.
 */
export function normalizeSector(raw: string): string {
  if (!raw) return 'Other';

  // Pass through ETFs as-is
  if (raw === 'ETFs') return 'ETFs';

  const lower = raw.toLowerCase().trim();

  // Direct match
  const direct = GICS_SECTORS.find(s => s.toLowerCase() === lower);
  if (direct) return direct;

  // Common aliases & SIC-code descriptions
  // Covers: GICS pass-through, Finnhub taxonomy, EODHD sector/industry strings,
  // FMP taxonomy, Alpha Vantage, and common SIC descriptions.
  const aliases: Record<string, GicsSector> = {
    // ── Information Technology ───────────────────────────────────────────────
    'tech': 'Information Technology',
    'technology': 'Information Technology',
    'it': 'Information Technology',
    'software': 'Information Technology',
    'semiconductors': 'Information Technology',
    'hardware': 'Information Technology',
    'electronic technology': 'Information Technology',
    'technology services': 'Information Technology',
    'internet technology': 'Information Technology',
    'electronic computers': 'Information Technology',
    'services-prepackaged software': 'Information Technology',
    'services-computer programming, data processing, etc.': 'Information Technology',
    'semiconductors & related devices': 'Information Technology',
    'computer communications equipment': 'Information Technology',
    'printed circuit boards': 'Information Technology',
    'electronic components, nec': 'Information Technology',
    // ── Health Care ──────────────────────────────────────────────────────────
    'healthcare': 'Health Care',
    'health': 'Health Care',
    'health technology': 'Health Care',
    'health services': 'Health Care',
    'medical': 'Health Care',
    'biotech': 'Health Care',
    'biotechnology': 'Health Care',
    'pharma': 'Health Care',
    'pharmaceuticals': 'Health Care',
    'pharmaceutical preparations': 'Health Care',
    'surgical & medical instruments & apparatus': 'Health Care',
    'electromedical & electrotherapeutic apparatus': 'Health Care',
    'biological products, (no diagnostic substances)': 'Health Care',
    // ── Financials ───────────────────────────────────────────────────────────
    'finance': 'Financials',
    'financial': 'Financials',
    'financial services': 'Financials',
    'financial technology': 'Financials',
    'fintech': 'Financials',
    'banking': 'Financials',
    'insurance': 'Financials',
    'asset management': 'Financials',
    'capital markets': 'Financials',
    'investment': 'Financials',
    'miscellaneous financial services': 'Financials',
    'national commercial banks': 'Financials',
    'state chartered banks, federal reserve members': 'Financials',
    'fire, marine & casualty insurance': 'Financials',
    'services-business services, nec': 'Financials',
    'security brokers, dealers & flotation companies': 'Financials',
    'investment advice': 'Financials',
    // ── Communication Services ───────────────────────────────────────────────
    'telecom': 'Communication Services',
    'telecommunications': 'Communication Services',
    'communication': 'Communication Services',
    'communications': 'Communication Services',
    'comm services': 'Communication Services',
    'media': 'Communication Services',
    'entertainment': 'Communication Services',
    'internet': 'Communication Services',
    'online services': 'Communication Services',
    'interactive media': 'Communication Services',
    'interactive media & services': 'Communication Services',
    'movies/entertainment': 'Communication Services',
    'services-miscellaneous amusement & recreation': 'Communication Services',
    'services-video tape rental': 'Communication Services',
    'telephone communications (no radio telephone)': 'Communication Services',
    'cable & other pay television services': 'Communication Services',
    // ── Consumer Discretionary ───────────────────────────────────────────────
    'consumer cyclical': 'Consumer Discretionary',
    'consumer discretionary': 'Consumer Discretionary',
    'retail': 'Consumer Discretionary',
    'specialty retail': 'Consumer Discretionary',
    'apparel': 'Consumer Discretionary',
    'automotive': 'Consumer Discretionary',
    'automobiles': 'Consumer Discretionary',
    'leisure': 'Consumer Discretionary',
    'luxury': 'Consumer Discretionary',
    'motor vehicles & passenger car bodies': 'Consumer Discretionary',
    'retail-catalog & mail-order houses': 'Consumer Discretionary',
    'retail-lumber & other building materials dealers': 'Consumer Discretionary',
    'retail-eating places': 'Consumer Discretionary',
    'hotels & motels': 'Consumer Discretionary',
    'retail-apparel & accessory stores': 'Consumer Discretionary',
    // ── Consumer Staples ─────────────────────────────────────────────────────
    'consumer defensive': 'Consumer Staples',
    'consumer staples': 'Consumer Staples',
    'staples': 'Consumer Staples',
    'food': 'Consumer Staples',
    'food & staples retailing': 'Consumer Staples',
    'food & drug retailing': 'Consumer Staples',
    'household products': 'Consumer Staples',
    'personal products': 'Consumer Staples',
    'beverages': 'Consumer Staples',
    'tobacco': 'Consumer Staples',
    'tobacco products': 'Consumer Staples',
    'soap, detergents, cleang preparations, perfumes, cosmetics': 'Consumer Staples',
    'retail-grocery stores': 'Consumer Staples',
    'retail-variety stores': 'Consumer Staples',
    'grain mill products': 'Consumer Staples',
    // ── Materials ────────────────────────────────────────────────────────────
    'basic materials': 'Materials',
    'raw materials': 'Materials',
    'mining': 'Materials',
    'metals': 'Materials',
    'chemicals': 'Materials',
    'paper': 'Materials',
    'packaging': 'Materials',
    'plastic materials, synth resins & nonvulcan elastomers': 'Materials',
    'steel works, blast furnaces': 'Materials',
    'mining & quarrying of nonmetallic minerals (no fuels)': 'Materials',
    // ── Industrials ──────────────────────────────────────────────────────────
    'industrial': 'Industrials',
    'conglomerates': 'Industrials',
    'defense': 'Industrials',
    'aerospace': 'Industrials',
    'aerospace & defense': 'Industrials',
    'construction': 'Industrials',
    'transportation': 'Industrials',
    'logistics': 'Industrials',
    'commercial services': 'Industrials',
    'commercial & professional services': 'Industrials',
    'professional services': 'Industrials',
    'producer manufacturing': 'Industrials',
    'air transportation, scheduled': 'Industrials',
    'railroads, line-haul operating': 'Industrials',
    'farm machinery & equipment': 'Industrials',
    'general industrial machinery & equipment, nec': 'Industrials',
    // ── Energy ───────────────────────────────────────────────────────────────
    'oil': 'Energy',
    'oil & gas': 'Energy',
    'energy minerals': 'Energy',
    'coal': 'Energy',
    'renewable energy': 'Energy',
    'crude petroleum & natural gas': 'Energy',
    'petroleum refining': 'Energy',
    // ── Utilities ────────────────────────────────────────────────────────────
    'utility': 'Utilities',
    'electric': 'Utilities',
    'water': 'Utilities',
    'gas utilities': 'Utilities',
    'electric services': 'Utilities',
    'natural gas distribution': 'Utilities',
    'power': 'Utilities',
    // ── Real Estate ──────────────────────────────────────────────────────────
    'real estate': 'Real Estate',
    'reits': 'Real Estate',
    'reit': 'Real Estate',
    'real estate investment trusts': 'Real Estate',
    'real estate investment trust (reit)': 'Real Estate',
    'property': 'Real Estate',
    'land subdividers & developers (no cemeteries)': 'Real Estate',
    // ── Common EODHD / Finnhub industry-level strings not caught by hierarchy ─
    // (These are GICS industry or sub-industry names in truncated/alternate form)
    // Consumer Discretionary
    'auto components': 'Consumer Discretionary',
    'automobile components': 'Consumer Discretionary',
    'auto manufacturers': 'Consumer Discretionary',
    'automobile manufacturers': 'Consumer Discretionary',
    'consumer durables': 'Consumer Discretionary',
    'broadline retail': 'Consumer Discretionary',
    'home improvement retail': 'Consumer Discretionary',
    'hotels restaurants & leisure': 'Consumer Discretionary',
    'hotels, restaurants & leisure': 'Consumer Discretionary',
    'casinos & gaming': 'Consumer Discretionary',
    'homebuilding': 'Consumer Discretionary',
    'internet retail': 'Consumer Discretionary',
    'leisure products': 'Consumer Discretionary',
    'footwear': 'Consumer Discretionary',
    'apparel retail': 'Consumer Discretionary',
    'apparel accessories & luxury goods': 'Consumer Discretionary',
    'diversified consumer services': 'Consumer Discretionary',
    // Consumer Staples
    'consumer non-durables': 'Consumer Staples',
    'food retail': 'Consumer Staples',
    'hypermarkets & super centers': 'Consumer Staples',
    'drug retail': 'Consumer Staples',
    'packaged foods': 'Consumer Staples',
    'packaged foods & meats': 'Consumer Staples',
    'soft drinks': 'Consumer Staples',
    'distillers & vintners': 'Consumer Staples',
    'brewers': 'Consumer Staples',
    // Financials
    'banks': 'Financials',
    'regional banks': 'Financials',
    'diversified banks': 'Financials',
    'consumer finance': 'Financials',
    'diversified financial services': 'Financials',
    'transaction & payment processing services': 'Financials',
    'financial exchanges & data': 'Financials',
    'insurance brokers': 'Financials',
    'property & casualty insurance': 'Financials',
    'life & health insurance': 'Financials',
    'reinsurance': 'Financials',
    // Information Technology
    'application software': 'Information Technology',
    'systems software': 'Information Technology',
    'it consulting & other services': 'Information Technology',
    'internet services & infrastructure': 'Information Technology',
    'communications equipment': 'Information Technology',
    'electronic equipment': 'Information Technology',
    'semiconductor materials & equipment': 'Information Technology',
    'computer hardware': 'Information Technology',
    // Health Care
    'health care equipment & supplies': 'Health Care',
    'health care providers & services': 'Health Care',
    'managed health care': 'Health Care',
    'health care technology': 'Health Care',
    'life sciences tools & services': 'Health Care',
    'diagnostics': 'Health Care',
    // Industrials
    'aerospace defense': 'Industrials',
    'building products': 'Industrials',
    'construction & engineering': 'Industrials',
    'electrical equipment': 'Industrials',
    'industrial machinery': 'Industrials',
    'trading companies & distributors': 'Industrials',
    'air freight & logistics': 'Industrials',
    'passenger airlines': 'Industrials',
    'marine transportation': 'Industrials',
    'ground transportation': 'Industrials',
    'environmental & facilities services': 'Industrials',
    'research & consulting services': 'Industrials',
    'human resource & employment services': 'Industrials',
    'data processing & outsourced services': 'Industrials',
    'security & alarm services': 'Industrials',
    // Energy
    'oil & gas exploration & production': 'Energy',
    'oil & gas refining & marketing': 'Energy',
    'oil & gas storage & transportation': 'Energy',
    'oil & gas drilling': 'Energy',
    'oil & gas equipment & services': 'Energy',
    'coal & consumable fuels': 'Energy',
    'integrated oil & gas': 'Energy',
    // Materials
    'commodity chemicals': 'Materials',
    'specialty chemicals': 'Materials',
    'industrial gases': 'Materials',
    'gold': 'Materials',
    'silver': 'Materials',
    'steel': 'Materials',
    'aluminum': 'Materials',
    'copper': 'Materials',
    'diversified metals & mining': 'Materials',
    'paper products': 'Materials',
    'forest products': 'Materials',
    // Utilities
    'electric utilities': 'Utilities',
    // 'gas utilities' — already mapped earlier; duplicate removed.
    'multi-utilities': 'Utilities',
    'water utilities': 'Utilities',
    'renewable electricity': 'Utilities',
    'independent power producers & energy traders': 'Utilities',
    // Real Estate (sub-types)
    'diversified reits': 'Real Estate',
    'industrial reits': 'Real Estate',
    'office reits': 'Real Estate',
    'retail reits': 'Real Estate',
    'residential reits': 'Real Estate',
    'specialized reits': 'Real Estate',
    'data center reits': 'Real Estate',
    'telecom tower reits': 'Real Estate',
    'self-storage reits': 'Real Estate',
    'real estate development': 'Real Estate',
    'real estate services': 'Real Estate',
    // ── GICS 2023 new/renamed names ──────────────────────────────────────────
    // Communication Services restructuring
    'diversified telecommunication services': 'Communication Services',
    'alternative carriers': 'Communication Services',
    'integrated telecommunication services': 'Communication Services',
    // Media & Entertainment restructuring
    'advertising': 'Communication Services',
    'broadcasting': 'Communication Services',
    'cable & satellite': 'Communication Services',
    'publishing': 'Communication Services',
    'movies & entertainment': 'Communication Services',
    'interactive home entertainment': 'Communication Services',
    // Utilities restructuring
    'independent power and renewable electricity producers': 'Utilities',
    // IT restructuring
    'it services': 'Information Technology',
    // 'software' — already mapped earlier; duplicate removed.
    // Consumer Discretionary restructuring
    // 'automobiles' — already mapped earlier; duplicate removed.
    'motorcycle manufacturers': 'Consumer Discretionary',
    'textiles': 'Consumer Discretionary',
    'homefurnishing retail': 'Consumer Discretionary',
    // 'home improvement retail' — already mapped earlier; duplicate removed.
    // Consumer Staples restructuring
    // 'beverages' — already mapped earlier; duplicate removed.
    'food products': 'Consumer Staples',
    // 'food retail' — already mapped earlier; duplicate removed.
    'consumer staples merchandise retail': 'Consumer Staples',
    // 'hypermarkets & super centers' — already mapped earlier; duplicate removed.
    // New Materials sub-industries
    'construction machinery & heavy transportation equipment': 'Industrials',
    // New Real Estate sub-industries
    'multi-family residential reits': 'Real Estate',
    'single-family residential reits': 'Real Estate',
    'timber reits': 'Real Estate',
    // 'data center reits', 'telecom tower reits', 'self-storage reits'
    //   — already mapped earlier; duplicates removed.
    'other specialized reits': 'Real Estate',
    // Financial restructuring
    'commercial mortgage reits': 'Financials',
    'residential mortgage reits': 'Financials',
    'commercial & residential mortgage finance': 'Financials',
    // Finnhub / EODHD top-level industry groupings
    'retail trade': 'Consumer Discretionary',
    'distribution services': 'Industrials',
    'industrial services': 'Industrials',
    'process industries': 'Materials',
    'non-energy minerals': 'Materials',
    'miscellaneous': 'Other' as unknown as GicsSector,
  };

  if (aliases[lower]) return aliases[lower] as string;

  // Partial match against sector names
  const partial = GICS_SECTORS.find(s => lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower));
  if (partial) return partial;

  // ── GICS hierarchy walk-up ──────────────────────────────────────────────
  // Handles cases where an industry group, industry, or sub-industry string is
  // stored as the sector (common with EODHD when GicSector is null but
  // GicGroup/GicIndustry are populated, and with Finnhub industry strings).
  // Walk: raw → industry group → sector
  //       raw → industry → industry group → sector

  // 1. Check if raw is a known industry group
  for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
    if (groups.some(g => g.toLowerCase() === lower)) {
      return sector as GicsSector;
    }
  }

  // 2. Check if raw is a known industry (→ get its group → get sector)
  for (const [group, industries] of Object.entries(GICS_INDUSTRIES)) {
    if (industries.some(i => i.toLowerCase() === lower)) {
      // Now find which sector owns this group
      for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
        if (groups.includes(group)) return sector as GicsSector;
      }
    }
  }

  // 3. Check if raw is a known sub-industry (→ industry → group → sector)
  for (const [industry, subIndustries] of Object.entries(GICS_SUB_INDUSTRIES)) {
    if (subIndustries.some(si => si.toLowerCase() === lower)) {
      // Find which group owns this industry
      for (const [group, industries] of Object.entries(GICS_INDUSTRIES)) {
        if (industries.includes(industry)) {
          // Find which sector owns this group
          for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
            if (groups.includes(group)) return sector as GicsSector;
          }
        }
      }
    }
  }

  // 4. Partial match against industry groups (handles truncated strings like
  //    "Automobiles & Components" → "Consumer Discretionary")
  for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
    if (groups.some(g => lower.includes(g.toLowerCase()) || g.toLowerCase().includes(lower))) {
      return sector as GicsSector;
    }
  }

  // 5. Partial match against industries
  for (const [group, industries] of Object.entries(GICS_INDUSTRIES)) {
    if (industries.some(i => lower.includes(i.toLowerCase()) || i.toLowerCase().includes(lower))) {
      for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
        if (groups.includes(group)) return sector as GicsSector;
      }
    }
  }

  // Nothing matched — return 'Other' so no raw/unknown string leaks through
  // as a phantom sector. normalizeSector always returns a valid sector name,
  // one of the 11 GICS sectors, 'ETFs', or 'Other'.
  return 'Other';
}

/**
 * Look up which GICS sector an industry group belongs to.
 */
export function sectorForIndustryGroup(industryGroup: string): GicsSector | null {
  for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
    if (groups.includes(industryGroup)) return sector as GicsSector;
  }
  return null;
}

/**
 * Look up which industry group an industry belongs to.
 */
export function industryGroupForIndustry(industry: string): string | null {
  for (const [group, industries] of Object.entries(GICS_INDUSTRIES)) {
    if (industries.includes(industry)) return group;
  }
  return null;
}

/**
 * Walk the GICS hierarchy from a sub-industry all the way up to its sector.
 * Sub-Industry → Industry → Industry Group → Sector
 * Returns null when the sub-industry isn't in the canonical map.
 */
export function sectorForSubIndustry(subIndustry: string): GicsSector | null {
  for (const [industry, subIndustries] of Object.entries(GICS_SUB_INDUSTRIES)) {
    if (subIndustries.includes(subIndustry)) {
      // found the industry — now walk up to sector
      for (const [group, industries] of Object.entries(GICS_INDUSTRIES)) {
        if (industries.includes(industry)) {
          for (const [sector, groups] of Object.entries(GICS_INDUSTRY_GROUPS)) {
            if (groups.includes(group)) return sector as GicsSector;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Get all sector colors as an ordered array (for charts that need indexed colors).
 * Includes the ETFs pseudo-sector as the 12th entry.
 */
export function getGicsSectorPalette(): string[] {
  return ALL_SECTORS.map(s => `hsl(${SECTOR_COLORS[s]})`);
}

/**
 * Map a list of sector names to their colors (for pie/donut charts).
 */
export function getSectorColorForIndex(sectors: string[]): string[] {
  return sectors.map(s => getGicsSectorColor(s));
}
