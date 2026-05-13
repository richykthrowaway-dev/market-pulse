import { TradeEntry, computePnL, computeR } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-3">By Setup</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades tagged yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2">Setup</th>
              <th>Count</th>
              <th>Win Rate</th>
              <th>Avg R</th>
              <th className="text-right">Total P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([s, r]) => (
              <tr key={s} className="border-b border-border/40">
                <td className="py-2 font-medium">{s}</td>
                <td>{r.count}</td>
                <td>{((r.wins / r.count) * 100).toFixed(0)}%</td>
                <td>{r.rCount > 0 ? `${(r.rSum / r.rCount).toFixed(2)}R` : '—'}</td>
                <td className={cn('text-right', r.pnl >= 0 ? 'text-green-500' : 'text-destructive')}>{fmtDollar(r.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
