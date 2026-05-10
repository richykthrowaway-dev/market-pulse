import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useIndices } from "@/hooks/useSupabaseData";
import { REGION_TO_ISO } from "@/data/countryMeta";
import { cn } from "@/lib/utils";
import { Globe as GlobeIcon, ArrowLeft, Loader2, RotateCw, Pause, Map } from "lucide-react";
import { useNavigate } from "react-router-dom";
const GlobeView = lazy(() => import("@/components/global/GlobeView"));
const MapView  = lazy(() => import("@/components/global/MapView"));
import CountryPanel from "@/components/global/CountryPanel";
import GlobalSummary from "@/components/global/GlobalSummary";
import ExchangeDetailDialog from "@/components/global/ExchangeDetailDialog";
import { ConflictEventDialog } from "@/components/global/trade/ConflictEventDialog";
import { EarthquakeDialog } from "@/components/global/trade/EarthquakeDialog";
import type { ExchangeInfo } from "@/data/exchangeData";
import {
  getVisibleNodes, getVisibleRoutes,
  type LayerKey, type TradeNode,
} from "@/data/tradeInfrastructure";
import { useAISStream } from "@/hooks/useAISStream";
import { useOpenSkyFlights } from "@/hooks/useOpenSkyFlights";
import { useConflictEvents, type ConflictEvent } from "@/hooks/useConflictEvents";
import { useEarthquakes, type EarthquakeEvent } from "@/hooks/useEarthquakes";

// ── Realistic space background — NASA Tycho-2 Skymap ────────────────────
// 4096×2048 photographic-quality star map covering the entire celestial
// sphere, rendered from the Tycho-2 catalog (the same star catalog used
// for HST guide stars). Public domain (NASA SVS, work of US government).
//
// The image is bright in places (Milky Way band is luminous), so the
// rendering layer below applies a heavy dark overlay to keep it
// atmospheric — the dominant impression should be deep space with the
// globe as the focal point, not a flashy sky photo competing for
// attention.
//
// Loaded from NASA's CDN directly. CSS background-image bypasses CORS,
// browser-caches the image after first load, and NASA SVS URLs have
// been stable for 10+ years.
const NASA_TYCHO_SKYMAP_URL =
  "https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003572/TychoSkymapII.t5_04096x02048.jpg";

// ── Overlay stack painted on top of the NASA photo ──────────────────────
// Order matters: in CSS multi-background syntax, EARLIER layers paint
// ON TOP. Listed front-to-back here (the photo URL itself is applied
// separately as the base layer in the JSX).
//
// Three goals:
//   1. Heavy darkening — the Tycho skymap is photographically bright
//      (Milky Way is luminous). A 0.62 alpha black overlay drops the
//      perceived brightness so it reads as "deep space."
//   2. Subtle backlight glow behind the globe — keeps the atmosphere
//      shader feeling like it has light to work with.
//   3. Strong vignette — anchors the eye toward the globe at center.
const SPACE_OVERLAY = [
  // Backlight halo behind the globe (front layer) — alphas reduced 25%
  // (0.10 → 0.075, 0.06 → 0.045) to tone down the aura around the Earth.
  "radial-gradient(circle at 50% 50%, rgba(80,135,200,0.075) 0%, rgba(40,80,140,0.045) 18%, transparent 42%)",
  // Strong vignette
  "radial-gradient(ellipse at 50% 50%, transparent 28%, rgba(0,0,0,0.60) 78%, rgba(0,0,0,0.85) 100%)",
  // Darkening tint — dropped from 0.62 → 0.45 so the Milky Way band of
  // the NASA photo reads more clearly through the overlay.
  "linear-gradient(rgba(0,0,2,0.45), rgba(0,0,2,0.45))",
].join(",");


type GlobeMode = "flags" | "performance";

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = 0;
    let pendingW = 0;
    let pendingH = 0;
    const ro = new ResizeObserver(([entry]) => {
      pendingW = Math.floor(entry.contentRect.width);
      pendingH = Math.floor(entry.contentRect.height);
      // Coalesce to 1 React update per frame; skip no-ops
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          setSize(prev =>
            prev.width === pendingW && prev.height === pendingH
              ? prev
              : { width: pendingW, height: pendingH }
          );
        });
      }
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [ref]);
  return size;
}

