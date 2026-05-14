import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ViewModeToggle } from "@/components/layout/ViewModeToggle";
import { useIndices } from "@/hooks/useSupabaseData";
import { REGION_TO_ISO, COUNTRY_META } from "@/data/countryMeta";
import { cn } from "@/lib/utils";
import { useTradeBreakdown } from "@/hooks/useTradeBreakdown";
import type { PartnerArc } from "@/components/global/GlobeView";
import { Globe as GlobeIcon, ArrowLeft, Loader2, RotateCw, Pause, Map, Sun, Moon, Palette, PaintBucket, Zap, ZapOff } from "lucide-react";
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
  CHOKEPOINTS,
  type LayerKey, type TradeNode,
} from "@/data/tradeInfrastructure";
import { PORT_LSCI_BY_ID } from "@/data/portConnectivity";
import { computeChokepointRisk } from "@/lib/computeChokepointRisk";
import { useAISStream, matchesVesselType, type VesselTypeFilter } from "@/hooks/useAISStream";
import { useOpenSkyFlights } from "@/hooks/useOpenSkyFlights";
import { useConflictEvents, type ConflictEvent } from "@/hooks/useConflictEvents";
import { useEarthquakes, type EarthquakeEvent } from "@/hooks/useEarthquakes";
import { useNaturalEvents, type NaturalEvent } from "@/hooks/useNaturalEvents";
import { useEconomicEvents, type EconomicEvent } from "@/hooks/useEconomicEvents";
import { useMacroHeatmap } from "@/hooks/useMacroHeatmap";
import { EconomicEventDialog } from "@/components/global/trade/EconomicEventDialog";

