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

/**
 * Pick a star color biased toward realistic stellar temperature distribution.
 *
 * Real stars span B (blue, hot) → A → F → G (Sun-like) → K → M (red, cool).
 * The actual frequency in a magnitude-limited sample is heavily weighted to
 * cool red/orange dwarfs, but visually the night sky shows more white/blue
 * because brighter stars are intrinsically hotter. We blend the two: most
 * visible stars are warm-white to yellow-white, with a minority of blue
 * giants and red giants for color variety.
 */
function pickStarRGB(rng: () => number): [number, number, number] {
  const t = rng();
  if (t < 0.10) return [185, 205, 255]; // O/B blue-white  (rare, hot)
  if (t < 0.28) return [220, 230, 255]; // A blue-white
  if (t < 0.55) return [255, 250, 240]; // F-G white
  if (t < 0.80) return [255, 240, 210]; // G yellow (Sun-like)
  if (t < 0.93) return [255, 210, 170]; // K orange
  return [255, 170, 140];               // M red (cool, common)
}

/**
 * Render a richly-populated, astrophotography-style starfield to a 3000×3000
 * canvas and return its data URL.
 *
 * Layered for realism:
 *  1. Milky Way: a diagonal Gaussian-falloff band of denser stars + diffuse
 *     bluish/warm dust glow.
 *  2. Background field: ~3000 dim stars with Pareto-like brightness
 *     distribution (most very faint, few bright) and stellar color
 *     temperature classes.
 *  3. Mid-tier 2px stars with halos.
 *  4. Bright stars with soft glow halos (~50).
 *  5. A handful of "showcase" stars with 4-point diffraction spikes (the
 *     telltale of a long-exposure astrophoto).
 *  6. Distant galaxies — small elongated smears of bluish or warm-white
 *     light, varying orientation.
 */
function getStarfieldUri(): string {
  if (_starfieldUri) return _starfieldUri;

  const SIZE = 3000;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const rng = seededRandom(42);

  // ── 1. Milky Way diffuse glow ──
  // Wide soft band tilted ~30° across the canvas. Provides the underlying
  // "river of light" that makes the dense star band feel cohesive instead
  // of arbitrary clumping.
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.PI / 6); // 30°
  {
    // Two overlapping bands — a wider faint blue, a narrower warm core.
    const blueBand = ctx.createLinearGradient(0, -SIZE * 0.30, 0, SIZE * 0.30);
    blueBand.addColorStop(0,    "rgba(0,0,0,0)");
    blueBand.addColorStop(0.5,  "rgba(70,95,150,0.07)");
    blueBand.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = blueBand;
    ctx.fillRect(-SIZE, -SIZE * 0.30, SIZE * 2, SIZE * 0.60);

    const warmCore = ctx.createLinearGradient(0, -SIZE * 0.10, 0, SIZE * 0.10);
    warmCore.addColorStop(0,    "rgba(0,0,0,0)");
    warmCore.addColorStop(0.5,  "rgba(180,150,110,0.05)");
    warmCore.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = warmCore;
    ctx.fillRect(-SIZE, -SIZE * 0.10, SIZE * 2, SIZE * 0.20);

    // Dust lane — darker streak through the band
    const dust = ctx.createLinearGradient(0, -SIZE * 0.04, 0, SIZE * 0.04);
    dust.addColorStop(0,   "rgba(0,0,0,0)");
    dust.addColorStop(0.5, "rgba(0,0,0,0.18)");
    dust.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = dust;
    ctx.fillRect(-SIZE, -SIZE * 0.04, SIZE * 2, SIZE * 0.08);
  }
  ctx.restore();

  // Predicate: is point (x,y) inside the Milky Way band? Returns a 0-1
  // density factor (Gaussian falloff perpendicular to the band axis).
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const angle = Math.PI / 6;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  function milkyWayDensity(x: number, y: number): number {
    const dx = x - cx;
    const dy = y - cy;
    const perp = Math.abs(dx * sinA - dy * cosA);
    const halfW = SIZE * 0.18;
    return Math.exp(-(perp * perp) / (2 * halfW * halfW));
  }

  // ── 2. Background field stars (3000) ──
  // Power-law brightness: most are very dim, a few are noticeably brighter.
  for (let i = 0; i < 3000; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    // Pareto-ish: alpha = u^3 mapped to [0.04, 0.55]
    const u = rng();
    const alpha = 0.04 + Math.pow(u, 3) * 0.51;
    const [r, g, b] = pickStarRGB(rng);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  // ── 3. Milky Way concentration: extra stars in the band ──
  // Up to 4000 candidate positions, density-gated by the falloff function.
  // Effective count is ~1500-2000 inside the band.
  for (let i = 0; i < 4000; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const density = milkyWayDensity(x, y);
    if (rng() > density) continue;
    const u = rng();
    const alpha = 0.05 + Math.pow(u, 2.5) * 0.45;
    const [r, g, b] = pickStarRGB(rng);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  // ── 4. Mid-tier 2px stars (~180) ──
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const alpha = 0.3 + rng() * 0.5;
    const [r, g, b] = pickStarRGB(rng);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 5. Bright stars with soft glow halos (~50) ──
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const [r, g, b] = pickStarRGB(rng);
    const haloR = 6 + rng() * 8;

    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0,   `rgba(${r},${g},${b},0.45)`);
    halo.addColorStop(0.4, `rgba(${r},${g},${b},0.10)`);
    halo.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + rng() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 6. Showcase stars with 4-point diffraction spikes (~14) ──
  // The "this is a real photograph" cue. Spikes are subtle (low alpha,
  // thin lines) so they don't read as ornament.
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    const [r, g, b] = pickStarRGB(rng);
    const len = 8 + rng() * 14;

    // Spike pair (horizontal + vertical)
    const spikeGrad = (x0: number, y0: number, x1: number, y1: number) => {
      const g0 = ctx.createLinearGradient(x0, y0, x1, y1);
      g0.addColorStop(0,   `rgba(${r},${g},${b},0)`);
      g0.addColorStop(0.5, `rgba(${r},${g},${b},0.55)`);
      g0.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      return g0;
    };
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = spikeGrad(x - len, y, x + len, y);
    ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); ctx.stroke();
    ctx.strokeStyle = spikeGrad(x, y - len, x, y + len);
    ctx.beginPath(); ctx.moveTo(x, y - len); ctx.lineTo(x, y + len); ctx.stroke();

    // Halo
    const haloR = 9 + rng() * 6;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0,   `rgba(${r},${g},${b},0.7)`);
    halo.addColorStop(0.5, `rgba(${r},${g},${b},0.15)`);
    halo.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Bright core
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + rng() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 7. Distant galaxies (~22) — elongated smears ──
  for (let i = 0; i < 22; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const w = 7 + rng() * 18;
    const h = 2 + rng() * 5;
    const ang = rng() * Math.PI;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(1, h / w);

    // 50/50 bluish vs warm to suggest spiral/elliptical mix
    const tone = rng() > 0.5 ? "200,180,255" : "255,210,180";
    const galGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    galGrad.addColorStop(0,    `rgba(${tone},0.40)`);
    galGrad.addColorStop(0.45, `rgba(${tone},0.10)`);
    galGrad.addColorStop(1,    `rgba(${tone},0)`);
    ctx.fillStyle = galGrad;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _starfieldUri = canvas.toDataURL("image/png");
  return _starfieldUri;
}

