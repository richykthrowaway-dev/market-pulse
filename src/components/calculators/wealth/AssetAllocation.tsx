// src/components/calculators/wealth/AssetAllocation.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { StatBox } from '../StatBox';
import { fmtDollar, fmtCompact } from '../calcUtils';
import { cn } from '@/lib/utils';

interface Row {
  name: string;
  target: number;
  current: number;
}

const DEFAULTS: Row[] = [
  { name: 'Stocks', target: 60, current: 60_000 },
  { name: 'Bonds',  target: 20, current: 20_000 },
  { name: 'REITs',  target: 10, current: 10_000 },
  { name: 'Cash',   target: 5,  current: 5_000  },
  { name: 'Crypto', target: 5,  current: 5_000  },
];

export function AssetAllocation() {
  const [rows, setRows] = useState<Row[]>(DEFAULTS);

  const update = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const reset = () => setRows(DEFAULTS);

  const r = useMemo(() => {
    const total = rows.reduce((s, x) => s + (x.current || 0), 0);
    const targetSum = rows.reduce((s, x) => s + (x.target || 0), 0);

    const computed = rows.map(row => {
      const currentPct  = total > 0 ? (row.current / total) * 100 : 0;
      const targetDollar = total * (row.target / 100);
      const drift       = currentPct - row.target;
      const action      = targetDollar - row.current; // + = buy, - = sell
      return { ...row, currentPct, targetDollar, drift, action };
    });

    const largestDrift = [...computed].sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];

    const buys  = computed.filter(c => c.action > 0.5);
    const sells = computed.filter(c => c.action < -0.5);

    return {
      total,
      targetSum,
      rows: computed,
      largestDrift,
      buys,
      sells,
    };
  }, [rows]);

  const targetsValid = Math.abs(r.targetSum - 100) < 0.01;

  const chartData = r.rows.map(row => ({
    name: row.name,
    current: Number(row.currentPct.toFixed(2)),
    target:  row.target,
  }));

  const driftClass = (d: number) => {
    const abs = Math.abs(d);
    if (abs > 10) return 'text-destructive font-semibold';
    if (abs > 5)  return 'text-amber-500 font-medium';
    return 'text-muted-foreground';
  };

  const actionClass = (a: number) => {
    if (a > 0.5)  return 'text-green-500 font-medium';
    if (a < -0.5) return 'text-destructive font-medium';
    return 'text-muted-foreground';
  };

  const actionLabel = (a: number) => {
    if (a > 0.5)  return `Buy ${fmtDollar(a)}`;
    if (a < -0.5) return `Sell ${fmtDollar(Math.abs(a))}`;
    return '—';
  };

  const buildActionText = (): string => {
    const parts: string[] = [];
    r.sells.forEach(s => parts.push(`Sell ${fmtDollar(Math.abs(s.action))} of ${s.name}`));
    r.buys.forEach(b  => parts.push(`Buy ${fmtDollar(b.action)} of ${b.name}`));
    if (parts.length === 0) return 'Your portfolio is on target — no rebalancing needed.';
    return parts.join(' and ') + ' to rebalance.';
  };

  return (
    <CalculatorShell
      title="Asset Allocation Rebalancer"
      description="Compare current vs target allocation and see exactly what to buy or sell."
      inputs={
        <>
          {rows.map((row, i) => (
            <div key={i} className="space-y-1.5 pb-3 border-b last:border-b-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Asset {i + 1}
              </Label>
              <Input
                value={row.name}
                onChange={e => update(i, { name: e.target.value })}
                className="h-8 text-sm"
                placeholder="Asset name"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Input
                    type="number"
                    value={row.target}
                    onChange={e => update(i, { target: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm pr-7"
                    placeholder="Target"
                    min={0}
                    max={100}
                    step={1}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                    $
                  </span>
                  <Input
                    type="number"
                    value={row.current}
                    onChange={e => update(i, { current: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm pl-5"
                    placeholder="Current"
                    min={0}
                    step={100}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <span className={cn(
              'text-xs',
              targetsValid ? 'text-muted-foreground' : 'text-destructive font-medium',
            )}>
              Targets sum: {r.targetSum.toFixed(1)}%
              {!targetsValid && ' (must = 100%)'}
            </span>
            <Button size="sm" variant="outline" onClick={reset} className="h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox
              label="Total Portfolio"
              value={fmtCompact(r.total)}
              sub={`Across ${rows.length} assets`}
            />
            <StatBox
              label="Largest Drift"
              value={r.largestDrift ? `${r.largestDrift.drift >= 0 ? '+' : ''}${r.largestDrift.drift.toFixed(1)}%` : '—'}
              sub={r.largestDrift?.name ?? ''}
              highlight={r.largestDrift && Math.abs(r.largestDrift.drift) > 10 ? 'negative'
                : r.largestDrift && Math.abs(r.largestDrift.drift) > 5 ? 'warning'
                : undefined}
            />
            <StatBox
              label="Targets Valid"
              value={targetsValid ? 'Yes' : 'No'}
              sub={`Sum = ${r.targetSum.toFixed(1)}%`}
              highlight={targetsValid ? 'positive' : 'negative'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Allocation Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left py-2 px-2 font-semibold">Asset</th>
                      <th className="text-right py-2 px-2 font-semibold">Current $</th>
                      <th className="text-right py-2 px-2 font-semibold">Current %</th>
                      <th className="text-right py-2 px-2 font-semibold">Target %</th>
                      <th className="text-right py-2 px-2 font-semibold">Drift</th>
                      <th className="text-right py-2 px-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">{row.name}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{fmtDollar(row.current)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{row.currentPct.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{row.target.toFixed(1)}%</td>
                        <td className={cn('py-2 px-2 text-right tabular-nums', driftClass(row.drift))}>
                          {row.drift >= 0 ? '+' : ''}{row.drift.toFixed(1)}%
                        </td>
                        <td className={cn('py-2 px-2 text-right tabular-nums', actionClass(row.action))}>
                          {actionLabel(row.action)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Current vs Target Allocation</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={45} />
                  <RechartsTooltip
                    formatter={(value: number | string) =>
                      typeof value === 'number' ? `${value.toFixed(1)}%` : String(value)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="current" name="Current %" fill="#3b82f6" />
                  <Bar dataKey="target"  name="Target %"  fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Callout icon={
            targetsValid
              ? <Scale className="h-4 w-4 text-amber-500" />
              : <AlertTriangle className="h-4 w-4 text-destructive" />
          }>
            {!targetsValid ? (
              <>
                Your target allocation sums to{' '}
                <strong className="text-foreground">{r.targetSum.toFixed(1)}%</strong> instead of 100%.
                Adjust the target percentages before rebalancing.
              </>
            ) : (
              <>
                <strong className="text-foreground">{buildActionText()}</strong>{' '}
                Rebalancing reduces risk and forces you to sell high and buy low.
              </>
            )}
          </Callout>
        </>
      }
    />
  );
}
