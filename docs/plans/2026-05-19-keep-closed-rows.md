# Keep Closed Rows Visible — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After a full close, the trade's row stays in the Trade Tracker — dimmed, "Closed → Journal", no live price/actions — until dismissed or page reload. Journal data flow unchanged.

**Architecture:** Session-only React state `justClosed` in `TradeTracker`. `confirmClose`'s full-close branch additionally remembers the closed trade; an inline dimmed list renders below the open positions and above "Recently closed". The existing Undo toast also clears the dimmed row. No persistence, no store, no schema, no new pure lib.

**Tech Stack:** React 18 + TS + Vite. No Vitest (no new pure logic — `computePnL`/`computeR` already tested). Verify via `npx tsc --noEmit` + `npm run build` + manual.

**Hard constraints:**
- ONLY `src/components/trading/TradeTracker.tsx`. NEVER touch `src/App.tsx` / `src/pages/TradeJournal.tsx` (user WIP).
- NEVER `git add -A`/`.` — stage only that one file. Commits LOCAL (no push).
- Windows; `git -c core.safecrlf=false commit`.
- Do NOT change: `confirmClose`'s first three lines / their order (`if (!isValidExit(exitPrice)) return;`, `if (submittingRef.current) return;`, `submittingRef.current = true;`), the `cp`/invalid/partial logic, the `addTrade` payload contents, the partial path, `setClosingId(null)`, risk strip, crossing effect, `RowSparkline`, `RowEditor`, `RecentlyClosed`.

---

### Task 1: Session-only "Closed → Journal" rows

**Files:** Modify `src/components/trading/TradeTracker.tsx` only. READ it fully first.

Existing facts to rely on (verify; if materially different, STOP and report):
- Imports already include `computePnL, computeR, type TradeEntry` from `@/hooks/useTradeJournal`, `money` is a module-scope helper, `X` is imported from `lucide-react`, `useState` from react. `<RecentlyClosed trades={journalTrades} />` is rendered as the last child of the Open Positions column.
- The current `confirmClose` is EXACTLY:
```tsx
  function confirmClose(t: OpenTrade) {
    if (!isValidExit(exitPrice)) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    const cp = planClose({ positionQty: t.quantity, closeQty: Number(closeQty) || 0 });
    if (cp.mode === 'invalid') { submittingRef.current = false; return; }
    const partial = cp.mode === 'partial';
    const newId = addTrade({
      symbol: t.symbol, side: t.side, quantity: cp.closeQty,
      entryPrice: t.entryPrice, exitPrice: Number(exitPrice) || 0,
      entryDate: t.entryDate, exitDate, fees: Number(fees) || 0,
      notes: [t.notes, closeNotes, partial ? `partial ${cp.closeQty}/${t.quantity}` : '']
        .filter(Boolean).join(' · '),
      tags: [classifyExit({ side: t.side, entry: t.entryPrice, stop: t.stopLoss, target: t.target, exitPrice: Number(exitPrice) || 0 })],
      stopLoss: t.stopLoss, target: t.target, setup: t.setup,
      exitReason, inPlaybook: !!t.setup,
    });
    if (partial) patchOpen(t.id, { quantity: cp.remainder });
    else removeOpen(t.id);
    setClosingId(null);
    toast.success(
      partial
        ? `${t.symbol} — closed ${cp.closeQty}/${t.quantity}, filed to your Journal`
        : `${t.symbol} closed — filed to your Journal`,
      {
        action: {
          label: 'Undo',
          onClick: () => {
            deleteTrade(newId);
            if (partial) patchOpen(t.id, { quantity: t.quantity });
            else addOpen(t);
          },
        },
        duration: 6000,
      },
    );
    submittingRef.current = false;
  }
```
If the real `confirmClose` differs from the above, STOP and report it; do not guess.

**Step 1 — Add state.** Next to the other close-form `useState` declarations (e.g. near `const [closeQty, setCloseQty] = useState('');`), add:
```tsx
const [justClosed, setJustClosed] = useState<{ entry: TradeEntry; id: string }[]>([]);
```

