# Trade Tracker Close-Form Freeze — Investigation Findings (handoff)

**Date:** 2026-05-18
**Status:** OPEN — pre-existing bug, root cause not yet pinned. Code is pristine
(`9d5a414`); nothing from this session is applied or pushed.

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
