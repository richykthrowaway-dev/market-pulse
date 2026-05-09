import type { InlandHub } from './types';

/**
 * Major inland logistics hubs / dry ports / intermodal gateways.
 *
 * These are landlocked nodes that connect maritime gateways to interior
 * production / consumption zones via rail or truck. Often invisible on
 * standard ports/airports maps but critical to actual goods movement.
 */
export const INLAND_HUBS: InlandHub[] = [
  { id: 'ih.duisburg', kind: 'inlandHub', name: 'Duisburg', countryISO2: 'DE', region: 'Europe', lat: 51.4344, lng: 6.7623, importance: 90, category: 'intermodal-gateway', description: 'World\'s largest inland port. Western terminus of the China–Europe rail corridor; Rhine multimodal anchor.', tags: ['rail', 'bri-anchor'] },
  { id: 'ih.chongqing', kind: 'inlandHub', name: 'Chongqing', countryISO2: 'CN', region: 'East Asia', lat: 29.4316, lng: 106.9123, importance: 84, category: 'rail-hub', description: 'Major inland China rail-launch point for China–Europe Express services.', tags: ['rail', 'bri-anchor'] },
  { id: 'ih.zhengzhou', kind: 'inlandHub', name: 'Zhengzhou', countryISO2: 'CN', region: 'East Asia', lat: 34.7466, lng: 113.6253, importance: 78, category: 'rail-hub', description: 'Central China rail dry-port; major China–Europe service operator.', tags: ['rail'] },
  { id: 'ih.almaty', kind: 'inlandHub', name: 'Khorgos / Almaty', countryISO2: 'KZ', region: 'Central Asia', lat: 44.2117, lng: 80.4078, importance: 75, category: 'dry-port', description: 'China–Kazakhstan rail border; major BRI transshipment dry-port.', tags: ['rail', 'bri-anchor'] },
  { id: 'ih.malaszewicze', kind: 'inlandHub', name: 'Małaszewicze', countryISO2: 'PL', region: 'Europe', lat: 52.0333, lng: 23.4167, importance: 70, category: 'dry-port', description: 'Poland–Belarus border gauge-change facility; ~90% of EU-bound China rail freight transits here.', tags: ['rail', 'bri-anchor'] },
  { id: 'ih.kc-intermodal', kind: 'inlandHub', name: 'Kansas City', countryISO2: 'US', region: 'North America', lat: 39.0997, lng: -94.5786, importance: 72, category: 'intermodal-gateway', description: 'Largest inland-port complex in the US by rail tonnage. Connects west/east-coast container flows.' },
  { id: 'ih.dallas', kind: 'inlandHub', name: 'Dallas–Fort Worth', countryISO2: 'US', region: 'North America', lat: 32.7767, lng: -96.7970, importance: 68, category: 'intermodal-gateway' },
  { id: 'ih.chicago', kind: 'inlandHub', name: 'Chicago Intermodal', countryISO2: 'US', region: 'North America', lat: 41.8781, lng: -87.6298, importance: 75, category: 'rail-hub', description: 'Largest US rail interchange — every Class I railroad meets here.' },
  { id: 'ih.sao-paulo', kind: 'inlandHub', name: 'São Paulo Logistics Belt', countryISO2: 'BR', region: 'South America', lat: -23.5505, lng: -46.6333, importance: 65, category: 'logistics-zone' },
  { id: 'ih.delhi', kind: 'inlandHub', name: 'Delhi Inland Container Depot', countryISO2: 'IN', region: 'South Asia', lat: 28.7041, lng: 77.1025, importance: 70, category: 'dry-port', description: 'Northern India\'s primary container dry-port; rail-connected to Mumbai/Mundra.' },
];
