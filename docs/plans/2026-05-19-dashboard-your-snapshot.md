# Dashboard "Your Snapshot" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a personalized "Your Snapshot" strip + US market-session pill to the top of the Dashboard, composed from already-shipped tested hooks/libs and wrapped in the existing ErrorBoundary.

**Architecture:** Two new *pure* libs (`journalWindows`, `marketSession`) built TDD in the `src/lib/**` Vitest node harness, plus a presentational `YourSnapshot` component that wires existing hooks (`useOpenTrades`, `useLiveQuotes`, `useLiveSpeed`, `useTradeJournal`) and shipped libs (`unrealizedPnl`, `aggregateRisk`, `computePnL`). `Dashboard.tsx` renders it first inside `dashboardContent`, wrapped in `<ErrorBoundary>`.

**Tech Stack:** React 18 + TS + Vite; Vitest (`environment: node`, `src/lib/**/*.test.ts`); react-router `Link`.

**Hard constraints (every task):**
- NEVER modify/stage `src/App.tsx`, `src/components/layout/MobileShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/TradeJournal.tsx` (user WIP).
- NEVER `git add -A`/`.` — stage only the exact files named per task. Commits LOCAL (no push).
- No dev server needed. Verify via `npx vitest run <file>`, `npm test`, `npx tsc --noEmit`, `npm run build` (pre-existing >500 kB chunk + `articles.ts` warnings are expected, not failures).
- Windows; `git -c core.safecrlf=false commit`.

---

### Task 1: `journalWindows` pure lib (TDD)

**Files:** Create `src/lib/journalWindows.ts`, `src/lib/journalWindows.test.ts`.

**Step 1 — failing test** `src/lib/journalWindows.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pnlOn, realizedPnL } from './journalWindows';
import type { TradeEntry } from '@/hooks/useTradeJournal';

const t = (o: Partial<TradeEntry>): TradeEntry => ({
  id: 'x', symbol: 'X', side: 'long', quantity: 10, entryPrice: 100, exitPrice: 110,
  entryDate: '2026-05-10', exitDate: '2026-05-10', fees: 0, notes: '', tags: [],
  createdAt: '2026-05-10T00:00:00Z', ...o,
});

describe('journalWindows', () => {
  it('pnlOn sums only trades exited on the given date', () => {
    const trades = [
      t({ exitDate: '2026-05-18', exitPrice: 110 }),          // +100
      t({ exitDate: '2026-05-18', side: 'short', exitPrice: 90 }), // +100
      t({ exitDate: '2026-05-17', exitPrice: 200 }),          // excluded
    ];
    expect(pnlOn(trades, '2026-05-18')).toBe(200);
    expect(pnlOn(trades, '2026-05-19')).toBe(0);
  });
  it('realizedPnL sums trades with exitDate >= sinceISO', () => {
    const trades = [
      t({ exitDate: '2026-05-18', exitPrice: 110 }), // +100
      t({ exitDate: '2026-05-12', exitPrice: 110 }), // excluded (before since)
      t({ exitDate: '2026-05-15', exitPrice: 105 }), // +50
    ];
    expect(realizedPnL(trades, '2026-05-14')).toBe(150);
  });
  it('null/empty/garbage safe', () => {
    expect(pnlOn([], '2026-05-18')).toBe(0);
    // @ts-expect-error intentional
    expect(realizedPnL(null, '2026-05-18')).toBe(0);
  });
});
```
(Expected P&L: long 10×(110−100)=100; short 10×(100−90)=100; 10×(105−100)=50. Adjust only if `computePnL`'s fee/sign convention differs — run the test and trust its math; if a number differs, fix the *expected* values to match `computePnL`'s real output, do not change `computePnL`.)

**Step 2 — run, expect FAIL:** `npx vitest run src/lib/journalWindows.test.ts` (module missing).

