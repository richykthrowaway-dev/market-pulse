import { useState, useEffect, useRef, useCallback } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import geoJsonUrl from "@/data/countries-110m.geojson";
import { COUNTRY_META, FLAG_COLORS } from "@/data/countryMeta";
import { EXCHANGES, CONTINENT_COLORS, type ExchangeInfo } from "@/data/exchangeData";

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
}: GlobeViewProps) {
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
    controls.autoRotate = true;
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

    // Idle timer that ONLY restarts auto-rotate if the user isn't dragging.
    // Without this guard, holding the mouse button for >5s would let
    // auto-rotate kick in mid-drag and fight the user's input.
    const scheduleAutoRotateRestart = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (!draggingRef.current) controls.autoRotate = true;
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
        globeImageUrl="/earth-night.jpg"
        showAtmosphere
        atmosphereColor="#64a0ff"
        atmosphereAltitude={0.18}
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
      />
    </div>
  );
}
