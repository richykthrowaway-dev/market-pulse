import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
// Line2 / LineSegments2 — instanced-quad-based line rendering so we can have
// thick lines (WebGL's gl.LINES is hard-capped at 1px on every browser).
// Setting `worldUnits: true` on LineMaterial makes linewidth interpret as
// 3D world units, so rivers automatically grow on-screen as you zoom in.
import { LineMaterial }         from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineSegments2 }        from "three/examples/jsm/lines/LineSegments2.js";
import geoJsonUrl from "@/data/countries-50m.geojson";
import { COUNTRY_META, FLAG_COLORS } from "@/data/countryMeta";
import { EXCHANGES, CONTINENT_COLORS, type ExchangeInfo } from "@/data/exchangeData";
import { NODE_COLOR, ROUTE_COLOR, type TradeNode, type TradeRoute } from "@/data/tradeInfrastructure";
import { smoothRouteCoords } from "@/data/tradeInfrastructure/smoothing";
import type { Vessel } from "@/hooks/useAISStream";
import type { ConflictEvent } from "@/hooks/useConflictEvents";
import type { EarthquakeEvent } from "@/hooks/useEarthquakes";
import type { Flight } from "@/hooks/useOpenSkyFlights";
import type { EconomicEvent } from "@/hooks/useEconomicEvents";
import type { MacroCountry } from "@/hooks/useMacroHeatmap";
import { WORLD_CITIES, type WorldCity } from "@/data/worldCities";

// ── Earth textures (NASA Blue Marble + topology + clouds) ──────────────
//
// Source: NASA Visible Earth's Blue Marble dataset, mirrored as the
// reference texture set for the `three-globe` package (the renderer that
// powers react-globe.gl). jsDelivr serves it from GitHub at the file's
// committed SHA, so the URL is stable and the response is edge-cached
// globally — no Vercel bandwidth, no cold-start latency on first paint.
//
// earth-blue-marble.jpg — 8K equirectangular daytime imagery (~1.4 MB)
// earth-topology.png    — heightmap used as bump map for terrain depth
// fair_clouds_4k.png    — 4K transparent cloud layer (~5 MB), rendered
//                         on a slightly larger transparent sphere with
//                         independent slow rotation to suggest weather.
const EARTH_TEXTURE_URL    = "https://cdn.jsdelivr.net/gh/vasturiano/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_URL       = "https://cdn.jsdelivr.net/gh/vasturiano/three-globe/example/img/earth-topology.png";
const CLOUDS_TEXTURE_URL    = "https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/fair_clouds_4k.png";
// Higher-quality cloud texture from the three-globe npm package (jsDelivr CDN).
// Loaded progressively after the 4K cloud mesh is already rendering — same
// hot-swap pattern as the 16K earth upgrade.
const CLOUDS_TEXTURE_HQ_URL = "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png";
// Same NASA Blue Marble imagery at 16 384 × 8 192 — 4× the pixel count of the
// default 8K version.  Loaded progressively in the background and hot-swapped
// into the globe material once decoded so close-up views stay sharp.
const EARTH_TEXTURE_16K_URL = "https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/2_no_clouds_16k.jpg";

type GlobeMode = "flags" | "performance";
type Feature = { properties: Record<string, any>; geometry: any };

const ISO_OVERRIDES: Record<string, string> = {
  France: "FR",
  Norway: "NO",
  "Northern Cyprus": "CY",
  Somaliland: "SO",
};

interface GlobeViewProps {
  width: number;
  height: number;
  mode: GlobeMode;
  performanceMap: Record<string, number>;
  selectedCountry: string | null;
  onCountryClick: (iso2: string) => void;
  showExchangePins?: boolean;
  onExchangeClick?: (exchange: ExchangeInfo) => void;
  selectedExchange?: ExchangeInfo | null;
  /**
   * Whether the globe should idle-spin (continuous gentle rotation when
   * the user isn't interacting). When false, the globe is fully static
   * unless the user drags it.
   */
  autoRotate?: boolean;

  // ── Trade infrastructure overlay (optional) ─────────────────────────
  // When the Trade tab is active, the panel feeds these props down to
  // render port/airport/chokepoint markers and route arcs on the globe.
  // All optional — when omitted, the globe behaves identically to before.
  tradePoints?:           TradeNode[];
  tradeArcs?:             TradeRoute[];
  selectedTradeNodeId?:   string | null;
  onTradeNodeClick?:      (node: TradeNode) => void;
  /**
   * Live vessel positions from AIS. Rendered imperatively as a three.js
   * Points mesh attached directly to the scene — bypasses react-globe.gl's
   * data-transition reconciliation, which would lock up at AIS update rates.
   */
  liveVessels?:           Vessel[];
  /**
   * Live flight positions from OpenSky. Same imperative Points approach as
   * vessels — altitude 1.010 keeps flights visually above ship layer (1.008).
   */
  liveFlights?:           Flight[];
  /**
   * Geocoded conflict / unrest events (ACLED + GDELT).  Rendered as pulsing
   * rings on the globe via react-globe.gl's `ringsData` slot.  Color & size
   * scale with fatalities so high-casualty events stand out.
   */
  conflictEvents?:        ConflictEvent[];
  /** Click handler for a conflict event marker — receives the event. */
  onConflictEventClick?:  (e: ConflictEvent) => void;
  /**
   * USGS M2.5+ seismic events.  Rendered as teal pulsing rings — visually
   * distinct from the orange/red conflict rings.  Ring size scales with
   * magnitude (M2.5 → tiny, M7+ → large).
   */
  earthquakeEvents?:        EarthquakeEvent[];
  onEarthquakeEventClick?:  (e: EarthquakeEvent) => void;
  /** Upcoming macro economic calendar events (EODHD) */
  economicEvents?:          EconomicEvent[];
  onEconomicEventClick?:    (e: EconomicEvent) => void;
  /** GDP growth per country — drives polygon cap color when macroHeatmap layer active */
  macroHeatmap?:            MacroCountry[];
  /** When true, city/capital name labels are shown at close zoom (altitude < 1.2). */
  showCityLabels?:          boolean;
  /** When true, Natural Earth river/lake centerlines are rendered as a blue line layer. */
  showWaterways?:           boolean;
  /**
   * Real day/night cycle.  When true, the globe darkens on the hemisphere
   * facing away from the sun (computed from current UTC time + Earth's
   * axial tilt).  Useful for visualising which markets / exchanges /
   * regions are in daylight at the present moment.
   */
  dayNightCycle?:           boolean;
  /**
   * Country polygon fills.  When false, polygon caps return mostly
   * transparent so the bare globe texture is visible.  Hover and
   * selected-country highlights remain (subtler).  Pairs with
   * dayNightCycle so the terminator becomes fully visible.
   */
  showCountryColors?:       boolean;

  /**
   * Trade partner arcs — animated great-circle arcs from a selected country
   * to its top export destinations (green) and import sources (amber).
   * Populated by Global.tsx from WITS partner data when the Trade tab is
   * active and a country is selected.  Rendered on a separate arcsData slot
   * so they never interfere with the existing pathsData trade routes.
   */
  partnerArcs?:             PartnerArc[];
}

// ── Partner arc type ─────────────────────────────────────────────────────────
export interface PartnerArc {
  startLat: number;
  startLng: number;
  endLat:   number;
  endLng:   number;
  /** Hex color — emerald for exports, amber for imports. */
  color:    string;
  /** Tooltip label. */
  label:    string;
  /** 0–1 trade share — drives arc stroke width. */
  share:    number;
}

// ── Stable constant callbacks (never recreated) ──────────────────────────
const SIDE_COLOR = () => "rgba(0, 0, 0, 0.10)";
const STROKE_COLOR = () => "rgba(255, 255, 255, 0.08)";

// ── Exchange HTML pin layer (module-level, stable) ──────────────────────
const EMPTY_ARRAY: ExchangeInfo[] = [];
const HTML_PIN_LAT = (d: object) => (d as ExchangeInfo).lat;
const HTML_PIN_LNG = (d: object) => (d as ExchangeInfo).lng;
const HTML_PIN_ALT = () => 0.015;

// Ref-holder for click callback — lets HTML element onclick always call
// the latest React callback without recreating every pin element.
let _exchangeClickRef: ((ex: ExchangeInfo) => void) | undefined;

function createPinElement(d: object): HTMLElement {
  const ex = d as ExchangeInfo;
  const color = CONTINENT_COLORS[ex.continent] ?? "#888";

  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;position:relative;pointer-events:auto;";

  // Pin: colored dot with white border + glow
  const dot = document.createElement("div");
  dot.style.cssText = `
    width:14px;height:14px;
    background:${color};
    border:2px solid rgba(255,255,255,0.9);
    border-radius:50%;
    box-shadow:0 0 6px ${color},0 2px 4px rgba(0,0,0,0.5);
    transition:transform 0.15s ease,box-shadow 0.15s ease;
    transform:translate(-50%,-50%);
  `;

  // Stem: small triangle below the dot
  const stem = document.createElement("div");
  stem.style.cssText = `
    position:absolute;top:5px;left:50%;
    width:0;height:0;
    border-left:4px solid transparent;
    border-right:4px solid transparent;
    border-top:6px solid ${color};
    transform:translateX(-50%);
    filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));
    transition:border-top-color 0.15s;
  `;

  // Tooltip: appears on hover
  const tip = document.createElement("div");
  tip.style.cssText = `
    position:absolute;bottom:16px;left:50%;
    transform:translateX(-50%);
    padding:5px 9px;
    background:rgba(0,0,0,0.88);
    border-radius:5px;
    font-size:11px;color:#fff;
    white-space:nowrap;
    pointer-events:none;
    opacity:0;
    transition:opacity 0.15s;
    border-left:3px solid ${color};
  `;
  tip.innerHTML = `<div style="font-weight:600">${ex.name}</div><div style="opacity:0.7;margin-top:1px">${ex.city} · ${ex.code}</div>`;

  el.appendChild(dot);
  el.appendChild(stem);
  el.appendChild(tip);

  // Hover effects — native DOM, no raycasting needed
  el.addEventListener("mouseenter", () => {
    dot.style.transform = "translate(-50%,-50%) scale(1.5)";
    dot.style.boxShadow = `0 0 14px ${color},0 0 24px ${color}40,0 2px 6px rgba(0,0,0,0.5)`;
    tip.style.opacity = "1";
  });
  el.addEventListener("mouseleave", () => {
    dot.style.transform = "translate(-50%,-50%) scale(1)";
    dot.style.boxShadow = `0 0 6px ${color},0 2px 4px rgba(0,0,0,0.5)`;
    tip.style.opacity = "0";
  });

  // Click — uses module-level ref so it always calls the latest callback
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    _exchangeClickRef?.(ex);
  });

  return el;
}

// Fade pins on the far side of the globe
function handlePinVisibility(el: HTMLElement, isVisible: boolean) {
  el.style.opacity = isVisible ? "1" : "0";
  el.style.pointerEvents = isVisible ? "auto" : "none";
}

function perfColor(changePct: number): string {
  const clamped = Math.max(-5, Math.min(5, changePct));
  const t = (clamped + 5) / 10;
  const r = Math.round(220 - t * 180);
  const g = Math.round(40 + t * 180);
  return `rgba(${r}, ${g}, 60, 0.45)`;
}

/** Map AIS numeric ship-type codes to human-readable labels. */
function fmtShipType(code: number | undefined): string {
  if (code === undefined) return 'Unknown';
  if (code >= 70 && code <= 79) return 'Cargo';
  if (code >= 80 && code <= 89) return 'Tanker';
  if (code >= 60 && code <= 69) return 'Passenger';
  if (code === 30) return 'Fishing';
  if (code === 31 || code === 32) return 'Tug';
  if (code === 36 || code === 37) return 'Pleasure craft';
  if (code >= 33 && code <= 35) return 'Other (engaged)';
  return `Type ${code}`;
}

/** AIS NavigationalStatus code → label.  Codes 9-14 are reserved; 15 is filtered upstream. */
const NAV_STATUS_LABEL: Record<number, string> = {
  0:  'Under way',
  1:  'At anchor',
  2:  'Not under command',
  3:  'Restricted maneuver',
  4:  'Constrained by draught',
  5:  'Moored',
  6:  'Aground',
  7:  'Fishing',
  8:  'Sailing',
};
function fmtNavStatus(code: number | undefined): string | undefined {
  if (code === undefined) return undefined;
  return NAV_STATUS_LABEL[code] ?? `Status ${code}`;
}

/**
 * Map AIS NavigationalStatus → vessel dot colour.
 *   Under way (0) / unknown      → cyan   (default — most ships fall here)
 *   Anchored (1)                 → blue
 *   Moored   (5)                 → violet
 *   Fishing  (7)                 → green
 *   Sailing  (8)                 → teal
 *   Constrained by draught (4)   → amber  (heavy laden vessels)
 *   Not-under-command / restr-mvr / aground (2,3,6) → orange (distressed)
 *
 * Returned as a hex int for THREE.Color.setHex().
 */
function navStatusColorHex(navStatus: number | undefined): number {
  switch (navStatus) {
    case 1:  return 0x60a5fa; // anchored
    case 5:  return 0x8b5cf6; // moored
    case 7:  return 0x4ade80; // fishing
    case 8:  return 0x14b8a6; // sailing
    case 4:  return 0xfbbf24; // constrained by draught
    case 2:
    case 3:
    case 6:  return 0xf97316; // distressed
    case 0:
    default: return 0x67e8f9; // under way / unknown — cyan baseline
  }
}

/**
 * Multiply the alpha channel of an rgba(...) or #RRGGBBAA colour string by
 * a scalar.  Used by getCapColor when day/night cycle is active: each
 * country's cap gets dimmed by how much its centroid is in shadow, so the
 * night-side polygon overlay fades and the dark texture beneath it becomes
 * visible.  Identity-returns the input when factor ≈ 1 to avoid string
 * parsing in the common case.
 */
function multiplyAlpha(color: string, factor: number): string {
  if (factor >= 0.999) return color;
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*([0-9.]+)\s*\)$/, (_, a) =>
      `, ${(parseFloat(a) * factor).toFixed(3)})`);
  }
  if (color.startsWith('#') && color.length === 9) {
    const aHex   = parseInt(color.slice(7), 16);
    const newA   = Math.max(0, Math.min(255, Math.round(aHex * factor)));
    return color.slice(0, 7) + newA.toString(16).padStart(2, '0');
  }
  return color;
}

