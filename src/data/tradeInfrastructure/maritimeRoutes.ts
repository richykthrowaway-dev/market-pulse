import type { TradeRoute } from './types';

/**
 * Major maritime trade corridors.
 *
 * Note: ocean routes are great-circle approximations between port pairs;
 * react-globe.gl's `arcsData` draws great-circle arcs natively. Real
 * maritime traffic curves around continents — we draw waypoint-anchored
 * segments to approximate that without a routing engine.
 *
 * `passesThrough` references chokepoint IDs so the UI can highlight a
 * corridor's strategic dependencies when a node is hovered.
 */
export const MARITIME_ROUTES: TradeRoute[] = [
  // ── Asia → Europe (via Suez) ───────────────────────────────────────
  { id: 'mr.shanghai-singapore', name: 'Shanghai → Singapore', mode: 'maritime', startLat: 30.6260, startLng: 122.0570, endLat: 1.2655, endLng: 103.8240, importance: 95, passesThrough: ['cp.taiwan'], description: 'East Asia → SE Asia leg of the Asia–Europe corridor.' },
  { id: 'mr.singapore-suez', name: 'Singapore → Suez', mode: 'maritime', startLat: 1.2655, startLng: 103.8240, endLat: 30.5852, endLng: 32.2654, importance: 100, passesThrough: ['cp.malacca', 'cp.bab-el-mandeb'], description: 'Indian Ocean leg of Asia–Europe via Malacca + Bab el-Mandeb.', tags: ['container', 'asia-europe'] },
  { id: 'mr.suez-rotterdam', name: 'Suez → Rotterdam', mode: 'maritime', startLat: 30.5852, startLng: 32.2654, endLat: 51.9244, endLng: 4.4777, importance: 100, passesThrough: ['cp.suez', 'cp.gibraltar'], description: 'Mediterranean → North Europe terminal leg of Asia–Europe corridor.' },

  // ── Asia ↔ North America (Transpacific) ────────────────────────────
  { id: 'mr.shanghai-la', name: 'Shanghai → Los Angeles', mode: 'maritime', startLat: 30.6260, startLng: 122.0570, endLat: 33.7395, endLng: -118.2620, importance: 95, description: 'Transpacific container backbone — China manufacturing → US west coast.', tags: ['container', 'transpacific'] },
  { id: 'mr.busan-la', name: 'Busan → Los Angeles', mode: 'maritime', startLat: 35.1028, startLng: 129.0403, endLat: 33.7395, endLng: -118.2620, importance: 80, tags: ['container', 'transpacific'] },
  { id: 'mr.shanghai-balboa', name: 'Shanghai → Balboa (Panama)', mode: 'maritime', startLat: 30.6260, startLng: 122.0570, endLat: 8.9520, endLng: -79.5667, importance: 70, passesThrough: ['cp.panama'], description: 'Asia → US East Coast via Panama Canal.' },

  // ── Transatlantic ──────────────────────────────────────────────────
  { id: 'mr.rotterdam-nynj', name: 'Rotterdam → New York/NJ', mode: 'maritime', startLat: 51.9244, startLng: 4.4777, endLat: 40.6892, endLng: -74.0445, importance: 78, description: 'Primary Europe → US east-coast container corridor.', tags: ['container', 'transatlantic'] },
  { id: 'mr.algeciras-nynj', name: 'Algeciras → New York/NJ', mode: 'maritime', startLat: 36.1408, startLng: -5.4561, endLat: 40.6892, endLng: -74.0445, importance: 65, passesThrough: ['cp.gibraltar'], tags: ['container', 'transatlantic'] },

  // ── Energy: Persian Gulf → Asia ────────────────────────────────────
  { id: 'mr.rastanura-singapore', name: 'Ras Tanura → Singapore', mode: 'maritime', startLat: 26.6928, startLng: 50.1583, endLat: 1.2655, endLng: 103.8240, importance: 92, passesThrough: ['cp.hormuz', 'cp.malacca'], description: 'Crude oil arc — Persian Gulf to Asia. Largest single energy flow on Earth.', tags: ['energy', 'crude'] },
  { id: 'mr.rastanura-shanghai', name: 'Ras Tanura → Shanghai', mode: 'maritime', startLat: 26.6928, startLng: 50.1583, endLat: 30.6260, endLng: 122.0570, importance: 90, passesThrough: ['cp.hormuz', 'cp.malacca'], tags: ['energy', 'crude'] },

  // ── Cape of Good Hope alternative ──────────────────────────────────
  { id: 'mr.singapore-cape-rotterdam', name: 'Singapore → Rotterdam (via Cape)', mode: 'maritime', startLat: 1.2655, startLng: 103.8240, endLat: 51.9244, endLng: 4.4777, importance: 60, passesThrough: ['cp.cape'], description: 'Suez-bypass route used during Red Sea disruptions. ~10–14 days longer.', tags: ['resilience', 'cape-route'] },

  // ── Australia bulk → Asia ──────────────────────────────────────────
  { id: 'mr.hedland-qingdao', name: 'Port Hedland → Qingdao', mode: 'maritime', startLat: -20.3115, startLng: 118.5766, endLat: 36.0833, endLng: 120.3000, importance: 80, description: 'Iron ore bulk corridor — Australia → northern China.', tags: ['bulk', 'iron-ore'] },

  // ── Brazil → China (soy / iron) ────────────────────────────────────
  { id: 'mr.santos-shanghai', name: 'Santos → Shanghai', mode: 'maritime', startLat: -23.9608, startLng: -46.3331, endLat: 30.6260, endLng: 122.0570, importance: 75, passesThrough: ['cp.cape'], description: 'Soy + iron-ore corridor — Brazil → China.', tags: ['bulk'] },

  // ── Indian Ocean / Africa ──────────────────────────────────────────
  { id: 'mr.colombo-jebelali', name: 'Colombo → Jebel Ali', mode: 'maritime', startLat: 6.9355, startLng: 79.8441, endLat: 24.9857, endLng: 55.0700, importance: 65, description: 'Indian Ocean transshipment feeder.', tags: ['container'] },
];