const Global = () => {
  const navigate = useNavigate();
  const { data: indices = [] } = useIndices();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mode, setMode] = useState<GlobeMode>("flags");
  const [showExchangePins, setShowExchangePins] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeInfo | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [flatMap, setFlatMap] = useState(false);

  // ── Global Trade Infrastructure state ───────────────────────────────
  // Lives at the Global-page level so both the GlobeView (left half) and
  // CountryPanel.TradeInfrastructurePanel (right half) read the same
  // active layers / selected node / scope. Default to no layers active
  // — the user enables them when they open the Trade tab.
  const [tradeActiveLayers, setTradeActiveLayers] = useState<Set<LayerKey>>(new Set());
  const [tradeSelectedNode, setTradeSelectedNode] = useState<TradeNode | null>(null);
  const [tradeWorldwide, setTradeWorldwide] = useState(true);
  // Tracks whether the Trade tab is the currently visible CountryPanel
  // tab — gates whether we feed overlay data to the globe at all. Avoids
  // the "ports show on globe even though user is on Economy tab" bug.
  const [tradeTabActive, setTradeTabActive] = useState(false);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const { width: leftW, height: leftH } = useContainerSize(leftRef);

  // Lock page scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Build performance map from index data.
  // Uses a ref to preserve object identity when values haven't changed —
  // prevents downstream getCapColor callback recreation on every React Query refetch.
  const prevPerfMapRef = useRef<Record<string, number>>({});
  const performanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const idx of indices) {
      const iso = REGION_TO_ISO[idx.region];
      if (iso) map[iso] = idx.changePercent;
    }
    const prev = prevPerfMapRef.current;
    const keys = Object.keys(map);
    if (
      keys.length === Object.keys(prev).length &&
      keys.every(k => prev[k] === map[k])
    ) {
      return prev; // same data → same reference → no callback cascade
    }
    prevPerfMapRef.current = map;
    return map;
  }, [indices]);

  const handleCountryClick = useCallback((iso2: string) => {
    setSelectedCountry(iso2);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedCountry(null);
    setShowExchangePins(false);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setShowExchangePins(tab === "exchanges");
    setTradeTabActive(tab === "trade");
  }, []);

  const handleExchangeClick = useCallback((ex: ExchangeInfo) => {
    setSelectedExchange(ex);
  }, []);

  const handleExchangeClose = useCallback(() => {
    setSelectedExchange(null);
  }, []);

  // ── Resolve visible trade nodes/routes from layer toggles + scope ───
  // When `tradeWorldwide` is false and a country is selected, we filter
  // to just the infrastructure that has `countryISO2 === selectedCountry`
  // OR routes whose endpoints touch a node in that country. This keeps
  // the country-scoped view focused while preserving the option to
  // expand to global with one click.
  const allVisibleNodes  = useMemo(
    () => (tradeTabActive ? getVisibleNodes(tradeActiveLayers)  : []),
    [tradeActiveLayers, tradeTabActive],
  );
  const allVisibleRoutes = useMemo(
    () => (tradeTabActive ? getVisibleRoutes(tradeActiveLayers) : []),
    [tradeActiveLayers, tradeTabActive],
  );

  const tradeVisibleNodes = useMemo(() => {
    if (tradeWorldwide || !selectedCountry) return allVisibleNodes;
    return allVisibleNodes.filter((n) => n.countryISO2 === selectedCountry);
  }, [allVisibleNodes, tradeWorldwide, selectedCountry]);

  const tradeVisibleRoutes = useMemo(() => {
    if (tradeWorldwide || !selectedCountry) return allVisibleRoutes;
    // Keep routes only when at least one endpoint coincides with a
    // visible (country-scoped) node — preserves the "see what touches
    // this country" intent.
    const visibleCoords = new Set(
      tradeVisibleNodes.map((n) => `${n.lat.toFixed(2)},${n.lng.toFixed(2)}`),
    );
    return allVisibleRoutes.filter((r) =>
      visibleCoords.has(`${r.startLat.toFixed(2)},${r.startLng.toFixed(2)}`) ||
      visibleCoords.has(`${r.endLat.toFixed(2)},${r.endLng.toFixed(2)}`),
    );
  }, [allVisibleRoutes, tradeWorldwide, selectedCountry, tradeVisibleNodes]);

  const handleTradeSelectNode = useCallback((n: TradeNode | null) => {
    setTradeSelectedNode(n);
  }, []);

  const handleTradeNodeClick = useCallback((n: TradeNode) => {
    setTradeSelectedNode(n);
  }, []);

  const handleToggleTradeWorldwide = useCallback(() => {
    setTradeWorldwide((v) => !v);
  }, []);

  // ── Live AIS vessel feed ─────────────────────────────────────────────
  // Connect ONLY when the Trade tab is active AND the user has flipped
  // on the 'liveVessels' overlay layer. Toggling either off tears the
  // WebSocket down so we don't burn AISStream rate-limit credits in the
  // background.
  const liveVesselsEnabled =
    tradeTabActive && tradeActiveLayers.has('liveVessels');
  const {
    vessels: liveVessels,
    status: aisStatus,
    vesselCount: aisVesselCount,
    rawMsgCount: aisRawMsgCount,
  } = useAISStream(liveVesselsEnabled);

  // ── Live OpenSky flight feed ─────────────────────────────────────────
  // Poll ONLY when the Trade tab is active AND the 'liveFlights' layer
  // is toggled on. Mirrors the AIS gate above to prevent background
  // HTTP requests when the user isn't looking at the Trade overlay.
  const liveFlightsEnabled =
    tradeTabActive && tradeActiveLayers.has('liveFlights');
  const {
    flights: liveFlights,
    status: flightStatus,
    flightCount,
  } = useOpenSkyFlights(liveFlightsEnabled);

  // ── Conflict events feed (ACLED + GDELT, gated on layer toggle) ─────
  // Same gating pattern as the AIS/flight feeds: only fetch when the
  // user has actively turned the layer on, so we don't burn the edge
  // function or external API quotas in the background.
  const conflictEventsEnabled =
    tradeTabActive && tradeActiveLayers.has('conflictEvents');
  const conflictEventsQuery = useConflictEvents();
  const conflictEvents = conflictEventsEnabled
    ? conflictEventsQuery.data?.events
    : undefined;
  const [selectedEvent, setSelectedEvent] = useState<ConflictEvent | null>(null);
  const onConflictEventClick = useCallback((e: ConflictEvent) => {
    setSelectedEvent(e);
  }, []);

  // ── USGS earthquake feed (gated on layer toggle) ─────────────────────
  const earthquakesEnabled =
    tradeTabActive && tradeActiveLayers.has('earthquakes');
  const earthquakesQuery = useEarthquakes(earthquakesEnabled);
  const earthquakeEvents = earthquakesEnabled
    ? earthquakesQuery.data
    : undefined;
  const [selectedEarthquake, setSelectedEarthquake] = useState<EarthquakeEvent | null>(null);
  const onEarthquakeEventClick = useCallback((e: EarthquakeEvent) => {
    setSelectedEarthquake(e);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 -ml-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <GlobeIcon className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Global Investment Hub</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Flat map toggle */}
          <button
            onClick={() => setFlatMap(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs transition-colors",
              flatMap ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-muted-foreground"
            )}
            title={flatMap ? "Switch to 3D globe" : "Switch to flat map"}
          >
            <Map className="h-3 w-3" />
            <span>{flatMap ? "Flat Map" : "3D Globe"}</span>
          </button>

          {/* Spin toggle — only relevant for 3D globe */}
          {!flatMap && (
            <button
              onClick={() => setAutoRotate(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs transition-colors",
                autoRotate ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-muted-foreground"
              )}
              title={autoRotate ? "Pause spin" : "Resume spin"}
              aria-pressed={autoRotate}
            >
              {autoRotate ? <RotateCw className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              <span>{autoRotate ? "Spin On" : "Spin Off"}</span>
            </button>
          )}

          {/* Mode Toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              className={cn(
                "px-3 py-1 transition-colors",
                mode === "flags" && !showExchangePins
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              onClick={() => { setMode("flags"); setShowExchangePins(false); }}
            >
              Flags
            </button>
            <button
              className={cn(
                "px-3 py-1 transition-colors",
                mode === "performance" && !showExchangePins
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              onClick={() => { setMode("performance"); setShowExchangePins(false); }}
            >
              Performance
            </button>
            <button
              className={cn(
                "px-3 py-1 transition-colors",
                showExchangePins
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
              onClick={() => setShowExchangePins(v => !v)}
            >
              Exchanges
            </button>
          </div>
        </div>
      </div>

      {/* 50/50 Split */}
      <div className="flex-1 flex min-h-0">
        {/* Left — Globe with NASA Tycho-2 Skymap background */}
        <div ref={leftRef} className="w-1/2 relative overflow-hidden">
          {/* Base layer — real photographic star map from NASA SVS.
              Fills the container via `cover` and is biased vertically
              so the Milky Way band typically appears in the lower half
              of the visible crop, behind the globe's lower hemisphere. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:    `url(${NASA_TYCHO_SKYMAP_URL})`,
              backgroundSize:     "cover",
              backgroundPosition: "50% 60%",
              backgroundColor:    "#000",   // shown until photo loads
              willChange:         "transform",
              contain:            "strict",
            }}
          />

          {/* Overlay — heavy darkening tint + vignette + globe backlight
              glow. One compositor layer, all GPU-blended. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: SPACE_OVERLAY,
              willChange: "transform",
              contain:    "strict",
            }}
          />
          {leftW > 0 && leftH > 0 && (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                </div>
              }
            >
              {flatMap ? (
                <MapView
                  width={leftW}
                  height={leftH}
                  mode={mode}
                  performanceMap={performanceMap}
                  selectedCountry={selectedCountry}
                  onCountryClick={handleCountryClick}
                  showExchangePins={showExchangePins}
                  onExchangeClick={handleExchangeClick}
                  selectedExchange={selectedExchange}
                  tradePoints={tradeTabActive ? tradeVisibleNodes : undefined}
                  tradeArcs={tradeTabActive ? tradeVisibleRoutes : undefined}
                  selectedTradeNodeId={tradeSelectedNode?.id ?? null}
                  onTradeNodeClick={handleTradeNodeClick}
                  liveVessels={liveVesselsEnabled ? liveVessels : undefined}
                  liveFlights={liveFlightsEnabled ? liveFlights : undefined}
                />
              ) : (
                <GlobeView
                  width={leftW}
                  height={leftH}
                  mode={mode}
                  performanceMap={performanceMap}
                  selectedCountry={selectedCountry}
                  onCountryClick={handleCountryClick}
                  showExchangePins={showExchangePins}
                  onExchangeClick={handleExchangeClick}
                  selectedExchange={selectedExchange}
                  autoRotate={autoRotate}
                  tradePoints={tradeTabActive ? tradeVisibleNodes : undefined}
                  tradeArcs={tradeTabActive ? tradeVisibleRoutes : undefined}
                  selectedTradeNodeId={tradeSelectedNode?.id ?? null}
                  onTradeNodeClick={handleTradeNodeClick}
                  liveVessels={liveVesselsEnabled ? liveVessels : undefined}
                  liveFlights={liveFlightsEnabled ? liveFlights : undefined}
                  conflictEvents={conflictEvents}
                  onConflictEventClick={onConflictEventClick}
                  earthquakeEvents={earthquakeEvents}
                  onEarthquakeEventClick={onEarthquakeEventClick}
                />
              )}
            </Suspense>
          )}

          {/* Exchange detail card — anchored to bottom-center of globe area */}
          <ExchangeDetailDialog exchange={selectedExchange} onClose={handleExchangeClose} />

          {/* Conflict event detail — shows affected commodities + alert seed */}
          <ConflictEventDialog
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onSetAlert={(commodityId) => {
              console.log('[alerts] User wants alerts for commodity:', commodityId);
            }}
          />

          {/* Earthquake detail — magnitude, depth, tsunami flag, affected supply chains */}
          <EarthquakeDialog
            event={selectedEarthquake}
            onClose={() => setSelectedEarthquake(null)}
            onSetAlert={(commodityId) => {
              console.log('[alerts] User wants alerts for commodity:', commodityId);
            }}
          />
        </div>

        {/* Right — Panel */}
        <div className="w-1/2 border-l border-border bg-card overflow-hidden">
          {selectedCountry ? (
            <CountryPanel
              key={selectedCountry}
              iso2={selectedCountry}
              onClose={handleClose}
              onTabChange={handleTabChange}
              onExchangeClick={handleExchangeClick}
              tradeActiveLayers={tradeActiveLayers}
              onTradeLayersChange={setTradeActiveLayers}
              tradeSelectedNode={tradeSelectedNode}
              onTradeSelectNode={handleTradeSelectNode}
              tradeVisibleNodes={tradeVisibleNodes}
              tradeVisibleRoutes={tradeVisibleRoutes}
              tradeWorldwide={tradeWorldwide}
              onToggleTradeWorldwide={handleToggleTradeWorldwide}
              aisStatus={aisStatus}
              aisVesselCount={aisVesselCount}
              aisRawMsgCount={aisRawMsgCount}
              flightStatus={flightStatus}
              flightCount={flightCount}
            />
          ) : (
            <GlobalSummary onCountryClick={handleCountryClick} />
          )}
        </div>
      </div>

    </div>
  );
};

export default Global;
