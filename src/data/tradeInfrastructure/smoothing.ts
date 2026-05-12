/**
 * Trade-route path smoothing.
 *
 * Routes are defined as a small set of high-level waypoints (chokepoints,
 * ocean lane mid-points). This file densifies them into smooth curves
 * with hundreds of points using a Catmull-Rom spline, so visualisations
 * show realistic gradual ship turns rather than sharp 30°+ kinks.
 *
 * Coordinates are treated as 2D in (lng, lat) space — sufficient for
 * globe-scale visualisations. The renderer (three.js for the globe, D3
 * for the flat map) handles the spherical / projected mapping.
 *
 * Date-line handling: longitudes are unwrapped for continuity (so a
 * route running 175°E → -170°W interpolates the short 15° way, not the
 * 345° way around the globe), then wrapped back to [-180, 180] on
 * output. Consumers that care about date-line crossings (the SVG flat
 * map) can detect the resulting jump in projected x and break the path.
 *
 * Algorithm: CENTRIPETAL Catmull-Rom (α = 0.5) via the Barry-Goldman
 * recursive algorithm.  Centripetal parameterisation uses √(chord length)
 * between control points as the knot increment, which guarantees:
 *   • No cusps or self-intersections (unlike uniform/chordal)
 *   • No overshoot when adjacent segments have very different lengths
 *     (e.g. 1 000 km ocean leg next to a 30 km strait waypoint)
 * This prevents routes from cutting through coastal headlands and narrow
 * strait passages where the old uniform spline would swing wide.
 */

export type LngLat = [number, number]; // [lng, lat]

/** α for centripetal Catmull-Rom.  0 = uniform, 0.5 = centripetal, 1.0 = chordal. */
const ALPHA = 0.5;

/** Knot increment: dist(a,b)^α  (in flat lat/lng space — adequate at globe scale). */
function knotInc(a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d  = Math.sqrt(dx * dx + dy * dy);
  return Math.pow(d, ALPHA);
}

/** Unwrap longitudes so consecutive points are always within ±180° of each other. */
function unwrapLngs(points: LngLat[]): LngLat[] {
  if (points.length < 2) return points.map(p => [...p] as LngLat);
  const out: LngLat[] = [[...points[0]] as LngLat];
  for (let i = 1; i < points.length; i++) {
    const prev = out[i - 1];
    let lng = points[i][0];
    while (lng - prev[0] >  180) lng -= 360;
    while (lng - prev[0] < -180) lng += 360;
    out.push([lng, points[i][1]]);
  }
  return out;
}

/** Wrap a longitude back to the [-180, 180] range. */
function wrapLng(lng: number): number {
  let v = lng;
  while (v >  180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

/**
 * Single point on a centripetal Catmull-Rom segment via the Barry-Goldman
 * recursive algorithm.
 *
 * p0–p3 are the four control points; t0–t3 are their cumulative knot values;
 * u is the parameter to evaluate (must be in [t1, t2]).
 */
function barryGoldman(
  p0: LngLat, p1: LngLat, p2: LngLat, p3: LngLat,
  t0: number, t1: number, t2: number, t3: number,
  u: number,
): LngLat {
  // Safe linear interpolation in knot space — guards against coincident points.
  function lerp(a: number, b: number, ta: number, tb: number): number {
    const span = tb - ta;
    if (Math.abs(span) < 1e-12) return (a + b) * 0.5;
    return a * (tb - u) / span + b * (u - ta) / span;
  }

  // Level 1
  const a1x = lerp(p0[0], p1[0], t0, t1);
  const a1y = lerp(p0[1], p1[1], t0, t1);
  const a2x = lerp(p1[0], p2[0], t1, t2);
  const a2y = lerp(p1[1], p2[1], t1, t2);
  const a3x = lerp(p2[0], p3[0], t2, t3);
  const a3y = lerp(p2[1], p3[1], t2, t3);

  // Level 2
  const b1x = lerp(a1x, a2x, t0, t2);
  const b1y = lerp(a1y, a2y, t0, t2);
  const b2x = lerp(a2x, a3x, t1, t3);
  const b2y = lerp(a2y, a3y, t1, t3);

  // Level 3 — the final interpolated point
  return [wrapLng(lerp(b1x, b2x, t1, t2)), lerp(b1y, b2y, t1, t2)];
}

/**
 * Smooth a polyline using centripetal Catmull-Rom spline interpolation.
 *
 * @param points    Array of [lng, lat] tuples — the high-level waypoints.
 * @param segments  Intermediate points to insert between each waypoint pair.
 *                  12 produces visibly smooth curves with adequate strait precision.
 * @returns Densified polyline as [lng, lat] tuples that passes through every
 *          original waypoint with smooth, overshoot-free curvature in between.
 */
export function smoothPolyline(points: LngLat[], segments = 12): LngLat[] {
  if (points.length < 2) return points.map(p => [...p] as LngLat);

  const unwrapped = unwrapLngs(points);

  // Two-point degenerate case: linear interpolation (no spline needed)
  if (unwrapped.length === 2) {
    const [a, b] = unwrapped;
    const out: LngLat[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      out.push([wrapLng(a[0] + (b[0] - a[0]) * t), a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  }

  // Phantom endpoints — extrapolate so the spline actually reaches the
  // real first/last points (otherwise Catmull-Rom would treat them as
  // tangent-control-only points and fall short).
  const first      = unwrapped[0];
  const second     = unwrapped[1];
  const last       = unwrapped[unwrapped.length - 1];
  const secondLast = unwrapped[unwrapped.length - 2];

  const startPad: LngLat = [2 * first[0] - second[0],     2 * first[1] - second[1]];
  const endPad:   LngLat = [2 * last[0]  - secondLast[0], 2 * last[1]  - secondLast[1]];

  const padded = [startPad, ...unwrapped, endPad];

  // Compute cumulative centripetal knot values for all padded points.
  const knots: number[] = [0];
  for (let i = 1; i < padded.length; i++) {
    knots.push(knots[i - 1] + knotInc(padded[i - 1], padded[i]));
  }

  const out: LngLat[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1], p1 = padded[i];
    const p2 = padded[i + 1], p3 = padded[i + 2];
    const t0 = knots[i - 1], t1 = knots[i];
    const t2 = knots[i + 1], t3 = knots[i + 2];

    // Skip coincident control points (degenerate segment)
    if (Math.abs(t2 - t1) < 1e-12) continue;

    // Sample the segment from t1 → t2 (exclusive of end — added below)
    for (let j = 0; j < segments; j++) {
      const u = t1 + (j / segments) * (t2 - t1);
      out.push(barryGoldman(p0, p1, p2, p3, t0, t1, t2, t3, u));
    }
  }

  // Final waypoint — the loop only emits up to t < t2 per segment, so the
  // very last control point would be missing without this push.
  out.push([wrapLng(last[0]), last[1]]);
  return out;
}

/**
 * Convenience helper: build the full coordinate chain for a TradeRoute
 * (start → waypoints → end), smooth it, and return [lng, lat] tuples.
 */
export function smoothRouteCoords(route: {
  startLat: number; startLng: number;
  endLat: number;   endLng: number;
  waypoints?: Array<{ lat: number; lng: number }>;
}, segments = 12): LngLat[] {
  const coords: LngLat[] = [
    [route.startLng, route.startLat],
    ...(route.waypoints ?? []).map(wp => [wp.lng, wp.lat] as LngLat),
    [route.endLng, route.endLat],
  ];
  return smoothPolyline(coords, segments);
}
