import type { Airport } from './types';

/**
 * Curated seed list of globally significant cargo / logistics airports.
 *
 * Coverage logic:
 *   - Top air-cargo tonnage hubs (Hong Kong, Memphis, Shanghai, Anchorage)
 *   - Integrator superhubs (Memphis = FedEx, Louisville = UPS, Cologne = DHL)
 *   - Strategic refueling / transpolar nodes (Anchorage)
 *   - Major Gulf transit hubs (Dubai, Doha)
 */
export const AIRPORTS: Airport[] = [
  // ── CURATED — rich metadata, manually verified ─────────────────────
  { id: 'ap.hkg', kind: 'airport' as const, name: 'Hong Kong Intl', iata: 'HKG', countryISO2: 'HK', region: 'East Asia', lat: 22.3080, lng: 113.9185, importance: 100, category: 'air-cargo-hub' as const, description: 'World\'s top air-cargo airport by tonnage; ~5M tonnes/year. Anchors China-export airfreight to Europe / North America.', tags: ['cargo', 'asia-anchor'], metrics: { cargo_tonnage: 5.0 } },
  { id: 'ap.mem', kind: 'airport' as const, name: 'Memphis Intl',   iata: 'MEM', countryISO2: 'US', region: 'North America', lat: 35.0421, lng: -89.9792, importance: 96, category: 'integrator-hub' as const, description: 'FedEx Express superhub; the original "world\'s busiest cargo airport". US domestic overnight backbone.', tags: ['cargo', 'integrator', 'fedex'], metrics: { cargo_tonnage: 4.4 } },
  { id: 'ap.pvg', kind: 'airport' as const, name: 'Shanghai Pudong', iata: 'PVG', countryISO2: 'CN', region: 'East Asia', lat: 31.1443, lng: 121.8083, importance: 94, category: 'pax-cargo-hub' as const, description: 'China\'s primary international cargo gateway; tightly coupled with Shanghai sea-port multimodal.', tags: ['cargo', 'pax'] },
  { id: 'ap.icn', kind: 'airport' as const, name: 'Incheon Intl',   iata: 'ICN', countryISO2: 'KR', region: 'East Asia', lat: 37.4691, lng: 126.4505, importance: 87, category: 'pax-cargo-hub' as const, description: 'Asia-NorthAm transpacific cargo node; Korean Air Cargo / Asiana base.' },
  { id: 'ap.dxb', kind: 'airport' as const, name: 'Dubai Intl',     iata: 'DXB', countryISO2: 'AE', region: 'Middle East', lat: 25.2532, lng: 55.3657, importance: 88, category: 'pax-cargo-hub' as const, description: 'Emirates SkyCargo home; major Asia–Europe stopover and pax superhub.', tags: ['cargo', 'pax'] },
  { id: 'ap.doh', kind: 'airport' as const, name: 'Doha Hamad',     iata: 'DOH', countryISO2: 'QA', region: 'Middle East', lat: 25.2731, lng: 51.6080, importance: 80, category: 'pax-cargo-hub' as const, description: 'Qatar Airways Cargo home; Gulf transit hub.' },
  { id: 'ap.fra', kind: 'airport' as const, name: 'Frankfurt',      iata: 'FRA', countryISO2: 'DE', region: 'Europe', lat: 50.0379, lng: 8.5622, importance: 86, category: 'pax-cargo-hub' as const, description: 'Lufthansa Cargo home; Europe\'s top air-cargo airport by tonnage.' },
  { id: 'ap.ams', kind: 'airport' as const, name: 'Amsterdam Schiphol', iata: 'AMS', countryISO2: 'NL', region: 'Europe', lat: 52.3105, lng: 4.7683, importance: 80, category: 'pax-cargo-hub' as const, description: 'Major perishables / pharma corridor; tightly integrated with Rotterdam port.' },
  { id: 'ap.lhr', kind: 'airport' as const, name: 'London Heathrow', iata: 'LHR', countryISO2: 'GB', region: 'Europe', lat: 51.4700, lng: -0.4543, importance: 78, category: 'pax-cargo-hub' as const },
  { id: 'ap.cgn', kind: 'airport' as const, name: 'Cologne / Bonn', iata: 'CGN', countryISO2: 'DE', region: 'Europe', lat: 50.8659, lng: 7.1427, importance: 74, category: 'integrator-hub' as const, description: 'DHL European hub; FedEx Europe ops.', tags: ['cargo', 'integrator', 'dhl'] },
  { id: 'ap.lux', kind: 'airport' as const, name: 'Luxembourg Findel', iata: 'LUX', countryISO2: 'LU', region: 'Europe', lat: 49.6233, lng: 6.2044, importance: 65, category: 'air-cargo-hub' as const, description: 'Cargolux home; specialised freighter operations.', tags: ['cargo'] },
  { id: 'ap.anc', kind: 'airport' as const, name: 'Anchorage Intl', iata: 'ANC', countryISO2: 'US', region: 'North America', lat: 61.1742, lng: -149.9961, importance: 79, category: 'air-cargo-hub' as const, description: 'Strategic transpacific / transpolar refueling node. Tax incentives drive freighter throughput.', strategicRole: 'Asia–North America freighter pivot.', tags: ['cargo', 'refuel-node'] },
  { id: 'ap.ord', kind: 'airport' as const, name: 'Chicago O\'Hare', iata: 'ORD', countryISO2: 'US', region: 'North America', lat: 41.9742, lng: -87.9073, importance: 78, category: 'pax-cargo-hub' as const },
  { id: 'ap.sdf', kind: 'airport' as const, name: 'Louisville Intl', iata: 'SDF', countryISO2: 'US', region: 'North America', lat: 38.1740, lng: -85.7360, importance: 75, category: 'integrator-hub' as const, description: 'UPS Worldport — UPS\'s global air-hub.', tags: ['cargo', 'integrator', 'ups'] },
  { id: 'ap.lax', kind: 'airport' as const, name: 'Los Angeles Intl', iata: 'LAX', countryISO2: 'US', region: 'North America', lat: 33.9416, lng: -118.4085, importance: 76, category: 'pax-cargo-hub' as const },
  { id: 'ap.sin', kind: 'airport' as const, name: 'Singapore Changi', iata: 'SIN', countryISO2: 'SG', region: 'Southeast Asia', lat: 1.3644, lng: 103.9915, importance: 82, category: 'pax-cargo-hub' as const, description: 'Southeast Asia transit superhub; tight coupling with Singapore seaport.' },

  // ── ENRICHED FROM OURAIRPORTS (public domain) ──────────────────────

  // East Asia
  { id: 'ap.nrt', kind: 'airport' as const, name: 'Narita International Airport', iata: 'NRT', countryISO2: 'JP', region: 'East Asia', lat: 35.7686, lng: 140.3887, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.hnd', kind: 'airport' as const, name: 'Tokyo Haneda International Airport', iata: 'HND', countryISO2: 'JP', region: 'East Asia', lat: 35.5497, lng: 139.7870, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.kix', kind: 'airport' as const, name: 'Kansai International Airport', iata: 'KIX', countryISO2: 'JP', region: 'East Asia', lat: 34.4273, lng: 135.2440, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.cts', kind: 'airport' as const, name: 'New Chitose Airport', iata: 'CTS', countryISO2: 'JP', region: 'East Asia', lat: 42.7748, lng: 141.6904, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.fuk', kind: 'airport' as const, name: 'Fukuoka Airport', iata: 'FUK', countryISO2: 'JP', region: 'East Asia', lat: 33.5859, lng: 130.4510, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.tpe', kind: 'airport' as const, name: 'Taiwan Taoyuan International Airport', iata: 'TPE', countryISO2: 'TW', region: 'East Asia', lat: 25.0777, lng: 121.2330, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pek', kind: 'airport' as const, name: 'Beijing Capital International Airport', iata: 'PEK', countryISO2: 'CN', region: 'East Asia', lat: 40.0773, lng: 116.5967, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pkx', kind: 'airport' as const, name: 'Beijing Daxing International Airport', iata: 'PKX', countryISO2: 'CN', region: 'East Asia', lat: 39.5013, lng: 116.4140, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.can', kind: 'airport' as const, name: 'Guangzhou Baiyun International Airport', iata: 'CAN', countryISO2: 'CN', region: 'East Asia', lat: 23.3924, lng: 113.2990, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ctu', kind: 'airport' as const, name: 'Chengdu Shuangliu International Airport', iata: 'CTU', countryISO2: 'CN', region: 'East Asia', lat: 30.5583, lng: 103.9460, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pus', kind: 'airport' as const, name: 'Gimhae International Airport', iata: 'PUS', countryISO2: 'KR', region: 'East Asia', lat: 35.1795, lng: 128.9380, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.sha', kind: 'airport' as const, name: 'Shanghai Hongqiao International Airport', iata: 'SHA', countryISO2: 'CN', region: 'East Asia', lat: 31.1981, lng: 121.3343, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ubn', kind: 'airport' as const, name: 'Ulaanbaatar Chinggis Khaan International Airport', iata: 'UBN', countryISO2: 'MN', region: 'East Asia', lat: 47.6469, lng: 106.8198, importance: 60, category: 'pax-cargo-hub' as const },

  // Southeast Asia
  { id: 'ap.bkk', kind: 'airport' as const, name: 'Suvarnabhumi Airport', iata: 'BKK', countryISO2: 'TH', region: 'Southeast Asia', lat: 13.6811, lng: 100.7470, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.cgk', kind: 'airport' as const, name: 'Soekarno-Hatta International Airport', iata: 'CGK', countryISO2: 'ID', region: 'Southeast Asia', lat: -6.1256, lng: 106.6560, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.kul', kind: 'airport' as const, name: 'Kuala Lumpur International Airport', iata: 'KUL', countryISO2: 'MY', region: 'Southeast Asia', lat: 2.7456, lng: 101.7100, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mnl', kind: 'airport' as const, name: 'Ninoy Aquino International Airport', iata: 'MNL', countryISO2: 'PH', region: 'Southeast Asia', lat: 14.5086, lng: 121.0200, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.sgn', kind: 'airport' as const, name: 'Tan Son Nhat International Airport', iata: 'SGN', countryISO2: 'VN', region: 'Southeast Asia', lat: 10.8188, lng: 106.6520, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.han', kind: 'airport' as const, name: 'Noi Bai International Airport', iata: 'HAN', countryISO2: 'VN', region: 'Southeast Asia', lat: 21.2212, lng: 105.8070, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.dps', kind: 'airport' as const, name: 'Denpasar I Gusti Ngurah Rai International Airport', iata: 'DPS', countryISO2: 'ID', region: 'Southeast Asia', lat: -8.7484, lng: 115.1671, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.rgn', kind: 'airport' as const, name: 'Yangon International Airport', iata: 'RGN', countryISO2: 'MM', region: 'Southeast Asia', lat: 16.9073, lng: 96.1332, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pnh', kind: 'airport' as const, name: 'Phnom Penh International Airport', iata: 'PNH', countryISO2: 'KH', region: 'Southeast Asia', lat: 11.5472, lng: 104.8447, importance: 60, category: 'pax-cargo-hub' as const },

  // South Asia
  { id: 'ap.del', kind: 'airport' as const, name: 'Indira Gandhi International Airport', iata: 'DEL', countryISO2: 'IN', region: 'South Asia', lat: 28.5556, lng: 77.0952, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bom', kind: 'airport' as const, name: 'Chhatrapati Shivaji Maharaj International Airport', iata: 'BOM', countryISO2: 'IN', region: 'South Asia', lat: 19.0887, lng: 72.8679, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.blr', kind: 'airport' as const, name: 'Kempegowda International Airport Bengaluru', iata: 'BLR', countryISO2: 'IN', region: 'South Asia', lat: 13.1979, lng: 77.7063, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.maa', kind: 'airport' as const, name: 'Chennai International Airport', iata: 'MAA', countryISO2: 'IN', region: 'South Asia', lat: 12.9900, lng: 80.1693, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ccu', kind: 'airport' as const, name: 'Netaji Subhash Chandra Bose International Airport', iata: 'CCU', countryISO2: 'IN', region: 'South Asia', lat: 22.6540, lng: 88.4477, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.hyd', kind: 'airport' as const, name: 'Rajiv Gandhi International Airport', iata: 'HYD', countryISO2: 'IN', region: 'South Asia', lat: 17.2313, lng: 78.4299, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.isb', kind: 'airport' as const, name: 'Islamabad International Airport', iata: 'ISB', countryISO2: 'PK', region: 'South Asia', lat: 33.5490, lng: 72.8257, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.khi', kind: 'airport' as const, name: 'Jinnah International Airport', iata: 'KHI', countryISO2: 'PK', region: 'South Asia', lat: 24.9065, lng: 67.1608, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ktm', kind: 'airport' as const, name: 'Tribhuvan International Airport', iata: 'KTM', countryISO2: 'NP', region: 'South Asia', lat: 27.6966, lng: 85.3591, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.cmb', kind: 'airport' as const, name: 'Bandaranaike International Colombo Airport', iata: 'CMB', countryISO2: 'LK', region: 'South Asia', lat: 7.1808, lng: 79.8841, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.dac', kind: 'airport' as const, name: 'Hazrat Shahjalal International Airport', iata: 'DAC', countryISO2: 'BD', region: 'South Asia', lat: 23.8433, lng: 90.3978, importance: 60, category: 'pax-cargo-hub' as const },

  // Middle East
  { id: 'ap.auh', kind: 'airport' as const, name: 'Zayed International Airport', iata: 'AUH', countryISO2: 'AE', region: 'Middle East', lat: 24.4410, lng: 54.6492, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ruh', kind: 'airport' as const, name: 'King Khalid International Airport', iata: 'RUH', countryISO2: 'SA', region: 'Middle East', lat: 24.9576, lng: 46.6988, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.jed', kind: 'airport' as const, name: 'King Abdulaziz International Airport', iata: 'JED', countryISO2: 'SA', region: 'Middle East', lat: 21.6802, lng: 39.1574, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.kwi', kind: 'airport' as const, name: 'Kuwait International Airport', iata: 'KWI', countryISO2: 'KW', region: 'Middle East', lat: 29.2245, lng: 47.9698, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.amm', kind: 'airport' as const, name: 'Queen Alia International Airport', iata: 'AMM', countryISO2: 'JO', region: 'Middle East', lat: 31.7226, lng: 35.9932, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bey', kind: 'airport' as const, name: 'Beirut Rafic Hariri International Airport', iata: 'BEY', countryISO2: 'LB', region: 'Middle East', lat: 33.8198, lng: 35.4874, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ist', kind: 'airport' as const, name: 'İstanbul Airport', iata: 'IST', countryISO2: 'TR', region: 'Middle East', lat: 41.2749, lng: 28.7321, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.tlv', kind: 'airport' as const, name: 'Ben Gurion International Airport', iata: 'TLV', countryISO2: 'IL', region: 'Middle East', lat: 32.0114, lng: 34.8867, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mct', kind: 'airport' as const, name: 'Muscat International Airport', iata: 'MCT', countryISO2: 'OM', region: 'Middle East', lat: 23.6002, lng: 58.2853, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bah', kind: 'airport' as const, name: 'Bahrain International Airport', iata: 'BAH', countryISO2: 'BH', region: 'Middle East', lat: 26.2673, lng: 50.6376, importance: 60, category: 'pax-cargo-hub' as const },

  // Europe
  { id: 'ap.cdg', kind: 'airport' as const, name: 'Charles de Gaulle International Airport', iata: 'CDG', countryISO2: 'FR', region: 'Europe', lat: 49.0090, lng: 2.5541, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mad', kind: 'airport' as const, name: 'Adolfo Suárez Madrid–Barajas Airport', iata: 'MAD', countryISO2: 'ES', region: 'Europe', lat: 40.4934, lng: -3.5722, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.muc', kind: 'airport' as const, name: 'Munich Airport', iata: 'MUC', countryISO2: 'DE', region: 'Europe', lat: 48.3538, lng: 11.7861, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.zrh', kind: 'airport' as const, name: 'Zürich Airport', iata: 'ZRH', countryISO2: 'CH', region: 'Europe', lat: 47.4581, lng: 8.5481, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.vie', kind: 'airport' as const, name: 'Vienna International Airport', iata: 'VIE', countryISO2: 'AT', region: 'Europe', lat: 48.1103, lng: 16.5697, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bru', kind: 'airport' as const, name: 'Brussels Airport', iata: 'BRU', countryISO2: 'BE', region: 'Europe', lat: 50.9014, lng: 4.4844, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.lis', kind: 'airport' as const, name: 'Lisbon Humberto Delgado Airport', iata: 'LIS', countryISO2: 'PT', region: 'Europe', lat: 38.7813, lng: -9.1359, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.osl', kind: 'airport' as const, name: 'Oslo-Gardermoen International Airport', iata: 'OSL', countryISO2: 'NO', region: 'Europe', lat: 60.1939, lng: 11.1004, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.arn', kind: 'airport' as const, name: 'Stockholm-Arlanda Airport', iata: 'ARN', countryISO2: 'SE', region: 'Europe', lat: 59.6485, lng: 17.9288, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.hel', kind: 'airport' as const, name: 'Helsinki Vantaa Airport', iata: 'HEL', countryISO2: 'FI', region: 'Europe', lat: 60.3184, lng: 24.9633, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.dub', kind: 'airport' as const, name: 'Dublin Airport', iata: 'DUB', countryISO2: 'IE', region: 'Europe', lat: 53.4287, lng: -6.2621, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.fco', kind: 'airport' as const, name: 'Rome–Fiumicino Leonardo da Vinci International Airport', iata: 'FCO', countryISO2: 'IT', region: 'Europe', lat: 41.8045, lng: 12.2520, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mxp', kind: 'airport' as const, name: 'Milan Malpensa International Airport', iata: 'MXP', countryISO2: 'IT', region: 'Europe', lat: 45.6306, lng: 8.7281, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ath', kind: 'airport' as const, name: 'Athens Eleftherios Venizelos International Airport', iata: 'ATH', countryISO2: 'GR', region: 'Europe', lat: 37.9364, lng: 23.9445, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bud', kind: 'airport' as const, name: 'Budapest Liszt Ferenc International Airport', iata: 'BUD', countryISO2: 'HU', region: 'Europe', lat: 47.4302, lng: 19.2624, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.waw', kind: 'airport' as const, name: 'Warsaw Chopin Airport', iata: 'WAW', countryISO2: 'PL', region: 'Europe', lat: 52.1657, lng: 20.9671, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.prg', kind: 'airport' as const, name: 'Václav Havel Airport Prague', iata: 'PRG', countryISO2: 'CZ', region: 'Europe', lat: 50.1009, lng: 14.2599, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.beg', kind: 'airport' as const, name: 'Belgrade Nikola Tesla Airport', iata: 'BEG', countryISO2: 'RS', region: 'Europe', lat: 44.8184, lng: 20.3091, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.svo', kind: 'airport' as const, name: 'Sheremetyevo International Airport', iata: 'SVO', countryISO2: 'RU', region: 'Europe', lat: 55.9769, lng: 37.4112, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.led', kind: 'airport' as const, name: 'Pulkovo Airport', iata: 'LED', countryISO2: 'RU', region: 'Europe', lat: 59.8003, lng: 30.2625, importance: 60, category: 'pax-cargo-hub' as const },

  // Africa
  { id: 'ap.jnb', kind: 'airport' as const, name: 'O.R. Tambo International Airport', iata: 'JNB', countryISO2: 'ZA', region: 'Africa', lat: -26.1401, lng: 28.2468, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.cai', kind: 'airport' as const, name: 'Cairo International Airport', iata: 'CAI', countryISO2: 'EG', region: 'Africa', lat: 30.1115, lng: 31.3967, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.nbo', kind: 'airport' as const, name: 'Jomo Kenyatta International Airport', iata: 'NBO', countryISO2: 'KE', region: 'Africa', lat: -1.3189, lng: 36.9282, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.add', kind: 'airport' as const, name: 'Addis Ababa Bole International Airport', iata: 'ADD', countryISO2: 'ET', region: 'Africa', lat: 8.9779, lng: 38.7993, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.los', kind: 'airport' as const, name: 'Murtala Muhammed International Airport', iata: 'LOS', countryISO2: 'NG', region: 'Africa', lat: 6.5774, lng: 3.3212, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.acc', kind: 'airport' as const, name: 'Kotoka International Airport', iata: 'ACC', countryISO2: 'GH', region: 'Africa', lat: 5.6052, lng: -0.1668, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.cmn', kind: 'airport' as const, name: 'Mohammed V International Airport', iata: 'CMN', countryISO2: 'MA', region: 'Africa', lat: 33.3675, lng: -7.5900, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.tun', kind: 'airport' as const, name: 'Tunis Carthage International Airport', iata: 'TUN', countryISO2: 'TN', region: 'Africa', lat: 36.8510, lng: 10.2272, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.dar', kind: 'airport' as const, name: 'Julius Nyerere International Airport', iata: 'DAR', countryISO2: 'TZ', region: 'Africa', lat: -6.8735, lng: 39.2073, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ebb', kind: 'airport' as const, name: 'Entebbe International Airport', iata: 'EBB', countryISO2: 'UG', region: 'Africa', lat: 0.0424, lng: 32.4435, importance: 60, category: 'pax-cargo-hub' as const },

  // North America
  { id: 'ap.jfk', kind: 'airport' as const, name: 'John F. Kennedy International Airport', iata: 'JFK', countryISO2: 'US', region: 'North America', lat: 40.6394, lng: -73.7793, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.atl', kind: 'airport' as const, name: 'Hartsfield Jackson Atlanta International Airport', iata: 'ATL', countryISO2: 'US', region: 'North America', lat: 33.6367, lng: -84.4281, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.dfw', kind: 'airport' as const, name: 'Dallas Fort Worth International Airport', iata: 'DFW', countryISO2: 'US', region: 'North America', lat: 32.8968, lng: -97.0380, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mia', kind: 'airport' as const, name: 'Miami International Airport', iata: 'MIA', countryISO2: 'US', region: 'North America', lat: 25.7960, lng: -80.2898, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.sfo', kind: 'airport' as const, name: 'San Francisco International Airport', iata: 'SFO', countryISO2: 'US', region: 'North America', lat: 37.6198, lng: -122.3748, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.sea', kind: 'airport' as const, name: 'Seattle–Tacoma International Airport', iata: 'SEA', countryISO2: 'US', region: 'North America', lat: 47.4479, lng: -122.3103, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.iah', kind: 'airport' as const, name: 'George Bush Intercontinental Airport', iata: 'IAH', countryISO2: 'US', region: 'North America', lat: 29.9844, lng: -95.3414, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.yyz', kind: 'airport' as const, name: 'Toronto Pearson International Airport', iata: 'YYZ', countryISO2: 'CA', region: 'North America', lat: 43.6759, lng: -79.6294, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.yvr', kind: 'airport' as const, name: 'Vancouver International Airport', iata: 'YVR', countryISO2: 'CA', region: 'North America', lat: 49.1939, lng: -123.1840, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.yul', kind: 'airport' as const, name: 'Montreal Pierre Elliott Trudeau International Airport', iata: 'YUL', countryISO2: 'CA', region: 'North America', lat: 45.4678, lng: -73.7423, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mex', kind: 'airport' as const, name: 'Mexico City Benito Juárez International Airport', iata: 'MEX', countryISO2: 'MX', region: 'North America', lat: 19.4358, lng: -99.0703, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pty', kind: 'airport' as const, name: 'Tocumen International Airport', iata: 'PTY', countryISO2: 'PA', region: 'North America', lat: 9.0714, lng: -79.3835, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.gua', kind: 'airport' as const, name: 'La Aurora International Airport', iata: 'GUA', countryISO2: 'GT', region: 'North America', lat: 14.5829, lng: -90.5275, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.hav', kind: 'airport' as const, name: 'José Martí International Airport', iata: 'HAV', countryISO2: 'CU', region: 'North America', lat: 22.9892, lng: -82.4091, importance: 60, category: 'pax-cargo-hub' as const },

  // South America
  { id: 'ap.gru', kind: 'airport' as const, name: 'São Paulo/Guarulhos International Airport', iata: 'GRU', countryISO2: 'BR', region: 'South America', lat: -23.4313, lng: -46.4700, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.eze', kind: 'airport' as const, name: 'Ezeiza International Airport', iata: 'EZE', countryISO2: 'AR', region: 'South America', lat: -34.8222, lng: -58.5358, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bog', kind: 'airport' as const, name: 'El Dorado International Airport', iata: 'BOG', countryISO2: 'CO', region: 'South America', lat: 4.7016, lng: -74.1469, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.scl', kind: 'airport' as const, name: 'Comodoro Arturo Merino Benítez International Airport', iata: 'SCL', countryISO2: 'CL', region: 'South America', lat: -33.3930, lng: -70.7858, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.lim', kind: 'airport' as const, name: 'Jorge Chávez International Airport', iata: 'LIM', countryISO2: 'PE', region: 'South America', lat: -12.0219, lng: -77.1143, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.gig', kind: 'airport' as const, name: 'Rio Galeão – Tom Jobim International Airport', iata: 'GIG', countryISO2: 'BR', region: 'South America', lat: -22.8100, lng: -43.2506, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.uio', kind: 'airport' as const, name: 'Mariscal Sucre International Airport', iata: 'UIO', countryISO2: 'EC', region: 'South America', lat: -0.1254, lng: -78.3543, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.ccs', kind: 'airport' as const, name: 'Maiquetía Simón Bolívar International Airport', iata: 'CCS', countryISO2: 'VE', region: 'South America', lat: 10.6022, lng: -66.9912, importance: 60, category: 'pax-cargo-hub' as const },

  // Oceania
  { id: 'ap.syd', kind: 'airport' as const, name: 'Sydney Kingsford Smith International Airport', iata: 'SYD', countryISO2: 'AU', region: 'Oceania', lat: -33.9461, lng: 151.1770, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.mel', kind: 'airport' as const, name: 'Melbourne Airport', iata: 'MEL', countryISO2: 'AU', region: 'Oceania', lat: -37.6707, lng: 144.8379, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.bne', kind: 'airport' as const, name: 'Brisbane International Airport', iata: 'BNE', countryISO2: 'AU', region: 'Oceania', lat: -27.3842, lng: 153.1170, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.per', kind: 'airport' as const, name: 'Perth International Airport', iata: 'PER', countryISO2: 'AU', region: 'Oceania', lat: -31.9403, lng: 115.9670, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.akl', kind: 'airport' as const, name: 'Auckland International Airport', iata: 'AKL', countryISO2: 'NZ', region: 'Oceania', lat: -37.0120, lng: 174.7863, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.pom', kind: 'airport' as const, name: 'Port Moresby Jacksons International Airport', iata: 'POM', countryISO2: 'PG', region: 'Oceania', lat: -9.4434, lng: 147.2200, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.nadi', kind: 'airport' as const, name: 'Nadi International Airport', iata: 'NAN', countryISO2: 'FJ', region: 'Oceania', lat: -17.7618, lng: 177.4378, importance: 60, category: 'pax-cargo-hub' as const },

  // Central Asia
  { id: 'ap.ala', kind: 'airport' as const, name: 'Almaty International Airport', iata: 'ALA', countryISO2: 'KZ', region: 'Asia', lat: 43.3543, lng: 77.0428, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.tbs', kind: 'airport' as const, name: 'Tbilisi International Airport', iata: 'TBS', countryISO2: 'GE', region: 'Asia', lat: 41.6692, lng: 44.9547, importance: 60, category: 'pax-cargo-hub' as const },
  { id: 'ap.tas', kind: 'airport' as const, name: 'Tashkent International Airport', iata: 'TAS', countryISO2: 'UZ', region: 'Asia', lat: 41.2579, lng: 69.2812, importance: 60, category: 'pax-cargo-hub' as const },
];
