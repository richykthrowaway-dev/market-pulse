# Design: Trade Journal Overhaul — Wave 1 (Tier S)
**Date:** 2026-05-13
**Status:** Approved — ready for implementation plan

---

## Overview

The current Journal is a manual-entry log with a P&L calendar, equity curve, and trade table. Wave 1 transforms it into a serious analytics tool with auto-import, R-multiples, behavioral analytics, and goal tracking — without touching the existing storage pattern (dual-write localStorage + IndexedDB).

This document covers **Wave 1 only** (Tier S features). Waves 2–4 are summarized at the end for context.

---

## Decisions Made

| Question | Decision |
|---|---|
| Approach | Phased expansion of existing Journal page (Approach A) |
| Trader profile | Generalist — features are optional, never forced |
| Storage | Dual-write LS + IDB pattern stays; new fields all optional for back-compat |
| Tab count | Grow from 3 → 6 tabs in Wave 1 |
| Auto-import source | Existing IBKR statement parser (already in app) |

---

## Tab Structure

Existing 3 tabs grow to 6:

| Tab | Status | Content |
|---|---|---|
| **Overview** | 🆕 NEW | Hero stats row, drawdown sparkline, streak/tilt badge, goal progress bars, AI insight callouts |
| **Calendar** | enhanced | Existing P&L heatmap **+** mini day-of-week and hour-of-day heatmaps below |
| **Equity Curve** | unchanged | (drawdown overlay deferred to Wave 2) |
| **Analytics** | 🆕 NEW | Per-setup table, per-symbol table, per-mistake breakdown, outlier-loss list |
| **Trades** | enhanced | New columns: R-multiple, setup chip, mistake icons, screenshot indicator |
| **Reviews & Rules** | 🆕 NEW (skeleton only) | Placeholder for Wave 2 checklist/reviews; in Wave 1 holds settings (setups, mistakes, goals, account size) |

**Header above tabs**: replace the bare stats row with a richer "Hero" row — total P&L, win rate, profit factor, expectancy ($/trade), R-multiple expectancy, current streak. Full stats panel moves to Overview.

**New action buttons** (top right, next to "Log Trade"):
- **Import from IBKR** — pulls closed positions from `useStatement()`
- **Settings** — opens the Reviews & Rules tab

---

## Data Model

`TradeEntry` gains optional fields. Existing trades stay valid; new sections render placeholders for missing data.

```ts
interface TradeEntry {
  // EXISTING (unchanged)
  id, symbol, side, quantity, entryPrice, exitPrice,
  entryDate, exitDate, fees, notes, tags, createdAt

  // NEW (Wave 1)
  stopLoss?: number;          // intended stop at entry → drives R-multiple
  target?: number;            // intended target (informational, drives planned R:R)
  entryTime?: string;         // "HH:MM" — drives hour-of-day heatmap
  exitTime?: string;
  setup?: string;             // one of user's playbook tags (free-form, autocomplete from history)
  mistakes?: string[];        // multi-select from user's mistake taxonomy
  exitReason?: ExitReason;    // 'target' | 'stop' | 'time' | 'discretion' | 'panic'
  inPlaybook?: boolean;       // explicit "was this in your plan?" toggle
  screenshot?: string;        // IndexedDB blob ref (single screenshot in Wave 1)
}

type ExitReason = 'target' | 'stop' | 'time' | 'discretion' | 'panic';
```

New top-level entity (single document, dual-written same as trades):

```ts
interface JournalSettings {
  setups: string[];           // user's playbook (default: ["Breakout", "Pullback", "Mean Reversion", "Gap Fill"])
  mistakes: string[];         // user's taxonomy (default: ["FOMO", "Moved stop", "Oversized", "No setup", "Revenge trade"])
  accountSize?: number;       // enables risk-as-% calculations
  goals: {
    daily?: number;           // dollar target
    weekly?: number;
    monthly?: number;
    dailyMaxLoss?: number;    // kill-switch trigger
  };
}
```

**Storage keys**:
- `trade-journal-v1` → trades (existing)
- `trade-journal-settings-v1` → settings (new)
- IDB `screenshots` store → blobs keyed by `${tradeId}` (new)

