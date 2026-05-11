import type { TradeRoute } from './types';

/**
 * Major air-cargo corridors.
 *
 * Aircraft fly close to great-circle paths, but real cargo routings deviate
 * from the geodesic in two important ways:
 *
 *   1. Air-traffic-control corridors — airways are not continuous, they
 *      bend through specific routing points.  Visually unimportant at
 *      globe scale.
 *
 *   2. Closed airspace.  Since Feb 2022, Russia and Belarus closed their
 *      airspace to most Western carriers in response to sanctions.
 *      Cargo carriers that pre-2022 flew the great circle from East Asia
 *      to Europe over Siberia now reroute via Central Asia, the Caspian,
 *      Turkey and the Balkans — adding 1–3 hours and ~10–15% fuel burn.
 *
 * The routes below model the post-2022 realities for Western carriers.
 * Transpacific and intra-Atlantic routes are not affected and remain
 * great-circle approximations.
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
    // Post-2022 routing via Hexi Corridor + Central Asia.  Pre-2022
    // Siberian great circle is unavailable to Western carriers.  Real
    // tracks (Cathay Cargo, Lufthansa Cargo) avoid the Tibetan plateau
    // interior — oxygen / decompression-escape constraints push the
    // path further north through the Gansu corridor.
    description: 'Asia–Europe airfreight artery; perishables, pharma, e-commerce. Post-2022 routing via Hexi Corridor + Central Asia + Caucasus + Turkey.',
    tags: ['cargo'],
    waypoints: [
      { lat: 28, lng: 110 },   // Over Hunan / Guangxi
      { lat: 34, lng: 105 },   // Over Shaanxi (Xi'an area)
      { lat: 38, lng:  98 },   // Hexi corridor (Jiayuguan-Lanzhou axis)
      { lat: 41, lng:  88 },   // Northern Xinjiang
      { lat: 43, lng:  76 },   // Almaty / Bishkek — Tian Shan north
      { lat: 42, lng:  62 },   // Uzbekistan
      { lat: 40, lng:  52 },   // Caspian Sea
      { lat: 40, lng:  44 },   // Caucasus / Armenia-Azerbaijan
      { lat: 41, lng:  32 },   // Turkey north (Black Sea approach)
      { lat: 44, lng:  25 },   // Romania
      { lat: 47, lng:  17 },   // Hungary / Austria approach
    ],
  },

  {
    id: 'ar.pvg-fra', name: 'Shanghai → Frankfurt',
    mode: 'air',
    startLat: 31.144, startLng: 121.808,
    endLat:   50.038, endLng:     8.562,
    importance: 85,
    description: 'Shanghai cargo trunk to Europe. Post-2022 routing via Central Asia, Caspian and Turkey — Russian airspace closed to Western carriers.',
    tags: ['cargo'],
    waypoints: [
      { lat: 35, lng: 113 },   // Henan / Hubei
      { lat: 39, lng: 102 },   // Northern China (Ningxia)
      { lat: 41, lng:  92 },   // Hami / Xinjiang east
      { lat: 43, lng:  80 },   // Western Xinjiang (Khorgos region)
      { lat: 43, lng:  67 },   // Kazakhstan central
      { lat: 41, lng:  55 },   // Caspian Sea
      { lat: 40, lng:  44 },   // Caucasus
      { lat: 42, lng:  32 },   // Turkey
      { lat: 45, lng:  22 },   // Balkans
      { lat: 47, lng:  15 },   // Austria
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
    description: 'SE Asia → Europe long-haul cargo. Southern routing via India + Iran + Turkey (also avoids Russian airspace).',
    tags: ['cargo'],
    waypoints: [
      { lat:  6, lng:  96 },   // Andaman Sea / Strait of Malacca exit
      { lat: 13, lng:  88 },   // Bay of Bengal
      { lat: 20, lng:  78 },   // Central India (Hyderabad-Nagpur axis)
      { lat: 26, lng:  70 },   // NW India / Sindh-Rajasthan border
      { lat: 30, lng:  62 },   // South Iran / Persian Gulf
      { lat: 34, lng:  53 },   // Central Iran
      { lat: 38, lng:  44 },   // NW Iran (Tabriz region)
      { lat: 42, lng:  35 },   // Turkey east
      { lat: 45, lng:  24 },   // Romania
      { lat: 47, lng:  16 },   // Austria
    ],
  },
];
