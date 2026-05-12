import type { TradeRoute } from './types';

/**
 * Major maritime trade corridors.
 *
 * Every route carries dense `waypoints` placed in open water along the
 * actual shipping lanes. The renderer applies Catmull-Rom smoothing
 * (see ./smoothing.ts) so the visible path is a smooth curve rather
 * than a jagged polyline — matching how ships physically turn at slow
 * radii rather than snapping between bearings.
 *
 * Reference chokepoint coordinates used as anchor waypoints
 * ─────────────────────────────────────────────────────────────────────
 * Taiwan Strait (mid)   24.0°N  119.5°E
 * Bashi Channel         21.0°N  121.0°E
 * Karimata Strait        0.0°N  108.5°E
 * Lombok Strait         -8.7°S  115.7°E
 * Sunda Strait          -6.0°S  105.5°E
 * Malacca exit (W)       5.5°N   95.5°E
 * Hormuz exit           26.5°N   56.5°E
 * Bab-el-Mandeb         12.5°N   43.3°E
 * Suez (S entry)        29.9°N   32.5°E
 * Gibraltar             36.0°N   -5.5°E
 * Cape Agulhas         -34.8°S   20.0°E
 * Panama Canal Pacific   8.9°N  -79.5°E
 */
export const MARITIME_ROUTES: TradeRoute[] = [

  // ── Asia → Europe (via Suez) ───────────────────────────────────────────
  {
    id: 'mr.shanghai-singapore', name: 'Shanghai → Singapore',
    mode: 'maritime',
    startLat: 30.626, startLng: 122.057,
    endLat:    1.266, endLng:  103.824,
    importance: 95,
    passesThrough: ['cp.taiwan'],
    description: 'East Asia → SE Asia leg of the Asia–Europe corridor.',
    waypoints: [
      { lat: 28.5, lng: 122.5 },  // East China Sea south
      { lat: 26,   lng: 121.5 },  // Taiwan Strait north (between mainland & Taiwan)
      { lat: 24,   lng: 119.5 },  // Taiwan Strait middle
      { lat: 22,   lng: 117.5 },  // Taiwan Strait south
      { lat: 19,   lng: 115 },    // NE South China Sea
      { lat: 16,   lng: 113 },    // South China Sea (W of Macclesfield Bank)
      { lat: 13,   lng: 111 },    // South China Sea (W of Spratly Is.)
      { lat: 10,   lng: 109 },    // Off Vietnam coast
      { lat:  7,   lng: 107 },    // Off southern Vietnam (Mekong delta)
      { lat:  4,   lng: 105 },    // Approaching Singapore Strait
      { lat:  2,   lng: 104 },    // Singapore Strait approach
    ],
  },

  {
    id: 'mr.singapore-suez', name: 'Singapore → Suez',
    mode: 'maritime',
    startLat:  1.266, startLng: 103.824,
    endLat:   29.985, endLng:   32.265,
    importance: 100,
    passesThrough: ['cp.malacca', 'cp.bab-el-mandeb'],
    description: 'Indian Ocean leg of Asia–Europe via Malacca + Bab-el-Mandeb.',
    tags: ['container', 'asia-europe'],
    waypoints: [
      { lat:  2.5, lng: 102 },    // Phillip Channel area
      { lat:  3.5, lng: 101 },    // Malacca Strait middle (mid-strait at 3.5°N; Sumatra coast ~99.2E, Malaysia ~103E)
      { lat:  5.5, lng:  95.5 },  // Malacca Strait north exit (Andaman Sea, W of Sumatra tip)
      { lat:  6,   lng:  90 },    // Andaman Sea / Indian Ocean entry
      { lat:  6,   lng:  82 },    // South of Sri Lanka (8° Channel)
      { lat:  9,   lng:  72 },    // Open Indian Ocean (W of Maldives)
      { lat: 12,   lng:  62 },    // Open Indian Ocean
      { lat: 13,   lng:  55 },    // Arabian Sea (Socotra latitude)
      { lat: 12.5, lng:  50 },    // Gulf of Aden entry
      { lat: 12.5, lng:  46 },    // Gulf of Aden middle
      { lat: 12.5, lng:  43.3 },  // Bab-el-Mandeb strait
      { lat: 15,   lng:  41 },    // Red Sea south
      { lat: 19,   lng:  39.5 },  // Red Sea middle
      { lat: 23,   lng:  37 },    // Red Sea
      { lat: 27.5, lng:  34 },    // Red Sea north (Gulf of Suez approach)
      { lat: 29.5, lng:  32.7 },  // Gulf of Suez
    ],
  },

  {
    id: 'mr.suez-rotterdam', name: 'Suez → Rotterdam',
    mode: 'maritime',
    startLat: 29.985, startLng:  32.265,
    endLat:   51.924, endLng:     4.478,
    importance: 100,
    passesThrough: ['cp.suez', 'cp.gibraltar'],
    description: 'Mediterranean → North Europe terminal leg of Asia–Europe corridor.',
    waypoints: [
      { lat: 30.5, lng:  32.4 },  // Suez Canal mid-section (canal runs ~32.3E; Ismailia area)
      { lat: 31.2, lng:  32.3 },  // Port Said — Mediterranean entrance of canal (31.26N, 32.31E)
      { lat: 32,   lng:  31 },    // Open Eastern Mediterranean NW of Port Said
      { lat: 33,   lng:  28 },    // Eastern Mediterranean (S of Cyprus)
      { lat: 34,   lng:  23 },    // South of Crete
      { lat: 36.5, lng:  17 },    // Ionian Sea (S of Italy)
      { lat: 37.5, lng:  12 },    // Strait of Sicily
      { lat: 38,   lng:   7 },    // Tyrrhenian / Sardinia channel
      { lat: 38,   lng:   2 },    // Western Mediterranean
      { lat: 36.5, lng:  -3 },    // Alboran Sea (Gibraltar approach)
      { lat: 36,   lng:  -5.5 },  // Strait of Gibraltar
      { lat: 38,   lng:  -10 },   // Atlantic (Portugal coast)
      { lat: 44,   lng:  -10 },   // Bay of Biscay west
      { lat: 48,   lng:   -7 },   // Celtic Sea
      { lat: 50.5, lng:   -2 },   // English Channel west
      { lat: 51,   lng:    1 },   // English Channel east (Strait of Dover)
      { lat: 51.7, lng:    3.2 }, // Approaching Rotterdam
    ],
  },

  // ── Transpacific ────────────────────────────────────────────────────────
  {
    id: 'mr.shanghai-la', name: 'Shanghai → Los Angeles',
    mode: 'maritime',
    startLat: 30.626, startLng:  122.057,
    endLat:   33.740, endLng:  -118.262,
    importance: 95,
    description: 'Transpacific container backbone — China manufacturing → US west coast.',
    tags: ['container', 'transpacific'],
    waypoints: [
      { lat: 32, lng: 130 },    // East China Sea exit
      { lat: 35, lng: 140 },    // East of Japan (Pacific)
      { lat: 40, lng: 152 },    // North Pacific
      { lat: 45, lng: 165 },    // North Pacific
      { lat: 47, lng: 178 },    // Near date line
      { lat: 47, lng: -170 },   // Past date line
      { lat: 45, lng: -158 },   // North Pacific east
      { lat: 41, lng: -140 },   // North Pacific
      { lat: 37, lng: -128 },   // US West Coast approach
      { lat: 34, lng: -121 },   // California offshore
    ],
  },

  {
    id: 'mr.busan-la', name: 'Busan → Los Angeles',
    mode: 'maritime',
    startLat: 35.103, startLng:  129.040,
    endLat:   33.740, endLng:  -118.262,
    importance: 80,
    tags: ['container', 'transpacific'],
    waypoints: [
      { lat: 37, lng: 138 },
      { lat: 40, lng: 148 },
      { lat: 44, lng: 162 },
      { lat: 47, lng: 175 },
      { lat: 47, lng: -170 },
      { lat: 44, lng: -155 },
      { lat: 40, lng: -140 },
      { lat: 36, lng: -127 },
    ],
  },

  {
    id: 'mr.shanghai-balboa', name: 'Shanghai → Balboa (Panama)',
    mode: 'maritime',
    startLat: 30.626, startLng:  122.057,
    endLat:    8.952, endLng:   -79.567,
    importance: 70,
    passesThrough: ['cp.panama'],
    description: 'Asia → US East Coast via Panama Canal.',
    waypoints: [
      { lat: 28, lng: 125 },    // East China Sea
      { lat: 24, lng: 130 },    // Pacific east of Okinawa
      { lat: 18, lng: 138 },    // Western Pacific
      { lat: 12, lng: 148 },    // Mariana Islands area
      { lat:  6, lng: 160 },    // Central Pacific
      { lat:  2, lng: 175 },    // Central Pacific (equatorial)
      { lat:  0, lng: -170 },   // Past date line (open Pacific)
      { lat:  3, lng: -150 },   // Eastern Pacific
      { lat:  5, lng: -130 },   // Eastern Pacific
      { lat:  7, lng: -110 },   // Approaching Central America
      { lat:  8, lng:  -95 },   // Off Mexico Pacific coast
      { lat:  8, lng:  -85 },   // Panama approach
    ],
  },

  // ── Transatlantic ────────────────────────────────────────────────────────
  {
    id: 'mr.rotterdam-nynj', name: 'Rotterdam → New York/NJ',
    mode: 'maritime',
    startLat: 51.924, startLng:   4.478,
    endLat:   40.689, endLng:   -74.044,
    importance: 78,
    description: 'Primary Europe → US east-coast container corridor.',
    tags: ['container', 'transatlantic'],
    waypoints: [
      { lat: 51,   lng:   2 },   // English Channel east
      { lat: 50,   lng:  -2 },   // English Channel
      { lat: 48,   lng:  -8 },   // Western Channel exit
      { lat: 47,   lng: -20 },   // North Atlantic
      { lat: 45,   lng: -35 },   // Mid-Atlantic
      { lat: 43,   lng: -50 },   // Western North Atlantic
      { lat: 41,   lng: -63 },   // Approaching US coast
      { lat: 40.5, lng: -71 },   // Long Island offshore
    ],
  },

  {
    id: 'mr.algeciras-nynj', name: 'Algeciras → New York/NJ',
    mode: 'maritime',
    startLat: 36.141, startLng:  -5.456,
    endLat:   40.689, endLng:   -74.044,
    importance: 65,
    passesThrough: ['cp.gibraltar'],
    tags: ['container', 'transatlantic'],
    waypoints: [
      { lat: 36, lng: -10 },     // Atlantic west of Gibraltar
      { lat: 36, lng: -20 },     // Mid-Atlantic
      { lat: 37, lng: -35 },     // Mid-Atlantic (Azores latitude)
      { lat: 38, lng: -50 },     // Western Atlantic
      { lat: 39, lng: -62 },     // US coast approach
      { lat: 40, lng: -71 },     // Long Island offshore
    ],
  },

  // ── Energy: Persian Gulf → Asia ─────────────────────────────────────────
  {
    id: 'mr.rastanura-singapore', name: 'Ras Tanura → Singapore',
    mode: 'maritime',
    startLat: 26.693, startLng:  50.158,
    endLat:    1.266, endLng:   103.824,
    importance: 92,
    passesThrough: ['cp.hormuz', 'cp.malacca'],
    description: 'Crude oil arc — Persian Gulf to Asia. Largest single energy flow on Earth.',
    tags: ['energy', 'crude'],
    waypoints: [
      { lat: 26.5, lng: 53 },    // Persian Gulf middle
      { lat: 26.5, lng: 56.5 },  // Hormuz strait exit (main channel, N of Musandam)
      { lat: 26,   lng: 58 },    // Gulf of Oman — east of Musandam (coast pulls to ~24N by 58E)
      { lat: 24,   lng: 60 },    // Gulf of Oman (clear of Oman coast)
      { lat: 18,   lng: 63 },    // Arabian Sea north
      { lat: 12,   lng: 67 },    // Arabian Sea
      { lat:  8,   lng: 72 },    // Indian Ocean (W of India)
      { lat:  6,   lng: 78 },    // Indian Ocean (S of India)
      { lat:  4,   lng: 84 },    // Open Indian Ocean
      { lat:  4,   lng: 91 },    // Approaching Andaman Sea
      { lat:  5,   lng: 96 },    // Malacca Strait north entry
      { lat:  4,   lng: 101.5 },  // Malacca Strait middle (mid-strait at 4°N; Sumatra coast ~100E, Malaysia ~103E)
      { lat:  2,   lng: 103 },   // Phillip Channel
    ],
  },

  {
    id: 'mr.rastanura-shanghai', name: 'Ras Tanura → Shanghai',
    mode: 'maritime',
    startLat: 26.693, startLng:  50.158,
    endLat:   30.626, endLng:   122.057,
    importance: 90,
    passesThrough: ['cp.hormuz', 'cp.malacca'],
    tags: ['energy', 'crude'],
    waypoints: [
      { lat: 26.5, lng: 53 },
      { lat: 26.5, lng: 56.5 },  // Hormuz exit (main channel, N of Musandam)
      { lat: 26,   lng: 58 },    // Gulf of Oman — east of Musandam
      { lat: 24,   lng: 60 },
      { lat: 16,   lng: 64 },
      { lat:  8,   lng: 73 },
      { lat:  4,   lng: 84 },
      { lat:  4,   lng: 91 },
      { lat:  5,   lng: 96 },    // Malacca north
      { lat:  4,   lng: 101.5 },  // Malacca middle (mid-strait at 4°N)
      { lat:  2,   lng: 104 },   // Singapore Strait
      { lat:  4,   lng: 106 },   // South China Sea SW
      { lat:  9,   lng: 109 },   // Off southern Vietnam
      { lat: 13,   lng: 111 },   // South China Sea middle
      { lat: 17,   lng: 114 },   // South China Sea NE
      { lat: 21,   lng: 117 },   // Taiwan Strait south
      { lat: 25,   lng: 120 },   // Taiwan Strait north
      { lat: 28,   lng: 122 },   // East China Sea
    ],
  },

  // ── Cape of Good Hope route (Suez bypass) ───────────────────────────────
  {
    id: 'mr.singapore-cape-rotterdam', name: 'Singapore → Rotterdam (via Cape)',
    mode: 'maritime',
    startLat:  1.266, startLng:  103.824,
    endLat:   51.924, endLng:     4.478,
    importance: 60,
    passesThrough: ['cp.cape'],
    description: 'Suez-bypass route used during Red Sea disruptions. ~10–14 days longer.',
    tags: ['resilience', 'cape-route'],
    waypoints: [
      { lat:  -2,   lng: 104 },   // Karimata Strait approach
      { lat:  -6,   lng: 105.5 }, // Sunda Strait
      { lat: -10,   lng: 102 },   // Indian Ocean S of Java
      { lat: -18,   lng:  90 },   // Indian Ocean SW
      { lat: -28,   lng:  70 },   // Mid Indian Ocean south
      { lat: -36,   lng:  50 },   // Southern Indian Ocean
      { lat: -38,   lng:  35 },   // S of Madagascar
      { lat: -36,   lng:  25 },   // Approaching Cape
      { lat: -34.8, lng:  20 },   // Cape Agulhas
      { lat: -34,   lng:  16 },   // Cape Town offshore
      { lat: -25,   lng:  10 },   // South Atlantic east
      { lat: -10,   lng:   3 },   // South Atlantic
      { lat:   2,   lng:  -2 },   // Equatorial Atlantic
      { lat:  15,   lng: -22 },   // West African coast (Cape Verde)
      { lat:  30,   lng: -18 },   // Canary Islands area
      { lat:  36,   lng: -10 },   // SW of Portugal
      { lat:  44,   lng: -11 },   // Bay of Biscay west
      { lat:  48,   lng:  -8 },   // Celtic Sea
      { lat:  50.5, lng:  -2 },   // English Channel
      { lat:  51,   lng:   1 },   // Strait of Dover
    ],
  },

  // ── Australia bulk → Asia ────────────────────────────────────────────────
  {
    id: 'mr.hedland-qingdao', name: 'Port Hedland → Qingdao',
    mode: 'maritime',
    startLat: -20.312, startLng:  118.577,
    endLat:    36.083, endLng:   120.300,
    importance: 80,
    description: 'Iron ore bulk corridor — Australia → northern China via Lombok / Karimata.',
    tags: ['bulk', 'iron-ore'],
    waypoints: [
      { lat: -16,   lng: 117 },    // NW Australia coast
      { lat: -12,   lng: 116 },    // Timor Sea
      { lat:  -9,   lng: 115.5 },  // Bali Sea
      { lat:  -8.7, lng: 115.7 },  // Lombok Strait
      { lat:  -7,   lng: 116 },    // Bali Sea exit
      { lat:  -5,   lng: 114 },    // Java Sea east
      { lat:  -3,   lng: 110 },    // Java Sea
      { lat:  -1,   lng: 108 },    // Karimata Strait approach
      { lat:   1,   lng: 108 },    // Karimata Strait
      { lat:   4,   lng: 109 },    // Natuna Sea
      { lat:   8,   lng: 110 },    // South China Sea south
      { lat:  13,   lng: 113 },    // South China Sea middle
      { lat:  18,   lng: 117 },    // South China Sea NE (E of Hainan)
      { lat:  22,   lng: 119 },    // Taiwan Strait south
      { lat:  26,   lng: 121 },    // Taiwan Strait north
      { lat:  30,   lng: 122 },    // East China Sea
      { lat:  33,   lng: 122 },    // Yellow Sea south
    ],
  },

  // ── Brazil → China (soy / iron ore) ────────────────────────────────────
  {
    id: 'mr.santos-shanghai', name: 'Santos → Shanghai',
    mode: 'maritime',
    startLat: -23.961, startLng:  -46.333,
    endLat:    30.626, endLng:   122.057,
    importance: 75,
    passesThrough: ['cp.cape'],
    description: 'Soy + iron-ore corridor — Brazil → China via Cape of Good Hope.',
    tags: ['bulk'],
    waypoints: [
      { lat: -28,   lng: -42 },   // South Atlantic
      { lat: -33,   lng: -32 },   // South Atlantic
      { lat: -36,   lng: -18 },   // South Atlantic
      { lat: -36,   lng:   0 },   // South Atlantic east
      { lat: -34.8, lng:  20 },   // Cape Agulhas
      { lat: -33,   lng:  30 },   // Mozambique Channel south
      { lat: -25,   lng:  42 },   // S of Madagascar
      { lat: -15,   lng:  55 },   // SW Indian Ocean
      { lat:  -3,   lng:  65 },   // Equatorial Indian Ocean
      { lat:   5,   lng:  78 },   // S of Sri Lanka
      { lat:   4,   lng:  88 },   // Open Indian Ocean
      { lat:   5,   lng:  96 },   // Malacca north
      { lat:   4,   lng: 101.5 },  // Malacca middle (mid-strait at 4°N)
      { lat:   2,   lng: 104 },   // Singapore Strait
      { lat:   8,   lng: 109 },   // South China Sea
      { lat:  14,   lng: 113 },   // South China Sea
      { lat:  20,   lng: 117 },   // South China Sea NE
      { lat:  25,   lng: 120 },   // Taiwan Strait
      { lat:  29,   lng: 122 },   // East China Sea
    ],
  },

  // ── Indian Ocean transshipment feeder ────────────────────────────────────
  {
    id: 'mr.colombo-jebelali', name: 'Colombo → Jebel Ali',
    mode: 'maritime',
    startLat:  6.936, startLng:  79.844,
    endLat:   24.986, endLng:   55.070,
    importance: 65,
    description: 'Indian Ocean transshipment feeder.',
    tags: ['container'],
    waypoints: [
      { lat:  8,   lng: 76 },    // Arabian Sea south
      { lat: 11,   lng: 70 },    // Arabian Sea
      { lat: 15,   lng: 64 },    // Arabian Sea NW
      { lat: 20,   lng: 60 },    // Arabian Sea N
      { lat: 23,   lng: 59 },    // Gulf of Oman (Oman coast at 59E is ~22-23N — clear)
      { lat: 25.5, lng: 58 },    // Gulf of Oman N (Oman coast at 58E is ~24N — clear at 25.5N)
      { lat: 26.8, lng: 57 },    // Hormuz main channel (N of Musandam tip ~26.4N,56.3E)
      { lat: 26.8, lng: 55.5 },  // Persian Gulf interior — just west of Hormuz
      { lat: 26,   lng: 55 },    // Persian Gulf heading SW toward Dubai
    ],
  },
];
