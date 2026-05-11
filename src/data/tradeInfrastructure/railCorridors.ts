import type { TradeRoute } from './types';

/**
 * Major continental rail freight corridors.
 *
 * Each route's waypoint chain reflects the canonical city/junction
 * sequence on the real-world rail mainline.  Sources verified against:
 *
 *   - Trans-Siberian Railway (Wikipedia) — Moscow → Yaroslavl → Kirov →
 *     Perm → Yekaterinburg → Tyumen → Omsk → Novosibirsk → Krasnoyarsk
 *     → Irkutsk → Ulan-Ude → Chita → Khabarovsk → Vladivostok
 *
 *   - BNSF Southern Transcon — 11-subdivision corridor, LA → Barstow →
 *     Needles → Kingman → Flagstaff → Winslow → Gallup → Belen →
 *     Amarillo → Wellington → Emporia → Kansas City → Chillicothe →
 *     Chicago.  Belen Cutoff (1908) is the canonical mountain bypass.
 *
 *   - CN Rail "The Canadian" passenger/freight main — north of Lake
 *     Superior via Capreol / Hornepayne / Sioux Lookout (Thunder Bay
 *     is on CP's route, NOT CN's main).
 *
 *   - China-Europe Railway Express (CR Express) — Dostyk / Khorgos as
 *     the primary China-Kazakhstan gauge-transfer crossings, then
 *     through Kazakhstan via the northern Astana-Petropavlovsk corridor
 *     into Russia at Kurgan, joining the Trans-Sib mainline westbound.
 *
 *   - India Western DFC (Dedicated Freight Corridor) — Mumbai/JNPT
 *     to Dadri (Delhi NCR) via Vadodara → Ahmedabad → Palanpur → Rewari.
 *
 *   - Rhine-Alpine TEN-T Core Network Corridor — Rotterdam → Antwerp →
 *     Cologne → Mannheim → Karlsruhe → Basel → Lucerne → Gotthard Base
 *     Tunnel → Bellinzona → Milan.
 *
 * The Catmull-Rom smoothing in ./smoothing.ts traces a curve through
 * each waypoint, so dense junction sequences produce a path that
 * visually hugs the actual rail right-of-way.
 */
