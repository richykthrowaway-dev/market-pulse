import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export function HourOfDayHeatmap({ trades }: { trades: TradeEntry[] }) {
  const withTime = trades.filter(t => !!t.entryTime);

  if (withTime.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-medium mb-2">By hour of day</h4>
        <p className="text-xs text-muted-foreground">No trades have an entry time set. Add entry times to see the hour-of-day heatmap.</p>
      </div>
    );
  }

  const buckets: Record<number, { pnl: number; count: number; wins: number }> = {};
  for (const h of HOURS) buckets[h] = { pnl: 0, count: 0, wins: 0 };
  // off-hours bucket for hours outside the 9-17 window
  let offHours = { pnl: 0, count: 0, wins: 0 };

  for (const t of withTime) {
    const h = parseInt(t.entryTime!.slice(0, 2), 10);
    if (Number.isNaN(h)) continue;
    const pnl = computePnL(t);
    const bucket = HOURS.includes(h) ? buckets[h] : offHours;
    bucket.pnl += pnl;
    bucket.count += 1;
    if (pnl > 0) bucket.wins += 1;
  }

  const values = HOURS.map(h => buckets[h]);
  const max = Math.max(...values.map(b => Math.abs(b.pnl)), 1);

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">By hour of day (market hours)</h4>
      <div className="grid grid-cols-9 gap-1.5">
        {HOURS.map(h => {
          const b = buckets[h];
          const intensity = Math.abs(b.pnl) / max;
          const color = b.pnl > 0 ? `rgba(34,197,94,${0.15 + intensity * 0.55})` : b.pnl < 0 ? `rgba(239,68,68,${0.15 + intensity * 0.55})` : 'transparent';
          const winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
          return (
            <div
              key={h}
              className="text-center p-2 rounded border border-border"
              style={{ backgroundColor: color }}
              title={`${h}:00 — ${b.count} trades, ${winRate.toFixed(0)}% win rate, $${b.pnl.toFixed(0)} P&L`}
            >
              <div className="text-xs font-medium">{h}:00</div>
              <div className="text-xs text-muted-foreground mt-0.5">{b.count}</div>
            </div>
          );
        })}
      </div>
      {offHours.count > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {offHours.count} trade{offHours.count > 1 ? 's' : ''} outside market hours · ${offHours.pnl.toFixed(0)} P&L
        </p>
      )}
    </div>
  );
}
