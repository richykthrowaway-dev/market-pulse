# Trade Intel View + Story Mode Presets — Design

**Date:** 2026-05-11
**Scope:** Add a synthesis layer to the Trade tab. Today the tab is data-rich on the input side (live AIS, flights, conflicts, earthquakes) but doesn't answer derived questions like "is Suez busy right now?" or "which ports are congested?" This adds an Intel view computing those answers from data already in the browser.

---

## Goals

1. **Squeeze more value from the AIS stream** — we already receive thousands of vessel positions per minute; surface them as chokepoint and port metrics.
2. **Bring the macro calendar into the trade context** — the next Fed/ECB meeting matters as much as physical trade flows.
3. **Add curated story-mode presets** for major ongoing crises so users land on relevant views without hunting.

## Non-goals

- New external data sources (Baltic Dry, Lloyd's, etc.) — deferred to a later iteration.
- Historical AIS analytics (vessel-day storage, dark fleet detection) — requires server-side logging not yet in place.
- Vessel type filter — deferred; touches GlobeView's imperative Three.js layer.

---

## UX

The TradeInfrastructurePanel gains a **view-toggle strip** at the top, matching the pattern from the Commodities tab:

```
┌─ Trade ────────────────────────────────────────────┐
│  [Infrastructure] [Intel]                          │
│                                                    │
│  ▼ active view                                     │
└────────────────────────────────────────────────────┘
```

- **Infrastructure** view = the panel's current contents (worldwide toggle, metrics, layers, story modes, search, node detail). No regression.
- **Intel** view = new. Three stacked cards.

### Intel view cards

**1. Choke Point Status Board**

Lists all 11 chokepoints with live AIS transit count.

```
🔴 Hormuz          47 vessels nearby   ↑ vs typical
🟢 Suez            32 vessels nearby   normal
🟡 Bab el-Mandeb    6 vessels nearby   ↓ diverting (Cape route)
…
```

Each row: chokepoint name • current vessel count within 100km • directional indicator (compared to a static "typical" baseline embedded in the chokepoint data file) • affected commodity chips on hover.

Click a row → camera flies to that chokepoint on the globe.

**2. Port Stress Dashboard**

Top 10 of our 35 seaports ranked by current vessel count within 50km. Shows: flag • port name • vessel count • bar scaled to busiest port • TEU/year for context.

This is the "live congestion" signal — if Shanghai shows 200+ vessels and Rotterdam shows 80, the user sees relative pressure immediately.

**3. Policy Calendar Strip**

The next 7 days of high-impact economic events filtered from `useEodhdEconomicEvents` (already implemented for the Economy tab — we re-use the hook but with a `worldwide` mode that pulls multiple major countries).

Filter rules:
- Country in: US, EU, JP, CN, GB, IN, BR (major monetary blocs)
- Event type contains: "interest rate", "gdp", "cpi", "pmi", "fomc", "employment"
- High importance only

Layout: horizontal scrollable strip of date-grouped event chips.

### Story Mode Presets (new entries in `storyModes.ts`)

Five new presets with curated layer combinations and camera focus:

| ID | Name | Layers Activated | Camera |
|----|------|------------------|--------|
| `red-sea-crisis` | Red Sea Crisis | maritimeRoutes, seaports, chokepoints, conflictEvents, liveVessels | 15°N, 42°E (Bab el-Mandeb) |
| `panama-drought` | Panama Drought | maritimeRoutes, seaports, chokepoints, liveVessels | 9°N, -80°W (Panama Canal) |
| `taiwan-contingency` | Taiwan Contingency | maritimeRoutes, seaports, chokepoints, airRoutes, airports, conflictEvents | 24°N, 121°E (Taiwan Strait) |
| `russia-energy-cutoff` | Russia Energy Cutoff | maritimeRoutes, seaports, railCorridors, inlandHubs, economicEvents | 55°N, 30°E (Eastern Europe) |
| `usmca-border` | USMCA Border | seaports, airports, railCorridors, inlandHubs, tradePartners | 30°N, -100°W (Texas-Mexico) |

---

## Architecture

### New files

```
src/components/global/trade/
  ├─ TradeIntelView.tsx              ← new, the Intel sub-view root
  ├─ ChokePointStatusBoard.tsx       ← new, AIS-derived per-chokepoint counts
  ├─ PortStressBoard.tsx             ← new, AIS-derived per-port counts
  └─ PolicyCalendarStrip.tsx         ← new, multi-country EODHD events filter

src/hooks/
  └─ useAisDerivedMetrics.ts         ← new, computes chokepoint+port counts from useAISStream
```

### Modified files

- `src/components/global/trade/TradeInfrastructurePanel.tsx` — add view-toggle, render Intel view conditionally
- `src/data/tradeInfrastructure/storyModes.ts` — add 5 new presets
- `src/data/tradeInfrastructure/chokepoints.ts` — add optional `typicalDailyTransits` field (curated baseline for delta indicator)

### Data flow

```
useAISStream (already running, singleton)
        │
        ▼
useAisDerivedMetrics(vessels)
        │   - computes Map<chokepointId, count> via haversine within 100km
        │   - computes Map<portId, count> via haversine within 50km
        │   - memoised, recomputes only when vessels array reference changes
        ▼
TradeIntelView consumes ⇒ renders 3 cards
```

### Haversine performance

With ~5,000–20,000 vessels and 11 chokepoints + 35 ports, the loop is ~700k distance computations per recompute. AIS state flushes every 2s but we should debounce/throttle the derivation to every 10s to keep the panel cheap.

Implementation detail: wrap `useAisDerivedMetrics` in a `useMemo` keyed by a vessel-count + last-flush-timestamp tuple, so we don't recompute on every minor stream tick.

### Policy Calendar data source

The existing `useEodhdEconomicEvents(iso2)` is country-scoped. We need a multi-country variant:

```ts
useGlobalPolicyEvents() // fetches major 7 countries in parallel, merges, filters
```

This requires a small change to either:
- A new edge function call pattern (loop client-side over 7 countries via existing `api-eodhd?endpoint=economic-events`), or
- A new edge function `api-policy-events` that pre-merges server-side.

We pick the **client-side fan-out** for v1 — it's 7 HTTP calls, all React Query-cached for 30 min, total ~7 EODHD credits. Cheap, no new edge function.

---

## Open questions / risks

1. **Typical baseline for chokepoints** — "47 vessels, up vs typical" requires a baseline. We hardcode it per chokepoint based on published transit data (e.g., Hormuz ~50/day, Suez ~50/day, Panama ~40/day). These are 24h transits, not instantaneous counts, so we'll need to calibrate the threshold experimentally. For v1, we ship the field as optional and only show ↑/↓ arrows when set.

2. **AIS coverage gaps** — aisstream.io may have sparse coverage in some regions; counts are indicative, not exhaustive. We add a footnote on each board: "Live AIS — coverage varies by region."

3. **Stale Policy events** — EODHD economic events sometimes lag actual releases by hours. We accept this for v1.

---

## Testing

- Manual: open the Trade tab on `/global`, switch to Intel view, verify the three boards populate within ~10s of AIS connecting.
- Manual: click each new story mode, verify layers activate and camera moves.
- Build check: `npm run build` should succeed with no new TypeScript errors.

## Out of scope (next iteration ideas)

- Vessel type filter (tankers / containers / bulkers) — needs GlobeView Three.js touchpoint
- Dark fleet detector — needs server-side AIS history logging
- Suez/Panama wait time — needs algorithmic stationary-vessel detection
- Foreign US Treasury holders — additive Tier-A card, separate work
- EU gas storage — additive Tier-A card, separate work
- Strategic Petroleum Reserve — additive Tier-A card, separate work
