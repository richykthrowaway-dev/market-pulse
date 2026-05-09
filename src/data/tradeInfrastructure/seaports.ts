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
  // ── CURATED — rich metadata, manually verified ─────────────────────
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

  // ── ENRICHED FROM WORLD PORT INDEX (NGA Pub. 150) — well-known large ports ──────────────────────────────────────────────────────────

  // East Asia – additional
  { id: 'sp.dalian', kind: 'seaport', name: 'Dalian', countryISO2: 'CN', region: 'East Asia', lat: 38.9133, lng: 121.6493, importance: 55, category: 'mixed' },
  { id: 'sp.xiamen', kind: 'seaport', name: 'Xiamen', countryISO2: 'CN', region: 'East Asia', lat: 24.4464, lng: 118.0639, importance: 55, category: 'container' },
  { id: 'sp.lianyungang', kind: 'seaport', name: 'Lianyungang', countryISO2: 'CN', region: 'East Asia', lat: 34.7500, lng: 119.4833, importance: 55, category: 'mixed' },
  { id: 'sp.nanjing', kind: 'seaport', name: 'Nanjing', countryISO2: 'CN', region: 'East Asia', lat: 31.9667, lng: 118.7667, importance: 55, category: 'mixed' },
  { id: 'sp.wuhan', kind: 'seaport', name: 'Wuhan', countryISO2: 'CN', region: 'East Asia', lat: 30.5833, lng: 114.2667, importance: 55, category: 'mixed' },
  { id: 'sp.incheon', kind: 'seaport', name: 'Incheon', countryISO2: 'KR', region: 'East Asia', lat: 37.4561, lng: 126.7052, importance: 55, category: 'container' },
  { id: 'sp.kobe', kind: 'seaport', name: 'Kobe', countryISO2: 'JP', region: 'East Asia', lat: 34.6778, lng: 135.1833, importance: 55, category: 'container' },
  { id: 'sp.yokohama', kind: 'seaport', name: 'Yokohama', countryISO2: 'JP', region: 'East Asia', lat: 35.4500, lng: 139.6500, importance: 55, category: 'container' },
  { id: 'sp.nagoya', kind: 'seaport', name: 'Nagoya', countryISO2: 'JP', region: 'East Asia', lat: 35.0833, lng: 136.9333, importance: 55, category: 'mixed' },
  { id: 'sp.osaka', kind: 'seaport', name: 'Osaka', countryISO2: 'JP', region: 'East Asia', lat: 34.6500, lng: 135.4333, importance: 55, category: 'mixed' },
  { id: 'sp.tokyo', kind: 'seaport', name: 'Tokyo', countryISO2: 'JP', region: 'East Asia', lat: 35.6333, lng: 139.8833, importance: 55, category: 'container' },
  { id: 'sp.pyeongtaek', kind: 'seaport', name: 'Pyeongtaek', countryISO2: 'KR', region: 'East Asia', lat: 36.9833, lng: 126.8167, importance: 55, category: 'container' },
  { id: 'sp.gwangyang', kind: 'seaport', name: 'Gwangyang', countryISO2: 'KR', region: 'East Asia', lat: 34.9333, lng: 127.6833, importance: 55, category: 'container' },
  { id: 'sp.keelung', kind: 'seaport', name: 'Keelung', countryISO2: 'TW', region: 'East Asia', lat: 25.1333, lng: 121.7333, importance: 55, category: 'container' },

  // Southeast Asia – additional
  { id: 'sp.port-klang', kind: 'seaport', name: 'Port Klang', countryISO2: 'MY', region: 'Southeast Asia', lat: 3.0000, lng: 101.3833, importance: 55, category: 'container' },
  { id: 'sp.tanjung-pelepas', kind: 'seaport', name: 'Tanjung Pelepas', countryISO2: 'MY', region: 'Southeast Asia', lat: 1.3667, lng: 103.5500, importance: 55, category: 'transshipment' },
  { id: 'sp.jakarta', kind: 'seaport', name: 'Jakarta (Tanjung Priok)', countryISO2: 'ID', region: 'Southeast Asia', lat: -6.1000, lng: 106.8667, importance: 55, category: 'container' },
  { id: 'sp.ho-chi-minh', kind: 'seaport', name: 'Ho Chi Minh City', countryISO2: 'VN', region: 'Southeast Asia', lat: 10.7800, lng: 106.7000, importance: 55, category: 'container' },
  { id: 'sp.manila', kind: 'seaport', name: 'Manila', countryISO2: 'PH', region: 'Southeast Asia', lat: 14.5833, lng: 120.9667, importance: 55, category: 'container' },
  { id: 'sp.laem-chabang', kind: 'seaport', name: 'Laem Chabang', countryISO2: 'TH', region: 'Southeast Asia', lat: 13.0833, lng: 100.8833, importance: 55, category: 'container' },
  { id: 'sp.sihanoukville', kind: 'seaport', name: 'Sihanoukville', countryISO2: 'KH', region: 'Southeast Asia', lat: 10.6333, lng: 103.5333, importance: 55, category: 'mixed' },
  { id: 'sp.surabaya', kind: 'seaport', name: 'Surabaya (Tanjung Perak)', countryISO2: 'ID', region: 'Southeast Asia', lat: -7.2167, lng: 112.7333, importance: 55, category: 'container' },
  { id: 'sp.yangon', kind: 'seaport', name: 'Yangon', countryISO2: 'MM', region: 'Southeast Asia', lat: 16.7667, lng: 96.1833, importance: 55, category: 'mixed' },

  // South Asia – additional
  { id: 'sp.nhava-sheva', kind: 'seaport', name: 'Nhava Sheva (JNPT)', countryISO2: 'IN', region: 'South Asia', lat: 18.9500, lng: 72.9333, importance: 55, category: 'container' },
  { id: 'sp.chennai', kind: 'seaport', name: 'Chennai', countryISO2: 'IN', region: 'South Asia', lat: 13.0833, lng: 80.2833, importance: 55, category: 'container' },
  { id: 'sp.vizag', kind: 'seaport', name: 'Visakhapatnam', countryISO2: 'IN', region: 'South Asia', lat: 17.6833, lng: 83.2833, importance: 55, category: 'mixed' },
  { id: 'sp.kolkata', kind: 'seaport', name: 'Kolkata', countryISO2: 'IN', region: 'South Asia', lat: 22.5500, lng: 88.3333, importance: 55, category: 'mixed' },
  { id: 'sp.chittagong', kind: 'seaport', name: 'Chittagong', countryISO2: 'BD', region: 'South Asia', lat: 22.3311, lng: 91.8300, importance: 55, category: 'container' },
  { id: 'sp.karachi', kind: 'seaport', name: 'Karachi', countryISO2: 'PK', region: 'South Asia', lat: 24.8500, lng: 66.9833, importance: 55, category: 'mixed' },
  { id: 'sp.hambantota', kind: 'seaport', name: 'Hambantota', countryISO2: 'LK', region: 'South Asia', lat: 6.1167, lng: 81.1167, importance: 55, category: 'mixed' },

  // Middle East – additional
  { id: 'sp.abu-dhabi', kind: 'seaport', name: 'Abu Dhabi (Khalifa)', countryISO2: 'AE', region: 'Middle East', lat: 24.8027, lng: 54.6440, importance: 55, category: 'mixed' },
  { id: 'sp.salalah', kind: 'seaport', name: 'Salalah', countryISO2: 'OM', region: 'Middle East', lat: 16.9333, lng: 54.0000, importance: 55, category: 'transshipment' },
  { id: 'sp.sohar', kind: 'seaport', name: 'Sohar', countryISO2: 'OM', region: 'Middle East', lat: 24.3667, lng: 56.6333, importance: 55, category: 'mixed' },
  { id: 'sp.muscat', kind: 'seaport', name: 'Muscat', countryISO2: 'OM', region: 'Middle East', lat: 23.6167, lng: 58.5833, importance: 55, category: 'mixed' },
  { id: 'sp.dammam', kind: 'seaport', name: 'Dammam (King Abdulaziz)', countryISO2: 'SA', region: 'Middle East', lat: 26.4833, lng: 50.2000, importance: 55, category: 'container' },
  { id: 'sp.aden', kind: 'seaport', name: 'Aden', countryISO2: 'YE', region: 'Middle East', lat: 12.7833, lng: 45.0333, importance: 55, category: 'transshipment' },
  { id: 'sp.haifa', kind: 'seaport', name: 'Haifa', countryISO2: 'IL', region: 'Middle East', lat: 32.8167, lng: 35.0000, importance: 55, category: 'container' },
  { id: 'sp.mersin', kind: 'seaport', name: 'Mersin', countryISO2: 'TR', region: 'Middle East', lat: 36.8000, lng: 34.6333, importance: 55, category: 'container' },
  { id: 'sp.istanbul', kind: 'seaport', name: 'Istanbul (Ambarli)', countryISO2: 'TR', region: 'Middle East', lat: 40.9667, lng: 28.6667, importance: 55, category: 'container' },

  // Europe – additional
  { id: 'sp.felixstowe', kind: 'seaport', name: 'Felixstowe', countryISO2: 'GB', region: 'Europe', lat: 51.9500, lng: 1.3333, importance: 55, category: 'container' },
  { id: 'sp.bremen', kind: 'seaport', name: 'Bremen / Bremerhaven', countryISO2: 'DE', region: 'Europe', lat: 53.5500, lng: 8.5667, importance: 55, category: 'container' },
  { id: 'sp.genoa', kind: 'seaport', name: 'Genoa', countryISO2: 'IT', region: 'Europe', lat: 44.4167, lng: 8.9167, importance: 55, category: 'mixed' },
  { id: 'sp.barcelona', kind: 'seaport', name: 'Barcelona', countryISO2: 'ES', region: 'Europe', lat: 41.3500, lng: 2.1667, importance: 55, category: 'container' },
  { id: 'sp.le-havre', kind: 'seaport', name: 'Le Havre', countryISO2: 'FR', region: 'Europe', lat: 49.4833, lng: 0.1000, importance: 55, category: 'container' },
  { id: 'sp.marseille', kind: 'seaport', name: 'Marseille-Fos', countryISO2: 'FR', region: 'Europe', lat: 43.3500, lng: 4.8667, importance: 55, category: 'mixed' },
  { id: 'sp.st-petersburg', kind: 'seaport', name: 'St. Petersburg', countryISO2: 'RU', region: 'Europe', lat: 59.9333, lng: 30.2167, importance: 55, category: 'container' },
  { id: 'sp.gdansk', kind: 'seaport', name: 'Gdańsk', countryISO2: 'PL', region: 'Europe', lat: 54.3500, lng: 18.6500, importance: 55, category: 'container' },
  { id: 'sp.constanta', kind: 'seaport', name: 'Constanta', countryISO2: 'RO', region: 'Europe', lat: 44.1833, lng: 28.6667, importance: 55, category: 'mixed' },
  { id: 'sp.gioia-tauro', kind: 'seaport', name: 'Gioia Tauro', countryISO2: 'IT', region: 'Europe', lat: 38.4333, lng: 15.9000, importance: 55, category: 'transshipment' },
  { id: 'sp.lisbon', kind: 'seaport', name: 'Lisbon', countryISO2: 'PT', region: 'Europe', lat: 38.7167, lng: -9.1333, importance: 55, category: 'mixed' },
  { id: 'sp.gothenburg', kind: 'seaport', name: 'Gothenburg', countryISO2: 'SE', region: 'Europe', lat: 57.7000, lng: 11.9667, importance: 55, category: 'container' },
  { id: 'sp.amsterdam', kind: 'seaport', name: 'Amsterdam', countryISO2: 'NL', region: 'Europe', lat: 52.3833, lng: 4.8833, importance: 55, category: 'mixed' },
  { id: 'sp.london-gateway', kind: 'seaport', name: 'London Gateway', countryISO2: 'GB', region: 'Europe', lat: 51.5000, lng: 0.5000, importance: 55, category: 'container' },
  { id: 'sp.southampton', kind: 'seaport', name: 'Southampton', countryISO2: 'GB', region: 'Europe', lat: 50.9000, lng: -1.4000, importance: 55, category: 'container' },
  { id: 'sp.gdynia', kind: 'seaport', name: 'Gdynia', countryISO2: 'PL', region: 'Europe', lat: 54.5333, lng: 18.5333, importance: 55, category: 'container' },

  // Americas – additional
  { id: 'sp.baltimore', kind: 'seaport', name: 'Baltimore', countryISO2: 'US', region: 'North America', lat: 39.2667, lng: -76.5833, importance: 55, category: 'mixed' },
  { id: 'sp.norfolk', kind: 'seaport', name: 'Norfolk / Virginia', countryISO2: 'US', region: 'North America', lat: 36.9333, lng: -76.3167, importance: 55, category: 'container' },
  { id: 'sp.seattle-tacoma', kind: 'seaport', name: 'Seattle / Tacoma', countryISO2: 'US', region: 'North America', lat: 47.5667, lng: -122.3333, importance: 55, category: 'container' },
  { id: 'sp.prince-rupert', kind: 'seaport', name: 'Prince Rupert', countryISO2: 'CA', region: 'North America', lat: 54.3167, lng: -130.3167, importance: 55, category: 'container' },
  { id: 'sp.vancouver-bc', kind: 'seaport', name: 'Vancouver BC', countryISO2: 'CA', region: 'North America', lat: 49.2833, lng: -123.1167, importance: 55, category: 'mixed' },
  { id: 'sp.manzanillo-mx', kind: 'seaport', name: 'Manzanillo (Mexico)', countryISO2: 'MX', region: 'North America', lat: 19.0500, lng: -104.3167, importance: 55, category: 'container' },
  { id: 'sp.veracruz', kind: 'seaport', name: 'Veracruz', countryISO2: 'MX', region: 'North America', lat: 19.2000, lng: -96.1333, importance: 55, category: 'mixed' },
  { id: 'sp.colon', kind: 'seaport', name: 'Cristóbal / Colón', countryISO2: 'PA', region: 'Central America', lat: 9.3667, lng: -79.9000, importance: 55, category: 'transshipment' },
  { id: 'sp.cartagena', kind: 'seaport', name: 'Cartagena', countryISO2: 'CO', region: 'South America', lat: 10.3833, lng: -75.5167, importance: 55, category: 'transshipment' },
  { id: 'sp.callao', kind: 'seaport', name: 'Callao', countryISO2: 'PE', region: 'South America', lat: -12.0500, lng: -77.1333, importance: 55, category: 'container' },
  { id: 'sp.buenos-aires', kind: 'seaport', name: 'Buenos Aires', countryISO2: 'AR', region: 'South America', lat: -34.5833, lng: -58.3833, importance: 55, category: 'container' },
  { id: 'sp.paranagua', kind: 'seaport', name: 'Paranaguá', countryISO2: 'BR', region: 'South America', lat: -25.5167, lng: -48.5000, importance: 55, category: 'bulk' },
  { id: 'sp.itajai', kind: 'seaport', name: 'Itajaí', countryISO2: 'BR', region: 'South America', lat: -26.9000, lng: -48.6667, importance: 55, category: 'container' },
  { id: 'sp.guayaquil', kind: 'seaport', name: 'Guayaquil', countryISO2: 'EC', region: 'South America', lat: -2.1833, lng: -79.8833, importance: 55, category: 'container' },

  // Africa – additional
  { id: 'sp.abidjan', kind: 'seaport', name: 'Abidjan', countryISO2: 'CI', region: 'Africa', lat: 5.3000, lng: -4.0167, importance: 55, category: 'mixed' },
  { id: 'sp.lagos', kind: 'seaport', name: 'Lagos (Apapa)', countryISO2: 'NG', region: 'Africa', lat: 6.4500, lng: 3.3833, importance: 55, category: 'container' },
  { id: 'sp.mombasa', kind: 'seaport', name: 'Mombasa', countryISO2: 'KE', region: 'Africa', lat: -4.0500, lng: 39.6667, importance: 55, category: 'mixed' },
  { id: 'sp.dar-es-salaam', kind: 'seaport', name: 'Dar es Salaam', countryISO2: 'TZ', region: 'Africa', lat: -6.8167, lng: 39.3000, importance: 55, category: 'mixed' },
  { id: 'sp.cape-town', kind: 'seaport', name: 'Cape Town', countryISO2: 'ZA', region: 'Africa', lat: -33.9167, lng: 18.4333, importance: 55, category: 'mixed' },
  { id: 'sp.port-elizabeth', kind: 'seaport', name: 'Port Elizabeth (Ngqura)', countryISO2: 'ZA', region: 'Africa', lat: -33.9667, lng: 25.6000, importance: 55, category: 'container' },
  { id: 'sp.beira', kind: 'seaport', name: 'Beira', countryISO2: 'MZ', region: 'Africa', lat: -19.8333, lng: 34.8333, importance: 55, category: 'mixed' },
  { id: 'sp.dakar', kind: 'seaport', name: 'Dakar', countryISO2: 'SN', region: 'Africa', lat: 14.6833, lng: -17.4333, importance: 55, category: 'mixed' },
  { id: 'sp.casablanca', kind: 'seaport', name: 'Casablanca', countryISO2: 'MA', region: 'Africa', lat: 33.6000, lng: -7.6167, importance: 55, category: 'container' },
  { id: 'sp.alexandria', kind: 'seaport', name: 'Alexandria', countryISO2: 'EG', region: 'Africa', lat: 31.2000, lng: 29.9000, importance: 55, category: 'mixed' },
  { id: 'sp.suez', kind: 'seaport', name: 'Suez (Port Tawfiq)', countryISO2: 'EG', region: 'Africa', lat: 30.0000, lng: 32.5500, importance: 55, category: 'transshipment' },
  { id: 'sp.port-said', kind: 'seaport', name: 'Port Said', countryISO2: 'EG', region: 'Africa', lat: 31.2500, lng: 32.3000, importance: 55, category: 'transshipment' },
  { id: 'sp.djibouti', kind: 'seaport', name: 'Djibouti', countryISO2: 'DJ', region: 'Africa', lat: 11.5833, lng: 43.1333, importance: 55, category: 'transshipment' },
  { id: 'sp.luanda', kind: 'seaport', name: 'Luanda', countryISO2: 'AO', region: 'Africa', lat: -8.8333, lng: 13.2333, importance: 55, category: 'energy' },

  // Oceania – additional
  { id: 'sp.sydney', kind: 'seaport', name: 'Sydney (Botany Bay)', countryISO2: 'AU', region: 'Oceania', lat: -33.9667, lng: 151.2000, importance: 55, category: 'container' },
  { id: 'sp.melbourne', kind: 'seaport', name: 'Melbourne', countryISO2: 'AU', region: 'Oceania', lat: -37.8167, lng: 144.9167, importance: 55, category: 'container' },
  { id: 'sp.brisbane', kind: 'seaport', name: 'Brisbane', countryISO2: 'AU', region: 'Oceania', lat: -27.3833, lng: 153.1667, importance: 55, category: 'container' },
  { id: 'sp.fremantle', kind: 'seaport', name: 'Fremantle', countryISO2: 'AU', region: 'Oceania', lat: -32.0500, lng: 115.7500, importance: 55, category: 'container' },
  { id: 'sp.auckland', kind: 'seaport', name: 'Auckland', countryISO2: 'NZ', region: 'Oceania', lat: -36.8500, lng: 174.7667, importance: 55, category: 'container' },
  { id: 'sp.lyttelton', kind: 'seaport', name: 'Lyttelton (Christchurch)', countryISO2: 'NZ', region: 'Oceania', lat: -43.6000, lng: 172.7167, importance: 55, category: 'mixed' },
  { id: 'sp.suva', kind: 'seaport', name: 'Suva', countryISO2: 'FJ', region: 'Oceania', lat: -18.1333, lng: 178.4500, importance: 55, category: 'mixed' },
];
