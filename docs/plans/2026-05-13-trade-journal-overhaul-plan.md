# Trade Journal Overhaul — Wave 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Transform the existing Journal page into a serious trade-analytics tool with R-multiples, IBKR auto-import, setups/mistakes tagging, behavioral heatmaps, goal tracking + kill-switch, AI rule-based insights, and screenshot capture — all while preserving the existing dual-write localStorage + IndexedDB storage pattern.

**Architecture:** Phased expansion of `src/pages/TradeJournal.tsx`. Current 3-tab layout grows to 6 tabs. `TradeEntry` type gains optional fields (back-compat). A new `JournalSettings` document holds user-defined setups, mistakes, account size, and goals. Screenshots stored as Blobs in a new IDB object store keyed by trade ID. All client-side; no new backend routes.

**Tech Stack:** React + TypeScript + Vite. shadcn/ui components. Recharts for the new charts. `useSyncExternalStore` for store subscription. IndexedDB for blob storage.

**Verification model:** No test framework in this project. Each task is verified by `npm run build` (TypeScript + Vite, zero errors) plus the specific manual smoke check noted in the task.

**Design reference:** `docs/plans/2026-05-13-trade-journal-overhaul-design.md`.

---

## Phase A — Foundation (data model + stores)

### Task 1: Extend `TradeEntry` and add `ExitReason`

**Files:**
- Modify: `src/hooks/useTradeJournal.ts` (top type block, ~line 7–20)

**Code:**

Add the new type union and extend `TradeEntry`:

```ts
export type ExitReason = 'target' | 'stop' | 'time' | 'discretion' | 'panic';

export interface TradeEntry {
  // EXISTING (unchanged)
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: string;
  exitDate: string;
  fees: number;
  notes: string;
  tags: string[];
  createdAt: string;

  // NEW — Wave 1, all optional
  stopLoss?: number;
  target?: number;
  entryTime?: string;        // "HH:MM"
  exitTime?: string;
  setup?: string;
  mistakes?: string[];
  exitReason?: ExitReason;
  inPlaybook?: boolean;
  screenshot?: string;       // IDB key, not the blob itself
}
```

**Verify:** `npm run build` — must pass with zero errors. (No call sites need to change because all new fields are optional.)

**Commit:** `feat(journal): extend TradeEntry with Wave 1 optional fields`

---

### Task 2: Add `computeR` and R-expectancy derived stats

**Files:**
- Modify: `src/hooks/useTradeJournal.ts`

**Code:**

After `computePnL`, add:

```ts
export function computeInitialRisk(t: TradeEntry): number | null {
  if (t.stopLoss === undefined || t.stopLoss === null) return null;
  return Math.abs(t.entryPrice - t.stopLoss) * t.quantity;
}

export function computeR(t: TradeEntry): number | null {
  const risk = computeInitialRisk(t);
  if (risk === null || risk === 0) return null;
  return computePnL(t) / risk;
}
```

Add to `JournalStats` interface:

```ts
export interface JournalStats {
  // ...existing fields
  expectancy: number;            // mean P&L per trade across all trades
  rExpectancy: number | null;    // mean R across trades with a stop, or null if none
  rTradeCount: number;           // how many trades have a stop
}
```

In the `stats` `useMemo`, after the existing reducer, compute:

```ts
const expectancy = trades.length > 0 ? totalPnL / trades.length : 0;
let rSum = 0, rCount = 0;
for (const t of trades) {
  const r = computeR(t);
  if (r !== null) { rSum += r; rCount += 1; }
}
const rExpectancy = rCount > 0 ? rSum / rCount : null;
```

Include `expectancy`, `rExpectancy`, `rTradeCount` in the returned stats object.

**Verify:**
1. `npm run build` clean.
2. Manual: in DevTools, run a paste-snippet to add a trade with `stopLoss` set; `expectancy` and `rExpectancy` should appear in `stats`.

**Commit:** `feat(journal): R-multiple computation and R-expectancy stat`

---

### Task 3: Create `useJournalSettings` hook

**Files:**
- Create: `src/hooks/useJournalSettings.ts`

**Code:**

```ts
import { useCallback, useSyncExternalStore } from 'react';

export interface JournalSettings {
  setups: string[];
  mistakes: string[];
  accountSize?: number;
  goals: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    dailyMaxLoss?: number;
  };
}

const DEFAULT_SETTINGS: JournalSettings = {
  setups: ['Breakout', 'Pullback', 'Mean Reversion', 'Gap Fill'],
  mistakes: ['FOMO', 'Moved stop', 'Oversized', 'No setup', 'Revenge trade'],
  goals: {},
};

const LS_KEY = 'trade-journal-settings-v1';
const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'settings';
const IDB_DOC = 'all';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2); // bump version to add settings store
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades')) db.createObjectStore('trades');
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains('screenshots')) db.createObjectStore('screenshots');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRead(): Promise<JournalSettings | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_DOC);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

function idbWrite(s: JournalSettings) {
  openIdb().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(s, IDB_DOC);
  }).catch(() => {});
}

function lsRead(): JournalSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
}

function lsWrite(s: JournalSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function notify() { listeners.forEach(l => l()); }

let snapshot: JournalSettings = lsRead();
function getSnapshot() { return snapshot; }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) { snapshot = lsRead(); notify(); }
  });
  idbRead().then(idb => {
    if (idb && JSON.stringify(idb) !== localStorage.getItem(LS_KEY)) {
      snapshot = { ...DEFAULT_SETTINGS, ...idb };
      lsWrite(snapshot);
      notify();
    } else if (!idb) {
      idbWrite(snapshot); // seed IDB
    }
  });
}

function update(fn: (prev: JournalSettings) => JournalSettings) {
  const next = fn(snapshot);
  snapshot = next;
  lsWrite(next);
  idbWrite(next);
  notify();
}

export function useJournalSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const setSettings = useCallback((patch: Partial<JournalSettings>) => {
    update(prev => ({ ...prev, ...patch }));
  }, []);

  const addSetup = useCallback((name: string) => {
    update(prev => prev.setups.includes(name) ? prev : { ...prev, setups: [...prev.setups, name] });
  }, []);

  const addMistake = useCallback((name: string) => {
    update(prev => prev.mistakes.includes(name) ? prev : { ...prev, mistakes: [...prev.mistakes, name] });
  }, []);

  return { settings, setSettings, addSetup, addMistake } as const;
}
```

**Verify:**
1. `npm run build` clean.
2. Manual: open DevTools, call `localStorage.getItem('trade-journal-settings-v1')` after page load — should be `null` initially; render the page (any component using the hook), then re-check — should contain the default JSON.

**Commit:** `feat(journal): useJournalSettings hook with LS+IDB dual-write`

