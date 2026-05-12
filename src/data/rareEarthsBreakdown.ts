/**
 * Rare-earth-element (REE) breakdown.
 *
 * The "rare earths" commodity bloc is actually 17 chemically similar
 * elements — 15 lanthanides plus Yttrium and Scandium.  They almost
 * always occur together in the same ore deposits (monazite, bastnäsite,
 * ion-adsorption clays), but their economic value, price, and supply
 * concentration vary by 100×+ between elements.
 *
 * USGS classifies REEs as "light" (LREE: La–Eu) vs "heavy" (HREE: Gd–Lu + Y).
 * HREEs are scarcer, pricier, and far more concentrated geographically
 * (Myanmar + southern China ion-adsorption clays dominate).
 *
 * Pricing: there is no clean individual-element ETF.  The closest tradable
 * proxies are NdPr-focused producers:
 *   - MP.US   (MP Materials)        — Mountain Pass mine, NdPr concentrate
 *   - LYC.AX  (Lynas Rare Earths)   — only major non-Chinese NdPr producer
 *   - ILU.AX  (Iluka Resources)     — building Eneabba separation facility
 *   - UUUU.US (Energy Fuels)        — diversifying into REE + uranium
 *   - NEO.TO  (Neo Performance)     — downstream magnetic materials
 *
 * Sources: USGS Mineral Commodity Summaries 2024 + Adamas Intelligence.
 * Prices below are illustrative 2023–24 ranges from Asian Metal / SMM
 * (Shanghai), reported as $/kg oxide form.
 */

export type ReeClass = 'light' | 'heavy' | 'other';

/** End-use sector tags for filtering and display. */
export type ReeApplication =
  | 'magnets'      // NdFeB / SmCo permanent magnets
  | 'clean-energy' // EVs, wind turbines, green H₂
  | 'defense'      // F-35, missiles, radar, guidance
  | 'catalysts'    // FCC oil refining, automotive catalytic converters
  | 'phosphors'    // Lighting, displays, OLED
  | 'electronics'  // Semiconductors, data storage, fiber optics
  | 'medical'      // MRI, PET scans, cancer therapy
  | 'industrial';  // Aerospace alloys, ceramics, lasers

/** How hard it is to substitute this element in its primary use. */
export type ReeSubstitutability = 'none' | 'difficult' | 'possible';

/** Demand trajectory driven by macro/sector trends (2024–2030). */
export type ReeDemandTrend = 'rising' | 'stable' | 'declining';

export interface RareEarthElement {
  symbol:        string;
  name:          string;
  atomicNumber:  number;
  class:         ReeClass;

  /** Why it matters — primary economic use. */
  primaryUse: string;

  /** Approx 2023-24 price range, $/kg oxide. null if no public quote. */
  priceRangeUsd: [number, number] | null;

  /** Share of total REE-bloc market value (rough). */
  valueSharePct: number;

  /** Where the user can get exposure (tickers, or null if no public proxy). */
  proxy: string | null;

  /** Short note on supply concentration / risk. */
  supplyNote: string;

  // ── Added depth fields ─────────────────────────────────────────────────

  /** Primary end-use sectors — drives the application filter. */
  applications: ReeApplication[];

  /** On the US DoE 2023 Critical Materials List. */
  usCritical: boolean;

  /** On the EU Critical Raw Materials Act 2023 list. */
  euCritical: boolean;

  /** How substitutable is this element in its dominant use case. */
  substitutability: ReeSubstitutability;

  /** Demand trajectory to ~2030. */
  demandTrend: ReeDemandTrend;

  /**
   * China's approximate share of global MINING for this element (%).
   * Uses class-level estimate when element-specific data is unavailable.
   */
  miningChinaPct: number;

  /**
   * China's approximate share of global SEPARATION (chemical refining) (%).
   * Almost always higher than mining % — the key supply-chain chokepoint.
   * Even ore mined in the US/AU is often shipped to Chinese separators.
   */
  separationChinaPct: number;