**Step 3 — implement** `src/lib/journalWindows.ts`:
```ts
import type { TradeEntry } from '@/hooks/useTradeJournal';
import { computePnL } from '@/lib/tradeMath';

/** Σ realized P&L of trades whose exitDate is exactly `dateISO` (YYYY-MM-DD). */
export function pnlOn(trades: TradeEntry[], dateISO: string): number {
  if (!Array.isArray(trades)) return 0;
  let sum = 0;
  for (const t of trades) {
    if (t && typeof t.exitDate === 'string' && t.exitDate === dateISO) sum += computePnL(t);
  }
  return sum;
}

/** Σ realized P&L of trades with exitDate >= sinceISO (lexical YYYY-MM-DD compare). */
export function realizedPnL(trades: TradeEntry[], sinceISO: string): number {
  if (!Array.isArray(trades)) return 0;
  let sum = 0;
  for (const t of trades) {
    if (t && typeof t.exitDate === 'string' && t.exitDate >= sinceISO) sum += computePnL(t);
  }
  return sum;
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/journalWindows.test.ts && npx tsc --noEmit` (if any expected number was off vs `computePnL`, correct the test's expected values — never `computePnL` — and re-run).

**Step 5 — commit:**
```bash
git add src/lib/journalWindows.ts src/lib/journalWindows.test.ts
git -c core.safecrlf=false commit -m "feat: journalWindows pure lib (pnlOn / realizedPnL)"
```

---

### Task 2: `marketSession` pure lib (TDD)

**Files:** Create `src/lib/marketSession.ts`, `src/lib/marketSession.test.ts`.

**Step 1 — failing test** `src/lib/marketSession.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { usMarketSession } from './marketSession';

// May 2026 → US Eastern is EDT (UTC-4).
describe('usMarketSession', () => {
  it('open during regular hours (Mon 09:30 ET = 13:30Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T13:30:00Z'));
    expect(s.open).toBe(true);
    expect(s.label).toMatch(/closes in/i);
    expect(s.minsToChange).toBe(390); // 16:00−09:30 = 390m
  });
  it('closed pre-open same weekday (Mon 08:00 ET = 12:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T12:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens today/i);
    expect(s.minsToChange).toBe(90); // 09:30−08:00
  });
  it('closed after close → tomorrow (Mon 17:00 ET = 21:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T21:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens tomorrow/i);
  });
  it('weekend → opens Mon (Sat 14:00 ET = 18:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-16T18:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens Mon/i);
  });
});
```

**Step 2 — run, expect FAIL.**

**Step 3 — implement** `src/lib/marketSession.ts`:
```ts
export interface USMarketSession {
  open: boolean;
  label: string;
  minsToChange: number;
}

const OPEN = 9 * 60 + 30;   // 570
const CLOSE = 16 * 60;      // 960
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function etParts(now: Date): { dayIdx: number; mins: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hh = parseInt(get('hour'), 10);
  if (hh === 24) hh = 0; // some engines emit '24' at midnight
  const mm = parseInt(get('minute'), 10);
  const dayIdx = DAY.indexOf(get('weekday'));
  return { dayIdx, mins: hh * 60 + mm };
}

const fmt = (m: number) => {
  const h = Math.floor(m / 60), x = m % 60;
  return h > 0 ? `${h}h ${x}m` : `${x}m`;
};

/** US regular session (NYSE 09:30–16:00 ET, Mon–Fri). Weekend-aware. Pure. */
export function usMarketSession(now: Date): USMarketSession {
  const { dayIdx, mins } = etParts(now);
  const weekday = dayIdx >= 1 && dayIdx <= 5;

  if (weekday && mins >= OPEN && mins < CLOSE) {
    return { open: true, label: `closes in ${fmt(CLOSE - mins)}`, minsToChange: CLOSE - mins };
  }

  let addDays: number;
  let minsToChange: number;
  if (weekday && mins < OPEN) {
    addDays = 0;
    minsToChange = OPEN - mins;
  } else {
    let d = 1;
    while (((dayIdx + d) % 7) === 0 || ((dayIdx + d) % 7) === 6) d++; // skip Sat/Sun
    addDays = d;
    minsToChange = (1440 - mins) + (addDays - 1) * 1440 + OPEN;
  }
  const when = addDays === 0 ? 'today' : addDays === 1 ? 'tomorrow' : DAY[(dayIdx + addDays) % 7];
  return { open: false, label: `opens ${when} 9:30 ET`, minsToChange };
}
```

**Step 4 — run, expect PASS:** `npx vitest run src/lib/marketSession.test.ts && npm test && npx tsc --noEmit` (full suite stays green). If a `minsToChange`/label assertion is off only due to a DST/edge nuance, fix the *test expectation* to the correct real value; keep logic faithful to NYSE 09:30–16:00 ET.

**Step 5 — commit:**
```bash
git add src/lib/marketSession.ts src/lib/marketSession.test.ts
git -c core.safecrlf=false commit -m "feat: marketSession pure lib (US NYSE session)"
```

---

### Task 3: `YourSnapshot` component + Dashboard wiring

**Files:** Create `src/components/dashboard/YourSnapshot.tsx`; Modify `src/components/layout/Dashboard.tsx`.

**Step 1 — Create `src/components/dashboard/YourSnapshot.tsx`:**
```tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOpenTrades } from '@/hooks/useOpenTrades';
import { useLiveQuotes } from '@/hooks/useLiveQuotes';
import { useLiveSpeed } from '@/hooks/useLiveSpeed';
import { useTradeJournal } from '@/hooks/useTradeJournal';
import { unrealizedPnl } from '@/lib/tradeMetrics';
import { aggregateRisk } from '@/lib/portfolioRisk';
import { pnlOn, realizedPnL } from '@/lib/journalWindows';
import { usMarketSession } from '@/lib/marketSession';

const money = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function readAccount(): number | undefined {
  try {
    const r = localStorage.getItem('tp-risk-v1');
    if (!r) return undefined;
    const p = JSON.parse(r);
    return typeof p?.account === 'number' ? p.account : undefined;
  } catch { return undefined; }
}

function Tile({ label, value, sub, tone, to }: {
  label: string; value: string; sub?: string;
  tone?: 'pos' | 'neg' | 'warn'; to?: string;
}) {
  const color = tone === 'pos' ? 'text-trading-buy' : tone === 'neg' ? 'text-trading-sell'
    : tone === 'warn' ? 'text-warning' : 'text-foreground';
  const inner = (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold font-mono-num ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

export function YourSnapshot() {
  const { trades: open } = useOpenTrades();
  const { intervalMs } = useLiveSpeed();
  const openSymbols = useMemo(
    () => Array.from(new Set(open.map((t) => t.symbol).filter(Boolean))),
    [open],
  );
  const quotes = useLiveQuotes(openSymbols, intervalMs);
  const { trades: journal, stats, currentStreak } = useTradeJournal();

  const account = readAccount();
  const openPnl = useMemo(() => open.reduce((s, t) => {
    const q = quotes[t.symbol.trim().toUpperCase()];
    if (q?.price == null) return s;
    return s + unrealizedPnl(t.side, t.entryPrice, q.price, t.quantity).dollars;
  }, 0), [open, quotes]);
  const risk = useMemo(() => aggregateRisk(open, account), [open, account]);

  const today = isoDaysAgo(0);
  const todayPnl = useMemo(() => pnlOn(journal, today), [journal, today]);
  const weekPnl = useMemo(() => realizedPnL(journal, isoDaysAgo(7)), [journal]);

  const session = usMarketSession(new Date());
  const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : undefined) as 'pos' | 'neg' | undefined;
  const streakTxt = currentStreak.kind === 'none' ? '—'
    : `${currentStreak.kind === 'win' ? '🔥' : '🧊'} ${currentStreak.length}${currentStreak.kind === 'win' ? 'W' : 'L'}`;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your snapshot</p>
        <span className={`text-[11px] font-mono-num rounded-full border px-2 py-0.5 ${
          session.open ? 'border-trading-buy/40 text-trading-buy' : 'border-border/60 text-muted-foreground'
        }`}>
          {session.open ? '🟢 US open' : '🔴 US closed'} · {session.label}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Open P&L"
          value={open.length ? money(openPnl) : '—'}
          sub={open.length ? `${open.length} open position${open.length === 1 ? '' : 's'}` : 'No open positions'}
          tone={open.length ? tone(openPnl) : undefined}
          to="/trading"
        />
        <Tile
          label="Open risk"
          value={open.length ? money(risk.totalRisk) : '—'}
          sub={risk.pct != null ? `${risk.pct.toFixed(2)}% of account` : (open.length ? 'set account in plan' : '—')}
          to="/trading"
        />
        <Tile
          label="Today realized"
          value={journal.length ? money(todayPnl) : '—'}
          sub={journal.length ? `Win rate ${(stats.winRate * 100).toFixed(0)}%` : 'No trades logged'}
          tone={journal.length ? tone(todayPnl) : undefined}
          to="/journal"
        />
        <Tile
          label="This week"
          value={journal.length ? money(weekPnl) : '—'}
          sub={journal.length ? `Streak ${streakTxt}` : 'Log your first trade'}
          tone={journal.length ? tone(weekPnl) : undefined}
          to="/journal"
        />
      </div>
    </div>
  );
}
```
Notes: only known-safe fields used; reuses shipped tested libs; no new network beyond the live-quote polling already used on Trading. If `currentStreak.kind`'s union differs in the real `useTradeJournal` type, adjust the `streakTxt` check to match (do not change the hook).

**Step 2 — Wire into `src/components/layout/Dashboard.tsx`.** Read it first. Add imports near the other component imports:
```tsx
import { YourSnapshot } from '@/components/dashboard/YourSnapshot';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
```
Then make `<ErrorBoundary name="YourSnapshot"><YourSnapshot /></ErrorBoundary>` the **first child** of the `dashboardContent` fragment — immediately after `const dashboardContent = (` / `<>` and BEFORE `<h1 ...>Market Dashboard</h1>`. Change nothing else in Dashboard.tsx.

**Step 3 — Verify:** `npx tsc --noEmit && npm run build` — both clean.

**Step 4 — Commit:**
```bash
git add src/components/dashboard/YourSnapshot.tsx src/components/layout/Dashboard.tsx
git -c core.safecrlf=false commit -m "feat: Your Snapshot strip + market-session pill on Dashboard"
```

---

### Task 4: Final verification

**Step 1:** `npm test && npx tsc --noEmit && npm run build` — full suite green (includes the 2 new lib test files), tsc 0, build ok.

**Step 2 — scope:** `git diff --stat HEAD~4 HEAD` shows ONLY: `journalWindows.ts(+test)`, `marketSession.ts(+test)`, `YourSnapshot.tsx`, `Dashboard.tsx`. Confirm `git status --porcelain src/App.tsx src/components/layout/MobileShell.tsx src/components/layout/Sidebar.tsx src/pages/TradeJournal.tsx` shows them only as pre-existing ` M` user WIP, never staged by us; no `git add -A` used.

**Step 3 — static sanity:** confirm `YourSnapshot` is the first child of `dashboardContent` and is wrapped in `<ErrorBoundary>`; confirm no import of the WIP files was added.

---

## Notes for the implementer
- The two libs are the only unit-tested pieces (node Vitest, `src/lib/**`). `YourSnapshot`/Dashboard wiring is verified by `tsc`+`build`+static review — expected, not a gap. No server required.
- Reuse `computePnL`/`unrealizedPnl`/`aggregateRisk` — do NOT reimplement P&L/risk math.
- If a TDD expected number conflicts with `computePnL`/session reality, fix the **test expectation**, never the shipped function.
- Keep `Dashboard.tsx` changes to exactly the 2 imports + the one wrapped render line.
