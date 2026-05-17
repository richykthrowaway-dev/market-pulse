# Trading Tab — Fast Trade Entry + Pro-Terminal Restyle Design

**Date:** 2026-05-17
**Status:** Approved (brainstorm)
**Page:** `src/pages/Trading.tsx` + `src/components/trading/*`

## Goal

Cut the time to input a complete trade (entry/stop/target/qty) by
eliminating manual price typing, and restyle the Trading tab into a
dense pro-terminal look.

## Scope (locked)

- **Speed lever:** stop typing prices. Live-entry prefill, quick `%`/`R`
  chip-set for stop & target, qty auto-derived from risk. (Chart
  click-to-set + ATR chips = Wave 2.)
- **Look:** pro-terminal restyle, scoped `.trading-terminal` namespace
  reusing existing tokens — no new color system, no other pages touched.
- **YAGNI:** unified entry = the Order Ticket; Trade Tracker stays as the
  open-positions list (no duplicate form). No new data layer.

## Section 1 — Faster price entry (Wave 1)

- **Entry**: auto-filled from live quote on symbol pick (extends current
  behavior); a `Use live` button re-snaps to the latest quote.
- **Stop chips**: `−1% −2% −3% −5%` relative to entry (long: below;
  short: above). Sets the stop price; field stays editable to override.
- **Target chips**: `+1R +2R +3R` computed from entry & current stop.
  Editable override.
- **Qty auto from risk**: once entry+stop set, default
  `qty = floor(account × riskPct% ÷ |entry−stop|)` from `tp-risk-v1`
  via the existing `riskPreview` inputs; shown as default, editable.
- **Keyboard**: Enter advances/submits; existing confirm step retained.
- Chips/auto-qty disable until prerequisites exist (no NaN).

## Section 2 — Pro-terminal restyle (Wave 1, scoped)

Namespaced `.trading-terminal`; other pages untouched. Reuses
`--trading-buy/-sell` + `hsl(var(--…))` tokens.

- Drop heavy `Card` chrome on the workspace → tight panels, hairline
  `border-border/40` dividers, ~30% less vertical padding.
- All numerics `font-mono-num`, right-aligned, consistent decimals;
  signed buy/sell/neutral coloring.
- Compact sticky header strip (symbol, live price+change, connection
  dot) replacing the large title block.
- Tighter watchlist/positions rows, inline sparkline, hover-reveal
  actions.
- Order Ticket retains segmented buy/sell; restyled to terminal
  vocabulary with the new chip rows as compact pill toggles.
- No logic changes in this section.

## Section 3 — Error handling, testing

- No quote → prefill/`Use live` disabled, manual entry works; dependent
  chips disabled until entry/stop exist.
- Pure chip/qty math in `src/lib` (e.g. `priceFromPct`, `priceFromR`,
  `qtyFromRisk`) with vitest tests, reusing/aligned with `riskPreview`.
- Verify: unit tests; `npm run build`; preview the full entry flow
  (pick → entry prefilled → 2 chip clicks → qty auto → confirm →
  tracked) + a screenshot of the restyle.

## Wave 2 (deferred)

Click-on-chart to set stop/target lines; ATR-based chips; broader
terminal polish; the earlier-deferred controlled-Tabs-on-disconnect fix.
