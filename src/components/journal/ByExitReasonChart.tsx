import { TradeEntry, ExitReason, computePnL } from '@/hooks/useTradeJournal';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/card';

const REASON_COLORS: Record<ExitReason, string> = {
  target: '#22c55e',       // green
  stop: '#94a3b8',         // slate
  time: '#3b82f6',         // blue
  discretion: '#f59e0b',   // amber
  panic: '#ef4444',        // red
};

const REASON_LABELS: Record<ExitReason, string> = {
  target: 'Hit target',
  stop: 'Stopped out',
  time: 'Time stop',
  discretion: 'Discretionary',
  panic: 'Panic exit',
};

export function ByExitReasonChart({ trades }: { trades: TradeEntry[] }) {
  const tagged = trades.filter(t => !!t.exitReason);

  if (tagged.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Exit Reasons</h3>
        <p className="text-sm text-muted-foreground">Tag your trades with an exit reason to see this breakdown.</p>
      </Card>
    );
  }

  const counts: Record<ExitReason, { count: number; wins: number }> = {
    target: { count: 0, wins: 0 },
    stop: { count: 0, wins: 0 },
    time: { count: 0, wins: 0 },
    discretion: { count: 0, wins: 0 },
    panic: { count: 0, wins: 0 },
  };
  for (const t of tagged) {
    const r = t.exitReason!;
    counts[r].count += 1;
    if (computePnL(t) > 0) counts[r].wins += 1;
  }
  const data = (Object.entries(counts) as [ExitReason, { count: number; wins: number }][])
    .filter(([_, v]) => v.count > 0)
    .map(([k, v]) => ({
      name: REASON_LABELS[k],
      value: v.count,
      winRate: v.count > 0 ? (v.wins / v.count) * 100 : 0,
      color: REASON_COLORS[k],
    }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-3">Exit Reasons</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(entry: any) => `${entry.name}: ${entry.value}`}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(value: number, _name: string, props: any) => {
            const wr = props?.payload?.winRate?.toFixed(0) ?? '0';
            return [`${value} trades (${wr}% win rate)`, props?.payload?.name];
          }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
