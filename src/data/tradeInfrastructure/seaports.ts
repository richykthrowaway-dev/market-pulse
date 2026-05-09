import type { Seaport } from './types';

/**
 * Curated seed list of globally significant seaports.
 *
 * Coverage logic:
 *   - Top 15 container ports by TEU (Shanghai → Tanger Med)
 *   - Major energy/bulk hubs (Ras Tanura, Port Hedland)
 *   - Strategic chokepoint-adjacent ports (Singapore, Suez, Panama)
 *   - Western-hemisphere gateways (LA, Long Beach, NYNJ, Santos)
 *
 * Importance: 0–100 curated score, calibrated so the world's #1 (Shanghai)
 * sits at 100 and feeder ports start around ~60. Replaceable with the
 * UNCTAD Liner Shipping Connectivity Index (LSCI) when wired in.
 *
 * Lat/lng sourced from Wikipedia infobox coordinates / WPI Pub. 150 where
 * the wiki was ambiguous. Rounded to 4 decimal places (~11 m precision)
 * which is well past what's needed for a globe at this zoom.
 */
export const SEAPORTS: Seaport[] = [
  // ── East Asia container giants ─────────────────────────────────────
  { id: 'sp.shanghai', kind: 'seaport', name: 'Shanghai', countryISO2: 'CN', region: 'East Asia', lat: 30.6260, lng: 122.0570, importance: 100, category: 'container', description: 'World\'s busiest container port; 47M+ TEU/year. Yangtze River delta, deep-water Yangshan terminal.', strategicRole: 'Primary China–Europe / China–US export gateway.', tags: ['container', 'transshipment', 'asia-anchor'], metrics: { cargo_throughput_teu: 47.3 } },
  { id: 'sp.singapore', kind: 'seaport', name: 'Singapore', countryISO2: 'SG', region: 'Southeast Asia', lat: 1.2655, lng: 103.8240, importance: 99, category: 'transshipment', description: 'World\'s top transshipment hub; ~37M TEU. Anchors Strait of Malacca traffic.', strategicRole: 'Pivot point for Asia–Europe and intra-Asia container flows.', tags: ['container', 'transshipment', 'malacca-anchor'], metrics: { cargo_throughput_teu: 37.2 } },
  { id: 'sp.ningbo', kind: 'seaport', name: 'Ningbo-Zhoushan', countryISO2: 'CN', region: 'East Asia', lat: 29.8683, lng: 122.0717, importance: 96, category: 'mixed', description: 'World\'s #1 by total cargo tonnage; major bulk + container.', tags: ['container', 'bulk'], metrics: { cargo_throughput_teu: 35.3 } },
  { id: 'sp.shenzhen', kind: 'seaport', name: 'Shenzhen', countryISO2: 'CN', region: 'East Asia', lat: 22.5333, lng: 113.9333, importance: 94, category: 'container', description: 'Pearl River Delta export hub serving Guangdong manufacturing.', tags: ['container'], metrics: { cargo_throughput_teu: 30.0 } },
  { id: 'sp.qingdao', kind: 'seaport', name: 'Qingdao', countryISO2: 'CN', region: 'East Asia', lat: 36.0833, lng: 120.3000, importance: 90, category: 'mixed', description: 'Northern China gateway; iron ore, crude, containers.', tags: ['container', 'bulk', 'energy'], metrics: { cargo_throughput_teu: 26.0 } },
  { id: 'sp.guangzhou', kind: 'seaport', name: 'Guangzhou', countryISO2: 'CN', region: 'East Asia', lat: 23.0925, lng: 113.4391, importance: 88, category: 'container' },
  { id: 'sp.busan', kind: 'seaport', name: 'Busan', countryISO2: 'KR', region: 'East Asia', lat: 35.1028, lng: 129.0403, importance: 90, category: 'container', description: 'Korea\'s primary export gateway; major NE Asia transshipment node.', tags: ['container', 'transshipment'], metrics: { cargo_throughput_teu: 22.0 } },
  { id: 'sp.tianjin', kind: 'seaport', name: 'Tianjin', countryISO2: 'CN', region: 'East Asia', lat: 39.0050, lng: 117.7333, importance: 85, category: 'mixed' },
  { id: 'sp.hongkong', kind: 'seaport', name: 'Hong Kong', countryISO2: 'HK', region: 'East Asia', lat: 22.3193, lng: 114.1694, importance: 84, category: 'container', tags: ['container', 'transshipment'] },
  { id: 'sp.kaohsiung', kind: 'seaport', name: 'Kaohsiung', countryISO2: 'TW', region: 'East Asia', lat: 22.6273, lng: 120.3014, importance: 80, category: 'container', description: 'Taiwan\'s primary container port; key node in Taiwan Strait flows.', tags: ['container'] },

  // ── Europe ─────────────────────────────────────────────────────────
  { id: 'sp.rotterdam', kind: 'seaport', name: 'Rotterdam', countryISO2: 'NL', region: 'Europe', lat: 51.9244, lng: 4.4777, importance: 95, category: 'mixed', description: 'Europe\'s largest port. Multi-modal: containers, energy, bulk, RoRo.', strategicRole: 'Primary Asia–Europe terminus; gateway to Rhine corridor.', tags: ['container', 'energy', 'bulk'], metrics: { cargo_throughput_teu: 13.5 } },
  { id: 'sp.antwerp', kind: 'seaport', name: 'Antwerp-Bruges', countryISO2: 'BE', region: 'Europe', lat: 51.2278, lng: 4.4203, importance: 87, category: 'mixed', description: 'Europe\'s #2 port (post-merger with Zeebrugge). Strong chemical & RoRo profile.', tags: ['container', 'chemicals', 'roro'] },
  { id: 'sp.hamburg', kind: 'seaport', name: 'Hamburg', countryISO2: 'DE', region: 'Europe', lat: 53.5511, lng: 9.9937, importance: 82, category: 'container', description: 'Germany\'s main port; gateway to Central Europe and the Czech Republic via Elbe.' },
  { id: 'sp.piraeus', kind: 'seaport', name: 'Piraeus', countryISO2: 'GR', region: 'Europe', lat: 37.9420, lng: 23.6464, importance: 76, category: 'transshipment', description: 'Mediterranean transshipment hub; COSCO-controlled node in China\'s BRI maritime arm.', tags: ['container', 'transshipment'] },
  { id: 'sp.algeciras', kind: 'seaport', name: 'Algeciras', countryISO2: 'ES', region: 'Europe', lat: 36.1408, lng: -5.4561, importance: 75, category: 'transshipment', description: 'Strait of Gibraltar transshipment hub.' },
  { id: 'sp.valencia', kind: 'seaport', name: 'Valencia', countryISO2: 'ES', region: 'Europe', lat: 39.4499, lng: -0.3168, importance: 74, category: 'container' },

  // ── Middle East / South Asia ───────────────────────────────────────
  { id: 'sp.jebelali', kind: 'seaport', name: 'Jebel Ali', countryISO2: 'AE', region: 'Middle East', lat: 24.9857, lng: 55.0700, importance: 86, category: 'mixed', description: 'Largest man-made harbour. DP World hub — major MENA / Indian Ocean gateway.', tags: ['container', 'transshipment'] },
  { id: 'sp.ras-tanura', kind: 'seaport', name: 'Ras Tanura', countryISO2: 'SA', region: 'Middle East', lat: 26.6928, lng: 50.1583, importance: 84, category: 'energy', description: 'World\'s largest oil-export terminal. Saudi Aramco-operated.', strategicRole: 'Anchors Persian Gulf → Asia crude flows.', tags: ['energy', 'crude', 'hormuz-anchor'] },
  { id: 'sp.kandla', kind: 'seaport', name: 'Mundra', countryISO2: 'IN', region: 'South Asia', lat: 22.7397, lng: 69.7167, importance: 72, category: 'container', description: 'India\'s largest private port (Adani). Gulf-of-Kutch entry to inland India.' },
  { id: 'sp.colombo', kind: 'seaport', name: 'Colombo', countryISO2: 'LK', region: 'South Asia', lat: 6.9355, lng: 79.8441, importance: 71, category: 'transshipment', description: 'Indian Ocean transshipment node; key feeder for Indian subcontinent.' },

  // ── Africa ─────────────────────────────────────────────────────────
  { id: 'sp.tanger-med', kind: 'seaport', name: 'Tanger Med', countryISO2: 'MA', region: 'Africa', lat: 35.8853, lng: -5.5083, importance: 78, category: 'transshipment', description: 'Strait of Gibraltar gateway. Africa\'s top container port.', tags: ['container', 'transshipment'] },
  { id: 'sp.durban', kind: 'seaport', name: 'Durban', countryISO2: 'ZA', region: 'Africa', lat: -29.8669, lng: 31.0432, importance: 65, category: 'mixed', description: 'Southern Africa\'s busiest port; key Cape route stopover.' },

  // ── Americas ───────────────────────────────────────────────────────
  { id: 'sp.la', kind: 'seaport', name: 'Los Angeles', countryISO2: 'US', region: 'North America', lat: 33.7395, lng: -118.2620, importance: 89, category: 'container', description: 'US west-coast primary container gateway; transpacific terminus.', tags: ['container', 'transpacific'], metrics: { cargo_throughput_teu: 10.5 } },
  { id: 'sp.long-beach', kind: 'seaport', name: 'Long Beach', countryISO2: 'US', region: 'North America', lat: 33.7547, lng: -118.2167, importance: 85, category: 'container', description: 'Adjacent to LA; together they handle ~40% of US container imports.', tags: ['container', 'transpacific'] },
  { id: 'sp.nynj', kind: 'seaport', name: 'New York / New Jersey', countryISO2: 'US', region: 'North America', lat: 40.6892, lng: -74.0445, importance: 83, category: 'container', description: 'US east-coast primary container gateway; transatlantic terminus.', tags: ['container', 'transatlantic'] },
  { id: 'sp.savannah', kind: 'seaport', name: 'Savannah', countryISO2: 'US', region: 'North America', lat: 32.0809, lng: -81.0912, importance: 76, category: 'container', description: 'Largest single-terminal container facility in North America.' },
  { id: 'sp.houston', kind: 'seaport', name: 'Houston', countryISO2: 'US', region: 'North America', lat: 29.7604, lng: -95.3698, importance: 79, category: 'energy', description: 'Largest US port by tonnage; petrochemical & energy export hub.', tags: ['energy', 'lng', 'crude'] },
  { id: 'sp.santos', kind: 'seaport', name: 'Santos', countryISO2: 'BR', region: 'South America', lat: -23.9608, lng: -46.3331, importance: 73, category: 'mixed', description: 'Latin America\'s busiest port. Soy, sugar, container.', tags: ['bulk', 'container'] },
  { id: 'sp.balboa', kind: 'seaport', name: 'Balboa', countryISO2: 'PA', region: 'Central America', lat: 8.9520, lng: -79.5667, importance: 72, category: 'transshipment', description: 'Pacific entrance of the Panama Canal; transshipment for inter-American flows.', tags: ['transshipment', 'panama-anchor'] },

  // ── Oceania ────────────────────────────────────────────────────────
  { id: 'sp.port-hedland', kind: 'seaport', name: 'Port Hedland', countryISO2: 'AU', region: 'Oceania', lat: -20.3115, lng: 118.5766, importance: 78, category: 'bulk', description: 'World\'s largest iron-ore export terminal — anchors Australia → China bulk flow.', tags: ['bulk', 'iron-ore'] },
];
