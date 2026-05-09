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
];
