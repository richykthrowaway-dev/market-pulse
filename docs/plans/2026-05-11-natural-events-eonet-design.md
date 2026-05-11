# Natural Events via NASA EONET — Design

**Date:** 2026-05-11
**Scope:** Add wildfires, severe storms, volcanoes, and floods as four separate globe overlays, sourced from NASA's EONET (Earth Observatory Natural Event Tracker) API. Pattern mirrors the existing earthquake / conflict / economic-event overlays.

## Goals

1. Surface globally relevant natural disasters as toggleable globe layers in the Trade tab.
2. Make each disaster type independently toggleable (like Live Vessels / Live Flights), not lumped under one switch.
3. Click an event → draggable detail dialog showing description, source link, and commodity-impact context — same pattern as `ConflictEventDialog`.

## Non-goals (v1)

- Earthquakes via EONET — we already have USGS, would duplicate.
- Other EONET categories (drought, landslides, snow, water color, dust & haze, sea/lake ice, temp extremes, manmade) — niche for v1.
- Per-event severity classification (FIRMS confidence bands etc.) — defer.
- Time-slider scrubbing through event geometries — defer.

## Architecture

### Data source

`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300`

- **Free**, no auth, CORS-open — same direct-fetch pattern as USGS earthquakes.
- One HTTP call returns all 13 categories; we filter client-side to the four we expose.
- Each event carries multiple `geometry[]` records (a storm has a track); we use the **most recent** geometry as the event's "current" location.

### Single hook, four layers

A single `useNaturalEvents(enabled)` hook fetches the whole feed. The four layer toggles drive client-side filtering by category. This is cheaper than four parallel calls and matches how EONET serves data.

```ts
const events = useNaturalEvents(
  tradeTabActive && (
    activeLayers.has('wildfires') ||
    activeLayers.has('severeStorms') ||
    activeLayers.has('volcanoes') ||
    activeLayers.has('floods')
  )
);
```

### Files

**New**
- `src/hooks/useNaturalEvents.ts` — direct EONET fetch, React Query cached 30 min
- `src/components/global/trade/NaturalEventDialog.tsx` — draggable detail card (mirrors `ConflictEventDialog`)

**Modified**
- `src/data/tradeInfrastructure/types.ts` — extend `LayerKey` with `'wildfires' | 'severeStorms' | 'volcanoes' | 'floods'`
- `src/pages/Global.tsx` — wire hook, filter events by enabled categories, plumb to GlobeView
- `src/components/global/GlobeView.tsx` — render natural events as rings (size/color by category)
- `src/components/global/trade/TradeInfrastructurePanel.tsx` — add four toggle pills in Intelligence Overlays group

### Type shape

```ts
export interface NaturalEvent {
  id:         string;
  title:      string;
  category:   'wildfires' | 'severeStorms' | 'volcanoes' | 'floods';
  date:       string;       // ISO; latest geometry's date
  lat:        number;
  lng:        number;
  countryIso2: string | null; // nearest-centroid lookup for commodity context
  description: string | null;
  sourceUrl:  string;        // EONET detail page (link[0])
  /** Number of geometry points — high count = long-duration event (long track). */
  geometryCount: number;
}
```

### Color palette per category

| Category | Color | Icon |
|----------|-------|------|
| Wildfires | `#f97316` (orange) | Flame |
| Severe Storms | `#06b6d4` (cyan) | Wind / Cyclone |
| Volcanoes | `#dc2626` (red) | Mountain |
| Floods | `#3b82f6` (blue) | Droplets |

### Globe rendering

Each event renders as a pulsing ring (like earthquakes), color-coded by category. Ring size = constant (we don't have a severity scale from EONET). Click → `NaturalEventDialog`.

To keep the globe legible we cap at **150 events** total after category filter, ranked by most-recent date.

### Country attribution + commodity impact

EONET events carry lat/lng but no country. We approximate via **nearest-centroid lookup** against `COUNTRY_META` (already in the codebase). Once we have the country, the dialog can show "affected commodities" — same logic as `ConflictEventDialog` / `EarthquakeDialog`.

For categories where commodity impact is location-agnostic (e.g. tropical storm over open ocean affects shipping not a country), the dialog shows category-specific generic context instead ("Shipping disruption in the [region]").

## Performance & freshness

- React Query staleTime: **30 minutes** (EONET updates a few times per hour for fast-moving events like wildfires)
- Single fetch shared across all four layer subscribers via React Query cache
- Hook only fires when at least one of the four layers is active AND the Trade tab is open — matches the existing AIS/flight gating pattern

## Risks

1. **Volume cap may hide minor events**. 150 is generous but wildfire-heavy days can easily exceed. Acceptable trade-off; future iteration can add severity filtering or zoom-based clustering.
2. **EONET attribution lag for closed events**. We pull `status=open` only — short-lived events that close fast (e.g. a 6-hour squall) may already be dropped. Acceptable for "current state" view.
3. **Geometry coordinate format**. EONET sometimes returns `[lng, lat]` GeoJSON order, sometimes nested arrays for polygons. The hook normalizes to `{lat, lng}` and skips polygons (uses centroid).
