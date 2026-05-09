import { useState, useEffect, useRef, useCallback } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import geoJsonUrl from "@/data/countries-110m.geojson";
import { COUNTRY_META, FLAG_COLORS } from "@/data/countryMeta";
import { EXCHANGES, CONTINENT_COLORS, type ExchangeInfo } from "@/data/exchangeData";
import { NODE_COLOR, ROUTE_COLOR, type TradeNode, type TradeRoute } from "@/data/tradeInfrastructure";

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
const CLOUDS_TEXTURE_URL   = "https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/fair_clouds_4k.png";

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
}

// ── Stable constant callbacks (never recreated) ──────────────────────────
const SIDE_COLOR = () => "rgba(0, 0, 0, 0.15)";
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
  return `rgba(${r}, ${g}, 60, 0.7)`;
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
        if (iso === selectedCountry) return "rgba(255, 255, 255, 0.12)";
        if (iso === hoverIsoRef.current) return "rgba(255, 255, 255, 0.08)";
        return "rgba(0, 0, 0, 0)";
      }

      if (iso === selectedCountry) return "rgba(255, 255, 255, 0.55)";
      if (iso === hoverIsoRef.current) return "rgba(255, 255, 255, 0.35)";

      if (mode === "flags") {
        return FLAG_COLORS[iso]
          ? `${FLAG_COLORS[iso]}b3`
          : "rgba(80, 80, 80, 0.3)";
      }
      const change = performanceMap[iso];
      if (change === undefined) return "rgba(80, 80, 80, 0.2)";
      return perfColor(change);
    },
    [mode, performanceMap, selectedCountry, showExchangePins]
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
  const tradePointAlt   = useCallback((d: object) => 0.01 + ((d as TradeNode).importance / 100) * 0.04, []);
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

  // Arcs: color by transport mode, width and opacity scaled by importance.
  const tradeArcStartLat = useCallback((d: object) => (d as TradeRoute).startLat, []);
  const tradeArcStartLng = useCallback((d: object) => (d as TradeRoute).startLng, []);
  const tradeArcEndLat   = useCallback((d: object) => (d as TradeRoute).endLat,   []);
  const tradeArcEndLng   = useCallback((d: object) => (d as TradeRoute).endLng,   []);
  const tradeArcColor    = useCallback((d: object) => {
    const r = d as TradeRoute;
    const c = ROUTE_COLOR[r.mode];
    // Two-tone gradient — slightly brighter mid-arc gives the line dimensionality.
    return [`${c}80`, `${c}ff`];
  }, []);
  const tradeArcStroke   = useCallback((d: object) => 0.25 + ((d as TradeRoute).importance / 100) * 0.6, []);
  const tradeArcAltitude = useCallback((d: object) => {
    // Scale arc altitude by route length so long routes don't pancake to the surface.
    const r = d as TradeRoute;
    const dLat = r.endLat - r.startLat;
    const dLng = r.endLng - r.startLng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    return Math.min(0.45, 0.08 + dist * 0.003);
  }, []);
  const tradeArcLabel = useCallback((d: object) => {
    const r = d as TradeRoute;
    return `<div style="padding:4px 8px;background:rgba(0,0,0,0.85);border-radius:4px;font-size:11px;color:#fff;border-left:3px solid ${ROUTE_COLOR[r.mode]}">
      <div style="font-weight:600">${r.name}</div>
      <div style="opacity:0.7;font-size:10px;margin-top:2px;text-transform:uppercase">${r.mode} · importance ${r.importance}</div>
    </div>`;
  }, []);

  const EMPTY_POINTS: TradeNode[] = [];
  const EMPTY_ARCS:   TradeRoute[] = [];

  const globeSize = Math.min(width, height);

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ width, height, touchAction: 'none', isolation: 'isolate' }}
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
        arcsData={tradeArcs ?? EMPTY_ARCS}
        arcStartLat={tradeArcStartLat}
        arcStartLng={tradeArcStartLng}
        arcEndLat={tradeArcEndLat}
        arcEndLng={tradeArcEndLng}
        arcColor={tradeArcColor}
        arcStroke={tradeArcStroke}
        arcAltitude={tradeArcAltitude}
        arcLabel={tradeArcLabel}
        arcDashLength={0.4}
        arcDashGap={0.05}
        arcDashAnimateTime={6000}
      />
    </div>
  );
}
