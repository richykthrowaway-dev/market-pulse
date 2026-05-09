import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import geoJsonUrl from "@/data/countries-110m.geojson";
import { COUNTRY_META, FLAG_COLORS } from "@/data/countryMeta";
import { EXCHANGES, CONTINENT_COLORS, type ExchangeInfo } from "@/data/exchangeData";
import { NODE_COLOR, ROUTE_COLOR, type TradeNode, type TradeRoute } from "@/data/tradeInfrastructure";
import { smoothRouteCoords } from "@/data/tradeInfrastructure/smoothing";
import type { Vessel } from "@/hooks/useAISStream";
import type { Flight } from "@/hooks/useOpenSkyFlights";

type GlobeMode = "flags" | "performance";

const ISO_OVERRIDES: Record<string, string> = {
  France: "FR",
  Norway: "NO",
  "Northern Cyprus": "CY",
  Somaliland: "SO",
};

// ── Same props interface as GlobeView (drop-in replacement) ──────────────────
export interface MapViewProps {
  width: number;
  height: number;
  mode: GlobeMode;
  performanceMap: Record<string, number>;
  selectedCountry: string | null;
  onCountryClick: (iso2: string) => void;
  showExchangePins?: boolean;
  onExchangeClick?: (exchange: ExchangeInfo) => void;
  selectedExchange?: ExchangeInfo | null;
  autoRotate?: boolean; // not applicable to flat map — accepted for prop compat
  // ── Trade overlay (mirrors GlobeView props) ─────────────────────────────
  tradePoints?: TradeNode[];
  tradeArcs?: TradeRoute[];
  selectedTradeNodeId?: string | null;
  onTradeNodeClick?: (node: TradeNode) => void;
  liveVessels?: Vessel[];
  liveFlights?: Flight[];
}

// ── Performance color (matches GlobeView) ───────────────────────────────────
function perfColor(changePct: number): string {
  const clamped = Math.max(-5, Math.min(5, changePct));
  const t = (clamped + 5) / 10;
  const r = Math.round(220 - t * 180);
  const g = Math.round(40 + t * 180);
  return `rgba(${r}, ${g}, 60, 0.75)`;
}

// ── Module-level GeoJSON cache (same pattern as GlobeView) ──────────────────
type Feature = { properties: Record<string, string>; geometry: any };
let geoCache: Feature[] | null = null;
let geoCachePromise: Promise<Feature[]> | null = null;

function loadGeo(): Promise<Feature[]> {
  if (geoCache) return Promise.resolve(geoCache);
  if (!geoCachePromise) {
    geoCachePromise = fetch(geoJsonUrl)
      .then((r) => r.json())
      .then((data) => {
        const features = (data.features as Feature[])
          .map((f) => {
            if (f.properties.ISO_A2 === "-99") {
              const override = ISO_OVERRIDES[f.properties.ADMIN];
              if (override) f.properties.ISO_A2 = override;
            }
            return f;
          })
          .filter((f) => f.properties.ISO_A2 !== "AQ");
        geoCache = features;
        return features;
      });
  }
  return geoCachePromise;
}

// ── D3 lazy-load cache (mirrors monitor-the-situation.com approach) ──────────
// D3 is only imported when MapView first mounts — keeps it off the critical path.
let d3Cache: any = null;
function loadD3(): Promise<any> {
  if (d3Cache) return Promise.resolve(d3Cache);
  return import("d3").then((d3) => { d3Cache = d3; return d3; });
}

interface ZoomTransform { x: number; y: number; k: number }
const IDENTITY: ZoomTransform = { x: 0, y: 0, k: 1 };

interface PathEntry { iso: string; admin: string; d: string }
interface PinEntry  { ex: ExchangeInfo; x: number; y: number }

// ── PathGen bundles the D3 objects needed to (re)compute paths + pin positions
interface PathGen {
  d3: any;
  pathFn: (f: Feature) => string | null;
  project: (lngLat: [number, number]) => [number, number] | null;
}