  /** Key non-Chinese source, project, or contextual note. */
  keySource: string;
}

export const RARE_EARTH_ELEMENTS: RareEarthElement[] = [
  // ── Magnet rare earths (the economic engine — ~70% of REE value) ─────────
  {
    symbol: 'Nd', name: 'Neodymium',  atomicNumber: 60, class: 'light',
    primaryUse: 'NdFeB permanent magnets — EV motors, wind turbines, hard drives, headphones, speakers.',
    priceRangeUsd: [55, 95], valueSharePct: 40,
    proxy: 'MP.US · LYC.AX',
    supplyNote: 'Largest REE market by value. China ~60% of mining, ~85% of separated NdPr output.',
    applications:       ['magnets', 'clean-energy', 'defense', 'electronics'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'none',
    demandTrend:        'rising',
    miningChinaPct:     60,
    separationChinaPct: 85,
    keySource: 'Mountain Pass, CA (MP Materials) · Mt Weld, AU (Lynas) · Bayan Obo, CN',
  },
  {
    symbol: 'Pr', name: 'Praseodymium', atomicNumber: 59, class: 'light',
    primaryUse: 'Alloyed with Nd in NdPr magnets; aircraft engine superalloys; yellow glass pigments.',
    priceRangeUsd: [60, 90], valueSharePct: 10,
    proxy: 'MP.US · LYC.AX',
    supplyNote: 'Co-produced with Nd. Almost always sold as "NdPr oxide" mix. Inseparable supply chain.',
    applications:       ['magnets', 'clean-energy', 'defense', 'industrial'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'none',
    demandTrend:        'rising',
    miningChinaPct:     60,
    separationChinaPct: 85,
    keySource: 'Always co-mined with Nd; sold as NdPr blend. Same sources as Nd.',
  },
  {
    symbol: 'Dy', name: 'Dysprosium', atomicNumber: 66, class: 'heavy',
    primaryUse: 'Added to NdFeB magnets to preserve magnetism at high temperature — EV drive motors, F-35.',
    priceRangeUsd: [240, 450], valueSharePct: 12,
    proxy: 'LYC.AX (limited)',
    supplyNote: 'Heavy REE — 80%+ from Myanmar + southern China ion-adsorption clays. Highest geopolitical risk.',
    applications:       ['magnets', 'clean-energy', 'defense'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'difficult',
    demandTrend:        'rising',
    miningChinaPct:     80,
    separationChinaPct: 92,
    keySource: 'Myanmar (Wa State) clay deposits; Lynas Eneabba (AU) — first ex-China HREE separation',
  },
  {
    symbol: 'Tb', name: 'Terbium', atomicNumber: 65, class: 'heavy',
    primaryUse: 'High-temp NdFeB magnets (EV/wind additive), OLED green phosphor, magnetostrictive sensors.',
    priceRangeUsd: [950, 1900], valueSharePct: 8,
    proxy: null,
    supplyNote: 'Concentration risk near-identical to Dy. Used in F-35 fire control, advanced EV motors.',
    applications:       ['magnets', 'defense', 'phosphors', 'clean-energy'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'difficult',
    demandTrend:        'rising',
    miningChinaPct:     80,
    separationChinaPct: 93,
    keySource: 'Almost exclusively southern China + Myanmar. No Western commercial source exists.',
  },

  // ── Phosphors & specialty ─────────────────────────────────────────────────
  {
    symbol: 'Eu', name: 'Europium', atomicNumber: 63, class: 'light',
    primaryUse: 'Red phosphor in OLED/LED lighting; anti-counterfeit Euro-banknote fluorescent markers.',
    priceRangeUsd: [25, 50], valueSharePct: 2,
    proxy: null,
    supplyNote: 'Demand fell ~80% after CFL→LED transition but stabilised; still irreplaceable in specialty phosphors.',
    applications:       ['phosphors', 'electronics'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'declining',
    miningChinaPct:     62,
    separationChinaPct: 86,
    keySource: 'Mined as byproduct from monazite. Demand trough post-CFL; new OLED displays may revive.',
  },
  {
    symbol: 'Y', name: 'Yttrium', atomicNumber: 39, class: 'other',
    primaryUse: 'YAG laser crystals, YSZ ceramic turbine coatings (jet engines), phosphors, superconductors.',
    priceRangeUsd: [4, 9], valueSharePct: 3,
    proxy: null,
    supplyNote: 'Technically not a lanthanide, but grouped with HREEs. China ~72% of mining. Broad industrial use.',
    applications:       ['industrial', 'phosphors', 'electronics', 'medical'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     72,
    separationChinaPct: 88,
    keySource: 'Co-mined with Dy/Tb in southern China clays. Small deposits in India, Brazil, US.',
  },
  {
    symbol: 'Sc', name: 'Scandium', atomicNumber: 21, class: 'other',
    primaryUse: 'Al-Sc lightweight alloys (aerospace, sports), MIG-29 airframes, solid-oxide fuel cells (SOFC).',
    priceRangeUsd: [1500, 3000], valueSharePct: 1,
    proxy: 'CLF.US (byproduct)',
    supplyNote: 'Tiny volume, very high price. Byproduct of TiO₂ (Ukraine), uranium (Kaz.), Al smelting (CN).',
    applications:       ['industrial', 'clean-energy'],
    usCritical:         false,
    euCritical:         true,
    substitutability:   'difficult',
    demandTrend:        'rising',
    miningChinaPct:     66,
    separationChinaPct: 80,
    keySource: 'Ukraine (largest ex-China), Sumitomo/SCONI (AU), Energy Fuels (US byproduct)',
  },

  // ── Bulk / cerium-group (cheap but huge volume) ──────────────────────────
  {
    symbol: 'La', name: 'Lanthanum', atomicNumber: 57, class: 'light',
    primaryUse: 'FCC catalysts for oil refining, NiMH hybrid batteries (Toyota Prius), camera/telescope glass.',
    priceRangeUsd: [1, 3], valueSharePct: 4,
    proxy: 'MP.US (byproduct)',
    supplyNote: 'Co-produced with Ce. FCC catalyst demand softening as refineries close; NiMH losing to Li-ion.',
    applications:       ['catalysts', 'electronics', 'industrial'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'declining',
    miningChinaPct:     60,
    separationChinaPct: 85,
    keySource: 'Abundant; oversupply co-product of NdPr mining. Mountain Pass, Mt Weld. Price near floor.',
  },
  {
    symbol: 'Ce', name: 'Cerium', atomicNumber: 58, class: 'light',
    primaryUse: 'Glass/wafer polishing (CMP), auto-catalyst, UV-blocking glass, rouge for optics.',
    priceRangeUsd: [1, 3], valueSharePct: 3,
    proxy: 'MP.US (byproduct)',
    supplyNote: 'Most abundant REE (~50% of ore mass). Chronic oversupply when mining for NdPr. Often stockpiled.',
    applications:       ['catalysts', 'industrial', 'electronics'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     60,
    separationChinaPct: 85,
    keySource: 'Mountain Pass, Mt Weld, Bayan Obo. Dominant by ore volume. Low price limits new supply.',
  },
  {
    symbol: 'Sm', name: 'Samarium', atomicNumber: 62, class: 'light',
    primaryUse: 'SmCo permanent magnets for high-temperature defense (missile actuators, travelling-wave tubes).',
    priceRangeUsd: [2, 6], valueSharePct: 2,
    proxy: 'MP.US (byproduct)',
    supplyNote: 'SmCo holds magnetism above 200°C where NdFeB degrades — irreplaceable in missile guidance.',
    applications:       ['magnets', 'defense'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'none',
    demandTrend:        'stable',
    miningChinaPct:     60,
    separationChinaPct: 85,
    keySource: 'Mined as LREE byproduct; defense demand provides stable price floor despite small market.',
  },
  {
    symbol: 'Gd', name: 'Gadolinium', atomicNumber: 64, class: 'heavy',
    primaryUse: 'MRI contrast agents (Gd chelates), neutron-absorbing alloys, magneto-optical disks.',
    priceRangeUsd: [40, 90], valueSharePct: 1,
    proxy: null,
    supplyNote: 'Lightest HREE. Medical imaging drives a stable demand floor despite moderate supply concentration.',
    applications:       ['medical', 'electronics', 'industrial'],
    usCritical:         true,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     76,
    separationChinaPct: 88,
    keySource: 'Co-mined in southern China HREE clays. GE Healthcare, Bayer major downstream buyers.',
  },

  // ── Minor HREEs ──────────────────────────────────────────────────────────
  {
    symbol: 'Ho', name: 'Holmium',   atomicNumber: 67, class: 'heavy',
    primaryUse: 'Magnet-flux pole pieces in MRI, holmium surgical lasers (soft tissue, kidney stones).',
    priceRangeUsd: [70, 130],   valueSharePct: 0.4,
    proxy: null,
    supplyNote: 'Niche use; rarely produced standalone — byproduct of Dy/Tb separation runs.',
    applications:       ['medical', 'industrial'],
    usCritical:         false,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     78,
    separationChinaPct: 90,
    keySource: 'Produced as byproduct of HREE clay separation in China/Myanmar.',
  },
  {
    symbol: 'Er', name: 'Erbium',    atomicNumber: 68, class: 'heavy',
    primaryUse: 'Erbium-doped fiber amplifiers (EDFA) — amplify signals in long-haul fiber-optic cable.',
    priceRangeUsd: [40, 90],    valueSharePct: 0.4,
    proxy: null,
    supplyNote: 'No substitute for Er-doped EDFAs in submarine/intercontinental fiber cables.',
    applications:       ['electronics', 'industrial'],
    usCritical:         false,
    euCritical:         true,
    substitutability:   'difficult',
    demandTrend:        'rising',
    miningChinaPct:     78,
    separationChinaPct: 90,
    keySource: 'Internet infrastructure demand grows with fiber build-out. China dominates separation.',
  },
  {
    symbol: 'Tm', name: 'Thulium',   atomicNumber: 69, class: 'heavy',
    primaryUse: 'Portable X-ray sources (field medicine, security), surgical lasers (urology).',
    priceRangeUsd: [3000, 5000], valueSharePct: 0.1,
    proxy: null,
    supplyNote: 'Rarest stable lanthanide on Earth. Specialty market only; no volume commercial use.',
    applications:       ['medical', 'industrial'],
    usCritical:         false,
    euCritical:         false,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     80,
    separationChinaPct: 92,
    keySource: 'Extreme price limits applications. Produced in mg quantities as HREE byproduct.',
  },
  {
    symbol: 'Yb', name: 'Ytterbium', atomicNumber: 70, class: 'heavy',
    primaryUse: 'Yb-doped fiber lasers — industrial metal cutting/welding replacing CO₂ lasers.',
    priceRangeUsd: [25, 60],    valueSharePct: 0.3,
    proxy: null,
    supplyNote: 'Growing demand as high-power Yb fiber lasers take share from CO₂ lasers in factories.',
    applications:       ['industrial'],
    usCritical:         false,
    euCritical:         true,
    substitutability:   'possible',
    demandTrend:        'rising',
    miningChinaPct:     78,
    separationChinaPct: 90,
    keySource: 'IPG Photonics (US) largest fiber laser maker — sources Yb through Chinese supply chain.',
  },
  {
    symbol: 'Lu', name: 'Lutetium',  atomicNumber: 71, class: 'heavy',
    primaryUse: 'PET-scan LSO scintillator crystals; Lu-177 cancer radiotherapy (Lutathera/PSMA); petroleum cracking.',
    priceRangeUsd: [700, 1200],  valueSharePct: 0.3,
    proxy: null,
    supplyNote: 'Heaviest, densest stable lanthanide. Lu-177 isotope demand surging for targeted cancer therapy.',
    applications:       ['medical', 'catalysts'],
    usCritical:         false,
    euCritical:         true,
    substitutability:   'difficult',
    demandTrend:        'rising',
    miningChinaPct:     78,
    separationChinaPct: 92,
    keySource: 'Novartis Lutathera + Bayer PSMA-617 approvals are driving rapid demand growth.',
  },
  {
    symbol: 'Pm', name: 'Promethium', atomicNumber: 61, class: 'light',
    primaryUse: 'Radioactive — no stable isotopes. Historical use in luminous paint/nuclear batteries; commercially negligible.',
    priceRangeUsd: null, valueSharePct: 0,
    proxy: null,
    supplyNote: 'No commercial primary production. Listed only to complete the set of 17 REEs.',
    applications:       [],
    usCritical:         false,
    euCritical:         false,
    substitutability:   'possible',
    demandTrend:        'stable',
    miningChinaPct:     0,
    separationChinaPct: 0,
    keySource: 'Only produced in trace quantities in nuclear reactors. No mining supply chain.',
  },
];

export const REE_CLASS_LABEL: Record<ReeClass, string> = {
  light: 'Light (LREE)',
  heavy: 'Heavy (HREE)',
  other: 'Y / Sc',
};

/** Quick lookup: symbol → element record. */
const BY_SYMBOL: Map<string, RareEarthElement> = new Map(
  RARE_EARTH_ELEMENTS.map(e => [e.symbol, e]),
);
export function getReeBySymbol(symbol: string): RareEarthElement | undefined {
  return BY_SYMBOL.get(symbol);
}

/**
 * Country-level production shares broken out by Light vs Heavy REE.
 * The headline 68% China share masks two very different supply chains:
 *  - Light REE (Nd/Pr/Ce/La/Sm/Eu) — Bayan Obo (China), Mountain Pass (US),
 *    Mt Weld (Australia). Reasonable diversification underway.
 *  - Heavy REE (Dy/Tb/Y) — ion-adsorption clays of southern China + Myanmar.
 *    ~95% concentrated; almost no Western production.
 *
 * Source: USGS / Adamas Intelligence 2023 estimates.
 */
export interface ReeProducerShare {
  iso2:  string;
  share: number;
}
export const LIGHT_REE_PRODUCERS: ReeProducerShare[] = [
  { iso2: 'CN', share: 60.0 },
  { iso2: 'US', share: 14.0 },
  { iso2: 'AU', share:  6.0 },
  { iso2: 'MM', share:  4.5 },
  { iso2: 'TH', share:  2.5 },
  { iso2: 'MG', share:  1.6 },
  { iso2: 'IN', share:  1.1 },
  { iso2: 'RU', share:  0.9 },
];
export const HEAVY_REE_PRODUCERS: ReeProducerShare[] = [
  { iso2: 'CN', share: 80.0 },
  { iso2: 'MM', share: 15.0 }, // Myanmar ion-adsorption clays
  { iso2: 'TH', share:  1.5 },
  { iso2: 'AU', share:  1.2 },
  { iso2: 'VN', share:  0.6 },
  { iso2: 'US', share:  0.3 },
  { iso2: 'MG', share:  0.3 },
  { iso2: 'BR', share:  0.2 },
];

/** Parse the element-symbol list out of a name like
 *  "Rare earths (Nd, Dy, Tb)*" → ["Nd","Dy","Tb"]. Returns [] if none. */
export function extractReeSymbols(name: string): string[] {
  const m = name.match(/\(([^)]+)\)/);
  if (!m) return [];
  return m[1]
    .split(/[,/]/)
    .map(s => s.trim())
    .filter(s => BY_SYMBOL.has(s));
}
