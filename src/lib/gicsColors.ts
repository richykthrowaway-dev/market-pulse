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
export const GICS_INDUSTRIES: Record<string, string[]> = {
  // Energy
  'Energy': ['Oil, Gas & Consumable Fuels', 'Energy Equipment & Services'],
  // Materials
  'Materials': ['Chemicals', 'Construction Materials', 'Containers & Packaging', 'Metals & Mining', 'Paper & Forest Products'],
  // Industrials
  'Capital Goods': ['Aerospace & Defense', 'Building Products', 'Construction & Engineering', 'Electrical Equipment', 'Industrial Conglomerates', 'Machinery', 'Trading Companies & Distributors'],
  'Commercial & Professional Services': ['Commercial Services & Supplies', 'Professional Services'],
  'Transportation': ['Air Freight & Logistics', 'Passenger Airlines', 'Marine Transportation', 'Ground Transportation', 'Transportation Infrastructure'],
  // Consumer Discretionary
  'Automobiles & Components': ['Automobile Manufacturers', 'Automobile Components'],
  'Consumer Durables & Apparel': ['Household Durables', 'Leisure Products', 'Textiles, Apparel & Luxury Goods'],
  'Consumer Services': ['Hotels, Restaurants & Leisure', 'Diversified Consumer Services'],
  'Consumer Discretionary Distribution & Retail': ['Distributors', 'Broadline Retail', 'Specialty Retail', 'Home Improvement Retail'],
  // Consumer Staples
  'Consumer Staples Distribution & Retail': ['Consumer Staples Merchandise Retail', 'Drug Retail', 'Food Distributors'],
  'Food, Beverage & Tobacco': ['Brewers', 'Distillers & Vintners', 'Soft Drinks & Non-alcoholic Beverages', 'Agricultural Products & Services', 'Packaged Foods & Meats', 'Tobacco'],
  'Household & Personal Products': ['Household Products', 'Personal Care Products'],
  // Health Care
  'Health Care Equipment & Services': ['Health Care Equipment & Supplies', 'Health Care Providers & Services', 'Health Care Technology'],
  'Pharmaceuticals, Biotechnology & Life Sciences': ['Biotechnology', 'Pharmaceuticals', 'Life Sciences Tools & Services'],
  // Financials
  'Banks': ['Diversified Banks', 'Regional Banks'],
  'Financial Services': ['Diversified Financial Services', 'Consumer Finance', 'Capital Markets', 'Mortgage Real Estate Investment Trusts (REITs)', 'Transaction & Payment Processing Services', 'Financial Exchanges & Data'],
  'Insurance': ['Insurance Brokers', 'Life & Health Insurance', 'Multi-line Insurance', 'Property & Casualty Insurance', 'Reinsurance'],
  // Information Technology
  'Software & Services': ['IT Consulting & Other Services', 'Internet Services & Infrastructure', 'Application Software', 'Systems Software'],
  'Technology Hardware & Equipment': ['Communications Equipment', 'Technology Hardware, Storage & Peripherals', 'Electronic Equipment, Instruments & Components'],
  'Semiconductors & Semiconductor Equipment': ['Semiconductor Materials & Equipment', 'Semiconductors'],
  // Communication Services
  'Telecommunication Services': ['Alternative Carriers', 'Integrated Telecommunication Services', 'Wireless Telecommunication Services'],
  'Media & Entertainment': ['Advertising', 'Broadcasting', 'Cable & Satellite', 'Publishing', 'Movies & Entertainment', 'Interactive Home Entertainment', 'Interactive Media & Services'],
  // Utilities
  'Utilities': ['Electric Utilities', 'Gas Utilities', 'Multi-Utilities', 'Water Utilities', 'Independent Power Producers & Energy Traders', 'Renewable Electricity'],
  // Real Estate
  'Equity Real Estate Investment Trusts (REITs)': [
    'Diversified REITs', 'Industrial REITs', 'Hotel & Resort REITs',
    'Office REITs', 'Health Care REITs', 'Residential REITs',
    'Retail REITs', 'Specialized REITs', 'Timber REITs', 'Other Specialized REITs',
    'Self-Storage REITs', 'Telecom Tower REITs', 'Data Center REITs',
  ],
  'Real Estate Management & Development': ['Diversified Real Estate Activities', 'Real Estate Operating Companies', 'Real Estate Development', 'Real Estate Services'],
};

