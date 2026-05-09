/**
 * ISO 3166-1 alpha-2 → alpha-3 country code map.
 *
 * Comprehensive coverage of every country present in `COUNTRY_META`,
 * needed by APIs that require alpha-3 (e.g. World Bank WITS, EODHD
 * macro-indicator). The standard alpha-3 codes are mostly mechanical
 * derivations of the country name, but enough exceptions exist (UK
 * being GBR not UKD, etc.) that hardcoding is more reliable than
 * an algorithm.
 *
 * Source of truth: ISO 3166-1 (matches the World Bank's country
 * dimension values exactly).
 */
export const ISO2_TO_ISO3: Record<string, string> = {
  // ── Major economies ────────────────────────────────────────────────
  US: 'USA', GB: 'GBR', DE: 'DEU', FR: 'FRA', JP: 'JPN',
  CN: 'CHN', IN: 'IND', BR: 'BRA', CA: 'CAN', AU: 'AUS',
  IT: 'ITA', ES: 'ESP', MX: 'MEX', KR: 'KOR', RU: 'RUS',
  // ── Europe ─────────────────────────────────────────────────────────
  NL: 'NLD', CH: 'CHE', SE: 'SWE', NO: 'NOR', DK: 'DNK',
  FI: 'FIN', PL: 'POL', AT: 'AUT', BE: 'BEL', IE: 'IRL',
  PT: 'PRT', GR: 'GRC', CZ: 'CZE', HU: 'HUN', RO: 'ROU',
  SK: 'SVK', BG: 'BGR', RS: 'SRB', UA: 'UKR', HR: 'HRV',
  SI: 'SVN', LT: 'LTU', LV: 'LVA', EE: 'EST', IS: 'ISL',
  LU: 'LUX', AL: 'ALB', BA: 'BIH', BY: 'BLR', CY: 'CYP',
  MD: 'MDA', ME: 'MNE', MK: 'MKD', XK: 'XKX', // Kosovo (WB code)
  // ── Asia-Pacific ───────────────────────────────────────────────────
  HK: 'HKG', TW: 'TWN', SG: 'SGP', ID: 'IDN', TH: 'THA',
  MY: 'MYS', PH: 'PHL', VN: 'VNM', PK: 'PAK', NZ: 'NZL',
  BD: 'BGD', LK: 'LKA', KZ: 'KAZ', MM: 'MMR', KH: 'KHM',
  LA: 'LAO', NP: 'NPL', MN: 'MNG', BN: 'BRN', TL: 'TLS',
  AF: 'AFG', BT: 'BTN', UZ: 'UZB', KG: 'KGZ', TJ: 'TJK',
  TM: 'TKM', KP: 'PRK', AM: 'ARM', AZ: 'AZE', GE: 'GEO',
  // ── Middle East ────────────────────────────────────────────────────
  IL: 'ISR', AE: 'ARE', SA: 'SAU', TR: 'TUR', QA: 'QAT',
  KW: 'KWT', BH: 'BHR', OM: 'OMN', JO: 'JOR', LB: 'LBN',
  IR: 'IRN', IQ: 'IRQ', SY: 'SYR', YE: 'YEM', PS: 'PSE',
  // ── Africa ─────────────────────────────────────────────────────────
  ZA: 'ZAF', EG: 'EGY', NG: 'NGA', KE: 'KEN', MA: 'MAR',
  DZ: 'DZA', TN: 'TUN', LY: 'LBY', SD: 'SDN', SS: 'SSD',
  GH: 'GHA', CI: 'CIV', SN: 'SEN', ML: 'MLI', BF: 'BFA',
  NE: 'NER', TG: 'TGO', BJ: 'BEN', GN: 'GIN', SL: 'SLE',
  LR: 'LBR', GM: 'GMB', GW: 'GNB', CV: 'CPV', MR: 'MRT',
  ET: 'ETH', UG: 'UGA', TZ: 'TZA', RW: 'RWA', BI: 'BDI',
  ER: 'ERI', DJ: 'DJI', SO: 'SOM', CM: 'CMR', CF: 'CAF',
  TD: 'TCD', GQ: 'GNQ', GA: 'GAB', CG: 'COG', CD: 'COD',
  AO: 'AGO', ZM: 'ZMB', MW: 'MWI', MZ: 'MOZ', ZW: 'ZWE',
  BW: 'BWA', NA: 'NAM', SZ: 'SWZ', LS: 'LSO', MG: 'MDG',
  KM: 'COM', SC: 'SYC', MU: 'MUS', ST: 'STP',
  // ── Americas ───────────────────────────────────────────────────────
  AR: 'ARG', CL: 'CHL', CO: 'COL', PE: 'PER', VE: 'VEN',
  EC: 'ECU', BO: 'BOL', PY: 'PRY', UY: 'URY', GY: 'GUY',
  SR: 'SUR', GT: 'GTM', HN: 'HND', NI: 'NIC', CR: 'CRI',
  PA: 'PAN', SV: 'SLV', BZ: 'BLZ',
  CU: 'CUB', DO: 'DOM', HT: 'HTI', JM: 'JAM', BS: 'BHS',
  TT: 'TTO', PR: 'PRI', FK: 'FLK',
  // ── Pacific ────────────────────────────────────────────────────────
  FJ: 'FJI', PG: 'PNG', SB: 'SLB', VU: 'VUT', NC: 'NCL',
  // ── Other territories ──────────────────────────────────────────────
  GL: 'GRL', EH: 'ESH',
};

/** Convert ISO2 → ISO3, returning null for unmapped codes. */
export function toIso3(iso2: string | null | undefined): string | null {
  if (!iso2) return null;
  return ISO2_TO_ISO3[iso2.toUpperCase()] ?? null;
}
