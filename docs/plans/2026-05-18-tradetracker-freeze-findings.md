# Trade Tracker Close-Form Freeze — Investigation Findings (handoff)

**Date:** 2026-05-18
**Status:** RESOLVED (2026-05-18) — see "Resolution" at the bottom. The "freeze"
was **not** an application infinite loop. It was two independent things: (a) a
Vite **dev-mode** on-demand dependency re-optimization + forced full reload the
first time the lazy `/trading` route pulls `recharts`/`d3`/radix (the real
"clicking Trading crashes the site / won't load until restart"), and (b) Chrome
**background/hidden-tab throttling** that made every `setTimeout`/`setInterval`/
CDP-based automated repro mis-measure a perfectly healthy thread as a 45s freeze.

## One-paragraph summary

Opening the inline "Close → Journal" form on a tracked open position in the
Trade Tracker (`/trading`) intermittently **freezes the browser tab** (a
silent, synchronous main-thread peg — no thrown error, no console output, no
React "max update depth"). It is **non-deterministic** and **pre-existing**:
commit `9d5a414` — before ANY of this session's work — froze identically. It is
**not** caused by the exit-reason control, its value prop, the options, Radix
internals, or any session change.

## What was proven (high-confidence)

- Reproduction: seed `tp-open-trades-v1` with ≥1 open trade → `/trading` →
  click "Close → Journal" → tab freezes ~indefinitely (CDP eval times out 45s).
- Bisect: pristine `9d5a414` freezes identically → pre-existing, not our code.
- Single-variable tests in the exit-reason slot: Radix `<Select>` (bound /
  `value=undefined`), native `<select>` (bound / uncontrolled / bare), and
  segmented `<button>` chips ALL froze; a single static `<div>` did NOT — but
  re-testing showed the static `<div>` ALSO froze on a repeat. **Conclusion:
  the freeze is non-deterministic and control-independent** (the earlier
  "select-specific" conclusion was an n=1 false-negative artifact).
- Freeze-surviving instrumentation (console/onerror persisted to localStorage)
  captured NOTHING → not a React render/state loop, not a thrown error → a
  silent synchronous block.
- No `ResizeObserver`/`MutationObserver`/`scrollIntoView`/`focus`/rAF in the
  TradeTracker / Trading / layout tree.
- Empty-state `/trading` (no open trades) rendered reliably many times — the
  freeze requires the open-positions/close-form render path AND is intermittent.

## Ruled out (do not re-try these)

- Exit-reason control type / `value` sentinel / options / Radix Select.
- This session's edits (integrity + close-flow + safe-subset) — all reverted.
- ErrorBoundary / React circuit-breaker as "containment" — cannot catch a
  synchronous main-thread peg (no throw, thread never yields).
- Vite dep-cache as the *sole* cause — clearing `node_modules/.vite` helped the
  separate local "won't load until restart" symptom but did not resolve the
  in-app freeze.

## The only known path to a real fix

A **call stack of the frozen frame**, which requires the JS-engine debugger and
therefore a human at DevTools (automation cannot — page-context eval pegs with
the thread; no CDP Debugger/Profiler available to the tooling here):

1. Dev server running; `localStorage.setItem('tp-open-trades-v1', JSON.stringify([{id:'x',symbol:'AAPL',side:'long',quantity:10,entryPrice:190.5,stopLoss:185,target:205,entryDate:'2026-05-15',planValid:true}]))`; reload `/trading`.
2. DevTools → **Sources** tab.
3. Click "Close → Journal" on the trade → tab freezes.
4. Immediately click **⏸ Pause script execution**.
5. Read the **Call Stack**: top ~8 frames + any `file:line`. That names the
   looping function → fix at source.
   (Backup: Performance tab → Record → click Close → wait 5s → Stop →
   Bottom-Up sorted by Self Time → top frames.)
6. Cleanup: `localStorage.removeItem('tp-open-trades-v1')`.

## Interim user guidance

The freeze only triggers when opening the close form on a tracked open
position. Until root-caused, it can be avoided by not using that specific
action. Everything else in the app is unaffected. Code is pristine and safe;
nothing was pushed; production is untouched.

## Related design/plan docs in this folder (this session, all reverted)
`2026-05-18-tradetracker-integrity-fixes*`, `*-close-flow-quality*`,
`*-close-form-select-freeze*`, `*-exit-reason-chips*`, `*-reapply-safe-subset*`.

---

## Resolution (2026-05-18)

The earlier conclusions in this doc were a **measurement artifact**. Every
automated repro ran in a Chrome **MCP automation tab that is never foregrounded**
→ Chrome clamps `setTimeout`/`setInterval` to ~1 Hz, pauses rAF, and eventually
freezes the background tab. Harnesses built on `setTimeout` delays +
`setInterval` heartbeats + CDP `eval` therefore reported a ~1000 ms/op "freeze"
and 45 s "renderer frozen" **regardless of the code** — which is exactly why it
looked silent, non-deterministic, control-independent, and "bisects identically
to `9d5a414`". Proof: same hidden tab, same 3 s window — a `MessageChannel`
heartbeat ticked **374,178** times while `setInterval(50ms)` ticked **3**; a
10M-iteration loop ran in **35 ms**; **40 close-form open/cancel cycles in 29 ms**
(MessageChannel-driven = throttle-immune); full close→Journal E2E **8 ms**, files
correctly. There is **no app infinite loop**.

The **real-world** symptom ("clicking Trading crashes the site / won't load until
restart") is a **Vite dev-server** behavior: `/trading` is lazy-loaded and the
sole importer of `recharts` (+ `victory-vendor`/`d3-*`) and `@radix-ui/react-select`.
Vite can't see a lazy route's deps at cold start, so the first click on Trading
triggers an on-the-fly re-optimization **and a forced full-page reload**; with
libs this heavy it can stall/loop until `npm run dev` is restarted. Reproduced
deterministically on a cold dev server (cleared `node_modules/.vite`).

### Fixes shipped
1. **`vite.config.ts`** — `optimizeDeps.include` for `recharts`,
   `victory-vendor/d3-shape`, `victory-vendor/d3-scale`, `d3-shape`, `d3-scale`,
   `@tanstack/react-query`, `@radix-ui/react-select`, `lucide-react`. Vite now
   pre-bundles them at startup → **no on-demand re-opt, no forced reload** when
   navigating to `/trading`. Verified on a cold dev server: clicked the in-app
   Trading link → mounted 158 ms, 0 reloads, 0 re-opt. (Dev-only; the production
   Rollup build was never affected — which is why it felt non-deterministic.)
2. **`src/components/layout/MarketTimeline.tsx`** — the global sidebar world
   clock no longer runs its 1 s interval (+~25 timezone conversions + a React
   commit) forever on every page; it **pauses while the tab is hidden** and
   resumes on return. Removes perpetual app-wide main-thread churn.
3. **`src/hooks/useLiveQuotes.ts`** — memoized `queries` + `useCallback`
   `combine` (TanStack-documented contract) so React Query stops reconciling its
   `QueriesObserver` on every render of the Trading page and the Watchlist.

### Methodology lesson
Never measure UI responsiveness with `setTimeout`/`setInterval`/rAF or CDP
`eval` in an unfocused automation tab — they are throttled/frozen by the browser
and will fabricate a "freeze". Use a `MessageChannel` round-trip (exempt from
background throttling) for throttle-immune timing and freeze detection.
