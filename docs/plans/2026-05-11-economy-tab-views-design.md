# Economy Tab — View Toggle + 3 New Views

**Date:** 2026-05-11
**Scope:** Extend the per-country Economy tab with a view-toggle pattern (same UX as Commodities/Trade) and add three focused analytical views.

## Goals

1. Reframe Economy tab around four lenses: **Overview** (existing), **Macro Trends** (NEW), **Fiscal Health** (NEW), **Compare** (NEW).
2. Stop discarding historical data we already fetch — `useEodhdMacro` pulls full series and uses only the last point.
3. Add fiscal-health visibility (debt, deficit, credit rating) — currently absent despite being core to country analysis.
4. Add a cross-country comparison view — context that's impossible from raw numbers alone.

## Non-goals (v1)

- Currency-vs-USD card → defer (more work to plumb FX rate hook into per-country code mapping)
- Forex reserves trend → defer
- Bond yield card → defer
- News sentiment, surprise index → defer
- Macro health composite score → defer
- Sectoral GDP breakdown → defer

We are NOT trying to ship everything brainstormed. Pick the highest-leverage subset, ship, iterate.

---

## UX

```
┌─ Economy ────────────────────────────────────────────┐
│  [Overview] [Macro Trends] [Fiscal Health] [Compare] │
│                                                      │
│  ▼ active view                                       │
└──────────────────────────────────────────────────────┘
```

- **Overview** — keep existing 5 sections unchanged (TradeSnapshot, TradeBreakdown, TradePartners, EODHD calendar table, TradingView widget).
- **Macro Trends** — historical chart with toggleable indicators.
- **Fiscal Health** — government debt + fiscal balance + sovereign credit rating.
- **Compare** — country vs region vs world scorecard.

## Macro Trends view

A single multi-line Recharts area chart with:
- 4 toggleable indicators: GDP growth (line), Inflation (line), Unemployment (line), Real Interest Rate (line)
- Time-range pills: 5Y / 10Y / 20Y / All
- Hover tooltip shows each indicator's value at that year
- Indicator chips above the chart act as toggle filters (click to hide/show)
- Footnote attributes EODHD source

**Data source**: NEW hook `useEodhdMacroHistory(iso2)` — same 4 EODHD calls as `useEodhdMacro` but returns the full arrays. 0 extra API cost (cache key is the same shape, can even share cache with the snapshot hook).

## Fiscal Health view

Three cards stacked:

**1. Government Debt / GDP gauge** with risk-threshold markers
- World Bank indicator `GC.DOD.TOTL.GD.ZS` (central govt debt % GDP)
- Gauge bar 0–200%, color-coded segments: green <60%, amber 60-100%, orange 100-150%, red >150%
- Show current value + 5Y trend sparkline below

**2. Fiscal Balance / GDP card**
- World Bank `GC.BAL.CASH.GD.ZS` (cash surplus/deficit % GDP)
- Current value with +/- prefix, color green/red
- 10Y trend sparkline

**3. Sovereign Credit Rating badges**
- Three side-by-side badges: Moody's / S&P / Fitch
- Static curated file `sovereignRatings.ts` with current ratings + outlook
- Colored by investment grade (AAA-BBB green, BB-B amber, CCC-D red)
- "Updated YYYY-MM" footnote

**Data sources**:
- World Bank free direct calls (same pattern as `useWorldBankTrade`)
- Static lookup file for credit ratings (~80 countries, manually maintained)

## Compare view

A scorecard table:

| Indicator | Country | Region avg | World avg | Percentile |
|-----------|---------|------------|-----------|------------|
| GDP growth | 2.4% | 3.1% | 2.8% | 35th |
| Inflation | 3.2% | 5.1% | 4.4% | 62nd (lower better) |
| Unemployment | 4.0% | 6.8% | 5.4% | 70th (lower better) |
| Debt / GDP | 95% | 70% | 78% | 25th (lower better) |
| Current Account | -2.5% | -1.0% | 0.0% | 30th |

