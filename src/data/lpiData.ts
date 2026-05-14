/**
 * World Bank Logistics Performance Index (LPI) — 2023 edition
 *
 * The LPI is a benchmarking tool that measures trade-logistics performance
 * across six dimensions: customs efficiency, infrastructure quality,
 * international shipments, logistics competence, tracking & tracing, and
 * timeliness.  Scores range from 1 (worst) to 5 (best).
 *
 * Source: World Bank LPI 2023
 *   https://lpi.worldbank.org/
 *
 * ~60 countries are covered here, prioritising major trading economies and
 * notable outliers.  Missing countries should be treated as "no data".
 */

/** ISO 3166-1 alpha-2 → LPI overall score (1–5 scale). */
export const LPI_SCORES: Record<string, number> = {
  // ── Top tier (4.0 – 4.3) ──────────────────────────────────────────────────
  SG: 4.3, // Singapore
  DE: 4.3, // Germany
  DK: 4.2, // Denmark
  NL: 4.2, // Netherlands
  FI: 4.2, // Finland
  CH: 4.1, // Switzerland
  AT: 4.1, // Austria
  JP: 4.0, // Japan
  HK: 4.0, // Hong Kong SAR

  // ── Strong tier (3.7 – 3.9) ──────────────────────────────────────────────
  US: 3.9, // United States
  GB: 3.9, // United Kingdom
  FR: 3.9, // France
  AU: 3.8, // Australia
  CA: 3.8, // Canada
  SE: 3.8, // Sweden
  CN: 3.7, // China
  ES: 3.7, // Spain
  IT: 3.7, // Italy
  KR: 3.7, // South Korea
  IL: 3.7, // Israel

  // ── Solid tier (3.3 – 3.6) ───────────────────────────────────────────────
  AE: 3.6, // United Arab Emirates
  CZ: 3.6, // Czech Republic
  PL: 3.5, // Poland
  SA: 3.5, // Saudi Arabia
  MY: 3.4, // Malaysia
  ZA: 3.4, // South Africa
  TR: 3.3, // Türkiye
  BR: 3.3, // Brazil
  IN: 3.3, // India

  // ── Developing tier (2.9 – 3.2) ──────────────────────────────────────────
  MX: 3.2, // Mexico
  TH: 3.2, // Thailand
  MA: 3.1, // Morocco
  ID: 3.0, // Indonesia
  VN: 3.0, // Vietnam
  AR: 3.0, // Argentina
  EG: 2.9, // Egypt

  // ── Challenged tier (2.4 – 2.8) ──────────────────────────────────────────
  UA: 2.8, // Ukraine
  RU: 2.8, // Russia
  PK: 2.8, // Pakistan
  NG: 2.7, // Nigeria
  KE: 2.7, // Kenya
  BD: 2.7, // Bangladesh
  GH: 2.6, // Ghana
  TZ: 2.5, // Tanzania
  ET: 2.5, // Ethiopia
  SD: 2.4, // Sudan

  // ── Very low tier (<2.4) ─────────────────────────────────────────────────
  CD: 2.3, // DR Congo
  AF: 2.1, // Afghanistan
  YE: 2.1, // Yemen
};

/** Highest LPI score in the dataset — used to normalise visual scales. */
export const MAX_LPI = 4.3;

/**
 * Map an LPI score to an RGBA fill colour for choropleth/globe overlays.
 * Uses a blue→violet→amber→red gradient from high to low performance.
 */
export function lpiColor(score: number): string {
  if (score >= 4.0) return 'rgba(99,102,241,0.65)';  // indigo-500 — top tier
  if (score >= 3.5) return 'rgba(139,92,246,0.55)';  // violet-500 — strong
  if (score >= 3.0) return 'rgba(167,139,250,0.45)'; // violet-400 — solid
  if (score >= 2.5) return 'rgba(251,191,36,0.40)';  // amber-400  — developing
  return               'rgba(239,68,68,0.40)';        // red-500    — challenged
}
