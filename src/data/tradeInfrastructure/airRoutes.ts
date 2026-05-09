import type { TradeRoute } from './types';

/**
 * Major air-cargo corridors. Importance is curated from IATA cargo-flow
 * data — the world's busiest international air-freight pairs.
 *
 * Air corridors are great-circle by default (planes really do fly that
 * way), so the lat/lng pair is the only geometry needed.
 */
export const AIR_ROUTES: TradeRoute[] = [
  { id: 'ar.hkg-anc',  name: 'Hong Kong → Anchorage',  mode: 'air', startLat: 22.3080, startLng: 113.9185, endLat: 61.1742, endLng: -149.9961, importance: 95, description: 'Transpacific freighter spine; Anchorage refueling.', tags: ['cargo', 'transpolar'] },
  { id: 'ar.anc-mem',  name: 'Anchorage → Memphis',     mode: 'air', startLat: 61.1742, startLng: -149.9961, endLat: 35.0421, endLng: -89.9792, importance: 90, description: 'FedEx integrator backbone leg.', tags: ['cargo', 'integrator'] },
  { id: 'ar.hkg-fra',  name: 'Hong Kong → Frankfurt',  mode: 'air', startLat: 22.3080, startLng: 113.9185, endLat: 50.0379, endLng:    8.5622, importance: 90, description: 'Asia–Europe airfreight artery; perishables, pharma, e-commerce.', tags: ['cargo'] },
  { id: 'ar.pvg-fra',  name: 'Shanghai → Frankfurt',   mode: 'air', startLat: 31.1443, startLng: 121.8083, endLat: 50.0379, endLng:    8.5622, importance: 85, tags: ['cargo'] },
  { id: 'ar.hkg-lax',  name: 'Hong Kong → Los Angeles', mode: 'air', startLat: 22.3080, startLng: 113.9185, endLat: 33.9416, endLng: -118.4085, importance: 88, description: 'Direct transpacific cargo.', tags: ['cargo'] },
  { id: 'ar.dxb-lhr',  name: 'Dubai → London',         mode: 'air', startLat: 25.2532, startLng:  55.3657, endLat: 51.4700, endLng:   -0.4543, importance: 78, description: 'Gulf transit hub → Europe.', tags: ['cargo', 'pax'] },
  { id: 'ar.dxb-jfk',  name: 'Dubai → New York',       mode: 'air', startLat: 25.2532, startLng:  55.3657, endLat: 40.6892, endLng:  -74.0445, importance: 75, tags: ['cargo', 'pax'] },
  { id: 'ar.icn-mem',  name: 'Incheon → Memphis',      mode: 'air', startLat: 37.4691, startLng: 126.4505, endLat: 35.0421, endLng:  -89.9792, importance: 80, description: 'Korea → US South integrator route.', tags: ['cargo'] },
  { id: 'ar.cgn-jfk',  name: 'Cologne → New York',     mode: 'air', startLat: 50.8659, startLng:   7.1427, endLat: 40.6892, endLng:  -74.0445, importance: 70, description: 'DHL transatlantic backbone.', tags: ['cargo', 'integrator'] },
  { id: 'ar.sin-fra',  name: 'Singapore → Frankfurt',  mode: 'air', startLat:  1.3644, startLng: 103.9915, endLat: 50.0379, endLng:    8.5622, importance: 72, description: 'SE Asia → Europe long-haul cargo.', tags: ['cargo'] },
];
