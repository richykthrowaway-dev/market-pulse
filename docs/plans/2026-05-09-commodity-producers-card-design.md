# Commodity Producers Card — Design

**Date:** 2026-05-09
**Owner:** Trade panel
**Status:** Approved, ready to implement

## Goal

In the Global page's Trade tab, give the user a quick lookup: pick a commodity from a dropdown, see the top producing countries ranked by share. No deep analytics — just a clear "who makes this" reference.

## User-facing behaviour

- New card sits in the right-side trade panel, between the layer toggles and the AIS/flight status banners.
- Dropdown lists 12 commodities grouped by category (Energy / Metals / Agriculture).
- Selecting a commodity renders a ranked list of the top 8 producing countries: flag emoji · country name · share % · horizontal bar that fills proportional to share.
- Default selection on first open: Crude Oil.
- Footer attribution under the list: source agency + year (e.g. "USGS · 2023").

## Scope decisions (from brainstorming)

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Producer granularity | Countries | Companies; both | Matches the rest of the trade map's mental model. Stable public data. Companies can come later as a row-expand if useful. |
| Visual format | Ranked list with horizontal bars | Map highlight; both | Right panel is column-shaped, list reads naturally. The map already tells spatial stories via layer toggles. |
| Commodity scope | 12 (curated cross-section) | 6; 20 | Covers each major category without becoming a scroll fest. |
| Panel placement | Middle (between toggles and banners) | Top; bottom | It's lookup data, deserves a clear break from the layer toggles, but not banished below the banners. |

## Architecture

### Data layer (static)

New file: `src/data/tradeInfrastructure/commodities.ts`

```ts
export type CommodityCategory = 'energy' | 'metals' | 'agriculture';

export interface CommodityProducer {
  iso2:  string;   // resolves to flag + name via countryMeta.ts
  share: number;   // percent of global production, 0–100
}

export interface Commodity {
  id:        string;             // 'crude-oil', 'natural-gas', …
  label:     string;             // 'Crude Oil'
  category:  CommodityCategory;
  unit:      string;             // 'Mbpd', 'Mt', '1000 bags', etc.
  source:    string;             // 'EIA', 'USGS', 'FAO', …
  year:      number;
  producers: CommodityProducer[]; // pre-sorted descending; top 8
}

export const COMMODITIES: readonly Commodity[];
```

Twelve commodities, hand-curated from public sources:

| Category | Commodities |
|---|---|
| Energy | Crude Oil, Natural Gas, Coal |
| Metals | Iron Ore, Copper, Gold, Lithium, Cobalt |
| Agriculture | Wheat, Corn, Soybeans, Coffee |

Each has top-8 producers; shares pre-normalised so the bar widths are directly proportional. No external API call.

### Component

New file: `src/components/global/trade/CommodityProducersCard.tsx`

- Pure presentational component, no props from the panel.
- Local `useState<string>` for the selected commodity id, default `'crude-oil'`.
- Looks up the commodity by id via `Map.get` on a memoised `id → Commodity` index.
- Resolves country name + flag from existing `countryMeta.ts` via ISO-2.
- Uses shadcn `Select` for the dropdown (already in `components/ui/select.tsx`).
- Bar widths via inline `style={{ width: `${(share / max) * 100}%` }}` against a fixed-width track.

Roughly:

```
┌─────────────────────────────────────────┐
│ 🏭 Top Producers           ▾ Crude Oil   │
├─────────────────────────────────────────┤
│ 🇸🇦 Saudi Arabia    12.4%  ████████░░░░ │
│ 🇺🇸 United States   11.8%  ███████░░░░░ │
│ 🇷🇺 Russia          10.9%  ██████░░░░░░ │
│ 🇨🇳 China            5.1%  ███░░░░░░░░░ │
│ …                                        │
├─────────────────────────────────────────┤
│ EIA · 2023 · production share %         │
└─────────────────────────────────────────┘
```

### Integration

Three-line edit to `TradeInfrastructurePanel.tsx`:

1. `import { CommodityProducersCard } from './CommodityProducersCard';`
2. Render `<CommodityProducersCard />` between the existing layer-toggle section and the `<AISStatusBanner>` / `<FlightStatusBanner>` block.

No props need to flow in; the card is self-contained.

## Non-goals (explicitly out of scope)

- No live API integration. Curated data only.
- No company-level producer data.
- No map highlighting on commodity selection.
- No time-series of production share.
- No drill-down from a country row to a country page.

These are all reasonable v2+ ideas but explicitly not v1.

## Bundle impact

- Data file: ~150 lines TS, ~3 KB after gzip — bundled into the existing trade chunk.
- Component: ~120 lines TSX, no new dependencies (`Select`, `Factory` icon, `cn` already in use).
- Net: well under 5 KB delta on the trade chunk.

## Files touched

| File | Action | Approx LOC |
|---|---|---|
| `src/data/tradeInfrastructure/commodities.ts` | New | ~150 |
| `src/components/global/trade/CommodityProducersCard.tsx` | New | ~120 |
| `src/components/global/trade/TradeInfrastructurePanel.tsx` | Edit (import + render) | +2 / -0 |

## Verification

1. `npx tsc --noEmit` clean.
2. Manual: open Global → Trade → see card between toggles and banners. Switch commodity, see list update. Bar widths sum visually consistent.
3. Spot-check producer data against source agency for one commodity (Crude Oil → EIA).