// ── Build an SVG path through a series of projected [x,y] points ────────────
// Handles date-line crossings: when two consecutive projected x-coordinates
// jump by more than 40% of the total map width, the route wraps around the
// edge of the flat map. We start a new sub-path (M) at that point so the
// renderer doesn't draw a horizontal line across the entire world.
function buildWaypointPath(pts: Array<[number, number]>, mapWidth: number): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px]   = pts[i - 1];
    // Date-line jump — restart sub-path instead of drawing across the world
    if (Math.abs(x - px) > mapWidth * 0.4) {
      d += ` M${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
  }
  return d;
}

export default function MapView({
  width,
  height,
  mode,
  performanceMap,
  selectedCountry,
  onCountryClick,
  showExchangePins = false,
  onExchangeClick,
  selectedExchange,
  tradePoints = [],
  tradeArcs   = [],
  selectedTradeNodeId = null,
  onTradeNodeClick,
  liveVessels = [],
  liveFlights = [],
}: MapViewProps) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<any>(null);

  // React-owned state
  const [features,   setFeatures]   = useState<Feature[]>(geoCache ?? []);
  const [pathGen,    setPathGen]     = useState<PathGen | null>(null);
  const [zoom,       setZoom]        = useState<ZoomTransform>(IDENTITY);
  const [hoverIso,   setHoverIso]    = useState<string | null>(null);
  const [isDragging, setIsDragging]  = useState(false);

  // Tooltip for countries
  const [countryTip, setCountryTip] = useState<{ x: number; y: number; iso: string } | null>(null);
  // Tooltip for exchange pins
  const [pinTip,     setPinTip]     = useState<{ ex: ExchangeInfo; x: number; y: number } | null>(null);

  // ── 1. Load GeoJSON + D3 in parallel on first mount ─────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadD3(), loadGeo()]).then(([d3, feats]) => {
      if (cancelled) return;
      setFeatures(feats);
    });
    return () => { cancelled = true; };
  }, []);

  // ── 2. (Re)build projection + path generator whenever size or features change
  useEffect(() => {
    if (!features.length) return;
    loadD3().then((d3) => {
      // Natural Earth projection — looks great at dashboard scale
      const proj = d3.geoNaturalEarth1()
        .scale(width / 6.3)
        .translate([width / 2, height / 1.95]);

      const pathFn = d3.geoPath().projection(proj);
      setPathGen({
        d3,
        pathFn,
        project: (lngLat: [number, number]) => proj(lngLat) as [number, number] | null,
      });
    });
  }, [features, width, height]);

  // ── 3. Wire up D3 zoom behavior once pathGen + SVG are ready ────────────
  useEffect(() => {
    if (!pathGen || !svgRef.current) return;
    const { d3 } = pathGen;

    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 10])
      .on("zoom", (event: any) => {
        const t = event.transform;
        setZoom({ x: t.x, y: t.y, k: t.k });
      })
      .on("start", () => setIsDragging(true))
      .on("end",   () => setIsDragging(false));

    d3.select(svgRef.current).call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      // Remove D3 zoom listeners on cleanup
      d3.select(svgRef.current).on(".zoom", null);
    };
  }, [pathGen]);

  // ── 4. Fly to selected country (pan + gentle zoom) ──────────────────────
  useEffect(() => {
    if (!selectedCountry || !pathGen || !svgRef.current || !zoomBehaviorRef.current) return;
    const meta = COUNTRY_META[selectedCountry];
    if (!meta) return;
    const { d3 } = pathGen;

    const pos = pathGen.project([meta.lng, meta.lat]);
    if (!pos) return;

    const targetK = Math.max(zoom.k, 3); // zoom in to at least 3× when selecting
    const tx = width  / 2 - pos[0] * targetK;
    const ty = height / 2 - pos[1] * targetK;

    d3.select(svgRef.current)
      .transition()
      .duration(700)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(targetK),
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  // ── 5. Fly to selected exchange ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedExchange || !pathGen || !svgRef.current || !zoomBehaviorRef.current) return;
    const { d3 } = pathGen;
    const pos = pathGen.project([selectedExchange.lng, selectedExchange.lat]);
    if (!pos) return;

    const targetK = Math.max(zoom.k, 4);
    const tx = width  / 2 - pos[0] * targetK;
    const ty = height / 2 - pos[1] * targetK;

    d3.select(svgRef.current)
      .transition()
      .duration(700)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(targetK),
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExchange]);

  // ── Derived: SVG path strings per country (recomputed only on geo/size change)
  const paths = useMemo<PathEntry[]>(() => {
    if (!pathGen || !features.length) return [];
    return features.flatMap((f) => {
      const d = pathGen.pathFn(f);
      if (!d) return [];
      return [{ iso: f.properties.ISO_A2, admin: f.properties.ADMIN, d }];
    });
  }, [pathGen, features]);

  // ── Derived: exchange pin SVG positions ─────────────────────────────────
  const pins = useMemo<PinEntry[]>(() => {
    if (!pathGen || !showExchangePins) return [];
    return EXCHANGES.flatMap((ex) => {
      const pos = pathGen.project([ex.lng, ex.lat]);
      if (!pos) return [];
      return [{ ex, x: pos[0], y: pos[1] }];
    });
  }, [pathGen, showExchangePins]);

  // ── Derived: projected trade node positions ──────────────────────────────
  const tradeNodePins = useMemo(() => {
    if (!pathGen || !tradePoints.length) return [];
    return tradePoints.flatMap((node) => {
      const pos = pathGen.project([node.lng, node.lat]);
      if (!pos) return [];
      return [{ node, x: pos[0], y: pos[1] }];
    });
  }, [pathGen, tradePoints]);

  // ── Derived: projected live vessel positions — viewport-culled ──────────
  const liveVesselPins = useMemo(() => {
    if (!pathGen || !liveVessels.length) return [];
    const margin = 20 / zoom.k;
    const minX = -zoom.x / zoom.k - margin;
    const maxX = minX + width  / zoom.k + 2 * margin;
    const minY = -zoom.y / zoom.k - margin;
    const maxY = minY + height / zoom.k + 2 * margin;
    return liveVessels.flatMap((v) => {
      const pos = pathGen.project([v.lng, v.lat]);
      if (!pos) return [];
      const [x, y] = pos;
      if (x < minX || x > maxX || y < minY || y > maxY) return [];
      return [{ mmsi: v.mmsi, x: pos[0], y: pos[1] }];
    });
  }, [pathGen, liveVessels, zoom.x, zoom.y, zoom.k, width, height]);

  // ── Derived: projected live flight positions — viewport-culled ───────────
  // "Lazy loading" for the flat map: only create SVG <circle> elements for
  // aircraft that project inside the current visible viewport (+ 20 px margin).
  // A global OpenSky response has 8k-12k aircraft; without culling, the full
  // DOM tree is built and layout/paint runs on ~10k off-screen circles every
  // render.  With culling, at default zoom only ~1k are visible; zoomed-in
  // on a region the count drops further, matching what the eye actually needs.
  const liveFlightPins = useMemo(() => {
    if (!pathGen || !liveFlights.length) return [];
    // Convert screen-space viewport bounds to pre-transform map coordinates
    const margin = 20 / zoom.k;
    const minX = -zoom.x / zoom.k - margin;
    const maxX = minX + width  / zoom.k + 2 * margin;
    const minY = -zoom.y / zoom.k - margin;
    const maxY = minY + height / zoom.k + 2 * margin;

    return liveFlights.flatMap((f) => {
      const pos = pathGen.project([f.lng, f.lat]);
      if (!pos) return [];
      const [x, y] = pos;
      if (x < minX || x > maxX || y < minY || y > maxY) return [];
      return [{ icao24: f.icao24, x, y }];
    });
  }, [pathGen, liveFlights, zoom.x, zoom.y, zoom.k, width, height]);

  // ── Derived: projected trade route paths (smoothed waypoints) ────────────
  // The Catmull-Rom smoother (./smoothing.ts) densifies the route's high-
  // level waypoint chain into ~150 points along a smooth curve. We then
  // project each through D3's Natural Earth projection. The resulting SVG
  // path uses many short L segments — at this density the eye reads it
  // as a continuous curve, matching the slow turning radii ships use.
  const tradeArcPaths = useMemo(() => {
    if (!pathGen || !tradeArcs.length) return [];
    return tradeArcs.flatMap((arc) => {
      const smoothed = smoothRouteCoords(arc, 10); // [lng, lat]
      const projected = smoothed
        .map(([lng, lat]) => pathGen.project([lng, lat]))
        .filter((p): p is [number, number] => p !== null);
      if (projected.length < 2) return [];
      return [{ arc, d: buildWaypointPath(projected, width) }];
    });
  }, [pathGen, tradeArcs, width]);

  // ── Country fill color ───────────────────────────────────────────────────
  const getCountryFill = useCallback((iso: string): string => {
    if (showExchangePins) {
      if (iso === selectedCountry) return "rgba(255,255,255,0.12)";
      if (iso === hoverIso)        return "rgba(255,255,255,0.08)";
      return "rgba(0,0,0,0)";
    }
    if (iso === selectedCountry) return "rgba(255,255,255,0.55)";
    if (iso === hoverIso)        return "rgba(255,255,255,0.22)";
    if (mode === "flags") {
      return FLAG_COLORS[iso] ? `${FLAG_COLORS[iso]}b3` : "rgba(80,80,80,0.3)";
    }
    const change = performanceMap[iso];
    if (change === undefined) return "rgba(80,80,80,0.2)";
    return perfColor(change);
  }, [mode, performanceMap, selectedCountry, hoverIso, showExchangePins]);

  const getStroke = useCallback((iso: string): string => {
    if (iso === selectedCountry) return "rgba(255,255,255,0.75)";
    if (iso === hoverIso)        return "rgba(255,255,255,0.50)";
    return showExchangePins ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.22)";
  }, [selectedCountry, hoverIso, showExchangePins]);

  // ── Zoom control helpers ─────────────────────────────────────────────────
  const zoomBy = useCallback((factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current || !pathGen) return;
    pathGen.d3.select(svgRef.current)
      .transition().duration(250)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  }, [pathGen]);

  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current || !pathGen) return;
    pathGen.d3.select(svgRef.current)
      .transition().duration(400)
      .call(zoomBehaviorRef.current.transform, pathGen.d3.zoomIdentity);
  }, [pathGen]);

  // Tooltip clamping: keep tooltip inside the panel
  const clampX = (x: number) => Math.min(x, width  - 160);
  const clampY = (y: number) => Math.max(y - 50, 8);

  // Border radius scales down as we zoom in so thin lines stay crisp
  const sw = 1 / zoom.k;

  return (
    <div style={{ width, height, position: "relative", overflow: "hidden" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          display: "block",
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        {/* All map content lives inside this group — D3 zoom transforms it */}
        <g transform={`translate(${zoom.x},${zoom.y}) scale(${zoom.k})`}>

          {/* ── Country fills ── */}
          {paths.map(({ iso, d }) => (
            <path
              key={iso}
              d={d}
              fill={getCountryFill(iso)}
              stroke={getStroke(iso)}
              strokeWidth={sw * 0.8}
              style={{ cursor: "pointer", transition: "fill 0.12s" }}
              onMouseEnter={(e) => {
                setHoverIso(iso);
                const rect = svgRef.current!.getBoundingClientRect();
                setCountryTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, iso });
              }}
              onMouseMove={(e) => {
                const rect = svgRef.current!.getBoundingClientRect();
                setCountryTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, iso });
              }}
              onMouseLeave={() => { setHoverIso(null); setCountryTip(null); }}
              onClick={(e) => {
                e.stopPropagation();
                onCountryClick(iso);
              }}
            />
          ))}

          {/* ── Trade arcs (below nodes) ── */}
          {tradeArcPaths.map(({ arc, d }) => {
            const color   = ROUTE_COLOR[arc.mode as keyof typeof ROUTE_COLOR] ?? '#94a3b8';
            const opacity = 0.25 + (arc.importance / 100) * 0.30;
            return (
              <path
                key={arc.id}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={(0.8 + (arc.importance / 100) * 0.7) / zoom.k}
                strokeOpacity={opacity}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* ── Live AIS vessels ──
              Simple filled circles. Baseline r = 2.5/zoom.k × 1.15 ≈ 2.875,
              floor 0.69 (was 0.6). pointerEvents none — read-only layer. */}
          {liveVesselPins.map(({ mmsi, x, y }) => (
            <circle
              key={mmsi}
              cx={x} cy={y}
              r={Math.max(0.69, 2.875 / zoom.k)}
              fill="#67e8f9"
              fillOpacity={0.95}
              stroke="#0f172a"
              strokeWidth={0.3 / zoom.k}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* ── Live flights (OpenSky) — purple dots above vessels ── */}
          {liveFlightPins.map(({ icao24, x, y }) => (
            <circle
              key={icao24}
              cx={x} cy={y}
              r={Math.max(0.5, 2.0 / zoom.k)}
              fill="#a855f7"
              fillOpacity={0.9}
              stroke="#0f172a"
              strokeWidth={0.2 / zoom.k}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* ── Trade nodes (above arcs) ── */}
          {tradeNodePins.map(({ node, x, y }) => {
            const color      = NODE_COLOR[node.kind] ?? '#94a3b8';
            const isSelected = selectedTradeNodeId === node.id;
            const r          = (3 + (node.importance / 100) * 2.5) / zoom.k;
            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onTradeNodeClick?.(node); }}
              >
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.75}
                  stroke={isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)'}
                  strokeWidth={(isSelected ? 1.5 : 0.7) / zoom.k}
                >
                  <title>{node.name}</title>
                </circle>
              </g>
            );
          })}

          {/* ── Exchange pins ── */}
          {pins.map(({ ex, x, y }) => {
            const color      = CONTINENT_COLORS[ex.continent] ?? "#888";
            const isSelected = selectedExchange?.code === ex.code;
            const r          = (isSelected ? 7 : 5) / zoom.k;
            return (
              <g
                key={ex.code}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => {
                  setPinTip({
                    ex,
                    x: x * zoom.k + zoom.x,
                    y: y * zoom.k + zoom.y,
                  });
                }}
                onMouseLeave={() => setPinTip(null)}
                onClick={(e) => { e.stopPropagation(); onExchangeClick?.(ex); }}
              >
                {/* Glow ring for selected exchange */}
                {isSelected && (
                  <circle cx={x} cy={y} r={r * 1.8}
                    fill="none" stroke={color} strokeWidth={1.2 / zoom.k} opacity={0.45} />
                )}
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={1.5 / zoom.k}
                  style={{ filter: `drop-shadow(0 0 ${3 / zoom.k}px ${color})` }}
                />
              </g>
            );
          })}
        </g>

        {/* Subtle vignette overlay — matches the globe's atmosphere feel */}
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(2,4,10,0.55)" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#map-vignette)" pointerEvents="none" />
      </svg>

      {/* ── Country tooltip ── */}
      {countryTip && hoverIso && !showExchangePins && (
        <div
          style={{
            position: "absolute",
            left: clampX(countryTip.x + 14),
            top:  clampY(countryTip.y),
            pointerEvents: "none",
            background: "rgba(0,0,0,0.82)",
            border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 12,
            color: "#fff",
            whiteSpace: "nowrap",
            zIndex: 20,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {COUNTRY_META[hoverIso]?.name ?? hoverIso}
          </div>
          {mode === "performance" && performanceMap[hoverIso] !== undefined && (
            <div style={{ opacity: 0.7, marginTop: 2, fontFamily: "monospace" }}>
              {performanceMap[hoverIso] >= 0 ? "+" : ""}
              {performanceMap[hoverIso].toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* ── Exchange pin tooltip ── */}
      {pinTip && (
        <div
          style={{
            position: "absolute",
            left: clampX(pinTip.x + 14),
            top:  Math.max(pinTip.y - 52, 8),
            pointerEvents: "none",
            background: "rgba(0,0,0,0.88)",
            borderLeft: `3px solid ${CONTINENT_COLORS[pinTip.ex.continent] ?? "#888"}`,
            borderRadius: 5,
            padding: "5px 9px",
            fontSize: 11,
            color: "#fff",
            whiteSpace: "nowrap",
            zIndex: 20,
          }}
        >
          <div style={{ fontWeight: 600 }}>{pinTip.ex.name}</div>
          <div style={{ opacity: 0.7, marginTop: 1 }}>
            {pinTip.ex.city} · {pinTip.ex.code}
          </div>
        </div>
      )}

      {/* ── Zoom controls (bottom-right) ── */}
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {[
          { label: "+", title: "Zoom in",    onClick: () => zoomBy(1.6) },
          { label: "−", title: "Zoom out",   onClick: () => zoomBy(0.625) },
          { label: "⊙", title: "Reset view", onClick: resetZoom },
        ].map(({ label, title, onClick }) => (
          <button
            key={label}
            title={title}
            onClick={onClick}
            style={{
              width: 28, height: 28,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 5,
              color: "#cde",
              fontSize: label === "⊙" ? 13 : 17,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state while D3 + geo initialise */}
      {!paths.length && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.35)", fontSize: 13,
          pointerEvents: "none",
        }}>
          Loading map…
        </div>
      )}
    </div>
  );
}