export const RAIL_CORRIDORS: TradeRoute[] = [

  // ── China → Europe (CR Express / "New Eurasian Land Bridge") ───────────
  // The flagship Belt-and-Road rail corridor.  Western corridor — most
  // freight traffic — uses Khorgos (newer dry port) OR Alashankou (older
  // crossing) for the China-Kazakhstan gauge transfer, then runs north
  // through Kazakhstan via Astana → Petropavlovsk into Russia at
  // Kurgan, joining the Trans-Sib mainline west to Moscow.
  {
    id: 'rc.china-europe',
    name: 'China–Europe Rail (BRI)',
    mode: 'rail',
    startLat: 29.5630, startLng: 106.5516,  // Chongqing (Yuxinou origin)
    endLat:   51.4344, endLng:    6.7623,   // Duisburg (Europe terminus)
    importance: 88,
    description: 'New Eurasian Land Bridge — Chongqing → Duisburg via Khorgos, Kazakhstan (Astana corridor), Russia (Trans-Sib mainline west of Yekaterinburg), Belarus and Poland. ~16-day transit, 50% faster than sea.',
    tags: ['rail', 'bri'],
    waypoints: [
      { lat: 34.27, lng: 108.94 },   // Xi'an — alternate Yuxinou origin / route convergence
      { lat: 36.06, lng: 103.84 },   // Lanzhou — Gansu Corridor entry
      { lat: 38.93, lng:  97.04 },   // Jiayuguan / Hexi Corridor
      { lat: 41.78, lng:  93.51 },   // Hami
      { lat: 43.83, lng:  87.62 },   // Urumqi — Xinjiang capital
      { lat: 44.21, lng:  80.41 },   // Khorgos — China-Kazakhstan gauge-transfer crossing
      { lat: 43.26, lng:  76.95 },   // Almaty
      { lat: 47.79, lng:  73.10 },   // Saryshagan / Karaganda approach
      { lat: 51.18, lng:  71.43 },   // Astana (Nur-Sultan) — Kazakhstan capital
      { lat: 53.28, lng:  69.39 },   // Kokshetau
      { lat: 54.87, lng:  69.16 },   // Petropavlovsk — final Kazakh stop before Russia
      { lat: 55.45, lng:  65.34 },   // Kurgan — Russia, joins Trans-Sib here
      { lat: 56.84, lng:  60.61 },   // Yekaterinburg — Trans-Sib / Ural junction
      { lat: 58.01, lng:  56.25 },   // Perm
      { lat: 58.60, lng:  49.66 },   // Kirov
      { lat: 57.63, lng:  39.87 },   // Yaroslavl
      { lat: 55.75, lng:  37.62 },   // Moscow
      { lat: 54.78, lng:  32.05 },   // Smolensk
      { lat: 53.90, lng:  27.57 },   // Minsk — Belarus
      { lat: 52.10, lng:  23.66 },   // Brest / Małaszewicze — 1520mm ↔ 1435mm gauge break
      { lat: 52.23, lng:  21.01 },   // Warsaw
      { lat: 52.41, lng:  16.94 },   // Poznań
      { lat: 52.52, lng:  13.40 },   // Berlin
      { lat: 52.37, lng:   9.74 },   // Hannover
    ],
  },

  // ── Trans-Siberian Mainline ─────────────────────────────────────────────
  // The world's longest single rail line (9289 km).  Sequence verified
  // against the Trans-Siberian Wikipedia route map: Moscow → Yaroslavl →
  // Kirov → Perm → Yekaterinburg → Tyumen → Omsk → Novosibirsk →
  // Krasnoyarsk → Irkutsk → Ulan-Ude → Chita → Khabarovsk → Vladivostok.
  {
    id: 'rc.transsib',
    name: 'Trans-Siberian Corridor',
    mode: 'rail',
    startLat: 43.1056, startLng: 131.8735,  // Vladivostok
    endLat:   55.7558, endLng:   37.6176,   // Moscow
    importance: 70,
    description: 'Russia\'s 9,289-km east-west spine. Vladivostok → Khabarovsk → Chita → Irkutsk → Krasnoyarsk → Novosibirsk → Omsk → Yekaterinburg → Perm → Kirov → Yaroslavl → Moscow.',
    tags: ['rail'],
    waypoints: [
      { lat: 48.48, lng: 135.07 },   // Khabarovsk
      { lat: 50.27, lng: 127.53 },   // Belogorsk
      { lat: 53.74, lng: 119.31 },   // Mogocha
      { lat: 52.04, lng: 113.50 },   // Chita
      { lat: 51.83, lng: 107.59 },   // Ulan-Ude
      { lat: 52.29, lng: 104.30 },   // Irkutsk — Lake Baikal south
      { lat: 56.01, lng:  92.85 },   // Krasnoyarsk
      { lat: 55.04, lng:  82.93 },   // Novosibirsk
      { lat: 54.99, lng:  73.40 },   // Omsk
      { lat: 57.15, lng:  65.55 },   // Tyumen
      { lat: 56.84, lng:  60.61 },   // Yekaterinburg
      { lat: 58.01, lng:  56.25 },   // Perm
      { lat: 58.60, lng:  49.66 },   // Kirov
      { lat: 57.63, lng:  39.87 },   // Yaroslavl
    ],
  },

  // ── BNSF Southern Transcon (LA Basin → Chicago) ─────────────────────────
  // Largest double-stack intermodal corridor in North America.  Sequence
  // verified against Wikipedia "Southern Transcon": 11 subdivisions from
  // the LA Basin via the Cajon Pass, Barstow yard, Belen Cutoff (NM),
  // Wellington/Emporia (KS), Kansas City and Chillicothe (IL).
  {
    id: 'rc.northam-bnsf',
    name: 'BNSF Transcon (LA → Chicago)',
    mode: 'rail',
    startLat: 33.7395, startLng: -118.2620,  // LA / Long Beach ports
    endLat:   41.8781, endLng:   -87.6298,   // Chicago
    importance: 80,
    description: 'BNSF\'s double-stack intermodal trunk — San Pedro Bay → Chicago via the Belen Cutoff. 11 subdivisions, ~2200 miles.',
    tags: ['rail', 'intermodal'],
    waypoints: [
      { lat: 34.11, lng: -117.30 },   // San Bernardino — Cajon Sub start
      { lat: 34.36, lng: -117.49 },   // Cajon Pass summit
      { lat: 34.90, lng: -117.02 },   // Barstow Yard — major classification
      { lat: 34.85, lng: -114.62 },   // Needles — CA-AZ border
      { lat: 35.19, lng: -114.05 },   // Kingman, AZ
      { lat: 35.20, lng: -111.65 },   // Flagstaff, AZ
      { lat: 35.02, lng: -110.70 },   // Winslow, AZ
      { lat: 35.53, lng: -108.74 },   // Gallup, NM
      { lat: 34.66, lng: -106.78 },   // Belen, NM — Belen Cutoff (1908) junction
      { lat: 35.22, lng: -101.83 },   // Amarillo, TX
      { lat: 37.27, lng:  -97.40 },   // Wellington, KS
      { lat: 38.40, lng:  -96.18 },   // Emporia, KS
      { lat: 39.10, lng:  -94.58 },   // Kansas City — Midwest gateway
      { lat: 40.92, lng:  -89.49 },   // Chillicothe, IL — eastern Transcon terminus
    ],
  },

  // ── CN Rail (Pacific → Atlantic via Canadian Shield) ────────────────────
  // CN's transcontinental main — verified against "The Canadian"
  // Wikipedia article.  Routes NORTH of Lake Superior via Capreol /
  // Hornepayne / Sioux Lookout.  Thunder Bay (south of Lake Superior)
  // is on CP's route, NOT CN's main.
  {
    id: 'rc.northam-cn',
    name: 'CN Rail (Vancouver → Toronto)',
    mode: 'rail',
    startLat: 49.2827, startLng: -123.1207,  // Vancouver
    endLat:   43.6532, endLng:   -79.3832,   // Toronto
    importance: 70,
    description: 'CN\'s Pacific-Atlantic main — through the Rockies (Jasper), the Prairies, and NORTH of Lake Superior via Capreol-Hornepayne-Sioux Lookout.',
    tags: ['rail'],
    waypoints: [
      { lat: 49.39, lng: -121.45 },   // Hope
      { lat: 50.67, lng: -120.34 },   // Kamloops
      { lat: 52.10, lng: -119.30 },   // Blue River
      { lat: 52.87, lng: -118.08 },   // Jasper — Rockies crossing
      { lat: 53.58, lng: -116.43 },   // Edson
      { lat: 53.55, lng: -113.49 },   // Edmonton
      { lat: 52.83, lng: -110.85 },   // Wainwright
      { lat: 52.13, lng: -106.67 },   // Saskatoon
      { lat: 50.92, lng: -102.81 },   // Melville
      { lat: 49.90, lng:  -97.14 },   // Winnipeg
      { lat: 50.10, lng:  -91.92 },   // Sioux Lookout — Northern Ontario
      { lat: 49.21, lng:  -84.79 },   // Hornepayne — middle of nowhere
      { lat: 46.71, lng:  -80.91 },   // Capreol — Sudbury junction
      { lat: 45.34, lng:  -80.04 },   // Parry Sound
    ],
  },

  // ── India Western Dedicated Freight Corridor ───────────────────────────
  // Built parallel to existing passenger network, freight-only,
  // double-stack capable. JNPT (Nhava Sheva) → Dadri (Delhi NCR).
  {
    id: 'rc.india-ded',
    name: 'India Dedicated Freight Corridor (Mumbai → Delhi)',
    mode: 'rail',
    startLat: 19.0760, startLng: 72.8777,   // Mumbai / JNPT
    endLat:   28.7041, endLng:  77.1025,    // Delhi (Dadri)
    importance: 65,
    description: 'India\'s Western DFC — JNPT → Dadri, double-stack capable freight-only line via Vadodara, Ahmedabad, Palanpur, Rewari.',
    tags: ['rail'],
    waypoints: [
      { lat: 21.17, lng: 72.83 },    // Surat
      { lat: 22.31, lng: 73.18 },    // Vadodara
      { lat: 23.02, lng: 72.57 },    // Ahmedabad
      { lat: 24.17, lng: 72.43 },    // Palanpur
      { lat: 25.72, lng: 73.61 },    // Marwar Junction
      { lat: 26.92, lng: 75.78 },    // Jaipur
      { lat: 28.20, lng: 76.61 },    // Rewari — Haryana junction
      { lat: 28.55, lng: 77.55 },    // Dadri — DFC eastern terminus
    ],
  },

  // ── Rhine-Alpine Corridor (TEN-T Core) ─────────────────────────────────
  // Europe's busiest freight rail axis.  Connects Rotterdam to Genoa
  // via the Rhine valley and the Gotthard Base Tunnel.  Carries ~25%
  // of all rail freight crossing the Alps.
  {
    id: 'rc.europe-rhine',
    name: 'Rhine–Alpine Corridor',
    mode: 'rail',
    startLat: 51.9244, startLng:  4.4777,   // Rotterdam
    endLat:   45.4642, endLng:    9.1900,   // Milan
    importance: 78,
    description: 'Europe\'s busiest freight rail axis — Rotterdam → Antwerp → Cologne → Mannheim → Basel → Gotthard Base Tunnel → Bellinzona → Milan.',
    tags: ['rail', 'intermodal'],
    waypoints: [
      { lat: 51.22, lng:  4.40 },    // Antwerp
      { lat: 50.85, lng:  5.69 },    // Liège (alternate Belgian path)
      { lat: 50.94, lng:  6.96 },    // Cologne — Rhine valley start
      { lat: 50.11, lng:  8.68 },    // Frankfurt-am-Main
      { lat: 49.49, lng:  8.47 },    // Mannheim — major Rhine valley junction
      { lat: 49.01, lng:  8.40 },    // Karlsruhe
      { lat: 47.56, lng:  7.59 },    // Basel — Swiss border / German border
      { lat: 47.05, lng:  8.31 },    // Lucerne — Gotthard approach
      { lat: 46.55, lng:  8.55 },    // Gotthard Base Tunnel — Alps crossing
      { lat: 46.20, lng:  9.03 },    // Bellinzona — Italian-speaking Switzerland
      { lat: 45.83, lng:  8.95 },    // Como
    ],
  },
];