---

### Task 4: Create `useJournalScreenshots` hook

**Files:**
- Create: `src/hooks/useJournalScreenshots.ts`

**Code:**

```ts
import { useCallback } from 'react';

const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'screenshots';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades')) db.createObjectStore('trades');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(key: string): Promise<Blob | null> {
  const db = await openIdb();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function deleteBlob(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function useJournalScreenshots() {
  const save = useCallback(async (tradeId: string, blob: Blob): Promise<string> => {
    const key = `screenshot:${tradeId}`;
    await putBlob(key, blob);
    return key;
  }, []);

  const load = useCallback(async (key: string): Promise<string | null> => {
    const blob = await getBlob(key);
    return blob ? URL.createObjectURL(blob) : null;
  }, []);

  const remove = useCallback(async (key: string): Promise<void> => {
    await deleteBlob(key);
  }, []);

  return { save, load, remove } as const;
}
```

**Verify:**
1. `npm run build` clean.
2. Manual smoke is deferred to Task 13 when the paster wires this up.

**Commit:** `feat(journal): useJournalScreenshots IDB blob CRUD hook`

---

## Phase B — TradeFormDialog expansion

### Task 5: Add Risk section to TradeFormDialog (stop/target inputs + live risk display)

**Files:**
- Modify: `src/components/journal/TradeFormDialog.tsx`

**Code:**

Add two new form fields after the entry/exit price inputs:

```tsx
<NumInput label="Stop Loss (optional)" value={stopLoss ?? 0} onChange={v => setStopLoss(v || undefined)} prefix="$" />
<NumInput label="Target (optional)" value={target ?? 0} onChange={v => setTarget(v || undefined)} prefix="$" />
```

