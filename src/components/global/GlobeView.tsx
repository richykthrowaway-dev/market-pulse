import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
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

// Module-level GeoJSON cache — survives component remounts / HMR
let geoJsonCache: Feature[] | null = null;
let geoJsonPromise: Promise<Feature[]> | null = null;
function loadGeoJson(): Promise<Feature[]> {
  if (geoJsonCache) return Promise.resolve(geoJsonCache);
  if (!geoJsonPromise) {
    geoJsonPromise = fetch(geoJsonUrl)
      .then((r) => r.json())
      .then((data) => {
        const features = data.features
          .map((f: Feature) => {
            if (f.properties.ISO_A2 === "-99") {
              const override = ISO_OVERRIDES[f.properties.ADMIN];
              if (override) f.properties.ISO_A2 = override;
            }
            return f;
          })
          .filter((f: Feature) => f.properties.ISO_A2 !== "AQ");
        geoJsonCache = features;
        return features;
      });
  }
  return geoJsonPromise;
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
  showCityLabels = false,
}: GlobeViewProps) {
  // Mirror autoRotate prop into a ref so the idle-timer callback (created
  // once inside a stable useEffect) can read the latest value without
  // having to re-subscribe whenever the prop changes.
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<Feature[]>(geoJsonCache ?? []);
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

      if (!mapReady || !bumpMapReady) {
        timeoutId = setTimeout(tryApply, 200);
      }
    };

    tryApply();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [countries]);

  // ── Progressive 16K texture upgrade ──────────────────────────────────────
  // The 8K diffuse map loads fast and gives a good initial look.  Once the
  // globe is on screen we fetch the 16K version (~8 MB) in the background.
  // When it arrives we apply the same anisotropic + trilinear filtering and
  // swap material.map in one frame — no flicker.  The superseded 8K texture
  // is disposed to free ~8 MB of GPU VRAM.
  //
  // Retry loop: we need the 8K map to already be decoded (mat.map.image set)
  // before swapping, otherwise three-globe might overwrite us.  Poll until
  // both are ready, then perform the single swap.
  useEffect(() => {
    if (!countries.length) return;
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
  }, [countries.length]);

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
        cloudsMesh = new THREE.Mesh(geometry, material);
        cloudsMesh.renderOrder = 1; // draw after the globe + polygon caps
        globe.scene().add(cloudsMesh);

        // Slow cloud drift (~1 full rotation per ~9 minutes). Uses an
        // absolute-time formula rather than `+= dt * speed`. Reasons:
        //   - Avoids frame-to-frame drift accumulation from float imprecision.
        //   - Keeps cloud position purely a function of wall-clock time,
        //     so a tab pause + resume doesn't cause a sudden cloud jump.
        const startTime = performance.now();
        const ROT_SPEED = 0.000012; // radians per millisecond
        const tick = () => {
          if (!cloudsMesh) return;
          cloudsMesh.rotation.y = (performance.now() - startTime) * ROT_SPEED;
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        // ── Progressive cloud upgrade ──────────────────────────────────────
        // Mirror the earth 16K upgrade: once the 4K mesh is rendering, fetch a
        // higher-quality cloud texture in the background.  On arrival we apply
        // the same anisotropic + trilinear settings and hot-swap material.map.
        // The old 4K texture is disposed; cloudsTexture is updated so the outer
        // cleanup correctly disposes the HQ version on unmount.
        new THREE.TextureLoader().load(
          CLOUDS_TEXTURE_HQ_URL,
          (texHQ) => {
            if (cancelled || !cloudsMesh) { texHQ.dispose(); return; }
            texHQ.anisotropy      = renderer.capabilities.getMaxAnisotropy();
            texHQ.minFilter       = THREE.LinearMipmapLinearFilter;
            texHQ.magFilter       = THREE.LinearFilter;
            texHQ.generateMipmaps = true;
            texHQ.needsUpdate     = true;
            const mat = cloudsMesh.material as THREE.MeshPhongMaterial;
            const old = mat.map;
            mat.map   = texHQ;
            mat.needsUpdate = true;
            cloudsTexture = texHQ; // cleanup ref → now points at the HQ texture
            old?.dispose();        // reclaim 4K VRAM
          },
          undefined,
          () => console.warn('[GlobeView] HQ cloud texture failed — keeping 4K'),
        );
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
      color:           0x67e8f9, // sky-300
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
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

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
  const liveVesselsRef = useRef<Vessel[] | undefined>(undefined);
  liveVesselsRef.current = liveVessels;
  const liveFlightsRef  = useRef<Flight[] | undefined>(undefined);
  liveFlightsRef.current = liveFlights;

  // ── City labels: shown only when zoomed in below altitude 1.2 ────────────
  // Polling at 300ms is cheap — pointOfView() is a pure getter that reads
  // the OrbitControls spherical position; no GPU work involved.
  const [cityLabelsVisible, setCityLabelsVisible] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const alt = (globeRef.current as any)?.pointOfView()?.altitude;
      if (alt == null) return;
      setCityLabelsVisible(alt < 1.2);
    }, 300);
    return () => clearInterval(id);
  }, []);

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
    // 1.5 gives a comfortable ~1.5% of globe radius hit zone around each dot
    // without false-positives when dots are packed (e.g. major shipping lanes).
    raycaster.params.Points = { threshold: 1.5 };

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
          if (hits.length > 0 && hits[0].index != null) {
            const v = liveVesselsRef.current![hits[0].index];
            if (v) {
              setHoverTip({ clientX: lastEv.clientX, clientY: lastEv.clientY, kind: 'vessel', vessel: v });
              return;
            }
          }
        }

        // Flights (purple layer, rendered above vessels)
        if (hasFlights) {
          const hits = raycaster.intersectObject(flightMeshRef.current!);
          if (hits.length > 0 && hits[0].index != null) {
            const f = liveFlightsRef.current![hits[0].index];
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

      // Exchange mode: clear all fills so only pins + borders are visible
      if (showExchangePins) {
        if (iso === selectedCountry) return "rgba(255, 255, 255, 0.08)";
        if (iso === hoverIsoRef.current) return "rgba(255, 255, 255, 0.05)";
        return "rgba(0, 0, 0, 0)";
      }

      if (iso === selectedCountry) return "rgba(255, 255, 255, 0.35)";
      if (iso === hoverIsoRef.current) return "rgba(255, 255, 255, 0.22)";

      // Macro heatmap mode — shade by GDP growth annual %
      // Green: strong growth (≥5%), yellow: moderate (2–5%), orange: slow (0–2%),
      // red: contraction (<0%).  Unmapped countries stay neutral.
      if (macroMap) {
        const gdp = macroMap.get(iso);
        if (gdp === undefined) return "rgba(60, 60, 70, 0.25)";
        if (gdp >= 6)  return "rgba(16, 185, 129, 0.65)";   // emerald — strong
        if (gdp >= 4)  return "rgba(52, 211, 153, 0.55)";   // green
        if (gdp >= 2)  return "rgba(167, 243, 208, 0.45)";  // light green
        if (gdp >= 0)  return "rgba(251, 191, 36, 0.45)";   // amber — slow
        if (gdp >= -2) return "rgba(249, 115, 22, 0.55)";   // orange — weak
        return "rgba(239, 68, 68, 0.65)";                   // red — contraction
      }

      if (mode === "flags") {
        return FLAG_COLORS[iso]
          ? `${FLAG_COLORS[iso]}72`
          : "rgba(80, 80, 80, 0.19)";
      }
      const change = performanceMap[iso];
      if (change === undefined) return "rgba(80, 80, 80, 0.13)";
      return perfColor(change);
    },
    [mode, performanceMap, selectedCountry, showExchangePins, macroMap]
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
                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <span>MMSI</span>
                    <span className="text-foreground font-mono">{hoverTip.vessel.mmsi}</span>
                  </div>
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
                  <div className="flex justify-between gap-3">
                    <span>Type</span>
                    <span className="text-foreground">{fmtShipType(hoverTip.vessel.shipType)}</span>
                  </div>
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
