# Global Investment Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Global page with an interactive 3D globe where clicking a country opens a side panel with that country's stocks, news, and market data.

**Architecture:** react-globe.gl renders a WebGL 3D globe with GeoJSON country polygons. A 50/50 split layout: globe on the left (sized to full container height for 1:1 aspect ratio), scrollable side panel on the right. Country data comes from existing Supabase tables (stocks, symbols) and edge functions (api-news). A static country→index mapping drives the heatmap coloring.

**Tech Stack:** react-globe.gl, three.js (peer dep), Natural Earth GeoJSON (110m), existing Supabase hooks, Tailwind CSS for layout.

---

### Task 1: Install Dependencies & Add GeoJSON Data

**Files:**
- Modify: `package.json`
- Create: `src/data/countries-110m.geojson` (downloaded from Natural Earth)
- Create: `src/data/countryMeta.ts` (static mapping)

**Step 1: Install react-globe.gl and three**

Run:
```bash
cd C:\Users\PC\Downloads\market-pulse
npm install react-globe.gl three
```

**Step 2: Download GeoJSON data**

Download the Natural Earth 110m countries GeoJSON and save it. This is the dataset react-globe.gl's own examples use.

Run:
```bash
curl -L "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson" -o src/data/countries-110m.geojson
```

**Step 3: Create country metadata mapping**

Create `src/data/countryMeta.ts`:

```typescript
// Maps ISO_A2 country codes to market metadata.
// Used by the globe to color countries and by the side panel to fetch data.

export interface CountryMeta {
  name: string;
  iso2: string;
  indexSymbol?: string;  // Major market index symbol
  indexName?: string;
  region: string;        // Matches useIndices() region field
  exchanges: string[];   // Exchange codes in our symbols table
  flagCode: string;      // For <Flag> component
  lat: number;           // Camera fly-to coordinates
  lng: number;
}

export const COUNTRY_META: Record<string, CountryMeta> = {
  US: {
    name: "United States",
    iso2: "US",
    indexSymbol: "^GSPC",
    indexName: "S&P 500",
    region: "United States",
    exchanges: ["NYSE", "NASDAQ", "AMEX"],
    flagCode: "US",
    lat: 39.8,
    lng: -98.5,
  },
  CA: {
    name: "Canada",
    iso2: "CA",
    indexSymbol: "^GSPTSE",
    indexName: "S&P/TSX",
    region: "Canada",
    exchanges: ["TSX", "TSXV"],
    flagCode: "CA",
    lat: 56.1,
    lng: -106.3,
  },
  GB: {
    name: "United Kingdom",
    iso2: "GB",
    indexSymbol: "^FTSE",
    indexName: "FTSE 100",
    region: "United Kingdom",
    exchanges: ["LSE"],
    flagCode: "GB",
    lat: 55.4,
    lng: -3.4,
  },
  DE: {
    name: "Germany",
    iso2: "DE",
    indexSymbol: "^GDAXI",
    indexName: "DAX",
    region: "Germany",
    exchanges: ["XETRA"],
    flagCode: "DE",
    lat: 51.2,
    lng: 10.4,
  },
  FR: {
    name: "France",
    iso2: "FR",
    indexSymbol: "^FCHI",
    indexName: "CAC 40",
    region: "France",
    exchanges: ["EPA"],
    flagCode: "FR",
    lat: 46.2,
    lng: 2.2,
  },
  JP: {
    name: "Japan",
    iso2: "JP",
    indexSymbol: "^N225",
    indexName: "Nikkei 225",
    region: "Japan",
    exchanges: ["TSE"],
    flagCode: "JP",
    lat: 36.2,
    lng: 138.3,
  },
  HK: {
    name: "Hong Kong",
    iso2: "HK",
    indexSymbol: "^HSI",
    indexName: "Hang Seng",
    region: "Hong Kong",
    exchanges: ["HKEX"],
    flagCode: "HK",
    lat: 22.4,
    lng: 114.1,
  },
  AU: {
    name: "Australia",
    iso2: "AU",
    indexSymbol: "^AXJO",
    indexName: "ASX 200",
    region: "Australia",
    exchanges: ["ASX"],
    flagCode: "AU",
    lat: -25.3,
    lng: 133.8,
  },
  IN: {
    name: "India",
    iso2: "IN",
    indexSymbol: "^BSESN",
    indexName: "SENSEX",
    region: "India",
    exchanges: ["BSE", "NSE"],
    flagCode: "IN",
    lat: 20.6,
    lng: 79.0,
  },
  BR: {
    name: "Brazil",
    iso2: "BR",
    indexSymbol: "^BVSP",
    indexName: "Bovespa",
    region: "Brazil",
    exchanges: ["BVMF"],
    flagCode: "BR",
    lat: -14.2,
    lng: -51.9,
  },
  KR: {
    name: "South Korea",
    iso2: "KR",
    indexSymbol: "^KS11",
    indexName: "KOSPI",
    region: "South Korea",
    exchanges: ["KRX"],
    flagCode: "KR",
    lat: 35.9,
    lng: 127.8,
  },
  CN: {
    name: "China",
    iso2: "CN",
    indexSymbol: "000001.SS",
    indexName: "SSE Composite",
    region: "China",
    exchanges: ["SSE", "SZSE"],
    flagCode: "CN",
    lat: 35.9,
    lng: 104.2,
  },
};

// Reverse lookup: region name (from useIndices) → ISO code
export const REGION_TO_ISO: Record<string, string> = {};
for (const [iso, meta] of Object.entries(COUNTRY_META)) {
  REGION_TO_ISO[meta.region] = iso;
}

// Color for country flags (dominant flag color)
export const FLAG_COLORS: Record<string, string> = {
  US: "#3c3b6e",
  CA: "#ff0000",
  GB: "#00247d",
  DE: "#000000",
  FR: "#002395",
  JP: "#bc002d",
  HK: "#de2910",
  AU: "#00008b",
  IN: "#ff9933",
  BR: "#009c3b",
  KR: "#003478",
  CN: "#de2910",
};
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(global): install react-globe.gl, add GeoJSON + country metadata"
```

