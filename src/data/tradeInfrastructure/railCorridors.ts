import type { TradeRoute } from './types';

/**
 * Major continental rail corridors and inland trade arteries.
 *
 * These are simplified end-to-end great-circle approximations of much
 * longer overland routes — the real corridors snake through dozens of
 * waypoints. The geometry is enough to communicate the corridor shape
 * at globe scale; future versions can replace each with a multi-segment
 * polyline once a routing dataset is available.
 */
export const RAIL_CORRIDORS: TradeRoute[] = [
  { id: 'rc.china-europe', name: 'China–Europe Rail (BRI)', mode: 'rail', startLat: 30.5928, startLng: 114.3055, endLat: 51.0500, endLng: 13.7373, importance: 88, description: 'New Eurasian Land Bridge — Yiwu/Chongqing → Duisburg/Hamburg via Kazakhstan and Russia/Belarus. ~16-day transit, 50% faster than sea.', tags: ['rail', 'bri'] },
  { id: 'rc.transsib', name: 'Trans-Siberian Corridor', mode: 'rail', startLat: 43.1056, startLng: 131.8735, endLat: 55.7558, endLng: 37.6176, importance: 70, description: 'Vladivostok → Moscow. Russia\'s east-west spine; container service feeds into European rail.', tags: ['rail'] },
  { id: 'rc.northam-bnsf', name: 'BNSF Transcon (LA → Chicago)', mode: 'rail', startLat: 33.7395, startLng: -118.2620, endLat: 41.8781, endLng:  -87.6298, importance: 80, description: 'Major US double-stack intermodal corridor — west-coast ports → Midwest distribution.', tags: ['rail', 'intermodal'] },
  { id: 'rc.northam-cn', name: 'CN Rail (Vancouver → Toronto)', mode: 'rail', startLat: 49.2827, startLng: -123.1207, endLat: 43.6532, endLng:  -79.3832, importance: 70, description: 'Trans-Canada main line; western ports → eastern manufacturing hubs.', tags: ['rail'] },
  { id: 'rc.india-ded', name: 'India Dedicated Freight Corridor (Mumbai → Delhi)', mode: 'rail', startLat: 19.0760, startLng: 72.8777, endLat: 28.7041, endLng:  77.1025, importance: 65, description: 'India\'s flagship dedicated freight corridor; double-stack capable.', tags: ['rail'] },
  { id: 'rc.europe-rhine', name: 'Rhine–Alpine Corridor', mode: 'rail', startLat: 51.9244, startLng: 4.4777, endLat: 45.4642, endLng: 9.1900, importance: 78, description: 'Rotterdam → Genoa via Switzerland — Europe\'s busiest freight rail axis.', tags: ['rail', 'intermodal'] },
];
