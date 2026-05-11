/**
 * Sovereign credit ratings — curated snapshot.
 *
 * Three major agencies (Moody's / S&P / Fitch) rate sovereign debt on
 * letter-grade scales.  This file is a manually-maintained lookup, since
 * agency RSS feeds / paid APIs are out of scope for v1.
 *
 * Update cadence: refresh when a major agency takes an action.  Each
 * country entry carries its own `updated` timestamp ("YYYY-MM") so the
 * UI can warn the user about stale entries.
 *
 * ── Letter scale reference ────────────────────────────────────────────────
 *   Investment grade:
 *     S&P/Fitch:  AAA  AA+  AA  AA-  A+  A  A-  BBB+  BBB  BBB-
 *     Moody's:   Aaa  Aa1  Aa2  Aa3  A1  A2  A3  Baa1  Baa2  Baa3
 *
 *   Speculative grade:
 *     S&P/Fitch:  BB+  BB  BB-  B+  B  B-  CCC+  CCC  CCC-  CC  C  D
 *     Moody's:   Ba1  Ba2  Ba3  B1  B2  B3  Caa1  Caa2  Caa3  Ca  C
 *
 * Outlook indicates the agency's view on the next 12-24 months:
 *   - 'positive' — likely upgrade
 *   - 'stable'   — no change expected
 *   - 'negative' — likely downgrade
 */

export type RatingOutlook = 'positive' | 'stable' | 'negative';

export interface RatingEntry {
  rating:   string;
  outlook?: RatingOutlook;
}

export interface SovereignRating {
  moody:   RatingEntry;
  sp:      RatingEntry;
  fitch:   RatingEntry;
  /** Last-known refresh of this row.  "YYYY-MM" format. */
  updated: string;
}

/**
 * Numeric rank used to color-code badges and compare ratings.  Higher is
 * better.  AAA / Aaa = 22 (top), D / C = 1 (default).  Used internally —
 * not exposed in the UI.
 */
export const RATING_RANK: Record<string, number> = {
  // S&P / Fitch
  'AAA': 22, 'AA+': 21, 'AA': 20, 'AA-': 19,
  'A+': 18, 'A': 17, 'A-': 16,
  'BBB+': 15, 'BBB': 14, 'BBB-': 13,
  'BB+': 12, 'BB': 11, 'BB-': 10,
  'B+': 9, 'B': 8, 'B-': 7,
  'CCC+': 6, 'CCC': 5, 'CCC-': 4,
  'CC': 3, 'C': 2, 'D': 1,
  'SD': 1,
  // Moody's
  'Aaa': 22, 'Aa1': 21, 'Aa2': 20, 'Aa3': 19,
  'A1': 18, 'A2': 17, 'A3': 16,
  'Baa1': 15, 'Baa2': 14, 'Baa3': 13,
  'Ba1': 12, 'Ba2': 11, 'Ba3': 10,
  'B1': 9, 'B2': 8, 'B3': 7,
  'Caa1': 6, 'Caa2': 5, 'Caa3': 4,
  'Ca': 3,
  'NR': 0, '': 0,
};

/** True if the rating is investment grade (BBB-/Baa3 or higher). */
export function isInvestmentGrade(rating: string): boolean {
  return (RATING_RANK[rating] ?? 0) >= 13;
}

/**
 * Sovereign credit ratings as of early 2026.  Coverage ~75 countries —
 * the major economies + most middle-income markets.  Frontier and
 * unrated economies return undefined.
 */