---

### Task 2: Create the Globe Component

**Files:**
- Create: `src/components/global/GlobeView.tsx`

**Step 1: Create GlobeView component**

This is the core 3D globe. It handles:
- Loading GeoJSON
- Rendering with react-globe.gl
- Country coloring (flag mode vs heatmap mode)
- Auto-rotation (stops on interaction, resumes after 5s idle)
- Click → fly-to animation + callback
- Hover highlight

```tsx
// src/components/global/GlobeView.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import countriesGeoJson from "@/data/countries-110m.geojson";
import { COUNTRY_META, FLAG_COLORS, REGION_TO_ISO } from "@/data/countryMeta";

type GlobeMode = "flags" | "performance";
type Feature = { properties: Record<string, any>; geometry: any };

interface GlobeViewProps {
  width: number;
  height: number;
  mode: GlobeMode;
  /** Map of ISO_A2 → change percent, used in performance mode */
  performanceMap: Record<string, number>;
  selectedCountry: string | null; // ISO_A2
  onCountryClick: (iso2: string) => void;
}

/** Green-to-red interpolation for -5% to +5% */
function perfColor(changePct: number): string {
  const clamped = Math.max(-5, Math.min(5, changePct));
  const t = (clamped + 5) / 10; // 0 = deep red, 1 = bright green
  const r = Math.round(220 - t * 180);
  const g = Math.round(40 + t * 180);
  return `rgba(${r}, ${g}, 60, 0.7)`;
}

export default function GlobeView({
  width,
  height,
  mode,
  performanceMap,
  selectedCountry,
  onCountryClick,
}: GlobeViewProps) {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState<Feature[]>([]);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load GeoJSON features (filter out Antarctica)
  useEffect(() => {
    const data =
      typeof countriesGeoJson === "string"
        ? JSON.parse(countriesGeoJson)
        : countriesGeoJson;
    setCountries(
      data.features.filter((f: Feature) => f.properties.ISO_A2 !== "AQ")
    );
  }, []);

  // Setup auto-rotation + stop on interaction + resume after idle
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableDamping = true;

    const stopAndRestart = () => {
      controls.autoRotate = false;
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        controls.autoRotate = true;
      }, 5000);
    };

    const el = globe.renderer().domElement;
    el.addEventListener("pointerdown", stopAndRestart);
    el.addEventListener("wheel", stopAndRestart);

    return () => {
      el.removeEventListener("pointerdown", stopAndRestart);
      el.removeEventListener("wheel", stopAndRestart);
      clearTimeout(idleTimer.current);
    };
  }, [countries]); // re-run when globe is ready

  // Fly to selected country
  useEffect(() => {
    if (!globeRef.current || !selectedCountry) return;
    const meta = COUNTRY_META[selectedCountry];
    if (meta) {
      globeRef.current.pointOfView(
        { lat: meta.lat, lng: meta.lng, altitude: 2.0 },
        800
      );
    }
  }, [selectedCountry]);

  const getCapColor = useCallback(
    (d: any) => {
      const iso = d.properties.ISO_A2;
      const isHovered = iso === hoverIso;
      const isSelected = iso === selectedCountry;

      if (isSelected) return "rgba(59, 130, 246, 0.8)"; // blue highlight
      if (isHovered) return "rgba(255, 255, 255, 0.4)";

      if (mode === "flags") {
        return FLAG_COLORS[iso]
          ? `${FLAG_COLORS[iso]}b3` // with alpha
          : "rgba(80, 80, 80, 0.3)";
      }
      // performance mode
      const change = performanceMap[iso];
      if (change === undefined) return "rgba(80, 80, 80, 0.2)";
      return perfColor(change);
    },
    [mode, performanceMap, hoverIso, selectedCountry]
  );

  const handleClick = useCallback(
    (polygon: any) => {
      if (!polygon) return;
      const iso = polygon.properties.ISO_A2;
      if (iso) onCountryClick(iso);
    },
    [onCountryClick]
  );

  const handleHover = useCallback((polygon: any) => {
    setHoverIso(polygon?.properties?.ISO_A2 ?? null);
  }, []);

  const getLabel = useCallback((d: any) => {
    const iso = d.properties.ISO_A2;
    const meta = COUNTRY_META[iso];
    const name = meta?.name ?? d.properties.ADMIN;
    return `<div style="padding:4px 8px;background:rgba(0,0,0,0.8);border-radius:4px;font-size:12px;color:#fff">${name}</div>`;
  }, []);

  const getAltitude = useCallback(
    (d: any) => {
      const iso = d.properties.ISO_A2;
      if (iso === selectedCountry) return 0.03;
      if (iso === hoverIso) return 0.02;
      return 0.005;
    },
    [hoverIso, selectedCountry]
  );

  // Use the square of (width, height) so globe is never distorted
  const globeSize = Math.min(width, height);

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ width, height }}
    >
      <Globe
        ref={globeRef}
        width={globeSize}
        height={globeSize}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        showAtmosphere
        atmosphereColor="rgba(100, 160, 255, 0.3)"
        atmosphereAltitude={0.18}
        animateIn
        polygonsData={countries}
        polygonCapColor={getCapColor}
        polygonSideColor={() => "rgba(0, 0, 0, 0.15)"}
        polygonStrokeColor={() => "rgba(255, 255, 255, 0.1)"}
        polygonAltitude={getAltitude}
        polygonLabel={getLabel}
        polygonsTransitionDuration={300}
        onPolygonClick={handleClick}
        onPolygonHover={handleHover}
      />
    </div>
  );
}
```

