// src/components/calculators/trading/DrawdownRecovery.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar } from '../calcUtils';
import { cn } from '@/lib/utils';

export function DrawdownRecovery() {
  const [drawdownPct, setDrawdownPct] = useState(20);
  const [startCapital, setStartCapital] = useState(100_000);
  const [annualReturn, setAnnualReturn] = useState(8);

  const r = useMemo(() => {
    const dd = Math.min(Math.max(drawdownPct, 0.01), 99.99);
    const ddFrac = dd / 100;
    const lossDollar = startCapital * ddFrac;
    const remaining = startCapital - lossDollar;
    const gainNeededPct = (dd / (1 - ddFrac));
    const monthlyRate = (annualReturn / 100) / 12;
    let monthsToRecover = NaN;
    if (annualReturn > 0 && monthlyRate > 0) {
      monthsToRecover = Math.log(1 / (1 - ddFrac)) / Math.log(1 + monthlyRate);
    }
    const yearsToRecover = monthsToRecover / 12;
    return {
      lossDollar, remaining, gainNeededPct, monthsToRecover, yearsToRecover, dd,
    };
  }, [drawdownPct, startCapital, annualReturn]);

  const chartData = [
    { name: 'Drawdown size', value: r.dd, fill: 'hsl(var(--destructive))' },
    { name: 'Gain needed', value: r.gainNeededPct, fill: '#f59e0b' },
  ];

  const tableRows = [10, 20, 30, 40, 50, 60, 70, 80, 90].map(d => ({
    dd: d,
    needed: d / (1 - d / 100),
  }));

  const currentBucket = Math.round(r.dd / 10) * 10;

  return (
    <CalculatorShell
      title="Drawdown & Recovery"
      description="Losses and gains are not symmetric — see how steep the climb back is."
      inputs={
        <>
          <NumInput
            label="Drawdown"
            value={drawdownPct}
            onChange={setDrawdownPct}
            min={1}
            max={90}
            step={1}
            suffix="%"
            help="The peak-to-trough decline"
          />
          <NumInput
            label="Starting Capital"
            value={startCapital}
            onChange={setStartCapital}
            min={0}
            step={1000}
            prefix="$"
          />
          <NumInput
            label="Expected Annual Return"
            value={annualReturn}
            onChange={setAnnualReturn}
            min={0}
            max={100}
            step={0.5}
            suffix="%"
            help="Used to estimate recovery time"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="Loss"
              value={`-${fmtDollar(r.lossDollar)}`}
              sub={`${r.dd.toFixed(1)}% of capital`}
              highlight="negative"
            />
            <StatBox
              label="Remaining"
              value={fmtDollar(r.remaining)}
              sub="After drawdown"
            />
            <StatBox
              label="Gain Needed"
              value={`+${r.gainNeededPct.toFixed(1)}%`}
              sub="Just to break even"
              highlight={r.gainNeededPct > 50 ? 'warning' : undefined}
            />
            <StatBox
              label="Years to Recover"
              value={
                isFinite(r.yearsToRecover) && r.yearsToRecover > 0
                  ? r.yearsToRecover.toFixed(1)
                  : '—'
              }
              sub={`At ${annualReturn.toFixed(1)}% / yr`}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Asymmetry of Loss vs Gain</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-6">
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                        style={{ fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recovery Table</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase">
                      <th className="text-left py-2 font-medium">Drawdown</th>
                      <th className="text-right py-2 font-medium">Gain needed to recover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(row => {
                      const isCurrent = row.dd === currentBucket;
                      return (
                        <tr
                          key={row.dd}
                          className={cn(
                            'border-b last:border-b-0',
                            isCurrent && 'bg-amber-500/10 font-semibold',
                          )}
                        >
                          <td className="py-1.5">−{row.dd}%</td>
                          <td className="py-1.5 text-right">+{row.needed.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            A <strong className="text-foreground">{r.dd.toFixed(0)}%</strong> loss requires a{' '}
            <strong className="text-foreground">{r.gainNeededPct.toFixed(0)}%</strong> gain just to
            break even. This asymmetry is why position sizing matters.
          </Callout>
        </>
      }
    />
  );
}