**Screenshots in IndexedDB**: never base64 in localStorage. Each screenshot stored as Blob keyed by trade ID. Read via `URL.createObjectURL(blob)` in the component.

---

## Feature Specs (Wave 1)

### 1. R-multiples (auto-computed)
- **When `stopLoss` is set**: `initialRisk = |entry - stop| × quantity`. `R = pnl / initialRisk`.
- Display as `+2.4R` or `-1.0R` in trade row and stat tiles.
- **When stop missing**: show `—` instead of a fabricated R.
- New stat tile: **R-expectancy** = mean(R) across all trades with a stop.

### 2. Auto-import from IBKR
- New button **"Import from IBKR"** at top of Journal.
- On click: read `parsedStatement.closedPositions` (or equivalent — verify exact field) from `useStatement()`.
- For each closed position, build a draft `TradeEntry`:
  - `symbol`, `quantity` (absolute), `side` (from `quantity > 0`)
  - `entryPrice`, `exitPrice` from the position's open/close
  - `entryDate`, `exitDate` from the position's dates
  - `fees` from the position's commission column
- Show a **preview dialog** listing detected trades with checkboxes (default all checked). User confirms import.
- **Dedup**: skip any trade where (symbol, entryDate, exitDate, quantity) matches an existing trade.
- Imported trades show an "📥 Imported" tag automatically.
- **No edge function calls needed** — pure client-side, all data already parsed.

### 3. Setups / playbook tags
- New optional `setup` field in TradeFormDialog: combobox with autocomplete from `settings.setups` + user's prior `setup` values.
- Free-form: user can type a new setup name; it's added to `settings.setups` on save.
- **Trades table** gets a "Setup" column showing the setup as a colored chip.
- **Analytics tab → "By Setup" table**: rows = setup name; cols = trade count, win rate, avg R, total P&L, expectancy. Sorted by total P&L descending.

### 4. Mistake tagging + per-mistake P&L
- New `mistakes` field in TradeFormDialog: multi-select chips from `settings.mistakes` + free-form new entries.
- **Trades table** shows mistake icons (small colored dots) next to symbol.
- **Analytics tab → "Cost of Mistakes" table**: rows = mistake; cols = occurrences, total $ lost, avg loss per occurrence. Sorted by total lost.
- Top mistake by cost gets called out on the Overview tab.

### 5. Per-symbol breakdown
- **Analytics tab → "By Symbol" table**: rows = symbol; cols = trade count, win rate, avg R, total P&L, best trade, worst trade.
- Click a row → filters the Trades tab to that symbol.

### 6. Day-of-week + time-of-day heatmaps
- **Calendar tab**: below the monthly P&L heatmap, add two compact heatmaps:
  - **Day-of-week**: 7 cells (Mon–Sun) colored by avg P&L, with trade count.
  - **Hour-of-day**: 24 cells (or 9 if filtering to market hours 09:00–18:00 ET) colored by avg P&L. Requires `entryTime`; trades without entryTime are excluded.
- Hover any cell → tooltip with win rate, trade count, total P&L.

### 7. Goal progress + daily max-loss kill-switch
- **Overview tab**: three goal progress bars — daily, weekly, monthly. Each shows `$current / $target` with a fill bar.
- Bar colors: green if pacing >100% of target, amber 50–100%, grey <50%, red if `dailyMaxLoss` triggered.
- **Kill-switch UI**: when `today's P&L < -0.8 × dailyMaxLoss`, the Overview tab shows an amber banner: *"⚠️ Approaching daily max loss ($X of $Y). Consider stopping."*
- When `today's P&L ≤ -dailyMaxLoss`, the banner turns red: *"🛑 Daily max loss hit. Step away from the screen."*
- This is a **soft block** — Log Trade button is still functional, but a warning toast appears: *"You've hit your daily max loss. Are you sure?"* with `[Cancel]` and `[Log anyway]`.
- All thresholds editable in Settings.

