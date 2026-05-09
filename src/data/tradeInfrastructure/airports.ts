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
  { id: 'ap.hkg', kind: 'airport', name: 'Hong Kong Intl', iata: 'HKG', countryISO2: 'HK', region: 'East Asia', lat: 22.3080, lng: 113.9185, importance: 100, category: 'air-cargo-hub', description: 'World\'s top air-cargo airport by tonnage; ~5M tonnes/year. Anchors China-export airfreight to Europe / North America.', tags: ['cargo', 'asia-anchor'], metrics: { cargo_tonnage: 5.0 } },
  { id: 'ap.mem', kind: 'airport', name: 'Memphis Intl',   iata: 'MEM', countryISO2: 'US', region: 'North America', lat: 35.0421, lng: -89.9792, importance: 96, category: 'integrator-hub', description: 'FedEx Express superhub; the original "world\'s busiest cargo airport". US domestic overnight backbone.', tags: ['cargo', 'integrator', 'fedex'], metrics: { cargo_tonnage: 4.4 } },
  { id: 'ap.pvg', kind: 'airport', name: 'Shanghai Pudong', iata: 'PVG', countryISO2: 'CN', region: 'East Asia', lat: 31.1443, lng: 121.8083, importance: 94, category: 'pax-cargo-hub', description: 'China\'s primary international cargo gateway; tightly coupled with Shanghai sea-port multimodal.', tags: ['cargo', 'pax'] },
  { id: 'ap.icn', kind: 'airport', name: 'Incheon Intl',   iata: 'ICN', countryISO2: 'KR', region: 'East Asia', lat: 37.4691, lng: 126.4505, importance: 87, category: 'pax-cargo-hub', description: 'Asia-NorthAm transpacific cargo node; Korean Air Cargo / Asiana base.' },
  { id: 'ap.dxb', kind: 'airport', name: 'Dubai Intl',     iata: 'DXB', countryISO2: 'AE', region: 'Middle East', lat: 25.2532, lng: 55.3657, importance: 88, category: 'pax-cargo-hub', description: 'Emirates SkyCargo home; major Asia–Europe stopover and pax superhub.', tags: ['cargo', 'pax'] },
  { id: 'ap.doh', kind: 'airport', name: 'Doha Hamad',     iata: 'DOH', countryISO2: 'QA', region: 'Middle East', lat: 25.2731, lng: 51.6080, importance: 80, category: 'pax-cargo-hub', description: 'Qatar Airways Cargo home; Gulf transit hub.' },
  { id: 'ap.fra', kind: 'airport', name: 'Frankfurt',      iata: 'FRA', countryISO2: 'DE', region: 'Europe', lat: 50.0379, lng: 8.5622, importance: 86, category: 'pax-cargo-hub', description: 'Lufthansa Cargo home; Europe\'s top air-cargo airport by tonnage.' },
  { id: 'ap.ams', kind: 'airport', name: 'Amsterdam Schiphol', iata: 'AMS', countryISO2: 'NL', region: 'Europe', lat: 52.3105, lng: 4.7683, importance: 80, category: 'pax-cargo-hub', description: 'Major perishables / pharma corridor; tightly integrated with Rotterdam port.' },
  { id: 'ap.lhr', kind: 'airport', name: 'London Heathrow', iata: 'LHR', countryISO2: 'GB', region: 'Europe', lat: 51.4700, lng: -0.4543, importance: 78, category: 'pax-cargo-hub' },
  { id: 'ap.cgn', kind: 'airport', name: 'Cologne / Bonn', iata: 'CGN', countryISO2: 'DE', region: 'Europe', lat: 50.8659, lng: 7.1427, importance: 74, category: 'integrator-hub', description: 'DHL European hub; FedEx Europe ops.', tags: ['cargo', 'integrator', 'dhl'] },
  { id: 'ap.lux', kind: 'airport', name: 'Luxembourg Findel', iata: 'LUX', countryISO2: 'LU', region: 'Europe', lat: 49.6233, lng: 6.2044, importance: 65, category: 'air-cargo-hub', description: 'Cargolux home; specialised freighter operations.', tags: ['cargo'] },
  { id: 'ap.anc', kind: 'airport', name: 'Anchorage Intl', iata: 'ANC', countryISO2: 'US', region: 'North America', lat: 61.1742, lng: -149.9961, importance: 79, category: 'air-cargo-hub', description: 'Strategic transpacific / transpolar refueling node. Tax incentives drive freighter throughput.', strategicRole: 'Asia–North America freighter pivot.', tags: ['cargo', 'refuel-node'] },
  { id: 'ap.ord', kind: 'airport', name: 'Chicago O\'Hare', iata: 'ORD', countryISO2: 'US', region: 'North America', lat: 41.9742, lng: -87.9073, importance: 78, category: 'pax-cargo-hub' },
  { id: 'ap.sdf', kind: 'airport', name: 'Louisville Intl', iata: 'SDF', countryISO2: 'US', region: 'North America', lat: 38.1740, lng: -85.7360, importance: 75, category: 'integrator-hub', description: 'UPS Worldport — UPS\'s global air-hub.', tags: ['cargo', 'integrator', 'ups'] },
  { id: 'ap.lax', kind: 'airport', name: 'Los Angeles Intl', iata: 'LAX', countryISO2: 'US', region: 'North America', lat: 33.9416, lng: -118.4085, importance: 76, category: 'pax-cargo-hub' },
  { id: 'ap.sin', kind: 'airport', name: 'Singapore Changi', iata: 'SIN', countryISO2: 'SG', region: 'Southeast Asia', lat: 1.3644, lng: 103.9915, importance: 82, category: 'pax-cargo-hub', description: 'Southeast Asia transit superhub; tight coupling with Singapore seaport.' },
];