/**
 * Compute a unit-length direction vector from the globe's centre toward the
 * sun at the current UTC time.  In three-globe's coordinate system the
 * prime meridian (Greenwich) sits at +Z and Y is up.
 *
 *   Subsolar longitude:  sunLng = 15° × (12 − UTC-hours)
 *     (e.g. at UTC 12:00 sunLng = 0° — sun over Greenwich)
 *   Solar declination:   declines ±23.45° with the year (axial tilt)
 *     (e.g. ≈ −23.45° at Dec solstice, +23.45° at June solstice)
 *
 * Together: dir = ( cos(decl)·sin(sunLng), sin(decl), cos(decl)·cos(sunLng) )
 *
 * The cosine declination model is an approximation (accurate to ~1°) — fine
 * for visual rendering of the terminator.  More precise ephemeris would use
 * VSOP87 or similar, but the visual difference is sub-pixel at globe scale.
 */
function computeSunDirection(target: THREE.Vector3): THREE.Vector3 {
  const now = new Date();
  // Day-of-year (UTC), 1-indexed.  Date.UTC(year, 0, 0) is Dec 31 of prev year.
  const dayOfYear =
    Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000);
  // Earth's axial tilt is 23.45°.  Phase shift +10 days places the minimum
  // (Dec solstice) on day ~355 of the year.
  const declRad =
    -23.45 * Math.PI / 180 * Math.cos(((dayOfYear + 10) * 2 * Math.PI) / 365.25);

  const utcHours =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const sunLngRad = ((12 - utcHours) * 15 * Math.PI) / 180;

  const cosDecl = Math.cos(declRad);
  return target.set(
    cosDecl * Math.sin(sunLngRad),
    Math.sin(declRad),
    cosDecl * Math.cos(sunLngRad),
  );
}

/**
 * Map a target distance in km to a "nice" round number with a printable
 * label (1, 2, 5, ×10 sequence).  Used by the scale-bar overlay to pick a
 * round value close to "the bar would be 100 px wide at this zoom."
 *
 * Returns the largest entry whose km ≤ target; falls back to 100 m for
 * extreme close-ups.
 */
function pickNiceScale(targetKm: number): { km: number; label: string } {
  // [km, displayLabel]. Sub-km entries handle very-close zoom on the globe.
  const values: ReadonlyArray<readonly [number, string]> = [
    [0.1, '100 m'], [0.2, '200 m'], [0.5, '500 m'],
    [1, '1 km'],   [2, '2 km'],   [5, '5 km'],
    [10, '10 km'], [20, '20 km'], [50, '50 km'],
    [100, '100 km'], [200, '200 km'], [500, '500 km'],
    [1000, '1,000 km'], [2000, '2,000 km'], [5000, '5,000 km'],
    [10000, '10,000 km'],
  ];
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] <= targetKm) return { km: values[i][0], label: values[i][1] };
  }
  return { km: values[0][0], label: values[0][1] };
}

/** Format an ISO ETA string to a compact "Jun 15, 18:30 UTC" form. */
function fmtEta(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mm = months[d.getUTCMonth()];
  const dd = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mm} ${dd}, ${hh}:${mn} UTC`;
}

// ── Unified ring layer — conflicts (orange/red) + earthquakes (teal) ────
// react-globe.gl has a single `ringsData` slot, so we merge both event
// types into a discriminated union and dispatch in each callback.

type RingDatum =
  | { kind: 'conflict';   lat: number; lng: number; event: ConflictEvent }
  | { kind: 'earthquake'; lat: number; lng: number; event: EarthquakeEvent }
  | { kind: 'economic';   lat: number; lng: number; event: EconomicEvent };

const RING_LAT = (d: object) => (d as RingDatum).lat;
const RING_LNG = (d: object) => (d as RingDatum).lng;
// Rings sit clearly above ALL polygon layers (default 0.005, selected
// country 0.03) — kept at 0.05 so they're never occluded by country fills.
const RING_ALT = () => 0.05;
const EMPTY_RINGS: RingDatum[] = [];

// ── City label layer (zoomed-in detail) ─────────────────────────────────
// All accessors are module-level so their identity is stable across renders —
// react-globe.gl only rebuilds its canvas sprite atlas when data *content*
// changes, not on every React re-render.
const EMPTY_LABELS: WorldCity[] = [];
const LABEL_LAT        = (d: object) => (d as WorldCity).lat;
const LABEL_LNG        = (d: object) => (d as WorldCity).lng;
const LABEL_TEXT       = (d: object) => (d as WorldCity).name;
const LABEL_COLOR      = () => 'rgba(255,255,255,0.85)';
const LABEL_SIZE       = (d: object) => (d as WorldCity).capital ? 0.50 : 0.35;
const LABEL_DOT_RADIUS = (d: object) => (d as WorldCity).capital ? 0.28 : 0.18;
const LABEL_DOT_ORIENT = () => 'bottom' as const;

/** Color callback — orange/red for conflicts, teal for earthquakes, blue for economic events. */
function ringColor(d: object) {
  const rd = d as RingDatum;
  if (rd.kind === 'conflict') {
    const e = rd.event as ConflictEvent;
    const f = Math.min(50, e.fatalities);
    const r = 249;
    const g = Math.round(115 - (f / 50) * 47);
    const b = Math.round(22  + (f / 50) * 46);
    return (t: number) => `rgba(${r}, ${g}, ${b}, ${(1 - t * 0.6).toFixed(2)})`;
  } else if (rd.kind === 'earthquake') {
    const e = rd.event as EarthquakeEvent;
    const intensity = Math.min(1, (e.magnitude - 2.5) / 5);
    const r = Math.round(56  - intensity * 20);
    const g = Math.round(189 - intensity * 40);
    const b = Math.round(248 - intensity * 10);
    return (t: number) => `rgba(${r}, ${g}, ${b}, ${(1 - t).toFixed(2)})`;
  } else {
    // Economic event — blue, high-importance pulses brighter
    const e = rd.event as EconomicEvent;
    const bright = e.importance === 'high' ? 255 : e.importance === 'medium' ? 200 : 160;
    return (t: number) => `rgba(96, ${bright}, 250, ${(1 - t * 0.65).toFixed(2)})`;
  }
}

function ringMaxRadius(d: object) {
  const rd = d as RingDatum;
  if (rd.kind === 'conflict') {
    const e = rd.event as ConflictEvent;
    return Math.min(4, 2.5 + Math.log10(1 + e.fatalities) * 0.5);
  } else if (rd.kind === 'earthquake') {
    const e = rd.event as EarthquakeEvent;
    return Math.min(4, 0.4 * Math.pow(10, (e.magnitude - 2.5) * 0.28));
  } else {
    // Economic: high = 2.5, medium = 1.8
    const e = rd.event as EconomicEvent;
    return e.importance === 'high' ? 2.5 : 1.8;
  }
}

// ── Solid clickable marker (objectsData layer) ───────────────────────────
// Rings alone have a tiny hit area (only the animated outline is click-
// testable).  We pair each ring with a solid sphere mesh at the same
// coordinates.  The sphere is the actual click target — generous radius,
// always visible, with a glow material so it pops against country fills.

const OBJ_LAT = (d: object) => (d as RingDatum).lat;
const OBJ_LNG = (d: object) => (d as RingDatum).lng;
const OBJ_ALT = () => 0.05;

function makeEventMarker(d: object): THREE.Object3D {
  const rd = d as RingDatum;

  // Per-kind color palette
  const coreColor = rd.kind === 'conflict'   ? 0xff8838
                  : rd.kind === 'earthquake' ? 0x60d4ff
                  :                            0x60a5fa; // economic = blue
  const haloColor = rd.kind === 'conflict'   ? 0xf97316
                  : rd.kind === 'earthquake' ? 0x38bdf8
                  :                            0x3b82f6;

  const hitGeom  = new THREE.SphereGeometry(4.0, 8, 6);
  const hitMat   = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitSphere = new THREE.Mesh(hitGeom, hitMat);

  const innerGeom = new THREE.SphereGeometry(0.9, 16, 12);
  const innerMat  = new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.95, depthWrite: false });
  const inner = new THREE.Mesh(innerGeom, innerMat);

  const haloGeom = new THREE.SphereGeometry(1.8, 16, 12);
  const haloMat  = new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.30, depthWrite: false });
  const halo = new THREE.Mesh(haloGeom, haloMat);

  const group = new THREE.Group();
  group.add(hitSphere);
  group.add(halo);
  group.add(inner);
  return group;
}

// ── Waterway data (Natural Earth 10m rivers + lake centerlines) ──────────
// Rendered as a Three.js LineSegments layer on top of the country polygons
// so the rivers / canals that AIS vessels actually broadcast from are
// visible underneath the dots.  Without this layer, ships in the Rhine,
// Seine, Garonne etc. visually sit on the country fill — the data is
// correct, but the map gives no indication that there's water there.
// ~2 MB GeoJSON, jsDelivr CDN, cached across remounts.
const NE_RIVERS_URL = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_rivers_lake_centerlines.geojson";

let riversCache:   Feature[] | null = null;
let riversPromise: Promise<Feature[]> | null = null;

function loadRivers(): Promise<Feature[]> {
  if (riversCache) return Promise.resolve(riversCache);
  if (!riversPromise) {
    riversPromise = fetch(NE_RIVERS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`rivers HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        riversCache = data.features ?? [];
        return riversCache!;
      })
      .catch((err) => {
        console.warn('[GlobeView] rivers load failed:', err);
        riversPromise = null; // allow retry
        throw err;
      });
  }
  return riversPromise;
}

// Module-level GeoJSON cache — survives component remounts / HMR
let geoJsonCache: Feature[] | null = null;
let geoJsonPromise: Promise<Feature[]> | null = null;

// High-resolution Natural Earth 10 m countries-with-lakes-deducted geojson
// served by jsDelivr.  Loaded *progressively* after the bundled 50 m file
// renders, so first paint stays fast and accuracy improves once it arrives.
//
// What 10 m gets us:
//   • Rotterdam's Nieuwe Waterweg + Maasvlakte show as water (not land)
//   • Amsterdam's North Sea Canal + IJsselmeer correctly cut out
//   • Schelde estuary up to Antwerp is water
//   • Wadden Sea, Belt Sea, fjords, etc. — visible
//   • Most port approaches no longer cover live AIS vessels.
const GEO_JSON_10M_URL = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries_lakes.geojson";

let geoJsonHighResLoaded  = false;
let geoJsonHighResPromise: Promise<Feature[]> | null = null;

/**
 * Normalize Natural Earth properties so downstream lookups always have an
 * ISO_A2 to key on.  Natural Earth's 10m file uses ISO_A2_EH (the
 * "with-Hong-Kong/Estonia-edge-cases" variant) in newer releases, so we
 * promote that when ISO_A2 is missing or the "-99" sovereignty sentinel.
 */
function normalizeFeatureProperties(features: Feature[]): Feature[] {
  return features
    .map((f) => {
      const props = f.properties;
      if (!props.ISO_A2 || props.ISO_A2 === "-99") {
        const eh = props.ISO_A2_EH;
        if (eh && eh !== "-99") props.ISO_A2 = eh;
      }
      if (props.ISO_A2 === "-99") {
        const override = ISO_OVERRIDES[props.ADMIN];
        if (override) props.ISO_A2 = override;
      }
      return f;
    })
    .filter((f) => f.properties.ISO_A2 !== "AQ");
}

function loadGeoJson(): Promise<Feature[]> {
  if (geoJsonCache) return Promise.resolve(geoJsonCache);
  if (!geoJsonPromise) {
    geoJsonPromise = fetch(geoJsonUrl)
      .then((r) => r.json())
      .then((data) => {
        const features = normalizeFeatureProperties(data.features);
        geoJsonCache = features;
        return features;
      });
  }
  return geoJsonPromise;
}

/**
 * Progressive upgrade — fetch the 10 m polygon set and replace the cache.
 * Called after the 50 m render is on screen so first paint is unaffected.
 * Silently retries on next mount if the fetch fails (no network, etc.).
 */
