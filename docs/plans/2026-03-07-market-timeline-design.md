# Market Timeline Sidebar Visualization

## Overview

Replace the current `MarketClocks` component (three separate small cards showing NYSE status, local time, and a market list) with a richer single-card visualization featuring a horizontal 24-hour timeline bar and a compact market status table.

## Constraints

- Must fit within the sidebar. Sidebar width increases from `w-48` (192px) to `w-56` (224px).
- Collapsed sidebar stays at `w-16`.
- Time axis uses the user's **local timezone**, not UTC.

## Layout

```
┌──────────────────────────────────┐
│ MARKET STATUS                    │
│                                  │
│  00   06   12   18   24          │
│  ├────┼────┼────┼────┤           │
│  Sydney  ██████████░░░░░░░░░░░   │
│  Tokyo   ██████████████░░░░░░░   │
│  London  ░░░░░████████████░░░░   │
│  HK      ░░░░░░░░░░░████████░   │
│  NY      ████████░░░░░░░░░░░░   │
│          ▏ ← now needle          │
│                                  │
│  Sydney    10:20  ● Open   4h 2m │
│  Tokyo     07:20  ● Open   1h 2m │
│  London    10:20  ○ Closed  in 2h│
│  Hong Kong 06:20  ○ Closed  in 3h│
│  New York  22:20  ○ Closed  in 6h│
└──────────────────────────────────┘
```

### Top: Timeline Bar

- 5 horizontal bars stacked vertically (one per market), each ~5px tall with 2px gaps
- Each bar spans 0h→24h in the user's local timezone
- Filled portion = open session hours (solid color at 80% opacity)
- Non-session hours = same color at 10% opacity
- Bars have rounded ends (`rounded-full`)
- Market name labels (7px font) to the left of each bar
- Tick labels: 00, 06, 12, 18, 24 above the bars (7px muted text)

### Now Needle

- 1px white vertical line spanning full height of the bar stack
- Subtle glow: `box-shadow: 0 0 4px rgba(255,255,255,0.5)`

### Bottom: Market Table

- Compact rows: market name + local time, status dot, countdown
- Green dot (●) when open, muted gray (○) when closed
- Countdown: "Closes 4h 2m" / "Opens 2h 15m"
- Open markets listed first

## Color Scheme

| Market    | Color                        |
|-----------|------------------------------|
| Sydney    | `hsl(200, 80%, 55%)` — blue  |
| Tokyo     | `hsl(175, 80%, 50%)` — teal  |
| London    | `hsl(270, 70%, 60%)` — purple|
| Hong Kong | `hsl(45, 90%, 55%)` — amber  |
| New York  | `hsl(145, 70%, 50%)` — green |

## Bar Positioning (Local Time)

For each market, convert open/close hours from the market's timezone to the user's local timezone:
- `left: (localOpenMins / 1440) * 100%`
- `width: (durationMins / 1440) * 100%`
- If session wraps past local midnight (close < open in local time), render two segments

Now needle: `left: (currentLocalMins / 1440) * 100%`

## Files

| Action | File | Change |
|--------|------|--------|
| Create | `src/components/layout/MarketTimeline.tsx` | New component with timeline bar + market table |
| Modify | `src/components/layout/Sidebar.tsx` | Replace `MarketClocks` with `MarketTimeline`, change `w-48` → `w-56`, remove old utilities |

## Update Interval

Same 1-second `setInterval` as current `MarketClocks` — ensures the needle and countdowns update in real time.
