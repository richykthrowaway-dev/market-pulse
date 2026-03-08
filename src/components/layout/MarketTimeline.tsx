import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  MARKETS definition                                                 */
/* ------------------------------------------------------------------ */

interface Market {
  name: string;
  short: string;
  tz: string;
  open: [number, number];   // [hour, minute] in local tz
  close: [number, number];
  color: string;            // HSL string
}

const MARKETS: Market[] = [
  { name: "Sydney",    short: "SYD", tz: "Australia/Sydney",   open: [10, 0],  close: [16, 0],  color: "hsl(200, 80%, 55%)" },
  { name: "Tokyo",     short: "TYO", tz: "Asia/Tokyo",         open: [9, 0],   close: [15, 30], color: "hsl(175, 80%, 50%)" },
  { name: "Hong Kong", short: "HK",  tz: "Asia/Hong_Kong",     open: [9, 30],  close: [16, 0],  color: "hsl(45, 90%, 55%)" },
  { name: "London",    short: "LON", tz: "Europe/London",       open: [8, 0],   close: [16, 30], color: "hsl(270, 70%, 60%)" },
  { name: "New York",  short: "NY",  tz: "America/New_York",    open: [9, 30],  close: [16, 0],  color: "hsl(145, 70%, 50%)" },
];

/* ------------------------------------------------------------------ */
/*  Timezone utilities                                                 */
/* ------------------------------------------------------------------ */

/** Get a Date object representing the wall-clock time in a timezone */
function getInTz(now: Date, tz: string): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: tz }));
}

/** Is the market currently open? (weekdays only, within session hours) */
function isMarketOpen(now: Date, tz: string, open: [number, number], close: [number, number]): boolean {
  const t = getInTz(now, tz);
  const day = t.getDay();
  if (day === 0 || day === 6) return false;
  const mins = t.getHours() * 60 + t.getMinutes();
  return mins >= open[0] * 60 + open[1] && mins < close[0] * 60 + close[1];
}

/** Minutes until the market opens or closes (weekend-aware) */
function minsUntilChange(now: Date, tz: string, open: [number, number], close: [number, number]): number {
  const t = getInTz(now, tz);
  const day = t.getDay();
  const mins = t.getHours() * 60 + t.getMinutes();
  const openMins = open[0] * 60 + open[1];
  const closeMins = close[0] * 60 + close[1];

  // If market is currently open, return time until close
  if (day >= 1 && day <= 5 && mins >= openMins && mins < closeMins) {
    return closeMins - mins;
  }

  // How many calendar days to skip to reach the next trading day
  let daysToAdd: number;
  if (day === 6) daysToAdd = 2;                          // Saturday → Monday
  else if (day === 0) daysToAdd = 1;                     // Sunday → Monday
  else if (day === 5 && mins >= closeMins) daysToAdd = 3; // Friday after close → Monday
  else if (mins >= openMins) daysToAdd = 1;               // Weekday after close → next day
  else daysToAdd = 0;                                     // Weekday before open → today

  // Same-day case: simple subtraction
  if (daysToAdd === 0) return openMins - mins;

  // Multi-day: minutes remaining today + (daysToAdd-1) full days + openMins into target day
  return (1440 - mins) + (daysToAdd - 1) * 1440 + openMins;
}

/** Format a minute count as "Xh Ym" */
function fmtCountdown(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Convert a market's open/close hours into the user's local-timezone
 * minutes-of-day (0-1439).
 *
 * Approach: compare minutes-of-day in the market tz vs the local tz
 * to derive the offset, then shift open/close by that offset.
 */
function toLocalMins(
  now: Date,
  tz: string,
  hour: number,
  minute: number,
): number {
  const marketNow = getInTz(now, tz);
  const localNow = now;

  const marketMins = marketNow.getHours() * 60 + marketNow.getMinutes();
  const localMins = localNow.getHours() * 60 + localNow.getMinutes();

  const offset = localMins - marketMins; // positive = local is ahead
  const target = hour * 60 + minute + offset;
  return ((target % 1440) + 1440) % 1440; // wrap into 0-1439
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MarketTimeline() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const localTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const localDate = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Current local minutes-of-day for the "now" needle
  const localNowMins = now.getHours() * 60 + now.getMinutes();
  const nowPct = (localNowMins / 1440) * 100;

  // Pre-compute market data for both the bar and the table
  const marketData = MARKETS.map((m) => {
    const open = isMarketOpen(now, m.tz, m.open, m.close);
    const countdown = minsUntilChange(now, m.tz, m.open, m.close);
    const openMin = toLocalMins(now, m.tz, m.open[0], m.open[1]);
    const closeMin = toLocalMins(now, m.tz, m.close[0], m.close[1]);
    const t = getInTz(now, m.tz);
    const timeStr = t.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { ...m, open: open, countdown, openMin, closeMin, timeStr };
  });

  // Sort for the table: open markets first
  const sortedForTable = [...marketData].sort((a, b) => {
    if (a.open === b.open) return 0;
    return a.open ? -1 : 1;
  });

  return (
    <div className="px-2 mt-2">
      {/* Header: title + local time */}
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground">
          Market Status
        </p>
        <div className="text-right">
          <p className="font-mono text-[10px] font-bold leading-tight">
            {localTime}
          </p>
          <p className="text-[7px] text-muted-foreground leading-tight">
            {localDate}
          </p>
        </div>
      </div>

      {/* Unified market rows: dot + name + bar + countdown */}
      <div className="space-y-1.5">
        {sortedForTable.map((m) => {
          const wraps = m.closeMin < m.openMin;
          const segments: { left: number; width: number }[] = [];
          if (wraps) {
            segments.push({
              left: (m.openMin / 1440) * 100,
              width: ((1440 - m.openMin) / 1440) * 100,
            });
            segments.push({
              left: 0,
              width: (m.closeMin / 1440) * 100,
            });
          } else {
            segments.push({
              left: (m.openMin / 1440) * 100,
              width: ((m.closeMin - m.openMin) / 1440) * 100,
            });
          }

          return (
            <div key={m.name} className="flex items-center gap-1.5 text-[9px] leading-tight">
              {/* Status dot */}
              <span
                className={cn(
                  "shrink-0 h-1.5 w-1.5 rounded-full",
                  !m.open && "bg-muted-foreground/30",
                )}
                style={m.open ? { backgroundColor: m.color } : undefined}
              />
              {/* Market name */}
              <span className="w-[3.2rem] shrink-0 font-medium truncate">{m.name}</span>
              {/* Timeline bar */}
              <div className="relative flex-1 h-[5px]">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: m.color, opacity: 0.1 }}
                />
                {segments.map((seg, si) => (
                  <div
                    key={si}
                    className="absolute top-0 bottom-0 rounded-full transition-opacity duration-500"
                    style={{
                      left: `${seg.left}%`,
                      width: `${seg.width}%`,
                      backgroundColor: m.color,
                      opacity: m.open ? 0.8 : 0.15,
                    }}
                  />
                ))}
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    left: `${nowPct}%`,
                    backgroundColor: "rgba(255,255,255,0.9)",
                    boxShadow: "0 0 4px rgba(255,255,255,0.5)",
                  }}
                />
              </div>
              {/* Countdown */}
              <span
                className={cn(
                  "shrink-0 tabular-nums text-[8px]",
                  m.open ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {fmtCountdown(m.countdown)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
