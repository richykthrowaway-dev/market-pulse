import type { TradeRoute } from './types';

/**
 * Major continental rail freight corridors.
 *
 * Rail follows literal track, not great-circle paths.  Every corridor
 * here carries an explicit `waypoints` chain placed at major junction
 * cities along the real route — the same Catmull-Rom smoothing the
 * renderer applies to maritime routes will trace through them, giving
 * a visual path that hugs the actual rail right-of-way rather than
 * arcing through the wrong countries.
 *
 * Sources: published carrier route maps + national rail authority data
 * (CR Express / Russian Railways / BNSF Network Atlas / CN Rail / DFCCIL /
 * Rhine–Alpine Corridor TEN-T Annex).
 */
export const RAIL_CORRIDORS: TradeRoute[] = [

  // ── China → Europe (CR Express / "New Eurasian Land Bridge") ───────────
  // The flagship Belt-and-Road rail corridor.  Multiple Chinese origins
  // (Chongqing, Yiwu, Xi'an, Wuhan, Chengdu) consolidate at Alashankou or
  // Khorgos on the Kazakh border, traverse Kazakhstan + Russia + Belarus,
  // then cross into Poland at Brest / Małaszewicze for break-of-gauge,
  // before fanning out to Duisburg, Hamburg, Łódź and elsewhere.
  // We model the canonical Chongqing → Duisburg path here.
  {
    id: 'rc.china-europe',
    name: 'China–Europe Rail (BRI)',
    mode: 'rail',
    startLat: 29.5630, startLng: 106.5516,  // Chongqing (Yuxinou origin)
    endLat:   51.4344, endLng:    6.7623,   // Duisburg (Europe terminus)
    importance: 88,
    description: 'New Eurasian Land Bridge — Chongqing → Duisburg via Kazakhstan, Russia, Belarus and Poland. ~16-day transit, 50% faster than sea.',
    tags: ['rail', 'bri'],
    waypoints: [
      { lat: 32.27, lng: 109.50 },   // Ankang transfer area, central China
      { lat: 36.06, lng: 103.84 },   // Lanzhou — Gansu corridor entry
      { lat: 39.74, lng:  98.51 },   // Jiayuguan / Hexi Corridor
      { lat: 43.83, lng:  87.62 },   // Urumqi — Xinjiang capital
      { lat: 45.18, lng:  82.57 },   // Alashankou — China-Kazakhstan border crossing
      { lat: 43.26, lng:  76.95 },   // Almaty — Kazakhstan
      { lat: 44.85, lng:  65.51 },   // Kyzylorda
      { lat: 50.30, lng:  57.17 },   // Aktobe — northern Kazakhstan
      { lat: 51.53, lng:  46.04 },   // Saratov — Russia (cross-border into Russia at Ozinki/Aksaray)
      { lat: 53.20, lng:  44.99 },   // Penza
      { lat: 55.75, lng:  37.62 },   // Moscow — Russian network hub
      { lat: 54.78, lng:  32.05 },   // Smolensk
      { lat: 53.90, lng:  27.57 },   // Minsk — Belarus
      { lat: 52.10, lng:  23.66 },   // Brest / Małaszewicze — 1520mm ↔ 1435mm break-of-gauge
      { lat: 52.23, lng:  21.01 },   // Warsaw
      { lat: 52.41, lng:  16.94 },   // Poznań
      { lat: 52.52, lng:  13.40 },   // Berlin
      { lat: 51.96, lng:   7.63 },   // Münster region (Westphalia)
    ],
  },

  // ── Trans-Siberian Mainline ─────────────────────────────────────────────
  // The world's longest single rail line (9289 km).  Vladivostok →
  // Khabarovsk traces the Russian Far East, then runs east-to-west across
  // Siberia through every major Trans-Sib stop.  Container service
  // (Far East Land Bridge) feeds into European rail networks via Moscow.
  {
    id: 'rc.transsib',
    name: 'Trans-Siberian Corridor',
    mode: 'rail',
    startLat: 43.1056, startLng: 131.8735,  // Vladivostok
    endLat:   55.7558, endLng:   37.6176,   // Moscow
    importance: 70,
    description: 'Russia\'s 9,289-km east-west spine. Vladivostok → Moscow with container service for Asia-Europe freight.',
    tags: ['rail'],
    waypoints: [
      { lat: 48.48, lng: 135.07 },   // Khabarovsk
      { lat: 50.27, lng: 127.53 },   // Belogorsk
      { lat: 52.04, lng: 113.50 },   // Chita
      { lat: 51.83, lng: 107.59 },   // Ulan-Ude
      { lat: 52.29, lng: 104.30 },   // Irkutsk
      { lat: 56.01, lng:  92.85 },   // Krasnoyarsk
      { lat: 55.04, lng:  82.93 },   // Novosibirsk
      { lat: 54.99, lng:  73.40 },   // Omsk
      { lat: 56.84, lng:  60.61 },   // Yekaterinburg — Trans-Sib + Ural junction
      { lat: 56.33, lng:  44.00 },   // Nizhny Novgorod
      { lat: 55.79, lng:  49.12 },   // Kazan (alternative branch — kept as waypoint)
    ],
  },

  // ── BNSF Transcontinental (LA Basin → Chicago) ──────────────────────────
  // Largest double-stack intermodal corridor in North America.  Out of
  // the San Pedro Bay port complex, through the Cajon Pass, across the
  // Southwest into the Midwest distribution hub of Chicago.
  {
    id: 'rc.northam-bnsf',
    name: 'BNSF Transcon (LA → Chicago)',
    mode: 'rail',
    startLat: 33.7395, startLng: -118.2620,  // LA / Long Beach ports
    endLat:   41.8781, endLng:   -87.6298,   // Chicago
    importance: 80,
    description: 'BNSF\'s double-stack intermodal trunk — San Pedro Bay → Chicago via the Southwest.',
    tags: ['rail', 'intermodal'],
    waypoints: [
      { lat: 34.11, lng: -117.30 },   // San Bernardino (Cajon Sub start)
      { lat: 34.90, lng: -117.02 },   // Barstow — BNSF classification yard
      { lat: 34.85, lng: -114.62 },   // Needles — California-Arizona border
      { lat: 35.20, lng: -111.65 },   // Flagstaff
      { lat: 35.18, lng: -107.86 },   // Gallup
      { lat: 35.08, lng: -106.65 },   // Albuquerque
      { lat: 35.22, lng: -101.83 },   // Amarillo
      { lat: 36.74, lng:  -98.36 },   // Enid / OK panhandle approach
      { lat: 39.10, lng:  -94.58 },   // Kansas City — BNSF gateway to Midwest
      { lat: 40.95, lng:  -90.37 },   // Galesburg, Illinois
    ],
  },

  // ── CN Rail (Pacific → Atlantic via Canadian Shield) ────────────────────
  // CN's transcontinental main carries containers from Vancouver and
  // Prince Rupert east through the Rockies, across the Prairies, around
  // the north shore of Lake Superior, then south to Toronto.
  {
    id: 'rc.northam-cn',
    name: 'CN Rail (Vancouver → Toronto)',
    mode: 'rail',
    startLat: 49.2827, startLng: -123.1207,  // Vancouver
    endLat:   43.6532, endLng:   -79.3832,   // Toronto
    importance: 70,
    description: 'CN\'s Pacific-Atlantic main line via the Rockies, Prairies and the Canadian Shield.',
    tags: ['rail'],
    waypoints: [
      { lat: 50.67, lng: -120.34 },   // Kamloops
      { lat: 52.87, lng: -118.08 },   // Jasper (Rockies crossing)
      { lat: 53.55, lng: -113.49 },   // Edmonton
      { lat: 52.13, lng: -106.67 },   // Saskatoon
      { lat: 49.90, lng:  -97.14 },   // Winnipeg
      { lat: 48.38, lng:  -89.25 },   // Thunder Bay — Lake Superior NW corner
      { lat: 46.49, lng:  -80.99 },   // Sudbury — Ontario interior
      { lat: 44.39, lng:  -79.69 },   // Barrie approach to GTA
    ],
  },

  // ── India Dedicated Freight Corridor — Western DFC ─────────────────────
  // India's flagship rail project: a dedicated freight-only line parallel
  // to the existing passenger network, double-stack capable.  Western DFC
  // runs from JNPT (Mumbai's container port) to Dadri near Delhi.
  {
    id: 'rc.india-ded',
    name: 'India Dedicated Freight Corridor (Mumbai → Delhi)',
    mode: 'rail',
    startLat: 19.0760, startLng: 72.8777,   // Mumbai / JNPT
    endLat:   28.7041, endLng:  77.1025,    // Delhi (Dadri)
    importance: 65,
    description: 'India\'s Western DFC — JNPT → Dadri, double-stack capable freight-only line.',
    tags: ['rail'],
    waypoints: [
      { lat: 21.17, lng: 72.83 },    // Surat
      { lat: 22.31, lng: 73.18 },    // Vadodara
      { lat: 23.02, lng: 72.57 },    // Ahmedabad
      { lat: 24.17, lng: 72.43 },    // Palanpur
      { lat: 25.72, lng: 73.61 },    // Marwar Junction (Rajasthan)
      { lat: 26.92, lng: 75.78 },    // Jaipur
      { lat: 28.20, lng: 76.61 },    // Rewari — Haryana junction
    ],
  },

  // ── Rhine-Alpine Corridor (TEN-T Core Network) ─────────────────────────
  // Europe's busiest freight rail axis.  Rotterdam → Antwerp → Cologne
  // → Mannheim → Basel → Gotthard Base Tunnel → Bellinzona → Milan → Genoa.
  // Carries ~25% of all rail freight crossing the Alps.
  {
    id: 'rc.europe-rhine',
    name: 'Rhine–Alpine Corridor',
    mode: 'rail',
    startLat: 51.9244, startLng:  4.4777,   // Rotterdam
    endLat:   45.4642, endLng:    9.1900,   // Milan
    importance: 78,
    description: 'Europe\'s busiest freight rail axis — Rotterdam → Milan via the Gotthard Base Tunnel.',
    tags: ['rail', 'intermodal'],
    waypoints: [
      { lat: 51.22, lng:  4.40 },    // Antwerp
      { lat: 50.94, lng:  6.96 },    // Cologne — Rhine valley start
      { lat: 49.49, lng:  8.47 },    // Mannheim
      { lat: 48.40, lng:  7.74 },    // Strasbourg approach (Karlsruhe sub)
      { lat: 47.56, lng:  7.59 },    // Basel — Swiss border
      { lat: 47.05, lng:  8.31 },    // Lucerne / Gotthard approach
      { lat: 46.55, lng:  8.55 },    // Gotthard Base Tunnel — Alps crossing
      { lat: 46.20, lng:  9.03 },    // Bellinzona — Italian-speaking Switzerland
      { lat: 45.81, lng:  9.08 },    // Como
    ],
  },
];
