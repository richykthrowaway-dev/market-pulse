# Trade Tracker Round-2 — Design (4 phases)

**Date:** 2026-05-18
**Status:** Approved (design)
**Builds on:** the shipped Resilience Bundle (ErrorBoundary around each Trading
widget, self-healing `parseOpenTrades`/`parseJournal`, Undo for discard+close,
`addTrade` returns id). All Round-2 work renders inside that boundary and reads
self-healed data, so it cannot reintroduce the white-screen class.

## Hard constraints (carry forward)

- `src/App.tsx` and `src/pages/TradeJournal.tsx` are uncommitted user WIP —
  **never modify or stage them**. (We edit the hook `src/hooks/useTradeJournal.ts`,
  never the page.)
- **Never `git add -A`** — stage only the exact files per task.
- Vitest harness is node-only, glob `src/lib/**/*.test.ts`. Every new
  calculation is a pure `src/lib` function (TDD). UI is verified via
  `tsc` + `npm run build` + throttle-immune manual checks.
- Commits local; push only on explicit user request.

## Sequencing

Phase 1 → 2 → 3 → 4. Each phase is an independently reviewable/shippable
commit set. Phase 4 is last because it is the only one that changes the
write path.

## Phase 1 — Risk Cockpit lite

**New** `src/lib/portfolioRisk.ts` (pure, unit-tested):
`aggregateRisk(open: OpenTrade[], account?: number)` →
`{ totalRisk: number; pct: number | null; noStopCount: number;
   perPosition: { id: string; risk: number }[] }`.
Per-position risk = `|entryPrice − stopLoss| × quantity` for positions with a
finite `stopLoss`; positions without a stop contribute `0` and increment
`noStopCount`. `pct = account ? totalRisk / account * 100 : null`.

**Add** `openR(side, entry, stop, live)` to `src/lib/tradeMetrics.ts` (pure):
returns `(live − entry) / (entry − stop)` signed for side, or `null` if
`stop == null` or `entry === stop`. New `src/lib/tradeMetrics.test.ts`.

**UI (`TradeTracker.tsx`):**
- A compact strip in the Open Positions column header area:
  `Open risk: $X · Y% acct` (Y from `aggregateRisk` using
  `readRiskParams().account`). Turn red when
  `pct > 3 × readRiskParams().riskPct`. If `noStopCount > 0`, append
  `· N no-stop`. If no risk params saved, show `$X` only (no %, no warn).
- Per open-position row: a `+1.8R` style readout next to the existing
  `unrealizedPnl` $/%, from `openR` (green ≥ 0, red < 0, `—` if no stop).
- Crossing alert: a `useRef<Record<string, 'ok'|'breached'|'target'>>` of
  prior state. On a render where a position transitions INTO `breached`
  (via existing `stopProximity`) or target-hit (existing reached logic),
  fire one `toast` (`"AAPL hit stop"` / `"AAPL hit target"`) and add a
  short-lived CSS flash class to that row. Only on transition, never every
  render. In-app only — no browser Notification API.

## Phase 2 — Auto plan-adherence tag at close

**New** `src/lib/planAdherence.ts` (pure, unit-tested):
`classifyExit({ side, entry, stop, target, exitPrice })` → one of:
- `'target hit'` — exit reached/passed target (≥ target long / ≤ target short)
- `'let it run'` — exit beyond target (strictly past, > target long etc.)
- `'stopped'` — exit at/through stop
- `'cut early'` — exited for a loss or sub-1R gain without hitting stop
- `'overstayed'` — was past target intra-trade per `target` but exited below
  it for less than planned (best-effort from available fields)
Keep rules simple and total (always returns one tag). Inputs may be partial
(`stop`/`target` optional) → fall back to `'cut early'` / `'target hit'`
sensibly; never throw.

**Wire:** in `confirmClose`, compute the tag and pass
`tags: [classifyExit({...})]` into `addTrade` (currently `tags: []`).
`exitReason` unchanged.

## Phase 3 — Per-position sparkline + inline edit

**Sparkline:** in each open row, render `useSparkline(t.symbol)` as a
fixed-size recharts `<AreaChart>` (mirror `Watchlist`'s `WatchRow`: no
`ResponsiveContainer`, explicit width/height) with `<ReferenceLine>`s for
`entryPrice`, `stopLoss`, `target`, and live price. Already cached /
`enabled`-gated by `useSparkline`; already inside the ErrorBoundary.

**Inline edit:** an "Edit" ghost button per row toggles inline numeric
inputs for `stopLoss` / `target` and a text input for `notes`, committing
via `patchOpen(t.id, { … })`. Reuse close-form field styling. Esc/Cancel
discards. No schema change (`OpenTrade` already has these fields).

## Phase 4 — Partial / scale-out closes (isolated)

**New** `src/lib/splitClose.ts` (pure, unit-tested):
`planClose({ positionQty, closeQty })` →
`{ mode: 'full' | 'partial' | 'invalid'; closeQty; remainder }`.
`invalid` when `closeQty <= 0` or `closeQty > positionQty` or non-finite.

**Close form:** add a "Qty to close" numeric input, default = position
quantity, validated via `planClose`; Confirm disabled on `invalid`.

**`confirmClose`:**
- `full` → existing behavior unchanged (addTrade full, removeOpen, Undo).
- `partial` → `const id = addTrade({ …, quantity: closeQty,
  notes: [orig, closeNotes, "partial " + closeQty + "/" + positionQty]
  .filter(Boolean).join(' · ') })`; then
  `patchOpen(t.id, { quantity: remainder })` (position stays open).
  Undo: `deleteTrade(id)` + `patchOpen(t.id, { quantity: positionQty })`.
- Preserve the existing `isValidExit` + `submittingRef` guards exactly.

## Testing

- Pure libs (`portfolioRisk`, `tradeMetrics.openR`, `planAdherence`,
  `splitClose`) → TDD in the `src/lib/**` node Vitest harness.
- UI/wiring → `npx tsc --noEmit` + `npm run build` + throttle-immune manual
  reproduction (MessageChannel-driven, per the methodology lesson in
  `2026-05-18-tradetracker-freeze-findings.md`): risk strip math, R readout,
  crossing toast on a simulated price move, tag on close, sparkline render,
  edit round-trip, partial close + its Undo.
- Whole feature already wrapped by the shipped per-widget ErrorBoundary.

## Out of scope (YAGNI)

MAE/MFE (per-tick persistence), browser Notification API, auto-breakeven on
partial close, bulk actions, keyboard shortcuts, sort/filter. Possible later
polish round; explicitly excluded here.

## Files

New: `src/lib/portfolioRisk.ts`(+test), `src/lib/tradeMetrics.test.ts`,
`src/lib/planAdherence.ts`(+test), `src/lib/splitClose.ts`(+test).
Modified: `src/lib/tradeMetrics.ts`, `src/components/trading/TradeTracker.tsx`.
Never touched: `src/App.tsx`, `src/pages/TradeJournal.tsx`.