// ── Realistic space background — NASA Tycho-2 Skymap ────────────────────
// Photographic star map rendered from the Tycho-2 catalog (same catalog
// used for HST guide stars). Public domain (NASA SVS, work of US government).
// Loaded from NASA's CDN directly. CSS background-image bypasses CORS,
// browser-caches the image after first load, and NASA SVS URLs have
// historically been stable for years.
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
  const isMobile = useIsMobile();
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
  const [showCountryColors, setShowCountryColors] = useState(false);
  const [flatMap, setFlatMap] = useState(false);

  // ── Performance Mode ─────────────────────────────────────────────────
  // Disables expensive visual flourishes (atmosphere, bump map, day/night
  // recomputation, ring pulse) and drops the rendering pixel-ratio to keep
  // the globe responsive on low-end hardware. Auto-enabled on first load
  // for devices with <4 cores or <4 GB RAM. Persisted to localStorage so
  // the user's preference survives page reloads.
  //
  // Heuristic note: `navigator.deviceMemory` is non-standard and missing on
  // Safari/Firefox — when absent we fall back to hardwareConcurrency alone.
  const [perfMode, setPerfMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = window.localStorage.getItem('globe-perf-mode');
      if (stored !== null) return stored === '1';
    } catch { /* ignore SSR / private mode */ }
    // First-load auto-detect
    const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? 8;
    const mem   = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return cores < 4 || (typeof mem === 'number' && mem < 4);
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('globe-perf-mode', perfMode ? '1' : '0');
    } catch { /* ignore quota errors */ }
  }, [perfMode]);

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
  // Auto-include layers required by overlays:
  //   - Connectivity overlay → forces seaports to render so they can be
  //     recoloured by LSCI. Without this, enabling Connectivity alone shows
  //     nothing because there are no seaport markers to restyle.
  //   - Risk overlay → forces chokepoints to render so the risk halos sit
  //     visibly on top of their host markers.
  const effectiveLayers = useMemo(() => {
    if (!tradeTabActive) return tradeActiveLayers;
    if (!tradeActiveLayers.has('connectivity') && !tradeActiveLayers.has('risk')) {
      return tradeActiveLayers;
    }
    const s = new Set(tradeActiveLayers);
    if (tradeActiveLayers.has('connectivity')) s.add('seaports');
    if (tradeActiveLayers.has('risk'))         s.add('chokepoints');
    return s;
  }, [tradeActiveLayers, tradeTabActive]);

  const allVisibleNodes  = useMemo(
    () => (tradeTabActive ? getVisibleNodes(effectiveLayers)  : []),
    [effectiveLayers, tradeTabActive],
  );
  const allVisibleRoutes = useMemo(
    () => (tradeTabActive ? getVisibleRoutes(effectiveLayers) : []),
    [effectiveLayers, tradeTabActive],
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
  //
  // UX note: AIS *static* data (which carries shipType) broadcasts only
  // every ~6 minutes, vs position reports every 2-10s.  This means right
  // after connecting most vessels have shipType=undefined and would be
  // filtered out by anything but 'all'.  We expose per-class counts so
  // the user can see exactly how many vessels each filter would keep.
  const [vesselTypeFilter, setVesselTypeFilter] = useState<VesselTypeFilter>('all');
  const liveVessels = useMemo(
    () => vesselTypeFilter === 'all'
      ? liveVesselsRaw
      : liveVesselsRaw.filter(v => matchesVesselType(v, vesselTypeFilter)),
    [liveVesselsRaw, vesselTypeFilter],
  );

  /** Per-class vessel counts — drives the filter pill labels.
   *  PERF: gated on liveVesselsEnabled.  Otherwise this loop runs over
   *  potentially thousands of vessels every 2s (AIS flush cadence) even
   *  when the user is on the Summary tab and the layer has never been
   *  enabled. */
  const vesselTypeCounts = useMemo(() => {
    if (!liveVesselsEnabled) {
      return { all: 0, cargo: 0, tanker: 0, fishing: 0, passenger: 0, untyped: 0 };
    }
    let cargo = 0, tanker = 0, fishing = 0, passenger = 0, untyped = 0;
    for (const v of liveVesselsRaw) {
      const t = v.shipType;
      if (t == null)               { untyped++;   continue; }
      if (t >= 70 && t <= 79)        cargo++;
      else if (t >= 80 && t <= 89)   tanker++;
      else if (t === 30)             fishing++;
      else if (t >= 60 && t <= 69)   passenger++;
    }
    return {
      all:       liveVesselsRaw.length,
      cargo, tanker, fishing, passenger,
      untyped,
    };
  }, [liveVesselsRaw, liveVesselsEnabled]);

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
  // Conflict feed: ALSO fetch when Risk overlay is on, since the risk score
  // pulls from this dataset even when the conflict-events layer is off.
  // But for RENDERING, only pass the data to the globe when the conflict
  // layer itself is on — otherwise enabling risk would silently turn on the
  // conflict-event rings.
  const conflictEventsEnabled =
    tradeTabActive && (tradeActiveLayers.has('conflictEvents') || tradeActiveLayers.has('risk'));
  const conflictEventsQuery = useConflictEvents(conflictEventsEnabled);
  const conflictEvents = (tradeTabActive && tradeActiveLayers.has('conflictEvents'))
    ? conflictEventsQuery.data?.events
    : undefined;
  const [selectedEvent, setSelectedEvent] = useState<ConflictEvent | null>(null);
  const onConflictEventClick = useCallback((e: ConflictEvent) => {
    setSelectedEvent(e);
  }, []);

  // ── Risk overlay flag (gated on layer toggle) ─────────────────────────
  // When the Risk / Disruption layer is on we also enable conflict /
  // earthquake / natural-event queries (even if those individual layers
  // are off) so the risk score has the supporting signals to derive from.
  // Otherwise risk would show 0 for every chokepoint, which is misleading.
  const riskOverlayEnabled = tradeTabActive && tradeActiveLayers.has('risk');

  // ── Connectivity overlay flag ─────────────────────────────────────────
  const connectivityEnabled = tradeTabActive && tradeActiveLayers.has('connectivity');

  // ── USGS earthquake feed (gated on layer toggle OR risk overlay) ──────
  const earthquakesEnabled =
    tradeTabActive && (tradeActiveLayers.has('earthquakes') || riskOverlayEnabled);
  const earthquakesQuery = useEarthquakes(earthquakesEnabled);
  // Same fetch-vs-render split as conflicts: only feed the globe when the
  // earthquake LAYER itself is on, not just because risk is on.
  const earthquakeEvents = (tradeTabActive && tradeActiveLayers.has('earthquakes'))
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
  // Natural events: also fire when Risk overlay is on. We enable all four
  // categories in that case so the score reflects every available disruption.
  const riskOnForNaturals = tradeTabActive && tradeActiveLayers.has('risk');
  const naturalEnabledMap = useMemo(() => ({
    wildfires:    tradeTabActive && (tradeActiveLayers.has('wildfires')    || riskOnForNaturals),
    severeStorms: tradeTabActive && (tradeActiveLayers.has('severeStorms') || riskOnForNaturals),
    volcanoes:    tradeTabActive && (tradeActiveLayers.has('volcanoes')    || riskOnForNaturals),
    floods:       tradeTabActive && (tradeActiveLayers.has('floods')       || riskOnForNaturals),
  }), [tradeTabActive, tradeActiveLayers, riskOnForNaturals]);
  const naturalEventsQuery = useNaturalEvents(naturalEnabledMap);
  // For RENDERING on the globe, only show categories whose own layer toggle
  // is on. When Risk is enabled it fetches all 4 categories (to feed the
  // score) but we don't want enabling Risk to silently turn on every
  // natural-event ring on the globe.
  const naturalEvents = useMemo(() => {
    const all = naturalEventsQuery.data;
    if (!all) return undefined;
    return all.filter(e => tradeActiveLayers.has(e.category as LayerKey));
  }, [naturalEventsQuery.data, tradeActiveLayers]);
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

  // ── Chokepoint risk score (Risk / Disruption overlay) ────────────────
  // Pure derivation from the conflict / earthquake / natural-event data
  // already fetched above (which auto-enabled when the risk layer turned
  // on, even if those individual layers stayed off). No new network calls.
  const riskRings = useMemo(() => {
    if (!riskOverlayEnabled) return undefined;
    const scored = computeChokepointRisk({
      chokepoints: CHOKEPOINTS,
      conflicts:   conflictEventsQuery.data?.events,
      earthquakes: earthquakesQuery.data,
      naturals:    naturalEventsQuery.data,
    });
    // Show even faint-risk chokepoints (>0.2) so users see the overlay is
    // live and working — a near-zero halo around Panama/Cape is a useful
    // signal that "these are calm right now" vs. nothing rendering at all.
    // If NO chokepoint scores >0.2 (e.g. queries still loading), we still
    // return an empty array so the overlay is "on" but momentarily empty.
    return scored.filter(r => r.score >= 0.2);
  }, [
    riskOverlayEnabled,
    conflictEventsQuery.data,
    earthquakesQuery.data,
    naturalEventsQuery.data,
  ]);

  // ── Port LSCI (Connectivity overlay) ────────────────────────────────
  // Static lookup — the dataset is bundled, no fetch needed.
  const portConnectivityProp = connectivityEnabled ? PORT_LSCI_BY_ID : undefined;

  // ── Render-list caps for performance ─────────────────────────────────
  // Each event source can return huge volumes (ACLED can hit 5k+ in busy
  // weeks; AIS streams thousands of vessels). Rendering all of them as
  // Three.js meshes craters fps without changing what the user sees in
  // practice — the eye can't distinguish 200 vs 800 dots on a globe.
  //
  // Strategy: keep the top-N by importance / recency. The fetched arrays
  // remain in React Query's cache for use elsewhere; we only cap what
  // flows into the globe layer.
  const MAX_EVENTS_PER_LAYER  = perfMode ? 80  : 200;
  const MAX_VESSELS_DISPLAYED = perfMode ? 200 : 600;
  const MAX_FLIGHTS_DISPLAYED = perfMode ? 300 : 1000;

  const conflictEventsRender = useMemo(() => {
    if (!conflictEvents) return undefined;
    if (conflictEvents.length <= MAX_EVENTS_PER_LAYER) return conflictEvents;
    // Rank by fatalities (severity) — recency is a tie-breaker via date.
    return [...conflictEvents]
      .sort((a, b) => (b.fatalities - a.fatalities) || b.date.localeCompare(a.date))
      .slice(0, MAX_EVENTS_PER_LAYER);
  }, [conflictEvents, MAX_EVENTS_PER_LAYER]);

  const earthquakeEventsRender = useMemo(() => {
    if (!earthquakeEvents) return undefined;
    if (earthquakeEvents.length <= MAX_EVENTS_PER_LAYER) return earthquakeEvents;
    // USGS `sig` blends magnitude + population exposure + shaking — better
    // than bare magnitude for "which ones should I see".
    return [...earthquakeEvents]
      .sort((a, b) => b.sig - a.sig)
      .slice(0, MAX_EVENTS_PER_LAYER);
  }, [earthquakeEvents, MAX_EVENTS_PER_LAYER]);

  const naturalEventsRender = useMemo(() => {
    if (!naturalEvents) return undefined;
    if (naturalEvents.length <= MAX_EVENTS_PER_LAYER) return naturalEvents;
    // Recency only (EONET doesn't expose comparable severity across categories).
    return [...naturalEvents]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_EVENTS_PER_LAYER);
  }, [naturalEvents, MAX_EVENTS_PER_LAYER]);

  const liveVesselsRender = useMemo(() => {
    if (!liveVesselsEnabled) return undefined;
    if (liveVessels.length <= MAX_VESSELS_DISPLAYED) return liveVessels;
    // Most-recently-seen wins — older positions are less informative anyway.
    return [...liveVessels]
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_VESSELS_DISPLAYED);
  }, [liveVessels, liveVesselsEnabled, MAX_VESSELS_DISPLAYED]);

  const liveFlightsRender = useMemo(() => {
    if (!liveFlightsEnabled) return undefined;
    if (liveFlights.length <= MAX_FLIGHTS_DISPLAYED) return liveFlights;
    return liveFlights.slice(0, MAX_FLIGHTS_DISPLAYED);
  }, [liveFlights, liveFlightsEnabled, MAX_FLIGHTS_DISPLAYED]);

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
        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle />
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
                dayNightCycle ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-muted-foreground",
                perfMode && "opacity-50 cursor-not-allowed",
              )}
              title={
                perfMode
                  ? "Disabled in Performance Mode (per-frame solar recompute)"
                  : dayNightCycle ? "Show globe fully lit" : "Show real day/night cycle based on current UTC time"
              }
              aria-pressed={dayNightCycle}
              disabled={perfMode}
            >
              {dayNightCycle ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              <span>Day/Night</span>
            </button>
          )}

          {/* Performance Mode toggle — single switch that disables expensive
              visual flourishes (atmosphere, bump map, day/night cycle, ring
              pulse) and drops the pixel ratio. Available on globe + flat map. */}
          <button
            onClick={() => setPerfMode(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
              perfMode
                ? "bg-amber-500/10 text-amber-500 border-amber-500/40 hover:bg-amber-500/15"
                : "border-border hover:bg-muted text-muted-foreground",
            )}
            title={
              perfMode
                ? "Performance Mode ON — reduced visual quality for smoother frame rate. Click to disable."
                : "Enable Performance Mode — drops atmosphere, bump map, day/night cycle, and lowers pixel ratio for smoother frame rate on slower devices."
            }
            aria-pressed={perfMode}
          >
            {perfMode ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            <span>{perfMode ? "Perf Mode" : "Full Quality"}</span>
          </button>

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
      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        {/* Left — Globe with CSS-only starfield background */}
        <div
          ref={leftRef}
          className={cn(
            // Mobile: 75vh by default, 50vh once a country is selected. Desktop unchanged.
            selectedCountry ? "h-[50vh]" : "h-[75vh]",
            "sm:h-auto sm:flex-1 relative overflow-hidden transition-[height] duration-300",
          )}
        >
          {/* Base layer — NASA Tycho-2 Skymap photographic star map.
              Fills the container via `cover` and is biased vertically
              so the Milky Way band appears in the lower half behind
              the globe's lower hemisphere. Black fallback until loaded. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:    `url(${NASA_TYCHO_SKYMAP_URL})`,
              backgroundSize:     "cover",
              backgroundPosition: "50% 60%",
              backgroundColor:    "#000",
              willChange:         "transform",
            }}
          />

          {/* Overlay — darkening tint + vignette + globe backlight glow
              painted on top of the NASA photo. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: SPACE_OVERLAY,
              willChange: "transform",
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
                  liveVessels={liveVesselsRender}
                  liveFlights={liveFlightsRender}
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
                  liveVessels={liveVesselsRender}
                  liveFlights={liveFlightsRender}
                  conflictEvents={conflictEventsRender}
                  onConflictEventClick={onConflictEventClick}
                  earthquakeEvents={earthquakeEventsRender}
                  onEarthquakeEventClick={onEarthquakeEventClick}
                  naturalEvents={naturalEventsRender}
                  onNaturalEventClick={onNaturalEventClick}
                  economicEvents={economicEvents}
                  onEconomicEventClick={onEconomicEventClick}
                  macroHeatmap={macroHeatmap}
                  showCityLabels={cityLabelsEnabled}
                  showWaterways={waterwaysEnabled}
                  // Perf mode forces day/night off — the per-frame solar-
                  // position recompute is one of the heaviest render
                  // contributors and adds little for users with degraded
                  // hardware.
                  dayNightCycle={perfMode ? false : dayNightCycle}
                  showCountryColors={showCountryColors}
                  partnerArcs={partnerArcs}
                  riskRings={riskRings}
                  portConnectivity={portConnectivityProp}
                  showConnectivity={connectivityEnabled}
                  // Perf mode drops more pixels; mobile is more aggressive
                  // than desktop. Default desktop dropped from 1.0 → 0.85
                  // because at globe scale the pixel-ratio reduction is
                  // visually imperceptible and saves ~20% GPU work.
                  pixelRatioScale={
                    perfMode
                      ? (isMobile ? 0.5  : 0.65)
                      : (isMobile ? 0.7  : 0.85)
                  }
                  initialAltitude={isMobile ? 1.5 : 2.5}
                  perfMode={perfMode}
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
        <div className="sm:w-1/2 border-t sm:border-t-0 sm:border-l border-border bg-card overflow-hidden">
          {selectedCountry ? (
            <CountryPanel
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
              vesselTypeCounts={vesselTypeCounts}
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
