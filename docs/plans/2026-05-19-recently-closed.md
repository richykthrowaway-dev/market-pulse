# Recently-Closed Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only, collapsible "Recently closed (N)" section to the Trade Tracker showing the 5 most recent Journal trades, below the open positions.

**Architecture:** A module-scope presentational `RecentlyClosed` component in `TradeTracker.tsx` that takes `trades: TradeEntry[]` and reuses existing `computePnL`/`computeR`/`money`. `TradeTracker` already calls `useTradeJournal()`; we additionally destructure its `trades` (already sorted newest-first, already self-healed by `parseJournal`). No new store, no schema change, no new pure lib.

**Tech Stack:** React 18 + TS + Vite. No Vitest work (no new pure logic — `computePnL`/`computeR` already unit-tested). Verify via `npx tsc --noEmit` + `npm run build` + manual.

**Hard constraints:**
- NEVER modify/stage `src/App.tsx` or `src/pages/TradeJournal.tsx` (user WIP).
- NEVER `git add -A`/`.` — stage only `src/components/trading/TradeTracker.tsx`.
- Commits LOCAL — never `git push`.
- Windows; `git -c core.safecrlf=false commit` (CRLF warnings cosmetic).
- Touch ONLY `src/components/trading/TradeTracker.tsx`. Do NOT alter
  `confirmClose`, its `isValidExit`/`submittingRef` guards, Undo,
  partial-close, risk strip, crossing effect, sparkline, or RowEditor.

---

### Task 1: Add the Recently-closed section

**Files:** Modify `src/components/trading/TradeTracker.tsx` only. READ it fully first.

**Step 1 — Imports.** The file currently imports:
`import { useTradeJournal, type TradeSide, type ExitReason, pendingJournalNotice } from '@/hooks/useTradeJournal';`
Change that single line to also bring `computePnL`, `computeR`, and the `TradeEntry` type (all are exported from `@/hooks/useTradeJournal` — `computePnL`/`computeR` are re-exported from `@/lib/tradeMath`, `TradeEntry` is an interface there):
```tsx
import { useTradeJournal, computePnL, computeR, type TradeSide, type ExitReason, type TradeEntry, pendingJournalNotice } from '@/hooks/useTradeJournal';
```
(Do not add a second import line; just extend the existing one. `useState` is already imported from react; `money` is an existing module-scope helper in this file.)

**Step 2 — Destructure `trades` from the existing `useTradeJournal()` call.** The component body currently has:
`const { addTrade, deleteTrade } = useTradeJournal();`
Change to (alias to avoid colliding with `useOpenTrades`'s `trades: open`):
```tsx
const { addTrade, deleteTrade, trades: journalTrades } = useTradeJournal();
```
Do NOT add a second `useTradeJournal()` call.

**Step 3 — Add the module-scope component** ABOVE `export function TradeTracker()` (next to `RowSparkline`/`RowEditor`), EXACTLY:
```tsx
function RecentlyClosed({ trades }: { trades: TradeEntry[] }) {
  const [show, setShow] = useState(false);
  if (trades.length === 0) return null;
  const recent = trades.slice(0, 5);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Recently closed ({trades.length})</span>
        <span aria-hidden="true">{show ? '▾' : '▸'}</span>
      </button>
      {show && (
        <div className="mt-2 space-y-1.5">
          {recent.map((t) => {
            const pnl = computePnL(t);
            const r = computeR(t);
            const tag = t.tags?.[0] ?? t.exitReason ?? null;
            const win = pnl >= 0;
            return (
              <div
                key={t.id}
                className="rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-[11px] font-mono-num flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span className="font-semibold">{t.symbol}</span>
                <span className="uppercase text-muted-foreground">{t.side}</span>
                <span className="text-muted-foreground">{t.quantity}</span>
                <span className="text-muted-foreground">${t.entryPrice}→${t.exitPrice}</span>
                <span className={win ? 'text-trading-buy font-semibold' : 'text-trading-sell font-semibold'}>
                  {win ? '+' : ''}{money(pnl)}{r != null && ` (${r >= 0 ? '+' : ''}${r.toFixed(2)}R)`}
                </span>
                {tag && <span className="text-muted-foreground capitalize">{tag}</span>}
                <span className="ml-auto text-muted-foreground/70">{t.exitDate}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 4 — Render it** as the LAST block inside the right-hand "Open positions" column (the same column that contains the open-positions list, the open-risk strip, and the `open.map(...)`). Place `<RecentlyClosed trades={journalTrades} />` immediately AFTER the open-positions list/empty-state block closes and BEFORE that column's wrapping `</div>`. Match surrounding indentation. It must be a sibling of the open list, still within the Open Positions column container. If the exact closing point is ambiguous, STOP and report the surrounding JSX rather than guessing.

**Step 5 — Verify:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit && npm run build`. Both must pass: tsc exit 0; build ends `✓ built` (pre-existing >500 kB chunk + `articles.ts` duplicate-key warnings are EXPECTED, not failures). Fix and re-run until clean.

**Step 6 — Commit (only this file):**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: recently-closed section in Trade Tracker (last 5, collapsible)"
```
Then `git show --stat HEAD` (1 file), `git diff --cached --name-only` (empty), `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx` (still ` M`, untouched).

---

### Task 2: Final verification

**Step 1:** `npm test && npx tsc --noEmit && npm run build` — full suite still green (no new tests expected; nothing should regress), tsc 0, build ok.

**Step 2 — confirm scope:** `git diff HEAD~1 HEAD -- src/components/trading/TradeTracker.tsx` shows ONLY: the extended import line, the `trades: journalTrades` destructure, the `RecentlyClosed` component, and the single `<RecentlyClosed .../>` render line. `git grep -n "confirmClose" src/components/trading/TradeTracker.tsx` — the guards (`if (!isValidExit(exitPrice)) return;`, `if (submittingRef.current) return;`, `submittingRef.current = true;`) unchanged.

**Step 3 — clean tree:** `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx` shows only pre-existing ` M` user WIP; never staged by us; no `git add -A` used.

**Step 4 — manual (optional, dev):** with ≥1 Journal trade, the Trade Tracker shows "Recently closed (N)" below open positions; clicking toggles the list; up to 5 rows show symbol/side/qty/entry→exit/±P&L (green/red)/±R (omitted if no stop)/tag/date; section is hidden when the Journal is empty.

---

## Notes for the implementer
- No new pure lib → no Vitest task; `computePnL`/`computeR` are already tested. This is expected, not a coverage gap.
- `RecentlyClosed` is module-scope specifically so its `useState` obeys the rules of hooks (not declared inside `.map`).
- Reuse the existing module-scope `money(n)` helper and `computePnL`/`computeR` — do NOT reimplement P&L/R math.
- Single file, single feature commit. Keep the diff to exactly the 4 changes in Task 1.
