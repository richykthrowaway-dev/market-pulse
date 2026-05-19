# Dashboard: Concentration Score + Market Gap Movers + Per-Symbol Notes — Design & Plan

**Date:** 2026-05-19 · **Status:** Approved

**Goal:** Three more production-ready dashboard widgets, same proven pattern (pure TDD libs + thin Dashboard wiring, each in its own ErrorBoundary).

**Hard constraints:** explicit path `C:\Users\PC\Downloads\market-pulse` for every tool; create only the 3 new `src/lib/*.ts`(+`.test.ts`) and edit only `src/components/layout/Dashboard.tsx`; never touch/stage `App.tsx`/`MobileShell.tsx`/`Sidebar.tsx`/`TradeJournal.tsx`; never `git add -A`; commits local until user says push; no dev server (vitest+tsc+build); preserve every shipped wrapper/CTA verbatim.

## Task 1 — `concentrationScore` lib (TDD)
`src/lib/concentrationScore.ts`(+test). Input: `{pct:number}[]` (the `sectorExposure` output). Herfindahl: `score = round(sum((pct/100)^2)*100)` → 0..100 (100 = all one sector). `label`: ≥50 'Concentrated', ≥30 'Moderate', else 'Diversified'. `[]`/non-array → `{score:0,label:'—'}`. Pure.
Tests: single sector → 100/'Concentrated'; even 4-way (25 each) → 25/'Diversified'; 50/30/20 → 38/'Moderate'; non-array → score 0,'—'.

## Task 2 — `topMovers` lib (TDD)
`src/lib/topMovers.ts`(+test). `topMovers(stocks, n=3)` → up to n distinct-symbol rows sorted by `|changePercent|` desc, ties stable; skip non-finite/no-symbol; non-array → `[]`. Returns the original row objects (generic `<T extends {symbol:string;changePercent?:number}>`).
Tests: picks largest absolute movers incl. negatives; n cap; dedup by symbol; non-array safe.

## Task 3 — `symbolNotes` lib (TDD)
`src/lib/symbolNotes.ts`(+test). `STORAGE_KEY='dash-notes-v1'`. `parseNotes(raw)` → `Record<string,string>` (self-healing: bad JSON / non-object / non-string values dropped → `{}`). `setNote(map,sym,text)` pure returns new map (empty/whitespace text deletes the key; symbol upper-cased). Never throws.
Tests: parse valid; bad json→{}; non-string values dropped; setNote adds/updates/clears; immutability.

## Task 4 — Dashboard wiring (one commit)
Imports: the 3 libs. Derived: `const conc = useMemo(() => concentrationScore(sectors), [sectors]);` `const gapMovers = useMemo(() => topMovers(stocks), [stocks]);` notes state `const [notes,setNotes]=useState(()=>parseNotes(localStorage.getItem(NOTES_KEY)))` + `useEffect` persist; `const activeNote = notes[activeStock?.symbol?.toUpperCase()] ?? ''`.
- **Concentration**: one line directly under the existing SectorExposure block (same `listSource==='watchlist' && sectors.length` gate), own `ErrorBoundary name="Concentration"`: `Concentration {conc.score}/100 · {conc.label}`.
- **Gap movers**: `ErrorBoundary name="GapMovers"` Card in the right column (after PriceAlerts): 3 rows `SYM  +x.x%` button → `selectStock`.
- **Notes**: `ErrorBoundary name="SymbolNotes"` block under the 52-week bar inside the Fundamentals div: a `<textarea>` bound to `activeNote`, onChange → `setNotes((m)=>setNote(m,activeStock.symbol,v))`. Render only when `activeStock`.
Verify `npx tsc --noEmit && npm run build`. Commit `feat: concentration score + gap movers + per-symbol notes widgets`.

## Task 5 — Final verification
`npx vitest run` all green (incl. 3 new suites), tsc 0, build ✓. `git diff --stat` scope = only the 3 libs+tests + Dashboard.tsx + this doc. WIP files only pre-existing ` M`, never staged.

## Out of scope (YAGNI)
Note sync to backend, rich-text notes, configurable mover count, per-position concentration weighting.
