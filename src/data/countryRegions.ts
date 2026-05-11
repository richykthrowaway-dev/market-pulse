/**
 * ISO-3166-1 alpha-2 → World Bank region aggregate code.
 *
 * The World Bank groups every country into one of these 7 primary regions
 * (the "all income levels" variant; codes ending in -X are the "developing"
 * subset which we deliberately don't use — we want the regional total).
 *
 *   EAS  East Asia & Pacific
 *   ECS  Europe & Central Asia
 *   LCN  Latin America & Caribbean
 *   MEA  Middle East & North Africa
 *   NAC  North America
 *   SAS  South Asia
 *   SSF  Sub-Saharan Africa
 *
 * The World Bank's indicator API accepts these codes in place of an ISO2
 * country code, returning the aggregate value (population-weighted in
 * most cases).  Used by the Compare view to render "country vs region vs
 * world" scorecards.
 */

export type WBRegionCode = 'EAS' | 'ECS' | 'LCN' | 'MEA' | 'NAC' | 'SAS' | 'SSF';

export const WB_REGION_LABEL: Record<WBRegionCode, string> = {
  EAS: 'East Asia & Pacific',
  ECS: 'Europe & Central Asia',
  LCN: 'Latin America & Caribbean',
  MEA: 'Middle East & North Africa',
  NAC: 'North America',
  SAS: 'South Asia',
  SSF: 'Sub-Saharan Africa',
};

/** World aggregate code accepted by the same indicator API. */
export const WB_WORLD: 'WLD' = 'WLD';

export const COUNTRY_TO_WB_REGION: Record<string, WBRegionCode> = {
  // North America
  US: 'NAC', CA: 'NAC', MX: 'LCN', BM: 'NAC',

  // Europe & Central Asia
  GB: 'ECS', DE: 'ECS', FR: 'ECS', IT: 'ECS', ES: 'ECS', NL: 'ECS', CH: 'ECS',
  SE: 'ECS', NO: 'ECS', DK: 'ECS', FI: 'ECS', IS: 'ECS', IE: 'ECS', BE: 'ECS',
  AT: 'ECS', PT: 'ECS', GR: 'ECS', PL: 'ECS', CZ: 'ECS', SK: 'ECS', HU: 'ECS',
  RO: 'ECS', BG: 'ECS', HR: 'ECS', SI: 'ECS', RS: 'ECS', BA: 'ECS', AL: 'ECS',
  MK: 'ECS', ME: 'ECS', XK: 'ECS', MD: 'ECS', UA: 'ECS', BY: 'ECS', RU: 'ECS',
  TR: 'ECS', LU: 'ECS', LI: 'ECS', MT: 'ECS', CY: 'ECS', EE: 'ECS', LV: 'ECS',
  LT: 'ECS', AD: 'ECS', SM: 'ECS', MC: 'ECS', VA: 'ECS',
  AM: 'ECS', AZ: 'ECS', GE: 'ECS', KZ: 'ECS', KG: 'ECS', TJ: 'ECS', TM: 'ECS', UZ: 'ECS',

  // East Asia & Pacific
  CN: 'EAS', JP: 'EAS', KR: 'EAS', TW: 'EAS', HK: 'EAS', MO: 'EAS',
  AU: 'EAS', NZ: 'EAS', SG: 'EAS', MY: 'EAS', ID: 'EAS', PH: 'EAS', TH: 'EAS',
  VN: 'EAS', KH: 'EAS', LA: 'EAS', MM: 'EAS', BN: 'EAS', MN: 'EAS', KP: 'EAS',
  PG: 'EAS', FJ: 'EAS', SB: 'EAS', VU: 'EAS', WS: 'EAS', TO: 'EAS', NC: 'EAS',
  PF: 'EAS', TL: 'EAS', PW: 'EAS', FM: 'EAS', MH: 'EAS', KI: 'EAS', NR: 'EAS', TV: 'EAS',

  // South Asia
  IN: 'SAS', PK: 'SAS', BD: 'SAS', LK: 'SAS', NP: 'SAS', BT: 'SAS', MV: 'SAS', AF: 'SAS',

  // Middle East & North Africa
  SA: 'MEA', AE: 'MEA', QA: 'MEA', KW: 'MEA', BH: 'MEA', OM: 'MEA', YE: 'MEA',
  IL: 'MEA', PS: 'MEA', JO: 'MEA', LB: 'MEA', SY: 'MEA', IQ: 'MEA', IR: 'MEA',
  EG: 'MEA', LY: 'MEA', TN: 'MEA', DZ: 'MEA', MA: 'MEA',

  // Sub-Saharan Africa
  NG: 'SSF', ZA: 'SSF', KE: 'SSF', ET: 'SSF', GH: 'SSF', SN: 'SSF', CI: 'SSF',
  CM: 'SSF', UG: 'SSF', TZ: 'SSF', AO: 'SSF', MZ: 'SSF', ZM: 'SSF', ZW: 'SSF',
  RW: 'SSF', BJ: 'SSF', BF: 'SSF', ML: 'SSF', NE: 'SSF', TD: 'SSF', GM: 'SSF',
  GN: 'SSF', SL: 'SSF', LR: 'SSF', TG: 'SSF', MG: 'SSF', MW: 'SSF', BI: 'SSF',
  ER: 'SSF', SO: 'SSF', SS: 'SSF', SD: 'SSF', DJ: 'SSF', CF: 'SSF', CG: 'SSF',
  CD: 'SSF', GA: 'SSF', GQ: 'SSF', GW: 'SSF', CV: 'SSF', ST: 'SSF', MR: 'SSF',
  KM: 'SSF', SC: 'SSF', MU: 'SSF', NA: 'SSF', BW: 'SSF', LS: 'SSF', SZ: 'SSF',

  // Latin America & Caribbean
  BR: 'LCN', AR: 'LCN', CL: 'LCN', CO: 'LCN', PE: 'LCN', VE: 'LCN', EC: 'LCN',
  BO: 'LCN', UY: 'LCN', PY: 'LCN', GY: 'LCN', SR: 'LCN', GF: 'LCN',
  PA: 'LCN', CR: 'LCN', GT: 'LCN', HN: 'LCN', SV: 'LCN', NI: 'LCN', BZ: 'LCN',
  CU: 'LCN', DO: 'LCN', HT: 'LCN', JM: 'LCN', BS: 'LCN', BB: 'LCN', TT: 'LCN',
  AG: 'LCN', DM: 'LCN', GD: 'LCN', KN: 'LCN', LC: 'LCN', VC: 'LCN',
};

export function getRegionFor(iso2: string): WBRegionCode | null {
  return COUNTRY_TO_WB_REGION[iso2.toUpperCase()] ?? null;
}
