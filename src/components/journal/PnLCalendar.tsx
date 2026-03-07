import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayPnL } from '@/hooks/useTradeJournal';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fmtPnL(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}k`
    : `$${abs.toFixed(0)}`;
  return v < 0 ? `-${s}` : `+${s}`;
}

function pnlCellClass(pnl: number): string {
  const abs = Math.abs(pnl);
  if (pnl > 0) {
    if (abs > 500) return 'bg-green-500/25';
    if (abs > 100) return 'bg-green-500/15';
    return 'bg-green-500/8';
  }
  if (pnl < 0) {
    if (abs > 500) return 'bg-red-500/25';
    if (abs > 100) return 'bg-red-500/15';
    return 'bg-red-500/8';
  }
  return '';
}

interface PnLCalendarProps {
  dailyPnL: Map<string, DayPnL>;
  onDayClick?: (date: string) => void;
}

export function PnLCalendar({ dailyPnL, onDayClick }: PnLCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const numDays = daysInMonth(year, month);
  const startDay = startDayOfWeek(year, month);

  // Build grid cells
  const cells: Array<{ day: number; dateStr: string; inMonth: boolean }> = [];

  // Leading empty cells
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: 0, dateStr: '', inMonth: false });
  }
  // Actual days
  for (let d = 1; d <= numDays; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d), inMonth: true });
  }
  // Trailing empty cells to fill last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, dateStr: '', inMonth: false });
  }

  // Monthly totals
  let monthPnL = 0;
  let monthTrades = 0;
  for (let d = 1; d <= numDays; d++) {
    const entry = dailyPnL.get(toDateStr(year, month, d));
    if (entry) {
      monthPnL += entry.pnl;
      monthTrades += entry.count;
    }
  }

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[180px] text-center">
            {MONTH_NAMES[month]} {year}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border/40 rounded-md overflow-hidden">
        {cells.map((cell, i) => {
          if (!cell.inMonth) {
            return <div key={i} className="bg-card/50 min-h-[70px]" />;
          }
          const entry = dailyPnL.get(cell.dateStr);
          const isToday = cell.dateStr === toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
          return (
            <div
              key={i}
              className={cn(
                'bg-card min-h-[70px] p-1.5 transition-colors relative',
                entry ? 'cursor-pointer hover:brightness-110' : '',
                entry ? pnlCellClass(entry.pnl) : '',
              )}
              onClick={() => entry && onDayClick?.(cell.dateStr)}
            >
              <span className={cn(
                'text-xs font-medium',
                isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center' : 'text-muted-foreground',
              )}>
                {cell.day}
              </span>
              {entry && (
                <div className="mt-1">
                  <p className={cn(
                    'text-xs font-bold',
                    entry.pnl >= 0 ? 'text-green-500' : 'text-red-500',
                  )}>
                    {fmtPnL(entry.pnl)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {entry.count} trade{entry.count > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly summary */}
      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-sm text-muted-foreground">
          {monthTrades > 0
            ? `${monthTrades} trade${monthTrades > 1 ? 's' : ''} this month`
            : 'No trades this month'}
        </p>
        {monthTrades > 0 && (
          <p className={cn('text-sm font-bold', monthPnL >= 0 ? 'text-green-500' : 'text-red-500')}>
            Net: {monthPnL >= 0 ? '+' : ''}{monthPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
        )}
      </div>
    </div>
  );
}