export const SOVEREIGN_RATINGS: Record<string, SovereignRating> = {
  // ── AAA tier ─────────────────────────────────────────────────────────
  DE: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  NL: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  CH: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  DK: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  NO: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  SE: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  LU: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  SG: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  AU: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AAA', outlook: 'stable'   }, updated: '2025-08' },
  CA: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AAA', outlook: 'stable'   }, fitch: { rating: 'AA+', outlook: 'stable'   }, updated: '2025-08' },

  // ── US — Fitch downgraded 2023, Moody's 2025 ──────────────────────────
  US: { moody: { rating: 'Aa1', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA+', outlook: 'stable'   }, updated: '2025-08' },

  // ── AA / Aa tier ─────────────────────────────────────────────────────
  GB: { moody: { rating: 'Aa3', outlook: 'stable'   }, sp:    { rating: 'AA',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  FR: { moody: { rating: 'Aa3', outlook: 'negative' }, sp:    { rating: 'AA-', outlook: 'negative' }, fitch: { rating: 'AA-', outlook: 'negative' }, updated: '2025-09' },
  AT: { moody: { rating: 'Aa1', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA+', outlook: 'stable'   }, updated: '2025-08' },
  FI: { moody: { rating: 'Aa1', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA+', outlook: 'stable'   }, updated: '2025-08' },
  HK: { moody: { rating: 'Aa3', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  TW: { moody: { rating: 'Aa3', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA',  outlook: 'stable'   }, updated: '2025-08' },
  KR: { moody: { rating: 'Aa2', outlook: 'stable'   }, sp:    { rating: 'AA',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  NZ: { moody: { rating: 'Aaa', outlook: 'stable'   }, sp:    { rating: 'AA+', outlook: 'stable'   }, fitch: { rating: 'AA+', outlook: 'stable'   }, updated: '2025-08' },
  AE: { moody: { rating: 'Aa2', outlook: 'stable'   }, sp:    { rating: 'AA',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  KW: { moody: { rating: 'A1',  outlook: 'stable'   }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  QA: { moody: { rating: 'Aa2', outlook: 'stable'   }, sp:    { rating: 'AA',  outlook: 'stable'   }, fitch: { rating: 'AA',  outlook: 'stable'   }, updated: '2025-08' },
  BE: { moody: { rating: 'Aa3', outlook: 'stable'   }, sp:    { rating: 'AA',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },

  // ── A tier ────────────────────────────────────────────────────────────
  JP: { moody: { rating: 'A1',  outlook: 'stable'   }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'A',   outlook: 'stable'   }, updated: '2025-08' },
  IE: { moody: { rating: 'Aa3', outlook: 'positive' }, sp:    { rating: 'AA',  outlook: 'positive' }, fitch: { rating: 'AA',  outlook: 'stable'   }, updated: '2025-08' },
  IL: { moody: { rating: 'Baa1',outlook: 'negative' }, sp:    { rating: 'A',   outlook: 'negative' }, fitch: { rating: 'A',   outlook: 'negative' }, updated: '2025-08' },
  CN: { moody: { rating: 'A1',  outlook: 'negative' }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'A',   outlook: 'negative' }, updated: '2025-04' },
  SA: { moody: { rating: 'A1',  outlook: 'positive' }, sp:    { rating: 'A',   outlook: 'positive' }, fitch: { rating: 'A+',  outlook: 'stable'   }, updated: '2025-08' },
  CL: { moody: { rating: 'A2',  outlook: 'stable'   }, sp:    { rating: 'A',   outlook: 'stable'   }, fitch: { rating: 'A-',  outlook: 'stable'   }, updated: '2025-08' },
  PL: { moody: { rating: 'A2',  outlook: 'stable'   }, sp:    { rating: 'A-',  outlook: 'stable'   }, fitch: { rating: 'A-',  outlook: 'stable'   }, updated: '2025-08' },
  CZ: { moody: { rating: 'Aa3', outlook: 'stable'   }, sp:    { rating: 'AA-', outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  ES: { moody: { rating: 'Baa1',outlook: 'positive' }, sp:    { rating: 'A',   outlook: 'positive' }, fitch: { rating: 'A-',  outlook: 'stable'   }, updated: '2025-08' },
  EE: { moody: { rating: 'A1',  outlook: 'stable'   }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'AA-', outlook: 'stable'   }, updated: '2025-08' },
  LT: { moody: { rating: 'A2',  outlook: 'stable'   }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'A',   outlook: 'stable'   }, updated: '2025-08' },
  LV: { moody: { rating: 'A3',  outlook: 'stable'   }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'A-',  outlook: 'stable'   }, updated: '2025-08' },
  SK: { moody: { rating: 'A2',  outlook: 'negative' }, sp:    { rating: 'A+',  outlook: 'stable'   }, fitch: { rating: 'A-',  outlook: 'negative' }, updated: '2025-08' },
  SI: { moody: { rating: 'A3',  outlook: 'positive' }, sp:    { rating: 'AA-', outlook: 'stable'   }, fitch: { rating: 'A',   outlook: 'positive' }, updated: '2025-08' },
  MT: { moody: { rating: 'A2',  outlook: 'stable'   }, sp:    { rating: 'A-',  outlook: 'positive' }, fitch: { rating: 'A+',  outlook: 'stable'   }, updated: '2025-08' },
  IS: { moody: { rating: 'A1',  outlook: 'stable'   }, sp:    { rating: 'A',   outlook: 'stable'   }, fitch: { rating: 'A',   outlook: 'stable'   }, updated: '2025-08' },

  // ── BBB / Baa tier ───────────────────────────────────────────────────
  IT: { moody: { rating: 'Baa3',outlook: 'stable'   }, sp:    { rating: 'BBB+', outlook: 'stable'   }, fitch: { rating: 'BBB+',outlook: 'positive' }, updated: '2025-08' },
  PT: { moody: { rating: 'A3',  outlook: 'positive' }, sp:    { rating: 'A',   outlook: 'positive' }, fitch: { rating: 'A',   outlook: 'positive' }, updated: '2025-08' },
  IN: { moody: { rating: 'Baa3',outlook: 'stable'   }, sp:    { rating: 'BBB', outlook: 'stable'   }, fitch: { rating: 'BBB-',outlook: 'stable'   }, updated: '2025-08' },
  ID: { moody: { rating: 'Baa2',outlook: 'stable'   }, sp:    { rating: 'BBB', outlook: 'stable'   }, fitch: { rating: 'BBB', outlook: 'stable'   }, updated: '2025-08' },
  TH: { moody: { rating: 'Baa1',outlook: 'stable'   }, sp:    { rating: 'BBB+', outlook: 'stable'   }, fitch: { rating: 'BBB+',outlook: 'stable'   }, updated: '2025-08' },
  PH: { moody: { rating: 'Baa2',outlook: 'stable'   }, sp:    { rating: 'BBB+', outlook: 'stable'   }, fitch: { rating: 'BBB', outlook: 'stable'   }, updated: '2025-08' },
  MX: { moody: { rating: 'Baa2',outlook: 'negative' }, sp:    { rating: 'BBB', outlook: 'stable'   }, fitch: { rating: 'BBB-',outlook: 'stable'   }, updated: '2025-08' },
  PE: { moody: { rating: 'Baa1',outlook: 'negative' }, sp:    { rating: 'BBB-',outlook: 'negative' }, fitch: { rating: 'BBB', outlook: 'negative' }, updated: '2025-08' },
  HU: { moody: { rating: 'Baa2',outlook: 'negative' }, sp:    { rating: 'BBB-',outlook: 'stable'   }, fitch: { rating: 'BBB', outlook: 'negative' }, updated: '2025-08' },
  RO: { moody: { rating: 'Baa3',outlook: 'negative' }, sp:    { rating: 'BBB-',outlook: 'negative' }, fitch: { rating: 'BBB-',outlook: 'negative' }, updated: '2025-08' },
  HR: { moody: { rating: 'A3',  outlook: 'stable'   }, sp:    { rating: 'A-',  outlook: 'positive' }, fitch: { rating: 'A-',  outlook: 'stable'   }, updated: '2025-08' },
  BG: { moody: { rating: 'Baa1',outlook: 'stable'   }, sp:    { rating: 'BBB', outlook: 'positive' }, fitch: { rating: 'BBB', outlook: 'positive' }, updated: '2025-08' },
  CR: { moody: { rating: 'Ba2', outlook: 'positive' }, sp:    { rating: 'BB',  outlook: 'positive' }, fitch: { rating: 'BB',  outlook: 'positive' }, updated: '2025-08' },
  UY: { moody: { rating: 'Baa1',outlook: 'stable'   }, sp:    { rating: 'BBB+', outlook: 'stable'   }, fitch: { rating: 'BBB', outlook: 'stable'   }, updated: '2025-08' },
  PA: { moody: { rating: 'Ba1', outlook: 'stable'   }, sp:    { rating: 'BB+', outlook: 'stable'   }, fitch: { rating: 'BB+', outlook: 'stable'   }, updated: '2025-08' },

  // ── BB / Ba tier ─────────────────────────────────────────────────────
  GR: { moody: { rating: 'Baa3',outlook: 'positive' }, sp:    { rating: 'BBB', outlook: 'stable'   }, fitch: { rating: 'BBB-',outlook: 'positive' }, updated: '2025-08' },
  ZA: { moody: { rating: 'Ba2', outlook: 'positive' }, sp:    { rating: 'BB-', outlook: 'positive' }, fitch: { rating: 'BB',  outlook: 'stable'   }, updated: '2025-08' },
  BR: { moody: { rating: 'Ba1', outlook: 'positive' }, sp:    { rating: 'BB',  outlook: 'positive' }, fitch: { rating: 'BB',  outlook: 'stable'   }, updated: '2025-08' },
  CO: { moody: { rating: 'Baa2',outlook: 'negative' }, sp:    { rating: 'BB+', outlook: 'stable'   }, fitch: { rating: 'BB+', outlook: 'stable'   }, updated: '2025-08' },
  VN: { moody: { rating: 'Ba2', outlook: 'stable'   }, sp:    { rating: 'BB+', outlook: 'stable'   }, fitch: { rating: 'BB+', outlook: 'stable'   }, updated: '2025-08' },
  MA: { moody: { rating: 'Ba1', outlook: 'stable'   }, sp:    { rating: 'BB+', outlook: 'positive' }, fitch: { rating: 'BB+', outlook: 'stable'   }, updated: '2025-08' },
  DO: { moody: { rating: 'Ba3', outlook: 'positive' }, sp:    { rating: 'BB',  outlook: 'stable'   }, fitch: { rating: 'BB-', outlook: 'positive' }, updated: '2025-08' },
  GT: { moody: { rating: 'Ba1', outlook: 'stable'   }, sp:    { rating: 'BB+', outlook: 'stable'   }, fitch: { rating: 'BB',  outlook: 'stable'   }, updated: '2025-08' },
  RS: { moody: { rating: 'Ba2', outlook: 'positive' }, sp:    { rating: 'BB+', outlook: 'positive' }, fitch: { rating: 'BB+', outlook: 'positive' }, updated: '2025-08' },
  PY: { moody: { rating: 'Ba1', outlook: 'positive' }, sp:    { rating: 'BB',  outlook: 'stable'   }, fitch: { rating: 'BB+', outlook: 'stable'   }, updated: '2025-08' },

  // ── B tier ────────────────────────────────────────────────────────────
  TR: { moody: { rating: 'B1',  outlook: 'positive' }, sp:    { rating: 'BB-', outlook: 'stable'   }, fitch: { rating: 'BB-', outlook: 'stable'   }, updated: '2025-08' },
  EG: { moody: { rating: 'Caa1',outlook: 'positive' }, sp:    { rating: 'B-',  outlook: 'positive' }, fitch: { rating: 'B',   outlook: 'stable'   }, updated: '2025-08' },
  NG: { moody: { rating: 'Caa1',outlook: 'positive' }, sp:    { rating: 'B-',  outlook: 'stable'   }, fitch: { rating: 'B',   outlook: 'stable'   }, updated: '2025-08' },
  KE: { moody: { rating: 'Caa1',outlook: 'positive' }, sp:    { rating: 'B-',  outlook: 'stable'   }, fitch: { rating: 'B-',  outlook: 'stable'   }, updated: '2025-08' },
  PK: { moody: { rating: 'Caa2',outlook: 'positive' }, sp:    { rating: 'CCC+', outlook: 'stable'   }, fitch: { rating: 'CCC+',outlook: 'stable'   }, updated: '2025-08' },
  AR: { moody: { rating: 'Caa3',outlook: 'positive' }, sp:    { rating: 'CCC', outlook: 'positive' }, fitch: { rating: 'CCC',  outlook: 'stable'   }, updated: '2025-08' },
  UA: { moody: { rating: 'Ca',  outlook: 'stable'   }, sp:    { rating: 'CCC',outlook: 'stable'   }, fitch: { rating: 'CC',  outlook: 'stable'   }, updated: '2025-08' },
  GH: { moody: { rating: 'Ca',  outlook: 'positive' }, sp:    { rating: 'CCC+', outlook: 'positive' }, fitch: { rating: 'CCC',  outlook: 'stable'   }, updated: '2025-08' },
  LB: { moody: { rating: 'C',   outlook: 'stable'   }, sp:    { rating: 'SD',  outlook: 'stable'   }, fitch: { rating: 'RD',  outlook: 'stable'   }, updated: '2024-12' },
};

export function getSovereignRating(iso2: string): SovereignRating | null {
  return SOVEREIGN_RATINGS[iso2.toUpperCase()] ?? null;
}
