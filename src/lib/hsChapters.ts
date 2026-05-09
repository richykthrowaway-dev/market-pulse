/**
 * HS (Harmonized System) Chapter & Section reference data.
 *
 * The HS classification has 21 Sections (I-XXI) which group 99 Chapters
 * (HS 2-digit codes). The 1988 HS treaty pinned these definitions; new
 * editions occasionally split or merge subheadings but Sections and
 * Chapters have been stable for 30+ years. This file is the canonical
 * source-of-truth for our UI — no API call needed.
 *
 * Chapter names are paraphrased from the WCO official titles (kept short
 * for tooltip readability — full titles can run 200+ characters).
 *
 * The WITS Trade Stats API uses its own grouped-section labels like
 * "Mach and Elec" or "Transportation" which combine 1-2 HS sections
 * each. We map WITS section codes → our Section IDs to align the two.
 */

/** HS 2-digit chapter → human-readable name (paraphrased from WCO titles). */
export const HS_CHAPTER_NAMES: Record<string, string> = {
  // Section I — Live animals; animal products
  '01': 'Live animals',
  '02': 'Meat',
  '03': 'Fish & seafood',
  '04': 'Dairy, eggs, honey',
  '05': 'Other animal products',
  // Section II — Vegetable products
  '06': 'Live trees & flowers',
  '07': 'Vegetables',
  '08': 'Fruits & nuts',
  '09': 'Coffee, tea, spices',
  '10': 'Cereals',
  '11': 'Milling products',
  '12': 'Oil seeds & grains',
  '13': 'Resins & plant extracts',
  '14': 'Other vegetable products',
  // Section III — Animal/vegetable fats & oils
  '15': 'Fats & oils',
  // Section IV — Prepared foodstuffs; beverages; tobacco
  '16': 'Prepared meats & fish',
  '17': 'Sugars & confectionery',
  '18': 'Cocoa & chocolate',
  '19': 'Cereals, flour, pastry',
  '20': 'Prepared vegetables/fruit',
  '21': 'Misc. edible preparations',
  '22': 'Beverages, spirits, vinegar',
  '23': 'Animal feed',
  '24': 'Tobacco',
  // Section V — Mineral products
  '25': 'Salt, sulfur, stone',
  '26': 'Ores, slag, ash',
  '27': 'Mineral fuels & oils',
  // Section VI — Chemicals
  '28': 'Inorganic chemicals',
  '29': 'Organic chemicals',
  '30': 'Pharmaceuticals',
  '31': 'Fertilizers',
  '32': 'Dyes, pigments, paints',
  '33': 'Cosmetics & perfumes',
  '34': 'Soaps, waxes, lubricants',
  '35': 'Albumins, starches, glues',
  '36': 'Explosives & matches',
  '37': 'Photographic supplies',
  '38': 'Misc. chemicals',
  // Section VII — Plastics & rubber
  '39': 'Plastics',
  '40': 'Rubber',
  // Section VIII — Hides, skins, leather, fur
  '41': 'Raw hides & skins',
  '42': 'Leather goods',
  '43': 'Furs & artificial fur',
  // Section IX — Wood & cork
  '44': 'Wood',
  '45': 'Cork',
  '46': 'Straw & wickerwork',
  // Section X — Pulp & paper
  '47': 'Wood pulp',
  '48': 'Paper & paperboard',
  '49': 'Books, newspapers, prints',
  // Section XI — Textiles & clothing
  '50': 'Silk',
  '51': 'Wool',
  '52': 'Cotton',
  '53': 'Other vegetable fibers',
  '54': 'Synthetic filaments',
  '55': 'Synthetic staple fibers',
  '56': 'Wadding, felt, rope',
  '57': 'Carpets',
  '58': 'Special woven fabrics',
  '59': 'Coated fabrics',
  '60': 'Knitted fabrics',
  '61': 'Knitted apparel',
  '62': 'Woven apparel',
  '63': 'Other textile articles',
  // Section XII — Footwear, headgear, umbrellas
  '64': 'Footwear',
  '65': 'Headgear',
  '66': 'Umbrellas & walking sticks',
  '67': 'Feathers, artificial flowers',
  // Section XIII — Stone, ceramic, glass
  '68': 'Stone, plaster, cement',
  '69': 'Ceramics',
  '70': 'Glass',
  // Section XIV — Pearls, precious metals & stones
  '71': 'Pearls, gems, precious metals',
  // Section XV — Base metals
  '72': 'Iron & steel',
  '73': 'Iron & steel articles',
  '74': 'Copper',
  '75': 'Nickel',
  '76': 'Aluminum',
  '78': 'Lead',
  '79': 'Zinc',
  '80': 'Tin',
  '81': 'Other base metals',
  '82': 'Tools & cutlery',
  '83': 'Misc. metal articles',
  // Section XVI — Machinery & electrical equipment
  '84': 'Industrial machinery',
  '85': 'Electrical equipment',
  // Section XVII — Vehicles, aircraft, vessels
  '86': 'Railway equipment',
  '87': 'Vehicles (road)',
  '88': 'Aircraft & spacecraft',
  '89': 'Ships & boats',
  // Section XVIII — Optical, medical, precision
  '90': 'Optical & medical instruments',
  '91': 'Clocks & watches',
  '92': 'Musical instruments',
  // Section XIX — Arms & ammunition
  '93': 'Arms & ammunition',
  // Section XX — Miscellaneous manufactured
  '94': 'Furniture, lighting',
  '95': 'Toys, games, sports',
  '96': 'Misc. manufactured articles',
  // Section XXI — Works of art, antiques
  '97': 'Art & antiques',
  // Special category
  '99': 'Special / unclassified',
};

