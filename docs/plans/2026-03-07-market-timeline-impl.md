# Market Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the basic MarketClocks sidebar widget with an advanced market timeline showing a horizontal 24h bar visualization (one row per market, color-coded, with a "now" needle) and a status table with countdowns.

**Architecture:** Single new component `MarketTimeline.tsx` containing all market data, timezone conversion logic, and rendering. Sidebar.tsx gets simplified (old MarketClocks + utilities removed) and widened from `w-48` to `w-56`. The timeline bar uses CSS absolute positioning within a `relative` container for session segments and the now-needle.

**Tech Stack:** React, Tailwind CSS, `date-fns` (already installed), Lucide icons. No external charting library — pure CSS/div positioning.

---

### Task 1: Create MarketTimeline Component — Data Layer & Timeline Bar

**Files:**
- Create: `src/components/layout/MarketTimeline.tsx`

**Step 1: Create the component with market data, timezone utilities, and timeline bar rendering**

The component contains:
1. `MARKETS` array with name, short name, timezone, open/close hours, and HSL color
2. Utility functions: `getInTz`, `isMarketOpen`, `minsUntilChange`, `fmtCountdown`, `toLocalMins` (converts market hour to user's local minutes-of-day)
3. A `useState`/`useEffect` 1-second timer for live updates
4. The timeline bar: a `relative` container with 24h axis ticks (00, 06, 12, 18, 24), 5 stacked rows (one per market), each with an absolutely-positioned colored segment for the open session, and a vertical "now" needle

```tsx
// src/components/layout/MarketTimeline.tsx
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

/* ── Market definitions ─────────────────────────────────────────── */
const MARKETS = [
  { name: 'Sydney',    short: 'SYD', tz: 'Australia/Sydney',   open: [10, 0],  close: [16, 0],  color: 'hsl(200, 80%, 55%)' },
  { name: 'Tokyo',     short: 'TYO', tz: 'Asia/Tokyo',         open: [9, 0],   close: [15, 30], color: 'hsl(175, 80%, 50%)' },
  { name: 'Hong Kong', short: 'HK',  tz: 'Asia/Hong_Kong',     open: [9, 30],  close: [16, 0],  color: 'hsl(45, 90%, 55%)'  },
  { name: 'London',    short: 'LON', tz: 'Europe/London',      open: [8, 0],   close: [16, 30], color: 'hsl(270, 70%, 60%)' },
  { name: 'New York',  short: 'NY',  tz: 'America/New_York',   open: [9, 30],  close: [16, 0],  color: 'hsl(145, 70%, 50%)' },
];

/* ── Timezone utilities ─────────────────────────────────────────── */
function getInTz(now: Date, tz: string): Date {
  return new Date(now.toLocaleString('en-US', { timeZone: tz }));
}

function isMarketOpen(now: Date, tz: string, open: number[], close: number[]): boolean {
  const t = getInTz(now, tz);
  const day = t.getDay();
  if (day === 0 || day === 6) return false;
  const mins = t.getHours() * 60 + t.getMinutes();
  return mins >= open[0] * 60 + open[1] && mins < close[0] * 60 + close[1];
}

function minsUntilChange(now: Date, tz: string, open: number[], close: number[]): number {
  const t = getInTz(now, tz);
  const mins = t.getHours() * 60 + t.getMinutes();
  const openMins = open[0] * 60 + open[1];
  const closeMins = close[0] * 60 + close[1];
  if (isMarketOpen(now, tz, open, close)) return closeMins - mins;
  if (mins < openMins) return openMins - mins;
  return openMins + 24 * 60 - mins;
}

function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Convert a market's open/close hour to minutes-of-day in the user's LOCAL timezone.
 * Returns { openMin, closeMin } where both are 0..1439.
 * If closeMin < openMin the session wraps past local midnight.
 */
function toLocalMins(now: Date, tz: string, open: number[], close: number[]) {
  // Build a Date for "today at open" and "today at close" in the market's tz,
  // then read the local hours/minutes.
  const base = getInTz(now, tz); // today in market tz
  const marketOpenDate = new Date(base);
  marketOpenDate.setHours(open[0], open[1], 0, 0);
  const marketCloseDate = new Date(base);
  marketCloseDate.setHours(close[0], close[1], 0, 0);

  // Convert back: these market-tz times → re-interpret in local tz
  // We use the offset difference approach:
  const localNow = now;
  const marketNow = getInTz(now, tz);
  const offsetMs = localNow.getTime() - marketNow.getTime();
  // Note: getInTz gives us a Date whose .getHours() etc reflect the market tz,
  // but its underlying timestamp is shifted. The offset between "real" now and
  // "market-interpreted" now gives us the tz difference.

  const openMins = open[0] * 60 + open[1];
  const closeMins = close[0] * 60 + close[1];

  // Market's current minutes-of-day
  const marketMins = marketNow.getHours() * 60 + marketNow.getMinutes();
  // Local current minutes-of-day
  const localMins = localNow.getHours() * 60 + localNow.getMinutes();
  // Offset in minutes (local - market)
  const diffMins = localMins - marketMins;

  // Shift open/close by the offset
  let localOpen = ((openMins + diffMins) % 1440 + 1440) % 1440;
  let localClose = ((closeMins + diffMins) % 1440 + 1440) % 1440;

  return { openMin: localOpen, closeMin: localClose };
}

/* ── Component ──────────────────────────────────────────────────── */
const TOTAL_MINS = 1440;
const TICKS = [0, 6, 12, 18, 24];
const BAR_H = 5; // px per bar
const BAR_GAP = 2; // px between bars

export function MarketTimeline() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localMins = now.getHours() * 60 + now.getMinutes();
  const needlePct = (localMins / TOTAL_MINS) * 100;

  // Pre-compute bar segments
  const bars = useMemo(() =>
    MARKETS.map(m => {
      const { openMin, closeMin } = toLocalMins(now, m.tz, m.open, m.close);
      const open = isMarketOpen(now, m.tz, m.open, m.close);
      const countdown = minsUntilChange(now, m.tz, m.open, m.close);
      const t = getInTz(now, m.tz);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Compute segments (may wrap past midnight)
      let segments: { left: number; width: number }[];
      if (closeMin > openMin) {
        // Normal: single segment
        segments = [{
          left: (openMin / TOTAL_MINS) * 100,
          width: ((closeMin - openMin) / TOTAL_MINS) * 100,
        }];
      } else {
        // Wraps past midnight: two segments
        segments = [
          { left: (openMin / TOTAL_MINS) * 100, width: ((TOTAL_MINS - openMin) / TOTAL_MINS) * 100 },
          { left: 0, width: (closeMin / TOTAL_MINS) * 100 },
        ];
      }

      return { ...m, open, countdown, timeStr, segments };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(now.getTime() / 1000)], // recompute every second
  );

  const totalBarHeight = MARKETS.length * BAR_H + (MARKETS.length - 1) * BAR_GAP;

  const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const localDate = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="px-2 mt-2">
      <div className="rounded-lg bg-sidebar-accent/40 px-2.5 py-2.5 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-sidebar-foreground uppercase tracking-wide">
            Market Status
          </p>
          <div className="text-right">
            <p className="font-mono text-[10px] font-bold tracking-wide text-sidebar-foreground">{localTime}</p>
            <p className="text-[7px] text-muted-foreground uppercase tracking-wide">{localDate}</p>
          </div>
        </div>

        {/* ── Timeline Bar ───────────────────────────────────── */}
        <div>
          {/* Time axis ticks */}
          <div className="relative h-3 mb-0.5">
            {TICKS.map(h => (
              <span
                key={h}
                className="absolute text-[7px] text-muted-foreground font-mono -translate-x-1/2"
                style={{ left: `${(h / 24) * 100}%` }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>

          {/* Bars + needle container */}
          <div className="relative" style={{ height: totalBarHeight }}>
            {/* Bars */}
            {bars.map((m, i) => {
              const top = i * (BAR_H + BAR_GAP);
              return (
                <div key={m.name}>
                  {/* Full-width faint background bar */}
                  <div
                    className="absolute left-0 right-0 rounded-full"
                    style={{
                      top,
                      height: BAR_H,
                      backgroundColor: m.color,
                      opacity: 0.1,
                    }}
                  />
                  {/* Active session segment(s) */}
                  {m.segments.map((seg, si) => (
                    <div
                      key={si}
                      className="absolute rounded-full"
                      style={{
                        top,
                        height: BAR_H,
                        left: `${seg.left}%`,
                        width: `${seg.width}%`,
                        backgroundColor: m.color,
                        opacity: 0.8,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Now needle */}
            <div
              className="absolute top-0 w-px"
              style={{
                left: `${needlePct}%`,
                height: totalBarHeight,
                backgroundColor: 'white',
                boxShadow: '0 0 4px rgba(255,255,255,0.6)',
              }}
            />
          </div>

          {/* Market labels row (below bars) */}
          <div className="relative h-3 mt-0.5">
            {bars.map((m, i) => {
              // Position label at center of first segment
              const seg = m.segments[0];
              const centerPct = seg.left + seg.width / 2;
              return (
                <span
                  key={m.name}
                  className="absolute text-[6px] font-medium -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${centerPct}%`, color: m.color }}
                >
                  {m.short}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Market Table ────────────────────────────────────── */}
        <div className="space-y-1 pt-0.5 border-t border-sidebar-border/50">
          {[...bars]
            .sort((a, b) => (a.open === b.open ? 0 : a.open ? -1 : 1))
            .map(m => (
              <div key={m.name} className="flex items-center gap-1.5 text-[9px]">
                {/* Status dot */}
                <span
                  className="shrink-0 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: m.open ? m.color : undefined }}
                  className={cn(
                    "shrink-0 h-1.5 w-1.5 rounded-full",
                    !m.open && "bg-muted-foreground/30"
                  )}
                  // Use inline style for open color, class for closed
                />
                {/* Market name */}
                <span className="font-medium min-w-0 truncate flex-1" style={m.open ? { color: m.color } : undefined}>
                  {m.name}
                </span>
                {/* Local time */}
                <span className="font-mono text-muted-foreground shrink-0">{m.timeStr}</span>
                {/* Countdown */}
                <span className={cn(
                  "shrink-0 text-[8px] tabular-nums",
                  m.open ? "text-green-400" : "text-muted-foreground"
                )}>
                  {m.open ? `${fmtCountdown(m.countdown)}` : `in ${fmtCountdown(m.countdown)}`}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
```

**IMPORTANT:** The JSX above has a bug — the status dot uses `className` twice. The correct implementation should merge inline style and className properly. Fix during implementation:

```tsx
<span
  className={cn(
    "shrink-0 h-1.5 w-1.5 rounded-full",
    !m.open && "bg-muted-foreground/30"
  )}
  style={m.open ? { backgroundColor: m.color } : undefined}
/>
```

**Step 2: Verify the file compiles**

Run: `cd C:/Users/PC/Downloads/market-pulse && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to MarketTimeline.tsx

**Step 3: Commit**

```bash
git add src/components/layout/MarketTimeline.tsx
git commit -m "feat: add MarketTimeline component with 24h bar visualization"
```

---

### Task 2: Wire MarketTimeline into Sidebar, Widen Sidebar, Remove MarketClocks

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Replace MarketClocks with MarketTimeline**

Apply these changes to `Sidebar.tsx`:

1. **Remove** the `useState, useEffect` import (lines 2) — only if no longer needed. Check: `useState` and `useEffect` are only used by `MarketClocks`. After removal they're unused. Remove them from the import.

2. **Remove** all market-related code that lived in Sidebar (lines 24-123):
   - `MARKETS` array
   - `getInTz()` function
   - `isMarketOpen()` function
   - `minsUntilChange()` function
   - `fmtCountdown()` function
   - `MarketClocks()` component

3. **Add import** at the top:
   ```tsx
   import { MarketTimeline } from '@/components/layout/MarketTimeline';
   ```

4. **Change sidebar width** (line 151):
   ```tsx
   // Before:
   isCollapsed ? "w-16" : "w-48",
   // After:
   isCollapsed ? "w-16" : "w-56",
   ```

5. **Replace the MarketClocks usage** (line 202):
   ```tsx
   // Before:
   {!isCollapsed && <MarketClocks />}
   // After:
   {!isCollapsed && <MarketTimeline />}
   ```

6. **Update portfolio card maxWidth** (line 206) to match new sidebar width:
   ```tsx
   // Before:
   style={{ maxWidth: '12rem' }}
   // After:
   style={{ maxWidth: '14rem' }}
   ```
   (14rem = 224px = w-56)

**Step 2: Verify build**

Run: `cd C:/Users/PC/Downloads/market-pulse && npm run build 2>&1 | tail -15`
Expected: Build succeeds, no TS errors.

**Step 3: Visual check**

Run the dev server and navigate to the Portfolio page. Verify:
- Sidebar is wider (224px)
- Market timeline shows 5 colored bars with a now needle
- Market table below shows open/closed status with countdowns
- Portfolio file card still truncates properly with X button visible
- Nav items still render correctly
- Collapsed sidebar still works at w-16

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: wire MarketTimeline into sidebar, widen to w-56, remove old MarketClocks"
```

---

### Task 3: Polish & Edge Cases

**Files:**
- Modify: `src/components/layout/MarketTimeline.tsx`

**Step 1: Handle weekend display**

On weekends, all markets are closed. The countdown should show time until Monday open. The current `minsUntilChange` doesn't account for weekends (it only adds 24h for "next day"). Update to handle Saturday/Sunday:

```tsx
function minsUntilChange(now: Date, tz: string, open: number[], close: number[]): number {
  const t = getInTz(now, tz);
  const day = t.getDay();
  const mins = t.getHours() * 60 + t.getMinutes();
  const openMins = open[0] * 60 + open[1];
  const closeMins = close[0] * 60 + close[1];

  // If market is open right now
  if (day >= 1 && day <= 5 && mins >= openMins && mins < closeMins) {
    return closeMins - mins;
  }

  // Calculate minutes until next open
  let daysUntilOpen = 0;
  if (day === 6) daysUntilOpen = 2; // Saturday → Monday
  else if (day === 0) daysUntilOpen = 1; // Sunday → Monday
  else if (mins >= closeMins) {
    // After close on weekday
    daysUntilOpen = day === 5 ? 3 : 1; // Friday after close → Monday, else next day
  }
  // else: before open on a weekday, daysUntilOpen = 0

  return daysUntilOpen * 1440 + (openMins - mins + 1440) % 1440;
}
```

**Step 2: Ensure collapsed sidebar hides the timeline cleanly**

Already handled by `{!isCollapsed && <MarketTimeline />}` — just verify visually.

**Step 3: Verify build**

Run: `cd C:/Users/PC/Downloads/market-pulse && npm run build 2>&1 | tail -10`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/components/layout/MarketTimeline.tsx
git commit -m "fix: handle weekend countdown in market timeline"
```
