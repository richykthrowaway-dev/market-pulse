/**
 * Major Global Commodity Trade Flows — 2023/2024 reference data
 *
 * Each entry represents a significant bilateral commodity flow rendered as a
 * great-circle arc on the globe.  Coordinates are approximate port / terminal
 * centroids suitable for arc rendering; they are NOT vessel-traffic waypoints.
 *
 * Volume figures are annual / daily averages drawn from:
 *   - IEA Oil Market Report 2023–2024
 *   - IGU World LNG Report 2023
 *   - USDA FAS trade data (grains)
 *   - WSTS / TrendForce (semiconductors)
 *   - World Steel Association / USGS (metals)
 *
 * `share` (0–1) is a relative importance weight within each commodity class,
 * used to drive visual stroke width.  1.0 = the single most important flow in
 * that commodity category.
 */

export interface CommodityFlow {
  id: string;
  commodity: 'oil' | 'lng' | 'grain' | 'semiconductors' | 'metals';
  /** Human-readable origin label (port / region). */
  from: string;
  /** Human-readable destination label (port / region). */
  to: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** e.g. "2.5M bbl/day" or "45M tonnes/yr" */
  volume: string;
  /** 0–1 relative importance within commodity class (drives stroke width). */
  share: number;
}

/** Stroke colours per commodity type. */
export const COMMODITY_COLORS: Record<CommodityFlow['commodity'], string> = {
  oil:            '#f59e0b', // amber
  lng:            '#8b5cf6', // purple
  grain:          '#84cc16', // lime
  semiconductors: '#06b6d4', // cyan
  metals:         '#94a3b8', // slate
};

// ── Port coordinate reference ────────────────────────────────────────────────
// These approximate coordinates are reused across multiple flows below.
//
// Ras Tanura / AG Gulf exit: 26.7, 50.1
// Singapore:                  1.3, 103.8
// Shanghai:                  31.2, 121.5
// Rotterdam:                 51.9,   4.5
// Houston / USGC:            29.7, -95.3
// Yokohama:                  35.4, 139.6
// Busan:                     35.1, 129.0
// Kaohsiung:                 22.6, 120.3
// Mumbai:                    18.9,  72.8
// Los Angeles:               33.7,-118.3
// New York / NJ:             40.7, -74.0
// Antwerp:                   51.2,   4.4
// New Orleans:               29.9, -90.1
// Paranaguá (BR):           -25.5, -48.5
// Novorossiysk:              44.7,  37.8
// Durban:                   -29.9,  31.0
// Port Hedland:             -20.3, 118.6
// Cape Town:                -33.9,  18.4
// Ulsan (LNG, KR):           35.5, 129.3
// Sabine Pass (LNG, TX):     29.7, -93.9
// Ras Laffan (Qatar LNG):    26.2,  51.6
// Curtis Island (AUS LNG):  -23.9, 151.2
// Karachi:                   24.8,  66.9
// Chittagong:                22.3,  91.8

