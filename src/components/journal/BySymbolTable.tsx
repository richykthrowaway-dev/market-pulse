import { TradeEntry, computePnL, computeR } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function BySymbolTable({ trades }: { trades: TradeEntry[] }) {
  const map = new Map<string, { count: number; wins: number; pnl: number; rSum: number; rCount: number; best: number; worst: number }>();
  for (const t of trades) {
    const row = map.get(t.symbol) ?? { count: 0, wins: 0, pnl: 0, rSum: 0, rCount: 0, best: -Infinity, worst: Infinity };
    const pnl = computePnL(t);
    row.count += 1;
    row.pnl += pnl;
    if (pnl > 0) row.wins += 1;
    if (pnl > row.best) row.best = pnl;
    if (pnl < row.worst) row.worst = pnl;
    const r = computeR(t);
    if (r !== null) { row.rSum += r; row.rCount += 1; }
    map.set(t.symbol, row);
  }
  const rows = [...map.entries()].sort((a, b) => b[1].pnl - a[1].pnl);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-3">By Symbol</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2">Symbol</th>
              <th>Count</th>
              <th>Win Rate</th>
              <th>Avg R</th>
              <th className="text-right">Best</th>
              <th className="text-right">Worst</th>
              <th className="text-right">Total P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([sym, r]) => (
              <tr key={sym} className="border-b border-border/40">
                <td className="py-2 font-mono font-medium">{sym}</td>
                <td>{r.count}</td>
                <td>{((r.wins / r.count) * 100).toFixed(0)}%</td>
                <td>{r.rCount > 0 ? `${(r.rSum / r.rCount).toFixed(2)}R` : '—'}</td>
                <td className="text-right text-green-500">{fmtDollar(r.best === -Infinity ? 0 : r.best)}</td>
                <td className="text-right text-destructive">{fmtDollar(r.worst === Infinity ? 0 : r.worst)}</td>
                <td className={cn('text-right font-semibold', r.pnl >= 0 ? 'text-green-500' : 'text-destructive')}>{fmtDollar(r.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
