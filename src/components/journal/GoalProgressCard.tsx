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

  // No goals configured — show a single CTA instead of 3 "(no goal set)" rows
  if (!anyTarget) {
    if (trades.length === 0) return null;
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">No goals set</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set daily, weekly and monthly targets to track your progress here.
            </p>
          </div>
          <a
            href="#rules"
            onClick={e => {
              e.preventDefault();
              // best-effort: click the Rules tab trigger if it's in the DOM
              const el = document.querySelector<HTMLButtonElement>('[data-value="rules"]');
              el?.click();
            }}
            className="text-xs text-primary underline underline-offset-2 whitespace-nowrap ml-4"
          >
            Configure in Rules →
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Goal progress</h3>
      <div className="space-y-3">
        {rows.map(r => {
          if (!r.target) return null;
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
