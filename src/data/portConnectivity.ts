/**
 * UNCTAD Liner Shipping Connectivity Index (LSCI).
 *
 * LSCI measures how well a country/port is connected to the global liner-
 * shipping network. Higher = more services, more direct connections, more
 * vessel capacity. Published quarterly by UNCTAD; values below are
 * approximate Q3-2023 reference values for the major seaports we render.
 *
 * Scale notes:
 *   - 100 ≈ moderately connected (around Hamburg / LA in recent data)
 *   - 150+ ≈ top-tier hub (Shanghai, Singapore)
 *   - Below 50: regional / specialised port
 *
 * Source: https://unctadstat.unctad.org/wds/TableViewer/tableView.aspx
 *         (Series TUS.M.LSCI.A — Liner Shipping Connectivity Index, port level)
 *
 * Coverage is intentionally limited to ports in `src/data/tradeInfrastructure/seaports.ts`.
 * Ports without an LSCI score (e.g. pure bulk / energy terminals like Ras Tanura,
 * Port Hedland) get a low default reflecting their non-container focus.
 */

export interface PortConnectivity {
  /** Matches `id` in seaports.ts */
  portId:  string;
  /** UNCTAD LSCI value, ~0-200 scale. */
  lsci:    number;
  /** Optional human label for the badge/tooltip — falls back to port name otherwise. */
  note?:   string;
}

export const PORT_LSCI: PortConnectivity[] = [
  // East Asia — the top of the global rankings
  { portId: 'sp.shanghai',   lsci: 161 },
  { portId: 'sp.singapore',  lsci: 145 },
  { portId: 'sp.ningbo',     lsci: 142 },
  { portId: 'sp.busan',      lsci: 134 },
  { portId: 'sp.hongkong',   lsci: 117 },
  { portId: 'sp.qingdao',    lsci: 113 },
  { portId: 'sp.shenzhen',   lsci: 110 },
  { portId: 'sp.tianjin',    lsci:  88 },
  { portId: 'sp.guangzhou',  lsci:  82 },
  { portId: 'sp.kaohsiung',  lsci:  78 },

  // Europe
  { portId: 'sp.antwerp',    lsci: 121 },
  { portId: 'sp.rotterdam',  lsci: 113 },
  { portId: 'sp.hamburg',    lsci:  95 },
  { portId: 'sp.tanger-med', lsci:  86 },
  { portId: 'sp.algeciras',  lsci:  84 },
  { portId: 'sp.valencia',   lsci:  81 },
  { portId: 'sp.piraeus',    lsci:  80 },

  // Middle East / South Asia
  { portId: 'sp.jebelali',   lsci:  79 },
  { portId: 'sp.colombo',    lsci:  73 },
  { portId: 'sp.kandla',     lsci:  62, note: 'Mundra (Adani)' },
  { portId: 'sp.ras-tanura', lsci:  35, note: 'Energy-focused — not in core LSCI' },

  // North America
  { portId: 'sp.la',         lsci:  96 },
  { portId: 'sp.nynj',       lsci:  91 },
  { portId: 'sp.long-beach', lsci:  90 },
  { portId: 'sp.houston',    lsci:  75 },
  { portId: 'sp.savannah',   lsci:  73 },

  // South America / Central America
  { portId: 'sp.santos',     lsci:  65 },
  { portId: 'sp.balboa',     lsci:  58 },

  // Africa
  { portId: 'sp.durban',     lsci:  50 },

  // Oceania
  { portId: 'sp.port-hedland', lsci: 38, note: 'Bulk-only — not in core LSCI' },
];

/** Fast lookup map. */
export const PORT_LSCI_BY_ID: Record<string, number> = Object.fromEntries(
  PORT_LSCI.map(p => [p.portId, p.lsci]),
);

/** Lookup with fallback to undefined (port not measured). */
export function lookupLsci(portId: string): number | undefined {
  return PORT_LSCI_BY_ID[portId];
}

/** Highest observed LSCI — used to normalise visual scales. */
export const MAX_LSCI = Math.max(...PORT_LSCI.map(p => p.lsci));

/**
 * Map an LSCI value to a 0-1 connectivity intensity.
 * Uses log scaling so the gap between top-tier ports (140+) and middle-tier
 * (90-110) is visually clear without crushing the lower range.
 */
export function lsciIntensity(lsci: number): number {
  if (lsci <= 0) return 0;
  return Math.min(1, Math.log(1 + lsci) / Math.log(1 + MAX_LSCI));
}
