/**
 * Chokepoint risk derivation.
 *
 * Combines signal layers that are already loaded elsewhere on the Global page
 * (conflicts, earthquakes, natural events) into a single 0–10 risk score per
 * maritime chokepoint. No extra network calls — pure derivation.
 *
 * Scoring (per chokepoint):
 *   For each event within RISK_RADIUS_KM of the chokepoint we add a weight,
 *   attenuated by proximity (linear decay 1.0 at 0 km → 0.0 at the radius
 *   edge).  Per-event weights:
 *     · Conflict   → min(3, fatalities ÷ 10)  — capped so a single 1000-death
 *                                              event doesn't peg the score
 *     · Earthquake → max(0, magnitude − 4)    — sub-M4 quakes don't disrupt
 *                                              shipping; M7+ dominates
 *     · Natural    → category-weighted: storms 3, volcanoes 3, wildfires 2,
 *                                       floods 1.5
 *   Final score = clamp(0, 10, weighted sum).
 *
 * RISK_RADIUS_KM is intentionally generous (800 km) because maritime
 * chokepoints feel pressure from disruption further away than land
 * infrastructure does — fleet diversions, insurance premiums, port-state
 * controls all extend the risk halo.
 */

import type { ConflictEvent } from '@/hooks/useConflictEvents';
import type { EarthquakeEvent } from '@/hooks/useEarthquakes';
import type { NaturalEvent } from '@/hooks/useNaturalEvents';

const RISK_RADIUS_KM = 800;
const NATURAL_WEIGHTS: Record<NaturalEvent['category'], number> = {
  severeStorms: 3.0,
  volcanoes:    3.0,
  wildfires:    2.0,
  floods:       1.5,
};

export interface ChokepointLite {
  id:        string;
  name:      string;
  lat:       number;
  lng:       number;
}

export interface ChokepointRisk {
  chokepointId:   string;
  chokepointName: string;
  lat:            number;
  lng:            number;
  /** 0–10 composite score. */
  score:          number;
  /** Top-3 contributing events for tooltip — most impactful first. */
  drivers:        Array<{
    kind:      'conflict' | 'earthquake' | 'natural';
    label:     string;
    weight:    number;
    distanceKm: number;
  }>;
}

// ── Great-circle distance (haversine) ────────────────────────────────────────

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const φ1 = aLat * Math.PI / 180;
  const φ2 = bLat * Math.PI / 180;
  const dφ = (bLat - aLat) * Math.PI / 180;
  const dλ = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Linear proximity decay: 1.0 at distance 0, 0.0 at RISK_RADIUS_KM.
function proximityWeight(distanceKm: number): number {
  if (distanceKm >= RISK_RADIUS_KM) return 0;
  return 1 - distanceKm / RISK_RADIUS_KM;
}

// ── Per-event weight functions ───────────────────────────────────────────────

function conflictWeight(e: ConflictEvent): number {
  return Math.min(3, (e.fatalities ?? 0) / 10);
}

function earthquakeWeight(e: EarthquakeEvent): number {
  return Math.max(0, e.magnitude - 4);
}

function naturalWeight(e: NaturalEvent): number {
  return NATURAL_WEIGHTS[e.category] ?? 1;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export interface ComputeRiskArgs {
  chokepoints:     ChokepointLite[];
  conflicts?:      ConflictEvent[];
  earthquakes?:    EarthquakeEvent[];
  naturals?:       NaturalEvent[];
}

export function computeChokepointRisk(args: ComputeRiskArgs): ChokepointRisk[] {
  const { chokepoints, conflicts = [], earthquakes = [], naturals = [] } = args;
  const out: ChokepointRisk[] = [];

  for (const cp of chokepoints) {
    let score = 0;
    const drivers: ChokepointRisk['drivers'] = [];

    // Conflicts
    for (const e of conflicts) {
      const dist = haversineKm(cp.lat, cp.lng, e.lat, e.lng);
      if (dist >= RISK_RADIUS_KM) continue;
      const w = conflictWeight(e) * proximityWeight(dist);
      if (w <= 0) continue;
      score += w;
      drivers.push({
        kind: 'conflict',
        label: `${e.fatalities ?? 0} fatalities — ${e.eventType || 'conflict event'}`,
        weight: w,
        distanceKm: dist,
      });
    }

    // Earthquakes
    for (const e of earthquakes) {
      const dist = haversineKm(cp.lat, cp.lng, e.lat, e.lng);
      if (dist >= RISK_RADIUS_KM) continue;
      const w = earthquakeWeight(e) * proximityWeight(dist);
      if (w <= 0) continue;
      score += w;
      drivers.push({
        kind: 'earthquake',
        label: `M${e.magnitude.toFixed(1)} — ${e.place ?? 'earthquake'}`,
        weight: w,
        distanceKm: dist,
      });
    }

    // Naturals
    for (const e of naturals) {
      const dist = haversineKm(cp.lat, cp.lng, e.lat, e.lng);
      if (dist >= RISK_RADIUS_KM) continue;
      const w = naturalWeight(e) * proximityWeight(dist);
      if (w <= 0) continue;
      score += w;
      drivers.push({
        kind: 'natural',
        label: `${e.category} — ${e.title}`,
        weight: w,
        distanceKm: dist,
      });
    }

    score = Math.min(10, score);

    if (score > 0.1) {
      drivers.sort((a, b) => b.weight - a.weight);
      out.push({
        chokepointId: cp.id,
        chokepointName: cp.name,
        lat: cp.lat,
        lng: cp.lng,
        score,
        drivers: drivers.slice(0, 3),
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Visual band for color coding. */
export type RiskBand = 'low' | 'moderate' | 'high' | 'severe';

export function riskBand(score: number): RiskBand {
  if (score < 2) return 'low';
  if (score < 4) return 'moderate';
  if (score < 7) return 'high';
  return 'severe';
}
