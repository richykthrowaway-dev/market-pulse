/**
 * International Sanctions Data
 *
 * Sanction levels are based on the current (2025) posture of the three main
 * multilateral/unilateral regimes:
 *   - UN Security Council sanctions (binding on all member states)
 *   - US OFAC / Treasury sanctions programs
 *   - EU Restrictive Measures (Council decisions)
 *
 * "critical"  — Comprehensive embargo by UN + US + EU; virtually all trade blocked.
 * "severe"    — Broad US and/or EU sanctions; major trade restrictions in place.
 * "moderate"  — Targeted / sectoral sanctions; some trade permitted with restrictions.
 *
 * Sources:
 *   https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn.xml (OFAC SDN)
 *   https://sanctionsmap.eu  (EU Sanctions Map)
 *   https://www.un.org/securitycouncil/sanctions/information
 */

export type SanctionLevel = 'critical' | 'severe' | 'moderate';

/**
 * ISO 3166-1 alpha-2 country codes mapped to their effective sanction level.
 * Only countries with active sanctions programs are listed; absence means no
 * comprehensive sanctions (bilateral trade restrictions may still exist).
 */
export const SANCTIONS: Record<string, SanctionLevel> = {
  // ── Critical: UN + US + EU comprehensive embargo ─────────────────────────
  KP: 'critical', // North Korea — UN Res. 1718/1874/2087/2094+, OFAC, EU
  IR: 'critical', // Iran — UN Res. 1737/1803/1929+, OFAC ITSR, EU
  SY: 'critical', // Syria — OFAC SYSR, EU Council Dec. 2011/273/CFSP+

  // ── Severe: Broad US and/or EU sanctions ─────────────────────────────────
  RU: 'severe',   // Russia — OFAC EO 14024/13685, EU (post-2022 invasion), G7
  BY: 'severe',   // Belarus — OFAC EO 13405/14038, EU Council Dec. 2012/642/CFSP
  CU: 'severe',   // Cuba — OFAC CACR (Cuban Assets Control Regulations), US embargo

  // ── Moderate: Targeted / sectoral / partial sanctions ────────────────────
  VE: 'moderate', // Venezuela — OFAC EO 13692/13808/13850; targeted officials + sectors
  MM: 'moderate', // Myanmar — OFAC EO 14014; targeted military/junta figures
  LY: 'moderate', // Libya — UN Res. 1970 arms embargo, OFAC, EU travel bans
  SD: 'moderate', // Sudan — OFAC SSSR (Sudan sanctions); arms embargo
  SS: 'moderate', // South Sudan — UN Res. 2206 arms embargo, OFAC, EU
  YE: 'moderate', // Yemen — UN Res. 2140 arms embargo, OFAC Houthi designations
  ZW: 'moderate', // Zimbabwe — OFAC EO 13469; targeted officials
  CF: 'moderate', // Central African Republic — UN Res. 2127 arms embargo, EU
  ML: 'moderate', // Mali — ECOWAS/UN Res. 2374 targeted sanctions, EU
  HT: 'moderate', // Haiti — UN Res. 2653 targeted sanctions, OFAC
  NI: 'moderate', // Nicaragua — OFAC NICA Act EO 13851; targeted officials
  SO: 'moderate', // Somalia — UN Res. 751/1844 arms embargo, OFAC, EU
};

/** Fill colors for globe/choropleth overlays. */
export const SANCTION_COLORS: Record<SanctionLevel, string> = {
  critical: 'rgba(220,38,38,0.70)',  // red-600 @ 70%
  severe:   'rgba(239,68,68,0.50)',  // red-500 @ 50%
  moderate: 'rgba(249,115,22,0.38)', // orange-500 @ 38%
};

/** Human-readable tooltip labels. */
export const SANCTION_LABELS: Record<SanctionLevel, string> = {
  critical: 'Comprehensive Embargo (UN + US + EU)',
  severe:   'Broad Sanctions (US / EU)',
  moderate: 'Targeted / Sectoral Sanctions',
};
