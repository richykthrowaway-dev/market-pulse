import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useIndices } from "@/hooks/useSupabaseData";
import { REGION_TO_ISO, COUNTRY_META } from "@/data/countryMeta";
import { cn } from "@/lib/utils";
import { useTradeBreakdown } from "@/hooks/useTradeBreakdown";
import type { PartnerArc } from "@/components/global/GlobeView";
import { Globe as GlobeIcon, ArrowLeft, Loader2, RotateCw, Pause, Map, Sun, Moon, Palette, PaintBucket } from "lucide-react";
import { useNavigate } from "react-router-dom";
const GlobeView = lazy(() => import("@/components/global/GlobeView"));
const MapView  = lazy(() => import("@/components/global/MapView"));
import CountryPanel from "@/components/global/CountryPanel";
import GlobalSummary from "@/components/global/GlobalSummary";
import ExchangeDetailDialog from "@/components/global/ExchangeDetailDialog";
import { ConflictEventDialog } from "@/components/global/trade/ConflictEventDialog";
import { EarthquakeDialog } from "@/components/global/trade/EarthquakeDialog";
import { NaturalEventDialog } from "@/components/global/trade/NaturalEventDialog";
import { TradePartnersDialog } from "@/components/global/trade/TradePartnersDialog";
import type { ExchangeInfo } from "@/data/exchangeData";
import {
  getVisibleNodes, getVisibleRoutes,
  type LayerKey, type TradeNode,
} from "@/data/tradeInfrastructure";
import { useAISStream, matchesVesselType, type VesselTypeFilter } from "@/hooks/useAISStream";
import { useOpenSkyFlights } from "@/hooks/useOpenSkyFlights";
import { useConflictEvents, type ConflictEvent } from "@/hooks/useConflictEvents";
import { useEarthquakes, type EarthquakeEvent } from "@/hooks/useEarthquakes";
import { useNaturalEvents, type NaturalEvent } from "@/hooks/useNaturalEvents";
import { useEconomicEvents, type EconomicEvent } from "@/hooks/useEconomicEvents";
import { useMacroHeatmap } from "@/hooks/useMacroHeatmap";
import { EconomicEventDialog } from "@/components/global/trade/EconomicEventDialog";