**Step 2: Configure Vite to import GeoJSON as JSON**

Check `vite.config.ts` — Vite handles `.json` imports natively, but `.geojson` needs the `assetsInclude` config or renaming. Simplest: rename the file to `.json` OR add to vite config.

Add to `vite.config.ts` inside `defineConfig`:
```typescript
assetsInclude: ['**/*.geojson'],
```

And add a type declaration. Create `src/data/geojson.d.ts`:
```typescript
declare module "*.geojson" {
  const value: any;
  export default value;
}
```

**Step 3: Verify the globe renders**

Temporarily import `GlobeView` in the existing `Global.tsx` with dummy props to confirm the 3D globe appears.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(global): create GlobeView component with country polygons"
```

---

### Task 3: Create the Country Side Panel

**Files:**
- Create: `src/components/global/CountryPanel.tsx`
- Create: `src/components/global/CountrySummary.tsx`
- Create: `src/components/global/CountryScreener.tsx`
- Create: `src/hooks/useCountryStocks.ts`

**Step 1: Create useCountryStocks hook**

Queries the Supabase `stocks` table for all stocks belonging to a country. Uses the `symbols` table `country` field.

```typescript
// src/hooks/useCountryStocks.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_META } from "@/data/countryMeta";

export interface CountryStock {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  market_cap: number | null;
  volume: number | null;
  sector: string | null;
}

