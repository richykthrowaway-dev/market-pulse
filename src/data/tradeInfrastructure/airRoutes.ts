import type { TradeRoute } from './types';

/**
 * Major air-cargo corridors.
 *
 * Planes genuinely fly great-circle routes, so most routes need no
 * waypoints. Transpolar and transpacific legs get explicit waypoints so
 * the visible arc traces the northward polar bulge rather than a flat
 * chord that visually clips through continents.
 */
export const AIR_ROUTES: TradeRoute[] = [
  {
    id: 'ar.hkg-anc', name: 'Hong Kong → Anchorage',
    mode: 'air',
    startLat: 22.308, startLng: 113.919,
    endLat:   61.174, endLng: -149.996,
    importance: 95,
    description: 'Transpacific freighter spine; Anchorage refueling node.',
    tags: ['cargo', 'transpolar'],
    waypoints: [
      { lat: 32, lng: 130 },   // East of Japan coast
      { lat: 42, lng: 148 },   // Pacific north of Japan
      { lat: 52, lng: 165 },   // Aleutians approach
      { lat: 58, lng: -175 },  // Near Aleutian arc
      { lat: 60, lng: -160 },  // Alaska approach
    ],
  },

  {
    id: 'ar.anc-mem', name: 'Anchorage → Memphis',
    mode: 'air',
    startLat: 61.174, startLng: -149.996,
    endLat:   35.042, endLng:   -89.979,
    importance: 90,
    description: 'FedEx integrator backbone leg.',
    tags: ['cargo', 'integrator'],
    waypoints: [
      { lat: 58, lng: -135 },  // Gulf of Alaska
      { lat: 52, lng: -120 },  // British Columbia
      { lat: 46, lng: -110 },  // Montana
      { lat: 40, lng: -100 },  // Kansas
    ],
  },

  {
    id: 'ar.hkg-fra', name: 'Hong Kong → Frankfurt',
    mode: 'air',
    startLat: 22.308, startLng: 113.919,
    endLat:   50.038, endLng:     8.562,
    importance: 90,
    description: 'Asia–Europe airfreight artery; perishables, pharma, e-commerce.',
    tags: ['cargo'],
    waypoints: [
      { lat: 32, lng: 108 },   // Over south-central China
      { lat: 42, lng:  90 },   // Central Asia
      { lat: 50, lng:  68 },   // Kazakhstan
      { lat: 56, lng:  45 },   // Russia / Ural area
      { lat: 58, lng:  25 },   // Eastern Europe / Baltic
      { lat: 54, lng:  12 },   // Northern Germany approach
    ],
  },

  {
    id: 'ar.pvg-fra', name: 'Shanghai → Frankfurt',
    mode: 'air',
    startLat: 31.144, startLng: 121.808,
    endLat:   50.038, endLng:     8.562,
    importance: 85,
    tags: ['cargo'],
    waypoints: [
      { lat: 40, lng: 110 },
      { lat: 50, lng:  88 },
      { lat: 56, lng:  62 },
      { lat: 58, lng:  38 },
      { lat: 55, lng:  18 },
    ],
  },

  {
    id: 'ar.hkg-lax', name: 'Hong Kong → Los Angeles',
    mode: 'air',
    startLat: 22.308, startLng: 113.919,
    endLat:   33.942, endLng:  -118.408,
    importance: 88,
    description: 'Direct transpacific cargo.',
    tags: ['cargo'],
    waypoints: [
      { lat: 30, lng: 130 },
      { lat: 40, lng: 148 },
      { lat: 48, lng: 165 },
      { lat: 52, lng: -175 },
      { lat: 48, lng: -155 },
      { lat: 40, lng: -135 },
    ],
  },

  {
    id: 'ar.dxb-lhr', name: 'Dubai → London',
    mode: 'air',
    startLat: 25.253, startLng:  55.366,
    endLat:   51.470, endLng:    -0.454,
    importance: 78,
    description: 'Gulf transit hub → Europe.',
    tags: ['cargo', 'pax'],
    waypoints: [
      { lat: 36, lng: 40 },    // Turkey / eastern Mediterranean
      { lat: 44, lng: 28 },    // Romania / Bulgaria
      { lat: 50, lng: 16 },    // Central Europe
    ],
  },

  {
    id: 'ar.dxb-jfk', name: 'Dubai → New York',
    mode: 'air',
    startLat: 25.253, startLng:  55.366,
    endLat:   40.689, endLng:   -74.044,
    importance: 75,
    tags: ['cargo', 'pax'],
    waypoints: [
      { lat: 40, lng: 32 },    // Over Turkey/Black Sea
      { lat: 50, lng: 14 },    // Central Europe
      { lat: 54, lng:  -2 },   // Over UK
      { lat: 54, lng: -20 },   // North Atlantic
      { lat: 52, lng: -40 },   // Mid-Atlantic
      { lat: 48, lng: -55 },   // Nearing Canada
    ],
  },

  {
    id: 'ar.icn-mem', name: 'Incheon → Memphis',
    mode: 'air',
    startLat: 37.469, startLng: 126.451,
    endLat:   35.042, endLng:   -89.979,
    importance: 80,
    description: 'Korea → US South integrator route.',
    tags: ['cargo'],
    waypoints: [
      { lat: 44, lng: 140 },
      { lat: 50, lng: 155 },
      { lat: 54, lng: 170 },
      { lat: 54, lng: -170 },
      { lat: 50, lng: -155 },
      { lat: 44, lng: -130 },
      { lat: 40, lng: -110 },
    ],
  },

  {
    id: 'ar.cgn-jfk', name: 'Cologne → New York',
    mode: 'air',
    startLat: 50.866, startLng:   7.143,
    endLat:   40.689, endLng:   -74.044,
    importance: 70,
    description: 'DHL transatlantic backbone.',
    tags: ['cargo', 'integrator'],
    waypoints: [
      { lat: 54, lng:  -2 },   // Over southern UK
      { lat: 56, lng: -20 },   // North Atlantic
      { lat: 54, lng: -35 },
      { lat: 50, lng: -50 },
      { lat: 46, lng: -62 },   // Atlantic Canada
    ],
  },

  {
    id: 'ar.sin-fra', name: 'Singapore → Frankfurt',
    mode: 'air',
    startLat:  1.364, startLng: 103.992,
    endLat:   50.038, endLng:     8.562,
    importance: 72,
    description: 'SE Asia → Europe long-haul cargo.',
    tags: ['cargo'],
    waypoints: [
      { lat: 14, lng:  98 },   // Myanmar / Thailand
      { lat: 26, lng:  82 },   // Northern India
      { lat: 36, lng:  66 },   // Afghanistan / Central Asia
      { lat: 46, lng:  52 },   // Kazakhstan / Caspian
      { lat: 54, lng:  34 },   // Ukraine / Russia
      { lat: 54, lng:  18 },   // Poland
    ],
  },
];
