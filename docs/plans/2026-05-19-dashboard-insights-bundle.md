# Dashboard Insights Bundle (6 features) — Implementation Plan

> **For Claude:** TDD pure libs first; thin Dashboard wiring; each widget its own ErrorBoundary.

**Goal:** Six production-ready dashboard widgets (earnings, heatmap, sector exposure, price alerts, 52-week range, news mood).

**Hard constraints (every task):**
- Explicit path `C:\Users\PC\Downloads\market-pulse` for EVERY tool (shell defaults to a different repo).
- Create only the 6 `src/lib/*.ts`(+`.test.ts`); edit only `src/components/layout/Dashboard.tsx` and `supabase/functions/api-finnhub/index.ts`. NEVER touch/stage `src/App.tsx`, `MobileShell.tsx`, `Sidebar.tsx`, `src/pages/TradeJournal.tsx`.
- Never `git add -A`. `git -c core.safecrlf=false commit`. Commits LOCAL; push + edge deploy only on explicit user go.
- Verify: `npx vitest run`, `npx tsc --noEmit`, `npm run build` (pre-existing chunk + articles warnings expected). No dev server.
- Preserve EXACTLY all shipped wrappers: `ready` gate, every `ErrorBoundary name=`, `DeferUntilVisible`, `?sym=`+localStorage selection, watchlist add/remove + movers callout, movers→`/watchlists` CTA.

Existing facts: `getStaticSector(ticker): string|null` in `src/lib/sectorMap.ts`; `SECTOR_COLORS: Record<string,'H S% L%'>` in `src/lib/gicsColors.ts`; `use52Week(tickers)` → `{ranges:Record<sym,{price,low52,high52}>}` (deployed `api-52week`); `useEarningsCalendar(holdings:{ticker}[])` → `EarningsEvent[]` (already calls `api-finnhub?endpoint=calendar-earnings`); stocks rows `{symbol,name,price,changePercent}`; news items `{title,summary,...}`.

---

### Task 1 — `weekRangePosition` lib (TDD)
**Files:** create `src/lib/weekRangePosition.ts` + `.test.ts`.
Tests: valid → fraction; price below low → 0; above high → 1; high<=low → null; non-finite → null.
```ts
export function weekRangePosition(low: number, high: number, price: number): number | null {
  if (![low, high, price].every((n) => Number.isFinite(n))) return null;
  if (high <= low) return null;
  const f = (price - low) / (high - low);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}
```
Commit: `feat: weekRangePosition pure lib`.

### Task 2 — `headlineSentiment` + `newsMood` lib (TDD)
**Files:** create `src/lib/headlineSentiment.ts` + `.test.ts`.
Tests: bull words → 'bull'; bear words → 'bear'; neither → 'neutral'; case-insensitive; `newsMood` tallies + `net`; non-array safe → all zero/'neutral'.
```ts
export type Sentiment = 'bull' | 'bear' | 'neutral';
const BULL = ['surge','rally','beat','jumps','soars','record high','upgrade','gains','rises','tops','strong','outperform','bullish'];
const BEAR = ['plunge','slump','miss','falls','drops','sinks','downgrade','cuts','warns','weak','recession','bearish','selloff','tumble'];
export function headlineSentiment(text: string): Sentiment {
  const t = String(text ?? '').toLowerCase();
  let s = 0;
  for (const w of BULL) if (t.includes(w)) s++;
  for (const w of BEAR) if (t.includes(w)) s--;
  return s > 0 ? 'bull' : s < 0 ? 'bear' : 'neutral';
}
export function newsMood(items: { title?: string; summary?: string }[]): { bull: number; bear: number; neutral: number; net: number } {
  const arr = Array.isArray(items) ? items : [];
  let bull = 0, bear = 0, neutral = 0;
  for (const it of arr) {
    const s = headlineSentiment(`${it?.title ?? ''} ${it?.summary ?? ''}`);
    if (s === 'bull') bull++; else if (s === 'bear') bear++; else neutral++;
  }
  return { bull, bear, neutral, net: bull - bear };
}
```
Commit: `feat: headlineSentiment + newsMood pure lib`.

