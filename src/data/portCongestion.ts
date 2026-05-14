/**
 * Port Congestion Levels — indicative / historical average data
 *
 * IMPORTANT: These values are INDICATIVE ONLY, based on historical patterns
 * and publicly reported congestion trends (2022–2024).  They do NOT reflect
 * real-time vessel queuing data.  For live data, integrate a maritime AIS
 * provider such as MarineTraffic, Kpler, or Windward.
 *
 * "critical"  — Severe chronic congestion; significant dwell-time delays (7+ days).
 * "high"      — Frequent congestion; elevated dwell times (3–7 days above norm).
 * "moderate"  — Periodic congestion; some delay risk, especially at peak season.
 * "low"       — Generally fluid; delays within normal operational variance.
 *
 * Port IDs match the `portId` field in `src/data/portConnectivity.ts`
 * (which in turn matches `id` in `src/data/tradeInfrastructure/seaports.ts`).
 *
 * Sources / methodology:
 *   - Flexport Port Tracker reports 2022–2024
 *   - Sea-Intelligence Sunday Spotlight (port congestion series)
 *   - UNCTAD Review of Maritime Transport 2023
 *   - Bloomberg / Reuters port disruption reporting
 */

export type CongestionLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Port congestion levels keyed by portId.
 * Ports not listed here have no congestion data available.
 */
export const PORT_CONGESTION: Record<string, CongestionLevel> = {
  // ── North America ─────────────────────────────────────────────────────────
  // LA / Long Beach suffered extended congestion post-pandemic (2021-2023);
  // remains elevated relative to other major hubs.
  'sp.la':          'high',
  'sp.long-beach':  'high',
  'sp.nynj':        'moderate',
  'sp.savannah':    'moderate',
  'sp.houston':     'low',

  // ── China ─────────────────────────────────────────────────────────────────
  // Chinese mega-ports experience periodic COVID-related and weather-driven
  // congestion; generally moderate in post-2023 conditions.
  'sp.shanghai':    'moderate',
  'sp.ningbo':      'moderate',
  'sp.shenzhen':    'moderate',
  'sp.guangzhou':   'moderate',
  'sp.tianjin':     'moderate',
  'sp.qingdao':     'moderate',

  // ── Northeast Asia ────────────────────────────────────────────────────────
  'sp.busan':       'low',
  'sp.kaohsiung':   'low',
  'sp.hongkong':    'low',

  // ── Southeast Asia ────────────────────────────────────────────────────────
  'sp.singapore':   'low',

  // ── Europe ────────────────────────────────────────────────────────────────
  'sp.rotterdam':   'low',
  'sp.antwerp':     'low',
  'sp.hamburg':     'low',
  'sp.tanger-med':  'low',
  'sp.algeciras':   'low',
  'sp.piraeus':     'low',
  'sp.valencia':    'low',

  // ── Middle East ───────────────────────────────────────────────────────────
  'sp.jebelali':    'low',

  // ── South Asia ────────────────────────────────────────────────────────────
  'sp.colombo':     'moderate',
  'sp.kandla':      'moderate',

  // ── South America ─────────────────────────────────────────────────────────
  'sp.santos':      'moderate',
  'sp.balboa':      'low',

  // ── Africa / Oceania / Energy terminals ──────────────────────────────────
  'sp.durban':      'moderate',
  'sp.port-hedland': 'low',
  'sp.ras-tanura':  'low',
};

/** Visual colours for congestion level badges and map fills. */
export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  critical: '#dc2626', // red-600
  high:     '#f97316', // orange-500
  moderate: '#f59e0b', // amber-500
  low:      '#22c55e', // green-500
};

/** Tooltip / legend labels. */
export const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  critical: 'Critical — severe chronic delays (7+ days above norm)',
  high:     'High — frequent congestion, elevated dwell times (3–7 days)',
  moderate: 'Moderate — periodic delays, peak-season risk',
  low:      'Low — generally fluid, within normal variance',
};