/**
 * Map WITS Section codes (their own naming) → list of HS 2-digit chapters
 * that fall within that section. Lets us cross-reference WITS aggregates
 * to Comtrade's chapter-level data.
 *
 * WITS uses these top-level Section labels (verified from live API):
 *   01-05_Animal       → Animal & animal products
 *   06-15_Vegetable    → Vegetables / animal & vegetable fats
 *   16-24_FoodProd     → Prepared foodstuffs
 *   25-26_Minerals     → Mineral products (raw)
 *   27-27_Fuels        → Mineral fuels (oil/gas/coal)
 *   28-38_Chemicals    → Chemicals
 *   39-40_PlastiRub    → Plastics & rubber
 *   41-43_HidesSkin    → Hides & skins
 *   44-49_Wood         → Wood + paper
 *   50-63_TextCloth    → Textiles & clothing
 *   64-67_Footwear     → Footwear & headgear
 *   68-71_StoneGlass   → Stone, glass, gems
 *   72-83_Metals       → Base metals
 *   84-85_MachElec     → Machinery & electrical equipment
 *   86-89_Transport    → Transportation (vehicles, aircraft, ships)
 *   90-99_Miscellan    → Misc. (precision, art, etc.)
 */
export const WITS_SECTION_CHAPTERS: Record<string, string[]> = {
  '01-05_Animal':     ['01', '02', '03', '04', '05'],
  '06-15_Vegetable':  ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15'],
  '16-24_FoodProd':   ['16', '17', '18', '19', '20', '21', '22', '23', '24'],
  '25-26_Minerals':   ['25', '26'],
  '27-27_Fuels':      ['27'],
  '28-38_Chemicals':  ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'],
  '39-40_PlastiRub':  ['39', '40'],
  '41-43_HidesSkin':  ['41', '42', '43'],
  '44-49_Wood':       ['44', '45', '46', '47', '48', '49'],
  '50-63_TextCloth':  ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63'],
  '64-67_Footwear':   ['64', '65', '66', '67'],
  '68-71_StoneGlass': ['68', '69', '70', '71'],
  '72-83_Metals':     ['72', '73', '74', '75', '76', '78', '79', '80', '81', '82', '83'],
  '84-85_MachElec':   ['84', '85'],
  '86-89_Transport':  ['86', '87', '88', '89'],
  '90-99_Miscellan':  ['90', '91', '92', '93', '94', '95', '96', '97', '99'],
};

/**
 * Friendlier display name for a WITS section code. Some of WITS' raw
 * names are awkward abbreviations; this map gives them a human voice.
 */
export const WITS_SECTION_DISPLAY: Record<string, string> = {
  '01-05_Animal':     'Animal Products',
  '06-15_Vegetable':  'Vegetable Products',
  '16-24_FoodProd':   'Food Products',
  '25-26_Minerals':   'Minerals',
  '27-27_Fuels':      'Fuels',
  '28-38_Chemicals':  'Chemicals',
  '39-40_PlastiRub':  'Plastics & Rubber',
  '41-43_HidesSkin':  'Hides & Leather',
  '44-49_Wood':       'Wood & Paper',
  '50-63_TextCloth':  'Textiles & Clothing',
  '64-67_Footwear':   'Footwear & Headgear',
  '68-71_StoneGlass': 'Stone, Glass, Gems',
  '72-83_Metals':     'Metals',
  '84-85_MachElec':   'Machinery & Electronics',
  '86-89_Transport':  'Transportation',
  '90-99_Miscellan':  'Precision & Misc.',
};

/** Look up a chapter's display name; falls back to "HS XX" for unknowns. */
export function chapterName(code: string): string {
  // Comtrade returns codes as numeric strings ("84") OR padded ("8") — normalise
  const padded = code.padStart(2, '0');
  return HS_CHAPTER_NAMES[padded] ?? `HS ${padded}`;
}

/** Look up a section's display name; falls back to the raw code. */
export function sectionName(code: string): string {
  return WITS_SECTION_DISPLAY[code] ?? code.replace(/^[\d-]+_/, '');
}
