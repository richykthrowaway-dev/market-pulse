# Commodity Trader Features — Design

**Date:** 2026-05-11
**Owner:** richykthrowaway
**Status:** Approved → Implementation

## Problem

The Commodities tab today is a reference card (prices, chart, news, producers). Traders need a decision surface — they want to know in 5 seconds:

1. *What's moving and why?* — drivers, catalysts
2. *Where am I in the regime?* — technicals, levels
3. *What's coming?* — scheduled events that move price

The current panel doesn't answer any of these well.

## Solution: three additions, no new external dependencies

### 1. Catalyst Countdown

A horizontal strip directly above the chart (visible when a commodity is selected) showing the next 3 scheduled economic events that historically move the selected commodity.

**Visual:**
```
⏱ NEXT CATALYSTS
  ⏱ 14h   US CPI YoY              est 3.2% prev 3.1%   ★★★
  ⏱ 6d    FOMC Rate Decision      est 5.50% prev 5.50% ★★★
  ⏱ 2w    ECB Rate Decision       est 4.50% prev 4.50% ★★
```

**Data:**
- `useEodhdEconomicEvents(undefined)` — existing, returns global calendar
- New static map `COMMODITY_CATALYSTS: Record<CommodityId, string[]>` — keyword list per commodity
  - Example: `gold: ['CPI', 'Inflation', 'FOMC', 'Rate Decision', 'NFP', 'Nonfarm', 'PCE']`
  - Example: `crude_oil: ['OPEC', 'EIA Crude', 'API Crude']`

**Logic:**
- Filter calendar to future-dated events whose `type` matches any keyword (case-insensitive substring)
- Sort by date ascending, take top 3
- Render countdown ("⏱ 14h" / "⏱ 6d") + impact stars (1/2/3 based on `impact: Low/Medium/High`)

**Components:**
- `src/data/commodityCatalysts.ts` — the static keyword map
- `src/components/global/trade/CommodityCatalystStrip.tsx` — the new component

### 2. Technical State Badges + Levels Strip

Three micro-pills next to the selected commodity's header, showing momentum/trend state at a glance. Plus horizontal reference lines on the chart at key levels.

**Badges:**
```
GOLD   $2,058.40 +0.34%   [▲ TREND]  [RSI 67]  [▲ 200d]
                          ─────────  ────────  ───────
                          above 50MA  neutral  above 200MA
```

**Levels on chart:**
- 52-week high (dotted green horizontal line)
- 52-week low (dotted red horizontal line)
- Recent 50-day breakout marker (small triangle if last close > prior 50-day max)

**Data:**
- New hook `useEodhdTechnicals(symbol, exchange)` — fires 3 parallel calls to `/api-eodhd?endpoint=technical&function=rsi&period=14`, `sma&period=50`, `sma&period=200`. Cache 1h.
- Existing `use52Week(symbol)` already provides 52w high/low.
- ATH / 50-day breakout computed client-side from existing bars data.

**Scope decision (YAGNI):** v1 shows badges ONLY for the selected commodity, not on every tile. Per-tile pills would cost 27 EODHD calls on mount (9 commodities × 3 indicators); per-selection is 3 calls only when needed.

**Components:**
- `src/hooks/useEodhdTechnicals.ts` — new hook
- `src/components/global/trade/CommodityTechBadges.tsx` — the 3-pill row
- Modify `CommodityPriceChart` to add ReferenceLine annotations for 52w levels and breakout marker

### 3. Driver Correlation Block

A 3-row block between the chart and news feed showing 30-day rolling Pearson correlation against the commodity's key macro drivers, with one-line interpretation.

**Visual:**
```
DRIVERS  (30-day rolling correlation)
  Dollar Index (UUP)        r = −0.62  ▼ inverse
  Real Yields (TIP, inv.)   r = −0.81  ▼ inverse (commodity rallies as TIP falls)
  Risk-On (SPY)             r = +0.31  ▲ co-move
```

**Drivers (universal for v1):**
- **UUP.US** — Dollar bullish ETF (proxy for DXY)
- **TIP.US** — TIPS bond ETF (inverse to real yields; we'll invert the displayed sign so it reads as "real yield correlation")
- **SPY.US** — broad equities (risk-on proxy)

**Logic:**
- Use existing `useEodhdBarsForChart` to fetch each driver's 5Y bars (cached separately per symbol)
- Compute log returns: `r[i] = log(close[i] / close[i-1])`
- Take last 30 daily returns for each series
- Align by date; compute Pearson `cov / (σ_x · σ_y)`
- Display value with direction arrow + interpretive text

**Components:**
- `src/lib/correlation.ts` — pure compute helpers (Pearson, log returns, date-aligned series)
- `src/components/global/trade/CommodityDriverBlock.tsx` — the new block

## Layout

```
┌────────────────────────────────────────────────────┐
│ Header: Commodities                                │
├────────────────────────────────────────────────────┤
│ Price strip (9 clickable tiles, unchanged)         │
├────────────────────────────────────────────────────┤
│ [selected commodity expanded:]                     │
│                                                    │
│ ⏱ NEXT CATALYSTS  · 3 upcoming events  ★★★         │ NEW
│                                                    │
│ Header: GOLD $2,058 +0.34%   ▲T  RSI67  ▲200d      │ UPDATED
│                                                    │
│ ─── Price chart (52w levels, breakout marker) ──── │ UPDATED
│                                                    │
│ DRIVERS  DXY −0.62 ▼  · TIPS −0.81 ▼  · SPY +0.31 │ NEW
│                                                    │
│ ─── News feed (unchanged) ───                      │
├────────────────────────────────────────────────────┤
│ Top Producers card (unchanged)                     │
└────────────────────────────────────────────────────┘
```

## Tradeoffs

1. **Tech badges per-selection only, not per-tile.** Avoids 27 EODHD calls on every panel mount. The per-tile glance view is a v2 nice-to-have.
2. **TIP.US as real-yields proxy.** EODHD's free tier doesn't expose actual real yields. TIP ETF moves inverse to real yields; we invert the displayed sign so the trader reads it as "real yield correlation". Acceptable approximation for "is gold trading on yields right now?" use case.
3. **Catalyst keyword matching is fuzzy.** EODHD event titles aren't standardised. We use case-insensitive substring matching. Bias toward false negatives (miss an event) over false positives (show a wrong event). The keyword list per commodity can be tuned over time.

## Out of scope (deferred)

- Per-tile technical badges (v2)
- Intraday chart toggle (separate effort)
- Spread / pair ratio dashboard (separate effort)
- News impact stamps with measured post-publish move (separate effort)

## Implementation order (separate commits)

1. **Catalyst Countdown** — smallest blast radius, no new hook
2. **Technical Badges + Levels** — new hook, chart annotations
3. **Driver Correlation Block** — new component + correlation lib

## Open questions

- Are there any specific commodities whose catalyst keyword list needs domain input? Initial list is best-effort; tuning in production should be data-driven.