**Step 2 — Replace the ENTIRE `confirmClose` with EXACTLY** (only differences vs current: payload extracted to `payload` to avoid duplication; `entry` built for display; full-close pushes to `justClosed`; Undo also clears `justClosed`; guards/order/partial path byte-identical):
```tsx
  function confirmClose(t: OpenTrade) {
    if (!isValidExit(exitPrice)) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    const cp = planClose({ positionQty: t.quantity, closeQty: Number(closeQty) || 0 });
    if (cp.mode === 'invalid') { submittingRef.current = false; return; }
    const partial = cp.mode === 'partial';
    const payload = {
      symbol: t.symbol, side: t.side, quantity: cp.closeQty,
      entryPrice: t.entryPrice, exitPrice: Number(exitPrice) || 0,
      entryDate: t.entryDate, exitDate, fees: Number(fees) || 0,
      notes: [t.notes, closeNotes, partial ? `partial ${cp.closeQty}/${t.quantity}` : '']
        .filter(Boolean).join(' · '),
      tags: [classifyExit({ side: t.side, entry: t.entryPrice, stop: t.stopLoss, target: t.target, exitPrice: Number(exitPrice) || 0 })],
      stopLoss: t.stopLoss, target: t.target, setup: t.setup,
      exitReason, inPlaybook: !!t.setup,
    };
    const newId = addTrade(payload);
    if (partial) {
      patchOpen(t.id, { quantity: cp.remainder });
    } else {
      removeOpen(t.id);
      const entry: TradeEntry = { ...payload, id: newId, createdAt: new Date().toISOString() };
      setJustClosed((prev) => [{ entry, id: newId }, ...prev]);
    }
    setClosingId(null);
    toast.success(
      partial
        ? `${t.symbol} — closed ${cp.closeQty}/${t.quantity}, filed to your Journal`
        : `${t.symbol} closed — filed to your Journal`,
      {
        action: {
          label: 'Undo',
          onClick: () => {
            deleteTrade(newId);
            if (partial) patchOpen(t.id, { quantity: t.quantity });
            else addOpen(t);
            setJustClosed((prev) => prev.filter((j) => j.id !== newId));
          },
        },
        duration: 6000,
      },
    );
    submittingRef.current = false;
  }
```

**Step 3 — Render the dimmed rows.** In the Open Positions column, immediately AFTER the open-positions list/empty-state block and immediately BEFORE `<RecentlyClosed trades={journalTrades} />`, insert EXACTLY:
```tsx
{justClosed.length > 0 && (
  <div className="space-y-1.5 opacity-60">
    {justClosed.map(({ entry, id }) => {
      const pnl = computePnL(entry);
      const r = computeR(entry);
      const win = pnl >= 0;
      return (
        <div
          key={id}
          className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-[11px] font-mono-num flex flex-wrap items-center gap-x-2 gap-y-0.5"
        >
          <span className="font-semibold">{entry.symbol}</span>
          <span className="uppercase text-muted-foreground">{entry.side}</span>
          <span className="text-muted-foreground">{entry.quantity}</span>
          <span className="text-muted-foreground">${entry.entryPrice}→${entry.exitPrice}</span>
          <span className={win ? 'text-trading-buy font-semibold' : 'text-trading-sell font-semibold'}>
            {win ? '+' : ''}{money(pnl)}{r != null && ` (${r >= 0 ? '+' : ''}${r.toFixed(2)}R)`}
          </span>
          <span className="text-muted-foreground">Closed → Journal</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setJustClosed((prev) => prev.filter((j) => j.id !== id))}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    })}
  </div>
)}
```
Match surrounding indentation; it must be a sibling of the open list and of `<RecentlyClosed/>`, inside the same Open Positions column container. If that location is ambiguous, STOP and report the surrounding JSX.

**Step 4 — Verify:** `cd /c/Users/PC/Downloads/market-pulse && npx tsc --noEmit && npm run build`. Both pass (tsc 0; build `✓ built`; pre-existing >500 kB chunk + `articles.ts` duplicate-key warnings expected). Fix+rerun until clean.

**Step 5 — Commit (only this file):**
```bash
git add src/components/trading/TradeTracker.tsx
git -c core.safecrlf=false commit -m "feat: keep closed trades visible (dimmed, until dismiss/reload)"
```
Then `git show --stat HEAD` (1 file), `git diff --cached --name-only` (empty), `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx` (still ` M`).

---

### Task 2: Final verification

**Step 1:** `npm test && npx tsc --noEmit && npm run build` — full suite still green (no new tests; nothing should regress), tsc 0, build ok.

**Step 2 — scope diff:** `git diff HEAD~1 HEAD -- src/components/trading/TradeTracker.tsx` shows ONLY: the `justClosed` state line, the `confirmClose` rewrite (payload extraction + full-close `justClosed` push + Undo `setJustClosed` filter — guards/order/partial path unchanged), and the dimmed-rows render block. Confirm the first three `confirmClose` lines and the `cp`/`invalid`/`partial` lines are byte-identical to the "current" snapshot in Task 1.

**Step 3 — clean tree:** `git status --porcelain src/App.tsx src/pages/TradeJournal.tsx` shows only pre-existing ` M`; never staged by us; no `git add -A`.

**Step 4 — manual (optional, dev):** full-close a trade → row stays, dimmed, "Closed → Journal", correct ±P&L/R, no live price/actions; dismiss ✕ removes it; the Undo toast returns it to open AND removes the dimmed duplicate; a partial close still only reduces qty (no dimmed row); reload clears dimmed rows; "Recently closed" still works.

---

## Notes for the implementer
- No new pure lib → no Vitest task; `computePnL`/`computeR` already tested. Expected, not a gap.
- The ONLY semantic changes in `confirmClose`: payload hoisted to a const (DRY, identical object), `setJustClosed` push in the full-close `else`, and `setJustClosed` filter added to the Undo `onClick`. Everything else byte-identical.
- Dimmed rows are an inline `.map` (no hooks inside) — do not extract a hook-bearing component.
- Single file, single feature commit; keep the diff to exactly the 3 changes.