(If `NumInput` differs from `src/components/calculators/NumInput.tsx`, use the dialog's existing input pattern — match the existing entry/exit price input style.)

Below those, show a live risk indicator:

```tsx
{stopLoss !== undefined && quantity > 0 && (
  <div className="text-sm text-muted-foreground">
    Risk: {fmtDollar(Math.abs(entryPrice - stopLoss) * quantity)}
    {accountSize ? ` (${((Math.abs(entryPrice - stopLoss) * quantity) / accountSize * 100).toFixed(2)}% of account)` : ''}
  </div>
)}
```

Pull `accountSize` from `useJournalSettings()`.

Wire stopLoss/target into the submit payload (already part of `TradeEntry`).

**Verify:**
1. `npm run build` clean.
2. Open trade form, enter entry=100, qty=10, stop=95 → risk displays "$50.00". Set accountSize in localStorage → "(% of account)" appears.

**Commit:** `feat(journal): stop-loss/target inputs with live risk display`

---

### Task 6: Create `SetupCombobox` component

**Files:**
- Create: `src/components/journal/SetupCombobox.tsx`

**Code:**

A combobox that:
- Shows existing settings.setups as options
- Allows free-form typing
- On commit (Enter or blur with new value), calls `addSetup(value)`

Use shadcn `Command` primitive (it's already in the project — look in `src/components/ui/command.tsx`). If not, fall back to a plain `<input>` with a datalist:

```tsx
import { useState } from 'react';
import { useJournalSettings } from '@/hooks/useJournalSettings';

interface SetupComboboxProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function SetupCombobox({ value, onChange }: SetupComboboxProps) {
  const { settings, addSetup } = useJournalSettings();
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    const v = draft.trim();
    if (!v) { onChange(undefined); return; }
    addSetup(v);
    onChange(v);
  }

  return (
    <div>
      <input
        list="setup-options"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder="e.g. Breakout"
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <datalist id="setup-options">
        {settings.setups.map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
```

Wire into TradeFormDialog: add a "Setup" field after Risk section.

**Verify:**
1. `npm run build` clean.
2. Open trade form, type "Scalp" in Setup, save trade → reload → "Scalp" appears as an autocomplete option for the next trade.

**Commit:** `feat(journal): SetupCombobox with autocomplete + new-setup capture`

---

### Task 7: Create `MistakeMultiSelect` component

**Files:**
- Create: `src/components/journal/MistakeMultiSelect.tsx`

**Code:**

```tsx
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useJournalSettings } from '@/hooks/useJournalSettings';

interface Props {
  values: string[];
  onChange: (v: string[]) => void;
}

export function MistakeMultiSelect({ values, onChange }: Props) {
  const { settings, addMistake } = useJournalSettings();
  const [draft, setDraft] = useState('');

  function toggle(m: string) {
    if (values.includes(m)) onChange(values.filter(v => v !== m));
    else onChange([...values, m]);
  }

  function addFreeForm() {
    const v = draft.trim();
    if (!v) return;
    addMistake(v);
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {settings.mistakes.map(m => (
          <Badge
            key={m}
            variant={values.includes(m) ? 'destructive' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggle(m)}
          >
            {values.includes(m) && <X className="h-3 w-3 mr-1" />}
            {m}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFreeForm(); } }}
          placeholder="Add custom mistake…"
          className="flex-1 px-2 py-1 border border-input bg-background rounded text-xs"
        />
      </div>
    </div>
  );
}
```

Wire into TradeFormDialog under a "Tags & Notes" section (or wherever the existing notes field lives).

**Verify:**
1. `npm run build` clean.
2. Open trade form, click "FOMO" → it turns red and selected. Click again → unselected. Type "Held overnight" + Enter → added to library and selected.

**Commit:** `feat(journal): MistakeMultiSelect chips + custom entry`

---

### Task 8: Add Exit Reason, In-Playbook toggle, Entry/Exit times

**Files:**
- Modify: `src/components/journal/TradeFormDialog.tsx`

**Code:**

Add four new form fields:

```tsx
{/* Exit Reason */}
<div>
  <label className="block text-sm font-medium mb-1">Exit Reason</label>
  <select
    value={exitReason ?? ''}
    onChange={e => setExitReason((e.target.value || undefined) as ExitReason | undefined)}
    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
  >
    <option value="">—</option>
    <option value="target">Hit target</option>
    <option value="stop">Stopped out</option>
    <option value="time">Time stop</option>
    <option value="discretion">Discretionary exit</option>
    <option value="panic">Panic exit</option>
  </select>
</div>

{/* In Playbook */}
<div className="flex items-center justify-between">
  <div>
    <p className="font-medium text-sm">In your playbook?</p>
    <p className="text-xs text-muted-foreground">Off the script if toggled off</p>
  </div>
  <Switch checked={inPlaybook ?? true} onCheckedChange={setInPlaybook} />
</div>

{/* Times */}
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="block text-sm font-medium mb-1">Entry Time (optional)</label>
    <input type="time" value={entryTime ?? ''} onChange={e => setEntryTime(e.target.value || undefined)}
           className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm" />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1">Exit Time (optional)</label>
    <input type="time" value={exitTime ?? ''} onChange={e => setExitTime(e.target.value || undefined)}
           className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm" />
  </div>
</div>
```

Wire all four into the submit payload.

**Verify:**
1. `npm run build` clean.
2. Open form, fill all new fields, save → re-open the trade → all values persisted.

**Commit:** `feat(journal): exit reason, playbook toggle, entry/exit times`

---

### Task 9: Create `ScreenshotPaster` component

**Files:**
- Create: `src/components/journal/ScreenshotPaster.tsx`

**Code:**

```tsx
import { useEffect, useState } from 'react';
import { Clipboard, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJournalScreenshots } from '@/hooks/useJournalScreenshots';

interface Props {
  tradeId: string;       // pre-allocated UUID before save
  screenshotKey?: string;
  onChange: (key: string | undefined) => void;
}

export function ScreenshotPaster({ tradeId, screenshotKey, onChange }: Props) {
  const { save, load, remove } = useJournalScreenshots();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (screenshotKey) load(screenshotKey).then(setPreviewUrl);
    else setPreviewUrl(null);
  }, [screenshotKey, load]);

  async function handleBlob(blob: Blob) {
    const key = await save(tradeId, blob);
    onChange(key);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function handlePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await handleBlob(blob);
          return;
        }
      }
    } catch {}
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleBlob(f);
  }

  async function clearShot() {
    if (screenshotKey) await remove(screenshotKey);
    setPreviewUrl(null);
    onChange(undefined);
  }

  // Listen for paste events while focused inside the dropzone
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) { handleBlob(blob); e.preventDefault(); return; }
        }
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [tradeId]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Screenshot (optional)</label>
      {previewUrl ? (
        <div className="relative inline-block">
          <img src={previewUrl} alt="Trade screenshot" className="max-h-48 rounded border border-border" />
          <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={clearShot}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-md p-4 text-center text-sm text-muted-foreground">
          <p>Paste chart screenshot (Ctrl/Cmd+V), upload, or drag a file</p>
          <div className="mt-2 flex gap-2 justify-center">
            <Button type="button" size="sm" variant="outline" onClick={handlePaste}>
              <Clipboard className="h-3 w-3 mr-1" /> Paste
            </Button>
            <label className="inline-flex items-center gap-1 text-xs cursor-pointer border border-input rounded px-2 py-1 hover:bg-muted">
              <Upload className="h-3 w-3" /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
```

Wire into TradeFormDialog. **Important**: the trade form must use a *pre-allocated* UUID at the start (so the screenshot can be keyed before the trade is saved). Either generate `crypto.randomUUID()` on dialog open and pass it in, OR delay paster activation until after first save (keep it simple — pre-allocate).

**Verify:**
1. `npm run build` clean.
2. Open trade form. Press Ctrl+V with an image in clipboard → image appears as preview. Save trade. Re-open it → screenshot still there. Click X → screenshot removed.

**Commit:** `feat(journal): ScreenshotPaster with paste/upload/drag + IDB blob storage`

---

## Phase C — Trades table + Hero

### Task 10: Update `TradeLogTable` with R / Setup / Mistakes / 📷 columns + filters

**Files:**
- Modify: `src/components/journal/TradeLogTable.tsx`

**Code:**

Add filter state at top:

```tsx
const [setupFilter, setSetupFilter] = useState<string | 'all'>('all');
const [symbolQuery, setSymbolQuery] = useState('');
const [sideFilter, setSideFilter] = useState<'all'|'long'|'short'>('all');
const [offScriptOnly, setOffScriptOnly] = useState(false);

const filtered = trades.filter(t => {
  if (setupFilter !== 'all' && t.setup !== setupFilter) return false;
  if (symbolQuery && !t.symbol.toLowerCase().includes(symbolQuery.toLowerCase())) return false;
  if (sideFilter !== 'all' && t.side !== sideFilter) return false;
  if (offScriptOnly && t.inPlaybook !== false) return false;
  return true;
});
```

Render filter chips above the table. Add the new columns to the table head + body. Use a small helper to render mistakes as colored dots and the screenshot indicator:

```tsx
function MistakeDots({ mistakes }: { mistakes?: string[] }) {
  if (!mistakes?.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={mistakes.join(', ')}>
      {mistakes.slice(0, 3).map(m => <span key={m} className="w-1.5 h-1.5 rounded-full bg-destructive" />)}
      {mistakes.length > 3 && <span className="text-xs text-muted-foreground">+{mistakes.length - 3}</span>}
    </span>
  );
}
```

R column: render `+2.4R` green / `-1.0R` red, or `—` for missing.

**Verify:**
1. `npm run build` clean.
2. Manual: filter by symbol — only matching rows visible. Filter by setup — same. Off-script toggle — only rows with `inPlaybook === false` show.

**Commit:** `feat(journal): trade table — R/setup/mistake/screenshot columns + filters`

---

### Task 11: Replace `JournalStatsRow` with `HeroStatsRow`

**Files:**
- Create: `src/components/journal/HeroStatsRow.tsx`
- Modify: `src/pages/TradeJournal.tsx` (import path)

**Code:**

```tsx
import { JournalStats } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { TrendingUp, TrendingDown, Target, Activity, Zap } from 'lucide-react';

interface Tile {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'positive' | 'negative' | 'neutral';
}

export function HeroStatsRow({ stats, currentStreak }: { stats: JournalStats; currentStreak: { kind: 'win'|'loss'|'none'; length: number } }) {
  const tiles: Tile[] = [
    { label: 'Total P&L', value: fmtDollar(stats.totalPnL), icon: TrendingUp, tone: stats.totalPnL >= 0 ? 'positive' : 'negative' },
    { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%`, icon: Target },
    { label: 'Profit Factor', value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', icon: Activity },
    { label: 'Expectancy / trade', value: fmtDollar(stats.expectancy), icon: TrendingUp, tone: stats.expectancy >= 0 ? 'positive' : 'negative' },
    { label: 'R-Expectancy', value: stats.rExpectancy !== null ? `${stats.rExpectancy >= 0 ? '+' : ''}${stats.rExpectancy.toFixed(2)}R` : '—', icon: Zap, tone: stats.rExpectancy !== null && stats.rExpectancy >= 0 ? 'positive' : 'negative' },
    { label: currentStreak.kind === 'win' ? 'Win Streak' : currentStreak.kind === 'loss' ? 'Loss Streak' : 'Streak', value: currentStreak.length > 0 ? `${currentStreak.length}` : '—', icon: TrendingDown, tone: currentStreak.kind === 'loss' ? 'negative' : currentStreak.kind === 'win' ? 'positive' : 'neutral' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {tiles.map(t => (
        <div key={t.label} className={`bg-card rounded-lg p-4 border ${t.tone === 'positive' ? 'border-success/50' : t.tone === 'negative' ? 'border-destructive/50' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className={`text-lg font-semibold ${t.tone === 'positive' ? 'text-success' : t.tone === 'negative' ? 'text-destructive' : ''}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}
```

Add streak computation to `useTradeJournal`:

```ts
const currentStreak = useMemo(() => {
  if (trades.length === 0) return { kind: 'none' as const, length: 0 };
  const sorted = [...trades].sort((a, b) => b.exitDate.localeCompare(a.exitDate));
  const first = computePnL(sorted[0]);
  if (first === 0) return { kind: 'none' as const, length: 0 };
  const kind: 'win' | 'loss' = first > 0 ? 'win' : 'loss';
  let length = 0;
  for (const t of sorted) {
    const p = computePnL(t);
    if ((kind === 'win' && p > 0) || (kind === 'loss' && p < 0)) length++;
    else break;
  }
  return { kind, length };
}, [trades]);
```

Expose `currentStreak` from the hook. Replace `<JournalStatsRow stats={stats} />` with `<HeroStatsRow stats={stats} currentStreak={currentStreak} />` in TradeJournal.tsx.

**Verify:**
1. `npm run build` clean.
2. Manual: hero row shows 6 tiles. Streak tile reflects last trade.

**Commit:** `feat(journal): HeroStatsRow with expectancy/R/streak tiles`

---

## Phase D — New tabs (skeletons + wiring)

### Task 12: Create `OverviewTab.tsx` skeleton

**Files:**
- Create: `src/components/journal/OverviewTab.tsx`

**Code:**

```tsx
import { JournalStats, TradeEntry } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';

interface Props {
  stats: JournalStats;
  trades: TradeEntry[];
  settings: JournalSettings;
}

export function OverviewTab({ stats, trades, settings }: Props) {
  return (
    <div className="space-y-6">
      {/* Slot 1: Kill-switch banner (Task 22) */}
      {/* Slot 2: Goal progress cards (Task 21) */}
      {/* Slot 3: Insight callouts (Task 25) */}
      {/* Slot 4: Outlier loss list (Task 26) */}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
        <p className="text-sm text-muted-foreground">{trades.length} trades logged.</p>
      </Card>
    </div>
  );
}
```

Add to TradeJournal.tsx tabs:

```tsx
<TabsList>
  <TabsTrigger value="overview" className="gap-1.5"><Activity className="h-4 w-4" /> Overview</TabsTrigger>
  <TabsTrigger value="calendar" .../>
  ...
</TabsList>

<TabsContent value="overview">
  <OverviewTab stats={stats} trades={trades} settings={settings} />
</TabsContent>
```

Change `defaultValue="calendar"` → `defaultValue="overview"`.

**Verify:**
1. `npm run build` clean.
2. Open the Journal — Overview tab opens first, shows placeholder card.

**Commit:** `feat(journal): OverviewTab skeleton + wire as default tab`

---

### Task 13: Create `AnalyticsTab.tsx` skeleton

**Files:**
- Create: `src/components/journal/AnalyticsTab.tsx`

**Code:**

```tsx
import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';

interface Props {
  trades: TradeEntry[];
}

export function AnalyticsTab({ trades }: Props) {
  return (
    <div className="space-y-6">
      {/* Slot: By Setup table (Task 17) */}
      {/* Slot: By Symbol table (Task 18) */}
      {/* Slot: By Mistake table (Task 19) */}
      {/* Slot: Exit Reason chart (Task 20) */}

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{trades.length} trades to analyze.</p>
      </Card>
    </div>
  );
}
```

Wire into TradeJournal.tsx tabs (add new `<TabsTrigger value="analytics">` and `<TabsContent>`).

**Verify:** Build + manual tab visible.
**Commit:** `feat(journal): AnalyticsTab skeleton`

---

### Task 14: Create `RulesTab.tsx` (Wave 1 = settings editor only)

**Files:**
- Create: `src/components/journal/RulesTab.tsx`

**Code:**

```tsx
import { useJournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useState } from 'react';

export function RulesTab() {
  const { settings, setSettings, addSetup, addMistake } = useJournalSettings();
  const [newSetup, setNewSetup] = useState('');
  const [newMistake, setNewMistake] = useState('');

  function removeSetup(s: string) {
    setSettings({ setups: settings.setups.filter(x => x !== s) });
  }
  function removeMistake(m: string) {
    setSettings({ mistakes: settings.mistakes.filter(x => x !== m) });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Account size</h3>
        <input type="number" placeholder="$0" value={settings.accountSize ?? ''}
          onChange={e => setSettings({ accountSize: Number(e.target.value) || undefined })}
          className="w-48 px-3 py-2 border border-input bg-background rounded-md" />
        <p className="text-xs text-muted-foreground mt-2">Enables risk-as-% calculations across the journal.</p>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Setups (playbook)</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {settings.setups.map(s => (
            <Badge key={s} variant="outline" className="gap-1">
              {s}
              <button onClick={() => removeSetup(s)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSetup} onChange={e => setNewSetup(e.target.value)}
            placeholder="Add setup name..." className="flex-1 px-3 py-2 border border-input bg-background rounded-md" />
          <Button onClick={() => { if (newSetup.trim()) { addSetup(newSetup.trim()); setNewSetup(''); } }}>Add</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Mistakes taxonomy</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {settings.mistakes.map(m => (
            <Badge key={m} variant="outline" className="gap-1">
              {m}
              <button onClick={() => removeMistake(m)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newMistake} onChange={e => setNewMistake(e.target.value)}
            placeholder="Add mistake name..." className="flex-1 px-3 py-2 border border-input bg-background rounded-md" />
          <Button onClick={() => { if (newMistake.trim()) { addMistake(newMistake.trim()); setNewMistake(''); } }}>Add</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Goals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumGoal label="Daily target" value={settings.goals.daily} onChange={v => setSettings({ goals: { ...settings.goals, daily: v } })} />
          <NumGoal label="Weekly target" value={settings.goals.weekly} onChange={v => setSettings({ goals: { ...settings.goals, weekly: v } })} />
          <NumGoal label="Monthly target" value={settings.goals.monthly} onChange={v => setSettings({ goals: { ...settings.goals, monthly: v } })} />
          <NumGoal label="Daily max LOSS" value={settings.goals.dailyMaxLoss} onChange={v => setSettings({ goals: { ...settings.goals, dailyMaxLoss: v } })} />
        </div>
      </Card>
    </div>
  );
}

function NumGoal({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input type="number" placeholder="$0" value={value ?? ''}
        onChange={e => onChange(Number(e.target.value) || undefined)}
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm" />
    </div>
  );
}
```

Wire into TradeJournal.tsx tabs (`<TabsTrigger value="rules">`).

**Verify:**
1. Build clean.
2. Manual: add a setup "Test Setup" → it persists across refresh. Set account size = 50000 → trade form shows "% of account" indicator.

**Commit:** `feat(journal): RulesTab settings editor (setups, mistakes, goals, account size)`

---

## Phase E — Analytics tables

### Task 15: Day-of-week heatmap

**Files:**
- Create: `src/components/journal/DayOfWeekHeatmap.tsx`
- Modify: `src/pages/TradeJournal.tsx` (Calendar tab content)

**Code:**

```tsx
import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DayOfWeekHeatmap({ trades }: { trades: TradeEntry[] }) {
  const buckets: { pnl: number; count: number; wins: number }[] = DAYS.map(() => ({ pnl: 0, count: 0, wins: 0 }));
  for (const t of trades) {
    const d = new Date(t.exitDate + 'T12:00:00').getDay();
    const pnl = computePnL(t);
    buckets[d].pnl += pnl;
    buckets[d].count += 1;
    if (pnl > 0) buckets[d].wins += 1;
  }
  const max = Math.max(...buckets.map(b => Math.abs(b.pnl)), 1);

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">By day of week</h4>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((label, i) => {
          const b = buckets[i];
          const intensity = Math.abs(b.pnl) / max;
          const color = b.pnl > 0 ? `rgba(34,197,94,${0.15 + intensity * 0.6})` : b.pnl < 0 ? `rgba(239,68,68,${0.15 + intensity * 0.6})` : 'transparent';
          const winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
          return (
            <div key={label} className="text-center p-2 rounded border border-border" style={{ backgroundColor: color }}
              title={`${label}: ${b.count} trades, ${winRate.toFixed(0)}% win rate, $${b.pnl.toFixed(0)} P&L`}>
              <div className="text-xs font-medium">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{b.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Add to Calendar tab below the existing `<PnLCalendar>`.

**Verify:** Build clean + heatmap renders with hover tooltips.
**Commit:** `feat(journal): day-of-week heatmap`

---

### Task 16: Hour-of-day heatmap

**Files:**
- Create: `src/components/journal/HourOfDayHeatmap.tsx`
- Modify: `src/pages/TradeJournal.tsx`

**Code:**

Similar pattern to DayOfWeekHeatmap, but iterates entries with `entryTime` set, parses the hour, and renders 24 cells (or only 9 cells 09:00–17:00). Cells without trades render greyed. Add below DayOfWeekHeatmap on Calendar tab.

```tsx
const HOURS = Array.from({ length: 24 }, (_, h) => h);
// ... iterate trades with t.entryTime; parse first two chars as hour
```

**Verify:** Build clean. Add a trade with entryTime=10:30, hour bucket "10" lights up.
**Commit:** `feat(journal): hour-of-day heatmap`

---

### Task 17: `BySetupTable`

**Files:**
- Create: `src/components/journal/BySetupTable.tsx`
- Modify: `src/components/journal/AnalyticsTab.tsx`

**Code:**

```tsx
import { TradeEntry, computePnL, computeR } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';

export function BySetupTable({ trades }: { trades: TradeEntry[] }) {
  const map = new Map<string, { count: number; wins: number; pnl: number; rSum: number; rCount: number }>();
  for (const t of trades) {
    const setup = t.setup ?? '(No setup)';
    const row = map.get(setup) ?? { count: 0, wins: 0, pnl: 0, rSum: 0, rCount: 0 };
    const pnl = computePnL(t);
    row.count += 1;
    row.pnl += pnl;
    if (pnl > 0) row.wins += 1;
    const r = computeR(t);
    if (r !== null) { row.rSum += r; row.rCount += 1; }
    map.set(setup, row);
  }
  const rows = [...map.entries()].sort((a, b) => b[1].pnl - a[1].pnl);

  return (
    <div className="bg-card rounded-lg p-6 shadow">
      <h3 className="text-lg font-semibold mb-3">By Setup</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No trades tagged yet.</p> :
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2">Setup</th><th>Count</th><th>Win Rate</th><th>Avg R</th><th className="text-right">Total P&L</th>
          </tr></thead>
          <tbody>
            {rows.map(([s, r]) => (
              <tr key={s} className="border-b border-border/40">
                <td className="py-2 font-medium">{s}</td>
                <td>{r.count}</td>
                <td>{((r.wins / r.count) * 100).toFixed(0)}%</td>
                <td>{r.rCount > 0 ? (r.rSum / r.rCount).toFixed(2) + 'R' : '—'}</td>
                <td className={`text-right ${r.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtDollar(r.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>}
    </div>
  );
}
```

Add to AnalyticsTab.

**Verify:** Build clean. Tag a few trades with different setups → table shows them grouped.
**Commit:** `feat(journal): By Setup analytics table`

---

### Task 18: `BySymbolTable`

**Files:**
- Create: `src/components/journal/BySymbolTable.tsx`
- Modify: `src/components/journal/AnalyticsTab.tsx`

**Code:** Same pattern as BySetupTable, but group by `t.symbol`. Columns: Symbol, Count, Win Rate, Avg R, Best Trade, Worst Trade, Total P&L. Sorted by `pnl` desc.

**Verify:** Build clean + visible in Analytics tab.
**Commit:** `feat(journal): By Symbol analytics table`

---

### Task 19: `ByMistakeTable`

**Files:**
- Create: `src/components/journal/ByMistakeTable.tsx`
- Modify: `src/components/journal/AnalyticsTab.tsx`

**Code:** Flatten `mistakes` array — each trade contributes to every mistake it has. Group by mistake, compute: Occurrences, Total $ lost, Avg loss per occurrence. Sort by total lost.

```tsx
const map = new Map<string, { count: number; loss: number }>();
for (const t of trades) {
  if (!t.mistakes?.length) continue;
  const pnl = computePnL(t);
  for (const m of t.mistakes) {
    const row = map.get(m) ?? { count: 0, loss: 0 };
    row.count += 1;
    if (pnl < 0) row.loss += pnl; // only count losses
    map.set(m, row);
  }
}
```

**Verify:** Build clean.
**Commit:** `feat(journal): Cost of Mistakes analytics table`

---

### Task 20: `ByExitReasonChart`

**Files:**
- Create: `src/components/journal/ByExitReasonChart.tsx`
- Modify: `src/components/journal/AnalyticsTab.tsx`

**Code:** Recharts PieChart showing count per exit reason, with win rate annotation in tooltip. Use 5 colors keyed to reasons.

```tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
// data: [{ name: 'target', count, winRate }, ...]
```

**Verify:** Build clean.
**Commit:** `feat(journal): Exit Reason breakdown chart`

---

## Phase F — Goals + kill-switch

### Task 21: `GoalProgressCard` + wire into Overview tab

**Files:**
- Create: `src/components/journal/GoalProgressCard.tsx`
- Modify: `src/components/journal/OverviewTab.tsx`

**Code:**

```tsx
import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { fmtDollar } from '@/components/calculators/calcUtils';

function getPnLForPeriod(trades: TradeEntry[], startDate: string): number {
  return trades.filter(t => t.exitDate >= startDate).reduce((s, t) => s + computePnL(t), 0);
}

export function GoalProgressCard({ trades, settings }: { trades: TradeEntry[]; settings: JournalSettings }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
  const monthStart = today.slice(0, 8) + '01';

  const dayPnL = getPnLForPeriod(trades, today);
  const weekPnL = getPnLForPeriod(trades, weekStart);
  const monthPnL = getPnLForPeriod(trades, monthStart);

  const rows = [
    { label: 'Today', pnl: dayPnL, target: settings.goals.daily },
    { label: 'This week', pnl: weekPnL, target: settings.goals.weekly },
    { label: 'This month', pnl: monthPnL, target: settings.goals.monthly },
  ];

  return (
    <div className="bg-card rounded-lg p-6 shadow">
      <h3 className="text-lg font-semibold mb-4">Goal progress</h3>
      <div className="space-y-3">
        {rows.map(r => {
          if (!r.target) return (
            <div key={r.label} className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span className="text-muted-foreground">{fmtDollar(r.pnl)} (no goal set)</span>
            </div>
          );
          const pct = Math.max(0, Math.min(100, (r.pnl / r.target) * 100));
          const color = pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-amber-500' : 'bg-muted-foreground/40';
          return (
            <div key={r.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{r.label}</span>
                <span>{fmtDollar(r.pnl)} / {fmtDollar(r.target)}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Wire `<GoalProgressCard trades={trades} settings={settings} />` into OverviewTab.

**Verify:** Build clean. Set daily target = $500 in Rules tab, log a $200 trade today → goal bar shows 40%.
**Commit:** `feat(journal): GoalProgressCard with daily/weekly/monthly bars`

---

### Task 22: `KillSwitchBanner` + log-trade warning

**Files:**
- Create: `src/components/journal/KillSwitchBanner.tsx`
- Modify: `src/components/journal/OverviewTab.tsx`
- Modify: `src/pages/TradeJournal.tsx` (intercept Log Trade button)

**Code:**

```tsx
import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { AlertTriangle, Ban } from 'lucide-react';

export function KillSwitchBanner({ trades, settings }: { trades: TradeEntry[]; settings: JournalSettings }) {
  if (!settings.goals.dailyMaxLoss) return null;
  const today = new Date().toISOString().slice(0, 10);
  const todayPnL = trades.filter(t => t.exitDate === today).reduce((s, t) => s + computePnL(t), 0);
  if (todayPnL >= 0) return null;

  const max = settings.goals.dailyMaxLoss;
  const ratio = Math.abs(todayPnL) / max;

  if (ratio >= 1) return (
    <div className="bg-destructive/10 border border-destructive rounded-lg p-4 flex items-start gap-3">
      <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-destructive">Daily max loss hit</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Today's loss: {fmtDollar(todayPnL)} ≥ your limit of {fmtDollar(-max)}. Step away from the screen.
        </p>
      </div>
    </div>
  );

  if (ratio >= 0.8) return (
    <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-500">Approaching daily max loss</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Today's loss: {fmtDollar(todayPnL)} of {fmtDollar(-max)} limit ({(ratio * 100).toFixed(0)}%). Consider stopping.
        </p>
      </div>
    </div>
  );

  return null;
}
```

Wire `<KillSwitchBanner trades={trades} settings={settings} />` at top of OverviewTab.

Intercept Log Trade button in TradeJournal.tsx — when ratio ≥ 1, show a confirm dialog before opening the form. Simplest implementation: in `setFormOpen(true)`, check first and call `confirm("You've hit your daily max loss. Log anyway?")`. Replace with shadcn dialog later (out of scope for Wave 1 if confirm() works).

**Verify:** Build clean. Set dailyMaxLoss=$100, log a $-150 trade → red banner appears.
**Commit:** `feat(journal): kill-switch banner + log-trade warning at limit`

---

## Phase G — AI insights

### Task 23: `computeInsights` pure utility

**Files:**
- Create: `src/components/journal/computeInsights.ts`

**Code:**

```ts
import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';

export interface DayOfWeekInsight {
  kind: 'dayOfWeek';
  bestDay: string; bestWinRate: number;
  worstDay: string; worstWinRate: number;
  worstTradeCount: number; worstPnL: number;
}

export interface AfterLossInsight {
  kind: 'afterLoss';
  afterLossWinRate: number;
  afterWinWinRate: number;
}

export interface OutlierLossEntry {
  tradeId: string;
  date: string;
  symbol: string;
  loss: number;
  multiplier: number;
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function computeDayOfWeekInsight(trades: TradeEntry[]): DayOfWeekInsight | null {
  const buckets = DAYS.map(() => ({ count: 0, wins: 0, pnl: 0 }));
  for (const t of trades) {
    const d = new Date(t.exitDate + 'T12:00:00').getDay();
    const pnl = computePnL(t);
    buckets[d].count += 1;
    buckets[d].pnl += pnl;
    if (pnl > 0) buckets[d].wins += 1;
  }
  const eligible = buckets.map((b, i) => ({ day: DAYS[i], ...b, winRate: b.count > 0 ? b.wins / b.count : 0 })).filter(b => b.count >= 5);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => b.winRate - a.winRate);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  if (best.winRate - worst.winRate < 0.20) return null;
  return {
    kind: 'dayOfWeek',
    bestDay: best.day, bestWinRate: best.winRate * 100,
    worstDay: worst.day, worstWinRate: worst.winRate * 100,
    worstTradeCount: worst.count, worstPnL: worst.pnl,
  };
}

export function computeAfterLossInsight(trades: TradeEntry[]): AfterLossInsight | null {
  if (trades.length < 21) return null; // need ≥10 in each cohort
  const sorted = [...trades].sort((a, b) => (a.exitDate + (a.exitTime ?? '00:00')).localeCompare(b.exitDate + (b.exitTime ?? '00:00')));
  let afterLossWins = 0, afterLossTotal = 0, afterWinWins = 0, afterWinTotal = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevPnL = computePnL(sorted[i - 1]);
    const curPnL = computePnL(sorted[i]);
    if (prevPnL < 0) {
      afterLossTotal += 1;
      if (curPnL > 0) afterLossWins += 1;
    } else if (prevPnL > 0) {
      afterWinTotal += 1;
      if (curPnL > 0) afterWinWins += 1;
    }
  }
  if (afterLossTotal < 10 || afterWinTotal < 10) return null;
  const afterLossWinRate = afterLossWins / afterLossTotal;
  const afterWinWinRate = afterWinWins / afterWinTotal;
  if (afterWinWinRate - afterLossWinRate < 0.15) return null;
  return { kind: 'afterLoss', afterLossWinRate: afterLossWinRate * 100, afterWinWinRate: afterWinWinRate * 100 };
}

export function computeOutlierLosses(trades: TradeEntry[]): OutlierLossEntry[] {
  const losses = trades.map(t => ({ t, pnl: computePnL(t) })).filter(x => x.pnl < 0);
  if (losses.length < 5) return [];
  const magnitudes = losses.map(x => Math.abs(x.pnl)).sort((a, b) => a - b);
  const median = magnitudes[Math.floor(magnitudes.length / 2)];
  const outliers: OutlierLossEntry[] = [];
  for (const { t, pnl } of losses) {
    const mult = Math.abs(pnl) / median;
    if (mult > 3) outliers.push({
      tradeId: t.id, date: t.exitDate, symbol: t.symbol,
      loss: pnl, multiplier: mult,
    });
  }
  return outliers.sort((a, b) => b.multiplier - a.multiplier).slice(0, 3);
}
```

**Verify:** Build clean. (Unit-tested via the components that consume it in Task 24.)
**Commit:** `feat(journal): computeInsights pure utility (day-of-week, after-loss, outlier)`

---

### Task 24: `InsightCard` + `OutlierLossList` + wire into Overview

**Files:**
- Create: `src/components/journal/InsightCard.tsx`
- Create: `src/components/journal/OutlierLossList.tsx`
- Modify: `src/components/journal/OverviewTab.tsx`

**Code (InsightCard):**

```tsx
import { Lightbulb, Brain } from 'lucide-react';
import { DayOfWeekInsight, AfterLossInsight } from './computeInsights';

export function InsightCard({ insight }: { insight: DayOfWeekInsight | AfterLossInsight }) {
  if (insight.kind === 'dayOfWeek') return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3">
      <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p>You win <strong>{insight.bestWinRate.toFixed(0)}%</strong> of trades on <strong>{insight.bestDay}s</strong> vs <strong>{insight.worstWinRate.toFixed(0)}%</strong> on <strong>{insight.worstDay}s</strong>.</p>
        <p className="text-muted-foreground mt-1">Worst day: {insight.worstDay} ({insight.worstTradeCount} trades, ${insight.worstPnL.toFixed(0)} P&L). Consider sitting out {insight.worstDay}s.</p>
      </div>
    </div>
  );
  return (
    <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4 flex items-start gap-3">
      <Brain className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p>After a loss, your win rate drops to <strong>{insight.afterLossWinRate.toFixed(0)}%</strong> (vs <strong>{insight.afterWinWinRate.toFixed(0)}%</strong> after a win).</p>
        <p className="text-muted-foreground mt-1">Consider a 1-trade cooldown after losses.</p>
      </div>
    </div>
  );
}
```

**Code (OutlierLossList):**

```tsx
import { Flame } from 'lucide-react';
import { OutlierLossEntry } from './computeInsights';
import { fmtDollar } from '@/components/calculators/calcUtils';

export function OutlierLossList({ outliers, onClick }: { outliers: OutlierLossEntry[]; onClick: (id: string) => void }) {
  if (!outliers.length) return null;
  return (
    <div className="bg-card rounded-lg p-4 shadow">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Flame className="h-4 w-4 text-destructive" /> Outlier losses</h4>
      <ul className="space-y-1.5">
        {outliers.map(o => (
          <li key={o.tradeId}>
            <button onClick={() => onClick(o.tradeId)} className="w-full text-left text-sm hover:bg-muted rounded p-1.5">
              <span className="text-muted-foreground">{o.date}</span> · <strong>{o.symbol}</strong>: <span className="text-destructive">{fmtDollar(o.loss)}</span> <span className="text-xs text-muted-foreground">({o.multiplier.toFixed(1)}× your median loss)</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Wire both into OverviewTab:

```tsx
const dowInsight = useMemo(() => computeDayOfWeekInsight(trades), [trades]);
const afterLossInsight = useMemo(() => computeAfterLossInsight(trades), [trades]);
const outliers = useMemo(() => computeOutlierLosses(trades), [trades]);

// in JSX:
{dowInsight && <InsightCard insight={dowInsight} />}
{afterLossInsight && <InsightCard insight={afterLossInsight} />}
<OutlierLossList outliers={outliers} onClick={openEditTrade} />
```

Need to pass `openEditTrade` callback down from TradeJournal.tsx.

**Verify:** Build clean. Seed enough trades to trigger one insight; verify it renders.
**Commit:** `feat(journal): InsightCard + OutlierLossList + wire to Overview`

---

## Phase H — IBKR import

### Task 25: `IbkrImportDialog`

**Files:**
- Create: `src/components/journal/IbkrImportDialog.tsx`
- Modify: `src/pages/TradeJournal.tsx`

**Code:**

```tsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TradeEntry, TradeSide } from '@/hooks/useTradeJournal';
import { useStatement } from '@/contexts/StatementContext'; // path may differ — search for `useStatement`

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTrades: TradeEntry[];
  onImport: (drafts: Omit<TradeEntry, 'id' | 'createdAt'>[]) => void;
}

export function IbkrImportDialog({ open, onOpenChange, existingTrades, onImport }: Props) {
  const { parsedStatement } = useStatement(); // verify exact API of context
  const closed = parsedStatement?.closedPositions ?? []; // verify field name

  const existingKeys = useMemo(() => new Set(
    existingTrades.map(t => `${t.symbol}|${t.entryDate}|${t.exitDate}|${t.quantity}`)
  ), [existingTrades]);

  const drafts = useMemo(() => closed
    .map((p: any) => ({
      symbol: String(p.symbol),
      side: (Number(p.quantity) >= 0 ? 'long' : 'short') as TradeSide,
      quantity: Math.abs(Number(p.quantity)),
      entryPrice: Number(p.openPrice ?? p.entryPrice),
      exitPrice: Number(p.closePrice ?? p.exitPrice),
      entryDate: String(p.openDate ?? p.entryDate).slice(0, 10),
      exitDate: String(p.closeDate ?? p.exitDate).slice(0, 10),
      fees: Math.abs(Number(p.commissions ?? p.fees ?? 0)),
      notes: '',
      tags: ['Imported'],
    }))
    .filter(d => !existingKeys.has(`${d.symbol}|${d.entryDate}|${d.exitDate}|${d.quantity}`)),
  [closed, existingKeys]);

  const [selected, setSelected] = useState<Set<number>>(new Set(drafts.map((_, i) => i)));

  function toggle(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  }

  function handleImport() {
    const chosen = drafts.filter((_, i) => selected.has(i));
    onImport(chosen);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from IBKR statement</DialogTitle>
        </DialogHeader>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new trades found. Either no IBKR statement is loaded, or all closed positions are already in your journal.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{drafts.length} new trade{drafts.length > 1 ? 's' : ''} detected. {selected.size} selected for import.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border">
                <th></th><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Dates</th>
              </tr></thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td><Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} /></td>
                    <td className="py-1 font-medium">{d.symbol}</td>
                    <td>{d.side}</td>
                    <td>{d.quantity}</td>
                    <td>${d.entryPrice.toFixed(2)}</td>
                    <td>${d.exitPrice.toFixed(2)}</td>
                    <td className="text-xs text-muted-foreground">{d.entryDate} → {d.exitDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={selected.size === 0} onClick={handleImport}>Import {selected.size} trade{selected.size !== 1 ? 's' : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

In TradeJournal.tsx add:
```tsx
const [importOpen, setImportOpen] = useState(false);
const handleImport = (drafts: Omit<TradeEntry, 'id' | 'createdAt'>[]) => {
  drafts.forEach(d => addTrade(d));
  toast.success(`Imported ${drafts.length} trade${drafts.length > 1 ? 's' : ''} from IBKR`);
};

// Add button next to Log Trade:
<Button variant="outline" onClick={() => setImportOpen(true)}>
  <Download className="h-4 w-4 mr-2" /> Import from IBKR
</Button>

// Dialog at bottom of return:
<IbkrImportDialog open={importOpen} onOpenChange={setImportOpen} existingTrades={trades} onImport={handleImport} />
```

**IMPORTANT**: Before implementing, the agent must locate the actual `useStatement()` hook and `closedPositions` field name. Search for `useStatement\|StatementContext\|parsedStatement` in `src/`. Field names may differ — adapt the mapper accordingly. If `closedPositions` doesn't exist, the IBKR adapter at `src/services/parser/adapters/ibkr.ts` is the source of truth for available fields.

**Verify:**
1. Build clean.
2. Manual: import an IBKR statement on the Portfolio page; visit Journal; click Import → see new trades pre-checked. Click Import → trades appear in the table. Open dialog again → 0 new trades (dedup works).

**Commit:** `feat(journal): IBKR auto-import dialog with dedup`

---

## Phase I — Final smoke test

### Task 26: End-to-end smoke test + cleanup

**Files:**
- Modify: any final touch-ups discovered during smoke.

**Smoke checklist:**

1. **Fresh state**: Open Journal with empty localStorage. Empty state renders. Click "Log Trade" → form opens.

2. **Log a trade with all new fields**:
   - Symbol: AAPL, Side: Long, Qty: 100, Entry: $180, Exit: $185, Date: today
   - Stop: $175, Target: $190
   - Setup: "Breakout" (selects from default list)
   - Exit Reason: "Hit target"
   - In Playbook: ON
   - Entry time: 10:30, Exit time: 14:15
   - Mistakes: pick "FOMO"
   - Paste screenshot (any image in clipboard)
   - Save

3. **Verify trade row**: R-multiple shows `+1.0R`, Setup chip shows "Breakout", FOMO red dot, 📷 indicator present.

4. **Stats**: Hero row shows correct P&L, win rate 100%, R-expectancy +1.0R.

5. **Calendar tab**: Today's cell green. Day-of-week heatmap shows today's weekday lit.

6. **Analytics tab**: BySetup shows "Breakout: 1, 100%, +1.0R". BySymbol shows "AAPL: 1, 100%". ByMistake shows FOMO: 1 occurrence, $0 loss (since this trade was a win).

7. **Rules tab**: Set accountSize=$10000, dailyMaxLoss=$500. Goal bar for Today shows $500/0 progress.

8. **Kill-switch**: Log a loss trade $-450 today. Overview banner: amber warning. Log another $-150 → red banner.

9. **Confirmation**: Click Log Trade → confirm dialog appears mentioning kill-switch.

10. **Edit screenshot**: Click 📷 indicator → preview opens. Re-edit the trade → screenshot persists. Click X to remove → screenshot gone, IDB blob deleted.

11. **IBKR Import** (if a statement is loaded): Click Import from IBKR → dialog shows detected trades. Import 1. Re-open dialog → that trade no longer appears (dedup).

12. **Refresh page**: All trades, settings, screenshots persist.

13. **`npm run build`**: clean.

**Commit (if any fixes):** `chore: smoke test fixes for journal Wave 1`

---

## Done criteria for Wave 1

- [ ] All 15 Tier-S features implemented and committed
- [ ] All 6 tabs present and navigable
- [ ] Hero stats row with R-expectancy and streak
- [ ] Trade form has stop/target/setup/mistakes/exit reason/playbook toggle/times/screenshot
- [ ] AI insights gated correctly (don't show on insufficient data)
- [ ] Kill-switch banner appears at 80% and 100% of daily max loss
- [ ] IBKR import detects + dedups closed positions from parsed statement
- [ ] `npm run build` clean
- [ ] All smoke checks pass

---

## Notes for the implementer

- **DRY**: All three IDB stores (trades, settings, screenshots) live in the same `market-pulse-journal` DB. The `openIdb` function in each hook bumps version to 2 and lazily creates missing stores — first hook to run does the migration. Be careful: if user has v1 already with trades, opening at v2 will trigger `onupgradeneeded` exactly once. Test the upgrade path.

- **YAGNI**: No virtualization on tables. No table sort persistence. No URL query persistence beyond filters. No date-range picker library; use two `<input type="date">` if needed.

- **TDD adaptation**: Since the codebase has no test runner, verification = `npm run build` + the per-task smoke check. Pure utility functions in Task 23 are critical — if you have time, add a `computeInsights.test.ts` colocated with the source using Vitest (would require adding it to package.json). Otherwise hand-verify with the seeded trades in Task 26.

- **Frequent commits**: every task ends with a commit. Don't batch tasks into one commit.

- **Field-name verification**: Tasks 25 (IBKR import) and 5 (account size in form) reference fields that may have different names in this codebase. Always `Grep` first.