function loadGeoJsonHighRes(): Promise<Feature[]> {
  if (geoJsonHighResLoaded && geoJsonCache) return Promise.resolve(geoJsonCache);
  if (!geoJsonHighResPromise) {
    geoJsonHighResPromise = fetch(GEO_JSON_10M_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`10m geojson HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const features = normalizeFeatureProperties(data.features);
        geoJsonCache         = features;  // upgrade cache — next mount uses 10m directly
        geoJsonHighResLoaded = true;
        return features;
      })
      .catch((err) => {
        console.warn('[GlobeView] 10m geojson upgrade failed, keeping 50m:', err);
        geoJsonHighResPromise = null; // allow retry on next mount
        throw err;
      });
  }
  return geoJsonHighResPromise;
}

export default function GlobeView({
  width,
  height,
  mode,
  performanceMap,
  selectedCountry,
  onCountryClick,
  showExchangePins = false,
  onExchangeClick,
  selectedExchange,
  autoRotate = true,
  tradePoints,
  tradeArcs,
  selectedTradeNodeId,
  onTradeNodeClick,
  liveVessels,
  liveFlights,
  conflictEvents,
  onConflictEventClick,
  earthquakeEvents,
  onEarthquakeEventClick,
  economicEvents,
  onEconomicEventClick,
  macroHeatmap,
  showCityLabels    = false,
  showWaterways     = false,
  dayNightCycle     = false,
  showCountryColors = true,
  partnerArcs,
}: GlobeViewProps) {
  // Mirror autoRotate prop into a ref so the idle-timer callback (created
  // once inside a stable useEffect) can read the latest value without
  // having to re-subscribe whenever the prop changes.
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // Cached references to the globe's PhongMaterial and its compiled shader so
  // the altitude poll can adjust bumpScale (uniform) and uSharpness (custom
  // uniform we inject via onBeforeCompile) at close zoom without re-querying
  // through react-globe.gl on every tick.
  const globeMatRef    = useRef<THREE.MeshPhongMaterial | null>(null);
  // `shader` parameter passed to onBeforeCompile is internal three.js plumbing —
  // its exact TS type changes across versions, so we type it loosely here.
  const globeShaderRef = useRef<{ uniforms: Record<string, { value: any }> } | null>(null);
  // Same for the cloud sphere — its material is patched with the day/night
  // block so clouds darken on the night hemisphere too (otherwise the bright
  // 40 %-opacity cloud cover would dilute the globe's darkening).
  const cloudShaderRef = useRef<{ uniforms: Record<string, { value: any }> } | null>(null);
  const [countries, setCountries] = useState<Feature[]>(geoJsonCache ?? []);

  // ── Lazy high-fidelity asset gate ─────────────────────────────────────
  // Three heavy progressive upgrades — 10m country polygons (~24 MB),
  // 16K Earth texture (~8 MB), HQ cloud texture (~5 MB) — only matter
  // when the user is actually zoomed in close enough to perceive them.
  // For users who stay at the default world-view altitude (~2.5) they're
  // 37 MB of wasted bandwidth + permanently heavier GPU rasterisation.
  //
  // This flag flips from false → true the first time the user zooms in
  // past altitude 1.5 (roughly continent zoom).  Once true it stays
  // true so we don't oscillate: the upgrade is one-way.  Each upgrade
  // useEffect depends on this and bails when it's false.
  const [userZoomedIn, setUserZoomedIn] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  // Hover ISO stored in a ref — changes do NOT trigger React re-renders.
  // Instead, we imperatively poke the globe to re-evaluate colors.
  const hoverIsoRef = useRef<string | null>(null);
  const hoverRafRef = useRef<number>(0); // rAF handle for coalesced hover updates
  const draggingRef = useRef(false); // suppress hover during drag + coast
  const coastTimerRef = useRef<ReturnType<typeof setTimeout>>(); // delay hover re-enable until coast ends
  const handleHoverRef = useRef<((p: object | null) => void) | null>(null);
  const getLabelRef = useRef<((d: object) => string) | null>(null);

  // Load GeoJSON (instant if cached from prior mount)
  useEffect(() => {
    if (geoJsonCache) {
      setCountries(geoJsonCache);
      return;
    }
    loadGeoJson().then(setCountries).catch(console.error);
  }, []);

  // ── Rivers / lake centerlines (~2 MB, jsDelivr CDN) ─────────────────────
  // Lazily fetched on first enable of the Waterways layer toggle.  After the
  // initial download, the data is cached at module scope so subsequent
  // toggles (or remounts) reuse it instantly — no re-fetch, no flicker.
  // When the toggle is off and the cache is empty, we skip the request
  // entirely so users who never enable the layer pay zero network cost.
  const [rivers, setRivers] = useState<Feature[]>(riversCache ?? []);
  useEffect(() => {
    if (!showWaterways) return;          // wait until the user enables the layer
    if (riversCache) { setRivers(riversCache); return; }
    loadRivers().then(setRivers).catch(() => { /* warning logged in loader */ });
  }, [showWaterways]);

  // Reference to the rivers material so the altitude poll can adjust
  // linewidth and keep `resolution` in sync with the renderer's pixel size.
  // (LineMaterial in screen-pixel mode requires `resolution` to convert
  // its `linewidth` px value to NDC offsets in the vertex shader.)
  const riversMatRef = useRef<LineMaterial | null>(null);

  // Reference to the clouds mesh, set when the 4K cloud texture finishes
  // loading.  Used by the deferred HQ-cloud upgrade effect below so it
  // can hot-swap the texture once the user actually zooms in.
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);

  // ── Deferred HQ cloud texture upgrade ────────────────────────────────────
  // Lazy-loaded: only fires after the user has zoomed in past altitude 1.5.
  // The 4K cloud texture is already plenty for the default world view; the
  // HQ version (~5 MB extra download + 16 MB VRAM swap) only matters at
  // close zoom.  At default zoom each cloud puff covers < 1 screen pixel,
  // so the HQ resolution is invisible.
  useEffect(() => {
    if (!userZoomedIn) return;
    const mesh = cloudsMeshRef.current;
    if (!mesh) return;
    let cancelled = false;
    new THREE.TextureLoader().load(
      CLOUDS_TEXTURE_HQ_URL,
      (texHQ) => {
        if (cancelled || !cloudsMeshRef.current) { texHQ.dispose(); return; }
        const globe = globeRef.current;
        if (!globe) { texHQ.dispose(); return; }
        const renderer = globe.renderer();
        texHQ.anisotropy      = renderer.capabilities.getMaxAnisotropy();
        texHQ.minFilter       = THREE.LinearMipmapLinearFilter;
        texHQ.magFilter       = THREE.LinearFilter;
        texHQ.generateMipmaps = true;
        texHQ.needsUpdate     = true;
        const mat = cloudsMeshRef.current.material as THREE.MeshPhongMaterial;
        const old = mat.map;
        mat.map   = texHQ;
        mat.needsUpdate = true;
        old?.dispose();        // reclaim 4K VRAM
      },
      undefined,
      () => console.warn('[GlobeView] HQ cloud texture failed — keeping 4K'),
    );
    return () => { cancelled = true; };
  }, [userZoomedIn]);

  // ── Progressive polygon upgrade: 50m → 10m ───────────────────────────────
  // Lazy-loaded: only fires after the user actually zooms in past
  // altitude 1.5 (signalled via userZoomedIn).  At the default world view
  // the 50m dataset is plenty — switching to 10m would download ~24 MB
  // and ~5× more polygon vertices to render forever after, all for detail
  // the user can't see at that zoom level.  Once triggered, the upgrade
  // is one-way and 10m stays loaded for the rest of the session.
  //
  // 10m matters most when the AIS layer is on (vessels visually overlap
  // land in tight ports — Rotterdam, Antwerp, Hamburg).  AIS at default
  // zoom doesn't show that overlap clearly anyway, so deferring is safe.
  useEffect(() => {
    if (!countries.length)     return;     // wait for 50m to land first
    if (!userZoomedIn)         return;     // wait for zoom-in
    if (geoJsonHighResLoaded)  return;     // already upgraded
    loadGeoJsonHighRes()
      .then(setCountries)
      .catch(() => { /* keep 50m — warning already logged in loader */ });
  }, [countries.length, userZoomedIn]);

  // Setup auto-rotation + stop on interaction + resume after idle
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    let controls: any;
    let el: HTMLElement;
    try {
      controls = globe.controls();
      const renderer = globe.renderer();
      el = renderer.domElement;
      // Cap pixel ratio — 2 is visually identical to 3 but renders 2.25× fewer pixels
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      return;
    }
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 0.4;
    controls.enableDamping = true;
    controls.dampingFactor = 0.03; // low = long coast after release

    // ── Intercept globe.gl's per-frame controls.change listener ─────────
    // globe.gl registers a 'change' listener that fires every frame during
    // drag, running pointOfView() (trig math) + setPointOfView() (matrix
    // inversion + layer iteration). Skip it during drag — sync once on release.
    const origListeners: any[] = (controls as any)._listeners?.['change'] ?? [];
    const globeChangeHandler = origListeners[origListeners.length - 1]; // globe.gl adds last
    if (globeChangeHandler) {
      controls.removeEventListener('change', globeChangeHandler);
      controls.addEventListener('change', () => {
        if (draggingRef.current) return; // skip geo-coord math during drag
        globeChangeHandler();
      });
    }

    // Idle timer that ONLY restarts auto-rotate if the user isn't dragging
    // AND the autoRotate prop is currently enabled. Without these guards,
    // holding the mouse for >5s lets auto-rotate fight drag input, and
    // toggling the prop off doesn't take effect until the next interaction.
    const scheduleAutoRotateRestart = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (!draggingRef.current && autoRotateRef.current) controls.autoRotate = true;
      }, 5000);
    };

    const onPointerDown = (e: PointerEvent) => {
      // ── Pointer capture ──
      // Routes ALL subsequent pointer events for this pointer to the canvas,
      // even if the cursor moves outside its bounding box. Without this,
      // dragging past the right-half edge of the screen would fire pointerleave
      // and end the drag mid-motion, which feels like the globe "stopping".
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      // ── Cancel any in-progress camera tween ──
      // When the user clicks a country (panel or globe polygon), the fly-to
      // effect calls globe.pointOfView({...}, 800) — an 800ms tween. If the
      // user then click-drags the globe, that tween fights OrbitControls for
      // its remaining lifetime: the tween yanks the camera toward its target
      // every frame while drag input pushes it elsewhere. The visible result
      // is a ~500-800ms "stop/stutter" about 1 second into the drag — exactly
      // the tween's remaining duration. Re-issuing pointOfView at the current
      // (interpolated) POV with duration 0 supersedes the active tween and
      // hands camera control back to OrbitControls cleanly.
      const g = globeRef.current as any;
      if (g && typeof g.pointOfView === 'function') {
        try {
          const currentPov = g.pointOfView();
          if (currentPov) g.pointOfView(currentPov, 0);
        } catch { /* ignore — best-effort tween kill */ }
      }

      // Disable damping during drag → globe follows mouse 1:1, zero input lag
      controls.enableDamping = false;
      draggingRef.current = true;

      // Halt auto-rotate immediately; do NOT yet schedule its restart —
      // that happens on pointer-up so the 5s timer is anchored to release.
      controls.autoRotate = false;
      clearTimeout(idleTimer.current);
      clearTimeout(coastTimerRef.current);

      // Kill library-level raycasting + ALL pointer processing during drag.
      // Without this, every pointermove (100+/sec) triggers getBoundingClientRect()
      // layout reflow + ray-mesh intersection against 288 polygon meshes.
      if (g) {
        g.onPolygonHover(null);
        g.polygonLabel(null);
        g.enablePointerInteraction(false);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // Release pointer capture if we held it
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

      // Re-enable damping with low factor → remaining velocity becomes smooth coast
      controls.enableDamping = true;
      controls.dampingFactor = 0.03;

      // Sync POV state that was skipped during drag (rotateSpeed, layer POV, etc.)
      if (globeChangeHandler) globeChangeHandler();

      // Anchor the 5s idle timer to release, not press
      scheduleAutoRotateRestart();

      // Keep hover suppressed during coast so restored onPolygonHover doesn't
      // fire 177 polygon color rebuilds while the globe is still spinning.
      clearTimeout(coastTimerRef.current);
      coastTimerRef.current = setTimeout(() => {
        draggingRef.current = false;
        // Restore raycasting + pointer processing after coast settles
        const g = globeRef.current as any;
        if (g) {
          g.enablePointerInteraction(true);
          g.onPolygonHover(handleHoverRef.current);
          g.polygonLabel(getLabelRef.current);
        }
      }, 1500);
    };

    // Throttle wheel handler — runs at most once per 100ms to avoid
    // clearing/setting timeouts 60-120× per second during fast scrolls.
    // Also suppress hover during zoom coast.
    let lastWheelTime = 0;
    const wheelThrottled = () => {
      const now = performance.now();
      if (now - lastWheelTime < 100) return;
      lastWheelTime = now;
      draggingRef.current = true;
      clearTimeout(coastTimerRef.current);
      coastTimerRef.current = setTimeout(() => {
        draggingRef.current = false;
      }, 800);
      controls.autoRotate = false;
      scheduleAutoRotateRestart();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    // pointercancel covers cases where capture is lost involuntarily
    // (system gesture, browser interruption). pointerleave intentionally
    // OMITTED: with capture in place, leaving the canvas during a drag
    // must NOT terminate the gesture — the user is still pressing.
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", wheelThrottled, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", wheelThrottled);
      clearTimeout(idleTimer.current);
      clearTimeout(coastTimerRef.current);
    };
  }, [countries]);

  // ── Earth texture filtering (fixes pole-pinching streaks) ───────────
  // The Blue Marble equirectangular texture has all of its top row of
  // pixels mapped to a single geographic point at each pole. Without
  // anisotropic filtering, the GPU samples those rows at very oblique
  // angles using square sample kernels — too few samples along the
  // elongated axis, too many along the short axis — producing visible
  // radial streaks at the poles.
  //
  // The fix is: enable mipmaps + LinearMipmapLinearFilter (trilinear)
  // for shimmer-free minification, AND set max anisotropy so oblique
  // samples take many texture reads along the elongated direction.
  //
  // react-globe.gl loads its textures asynchronously inside its own
  // material, so we poll the material until the textures land, then
  // tweak filtering on each. Five polls at 200ms is the worst case.
  useEffect(() => {
    if (!countries.length) return;
    const globe = globeRef.current;
    if (!globe) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enhanceTexture = (tex: THREE.Texture, maxAniso: number) => {
      tex.anisotropy   = maxAniso;
      tex.minFilter    = THREE.LinearMipmapLinearFilter;
      tex.magFilter    = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate  = true;
    };

    const tryApply = () => {
      if (cancelled) return;
      let mat: THREE.MeshPhongMaterial | undefined;
      try { mat = globe.globeMaterial() as THREE.MeshPhongMaterial; } catch { mat = undefined; }
      if (!mat) {
        timeoutId = setTimeout(tryApply, 200);
        return;
      }

      const renderer = globe.renderer();
      const maxAniso = renderer.capabilities.getMaxAnisotropy();

      // mat.map / mat.bumpMap may be set but their image may not have
      // decoded yet — check `texture.image` to confirm readiness.
      const mapReady     = mat.map     && (mat.map     as THREE.Texture).image;
      const bumpMapReady = mat.bumpMap && (mat.bumpMap as THREE.Texture).image;

      if (mapReady)     enhanceTexture(mat.map!,     maxAniso);
      if (bumpMapReady) enhanceTexture(mat.bumpMap!, maxAniso);

      // Slight bump intensity boost so the now-sharper terrain bump
      // map reads better at this orbit distance.
      if (bumpMapReady) {
        mat.bumpScale = 6;
        mat.needsUpdate = true;
      }

      // Expose the material ref so the altitude poll can boost bumpScale
      // at close zoom — terrain shadows become more pronounced and the
      // surface feels less flat.
      globeMatRef.current = mat;

      if (!mapReady || !bumpMapReady) {
        timeoutId = setTimeout(tryApply, 200);
      }
    };

    tryApply();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      // Material is owned by react-globe.gl, don't dispose. Just drop our ref.
      globeMatRef.current = null;
    };
  }, [countries]);

  // ── Close-zoom quality enhancement (saturation + contrast shader patch) ──
  // The 16 K Blue Marble texture caps at ≈2.45 km per texel — at zoom levels
  // past Z 6.5 the user starts upscaling it, which reads as blur with washed
  // colours.  We can't add real detail, but we can add *perceived* quality:
  // boost saturation and contrast on the diffuse map at close zoom, driven
  // by a uSharpness uniform that the altitude poll ramps 0 → 1 across
  // Z 6.5 → 9.5.  Cost is one vector-math block in the fragment shader,
  // no extra texture samples, no recompiles per zoom change.
  useEffect(() => {
    if (!countries.length) return;
    const globe = globeRef.current;
    if (!globe) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const trySetup = () => {
      if (cancelled) return;
      let mat: THREE.MeshPhongMaterial | undefined;
      try { mat = globe.globeMaterial() as THREE.MeshPhongMaterial; } catch { mat = undefined; }
      if (!mat) { timeoutId = setTimeout(trySetup, 200); return; }

      // Compose with any previous onBeforeCompile (defensive — react-globe.gl
      // doesn't currently set one, but if it ever does, we don't want to
      // clobber it).
      const previous = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader) => {
        if (typeof previous === 'function') previous.call(mat!, shader);

        // Uniforms we control:
        //   uSharpness     — saturation / contrast boost at close zoom (0..1)
        //   uDayNightOn    — toggle for the real day/night darkening (0 or 1)
        //   uSunDirection  — unit vector pointing at the sun in world space,
        //                    updated every 30 s from UTC time + axial tilt
        shader.uniforms.uSharpness    = { value: 0 };
        shader.uniforms.uDayNightOn   = { value: 0 };
        shader.uniforms.uSunDirection = { value: new THREE.Vector3(0, 0, 1) };

        // Add a world-space-position varying so the fragment shader can compute
        // the surface normal for the sun-dot product.  For a sphere centred at
        // origin (which the globe is), normalize(worldPos) IS the surface
        // normal — no need for a separate normal varying.
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            varying vec3 vGlobalPos;`,
          )
          .replace(
            'void main() {',
            `void main() {
            vGlobalPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
          );

        // Prepend uniform / varying declarations, then inject the colour-boost
        // and day/night blocks right after <map_fragment> (which sets
        // diffuseColor from the diffuse texture).
        // The saturation/contrast boost stays in <map_fragment> (pre-lighting)
        // because it's intentionally a tweak to the texture's diffuse colour.
        //
        // The day/night darkening is moved to AFTER lighting (just before
        // <colorspace_fragment> converts linear → sRGB) and AGAIN to be safe
        // we also patch after the colorspace chunk if it exists.  Operating
        // on the final lit colour bypasses three-globe's directional-light
        // setup, which is positioned at the camera and would otherwise
        // partially compensate for our darkening.  Multiplier 0.10 in
        // linear-space output ⇒ ≈30 % screen brightness on night side, plus
        // a deliberately bright warm glow at the terminator band.
        let frag = shader.fragmentShader;

        // ① Saturation/contrast tweak — keeps existing close-zoom behaviour.
        frag = frag.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          #ifdef USE_MAP
            vec3 _c = diffuseColor.rgb;
            float _lum = dot(_c, vec3(0.299, 0.587, 0.114));
            _c = mix(vec3(_lum), _c, 1.0 + uSharpness * 0.55);
            _c = (_c - 0.5) * (1.0 + uSharpness * 0.40) + 0.5;
            diffuseColor.rgb = clamp(_c, 0.0, 1.0);
          #endif
          `,
        );

        // ② Day/night darkening — applied to the FINAL lit colour, so the
        // directional / ambient lighting equation can't dilute it.  We try
        // colorspace_fragment first (recent three.js), then encodings_fragment
        // (older three.js), then fall back to opaque_fragment / tonemapping.
        // If NONE of those anchors match (some forks of three.js, or future
        // chunk renames), fall back to a guaranteed last-brace injection so
        // the patch ALWAYS lands somewhere reasonable.
        //
        // Multiplier 0.04 = night hemisphere ≈ 4% screen brightness — very
        // dark, unmistakably "night."  Combined with the cloud-material
        // patch (see cloud-layer effect), the entire night side dims
        // strongly without being washed out by bright cloud cover.
        const dayNightBlock = `
          if (uDayNightOn > 0.5) {
            vec3 _n = normalize(vGlobalPos);
            float _sunDot = dot(_n, uSunDirection);
            float _dayMix = smoothstep(-0.10, 0.18, _sunDot);
            gl_FragColor.rgb *= mix(0.04, 1.0, _dayMix);
            // Cool blue-grey moonlight tint on deep-night side
            float _nightOnly = 1.0 - smoothstep(-0.05, 0.05, _sunDot);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.45, 0.55, 0.85), _nightOnly * 0.6);
            // Warm sunset glow at the terminator band
            float _term = 1.0 - smoothstep(0.0, 0.20, abs(_sunDot));
            gl_FragColor.rgb += vec3(0.65, 0.28, 0.06) * _term * 0.65;
            gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
          }
        `;
        const anchors = [
          '#include <colorspace_fragment>',
          '#include <encodings_fragment>',
          '#include <opaque_fragment>',
          '#include <tonemapping_fragment>',
        ];
        let injectedVia = '';
        for (const anchor of anchors) {
          if (frag.indexOf(anchor) !== -1) {
            frag = frag.replace(anchor, `${anchor}\n${dayNightBlock}`);
            injectedVia = anchor;
            break;
          }
        }
        if (!injectedVia) {
          // Guaranteed-fallback: inject before the LAST `}` of the shader
          // (the closing brace of main()).  This is brittle to format
          // changes but works on any standard glsl fragment shader.
          const lastBrace = frag.lastIndexOf('}');
          if (lastBrace !== -1) {
            frag = frag.slice(0, lastBrace) + dayNightBlock + '\n}' + frag.slice(lastBrace + 1);
            injectedVia = 'last-brace fallback';
          }
        }
        // One-time diagnostic — toggle Day/Night, open the browser console,
        // and look for this line.  If it doesn't print, onBeforeCompile
        // wasn't fired (shader recompile didn't happen).  If it prints with
        // empty injectedVia, no anchor matched and the fallback wasn't
        // attempted (fragment had no `}` somehow).
        console.info('[Day/Night] globe shader patched, day/night block injected via:', injectedVia || 'NONE');

        shader.fragmentShader =
          'uniform float uSharpness;\n' +
          'uniform float uDayNightOn;\n' +
          'uniform vec3  uSunDirection;\n' +
          'varying vec3  vGlobalPos;\n' +
          frag;
        // Stash the compiled shader so the altitude poll can update uniforms.
        globeShaderRef.current = shader;
      };
      // Force a re-compile so onBeforeCompile is invoked on the next frame.
      mat.needsUpdate = true;
    };

    trySetup();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      globeShaderRef.current = null;
    };
  }, [countries]);

  // ── Day/night cycle driver ───────────────────────────────────────────────
  // When `dayNightCycle` is true, refresh the sun direction every 30 s from
  // the current UTC time + axial-tilt approximation, flip the shader's
  // uDayNightOn uniform on, AND bump `sunTick` so getCapColor recomputes
  // each country's cap-alpha based on its centroid sun-dot.  Mutating
  // uniforms is free — three.js pushes the new values to the GPU on the
  // next draw without a recompile.
  //
  // `sunDir` (the cached Vector3 used in getCapColor for per-country
  // darkening) is recomputed from a useMemo below, keyed on (dayNightCycle,
  // sunTick), so a single state bump refreshes both the shader and the
  // polygon-cap colours.
  const [sunTick, setSunTick] = useState(0);

  useEffect(() => {
    const shader = globeShaderRef.current;

    const writeUniform = (s: typeof shader) => {
      if (!s?.uniforms?.uDayNightOn) return;
      s.uniforms.uDayNightOn.value = dayNightCycle ? 1 : 0;
      if (dayNightCycle) computeSunDirection(s.uniforms.uSunDirection.value);
    };

    // If the shader isn't compiled yet, retry once shortly.  The next time
    // `dayNightCycle` changes we'll succeed on the first attempt.
    if (!shader?.uniforms?.uDayNightOn) {
      const retry = setTimeout(() => writeUniform(globeShaderRef.current), 400);
      return () => clearTimeout(retry);
    }

    writeUniform(shader);
    // Force a polygon-cap colour pass so per-country dimming applies
    // immediately on toggle (whether on or off).
    setSunTick((t) => t + 1);
    if (!dayNightCycle) return;

    // Recurring refresh every 5 minutes.  Sun moves 15°/hour = 1.25°/5min,
    // still well inside the shader terminator's smooth band so the visual
    // jump is imperceptible.  Previous 30 s cadence triggered a polygon-cap
    // recompute (setSunTick → getCapColor) 120× per hour for negligible
    // visual gain — bumping to 5 min cuts that to 12×/hour while the
    // shader's own uniform-only writes (in the 500 ms poll) keep the
    // terminator visually smooth.
    const id = setInterval(() => {
      writeUniform(globeShaderRef.current);
      setSunTick((t) => t + 1);
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [dayNightCycle]);

  // Cached sun direction for the JS-side polygon-cap dimming pass.  Kept
  // separate from the shader uniform because getCapColor is a useCallback
  // that needs a stable React dependency to know when to rebuild.
  const sunDirCached = useMemo(() => {
    if (!dayNightCycle) return null;
    const v = new THREE.Vector3();
    computeSunDirection(v);
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNightCycle, sunTick]);

  // ── Progressive 16K texture upgrade ──────────────────────────────────────
  // Lazy-loaded: only fires after the user has zoomed in (userZoomedIn).
  // At default world view the 8K texture is visually indistinguishable from
  // 16K because each pixel covers many texels; the 16K upgrade is purely a
  // close-zoom benefit and costs 8 MB of bandwidth + GPU VRAM upfront.
  //
  // The 8K diffuse map loads fast and gives a good initial look.  Once the
  // user zooms in past altitude 1.5 we fetch the 16K version (~8 MB) in the
  // background.  When it arrives we apply the same anisotropic + trilinear
  // filtering and swap material.map in one frame — no flicker.  The
  // superseded 8K texture is disposed to free ~8 MB of GPU VRAM.
  useEffect(() => {
    if (!countries.length) return;
    if (!userZoomedIn) return;
    let cancelled  = false;
    let retryId:    ReturnType<typeof setTimeout>;
    let pendingTex: THREE.Texture | null = null;
    let applied     = false;

    const trySwap = (tex: THREE.Texture) => {
      if (cancelled) { if (!applied) tex.dispose(); return; }

      const globe = globeRef.current;
      if (!globe) { retryId = setTimeout(() => trySwap(tex), 400); return; }

      let mat: THREE.MeshPhongMaterial | undefined;
      try { mat = globe.globeMaterial() as THREE.MeshPhongMaterial; } catch {
        retryId = setTimeout(() => trySwap(tex), 400);
        return;
      }

      // Wait until react-globe.gl has decoded and applied the 8K base map.
      // Checking `.image` confirms the texture is fully resident on the GPU.
      if (!mat?.map?.image) { retryId = setTimeout(() => trySwap(tex), 400); return; }

      const renderer = globe.renderer();
      tex.anisotropy      = renderer.capabilities.getMaxAnisotropy();
      tex.minFilter       = THREE.LinearMipmapLinearFilter;
      tex.magFilter       = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate     = true;

      const old = mat.map;
      mat.map = tex;
      mat.needsUpdate = true;
      applied = true;
      old?.dispose(); // reclaim 8K VRAM — material now owns the 16K texture
    };

    new THREE.TextureLoader().load(
      EARTH_TEXTURE_16K_URL,
      (tex) => { pendingTex = tex; trySwap(tex); },
      undefined,
      () => console.warn('[GlobeView] 16K texture failed to load — keeping 8K'),
    );

    return () => {
      cancelled = true;
      clearTimeout(retryId);
      if (pendingTex && !applied) pendingTex.dispose();
    };
  }, [countries.length, userZoomedIn]);

  // ── Waterway layer (rivers + lake centerlines) ───────────────────────
  // Renders Natural Earth's 10 m rivers as a single Three.js LineSegments
  // mesh.  Sits above the country polygons (renderOrder 1) and below the
  // live AIS vessel dots, so ships appear directly over the blue river
  // they're broadcasting from.  One draw call for every river worldwide —
  // packing all segments into a single position buffer keeps GPU cost
  // negligible regardless of feature count.
  //
  // Lat/lng → Cartesian uses the same polar2Cartesian convention as
  // vessels/flights/trade points so all layers align perfectly on the
  // sphere.  Altitude 1.006 sits just above polygon caps (1.005) and
  // just below vessels (1.0055), so ships render on top of the rivers
  // they're navigating.
  useEffect(() => {
    if (!showWaterways) return;          // gated by panel toggle
    if (!countries.length || !rivers.length) return;
    const globe = globeRef.current;
    if (!globe) return;

    // Count segments first so we can allocate a single Float32Array
    // (avoids array growth + final copy when we have ~thousands of
    // small LineStrings).
    let segCount = 0;
    for (const f of rivers) {
      const g = f.geometry as any;
      if (g.type === 'LineString') {
        segCount += Math.max(0, g.coordinates.length - 1);
      } else if (g.type === 'MultiLineString') {
        for (const ls of g.coordinates) segCount += Math.max(0, ls.length - 1);
      }
    }
    if (segCount === 0) return;

    const radius    = globe.getGlobeRadius() * 1.006;
    const positions = new Float32Array(segCount * 6); // 2 endpoints × xyz
    let i = 0;

    const addPoint = (lng: number, lat: number) => {
      const phi    = (90 - lat) * (Math.PI / 180);
      const theta  = (90 - lng) * (Math.PI / 180);
      const sinPhi = Math.sin(phi);
      positions[i++] = radius * sinPhi * Math.cos(theta);
      positions[i++] = radius * Math.cos(phi);
      positions[i++] = radius * sinPhi * Math.sin(theta);
    };

    const addLineString = (coords: [number, number][]) => {
      for (let k = 0; k < coords.length - 1; k++) {
        addPoint(coords[k][0],     coords[k][1]);
        addPoint(coords[k + 1][0], coords[k + 1][1]);
      }
    };

    for (const f of rivers) {
      const g = f.geometry as any;
      if (g.type === 'LineString') {
        addLineString(g.coordinates);
      } else if (g.type === 'MultiLineString') {
        for (const ls of g.coordinates) addLineString(ls);
      }
    }

    // LineSegmentsGeometry expects a flat Float32Array of [x,y,z,x,y,z,...]
    // where every consecutive pair of triplets defines one segment — exactly
    // the layout we already built above.
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);

    // Sky-blue, semi-transparent so country shading still reads through.
    // worldUnits: false → linewidth interpreted in *screen pixels*.  This
    // gives us a constant-on-screen thickness at any zoom by default; the
    // altitude poll (below) bumps the linewidth in discrete buckets only
    // when the user zooms in close, so the rivers stay subtle most of the
    // time and thicken visibly when inspecting a region.  resolution must
    // be kept in sync with the renderer's pixel size for this mode to
    // measure pixels correctly.
    const material = new LineMaterial({
      color:       0x60a5fa, // blue-400
      linewidth:   1.2,      // screen px — default thin look
      worldUnits:  false,
      transparent: true,
      opacity:     0.55,
      depthWrite:  false,
    });
    try {
      const size = new THREE.Vector2();
      globe.renderer().getSize(size);
      material.resolution.copy(size);
    } catch { /* renderer not ready yet — refreshed by altitude poll */ }

    riversMatRef.current = material; // expose to altitude-poll for width/resize updates

    const lines = new LineSegments2(geometry, material);
    lines.renderOrder = 1; // above polygon caps (default 0), below vessels (2)
    globe.scene().add(lines);

    return () => {
      try { globe.scene().remove(lines); } catch { /* scene already gone */ }
      geometry.dispose();
      material.dispose();
      riversMatRef.current = null;
    };
  }, [rivers, countries.length, showWaterways]);

  // ── Cloud layer ─────────────────────────────────────────────────────
  // Renders a slightly-larger transparent sphere over the Blue Marble globe
  // with an animated slow rotation, simulating the appearance of a real
  // satellite view with cloud cover.
  //
  // Implementation: imperatively add a Three.js mesh to the globe's scene
  // graph (react-globe.gl exposes scene() for this kind of customization).
  // Lives independently of the main globe's rotation so clouds drift across
  // continents instead of locking to the surface.
  //
  // Cleanup: on unmount we remove the mesh, dispose the geometry/material/
  // texture, and cancel the rAF loop — required to avoid GPU memory leaks
  // on hot-reload and route changes.
  useEffect(() => {
    if (!countries.length) return; // wait for the globe to be mounted
    const globe = globeRef.current;
    if (!globe) return;

    let cloudsMesh: THREE.Mesh | null = null;
    let cloudsTexture: THREE.Texture | null = null;
    let rafId = 0;
    let cancelled = false;

    new THREE.TextureLoader().load(
      CLOUDS_TEXTURE_URL,
      (texture) => {
        if (cancelled) { texture.dispose(); return; }
        // Same pole-streak prevention as the earth diffuse/bump textures —
        // anisotropic + mipmapped + trilinear filtering. Cloud equirect is
        // also pinched at the poles, so without these the cloud layer alone
        // would still show radial streaks even after the earth fix lands.
        const renderer = globe.renderer();
        texture.anisotropy      = renderer.capabilities.getMaxAnisotropy();
        texture.minFilter       = THREE.LinearMipmapLinearFilter;
        texture.magFilter       = THREE.LinearFilter;
        texture.generateMipmaps = true;
        cloudsTexture = texture;
        const radius = globe.getGlobeRadius();
        // Altitude 0.025 (radius × 1.025) is chosen to sit clearly above
        // the default unselected polygon cap altitude (0.005) AND below
        // the selected-country highlight altitude (0.030) — so clouds
        // float over normal countries but the highlighted country still
        // pokes above the cloud layer for emphasis. The 0.020 separation
        // from polygon caps is enough z-distance to defeat 24-bit depth
        // buffer precision; smaller gaps cause z-fighting which renders
        // as the "jiggling" / "clipping in and out" the previous version
        // showed at radius × 1.005 (which collided exactly with the
        // polygon altitude).
        const geometry = new THREE.SphereGeometry(radius * 1.025, 96, 96);
        const material = new THREE.MeshPhongMaterial({
          map:          texture,
          transparent:  true,
          opacity:      0.40,
          depthWrite:   false, // transparent → don't write depth, only test
          depthTest:    true,
        });

        // Patch the cloud material with the same day/night logic as the
        // globe.  Without this, the 40 %-opacity cloud cover at full
        // brightness would dilute the globe's night-side darkening to a
        // washed ~46 % screen brightness — defeating the purpose.
        // Sharing the same vGlobalPos varying + uniform names with the
        // globe shader keeps the day/night logic identical for both.
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uDayNightOn   = { value: 0 };
          shader.uniforms.uSunDirection = { value: new THREE.Vector3(0, 0, 1) };
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              `#include <common>
              varying vec3 vGlobalPos;`,
            )
            .replace(
              'void main() {',
              `void main() {
              vGlobalPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
            );

          const cloudDayNightBlock = `
            if (uDayNightOn > 0.5) {
              vec3 _n = normalize(vGlobalPos);
              float _sunDot = dot(_n, uSunDirection);
              float _dayMix = smoothstep(-0.10, 0.18, _sunDot);
              // Clouds darken slightly less aggressively than the globe so
              // they remain visible as faint night clouds rather than
              // vanishing entirely (more realistic).
              gl_FragColor.rgb *= mix(0.08, 1.0, _dayMix);
              // Cool blue-grey moonlight tint
              float _nightOnly = 1.0 - smoothstep(-0.05, 0.05, _sunDot);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.5, 0.6, 0.85), _nightOnly * 0.5);
              gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
            }
          `;
          let cloudFrag = shader.fragmentShader;
          const cloudAnchors = [
            '#include <colorspace_fragment>',
            '#include <encodings_fragment>',
            '#include <opaque_fragment>',
            '#include <tonemapping_fragment>',
          ];
          let cInjected = '';
          for (const a of cloudAnchors) {
            if (cloudFrag.indexOf(a) !== -1) {
              cloudFrag = cloudFrag.replace(a, `${a}\n${cloudDayNightBlock}`);
              cInjected = a;
              break;
            }
          }
          if (!cInjected) {
            const lb = cloudFrag.lastIndexOf('}');
            if (lb !== -1) {
              cloudFrag = cloudFrag.slice(0, lb) + cloudDayNightBlock + '\n}' + cloudFrag.slice(lb + 1);
              cInjected = 'last-brace fallback';
            }
          }
          shader.fragmentShader =
            'uniform float uDayNightOn;\n' +
            'uniform vec3  uSunDirection;\n' +
            'varying vec3  vGlobalPos;\n' +
            cloudFrag;
          cloudShaderRef.current = shader;
          console.info('[Day/Night] cloud shader patched, day/night block injected via:', cInjected || 'NONE');
        };
        material.needsUpdate = true;

        cloudsMesh = new THREE.Mesh(geometry, material);
        cloudsMesh.renderOrder = 1; // draw after the globe + polygon caps
        globe.scene().add(cloudsMesh);

        // Slow cloud drift (~1 full rotation per ~9 minutes). Uses an
        // absolute-time formula rather than `+= dt * speed`. Reasons:
        //   - Avoids frame-to-frame drift accumulation from float imprecision.
        //   - Keeps cloud position purely a function of wall-clock time,
        //     so a tab pause + resume doesn't cause a sudden cloud jump.
        const startTime = performance.now();
        // 50 % slower than the original 0.000012 rad/ms — clouds now complete
        // one rotation in ~18 min instead of ~9 min.  Quieter, less attention-
        // grabbing while still conveying that the planet is "alive".
        const ROT_SPEED = 0.000006; // radians per millisecond
        const tick = () => {
          if (!cloudsMesh) return;
          cloudsMesh.rotation.y = (performance.now() - startTime) * ROT_SPEED;
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        // ── Progressive cloud upgrade — DEFERRED ───────────────────────────
        // Previously fired here unconditionally, downloading ~5 MB the moment
        // the 4K cloud mesh existed.  Now extracted to a separate effect
        // gated on `userZoomedIn` (see HQ cloud upgrade effect below).  At
        // the default world view, the 4K texture is visually indistinguishable
        // from HQ — the upgrade only matters when the camera is close.
        cloudsMeshRef.current = cloudsMesh;
      },
      undefined,
      (err) => console.warn("Failed to load cloud texture:", err),
    );

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (cloudsMesh) {
        try { globe.scene().remove(cloudsMesh); } catch { /* scene already torn down */ }
        cloudsMesh.geometry.dispose();
        (cloudsMesh.material as THREE.Material).dispose();
      }
      if (cloudsTexture) cloudsTexture.dispose();
      cloudShaderRef.current = null;
    };
  }, [countries]);

    // ── Live AIS vessels (imperative three.js Points layer) ──────────────
  // Performance split: material is created ONCE on mount and reused across
  // all vessel updates. PointsMaterial creation triggers GLSL shader
  // compilation — doing it every 2-second AIS flush was the source of the
  // render-thread stutter. Geometry (positions array) is cheap to recreate.
  //
  // Altitude 1.008 sits above the trade-path layer (1.006).
  const vesselMeshRef = useRef<THREE.Points | null>(null);
  const vesselMatRef  = useRef<THREE.PointsMaterial | null>(null);

  // Create the material once when the globe is ready; dispose on unmount.
  useEffect(() => {
    if (!countries.length) return;
    const mat = new THREE.PointsMaterial({
      // White base — per-vertex `color` attribute on the geometry drives the
      // actual hue per vessel (set by navStatus).  Without vertexColors, all
      // dots would be tinted by this uniform; with vertexColors=true the
      // shader multiplies vertex color × material color, so white means
      // "pass the vertex color through unchanged."
      color:           0xffffff,
      vertexColors:    true,
      size:            3.5,      // screen px at default zoom (fixed baseline)
      sizeAttenuation: false,
      transparent:     true,
      opacity:         0.9,
      depthWrite:      false,
    });

    // Gentle zoom-aware size boost via shader patch.
    // Full sizeAttenuation (linear 1/distance) is too aggressive — dots balloon
    // when zoomed in. Instead we inject a clamped 0–30% additive boost that
    // only activates as camDist drops below 300 world-units (≈ full-globe view).
    // Zoomed out (dist ≥ 300): 0% boost → 3.5 px.
    // Zoomed in  (dist ≤ ~130): 30% boost → ~4.5 px.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        `gl_PointSize = size;
        {
          vec3  wPos  = (modelMatrix * vec4(position, 1.0)).xyz;
          float dist  = length(cameraPosition - wPos);
          float boost = clamp((300.0 - dist) / 300.0, 0.0, 0.3);
          gl_PointSize *= (1.0 + boost);
        }`,
      );
    };
    vesselMatRef.current = mat;
    return () => {
      mat.dispose();
      vesselMatRef.current = null;
    };
  }, [countries.length]);

  // Update geometry whenever the vessel list changes — reuse the material.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !countries.length || !vesselMatRef.current) return;

    // Remove the old mesh (geometry only — material stays alive).
    if (vesselMeshRef.current) {
      try { globe.scene().remove(vesselMeshRef.current); } catch { /* scene gone */ }
      vesselMeshRef.current.geometry.dispose();
      vesselMeshRef.current = null;
    }

    if (!liveVessels || liveVessels.length === 0) return;

    // Altitude 1.0055 — sits just barely above the country polygon cap
    // layer at 1.005 (so vessels aren't depth-occluded by colored fills)
    // while staying close enough to the surface that parallax against
    // coastlines is invisible at typical oblique viewing angles.
    // Was previously 1.008 which produced a visible 3D offset between
    // vessel dots and the land masses beneath them.
    const radius = globe.getGlobeRadius() * 1.0055;
    const positions = new Float32Array(liveVessels.length * 3);
    // Tier 1: per-vertex colour from NavigationalStatus.  Float32 RGB, 3 floats per
    // vertex.  Material has vertexColors:true, so the shader uses these values
    // directly (multiplied by the white material colour ⇒ vertex color passthrough).
    const colors    = new Float32Array(liveVessels.length * 3);
    const tmpColor  = new THREE.Color();

    // Spherical (lat, lng) → Cartesian — MUST match globe.gl's internal
    // polar2Cartesian (node_modules/globe.gl/dist/globe.gl.js:63859),
    // since that is what positions all the library-rendered objects
    // (countries, trade points, arcs).  Diverging gives a Y-axis
    // rotation that looks correct on first glance but places NYC where
    // Cairo should be, etc.
    //   φ = (90 − lat) · π/180   (colatitude)
    //   θ = (90 − lng) · π/180
    //   x =  r sinφ cosθ,   y = r cosφ,   z = r sinφ sinθ
    for (let i = 0; i < liveVessels.length; i++) {
      const v = liveVessels[i];
      const phi    = (90 - v.lat) * (Math.PI / 180);
      const theta  = (90 - v.lng) * (Math.PI / 180);
      const sinPhi = Math.sin(phi);
      positions[i * 3]     = radius * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);

      // Per-vessel colour from nav status (THREE.Color.setHex normalises 0xRRGGBB → 0-1 floats)
      tmpColor.setHex(navStatusColorHex(v.navStatus));
      colors[i * 3]     = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const points = new THREE.Points(geometry, vesselMatRef.current);
    points.renderOrder = 2;
    globe.scene().add(points);
    vesselMeshRef.current = points;

    return () => {
      if (vesselMeshRef.current) {
        try { globe.scene().remove(vesselMeshRef.current); } catch { /* ignore */ }
        vesselMeshRef.current.geometry.dispose();
        vesselMeshRef.current = null;
        // Note: material is NOT disposed here — vesselMatRef effect owns it.
      }
    };
  }, [liveVessels, countries.length]);

  // ── Live flights (OpenSky) — same two-effect pattern as vessels ───────
  // Material: purple (#a855f7), altitude 1.010 (above vessels at 1.008).
  // Size 2.5 px — slightly smaller than vessels since there are ~10k flights.
  const flightMeshRef = useRef<THREE.Points | null>(null);
  const flightMatRef  = useRef<THREE.PointsMaterial | null>(null);

  // ── Stable data refs for the hover raycaster ────────────────────────────
  // Plain refs, never cause re-renders. Written every render so the raycaster
  // always reads the latest vessel/flight arrays without needing them in
  // a useEffect dependency array (which would recreate the listener too often).
  // We MUST pass through the raw liveVessels here — the raycaster reads
  // `liveVesselsRef.current[hit.index]` and the geometry was built from the
  // same untouched list, so any filtering at this layer would desync indices.
  // The "ships over land" visual issue is solved at the rendering layer
  // (polygon zoom-fade), not by filtering or moving vessel data.
  const liveVesselsRef = useRef<Vessel[] | undefined>(undefined);
  liveVesselsRef.current = liveVessels;
  const liveFlightsRef  = useRef<Flight[] | undefined>(undefined);
  liveFlightsRef.current = liveFlights;

  // ── City labels: shown only when zoomed in below altitude 1.2 ────────────
  // Polling at 300ms is cheap — pointOfView() is a pure getter that reads
  // the OrbitControls spherical position; no GPU work involved.
  const [cityLabelsVisible, setCityLabelsVisible] = useState(false);

  // Scale bar overlay state: width in screen pixels and the printable label.
  // Updated from the altitude poll using the camera's actual FOV + the
  // renderer's pixel size, so it stays accurate across window resizes.
  const [scaleBar, setScaleBar] = useState<{ widthPx: number; label: string }>(
    { widthPx: 100, label: '5,000 km' },
  );

  // Web-map convention zoom level (Z 0 = whole world in 256 px; each
  // integer doubles resolution).  Derived from the same kmPerPx value as
  // the scale bar, so the two displays are always coherent.
  const [zoom, setZoom] = useState<number>(3);

  // Reusable Vector2 — hoisted out of the poll body so we don't allocate
  // a fresh THREE.Vector2 every tick (was creating ~120 garbage objects
  // per minute, putting needless pressure on the JS GC).
  const pollSize = useRef(new THREE.Vector2()).current;

  useEffect(() => {
    // Poll cadence: 500 ms.  Was 300 ms which produced 200 wake-ups/min
    // of mostly-noop work even when the user wasn't interacting.  At
    // 500 ms the scale-bar / zoom / shader-uniform updates still feel
    // instant during a drag, but idle CPU usage drops ~40%.
    const id = setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;
      const alt = (globe as any)?.pointOfView()?.altitude;
      if (alt == null || alt <= 0) return;

      setCityLabelsVisible(alt < 1.2);

      // Flip the high-fidelity-assets gate when the user first zooms in.
      // Once true it stays true — the upgrades run once and the higher-
      // res assets are kept for the rest of the session.
      if (alt < 1.5) {
        setUserZoomedIn(prev => prev || true);
      }

      // ── River line thickness (bucketed) ─────────────────────────────────
      // Stay at the default "thin" width until the user has zoomed in
      // moderately, then step up in 3 visible levels.  Discrete buckets
      // avoid a continuous-scaling appearance that the user said felt
      // wrong; thresholds chosen so the line stays subtle at full-country
      // view (alt ~1) and only thickens for close inspection.
      const mat = riversMatRef.current;
      if (mat) {
        const lw = alt >= 0.5 ? 1.2
                 : alt >= 0.2 ? 2.5
                 :              4;
        if (mat.linewidth !== lw) mat.linewidth = lw;
        // Keep resolution in sync with the canvas — handles window resizes
        // without needing a separate ResizeObserver.
        globe.renderer().getSize(pollSize);
        if (mat.resolution.x !== pollSize.x || mat.resolution.y !== pollSize.y) {
          mat.resolution.copy(pollSize);
        }
      }

      // ── Scale bar ───────────────────────────────────────────────────────
      // Convert "1 pixel" to km at the centre of the visible globe surface,
      // then pick the largest nice round km value that fits in ~100 px.
      const camera = (globe as any).camera?.() as THREE.PerspectiveCamera | undefined;
      if (!camera) return;
      // Reuse the hoisted pollSize Vector2 (already filled above for rivers,
      // or filled here if rivers weren't active this tick).
      globe.renderer().getSize(pollSize);
      // Globe radius is 100 world units in three-globe; camera-to-surface
      // distance is therefore 100 * altitude.  px-per-globe-unit at that
      // distance follows directly from the perspective formula.
      const cotHalfFov = 1 / Math.tan((camera.fov * Math.PI) / 360);
      const cameraToSurface = 100 * alt;
      const pxPerGlobeUnit = (cotHalfFov * pollSize.y) / 2 / cameraToSurface;
      // Earth radius (6371 km) over globe radius (100) ⇒ 63.71 km per unit.
      const kmPerPx = 63.71 / pxPerGlobeUnit;
      const targetKm = 100 * kmPerPx; // we aim for ≈100-px-wide bar
      const nice     = pickNiceScale(targetKm);
      const widthPx  = nice.km / kmPerPx;

      setScaleBar((prev) =>
        prev.label === nice.label && Math.abs(prev.widthPx - widthPx) < 1
          ? prev
          : { widthPx, label: nice.label },
      );

      // ── Zoom level (web-map convention) ─────────────────────────────────
      // Z = log2(EarthCircumference / (256 × kmPerPx)).  Same kmPerPx as
      // the scale bar — guaranteed coherent.  Reference values:
      //   Z 0 ≈ whole earth in a 256-px ribbon (kmPerPx ≈ 156.5)
      //   Z 5 ≈ continent           ( kmPerPx ≈ 4.9 )
      //   Z 10 ≈ large city         ( kmPerPx ≈ 0.15 )
      //   Z 15 ≈ neighborhood       ( kmPerPx ≈ 0.0048)
      const zoomLevel = Math.log2(40075 / (256 * kmPerPx));
      setZoom((prev) => Math.abs(prev - zoomLevel) < 0.05 ? prev : zoomLevel);

      // ── Close-zoom globe quality enhancement ────────────────────────────
      // At zoom levels past 6.5 the 16K Blue Marble texture is being
      // magnified (1 texel covers <2 km but each screen pixel is much
      // smaller), so it reads as blurry with washed-out colours.  Compensate
      // by ramping a single `uSharpness` uniform 0 → 1 across Z 6.5 → 9.5
      // (drives saturation + contrast boosts in the fragment shader), and
      // by lifting bumpScale 6 → 14 across the same range (terrain shadows
      // get deeper, the sphere reads less flat).  Both stop at the cap so
      // very-close zooms don't over-saturate or get cartoonish shadows.
      const SHARP_START = 6.5;
      const SHARP_FULL  = 9.5;
      const sharpT = Math.max(0, Math.min(1, (zoomLevel - SHARP_START) / (SHARP_FULL - SHARP_START)));

      const shader = globeShaderRef.current;
      if (shader?.uniforms?.uSharpness) {
        if (Math.abs(shader.uniforms.uSharpness.value - sharpT) > 0.01) {
          shader.uniforms.uSharpness.value = sharpT;
        }
      }

      const globeMat = globeMatRef.current;
      if (globeMat) {
        const BASE_BUMP = 6;
        const MAX_BUMP  = 14;
        const targetBump = BASE_BUMP + (MAX_BUMP - BASE_BUMP) * sharpT;
        if (Math.abs(globeMat.bumpScale - targetBump) > 0.05) {
          globeMat.bumpScale = targetBump;
        }
      }

      // ── Live-flights size gradient ──────────────────────────────────────
      // Live flight dots are 2.5 px by default — barely visible at city
      // / regional zoom, where the user actually wants to read individual
      // aircraft.  Linearly grow the PointsMaterial.size from the baseline
      // up to ~6 px as the user zooms in across Z 6 → 10.  Below Z 6 the
      // size stays at baseline (don't bloat the dots at world view), and
      // above Z 10 it caps so very-close zooms don't get giant blobs.
      //
      // PointsMaterial.size is a uniform; mutating it propagates to the
      // shader on the next frame with zero CPU work per-point.
      const flightMat = flightMatRef.current;
      if (flightMat) {
        const BASE_SIZE  = 2.5;   // matches the material's original screen-px size
        const MAX_SIZE   = 6.0;   // cap at close zoom
        const ZOOM_START = 6.0;   // size begins to grow at this zoom level
        const ZOOM_FULL  = 10.0;  // and reaches MAX_SIZE here

        const t = Math.max(
          0,
          Math.min(1, (zoomLevel - ZOOM_START) / (ZOOM_FULL - ZOOM_START)),
        );
        const size = BASE_SIZE + (MAX_SIZE - BASE_SIZE) * t;

        if (Math.abs(flightMat.size - size) > 0.02) {
          flightMat.size = size;
        }
      }

      // ── Day/night uniforms — write every poll on BOTH the globe and the
      //    cloud shader.  Survives any shader recompile (the 16K texture
      //    upgrade re-fires onBeforeCompile, which resets uniforms).  At
      //    300 ms cadence the sun moves 0.0042 ° between writes — well below
      //    the terminator's smooth band.
      const writeDayNight = (s: typeof globeShaderRef.current) => {
        if (!s?.uniforms?.uDayNightOn) return;
        s.uniforms.uDayNightOn.value = dayNightCycle ? 1 : 0;
        if (dayNightCycle && s.uniforms.uSunDirection) {
          computeSunDirection(s.uniforms.uSunDirection.value);
        }
      };
      writeDayNight(globeShaderRef.current);
      writeDayNight(cloudShaderRef.current);
    }, 500);
    return () => clearInterval(id);
  }, [dayNightCycle, pollSize]);

  // Tooltip shown when the cursor is over a vessel or flight dot.
  // Uses position:fixed so it escapes the parent's overflow:hidden.
  const [hoverTip, setHoverTip] = useState<{
    clientX: number;
    clientY: number;
    kind:    'vessel' | 'flight';
    vessel?: Vessel;
    flight?: Flight;
  } | null>(null);

  useEffect(() => {
    if (!countries.length) return;
    const mat = new THREE.PointsMaterial({
      color:           0xa855f7, // purple-500
      size:            2.5,
      sizeAttenuation: false,
      transparent:     true,
      opacity:         0.85,
      depthWrite:      false,
    });

    /**
     * Hemisphere lazy-load via shader injection.
     *
     * Without this, all ~12,000 aircraft positions are rasterised every
     * frame even though half are behind the globe relative to the camera.
     * Three.js built-in depth testing alone is unreliable here because
     * the points use `transparent: true` + `depthWrite: false` and
     * `renderOrder: 3` to stay above other transparent overlays — that
     * combination lets back-side points "bleed through" the globe.
     *
     * The fix is a two-line patch to PointsMaterial's vertex shader:
     * after Three's standard `#include <project_vertex>` runs, we test
     * the dot product of (point-normal-from-globe-centre) and
     * (vector-from-point-to-camera).  Negative dot = point is on the
     * far hemisphere; we set gl_Position outside the clip volume so the
     * rasterizer discards it before fragment shading.
     *
     * Cost: zero JavaScript per frame.  Saves ~6,000 fragment-shader
     * invocations every frame at full OpenSky coverage.
     */
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec3 worldPos  = (modelMatrix * vec4(position, 1.0)).xyz;
          vec3 toCam     = normalize(cameraPosition - worldPos);
          vec3 outwardN  = normalize(worldPos);
          if (dot(toCam, outwardN) < 0.0) {
            // Far hemisphere — push outside clip volume to discard.
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          }
        }
        `,
      );
    };

    flightMatRef.current = mat;
    return () => { mat.dispose(); flightMatRef.current = null; };
  }, [countries.length]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !countries.length || !flightMatRef.current) return;

    if (flightMeshRef.current) {
      try { globe.scene().remove(flightMeshRef.current); } catch { /* ignore */ }
      flightMeshRef.current.geometry.dispose();
      flightMeshRef.current = null;
    }

    if (!liveFlights || liveFlights.length === 0) return;

    // Altitude 1.006 — sits just above vessels (1.0055) and the polygon
    // cap layer (1.005), close enough to the surface that aircraft dots
    // appear pinned to the land/sea beneath them at oblique viewing
    // angles. Was previously 1.010 which produced a visible parallax
    // gap of ~0.5% of the globe radius between flight dots and the
    // country polygon they belonged to.
    const radius    = globe.getGlobeRadius() * 1.006;
    const positions = new Float32Array(liveFlights.length * 3);

    // Use globe.gl's polar2Cartesian convention — see vessel block above.
    for (let i = 0; i < liveFlights.length; i++) {
      const f = liveFlights[i];
      const phi    = (90 - f.lat) * (Math.PI / 180);
      const theta  = (90 - f.lng) * (Math.PI / 180);
      const sinPhi = Math.sin(phi);
      positions[i * 3]     = radius * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mesh = new THREE.Points(geometry, flightMatRef.current);
    mesh.renderOrder = 3; // above vessels (2)
    globe.scene().add(mesh);
    flightMeshRef.current = mesh;

    return () => {
      if (flightMeshRef.current) {
        try { globe.scene().remove(flightMeshRef.current); } catch { /* ignore */ }
        flightMeshRef.current.geometry.dispose();
        flightMeshRef.current = null;
      }
    };
  }, [liveFlights, countries.length]);

  // ── Hover raycaster for live vessels & flights ──────────────────────────
  // THREE.Raycaster natively supports Points objects. intersectObject()
  // returns the hit point's index in the Float32Array, which maps 1:1 to
  // liveVessels[] / liveFlights[] (both are built in the same iteration order).
  // We coalesce to one raycast per animation frame — identical pattern to the
  // country polygon hover — and suppress output during drag/coast.
  // Uses position:fixed for the tooltip div so it escapes overflow:hidden.
  useEffect(() => {
    if (!countries.length) return;
    const globe = globeRef.current;
    if (!globe) return;

    let el: HTMLElement;
    let camera: THREE.Camera;
    try {
      el     = globe.renderer().domElement;
      camera = (globe as any).camera();
    } catch { return; }

    const raycaster = new THREE.Raycaster();
    // threshold is in world-space units; three-globe uses radius ≈ 100 units.
    // Tightened from 1.5 → 0.9 (≈ 0.9 % of globe radius) — visible dot is
    // 3.5 px which is much smaller than the old hit zone, so 1.5 was giving
    // false positives in dense areas (Singapore anchorage, Suez approaches).
    raycaster.params.Points = { threshold: 0.9 };

    /**
     * Pick the best hit from a raycast result.  three.js returns all points
     * within `threshold` of the ray, sorted by *camera distance* — i.e. the
     * front-most along the ray.  For points all sitting on the globe surface
     * that's the wrong sort: in a cluster the front-most isn't necessarily
     * the one visually closest to the cursor.  `distanceToRay` is the
     * perpendicular distance from each point to the ray; sorting by that
     * gives us the point nearest where the ray pierces the surface — i.e.
     * the dot the user is actually pointing at.
     */
    function pickBestHit(hits: THREE.Intersection[]): THREE.Intersection | null {
      if (hits.length === 0) return null;
      if (hits.length === 1) return hits[0];
      let best = hits[0];
      let bestDist = (best as any).distanceToRay ?? Infinity;
      for (let i = 1; i < hits.length; i++) {
        const d = (hits[i] as any).distanceToRay ?? Infinity;
        if (d < bestDist) { bestDist = d; best = hits[i]; }
      }
      return best;
    }

    let rafId  = 0;
    let lastEv: PointerEvent | null = null;

    const onMove = (e: PointerEvent) => {
      lastEv = e;
      if (rafId) return; // coalesce — one raycast per frame max
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!lastEv) return;
        if (draggingRef.current) { setHoverTip(null); return; }

        // Neither vessel nor flight layer active — skip raycasting entirely.
        const hasVessels = !!(vesselMeshRef.current && liveVesselsRef.current?.length);
        const hasFlights = !!(flightMeshRef.current && liveFlightsRef.current?.length);
        if (!hasVessels && !hasFlights) { setHoverTip(null); return; }

        const rect  = el.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((lastEv.clientX - rect.left) / rect.width)  *  2 - 1,
          ((lastEv.clientY - rect.top)  / rect.height) * -2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);

        // Vessels (cyan layer, rendered below flights)
        if (hasVessels) {
          const hits = raycaster.intersectObject(vesselMeshRef.current!);
          const best = pickBestHit(hits);
          if (best && best.index != null) {
            const v = liveVesselsRef.current![best.index];
            if (v) {
              setHoverTip({ clientX: lastEv.clientX, clientY: lastEv.clientY, kind: 'vessel', vessel: v });
              return;
            }
          }
        }

        // Flights (purple layer, rendered above vessels)
        if (hasFlights) {
          const hits = raycaster.intersectObject(flightMeshRef.current!);
          const best = pickBestHit(hits);
          if (best && best.index != null) {
            const f = liveFlightsRef.current![best.index];
            if (f) {
              setHoverTip({ clientX: lastEv.clientX, clientY: lastEv.clientY, kind: 'flight', flight: f });
              return;
            }
          }
        }

        setHoverTip(null);
      });
    };

    const clearTip = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      setHoverTip(null);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', clearTip);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', clearTip);
      cancelAnimationFrame(rafId);
    };
  }, [countries.length]);

  // Live-respond to autoRotate prop changes WITHOUT waiting for the next
  // idle cycle. Flipping the toggle off mid-spin should stop instantly;
  // flipping on (when not dragging) should resume the spin immediately.
  useEffect(() => {
    if (!globeRef.current) return;
    let controls: any;
    try { controls = globeRef.current.controls(); } catch { return; }
    if (!controls) return;
    if (autoRotate && !draggingRef.current) {
      controls.autoRotate = true;
    } else {
      controls.autoRotate = false;
      clearTimeout(idleTimer.current); // cancel any pending restart
    }
  }, [autoRotate]);

  // Fly to selected country.
  // Skip if the user is currently interacting — a tween started here would
  // fight their drag input until the 800ms duration elapses.
  useEffect(() => {
    if (!globeRef.current || !selectedCountry) return;
    if (draggingRef.current) return;
    const meta = COUNTRY_META[selectedCountry];
    if (meta) {
      globeRef.current.pointOfView(
        { lat: meta.lat, lng: meta.lng, altitude: 2.0 },
        800
      );
    }
  }, [selectedCountry]);

  // Fly to selected trade node — same drag-aware guard pattern.
  useEffect(() => {
    if (!globeRef.current || !selectedTradeNodeId || !tradePoints) return;
    if (draggingRef.current) return;
    const node = tradePoints.find((n) => n.id === selectedTradeNodeId);
    if (node) {
      globeRef.current.pointOfView(
        { lat: node.lat, lng: node.lng, altitude: 1.6 },
        800,
      );
    }
  }, [selectedTradeNodeId, tradePoints]);

  // Fly to selected exchange (same drag-aware guard as country fly-to).
  useEffect(() => {
    if (!globeRef.current || !selectedExchange) return;
    if (draggingRef.current) return;
    globeRef.current.pointOfView(
      { lat: selectedExchange.lat, lng: selectedExchange.lng, altitude: 2.0 },
      800
    );
  }, [selectedExchange]);

  // ── Macro heatmap: build ISO2 → GDP growth lookup ───────────────────────
  // IMPORTANT: must be declared BEFORE getCapColor because macroMap appears
  // in getCapColor's dependency array, which is evaluated immediately when
  // useCallback runs. Accessing a const in the temporal dead zone would throw
  // a ReferenceError that blanks the entire page.
  const macroMap = useMemo(() => {
    if (!macroHeatmap?.length) return null;
    const m = new Map<string, number>();
    for (const c of macroHeatmap) m.set(c.countryIso2, c.value);
    return m;
  }, [macroHeatmap]);

  // ── Color callback ──
  // Reads hoverIsoRef (a ref, not state) so the callback reference only
  // changes when mode/performanceMap/selectedCountry change — NOT on hover.
  // Hover color is included via the ref read at evaluation time.
  const getCapColor = useCallback(
    (d: object) => {
      const feat = d as Feature;
      const iso = feat.properties.ISO_A2;

      // ── Country-colours OFF ──────────────────────────────────────────────
      // Polygon caps go fully transparent so the bare globe texture is
      // visible.  Hover and selected highlights are kept subtle so the user
      // still has visual feedback for navigation.
      if (!showCountryColors) {
        if (iso === selectedCountry)        return "rgba(255, 255, 255, 0.20)";
        if (iso === hoverIsoRef.current)    return "rgba(255, 255, 255, 0.08)";
        return "rgba(0, 0, 0, 0)";
      }

      // Exchange mode: clear all fills so only pins + borders are visible.
      // Special-cased even when showCountryColors=true because the Exchanges
      // mode has its own design intent (pins-only).
      let raw: string;
      if (showExchangePins) {
        raw = iso === selectedCountry        ? "rgba(255, 255, 255, 0.08)"
            : iso === hoverIsoRef.current    ? "rgba(255, 255, 255, 0.05)"
            :                                  "rgba(0, 0, 0, 0)";
      } else if (iso === selectedCountry) {
        raw = "rgba(255, 255, 255, 0.35)";
      } else if (iso === hoverIsoRef.current) {
        raw = "rgba(255, 255, 255, 0.22)";
      } else if (macroMap) {
        // Macro heatmap mode — shade by GDP growth annual %.
        const gdp = macroMap.get(iso);
        raw = gdp === undefined ? "rgba(60, 60, 70, 0.25)"
            : gdp >= 6          ? "rgba(16, 185, 129, 0.65)"   // strong growth
            : gdp >= 4          ? "rgba(52, 211, 153, 0.55)"
            : gdp >= 2          ? "rgba(167, 243, 208, 0.45)"
            : gdp >= 0          ? "rgba(251, 191, 36, 0.45)"
            : gdp >= -2         ? "rgba(249, 115, 22, 0.55)"
            :                     "rgba(239, 68, 68, 0.65)";   // contraction
      } else if (mode === "flags") {
        raw = FLAG_COLORS[iso] ? `${FLAG_COLORS[iso]}72`
                               : "rgba(80, 80, 80, 0.19)";
      } else {
        const change = performanceMap[iso];
        raw = change === undefined ? "rgba(80, 80, 80, 0.13)" : perfColor(change);
      }

      // ── Per-country day/night darkening ──────────────────────────────────
      // When the day/night cycle is on, dim each country's cap by how much
      // its centroid is in shadow.  Use the same coordinate-space convention
      // as computeSunDirection: lat→Y, lng→X/Z.  Dot the centroid unit
      // vector with the cached sun direction:
      //   dot ≈ +1 → noon (full alpha)
      //   dot ≈  0 → terminator (≈30% alpha)
      //   dot ≈ -1 → midnight   (≈15% alpha)
      // Night-side polygons fade out and the darkened texture beneath them
      // becomes visible — the terminator is legible through the country
      // overlay.  Selected/hover highlights are exempt (already special-
      // cased above, return early).
      if (sunDirCached && iso !== selectedCountry && iso !== hoverIsoRef.current) {
        const meta = COUNTRY_META[iso];
        if (meta) {
          const latR    = (meta.lat * Math.PI) / 180;
          const lngR    = (meta.lng * Math.PI) / 180;
          const cosLat  = Math.cos(latR);
          // Centroid unit vector in three-globe coords (matches computeSunDirection):
          const cx = cosLat * Math.sin(lngR);
          const cy = Math.sin(latR);
          const cz = cosLat * Math.cos(lngR);
          const dot = cx * sunDirCached.x + cy * sunDirCached.y + cz * sunDirCached.z;
          // Smooth ramp: dot >= 0.2 → full (1.0), dot <= -0.2 → 0.15.
          const dayMix  = Math.max(0, Math.min(1, (dot + 0.2) / 0.4));
          const dimMul  = 0.15 + 0.85 * dayMix;
          raw = multiplyAlpha(raw, dimMul);
        }
      }

      return raw;
    },
    [mode, performanceMap, selectedCountry, showExchangePins, macroMap,
     showCountryColors, sunDirCached]
  );

  // ── Altitude: only elevate selected country ──
  // Hover altitude is intentionally excluded — geometry rebuilds are expensive.
  // Color-only hover highlight is sufficient visual feedback.
  const getAltitude = useCallback(
    (d: object) => {
      const feat = d as Feature;
      return feat.properties.ISO_A2 === selectedCountry ? 0.03 : 0.005;
    },
    [selectedCountry]
  );

  // ── Hover handler: ref + imperative globe API (zero React re-renders) ──
  // Coalesced via requestAnimationFrame — at most 1 material update per frame
  // even if the mouse crosses multiple polygons in a single 16ms interval.
  const handleHover = useCallback(
    (polygon: object | null) => {
      if (draggingRef.current) return; // skip hover updates while dragging
      const feat = polygon as Feature | null;
      const newIso = feat?.properties?.ISO_A2 ?? null;
      if (newIso === hoverIsoRef.current) return; // same polygon, skip
      hoverIsoRef.current = newIso;
      // Schedule a single GPU update for the next animation frame.
      // If multiple hover events fire before the frame, only one
      // polygonCapColor call happens — reading the latest ref value.
      if (!hoverRafRef.current) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = 0;
          const globe = globeRef.current as any;
          if (globe?.polygonCapColor) {
            globe.polygonCapColor(getCapColor);
          }
        });
      }
    },
    [getCapColor]
  );

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => { cancelAnimationFrame(hoverRafRef.current); };
  }, []);

  const handleClick = useCallback(
    (polygon: object, _event: MouseEvent, _coords: { lat: number; lng: number; altitude: number }) => {
      const feat = polygon as Feature;
      const iso = feat.properties?.ISO_A2;
      if (iso) onCountryClick(iso);
    },
    [onCountryClick]
  );

  // Keep module-level click ref in sync so HTML pin elements always call latest callback
  _exchangeClickRef = onExchangeClick;

  const getLabel = useCallback((d: object) => {
    const feat = d as Feature;
    const iso = feat.properties.ISO_A2;
    const meta = COUNTRY_META[iso];
    const name = meta?.name ?? feat.properties.ADMIN;
    return `<div style="padding:4px 8px;background:rgba(0,0,0,0.8);border-radius:4px;font-size:12px;color:#fff">${name}</div>`;
  }, []);

  // Keep refs in sync so the controls effect can restore them after coast
  handleHoverRef.current = handleHover;
  getLabelRef.current = getLabel;

  // ── Stroke color: brighter in exchange mode so borders remain visible ──
  // Use a ref so the callback is stable and doesn't trigger polygon re-evaluation.
  const showPinsRef = useRef(showExchangePins);
  showPinsRef.current = showExchangePins;
  const getStrokeColor = useCallback(
    () => showPinsRef.current ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)",
    []
  );

  // ── Trade overlay callbacks ─────────────────────────────────────────
  // Stable point/arc accessors — the Trade tab passes new arrays as it
  // toggles layers, but the callbacks themselves never change shape, so
  // react-globe.gl only does a transition when the data identity flips.
  const tradePointLat   = useCallback((d: object) => (d as TradeNode).lat, []);
  const tradePointLng   = useCallback((d: object) => (d as TradeNode).lng, []);
  // 0.006 sits just above the polygon-cap altitude (0.005) so the marker
  // is never z-occluded by the country polygon when it lands on a coast.
  // The 0.1%-of-radius offset is visually imperceptible — still reads flat.
  const tradePointAlt   = useCallback((_d: object) => 0.006, []);
  const tradePointRadius = useCallback((d: object) => {
    const n = d as TradeNode;
    const isSelected = n.id === selectedTradeNodeId;
    return (isSelected ? 0.55 : 0.35) + (n.importance / 100) * 0.25;
  }, [selectedTradeNodeId]);
  const tradePointColor = useCallback((d: object) => {
    const n = d as TradeNode;
    const base = NODE_COLOR[n.kind];
    if (n.id === selectedTradeNodeId) return '#ffffff';
    return base;
  }, [selectedTradeNodeId]);
  const tradePointLabel = useCallback((d: object) => {
    const n = d as TradeNode;
    return `<div style="padding:4px 8px;background:rgba(0,0,0,0.85);border-radius:4px;font-size:12px;color:#fff;border-left:3px solid ${NODE_COLOR[n.kind]}">
      <div style="font-weight:600">${n.name}</div>
      <div style="opacity:0.7;font-size:10px;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px">${n.kind} · ${n.region}</div>
    </div>`;
  }, []);
  const tradePointClick = useCallback((d: object) => {
    onTradeNodeClick?.(d as TradeNode);
  }, [onTradeNodeClick]);

  // Routes: use pathsData so waypoints are followed rather than drawing a
  // direct chord that cuts through land. The Catmull-Rom smoother turns
  // the high-level waypoint chain into a dense, smooth curve so the path
  // shows realistic gradual turn radii instead of sharp polyline kinks.
  const tradePathPoints = useCallback((d: object) => {
    const r = d as TradeRoute;
    // smoothRouteCoords returns [lng, lat]; react-globe.gl expects [lat, lng]
    return smoothRouteCoords(r, 10).map(([lng, lat]) => [lat, lng] as [number, number]);
  }, []);
  const tradePathColor = useCallback((d: object) => {
    const r = d as TradeRoute;
    const c = ROUTE_COLOR[r.mode];
    return [`${c}70`, `${c}ee`];
  }, []);
  const tradePathStroke   = useCallback((d: object) => 0.3 + ((d as TradeRoute).importance / 100) * 0.7, []);
  // Same trick as tradePointAlt — 0.006 clears the polygon caps so the
  // route stays visible at coastal start/end points instead of being
  // hidden underneath the country mesh. Still reads flat to the eye.
  const tradePathAltitude = useCallback((_d: object) => 0.006, []);
  const tradePathLabel = useCallback((d: object) => {
    const r = d as TradeRoute;
    return `<div style="padding:4px 8px;background:rgba(0,0,0,0.85);border-radius:4px;font-size:11px;color:#fff;border-left:3px solid ${ROUTE_COLOR[r.mode]}">
      <div style="font-weight:600">${r.name}</div>
      <div style="opacity:0.7;font-size:10px;margin-top:2px;text-transform:uppercase">${r.mode} · importance ${r.importance}</div>
    </div>`;
  }, []);

  const EMPTY_POINTS:  TradeNode[]  = [];
  const EMPTY_ARCS:    TradeRoute[] = [];
  const EMPTY_PARTNER_ARCS: PartnerArc[] = [];

  const globeSize = Math.min(width, height);

  // ── Merged ring data: conflicts + earthquakes + economic events ───────────
  const mergedRings = useMemo<RingDatum[]>(() => {
    const out: RingDatum[] = [];
    if (conflictEvents) {
      for (const e of conflictEvents)
        out.push({ kind: 'conflict', lat: e.lat, lng: e.lng, event: e });
    }
    if (earthquakeEvents) {
      for (const e of earthquakeEvents)
        out.push({ kind: 'earthquake', lat: e.lat, lng: e.lng, event: e });
    }
    if (economicEvents) {
      for (const e of economicEvents)
        out.push({ kind: 'economic', lat: e.lat, lng: e.lng, event: e });
    }
    return out;
  }, [conflictEvents, earthquakeEvents, economicEvents]);

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ width, height, touchAction: 'none', isolation: 'isolate', position: 'relative' }}
    >
      <Globe
        ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
        width={globeSize}
        height={globeSize}
        backgroundColor="rgba(0,0,0,0)"
        // NASA Blue Marble (8K daylight imagery) + topology bump map for
        // terrain depth. Both served from jsDelivr's edge cache.
        globeImageUrl={EARTH_TEXTURE_URL}
        bumpImageUrl={EARTH_BUMP_URL}
        // Atmosphere tuned for daylight Earth — slightly warmer blue.
        // Shell altitude reduced 25% (0.22 → 0.165) per user request to
        // tone down the prominent rim glow around the planet.
        showAtmosphere
        atmosphereColor="#7eb6ff"
        atmosphereAltitude={0.165}
        // animateIn DISABLED — react-globe.gl's intro animation runs a 1200ms
        // scene-rotation tween with Quintic.Out easing on init. It directly
        // rotates state.scene.setRotationFromAxisAngle(...) every frame,
        // which overrides any user drag input on OrbitControls. The Quintic.Out
        // easing back-loads its motion: ~800ms in, the tween is barely moving,
        // creating a "stutter/stop" sensation as the spin decelerates while the
        // user is trying to drag. Disabling it makes drag silky from frame 1.
        animateIn={false}
        polygonsData={countries}
        polygonCapColor={getCapColor}
        polygonSideColor={SIDE_COLOR}
        polygonStrokeColor={getStrokeColor}
        polygonAltitude={getAltitude}
        polygonLabel={getLabel}
        polygonsTransitionDuration={200}
        onPolygonClick={handleClick}
        onPolygonHover={handleHover}
        // ── Exchange HTML pin layer ──
        // Uses real DOM elements instead of Three.js points — native browser
        // hover detection, never misses. Pins fade via handlePinVisibility
        // when they rotate to the far side of the globe.
        htmlElementsData={showExchangePins ? EXCHANGES : EMPTY_ARRAY}
        htmlLat={HTML_PIN_LAT}
        htmlLng={HTML_PIN_LNG}
        htmlAltitude={HTML_PIN_ALT}
        htmlElement={createPinElement}
        htmlElementVisibilityModifier={handlePinVisibility}
        htmlTransitionDuration={300}
        // ── Trade infrastructure overlay ────────────────────────────────
        // Three.js-rendered points (ports/airports/chokepoints/hubs) with
        // arc routes (maritime/air/rail). Disabled when no data is passed,
        // so the rest of the app pays zero perf cost.
        pointsData={tradePoints ?? EMPTY_POINTS}
        pointLat={tradePointLat}
        pointLng={tradePointLng}
        pointAltitude={tradePointAlt}
        pointRadius={tradePointRadius}
        pointColor={tradePointColor}
        pointLabel={tradePointLabel}
        onPointClick={tradePointClick}
        pointsTransitionDuration={300}
        pathsData={tradeArcs ?? EMPTY_ARCS}
        pathPoints={tradePathPoints}
        pathColor={tradePathColor}
        pathStroke={tradePathStroke}
        pathAltitude={tradePathAltitude}
        pathLabel={tradePathLabel}
        pathDashLength={1}
        pathDashGap={0}
        pathDashAnimateTime={0}
        pathTransitionDuration={300}
        // ── Trade partner arcs (selected country ↔ top trade partners) ──────
        // Separate arcsData slot — distinct from pathsData (trade routes).
        // Export arcs: emerald (#22c55e) animated from selected → partner.
        // Import arcs: amber (#f59e0b) animated from partner → selected.
        // Stroke width scales with trade share so top partners stand out.
        // Dashed animation (dashLength 0.5 / dashGap 0.5 / animateTime 2s)
        // gives the "flow of goods" feel without being distracting.
        arcsData={partnerArcs ?? EMPTY_PARTNER_ARCS}
        arcStartLat={(d: object) => (d as PartnerArc).startLat}
        arcStartLng={(d: object) => (d as PartnerArc).startLng}
        arcEndLat={(d: object) =>   (d as PartnerArc).endLat}
        arcEndLng={(d: object) =>   (d as PartnerArc).endLng}
        arcColor={(d: object) =>    (d as PartnerArc).color}
        arcStroke={(d: object) =>   Math.max(0.4, (d as PartnerArc).share * 6)}
        arcAltitude={0.25}
        arcLabel={(d: object) =>    (d as PartnerArc).label}
        arcDashLength={0.5}
        arcDashGap={0.5}
        arcDashAnimateTime={2000}
        arcsTransitionDuration={400}
        // ── Event ring layer (conflicts + earthquakes merged) ────────────
        // Conflicts → orange/red rings scaled by fatalities.
        // Earthquakes → teal rings scaled by magnitude.
        // Both use the same ringsData slot via a discriminated union.
        ringsData={mergedRings.length > 0 ? mergedRings : EMPTY_RINGS}
        ringLat={RING_LAT}
        ringLng={RING_LNG}
        ringAltitude={RING_ALT}
        ringColor={ringColor}
        ringMaxRadius={ringMaxRadius}
        ringPropagationSpeed={1.2}
        ringRepeatPeriod={1800}
        onRingClick={(d: object) => {
          const rd = d as RingDatum;
          if (rd.kind === 'conflict' && onConflictEventClick) {
            onConflictEventClick(rd.event as ConflictEvent);
          } else if (rd.kind === 'earthquake' && onEarthquakeEventClick) {
            onEarthquakeEventClick(rd.event as EarthquakeEvent);
          } else if (rd.kind === 'economic' && onEconomicEventClick) {
            onEconomicEventClick(rd.event as EconomicEvent);
          }
        }}
        // ── Solid clickable markers (objectsData) ────────────────────────
        // Pairs each ring with a 3D sphere at the same coordinates — gives
        // a generous click hit area and ensures markers stay visible even
        // when a ring is mid-fade in its animation cycle.
        objectsData={mergedRings.length > 0 ? mergedRings : EMPTY_RINGS}
        objectLat={OBJ_LAT}
        objectLng={OBJ_LNG}
        objectAltitude={OBJ_ALT}
        objectThreeObject={makeEventMarker}
        onObjectClick={(d: object) => {
          const rd = d as RingDatum;
          if (rd.kind === 'conflict' && onConflictEventClick) {
            onConflictEventClick(rd.event as ConflictEvent);
          } else if (rd.kind === 'earthquake' && onEarthquakeEventClick) {
            onEarthquakeEventClick(rd.event as EarthquakeEvent);
          } else if (rd.kind === 'economic' && onEconomicEventClick) {
            onEconomicEventClick(rd.event as EconomicEvent);
          }
        }}
        // ── City label detail layer ──────────────────────────────────────
        // Fades in automatically when the user zooms below altitude 1.2
        // (roughly "country zoom level" and closer).  react-globe.gl renders
        // labels as canvas-sprite billboards on the sphere surface — handles
        // back-hemisphere culling, curvature projection, and perspective
        // scaling internally.  Capital cities get a slightly larger font and
        // dot so they stand out from trade/financial cities.
        labelsData={showCityLabels && cityLabelsVisible ? WORLD_CITIES : EMPTY_LABELS}
        labelLat={LABEL_LAT}
        labelLng={LABEL_LNG}
        labelText={LABEL_TEXT}
        labelColor={LABEL_COLOR}
        labelSize={LABEL_SIZE}
        labelAltitude={0.01}
        labelResolution={2}
        labelDotRadius={LABEL_DOT_RADIUS}
        labelDotOrientation={LABEL_DOT_ORIENT}
      />

      {/* ── Scale bar + zoom indicator (bottom-left overlay) ─────────────── */}
      {/* Two adjacent pills:                                                */}
      {/*   • Scale bar: nice round km value matching the current km/px      */}
      {/*   • Zoom level: web-map convention (Z 0 = world, Z ~15 = street)  */}
      {/* Both update from the same 300ms altitude poll, so the bar's       */}
      {/* labelled distance and the zoom number stay in lockstep.            */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none select-none flex items-stretch gap-1.5">
        {/* Scale bar */}
        <div className="bg-black/55 backdrop-blur-sm px-2 py-1.5 rounded border border-white/10 shadow-lg flex flex-col justify-center">
          <div className="text-[10px] text-white/95 font-mono leading-none mb-1 text-center tabular-nums">
            {scaleBar.label}
          </div>
          <div className="relative h-2" style={{ width: Math.max(40, Math.round(scaleBar.widthPx)) }}>
            {/* Horizontal centre line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/90" />
            {/* Left tick */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/90" />
            {/* Right tick */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white/90" />
          </div>
        </div>

        {/* Zoom level */}
        <div className="bg-black/55 backdrop-blur-sm px-2.5 py-1.5 rounded border border-white/10 shadow-lg flex flex-col items-center justify-center min-w-[44px]">
          <div className="text-[9px] text-white/70 font-mono uppercase tracking-wider leading-none">
            Zoom
          </div>
          <div className="text-[13px] text-white font-mono leading-none tabular-nums mt-1 font-semibold">
            {zoom.toFixed(1)}
          </div>
        </div>
      </div>

      {/* ── Vessel / flight hover tooltip ────────────────────────────────── */}
      {/* position:fixed escapes the parent overflow:hidden and isolation layer */}
      {hoverTip && (
        <div
          className="pointer-events-none z-[500]"
          style={{ position: 'fixed', left: hoverTip.clientX + 14, top: hoverTip.clientY - 8 }}
        >
          <div className="bg-black/90 border border-white/10 rounded-md px-2.5 py-2 text-xs shadow-xl backdrop-blur-sm min-w-[148px]">
            {hoverTip.kind === 'vessel' && hoverTip.vessel ? (
              <>
                <p className="text-cyan-300 font-semibold leading-tight mb-1.5">
                  {hoverTip.vessel.name?.trim() || `MMSI ${hoverTip.vessel.mmsi}`}
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground min-w-[200px]">
                  {/* Identity ────────────────────────────────────────── */}
                  <div className="flex justify-between gap-3">
                    <span>MMSI</span>
                    <span className="text-foreground font-mono">{hoverTip.vessel.mmsi}</span>
                  </div>
                  {hoverTip.vessel.imo != null && (
                    <div className="flex justify-between gap-3">
                      <span>IMO</span>
                      <span className="text-foreground font-mono">{hoverTip.vessel.imo}</span>
                    </div>
                  )}
                  {hoverTip.vessel.callSign && (
                    <div className="flex justify-between gap-3">
                      <span>Call sign</span>
                      <span className="text-foreground font-mono">{hoverTip.vessel.callSign}</span>
                    </div>
                  )}
                  {hoverTip.vessel.shipType != null && (
                    <div className="flex justify-between gap-3">
                      <span>Type</span>
                      <span className="text-foreground">{fmtShipType(hoverTip.vessel.shipType)}</span>
                    </div>
                  )}
                  {fmtNavStatus(hoverTip.vessel.navStatus) && (
                    <div className="flex justify-between gap-3">
                      <span>Status</span>
                      <span className="text-foreground">{fmtNavStatus(hoverTip.vessel.navStatus)}</span>
                    </div>
                  )}

                  {/* Motion ───────────────────────────────────────────── */}
                  {hoverTip.vessel.sog != null && (
                    <div className="flex justify-between gap-3">
                      <span>Speed</span>
                      <span className="text-foreground">{hoverTip.vessel.sog.toFixed(1)} kn</span>
                    </div>
                  )}
                  {hoverTip.vessel.cog != null && (
                    <div className="flex justify-between gap-3">
                      <span>Course</span>
                      <span className="text-foreground">{Math.round(hoverTip.vessel.cog)}°</span>
                    </div>
                  )}

                  {/* Voyage ───────────────────────────────────────────── */}
                  {hoverTip.vessel.destination && (
                    <div className="flex justify-between gap-3 pt-1 border-t border-white/5 mt-1">
                      <span>Destination</span>
                      <span className="text-foreground uppercase truncate max-w-[120px]" title={hoverTip.vessel.destination}>
                        {hoverTip.vessel.destination}
                      </span>
                    </div>
                  )}
                  {fmtEta(hoverTip.vessel.eta) && (
                    <div className="flex justify-between gap-3">
                      <span>ETA</span>
                      <span className="text-foreground">{fmtEta(hoverTip.vessel.eta)}</span>
                    </div>
                  )}

                  {/* Physical ─────────────────────────────────────────── */}
                  {(hoverTip.vessel.length != null || hoverTip.vessel.width != null) && (
                    <div className="flex justify-between gap-3 pt-1 border-t border-white/5 mt-1">
                      <span>Dimensions</span>
                      <span className="text-foreground">
                        {hoverTip.vessel.length != null ? `${Math.round(hoverTip.vessel.length)}` : '—'}
                        {' × '}
                        {hoverTip.vessel.width  != null ? `${Math.round(hoverTip.vessel.width)}`  : '—'}
                        {' m'}
                      </span>
                    </div>
                  )}
                  {hoverTip.vessel.draught != null && hoverTip.vessel.draught > 0 && (
                    <div className="flex justify-between gap-3">
                      <span>Draught</span>
                      <span className="text-foreground">{hoverTip.vessel.draught.toFixed(1)} m</span>
                    </div>
                  )}
                </div>
              </>
            ) : hoverTip.kind === 'flight' && hoverTip.flight ? (
              <>
                <p className="text-purple-300 font-semibold leading-tight mb-1.5">
                  {hoverTip.flight.callsign?.trim() || hoverTip.flight.icao24.toUpperCase()}
                </p>
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  {hoverTip.flight.country && (
                    <div className="flex justify-between gap-3">
                      <span>Origin</span>
                      <span className="text-foreground">{hoverTip.flight.country}</span>
                    </div>
                  )}
                  {hoverTip.flight.altitudeM != null && (
                    <div className="flex justify-between gap-3">
                      <span>Altitude</span>
                      <span className="text-foreground">
                        {Math.round(hoverTip.flight.altitudeM / 0.3048).toLocaleString()} ft
                      </span>
                    </div>
                  )}
                  {hoverTip.flight.velocityMs != null && (
                    <div className="flex justify-between gap-3">
                      <span>Speed</span>
                      <span className="text-foreground">
                        {Math.round(hoverTip.flight.velocityMs * 1.944)} kn
                      </span>
                    </div>
                  )}
                  {hoverTip.flight.track != null && (
                    <div className="flex justify-between gap-3">
                      <span>Track</span>
                      <span className="text-foreground">{Math.round(hoverTip.flight.track)}°</span>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