### 8. Position / risk as % of account
- When `settings.accountSize` is set:
  - Trade form shows a live "Risk: $X (Y% of account)" indicator below the stop input.
  - Trade row shows `R$` and `R%` side by side.
  - Analytics tile: **Avg risk per trade** as % of account.
- When `accountSize` not set: just show $ amounts; no % anywhere.

### 9. Paste-from-clipboard screenshots
- **TradeFormDialog**: new "Screenshot" section with a dropzone.
- Supported inputs:
  - **Paste** (Ctrl+V / Cmd+V) — uses `navigator.clipboard.read()` if available, fallback to `paste` event with `ClipboardEvent.clipboardData.items`.
  - **File picker** — `<input type="file" accept="image/*">`.
  - **Drag-and-drop** — drop image file onto dropzone.
- Image is stored as a Blob in IndexedDB `screenshots` store, keyed by trade ID.
- Trade row shows 📷 indicator when screenshot exists. Click → preview lightbox.
- Wave 1 supports **1 screenshot per trade**; Wave 2 expands to gallery.

### 10. "Was this in your playbook?" toggle
- Boolean toggle in TradeFormDialog ("In playbook" / "Off-script").
- Default: `true` (in playbook) — user must explicitly mark off-script.
- **Analytics tab**: small stat — "Off-script trades: X / total, P&L: $Y". This usually reveals that off-script trades lose money.

### 11. Exit rationale dropdown
- New `exitReason` field in TradeFormDialog: select one of `target | stop | time | discretion | panic`.
- **Analytics tab**: pie chart of exit reasons + win rate per reason. "Panic" exits typically have terrible expectancy — surfacing this is valuable.

### 12. AI insight: day-of-week pattern detection
- Computed on Overview tab. Rule:
  - For each weekday, compute win rate and avg R.
  - If `max(winRate) - min(winRate) > 20pp` AND each weekday has ≥5 trades:
    - Show callout: *"💡 You win **{maxWinRate}%** of trades on **{bestDay}s** vs **{minWinRate}%** on **{worstDay}s**. Worst day: **{worstDay}** ({trades} trades, ${pnl} P&L). Consider sitting out {worstDay}s."*
- If pattern not strong enough or sample too small, callout is hidden.

### 13. AI insight: "you lose more after losses"
- Computed on Overview tab. Rule:
  - Partition trades into "after-win" and "after-loss" cohorts (based on prior chronological trade).
  - Compute win rate of each cohort.
  - If `afterLossWinRate < afterWinWinRate - 15pp` AND each cohort has ≥10 trades:
    - Show callout: *"🧠 After a loss, your win rate drops to **{afterLossWinRate}%** (vs **{afterWinWinRate}%** after a win). Consider a 1-trade cooldown after losses."*

### 14. Outlier loss alert
- Computed on Overview tab. Rule:
  - For each loss, compare to median loss size.
  - If `|loss| > 3 × medianLoss`:
    - Add to outlier list: `{date, symbol, $loss, multiplier}`.
- Display top 3 outlier losses with: *"🔥 {date} • {symbol}: ${loss} ({mult}× your median loss)"*.
- Clickable → opens that trade in the edit dialog.

### 15. Trades table enhancements
- New columns (toggleable via column-visibility dropdown):
  - **R** (R-multiple, colored)
  - **Setup** (chip)
  - **Mistakes** (icon row)
  - **📷** (screenshot indicator)
- New filters above the table:
  - Date range picker
  - Setup dropdown
  - Symbol search
  - Side (long/short)
  - "Off-script only" toggle
- All filters persist in URL query string for shareability.

---

## File Structure

