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
import type { ExchangeInfo } from "@/data/exchangeData";

// ── Realistic space background ──────────────────────────────────────────
// Multi-layer CSS approach: nebulae, galaxy clouds, backlight glow, and
// four tiers of stars via box-shadow. All generated deterministically with
// a seeded PRNG so positions are stable across renders.

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Module-level lazy singleton: the starfield is deterministic (seeded PRNG),
// so it produces the identical image every time. Caching at module scope means
// the expensive 3000×3000 canvas.toDataURL() runs once per session, not once
// per page mount — eliminating 50-200ms of main-thread blocking on revisits.
let _starfieldUri: string | null = null;
function getStarfieldUri(): string {
  if (_starfieldUri) return _starfieldUri;

  const SIZE = 3000;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const rng = seededRandom(42);

  // Fine 1px stars (same positions/colors as before)
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const a = 0.15 + rng() * 0.45;
    const warm = rng() > 0.6;
    ctx.fillStyle = warm
      ? `rgba(255,240,220,${a})`
      : `rgba(220,230,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  // Medium 2px stars
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const a = 0.4 + rng() * 0.5;
    ctx.fillStyle = `rgba(190,210,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Large 3px stars
  for (let i = 0; i < 25; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const a = 0.55 + rng() * 0.45;
    ctx.fillStyle = `rgba(225,238,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _starfieldUri = canvas.toDataURL("image/png");
  return _starfieldUri;
}

// Multi-layered nebula/galaxy background using stacked radial gradients.
// Builds a deep-space scene with: base gradient, nebula clouds, galaxy
// wisps, dust lanes, and a centered backlight glow behind the globe.
// Consolidated from 20 → 12 gradients. Merged overlapping layers to reduce
// per-frame rasterization cost. Backlight uses a single 4-stop gradient
// instead of 3 separate ones; secondary wisps folded into major nebulae.
const SPACE_BACKGROUND = [
  // ── Backlight glow — dimmed so map colours read clearly ──
  "radial-gradient(circle at 50% 50%, rgba(80,140,200,0.08) 0%, rgba(40,100,160,0.12) 10%, rgba(20,60,100,0.04) 28%, transparent 45%)",

  // ── 4 corner nebulae — pulled back to ~40% of original opacity ──
  "radial-gradient(ellipse at 8% 12%, rgba(20,60,140,0.18) 0%, rgba(12,40,90,0.07) 25%, transparent 50%)",
  "radial-gradient(ellipse at 88% 82%, rgba(12,90,110,0.15) 0%, rgba(8,55,75,0.06) 28%, transparent 52%)",
  "radial-gradient(ellipse at 82% 8%, rgba(55,25,100,0.14) 0%, rgba(35,18,70,0.06) 22%, transparent 48%)",
  "radial-gradient(ellipse at 12% 88%, rgba(18,40,100,0.14) 0%, rgba(10,25,65,0.06) 24%, transparent 48%)",

  // ── Edge wisps ──
  "radial-gradient(ellipse at 3% 45%, rgba(20,90,110,0.08) 0%, transparent 28%), radial-gradient(ellipse at 45% 2%, rgba(16,38,85,0.09) 0%, transparent 30%)",
  "radial-gradient(ellipse at 95% 45%, rgba(38,20,75,0.07) 0%, transparent 25%), radial-gradient(ellipse at 55% 95%, rgba(12,65,85,0.07) 0%, transparent 26%)",

  // ── Vignette ──
  "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(1,2,6,0.65) 100%)",

  // ── Base — near-black deep space ──
  "radial-gradient(ellipse at 40% 35%, #060d18 0%, #040912 25%, #03070f 50%, #02050a 75%, #010306 100%)",
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
  const stars = getStarfieldUri();

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
  }, []);

  const handleExchangeClick = useCallback((ex: ExchangeInfo) => {
    setSelectedExchange(ex);
  }, []);

  const handleExchangeClose = useCallback(() => {
    setSelectedExchange(null);
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
        {/* Left — Globe with realistic space background */}
        <div ref={leftRef} className="w-1/2 relative overflow-hidden">
          {/* Nebula / galaxy background — GPU-promoted, non-interactive */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: SPACE_BACKGROUND,
              willChange: "transform",       // GPU compositor layer
              contain: "strict",             // paint containment
            }}
          />

          {/* Star field — single pre-rendered canvas image, zero box-shadow compositing */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${stars})`,
              backgroundSize: "3000px 3000px",
              willChange: "transform",
              contain: "strict",
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
                />
              )}
            </Suspense>
          )}

          {/* Exchange detail card — anchored to bottom-center of globe area */}
          <ExchangeDetailDialog exchange={selectedExchange} onClose={handleExchangeClose} />
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