// ── Lightweight CSS starfield (replaces NASA Tycho-2 4.16 MB photo) ──────
// Generated once at module load: ~140 tiny circles at deterministic positions
// (seeded PRNG so the pattern is stable across reloads).  Serialised as an
// inline SVG data URL (~3 KB) and tiled via CSS background-image — zero
// network round-trips, no decode stall on first paint.
//
// We trade the photographic Milky-Way band for the perceived-perf win.  The
// dark overlay + vignette + globe backlight stack below still gives the
// "deep space" atmosphere, which is what the photo was contributing 90% of.
function makeStarfieldDataUrl(seed = 1): string {
  // Tiny mulberry32 PRNG — deterministic so the same starfield ships in
  // every build, won't trigger re-paints on re-render, and gzips well.
  let s = seed;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const W = 800;
  const H = 800;
  const stars: string[] = [];
  for (let i = 0; i < 140; i++) {
    const cx = (rng() * W).toFixed(1);
    const cy = (rng() * H).toFixed(1);
    // Size + brightness: most stars tiny (0.4–0.8 px), a few "bright" ones
    const r = (0.35 + rng() * (rng() < 0.1 ? 1.1 : 0.4)).toFixed(2);
    const o = (0.45 + rng() * 0.5).toFixed(2);
    stars.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${o}"/>`);
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>` +
    `<rect width='${W}' height='${H}' fill='#02030a'/>` +
    stars.join('') +
    `</svg>`;
  // URI-encode just `#` and `<>` (smaller than full encodeURIComponent)
  return `url("data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

const STARFIELD_BG = makeStarfieldDataUrl(42);

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
  // Default OFF — most users find the spin distracting when inspecting data.
  const [autoRotate, setAutoRotate] = useState(false);
  // Real day/night cycle: when on, sun position is computed from current UTC
  // time + axial tilt, and the side facing away from the sun is darkened.
  const [dayNightCycle, setDayNightCycle] = useState(false);
  // Country polygon fills — toggle off to see the bare globe texture (most
  // useful in combination with the day/night cycle so the terminator is fully
  // visible without the opaque country layer above it).
  const [showCountryColors, setShowCountryColors] = useState(true);
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
    vessels: liveVesselsRaw,
    status: aisStatus,
    vesselCount: aisVesselCount,
    rawMsgCount: aisRawMsgCount,
  } = useAISStream(liveVesselsEnabled);

  // ── Vessel type filter ──────────────────────────────────────────────
  // Lets the user narrow the globe (and Intel metrics) to a single
  // ship class — e.g. "Tankers only" during a Red Sea oil-tanker
  // diversion event.  State lives here so the same filter is shared
  // between the globe rendering and the Intel-view metrics.
  const [vesselTypeFilter, setVesselTypeFilter] = useState<VesselTypeFilter>('all');
  const liveVessels = useMemo(
    () => vesselTypeFilter === 'all'
      ? liveVesselsRaw
      : liveVesselsRaw.filter(v => matchesVesselType(v, vesselTypeFilter)),
    [liveVesselsRaw, vesselTypeFilter],
  );

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
  const conflictEventsQuery = useConflictEvents(conflictEventsEnabled);
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

  // ── NASA EONET natural events ──────────────────────────────────────────
  // Per-category gating: each natural-event category fires its own EONET
  // query, with parameters tuned to that category's volume + freshness.
  // Toggling on Wildfires alone fires only the wildfires query; toggling
  // Storms also fires only the storms query.  This avoids the "wildfires
  // drown out everything else" pathology of the previous single-fetch
  // design where storms (rare globally) got pushed off the response.
  const naturalEnabledMap = useMemo(() => ({
    wildfires:    tradeTabActive && tradeActiveLayers.has('wildfires'),
    severeStorms: tradeTabActive && tradeActiveLayers.has('severeStorms'),
    volcanoes:    tradeTabActive && tradeActiveLayers.has('volcanoes'),
    floods:       tradeTabActive && tradeActiveLayers.has('floods'),
  }), [tradeTabActive, tradeActiveLayers]);
  const naturalEventsQuery = useNaturalEvents(naturalEnabledMap);
  // The hook only returns events for enabled categories, so no extra
  // client-side filter is needed.  We keep the variable for prop plumbing.
  const naturalEvents = naturalEventsQuery.data;
  const [selectedNaturalEvent, setSelectedNaturalEvent] = useState<NaturalEvent | null>(null);
  const onNaturalEventClick = useCallback((e: NaturalEvent) => {
    setSelectedNaturalEvent(e);
  }, []);

  // ── EODHD economic events calendar (gated on layer toggle) ──────────
  const economicEventsEnabled =
    tradeTabActive && tradeActiveLayers.has('economicEvents');
  const economicEventsQuery = useEconomicEvents(economicEventsEnabled);
  const economicEvents = economicEventsEnabled
    ? economicEventsQuery.data?.events
    : undefined;
  const [selectedEconEvent, setSelectedEconEvent] = useState<EconomicEvent | null>(null);
  const onEconomicEventClick = useCallback((e: EconomicEvent) => {
    setSelectedEconEvent(e);
  }, []);

  // ── EODHD macro heatmap (gated on layer toggle) ──────────────────────
  const macroHeatmapEnabled =
    tradeTabActive && tradeActiveLayers.has('macroHeatmap');
  const macroHeatmapQuery = useMacroHeatmap(macroHeatmapEnabled);
  // Pass null when disabled so GlobeView reverts to its normal color mode
  const macroHeatmap = macroHeatmapEnabled
    ? macroHeatmapQuery.data?.data
    : undefined;

  // ── City label toggle ────────────────────────────────────────────────
  const cityLabelsEnabled =
    tradeTabActive && tradeActiveLayers.has('cityLabels');

  // ── Waterways toggle ─────────────────────────────────────────────────
  const waterwaysEnabled =
    tradeTabActive && tradeActiveLayers.has('waterways');

  // ── Trade partner arcs ───────────────────────────────────────────────
  // Fetch WITS top-partner data for the selected country when the Trade
  // tab is open.  Converts partner rows (ISO2 + share) to PartnerArc
  // objects by looking up country centroids from COUNTRY_META.
  // Export arcs: emerald, flow outward from selected country.
  // Import arcs: amber, flow inward toward selected country.
  const partnerArcsEnabled =
    tradeTabActive
    && !!selectedCountry
    && tradeActiveLayers.has('tradePartnerArcs');
  const exportPartnersQuery = useTradeBreakdown(
    partnerArcsEnabled ? selectedCountry : null,
    'exports',
    'partners',
  );
  const importPartnersQuery = useTradeBreakdown(
    partnerArcsEnabled ? selectedCountry : null,
    'imports',
    'partners',
  );
  const partnerArcs = useMemo((): PartnerArc[] | undefined => {
    if (!partnerArcsEnabled || !selectedCountry) return undefined;
    const src = COUNTRY_META[selectedCountry];
    if (!src) return undefined;

    const arcs: PartnerArc[] = [];

    // Export destinations — emerald green arcs flowing outward
    for (const p of (exportPartnersQuery.data?.products ?? []).slice(0, 8)) {
      const dest = COUNTRY_META[p.code];
      if (!dest) continue;
      arcs.push({
        startLat: src.lat,
        startLng: src.lng,
        endLat:   dest.lat,
        endLng:   dest.lng,
        color:    '#22c55e',
        label:    `Export → ${p.name}: ${(p.share * 100).toFixed(1)}%`,
        share:    p.share,
      });
    }

    // Import sources — amber arcs flowing inward
    for (const p of (importPartnersQuery.data?.products ?? []).slice(0, 8)) {
      const src2 = COUNTRY_META[p.code];
      if (!src2) continue;
      arcs.push({
        startLat: src2.lat,
        startLng: src2.lng,
        endLat:   src.lat,
        endLng:   src.lng,
        color:    '#f59e0b',
        label:    `Import ← ${p.name}: ${(p.share * 100).toFixed(1)}%`,
        share:    p.share,
      });
    }

    return arcs.length > 0 ? arcs : undefined;
  }, [
    partnerArcsEnabled,
    selectedCountry,
    exportPartnersQuery.data,
    importPartnersQuery.data,
  ]);

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

          {/* Day/night cycle toggle — globe-only feature */}
          {!flatMap && (
            <button
              onClick={() => setDayNightCycle(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs transition-colors",
                dayNightCycle ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-muted-foreground"
              )}
              title={dayNightCycle ? "Show globe fully lit" : "Show real day/night cycle based on current UTC time"}
              aria-pressed={dayNightCycle}
            >
              {dayNightCycle ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              <span>Day/Night</span>
            </button>
          )}

          {/* Country colours toggle — clears the polygon-cap fills so the bare
              globe texture is visible.  Especially useful when day/night is on. */}
          {!flatMap && (
            <button
              onClick={() => setShowCountryColors(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs transition-colors",
                showCountryColors ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-muted-foreground"
              )}
              title={showCountryColors ? "Hide country colour overlay (shows bare globe texture)" : "Show country colour overlay"}
              aria-pressed={showCountryColors}
            >
              {showCountryColors ? <Palette className="h-3 w-3" /> : <PaintBucket className="h-3 w-3" />}
              <span>Country Colours</span>
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
        {/* Left — Globe with CSS-only starfield background */}
        <div ref={leftRef} className="w-1/2 relative overflow-hidden">
          {/* Base layer — tiled inline-SVG starfield.
              ~3 KB data URL, zero network calls, paints instantly.
              The Milky Way "band" effect previously contributed by the
              4.16 MB NASA photo is now provided by the overlay below
              (vignette + globe backlight glow). */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:    STARFIELD_BG,
              backgroundRepeat:   "repeat",
              backgroundSize:     "800px 800px",
              backgroundColor:    "#02030a",
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
                  naturalEvents={naturalEvents}
                  onNaturalEventClick={onNaturalEventClick}
                  economicEvents={economicEvents}
                  onEconomicEventClick={onEconomicEventClick}
                  macroHeatmap={macroHeatmap}
                  showCityLabels={cityLabelsEnabled}
                  showWaterways={waterwaysEnabled}
                  dayNightCycle={dayNightCycle}
                  showCountryColors={showCountryColors}
                  partnerArcs={partnerArcs}
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

          {/* Natural event detail — wildfire/storm/volcano/flood with affected supply */}
          <NaturalEventDialog
            event={selectedNaturalEvent}
            onClose={() => setSelectedNaturalEvent(null)}
            onSetAlert={(commodityId) => {
              console.log('[alerts] User wants alerts for commodity:', commodityId);
            }}
          />

          {/* Economic event detail — actual vs estimate, surprise direction */}
          <EconomicEventDialog
            event={selectedEconEvent}
            onClose={() => setSelectedEconEvent(null)}
          />

          {/* Trade Partners — compact draggable card with top exports/imports.
              Visibility is tied to the Trade Partners layer toggle; closing
              the X turns the layer off (and therefore hides the arcs too). */}
          <TradePartnersDialog
            open={partnerArcsEnabled}
            selectedCountry={selectedCountry}
            exportPartners={exportPartnersQuery.data?.products ?? []}
            importPartners={importPartnersQuery.data?.products ?? []}
            year={exportPartnersQuery.data?.year ?? importPartnersQuery.data?.year ?? null}
            isLoading={exportPartnersQuery.isLoading || importPartnersQuery.isLoading}
            onClose={() => {
              const next = new Set(tradeActiveLayers);
              next.delete('tradePartnerArcs');
              setTradeActiveLayers(next);
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
              vesselTypeFilter={vesselTypeFilter}
              onVesselTypeFilter={setVesselTypeFilter}
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
