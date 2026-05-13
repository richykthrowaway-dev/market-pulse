import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { Card } from '@/components/ui/card';

export function ByMistakeTable({ trades }: { trades: TradeEntry[] }) {
  const map = new Map<string, { count: number; loss: number }>();
  for (const t of trades) {
    if (!t.mistakes?.length) continue;
    const pnl = computePnL(t);
    for (const m of t.mistakes) {
      const row = map.get(m) ?? { count: 0, loss: 0 };
      row.count += 1;
      if (pnl < 0) row.loss += pnl; // accumulate losses as negative
      map.set(m, row);
    }
  }
  const rows = [...map.entries()].sort((a, b) => a[1].loss - b[1].loss); // most negative first

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-3">Cost of Mistakes</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades tagged with mistakes yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2">Mistake</th>
              <th>Occurrences</th>
              <th className="text-right">Total $ Lost</th>
              <th className="text-right">Avg Loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([m, r]) => (
              <tr key={m} className="border-b border-border/40">
                <td className="py-2 font-medium">{m}</td>
                <td>{r.count}</td>
                <td className="text-right text-destructive">{fmtDollar(r.loss)}</td>
                <td className="text-right text-destructive">{r.count > 0 ? fmtDollar(r.loss / r.count) : fmtDollar(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
