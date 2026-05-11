import type { StoryMode } from './types';

/**
 * Curated guided "story modes" that reframe the globe + panel toward a
 * specific lens. Each mode pre-selects which layers are visible and
 * (optionally) where the camera focuses. Acts as a guided tour for
 * users who don't know which layers to combine.
 */
export const STORY_MODES: StoryMode[] = [
  {
    id: 'overview',
    title: 'Global Overview',
    description: 'All major infrastructure layers — the full backbone of physical trade.',
    layers: ['seaports', 'airports', 'maritimeRoutes', 'chokepoints'],
  },
  {
    id: 'container',
    title: 'Container Shipping Backbone',
    description: 'Asia–Europe and transpacific container lanes, top container ports, and the chokepoints they depend on.',
    layers: ['seaports', 'maritimeRoutes', 'chokepoints'],
    focus: { lat: 25, lng: 90, altitude: 2.6 },
  },
  {
    id: 'air-cargo',
    title: 'Air Cargo Network',
    description: 'Top cargo airports and integrator superhubs (FedEx, UPS, DHL) plus the great-circle freighter spine.',
    layers: ['airports', 'airRoutes'],
    focus: { lat: 35, lng: 0, altitude: 2.6 },
  },
  {
    id: 'energy',
    title: 'Energy Chokepoints',
    description: 'Hormuz, Malacca, and the Persian Gulf → Asia crude artery — where energy markets pivot.',
    layers: ['chokepoints', 'maritimeRoutes', 'seaports'],
    focus: { lat: 22, lng: 70, altitude: 2.4 },
  },
  {
    id: 'asia-europe',
    title: 'Asia ↔ Europe Corridor',
    description: 'The world\'s most valuable trade corridor: maritime via Suez, rail via Eurasia.',
    layers: ['maritimeRoutes', 'railCorridors', 'chokepoints', 'seaports', 'inlandHubs'],
    focus: { lat: 40, lng: 60, altitude: 2.4 },
  },
  {
    id: 'north-america',
    title: 'North American Trade Gateways',
    description: 'West-coast container ports, transcontinental rail, and major inland intermodal hubs.',
    layers: ['seaports', 'railCorridors', 'inlandHubs'],
    focus: { lat: 40, lng: -100, altitude: 2.4 },
  },
  {
    id: 'risk',
    title: 'Supply-Chain Risk View',
    description: 'Chokepoints + recent disruption flags. Designed to grow into a live resilience overlay.',
    layers: ['chokepoints', 'maritimeRoutes', 'risk'],
  },

  // ── Crisis lenses ─────────────────────────────────────────────────────────
  // Each preset zooms to an ongoing or recurrent crisis and lights up the
  // layers that make the situation legible.  Designed so a user landing
  // here can immediately understand "what's happening with X right now".
  {
    id: 'red-sea-crisis',
    title: 'Red Sea Crisis',
    description: 'Bab el-Mandeb attacks, Suez diversions, Cape route reactivation. Live vessels + maritime + conflicts.',
    layers: ['chokepoints', 'maritimeRoutes', 'seaports', 'liveVessels', 'conflictEvents'],
    focus: { lat: 15, lng: 42, altitude: 1.8 },
  },
  {
    id: 'panama-drought',
    title: 'Panama Canal Squeeze',
    description: 'Drought-driven transit cuts and the Atlantic ↔ Pacific bottleneck. Watch vessel queues build up.',
    layers: ['chokepoints', 'maritimeRoutes', 'seaports', 'liveVessels'],
    focus: { lat: 9, lng: -80, altitude: 1.8 },
  },
  {
    id: 'taiwan-contingency',
    title: 'Taiwan Contingency',
    description: 'Taiwan Strait flows, semiconductor air-cargo lanes, regional naval pressure. Chips and containers in one view.',
    layers: ['chokepoints', 'maritimeRoutes', 'seaports', 'airRoutes', 'airports', 'conflictEvents'],
    focus: { lat: 24, lng: 121, altitude: 2.0 },
  },
  {
    id: 'russia-energy-cutoff',
    title: 'Russia Energy Cutoff',
    description: 'Pipeline-free Europe: LNG ports, rail re-routes, Eastern European inland hubs. Post-sanctions geometry.',
    layers: ['seaports', 'railCorridors', 'inlandHubs', 'maritimeRoutes', 'economicEvents'],
    focus: { lat: 55, lng: 30, altitude: 2.4 },
  },
  {
    id: 'usmca-border',
    title: 'USMCA Nearshoring',
    description: 'Mexico–US border crossings, Texas rail hubs, Gulf ports. The reshoring corridor that replaced China-to-US.',
    layers: ['seaports', 'airports', 'railCorridors', 'inlandHubs', 'tradePartnerArcs'],
    focus: { lat: 30, lng: -100, altitude: 2.4 },
  },
];
