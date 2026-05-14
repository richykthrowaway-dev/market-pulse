/**
 * Major Global Oil & Gas Pipeline Routes — reference data
 *
 * Waypoints are approximate geographic centroids along the pipeline corridor,
 * not engineering survey coordinates.  They are suitable for polyline rendering
 * on a globe at country / regional scale.
 *
 * Capacity figures are nameplate / design capacity from:
 *   - IEA World Energy Outlook 2023
 *   - EIA International Energy Statistics
 *   - Operator public disclosures
 *
 * `importance` (0–100) is an editorial score reflecting the pipeline's
 * geopolitical and supply-security significance.
 */

export interface PipelineRoute {
  id: string;
  name: string;
  type: 'oil' | 'gas' | 'mixed';
  /** Nameplate / design capacity. */
  capacity: string;
  /** Ordered lat/lng waypoints along the corridor. */
  waypoints: Array<{ lat: number; lng: number }>;
  /** 0–100 geopolitical importance score. */
  importance: number;
}

/** Stroke colours per pipeline type. */
export const PIPELINE_COLOR: Record<PipelineRoute['type'], string> = {
  oil:   '#f97316', // orange-500
  gas:   '#a78bfa', // violet-400
  mixed: '#fb923c', // orange-400
};

export const PIPELINE_ROUTES: PipelineRoute[] = [

  // ── 1. ESPO Pipeline ──────────────────────────────────────────────────────
  // East Siberia–Pacific Ocean Pipeline.  Operated by Transneft.
  // Runs from Taishet (Irkutsk Oblast) to the Pacific export terminal at
  // Kozmino (Primorsky Krai) with a spur to Daqing, China.
  {
    id: 'espo',
    name: 'ESPO Pipeline',
    type: 'oil',
    capacity: '1.6M bbl/day',
    importance: 90,
    waypoints: [
      { lat: 55.9, lng:  98.0 }, // Taishet (origin pump station)
      { lat: 52.3, lng: 104.3 }, // Irkutsk
      { lat: 53.9, lng: 123.9 }, // Skovorodino (China spur junction)
      { lat: 42.8, lng: 133.0 }, // Kozmino export terminal
    ],
  },
  // ESPO China spur (Skovorodino → Daqing)
  {
    id: 'espo-china-spur',
    name: 'ESPO China Spur (Skovorodino–Daqing)',
    type: 'oil',
    capacity: '0.6M bbl/day',
    importance: 80,
    waypoints: [
      { lat: 53.9, lng: 123.9 }, // Skovorodino
      { lat: 49.2, lng: 125.0 }, // Mohe border crossing
      { lat: 46.6, lng: 125.0 }, // Daqing, China
    ],
  },

  // ── 2. Druzhba Pipeline ───────────────────────────────────────────────────
  // "Friendship" pipeline — one of the longest in the world.
  // Northern branch: Belarus → Poland → Germany.
  // Southern branch: Ukraine → Slovakia → Hungary / Czech Republic → Austria.
  {
    id: 'druzhba-north',
    name: 'Druzhba Pipeline (Northern Branch)',
    type: 'oil',
    capacity: '1.2M bbl/day',
    importance: 95,
    waypoints: [
      { lat: 54.9, lng:  52.3 }, // Almetyevsk (origin)
      { lat: 55.8, lng:  49.1 }, // Kazan
      { lat: 53.2, lng:  34.4 }, // Bryansk
      { lat: 52.1, lng:  23.7 }, // Brest (Belarus–Poland border)
      { lat: 52.2, lng:  21.0 }, // Warsaw
      { lat: 52.5, lng:  13.4 }, // Berlin (Schwedt refinery area)
    ],
  },
  {
    id: 'druzhba-south',
    name: 'Druzhba Pipeline (Southern Branch)',
    type: 'oil',
    capacity: '0.7M bbl/day',
    importance: 85,
    waypoints: [
      { lat: 53.2, lng:  34.4 }, // Bryansk (split point)
      { lat: 49.0, lng:  31.5 }, // Ukraine (central)
      { lat: 48.1, lng:  17.1 }, // Bratislava
      { lat: 47.5, lng:  19.0 }, // Budapest
      { lat: 48.2, lng:  16.4 }, // Vienna
    ],
  },

  // ── 3. BTC Pipeline ───────────────────────────────────────────────────────
  // Baku–Tbilisi–Ceyhan.  BP-operated.  Carries Caspian crude to the
  // Mediterranean, bypassing Russia and the Turkish Straits.
  {
    id: 'btc',
    name: 'BTC Pipeline (Baku–Tbilisi–Ceyhan)',
    type: 'oil',
    capacity: '1.2M bbl/day',
    importance: 80,
    waypoints: [
      { lat: 40.4, lng:  49.9 }, // Baku (Sangachal terminal)
      { lat: 41.7, lng:  44.8 }, // Tbilisi
      { lat: 40.1, lng:  38.7 }, // Erzincan (Turkish midpoint)
      { lat: 36.7, lng:  35.6 }, // Ceyhan export terminal
    ],
  },

  // ── 4. Trans-Arabian Pipeline (Tapline) ──────────────────────────────────
  // Largely out of service today; retained for historical/geopolitical overlay.
  // Originally carried Saudi crude to Sidon, Lebanon.
  {
    id: 'tapline',
    name: 'Trans-Arabian Pipeline (Tapline)',
    type: 'oil',
    capacity: '0.5M bbl/day',
    importance: 60,
    waypoints: [
      { lat: 26.0, lng:  49.7 }, // Abqaiq (Saudi Arabia)
      { lat: 24.7, lng:  46.7 }, // Riyadh (routing midpoint)
      { lat: 29.5, lng:  40.0 }, // Turaif (Saudi–Jordan border)
      { lat: 32.5, lng:  36.0 }, // Jordan midpoint
      { lat: 33.6, lng:  35.4 }, // Sidon, Lebanon (terminus)
    ],
  },

  // ── 5. Keystone Pipeline System ──────────────────────────────────────────
  // TC Energy.  Moves Alberta oil sands crude to US Gulf Coast refineries.
  {
    id: 'keystone',
    name: 'Keystone Pipeline',
    type: 'oil',
    capacity: '0.6M bbl/day',
    importance: 70,
    waypoints: [
      { lat: 53.5, lng: -113.5 }, // Edmonton, Alberta
      { lat: 50.5, lng: -104.6 }, // Regina, Saskatchewan
      { lat: 45.5, lng: -100.5 }, // North Dakota midpoint
      { lat: 40.0, lng:  -97.0 }, // Steele City, Nebraska
      { lat: 35.9, lng:  -96.8 }, // Cushing, Oklahoma
      { lat: 29.7, lng:  -95.3 }, // Houston, Texas
    ],
  },

  // ── 6. West-East Gas Pipeline (China) ────────────────────────────────────
  // PipeChina / CNPC.  Carries Central Asian and Xinjiang gas east to the
  // Yangtze Delta.  Multiple trunk lines; shown here as a composite corridor.
  {
    id: 'west-east-china',
    name: 'West-East Gas Pipeline (China)',
    type: 'gas',
    capacity: '~90 bcm/yr (Lines 1–4)',
    importance: 85,
    waypoints: [
      { lat: 44.2, lng:  80.5 }, // Horgos border gate (Xinjiang)
      { lat: 42.8, lng:  89.2 }, // Hami, Xinjiang
      { lat: 36.1, lng: 103.8 }, // Lanzhou, Gansu
      { lat: 34.3, lng: 108.9 }, // Xi'an, Shaanxi
      { lat: 32.0, lng: 115.0 }, // Xinyang, Henan
      { lat: 31.2, lng: 121.5 }, // Shanghai (end)
    ],
  },

  // ── 7. TANAP — Trans-Anatolian Pipeline ──────────────────────────────────
  // SOCAR / BP / BOTAS.  Carries Shah Deniz (Caspian) gas across Turkey to
  // the EU border where it connects to TAP (Trans-Adriatic Pipeline) into
  // Greece, Albania, and Italy.
  {
    id: 'tanap',
    name: 'TANAP (Trans-Anatolian Natural Gas Pipeline)',
    type: 'gas',
    capacity: '16 bcm/yr (expandable to 31)',
    importance: 75,
    waypoints: [
      { lat: 41.5, lng:  42.5 }, // Georgia–Turkey border (Türkgözü)
      { lat: 39.9, lng:  41.3 }, // Erzurum compressor station
      { lat: 39.9, lng:  32.9 }, // Ankara (routing midpoint)
      { lat: 39.8, lng:  30.5 }, // Eskişehir
      { lat: 41.0, lng:  28.0 }, // Istanbul bypass (north)
      { lat: 41.7, lng:  26.5 }, // Turkish–Greek border (Ipsala / TAP handover)
    ],
  },

  // ── 8. Nigeria–Morocco Gas Pipeline (NMGP) ───────────────────────────────
  // NNPC / ONHYM.  Planned ~5,600 km offshore/onshore pipeline connecting
  // Nigerian gas fields to Morocco and onward to Europe.  Under development
  // as of 2024; included for forward-looking geopolitical context.
  {
    id: 'nigeria-morocco',
    name: 'Nigeria–Morocco Gas Pipeline (NMGP)',
    type: 'gas',
    capacity: '~30 bcm/yr (planned)',
    importance: 55,
    waypoints: [
      { lat:  6.5, lng:   3.4 }, // Lagos, Nigeria
      { lat:  5.3, lng:  -4.0 }, // Abidjan, Côte d'Ivoire
      { lat:  5.6, lng:  -0.2 }, // Accra, Ghana
      { lat:  6.4, lng:  -1.6 }, // Kumasi routing point
      { lat: 12.4, lng: -16.9 }, // Banjul, Gambia
      { lat: 14.7, lng: -17.4 }, // Dakar, Senegal
      { lat: 20.0, lng: -17.0 }, // Mauritanian coast
      { lat: 33.6, lng:  -7.6 }, // Casablanca, Morocco
      { lat: 35.8, lng:  -5.8 }, // Tangier (planned EU link via Spain)
    ],
  },
];