/* ─── GICS 163 Sub-Industries (grouped by Industry) ─── */
export const GICS_SUB_INDUSTRIES: Record<string, string[]> = {
  // Energy
  'Oil, Gas & Consumable Fuels': ['Integrated Oil & Gas', 'Oil & Gas Exploration & Production', 'Oil & Gas Refining & Marketing', 'Oil & Gas Storage & Transportation', 'Coal & Consumable Fuels'],
  'Energy Equipment & Services': ['Oil & Gas Drilling', 'Oil & Gas Equipment & Services'],
  // Materials
  'Chemicals': ['Commodity Chemicals', 'Diversified Chemicals', 'Fertilizers & Agricultural Chemicals', 'Industrial Gases', 'Specialty Chemicals'],
  'Construction Materials': ['Construction Materials'],
  'Containers & Packaging': ['Metal, Glass & Plastic Containers', 'Paper & Plastic Packaging Products & Materials'],
  'Metals & Mining': ['Aluminum', 'Diversified Metals & Mining', 'Copper', 'Gold', 'Precious Metals & Minerals', 'Silver', 'Steel'],
  'Paper & Forest Products': ['Forest Products', 'Paper Products'],
  // Industrials
  'Aerospace & Defense': ['Aerospace & Defense'],
  'Building Products': ['Building Products'],
  'Construction & Engineering': ['Construction & Engineering'],
  'Electrical Equipment': ['Electrical Components & Equipment', 'Heavy Electrical Equipment'],
  'Industrial Conglomerates': ['Industrial Conglomerates'],
  'Machinery': ['Agricultural & Farm Machinery', 'Industrial Machinery & Supplies & Components'],
  'Trading Companies & Distributors': ['Trading Companies & Distributors'],
  'Commercial Services & Supplies': ['Commercial Printing', 'Environmental & Facilities Services', 'Office Services & Supplies', 'Diversified Support Services', 'Security & Alarm Services'],
  'Professional Services': ['Human Resource & Employment Services', 'Research & Consulting Services', 'Data Processing & Outsourced Services'],
  'Air Freight & Logistics': ['Air Freight & Logistics'],
  'Passenger Airlines': ['Passenger Airlines'],
  'Marine Transportation': ['Marine Transportation'],
  'Ground Transportation': ['Rail Transportation', 'Cargo Ground Transportation', 'Passenger Ground Transportation'],
  'Transportation Infrastructure': ['Airport Services', 'Highways & Railtracks', 'Marine Ports & Services'],
  // Consumer Discretionary
  'Automobile Manufacturers': ['Automobile Manufacturers'],
  'Automobile Components': ['Automotive Parts & Equipment', 'Tires & Rubber'],
  'Household Durables': ['Consumer Electronics', 'Home Furnishings', 'Homebuilding', 'Household Appliances', 'Housewares & Specialties'],
  'Leisure Products': ['Leisure Products'],
  'Textiles, Apparel & Luxury Goods': ['Apparel, Accessories & Luxury Goods', 'Footwear'],
  'Hotels, Restaurants & Leisure': ['Casinos & Gaming', 'Hotels, Resorts & Cruise Lines', 'Leisure Facilities', 'Restaurants'],
  'Diversified Consumer Services': ['Education Services', 'Specialized Consumer Services'],
  'Distributors': ['Distributors'],
  'Broadline Retail': ['Broadline Retail'],
  'Specialty Retail': ['Apparel Retail', 'Computer & Electronics Retail', 'Home Furnishing Retail', 'Other Specialty Retail', 'Automotive Retail'],
  'Home Improvement Retail': ['Home Improvement Retail'],
  // Consumer Staples
  'Consumer Staples Merchandise Retail': ['Hypermarkets & Super Centers', 'Food Retail'],
  'Drug Retail': ['Drug Retail'],
  'Food Distributors': ['Food Distributors'],
  'Brewers': ['Brewers'],
  'Distillers & Vintners': ['Distillers & Vintners'],
  'Soft Drinks & Non-alcoholic Beverages': ['Soft Drinks & Non-alcoholic Beverages'],
  'Agricultural Products & Services': ['Agricultural Products & Services'],
  'Packaged Foods & Meats': ['Packaged Foods', 'Meat, Poultry & Fish'],
  'Tobacco': ['Tobacco'],
  'Household Products': ['Household Products'],
  'Personal Care Products': ['Personal Care Products'],
  // Health Care
  'Health Care Equipment & Supplies': ['Health Care Equipment', 'Health Care Supplies'],
  'Health Care Providers & Services': ['Health Care Distributors', 'Health Care Services', 'Health Care Facilities', 'Managed Health Care'],
  'Health Care Technology': ['Health Care Technology'],
  'Biotechnology': ['Biotechnology'],
  'Pharmaceuticals': ['Pharmaceuticals'],
  'Life Sciences Tools & Services': ['Life Sciences Tools & Services'],
  // Financials
  'Diversified Banks': ['Diversified Banks'],
  'Regional Banks': ['Regional Banks'],
  'Diversified Financial Services': ['Multi-Sector Holdings', 'Specialized Finance'],
  'Consumer Finance': ['Consumer Finance'],
  'Capital Markets': ['Asset Management & Custody Banks', 'Investment Banking & Brokerage', 'Diversified Capital Markets', 'Financial Benchmarks'],
  'Transaction & Payment Processing Services': ['Transaction & Payment Processing Services'],
  'Financial Exchanges & Data': ['Financial Exchanges & Data'],
  'Insurance Brokers': ['Insurance Brokers'],
  'Life & Health Insurance': ['Life & Health Insurance'],
  'Multi-line Insurance': ['Multi-line Insurance'],
  'Property & Casualty Insurance': ['Property & Casualty Insurance'],
  'Reinsurance': ['Reinsurance'],
  // IT
  'IT Consulting & Other Services': ['IT Consulting & Other Services'],
  'Internet Services & Infrastructure': ['Internet Services & Infrastructure'],
  'Application Software': ['Application Software'],
  'Systems Software': ['Systems Software'],
  'Communications Equipment': ['Communications Equipment'],
  'Technology Hardware, Storage & Peripherals': ['Technology Hardware, Storage & Peripherals'],
  'Electronic Equipment, Instruments & Components': ['Electronic Equipment & Instruments', 'Electronic Components', 'Electronic Manufacturing Services'],
  'Semiconductor Materials & Equipment': ['Semiconductor Materials & Equipment'],
  'Semiconductors': ['Semiconductors'],
  // Communication Services
  'Alternative Carriers': ['Alternative Carriers'],
  'Integrated Telecommunication Services': ['Integrated Telecommunication Services'],
  'Wireless Telecommunication Services': ['Wireless Telecommunication Services'],
  'Advertising': ['Advertising'],
  'Broadcasting': ['Broadcasting'],
  'Cable & Satellite': ['Cable & Satellite'],
  'Publishing': ['Publishing'],
  'Movies & Entertainment': ['Movies & Entertainment'],
  'Interactive Home Entertainment': ['Interactive Home Entertainment'],
  'Interactive Media & Services': ['Interactive Media & Services'],
  // Utilities
  'Electric Utilities': ['Electric Utilities'],
  'Gas Utilities': ['Gas Utilities'],
  'Multi-Utilities': ['Multi-Utilities'],
  'Water Utilities': ['Water Utilities'],
  'Independent Power Producers & Energy Traders': ['Independent Power Producers & Energy Traders'],
  'Renewable Electricity': ['Renewable Electricity'],
  // Real Estate
  'Diversified REITs': ['Diversified REITs'],
  'Industrial REITs': ['Industrial REITs'],
  'Hotel & Resort REITs': ['Hotel & Resort REITs'],
  'Office REITs': ['Office REITs'],
  'Health Care REITs': ['Health Care REITs'],
  'Residential REITs': ['Residential REITs'],
  'Retail REITs': ['Retail REITs'],
  'Specialized REITs': ['Specialized REITs'],
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
export const STYLE_COLORS: Record<string, string> = {
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
  const aliases: Record<string, GicsSector> = {
    // IT
    'tech': 'Information Technology',
    'technology': 'Information Technology',
    'it': 'Information Technology',
    'electronic computers': 'Information Technology',
    'services-prepackaged software': 'Information Technology',
    'services-computer programming, data processing, etc.': 'Information Technology',
    'semiconductors & related devices': 'Information Technology',
    'computer communications equipment': 'Information Technology',
    'printed circuit boards': 'Information Technology',
    'electronic components, nec': 'Information Technology',
    // Health Care
    'healthcare': 'Health Care',
    'health': 'Health Care',
    'pharmaceutical preparations': 'Health Care',
    'surgical & medical instruments & apparatus': 'Health Care',
    'electromedical & electrotherapeutic apparatus': 'Health Care',
    'biological products, (no diagnostic substances)': 'Health Care',
    // Financials
    'finance': 'Financials',
    'financial': 'Financials',
    'banking': 'Financials',
    'national commercial banks': 'Financials',
    'state chartered banks, federal reserve members': 'Financials',
    'fire, marine & casualty insurance': 'Financials',
    'services-business services, nec': 'Financials',
    'security brokers, dealers & flotation companies': 'Financials',
    'investment advice': 'Financials',
    // Communication Services
    'telecom': 'Communication Services',
    'telecommunications': 'Communication Services',
    'media': 'Communication Services',
    'services-miscellaneous amusement & recreation': 'Communication Services',
    'services-video tape rental': 'Communication Services',
    'telephone communications (no radio telephone)': 'Communication Services',
    'cable & other pay television services': 'Communication Services',
    // Consumer Discretionary
    'consumer cyclical': 'Consumer Discretionary',
    'motor vehicles & passenger car bodies': 'Consumer Discretionary',
    'retail-catalog & mail-order houses': 'Consumer Discretionary',
    'retail-lumber & other building materials dealers': 'Consumer Discretionary',
    'retail-eating places': 'Consumer Discretionary',
    'hotels & motels': 'Consumer Discretionary',
    'retail-apparel & accessory stores': 'Consumer Discretionary',
    // Consumer Staples
    'consumer defensive': 'Consumer Staples',
    'beverages': 'Consumer Staples',
    'soap, detergents, cleang preparations, perfumes, cosmetics': 'Consumer Staples',
    'retail-grocery stores': 'Consumer Staples',
    'retail-variety stores': 'Consumer Staples',
    'grain mill products': 'Consumer Staples',
    'tobacco products': 'Consumer Staples',
    // Materials
    'basic materials': 'Materials',
    'plastic materials, synth resins & nonvulcan elastomers': 'Materials',
    'steel works, blast furnaces': 'Materials',
    'mining & quarrying of nonmetallic minerals (no fuels)': 'Materials',
    // Industrials
    'industrial': 'Industrials',
    'air transportation, scheduled': 'Industrials',
    'railroads, line-haul operating': 'Industrials',
    'farm machinery & equipment': 'Industrials',
    'general industrial machinery & equipment, nec': 'Industrials',
    // Energy
    'oil': 'Energy',
    'oil & gas': 'Energy',
    'crude petroleum & natural gas': 'Energy',
    'petroleum refining': 'Energy',
    // Utilities
    'utility': 'Utilities',
    'electric services': 'Utilities',
    'natural gas distribution': 'Utilities',
    // Real Estate
    'real estate': 'Real Estate',
    'reits': 'Real Estate',
    'real estate investment trusts': 'Real Estate',
    'land subdividers & developers (no cemeteries)': 'Real Estate',
  };

  if (aliases[lower]) return aliases[lower];

  // Partial match
  const partial = GICS_SECTORS.find(s => lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower));
  if (partial) return partial;

  return raw; // Return original if no match
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
 * Get all sector colors as an ordered array (for charts that need indexed colors).
 */
export function getGicsSectorPalette(): string[] {
  return GICS_SECTORS.map(s => `hsl(${SECTOR_COLORS[s]})`);
}

/**
 * Map a list of sector names to their colors (for pie/donut charts).
 */
export function getSectorColorForIndex(sectors: string[]): string[] {
  return sectors.map(s => getGicsSectorColor(s));
}
