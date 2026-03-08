# Global Investment Hub — Design

## Overview

Replace the current Global page (simple index card list) with an interactive 3D globe where users can click any country to explore its stocks, news, and market data. The globe is the centerpiece — lifelike, draggable, zoomable, with country polygons colored by market performance.

## Layout

50/50 split, full viewport height (no page scroll):

- **Left half**: Interactive 3D globe, rendered at full container height as its diameter, centered, `overflow: hidden` to clip horizontal overflow. Aspect ratio preserved (never stretched/distorted).
- **Right half**: Scrollable side panel. Before a country is selected, shows a global summary (world indices, top movers). After clicking a country, transitions to that country's detail view.
- **Header bar**: Spans full width above the split. Contains page title, timeframe selector (1D/1W/1M/3M/YTD/1Y), and display mode toggle (flag fill vs performance heatmap).

## Globe

**Library**: `react-globe.gl` (WebGL, three.js-based, ~150KB gzipped)

**Visual requirements**:
- Lifelike appearance: high-res Earth texture, subtle atmosphere glow, ambient + directional lighting
- Country polygons from GeoJSON (Natural Earth 110m for performance)
- Smooth auto-rotation until user interacts (then stops)
- Click-drag to rotate, scroll to zoom, click country to select
- Selected country: bright border/glow highlight
- Smooth animated transitions when rotating to a clicked country

**Country fill modes** (user-togglable):
1. **Flag fill**: Country polygons textured/colored with a representative color from their national flag (e.g. US = blue, China = red, Brazil = green). Full flag textures on 3D polygons are impractical, so use the flag's dominant color as a solid fill.
2. **Performance heatmap**: Green-to-red gradient based on the country's major index change % for the selected timeframe.

**Globe sizing**: `width` and `height` set to the container's height (making it a square that fills vertically), centered horizontally within the left half.

## Side Panel (Right Half)

### Default State (no country selected)

Global summary view:
- World indices grid (reuse existing `useIndices()` data) — compact cards showing index name, flag, value, change %
- Top 10 global movers (biggest gainers/losers across all countries)

### Country Selected State

Animated slide-in transition (300ms ease). Two tabs:

**Tab 1 — Summary**:
- Country flag (large) + country name header
- Major market index card (name, value, change %, sparkline if available)
- Top 5 gainers + Top 5 losers (from that country's stocks, sorted by change_percent)
- 5-10 recent news headlines (from `api-news` with country's top symbols)

**Tab 2 — Screener**:
- Sortable table of all stocks from that country
- Columns: Symbol, Name, Price, Change %, Market Cap, Sector
- Sector filter dropdown
- Click row navigates to `/stocks?symbol=XYZ`

## Data Flow

1. **Globe colors**: `useIndices()` provides index data per region. Map region → country ISO code → color.
2. **Country stocks**: Query Supabase `symbols` table filtered by `country` column, joined with `stocks` for price/change data.
3. **Top movers**: Sort country stocks by `change_percent` DESC/ASC, take top 5 each.
4. **News**: Call `api-news` edge function with the country's largest-cap symbols.
5. **Country mapping**: Static map: `{ "United States": { iso: "US", indexSymbol: "^GSPC", exchanges: ["NYSE", "NASDAQ"] }, ... }`

## Animations & Transitions

- Globe auto-rotation: smooth, stops on interaction, resumes after 5s idle
- Country click: globe animates (rotates + zooms) to center the clicked country (~800ms ease-out)
- Side panel content: fade + slide transition (300ms) when switching countries
- Tab switching: content crossfade (200ms)
- Hover on country polygon: subtle brightness increase

## Technical Constraints

- Globe must maintain 1:1 aspect ratio (never stretched)
- Globe renders in a WebGL canvas — sized via `width={containerHeight}` `height={containerHeight}`
- Side panel scrolls independently (overflow-y-auto)
- Page sets `body.overflow = hidden` to prevent outer scroll (same pattern as Markets page)
- GeoJSON loaded once, cached in module scope
- react-globe.gl handles its own animation loop — no React re-renders during rotation

## Dependencies

- `react-globe.gl` — 3D globe component
- `three` — peer dependency for react-globe.gl (may already be installed)
- GeoJSON data: bundled from Natural Earth (ne_110m_admin_0_countries.geojson, ~200KB)

## Countries Supported

Initial set based on available index data:
US, Canada, UK, Germany, France, Japan, Hong Kong, Australia, India, Brazil, South Korea, Europe (aggregated).

Any country with stocks in the `symbols` table is clickable; countries without data show an "No data available" state in the panel.