export const COMMODITY_FLOWS: CommodityFlow[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // OIL (8 flows)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'oil-gulf-china',
    commodity: 'oil',
    from: 'Arabian Gulf (Ras Tanura)',
    to: 'China (Shanghai)',
    startLat: 26.7, startLng: 50.1,
    endLat: 31.2,   endLng: 121.5,
    volume: '3.5M bbl/day',
    share: 1.0,
  },
  {
    id: 'oil-gulf-japan',
    commodity: 'oil',
    from: 'Arabian Gulf (Ras Tanura)',
    to: 'Japan (Yokohama)',
    startLat: 26.7, startLng: 50.1,
    endLat: 35.4,   endLng: 139.6,
    volume: '2.2M bbl/day',
    share: 0.85,
  },
  {
    id: 'oil-gulf-india',
    commodity: 'oil',
    from: 'Arabian Gulf (Ras Tanura)',
    to: 'India (Mumbai)',
    startLat: 26.7, startLng: 50.1,
    endLat: 18.9,   endLng: 72.8,
    volume: '2.0M bbl/day',
    share: 0.80,
  },
  {
    id: 'oil-gulf-europe',
    commodity: 'oil',
    from: 'Arabian Gulf (Ras Tanura)',
    to: 'Europe (Rotterdam)',
    startLat: 26.7, startLng: 50.1,
    endLat: 51.9,   endLng: 4.5,
    volume: '1.5M bbl/day',
    share: 0.70,
  },
  {
    id: 'oil-russia-europe',
    commodity: 'oil',
    from: 'Russia (Novorossiysk / Baltic)',
    to: 'Europe (Rotterdam)',
    startLat: 44.7, startLng: 37.8,
    endLat: 51.9,   endLng: 4.5,
    volume: '1.2M bbl/day',
    share: 0.65,
  },
  {
    id: 'oil-wafrica-europe',
    commodity: 'oil',
    from: 'West Africa (Durban proxy / Lagos)',
    to: 'Europe (Rotterdam)',
    startLat: 6.5,  startLng: 3.4,
    endLat: 51.9,   endLng: 4.5,
    volume: '0.9M bbl/day',
    share: 0.55,
  },
  {
    id: 'oil-usa-europe',
    commodity: 'oil',
    from: 'USA Gulf Coast (Houston)',
    to: 'Europe (Rotterdam)',
    startLat: 29.7, startLng: -95.3,
    endLat: 51.9,   endLng: 4.5,
    volume: '1.1M bbl/day',
    share: 0.60,
  },
  {
    id: 'oil-americas-asia',
    commodity: 'oil',
    from: 'USA Gulf Coast (Houston)',
    to: 'Asia (Singapore)',
    startLat: 29.7, startLng: -95.3,
    endLat: 1.3,    endLng: 103.8,
    volume: '0.7M bbl/day',
    share: 0.45,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LNG (6 flows)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'lng-qatar-japan',
    commodity: 'lng',
    from: 'Qatar (Ras Laffan)',
    to: 'Japan (Yokohama)',
    startLat: 26.2, startLng: 51.6,
    endLat: 35.4,   endLng: 139.6,
    volume: '18M tonnes/yr',
    share: 0.90,
  },
  {
    id: 'lng-qatar-europe',
    commodity: 'lng',
    from: 'Qatar (Ras Laffan)',
    to: 'Europe (Rotterdam)',
    startLat: 26.2, startLng: 51.6,
    endLat: 51.9,   endLng: 4.5,
    volume: '16M tonnes/yr',
    share: 0.85,
  },
  {
    id: 'lng-australia-japan',
    commodity: 'lng',
    from: 'Australia (Curtis Island)',
    to: 'Japan (Yokohama)',
    startLat: -23.9, startLng: 151.2,
    endLat: 35.4,    endLng: 139.6,
    volume: '22M tonnes/yr',
    share: 1.0,
  },
  {
    id: 'lng-australia-china',
    commodity: 'lng',
    from: 'Australia (Curtis Island)',
    to: 'China (Shanghai)',
    startLat: -23.9, startLng: 151.2,
    endLat: 31.2,    endLng: 121.5,
    volume: '19M tonnes/yr',
    share: 0.95,
  },
  {
    id: 'lng-usa-europe',
    commodity: 'lng',
    from: 'USA (Sabine Pass, TX)',
    to: 'Europe (Rotterdam)',
    startLat: 29.7, startLng: -93.9,
    endLat: 51.9,   endLng: 4.5,
    volume: '32M tonnes/yr',
    share: 0.95,
  },
  {
    id: 'lng-usa-asia',
    commodity: 'lng',
    from: 'USA (Sabine Pass, TX)',
    to: 'Asia (South Korea, Ulsan)',
    startLat: 29.7, startLng: -93.9,
    endLat: 35.5,   endLng: 129.3,
    volume: '12M tonnes/yr',
    share: 0.65,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // GRAIN (6 flows)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'grain-usa-middleeast',
    commodity: 'grain',
    from: 'USA Gulf (New Orleans)',
    to: 'Middle East (Karachi proxy)',
    startLat: 29.9, startLng: -90.1,
    endLat: 24.8,   endLng: 66.9,
    volume: '12M tonnes/yr',
    share: 0.65,
  },
  {
    id: 'grain-usa-asia',
    commodity: 'grain',
    from: 'USA Gulf (New Orleans)',
    to: 'Asia (Shanghai)',
    startLat: 29.9, startLng: -90.1,
    endLat: 31.2,   endLng: 121.5,
    volume: '15M tonnes/yr',
    share: 0.75,
  },
  {
    id: 'grain-ukraine-europe',
    commodity: 'grain',
    from: 'Ukraine (Odesa / Black Sea)',
    to: 'Europe (Rotterdam)',
    startLat: 46.5, startLng: 30.7,
    endLat: 51.9,   endLng: 4.5,
    volume: '20M tonnes/yr',
    share: 0.85,
  },
  {
    id: 'grain-argentina-asia',
    commodity: 'grain',
    from: 'Argentina (Paranaguá proxy)',
    to: 'Asia (Shanghai)',
    startLat: -25.5, startLng: -48.5,
    endLat: 31.2,    endLng: 121.5,
    volume: '18M tonnes/yr',
    share: 0.80,
  },
  {
    id: 'grain-australia-asia',
    commodity: 'grain',
    from: 'Australia (Port Hedland proxy)',
    to: 'Asia (Shanghai)',
    startLat: -20.3, startLng: 118.6,
    endLat: 31.2,    endLng: 121.5,
    volume: '22M tonnes/yr',
    share: 0.90,
  },
  {
    id: 'grain-brazil-asia',
    commodity: 'grain',
    from: 'Brazil (Paranaguá)',
    to: 'Asia (Shanghai)',
    startLat: -25.5, startLng: -48.5,
    endLat: 31.2,    endLng: 121.5,
    volume: '90M tonnes/yr',
    share: 1.0,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEMICONDUCTORS (6 flows)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'semi-taiwan-usa',
    commodity: 'semiconductors',
    from: 'Taiwan (Kaohsiung)',
    to: 'USA (Los Angeles)',
    startLat: 22.6, startLng: 120.3,
    endLat: 33.7,   endLng: -118.3,
    volume: '$120B/yr',
    share: 1.0,
  },
  {
    id: 'semi-taiwan-china',
    commodity: 'semiconductors',
    from: 'Taiwan (Kaohsiung)',
    to: 'China (Shanghai)',
    startLat: 22.6, startLng: 120.3,
    endLat: 31.2,   endLng: 121.5,
    volume: '$55B/yr',
    share: 0.70,
  },
  {
    id: 'semi-taiwan-europe',
    commodity: 'semiconductors',
    from: 'Taiwan (Kaohsiung)',
    to: 'Europe (Rotterdam)',
    startLat: 22.6, startLng: 120.3,
    endLat: 51.9,   endLng: 4.5,
    volume: '$20B/yr',
    share: 0.45,
  },
  {
    id: 'semi-korea-usa',
    commodity: 'semiconductors',
    from: 'South Korea (Busan)',
    to: 'USA (Los Angeles)',
    startLat: 35.1, startLng: 129.0,
    endLat: 33.7,   endLng: -118.3,
    volume: '$70B/yr',
    share: 0.80,
  },
  {
    id: 'semi-korea-europe',
    commodity: 'semiconductors',
    from: 'South Korea (Busan)',
    to: 'Europe (Rotterdam)',
    startLat: 35.1, startLng: 129.0,
    endLat: 51.9,   endLng: 4.5,
    volume: '$18B/yr',
    share: 0.42,
  },
  {
    id: 'semi-korea-china',
    commodity: 'semiconductors',
    from: 'South Korea (Busan)',
    to: 'China (Shanghai)',
    startLat: 35.1, startLng: 129.0,
    endLat: 31.2,   endLng: 121.5,
    volume: '$60B/yr',
    share: 0.75,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // METALS (6 flows)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'metals-australia-china-ironore',
    commodity: 'metals',
    from: 'Australia (Port Hedland — iron ore)',
    to: 'China (Shanghai)',
    startLat: -20.3, startLng: 118.6,
    endLat: 31.2,    endLng: 121.5,
    volume: '900M tonnes/yr',
    share: 1.0,
  },
  {
    id: 'metals-brazil-china-ironore',
    commodity: 'metals',
    from: 'Brazil (Paranaguá — iron ore / Carajás)',
    to: 'China (Shanghai)',
    startLat: -5.8,  startLng: -35.2,   // Ponta da Madeira terminal, Maranhão
    endLat: 31.2,    endLng: 121.5,
    volume: '380M tonnes/yr',
    share: 0.85,
  },
  {
    id: 'metals-chile-asia-copper',
    commodity: 'metals',
    from: 'Chile (Antofagasta — copper)',
    to: 'Asia (Shanghai)',
    startLat: -23.6, startLng: -70.4,
    endLat: 31.2,    endLng: 121.5,
    volume: '5M tonnes/yr',
    share: 0.80,
  },
  {
    id: 'metals-safrica-asia',
    commodity: 'metals',
    from: 'South Africa (Durban — PGMs / chrome)',
    to: 'Asia (Shanghai)',
    startLat: -29.9, startLng: 31.0,
    endLat: 31.2,    endLng: 121.5,
    volume: '250 tonnes PGM/yr',
    share: 0.55,
  },
  {
    id: 'metals-drc-asia-cobalt',
    commodity: 'metals',
    from: 'DR Congo (Durban transit — cobalt)',
    to: 'Asia (Shanghai)',
    startLat: -4.3,  startLng: 15.3,    // Kinshasa proxy
    endLat: 31.2,    endLng: 121.5,
    volume: '150K tonnes/yr',
    share: 0.65,
  },
  {
    id: 'metals-australia-japan',
    commodity: 'metals',
    from: 'Australia (Port Hedland — coking coal / iron ore)',
    to: 'Japan (Yokohama)',
    startLat: -20.3, startLng: 118.6,
    endLat: 35.4,    endLng: 139.6,
    volume: '60M tonnes/yr',
    share: 0.60,
  },
];