export function useCountryStocks(iso2: string | null) {
  return useQuery({
    queryKey: ["country-stocks", iso2],
    enabled: !!iso2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CountryStock[]> => {
      if (!iso2) return [];
      const meta = COUNTRY_META[iso2];
      if (!meta) return [];

      // Query stocks table — filter by country name matching the region
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol, name, price, change_percent, market_cap, volume")
        .order("change_percent", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as CountryStock[];
    },
  });
}
```

Note: The exact query depends on whether `stocks` has a `country` column or if we need to join through `symbols`. The implementer should check the schema and adjust. If `stocks` lacks a country field, filter by exchange codes from `COUNTRY_META[iso2].exchanges` instead.

**Step 2: Create CountrySummary component**

Shows: index card, top 5 gainers, top 5 losers, recent news.

```tsx
// src/components/global/CountrySummary.tsx
// - Receives country ISO2 as prop
// - Uses useCountryStocks for gainers/losers
// - Uses useIndices to find this country's index
// - Uses a news query (api-news with top symbols)
// - Renders: index card, gainers list, losers list, news headlines
```

**Step 3: Create CountryScreener component**

Sortable table of all stocks from the country with sector filter.

```tsx
// src/components/global/CountryScreener.tsx
// - Receives CountryStock[] data as prop
// - Sortable columns: Symbol, Name, Price, Change%, Market Cap, Sector
// - Sector filter dropdown
// - Click row → navigate to /stocks?symbol=XYZ
```

**Step 4: Create CountryPanel container**

```tsx
// src/components/global/CountryPanel.tsx
// - Tabs: Summary | Screener
// - Animated entrance (translateX + opacity transition, 300ms)
// - Close button (X) to deselect country
// - Scrollable independently (overflow-y-auto)
// - When no country selected, shows global summary (indices grid + top movers)
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(global): create country panel with summary + screener tabs"
```

---

### Task 4: Create the Global Default Panel

**Files:**
- Create: `src/components/global/GlobalSummary.tsx`

**Step 1: Create GlobalSummary component**

This is the right panel content shown when NO country is clicked. It shows:
- World indices grid (compact cards from `useIndices()`)
- Instruction text: "Click a country on the globe to explore its market"

```tsx
// src/components/global/GlobalSummary.tsx
// - Uses useIndices() for world indices
// - Renders compact grid of index cards (flag + name + value + change%)
// - Each card is clickable → sets selectedCountry
// - Subtitle prompt: "Click a country to explore"
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(global): create global summary default panel"
```

---

### Task 5: Wire Everything into the Global Page

**Files:**
- Modify: `src/pages/Global.tsx` (full rewrite)

**Step 1: Rewrite Global.tsx**

```tsx
// src/pages/Global.tsx
//
// Layout:
// - No PageLayout wrapper (custom full-height layout)
// - Lock body scroll (overflow: hidden)
// - Header bar: title + timeframe selector + mode toggle (flags/performance)
// - 50/50 flex split below header
// - Left: GlobeView (width = 50vw, height = 100vh - headerH)
// - Right: CountryPanel or GlobalSummary
//
// State:
// - selectedCountry: string | null (ISO_A2)
// - mode: "flags" | "performance"
// - timeframe: "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y"
//
// Data:
// - useIndices() for index data → build performanceMap
// - Pass performanceMap to GlobeView for heatmap coloring
//
// Sizing:
// - Use useRef on the left container + ResizeObserver to get exact pixel dimensions
// - Pass to GlobeView as width/height props
// - GlobeView internally uses min(width, height) to keep globe square (1:1 aspect)
```

**Step 2: Build the performanceMap**

```typescript
// Inside Global.tsx:
const performanceMap = useMemo(() => {
  const map: Record<string, number> = {};
  for (const idx of indices) {
    const iso = REGION_TO_ISO[idx.region];
    if (iso) map[iso] = idx.changePercent;
  }
  return map;
}, [indices]);
```

**Step 3: Add the header bar with controls**

```tsx
// Timeframe buttons: 1D 1W 1M 3M YTD 1Y
// Mode toggle: two buttons — "Flags" | "Performance"
// Styled compact, no taller than ~40px
```

**Step 4: Verify the full page**

- Globe renders on the left, no distortion
- Right panel shows GlobalSummary by default
- Click a country → panel transitions to CountryPanel
- Click X in panel → returns to GlobalSummary
- Mode toggle switches coloring
- Globe auto-rotates, stops on drag, resumes after 5s

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(global): wire globe + panel into Global page"
```

---

### Task 6: Polish Animations & Visual Quality

**Files:**
- Modify: `src/components/global/GlobeView.tsx`
- Modify: `src/components/global/CountryPanel.tsx`

**Step 1: Globe visual polish**

- Verify atmosphere glow looks realistic (adjust `atmosphereColor` and `atmosphereAltitude`)
- Ensure polygon transitions are smooth (300ms duration)
- Test that fly-to animation (800ms) is smooth and doesn't overshoot
- Verify hover altitude bump (0.005 → 0.02) feels responsive

**Step 2: Panel transition polish**

- Side panel enter: `transform: translateX(20px) → 0`, `opacity: 0 → 1` over 300ms
- Country switch: crossfade content (200ms)
- Tab switch: content crossfade (200ms)

**Step 3: Dark mode compatibility**

- Globe background: transparent (`rgba(0,0,0,0)`) so it inherits page background
- Panel uses existing `bg-card`, `text-foreground` tokens
- Selected country highlight should work in both themes

**Step 4: Test and commit**

```bash
git add -A && git commit -m "feat(global): polish animations and visual quality"
```

---

## Dependency Summary

| Package | Purpose | Size |
|---------|---------|------|
| `react-globe.gl` | 3D globe component | ~150KB gz |
| `three` | WebGL rendering (peer dep) | ~600KB gz |

## File Summary

| File | Action |
|------|--------|
| `src/data/countries-110m.geojson` | Create — GeoJSON country polygons |
| `src/data/countryMeta.ts` | Create — country → index/exchange mapping |
| `src/data/geojson.d.ts` | Create — TypeScript module declaration |
| `src/components/global/GlobeView.tsx` | Create — 3D globe component |
| `src/components/global/CountryPanel.tsx` | Create — tabbed country detail panel |
| `src/components/global/CountrySummary.tsx` | Create — summary tab (index + movers + news) |
| `src/components/global/CountryScreener.tsx` | Create — screener tab (stock table) |
| `src/components/global/GlobalSummary.tsx` | Create — default panel (world indices) |
| `src/hooks/useCountryStocks.ts` | Create — fetch stocks by country |
| `src/pages/Global.tsx` | Modify — full rewrite |
| `vite.config.ts` | Modify — add geojson to assetsInclude |
