import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { Card } from '@/components/ui/card';

function sumPnL(trades: TradeEntry[], startDate: string): number {
  return trades.filter(t => t.exitDate >= startDate).reduce((s, t) => s + computePnL(t), 0);
}

export function GoalProgressCard({ trades, settings }: { trades: TradeEntry[]; settings: JournalSettings }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Sunday start
    return d.toISOString().slice(0, 10);
  })();
  const monthStart = today.slice(0, 8) + '01';

  const dayPnL = sumPnL(trades, today);
  const weekPnL = sumPnL(trades, weekStart);
  const monthPnL = sumPnL(trades, monthStart);

  const rows = [
    { label: 'Today', pnl: dayPnL, target: settings.goals.daily },
    { label: 'This week', pnl: weekPnL, target: settings.goals.weekly },
    { label: 'This month', pnl: monthPnL, target: settings.goals.monthly },
  ];

  const anyTarget = rows.some(r => r.target);
  if (!anyTarget && trades.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Goal progress</h3>
      <div className="space-y-3">
        {rows.map(r => {
          if (!r.target) return (
            <div key={r.label} className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span className={r.pnl >= 0 ? 'text-muted-foreground' : 'text-destructive'}>
                {fmtDollar(r.pnl)} <span className="text-xs">(no goal set)</span>
              </span>
            </div>
          );
          const pct = Math.max(0, Math.min(100, (r.pnl / r.target) * 100));
          const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-muted-foreground/40';
          return (
            <div key={r.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{r.label}</span>
                <span className={r.pnl >= 0 ? '' : 'text-destructive'}>
                  {fmtDollar(r.pnl)} / {fmtDollar(r.target)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
