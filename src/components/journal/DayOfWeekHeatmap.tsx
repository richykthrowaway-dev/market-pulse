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
          const color = b.pnl > 0 ? `rgba(34,197,94,${0.15 + intensity * 0.55})` : b.pnl < 0 ? `rgba(239,68,68,${0.15 + intensity * 0.55})` : 'transparent';
          const winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
          return (
            <div
              key={label}
              className="text-center p-2 rounded border border-border"
              style={{ backgroundColor: color }}
              title={`${label}: ${b.count} trades, ${winRate.toFixed(0)}% win rate, $${b.pnl.toFixed(0)} P&L`}
            >
              <div className="text-xs font-medium">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{b.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