Each row: country value, region average, world average, percentile bar with color.

**Data sources**:
- For country values: same calls as Macro Trends + Fiscal
- For regional aggregates: World Bank uses the same indicator API but with region codes instead of country codes (e.g., `EAS` for East Asia & Pacific, `WLD` for World)
- NEW static lookup `countryRegions.ts`: ISO2 → World Bank region code

---

## File Plan

### New files

```
src/hooks/
  ├─ useEodhdMacroHistory.ts        ← extends useEodhdMacro to return full arrays
  ├─ useWorldBankFiscal.ts          ← debt/GDP + fiscal balance
  └─ useWorldBankComparison.ts      ← country vs region vs world

src/data/
  ├─ sovereignRatings.ts            ← static Moody's/S&P/Fitch lookup
  └─ countryRegions.ts              ← ISO2 → WB region code

src/components/global/economy/
  ├─ MacroTrendChart.tsx
  ├─ FiscalHealthCard.tsx           (composes debt + deficit + rating)
  ├─ SovereignRatingBadges.tsx
  └─ ComparisonScorecard.tsx
```

(Note: making a new `economy/` subfolder mirrors `trade/` for cleanliness.)

### Modified files

- `src/components/global/CountryEconomy.tsx` — add view toggle, route to new view components

---

## Architecture notes

### Sharing data between Macro Trends and existing MacroSnapshot

`useEodhdMacro` currently fetches the 4 indicators and discards everything but the last value. We have two options:

**(A) New hook `useEodhdMacroHistory` that fetches independently.**
   - Pro: clean separation
   - Con: duplicate 4 EODHD calls (8 credits per country instead of 4)

**(B) Refactor `useEodhdMacro` to expose history, and let the existing MacroSnapshot derive the last point from it.**
   - Pro: 0 extra API calls
   - Con: touches existing code path

I pick **(B)** — refactor the hook to return both snapshot and history. The snapshot is just `history[history.length - 1]`. No new EODHD credit cost.

### Region aggregates

World Bank's indicator API accepts region codes seamlessly:
```
GET /v2/country/EAS/indicator/NY.GDP.MKTP.KD.ZG
```
returns the GDP growth rate for "East Asia & Pacific (all income levels)". Same response shape as country codes. World aggregate: `WLD`.

The `countryRegions.ts` lookup maps each ISO2 to its primary WB region:
```ts
EAS = East Asia & Pacific
ECS = Europe & Central Asia
LCN = Latin America & Caribbean
MEA = Middle East & North Africa
NAC = North America
SAS = South Asia
SSF = Sub-Saharan Africa
```

### Sovereign credit ratings

A static file approach (no API). Coverage: ~80 countries that have public ratings from at least one of S&P/Moody's/Fitch. Schema:

```ts
interface SovereignRating {
  moody: { rating: string; outlook?: 'positive' | 'stable' | 'negative' };
  sp:    { rating: string; outlook?: 'positive' | 'stable' | 'negative' };
  fitch: { rating: string; outlook?: 'positive' | 'stable' | 'negative' };
  updated: string;  // "YYYY-MM"
}
```

Update cadence: when a major agency action happens (roughly monthly). For v1, ship with snapshot of current ratings.

---

## Open risks

1. **World Bank data lag** — fiscal indicators are typically 1–2 years delayed. We show the date alongside each value so users know what year they're looking at.

2. **Coverage gaps** — not every country has every indicator (small/closed economies often lack debt-to-GDP). Show "—" gracefully with a helpful tooltip.

3. **Credit rating maintenance** — static file goes stale. Show the `updated` date prominently so users know when it was last refreshed. Long-term: scrape S&P/Moody's RSS or use a paid API.

4. **Comparison view fairness** — comparing a low-income country to "world average" can mislead. We pair every comparison with the region average (more apples-to-apples) and let the user see both.
