# Trade Tracker — Streaming Entry + Visualizations Design

**Date:** 2026-05-17
**Status:** Approved (brainstorm)
**Component:** `src/components/trading/TradeTracker.tsx`

## Goal

Make trade entry faster by (a) a streaming-feel live entry price + 1-click
presets and (b) decision visualizations, all reusing existing infra (no
new backend).

## Scope (locked)

- **Live data:** streaming-feel entry + 1-click presets, driven by the
  existing shared `useLiveSpeed` 5s/30s toggle (no websocket; poll-backed
  via `useLiveQuotes`).
- **Visualizations:** R/R bar, payoff gauge, mini live chart with level
  lines.
- **YAGNI / Wave 2:** editable entry-defaults UI, price ladder, true
  push feed, chart click-to-set, ATR-based defaults.

## Section 1 — Streaming entry + 1-click presets

- Draft symbol joins the polled set:
  `useLiveQuotes([...openSymbols, draft.symbol], intervalMs)` (shared
  5s/30s toggle; dedup free). Replaces the one-shot `live` fetch — live
  price refreshes continuously while the form is open.
- Entry **follows live price** until the user types or clicks **Market**
  (pins entry = current live, stops following); typing also locks. A
  "● live / 🔒 locked" indicator.
- **1-tap Quick-fill**: sets entry=live, stop=default% (fallback −2%),
  target=default R (fallback +2R), qty=auto-from-risk — a complete
  trackable trade in one click. Defaults from `tp-risk-v1` + a small
  `tp-entry-defaults-v1` (Wave 1 uses sane constants; editable UI = Wave 2).

## Section 2 — R/R bar + Payoff gauge

Both pure; replace/augment the current text-only deal-preview block.

- **R/R bar**: horizontal track `stop — entry — target` at true
  proportional spacing, live-price marker sliding along it, sell-red /
  buy-green shading, R-multiple labeled.
- **Payoff gauge**: `if stopped −$X (−Y%)`, `if target +$X (+Z%)`,
  `now: live P&L $ / distance to each level`, position value vs account %.
  Reuses the existing `preview` useMemo math.

## Section 3 — Mini live chart + level lines

- Compact recharts area chart of the draft symbol via existing
  `useSparkline(draft.symbol)`; `ReferenceLine`s for entry/stop/target +
  a dot at the latest live price. Last Wave-1 task; drops to Wave 2 if it
  balloons.

## Error handling

No symbol / no quote → fall back to manual entry; Market/Quick-fill
disabled; bar + gauge render from typed values; chart shows "no data";
never blocks manual entry. Polling pauses on hidden tab (inherited).

## Testing

Pure logic (R/R bar geometry %, payoff figures, quick-fill default
resolution) → `src/lib` + vitest, reusing `entryMath`. Then
`npm run build`; preview the full flow (pick → stream → Market lock →
Quick-fill → bar/gauge/chart → track) + screenshot; clean test data.

## Reuse (no new data layer)

`useLiveQuotes`, `useLiveSpeed`, `entryMath`, `useSparkline`, recharts,
the existing `preview` useMemo, `useOpenTrades`.