// Multi-layered nebula/galaxy background using stacked radial gradients.
//
// Designed to evoke a deep-sky astrophoto: H-α emission reds, OIII teal,
// reflection-nebula blues, with dust-lane darkening and a faint atmospheric
// blue rim behind the globe. Layer order is back-to-front (the LAST gradient
// is painted FIRST in CSS multi-background — the "base" sits at the bottom).
//
// Each layer kept low-opacity so the dominant impression is dark space, with
// nebulae as subtle texture rather than competing with the globe.
const SPACE_BACKGROUND = [
  // ── Soft atmospheric backlight behind the globe (front layer) ──
  "radial-gradient(circle at 50% 50%, rgba(90,150,220,0.09) 0%, rgba(40,100,170,0.10) 12%, rgba(15,55,100,0.04) 28%, transparent 46%)",

  // ── H-α emission nebula (reddish, top-left quadrant) ──
  "radial-gradient(ellipse 60% 45% at 18% 22%, rgba(190,80,80,0.10) 0%, rgba(120,40,55,0.06) 20%, rgba(70,25,40,0.03) 40%, transparent 60%)",

  // ── OIII / reflection nebula (teal-blue, bottom-right) ──
  "radial-gradient(ellipse 55% 50% at 82% 78%, rgba(60,180,200,0.08) 0%, rgba(30,120,150,0.06) 22%, rgba(15,70,100,0.03) 45%, transparent 65%)",

  // ── Cool blue-violet cloud (bottom-left) ──
  "radial-gradient(ellipse 50% 40% at 12% 85%, rgba(80,90,200,0.09) 0%, rgba(40,55,140,0.05) 25%, transparent 50%)",

  // ── Magenta/purple reflection cloud (top-right) ──
  "radial-gradient(ellipse 45% 38% at 86% 14%, rgba(140,70,180,0.09) 0%, rgba(80,40,120,0.04) 28%, transparent 55%)",

  // ── Pink star-forming region (small, off-center) ──
  "radial-gradient(circle 18% at 32% 68%, rgba(220,120,160,0.07) 0%, rgba(140,70,110,0.03) 30%, transparent 60%)",

  // ── Dust lane darkening (diagonal stroke across mid-canvas) ──
  // Subtle dark streak that breaks up the field, suggesting interstellar dust.
  "linear-gradient(115deg, transparent 38%, rgba(0,0,0,0.18) 50%, transparent 62%)",

  // ── Edge wisps (faint, asymmetric) ──
  "radial-gradient(ellipse at 4% 50%, rgba(40,110,140,0.06) 0%, transparent 26%), radial-gradient(ellipse at 50% 4%, rgba(60,40,120,0.07) 0%, transparent 30%)",
  "radial-gradient(ellipse at 96% 50%, rgba(50,30,90,0.06) 0%, transparent 24%), radial-gradient(ellipse at 50% 96%, rgba(20,80,100,0.06) 0%, transparent 26%)",

  // ── Vignette — dark frame edges ──
  "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,1,4,0.70) 100%)",

  // ── Base deep space — near-black with subtle warm core ──
  // Slight off-center so the field doesn't look perfectly symmetric.
  "radial-gradient(ellipse at 42% 38%, #08111e 0%, #050b16 22%, #03070f 48%, #02040a 72%, #010206 100%)",
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
