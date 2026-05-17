# Trade Tracker — Live Monitoring Design

**Date:** 2026-05-17
**Status:** Approved (brainstorm)
**Component:** `src/components/trading/TradeTracker.tsx`

## Goal

Make tracked open positions *live*: poll real-time quotes and surface
unrealized P&L and distance-to-stop/target per position, with a user
toggle between a 30s (default) and 5s refresh cadence.

## Scope (locked)

- **Focus:** live monitoring of open positions only.
- **Refresh:** auto-poll `api-yahoo` quotes; default 30s, optional 5s "fast" mode.
- **Metrics per position:** unrealized P&L ($ and %); distance to stop/target
  with a proximity color warning.
- **Out of scope (YAGNI):** portfolio totals/heat, R-multiple bar, position
  management (edit/scale), entry-flow changes, IBKR live feed.

## Architecture

Approach **A** (chosen): a shared React Query hook owns freshness and
dedup; market data never enters the localStorage-backed `useOpenTrades`
store.

### Section 1 — Data layer

- `fetchYahooQuoteLive(symbol)` in `src/services/yahooFinanceApi.ts`:
  same `api-yahoo?endpoint=quote&symbol=` call as `fetchYahooQuote`, but
  **without** `fetchCached` (React Query owns freshness instead of the
  15-min localStorage TTL).
- `src/hooks/useLiveQuotes.ts`: input `symbols: string[]`, `intervalMs: number`.
  Uses `useQueries` (one query per unique symbol),
  `refetchInterval: intervalMs`, `refetchIntervalInBackground: false`,
  `staleTime: intervalMs - 5_000`. Returns
  `Record<symbol, { price: number | null; updatedAt: number }>`.
  Empty input → zero requests.

### Section 2 — UI: per-position live metrics

Each open-position card gains a live row (rendered only when a quote is
available; otherwise "—" + faint "waiting for price"):

- **Unrealized P&L** (headline, bold): `(price − entry) × qty`,
  sign-flipped for shorts. Shows `$` and `%`, colored buy-green / sell-red.
- **Distance to stop / target**: live `%` and price gap to each.
  Stop turns **amber** when price is within 25% of the entry→stop
  distance ("stop is close"), **red** when price has crossed the stop.
  Target turns **green** when reached.
- Section header gains: "updated Ns ago · {30s|5s}" timestamp and a single
  **5s/30s speed toggle** for the whole tracker (next to the "N tracked"
  count). One toggle, not per-card.

### Section 3 — Edge cases

- No/failed quote → static plan numbers as today; live row "—"; never
  blocks the close flow; no error-toast spam for unknown symbols.
- Tab hidden → polling pauses; resumes + refetches on focus.
- Open set changes → hook is driven by the live `open` array; queries
  add/drop automatically; closing a trade stops its poll.
- Speed toggle persists via `usePersistentState` key `tt-live-speed-v1`;
  default 30s.
- Hook is write-free → safe for the Journal's read-only Open view later.

## Testing

- **Unit:** P&L math (long, short, loss); stop-proximity band
  (far/near/crossed); `useLiveQuotes` empty-for-`[]` and dedup.
- **Manual (preview):** live P&L appears within one interval; 5s toggle
  speeds the timestamp; mock stop-cross → amber/red; hide tab → polling
  stops; close trade → poll drops; reload → toggle persists.