### Task 3 — `watchlistHeatmap` lib (TDD)
**Files:** create `src/lib/watchlistHeatmap.ts` + `.test.ts`.
Resolve symbols case-insensitively against stocks; cell `{symbol,name,changePercent,intensity}`; intensity = `min(4, floor(abs(%)/2))` (0..4); sorted by changePercent desc; `[]` if none / non-array.
```ts
export interface HeatCell { symbol: string; name: string; changePercent: number; intensity: number; }
export function watchlistHeatmap(
  stocks: { symbol: string; name?: string; changePercent?: number }[],
  symbols: string[],
): HeatCell[] {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(symbols) ? symbols : [];
  const want = new Set(wl.filter((s) => typeof s === 'string').map((s) => s.trim().toUpperCase()));
  const cells: HeatCell[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (!s || typeof s.symbol !== 'string') continue;
    const k = s.symbol.trim().toUpperCase();
    if (!want.has(k) || seen.has(k)) continue;
    seen.add(k);
    const cp = Number(s.changePercent) || 0;
    cells.push({ symbol: s.symbol, name: String(s.name ?? s.symbol), changePercent: cp, intensity: Math.min(4, Math.floor(Math.abs(cp) / 2)) });
  }
  return cells.sort((a, b) => b.changePercent - a.changePercent);
}
```
Commit: `feat: watchlistHeatmap pure lib`.

### Task 4 — `sectorExposure` lib (TDD)
**Files:** create `src/lib/sectorExposure.ts` + `.test.ts`.
Resolve symbols against stocks; sector via injected resolver (default `getStaticSector`), miss → 'Unknown'; return `{sector,count,pct}[]` desc by pct (pct = count/total*100, rounded 1dp); `[]` if none/non-array.
```ts
import { getStaticSector } from './sectorMap';
export interface SectorSlice { sector: string; count: number; pct: number; }
export function sectorExposure(
  stocks: { symbol: string }[],
  symbols: string[],
  resolver: (sym: string) => string | null = getStaticSector,
): SectorSlice[] {
  const all = Array.isArray(stocks) ? stocks : [];
  const wl = Array.isArray(symbols) ? symbols : [];
  const want = new Set(wl.filter((s) => typeof s === 'string').map((s) => s.trim().toUpperCase()));
  const present: string[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (!s || typeof s.symbol !== 'string') continue;
    const k = s.symbol.trim().toUpperCase();
    if (!want.has(k) || seen.has(k)) continue;
    seen.add(k); present.push(s.symbol);
  }
  if (present.length === 0) return [];
  const counts = new Map<string, number>();
  for (const sym of present) {
    const sec = resolver(sym) || 'Unknown';
    counts.set(sec, (counts.get(sec) ?? 0) + 1);
  }
  const total = present.length;
  return [...counts.entries()]
    .map(([sector, count]) => ({ sector, count, pct: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct);
}
```
Commit: `feat: sectorExposure pure lib`.

### Task 5 — `priceAlerts` lib (TDD)
**Files:** create `src/lib/priceAlerts.ts` + `.test.ts`.
Types + pure `parseAlerts(raw)` (self-healing: bad JSON/shape → `[]`), `evaluateAlerts(alerts, priceBySym)` → triggered (above: price>=target; below: price<=target; skip if no price). `STORAGE_KEY='dash-price-alerts-v1'`.
```ts
export interface PriceAlert { id: string; symbol: string; target: number; dir: 'above' | 'below'; }
export const STORAGE_KEY = 'dash-price-alerts-v1';
export function parseAlerts(raw: string | null): PriceAlert[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (a): a is PriceAlert =>
        !!a && typeof a.id === 'string' && typeof a.symbol === 'string' &&
        typeof a.target === 'number' && Number.isFinite(a.target) &&
        (a.dir === 'above' || a.dir === 'below'),
    );
  } catch { return []; }
}
export function evaluateAlerts(alerts: PriceAlert[], priceBySym: Record<string, number>): PriceAlert[] {
  const list = Array.isArray(alerts) ? alerts : [];
  return list.filter((a) => {
    const p = priceBySym?.[a.symbol.toUpperCase()];
    if (typeof p !== 'number' || !Number.isFinite(p)) return false;
    return a.dir === 'above' ? p >= a.target : p <= a.target;
  });
}
```
Commit: `feat: priceAlerts pure lib`.