```
src/
  pages/
    TradeJournal.tsx                         (existing — major edits)

  hooks/
    useTradeJournal.ts                       (existing — extend types)
    useJournalSettings.ts                    NEW — settings dual-write
    useJournalScreenshots.ts                 NEW — IDB blob CRUD

  components/journal/
    PnLCalendar.tsx                          (existing)
    TradeFormDialog.tsx                      (existing — major edits)
    TradeLogTable.tsx                        (existing — column edits)
    JournalStatsRow.tsx                      (existing — minor edits)
    CumulativePnLChart.tsx                   (existing)
    DayDetailDialog.tsx                      (existing — show R, setup, screenshot)

    OverviewTab.tsx                          NEW
    AnalyticsTab.tsx                         NEW
    RulesTab.tsx                             NEW (Wave 1 = settings only)
    HeroStatsRow.tsx                         NEW
    GoalProgressCard.tsx                     NEW
    KillSwitchBanner.tsx                     NEW
    InsightCard.tsx                          NEW (used by 3 AI insights)
    OutlierLossList.tsx                      NEW

    SetupCombobox.tsx                        NEW (autocomplete for setups)
    MistakeMultiSelect.tsx                   NEW (chip-based multi-select)
    ScreenshotPaster.tsx                     NEW

    DayOfWeekHeatmap.tsx                     NEW
    HourOfDayHeatmap.tsx                     NEW

    BySetupTable.tsx                         NEW
    BySymbolTable.tsx                        NEW
    ByMistakeTable.tsx                       NEW
    ByExitReasonChart.tsx                    NEW

    IbkrImportDialog.tsx                     NEW
```

---

## Out of Scope (Wave 1)

Deferred to later waves (not built in Wave 1, even if tempting):
- Pre-trade checklist + compliance score → **Wave 2**
- Multi-screenshot gallery → **Wave 2**
- Live floating P&L for open trades → **Wave 2** (needs "open" state)
- Mini-chart per trade → **Wave 2**
- Drawdown chart → **Wave 2**
- Hypothesis / what-went-well/poorly review prompts → **Wave 2**
- SPY benchmark comparison → **Wave 2**
- Daily journal entries (separate from trades) → **Wave 2**
- MAE/MFE → **Wave 2** (manual entry, edge ratio depends on it)
- Psychology fields (mood, confidence, sleep, FOMO) → **Wave 2**
- Trade templates → **Wave 2**
- Auto-fetch market context (VIX/SPY/ATR) → **Wave 3**
- Quick-log NLP parsing → **Wave 3**
- Calmar/Sortino/Recovery/SQN → **Wave 3**
- P&L attribution decomposition → **Wave 3**
- Options support → **Wave 4 (separate project)**
- Stop adjustment history → **Wave 4**
- Voice memos, badges, gamification → **never (Tier C, not worth it)**

---

## Phasing Summary

| Wave | Theme | Estimated effort |
|---|---|---|
| **1** | Foundations: data model, IBKR import, R-multiples, setups, mistakes, heatmaps, AI insights, goals + kill-switch, screenshots, exit reason | ~5–8 dev days |
| **2** | Review tooling: checklists, hypothesis tracking, MAE/MFE, mini-charts, drawdown, screenshots gallery, psychology, live P&L for open trades | ~5–7 dev days |
| **3** | Polish & advanced analytics: market-context auto-fetch, quick-log NLP, advanced ratios, P&L attribution, weekly digests | ~4–6 dev days |
| **4** | Specialty: options support (own data model), stop-adjustment history | ~10+ dev days (separate project) |

---

## Backward Compatibility

- All new `TradeEntry` fields are optional. Existing trades load unchanged.
- `JournalSettings` is created fresh on first load with sensible defaults if no existing document.
- Trade form preserves prior behavior when new fields are left blank — saving a "minimal" trade (just symbol, side, qty, prices, dates) still works.
- IBKR import is opt-in; users who never click the button see no change.

---

## Testing Notes

- **R-multiple math**: verify with a few hand-computed cases (long win, long loss, short win, short loss, no stop).
- **IBKR dedup**: import the same statement twice; second time should detect 0 new trades.
- **Day-of-week heatmap**: seed test trades on each weekday and verify cell values.
- **Kill-switch**: set `dailyMaxLoss = $500`, log a $-450 trade → amber banner; log another $-100 trade → red banner.
- **Screenshot storage**: paste an image, refresh page, verify image still renders. Delete the trade → verify IDB blob also removed.
- **Insight thresholds**: seed trades that should and shouldn't trigger each insight; verify gating logic.
