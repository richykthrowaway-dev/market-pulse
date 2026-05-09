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
 */

export type LngLat = [number, number]; // [lng, lat]

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
 * Smooth a polyline using uniform Catmull-Rom spline interpolation.
 *
 * @param points  Array of [lng, lat] tuples — the high-level waypoints
 * @param segments  Intermediate points to insert between each waypoint
 *                  pair. 12 produces visibly smooth curves; higher values
 *                  give more precision at moderate cost.
 * @returns Densified polyline as [lng, lat] tuples that passes through
 *          every original waypoint with smooth curvature in between.
 */
export function smoothPolyline(points: LngLat[], segments = 12): LngLat[] {
  if (points.length < 2) return points.map(p => [...p] as LngLat);

  const unwrapped = unwrapLngs(points);

  // Two-point degenerate case: linear interpolation
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
  // control points only).
  const first      = unwrapped[0];
  const second     = unwrapped[1];
  const last       = unwrapped[unwrapped.length - 1];
  const secondLast = unwrapped[unwrapped.length - 2];

  const startPad: LngLat = [2 * first[0] - second[0],     2 * first[1] - second[1]];
  const endPad:   LngLat = [2 * last[0]  - secondLast[0], 2 * last[1]  - secondLast[1]];

  const padded = [startPad, ...unwrapped, endPad];
  const out: LngLat[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];

    for (let j = 0; j < segments; j++) {
      const t  = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      // Uniform Catmull-Rom basis (tension = 0.5)
      const lng = 0.5 * (
        2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      const lat = 0.5 * (
        2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      out.push([wrapLng(lng), lat]);
    }
  }
  // Final point — Catmull-Rom segments only emit up to t<1, so the very
  // last waypoint is missing without this push.
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