### Task 6 — `earningsWindow` lib (TDD)
**Files:** create `src/lib/earningsWindow.ts` + `.test.ts`.
Input: `EarningsEvent`-like `{ticker,earningsDate:Date|null,daysUntil:number|null}[]`. Return next ≤7-day events `{ticker,label}` sorted by daysUntil asc, max 5; label = `Today`/`Tomorrow`/`in Nd`. `[]` if none/non-array.
```ts
export interface EarningsLite { ticker: string; daysUntil: number | null; }
export function earningsWindow<T extends EarningsLite>(events: T[], horizon = 7, max = 5): { ticker: string; label: string }[] {
  const arr = Array.isArray(events) ? events : [];
  return arr
    .filter((e) => e && typeof e.daysUntil === 'number' && e.daysUntil >= 0 && e.daysUntil <= horizon)
    .sort((a, b) => (a.daysUntil as number) - (b.daysUntil as number))
    .slice(0, max)
    .map((e) => {
      const d = e.daysUntil as number;
      const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d}d`;
      return { ticker: e.ticker, label };
    });
}
```
Commit: `feat: earningsWindow pure lib`.

### Task 7 — `api-finnhub`: add `calendar-earnings` endpoint
**Files:** edit `supabase/functions/api-finnhub/index.ts` only.
Add a branch in the endpoint switch: when `endpoint === 'calendar-earnings'`, build `finnhubUrl = ${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}&token=${apiKey}` reading `from`/`to` from `url.searchParams` (default `from`=today, `to`=+90d); pass response through with `corsHeaders` exactly like the other endpoints; no sector write-through. Read-only. Do NOT alter quote/profile2/search branches.
Verify: file compiles conceptually (no local Deno run); `npx tsc --noEmit` (app) unaffected. Commit: `feat: api-finnhub calendar-earnings passthrough`. (Deploy `supabase functions deploy api-finnhub` ONLY on explicit user go.)

### Task 8 — Dashboard wiring (one commit)
**Files:** edit `src/components/layout/Dashboard.tsx` only. Read the whole file first.
Add imports for the 6 libs + `use52Week`, `useEarningsCalendar`, `SECTOR_COLORS`. Add, each in its OWN `<ErrorBoundary name="...">`, without altering existing blocks:
- **NewsMood** strip near the `News` block: `const mood = useMemo(() => newsMood(news ?? []), [news])`; one line `🐂 {mood.bull} · 🐻 {mood.bear} · net {mood.net>=0?'+':''}{mood.net}` (green if net>0, red if <0).
- **Heatmap** under the watchlist list block, gated `listSource==='watchlist'`: grid of `watchlistHeatmap(stocks, watchSymbols)` cells, bg via inline `hsl` lerp by intensity (green if cp≥0 else red), shows `symbol` + `cp.toFixed(1)%`.
- **SectorExposure** below heatmap, same gate: `sectorExposure(stocks, watchSymbols)`; a flex stacked bar, each segment `width:${pct}%`, color `hsl(${SECTOR_COLORS[sector] ?? '0 0% 50%'})`; tiny legend (top 5).
- **PriceAlerts** in the right column: localStorage-backed `useState` (init `parseAlerts(localStorage.getItem(STORAGE_KEY))`; persist via `useEffect`); symbol+target+dir inputs → add; chip strip with ✕ → remove; chip turns destructive-colored when in `evaluateAlerts(alerts, priceMap)` where `priceMap` = upper-cased `{sym:price}` from `stocks`.
- **WeekRange** bar directly under the existing `Fundamentals` ErrorBoundary block: `const r52 = use52Week([activeStock.symbol]); const d = r52.data?.ranges?.[activeStock.symbol]; const pos = d ? weekRangePosition(d.low52, d.high52, d.price) : null;` render a thin track with a marker at `left:${pos*100}%` and `low52`/`high52` labels; render nothing if `pos===null`.
- **Earnings** strip under the watchlist list (gate `listSource==='watchlist'` not required — show whenever events exist): `const ev = useEarningsCalendar(watchSymbols.map((t) => ({ ticker: t }))); const up = earningsWindow((ev.data ?? []).map((e) => ({ ticker: e.ticker, daysUntil: e.daysUntil })));` one line `📅 ` + `up.map(u => u.ticker+' '+u.label).join(' · ')`; hidden if empty.
Preserve every existing wrapper/CTA verbatim. Verify `npx tsc --noEmit && npm run build`. Commit: `feat: dashboard insights widgets (earnings, heatmap, sector, alerts, 52w, news mood)`.

### Task 9 — Final verification
`npx vitest run` (all green incl. 6 new suites), `npx tsc --noEmit` 0, `npm run build` ✓. Static greps confirm 6 widgets wired + all prior `ErrorBoundary name=`/`DeferUntilVisible`/`?sym=` present. `git diff --stat` scope = only the allowed files. `git status --porcelain` on the 4 WIP files shows only pre-existing ` M`, never staged.

## Notes
- Earnings widget is dead until `api-finnhub` is redeployed — expected; ErrorBoundary + empty-guard keep it invisible, not broken, pre-deploy.
- Keep libs generic/loosely-typed to accept the rich hook/row shapes without coupling.
