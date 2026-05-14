// src/components/calculators/trading/Pyramiding.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar } from '../calcUtils';
import { cn } from '@/lib/utils';

type Direction = 'long' | 'short';
interface Leg { price: number; shares: number }

export function Pyramiding() {
  const [direction, setDirection] = useState<Direction>('long');
  const [symbol, setSymbol] = useState('');
  const [initial, setInitial] = useState<Leg>({ price: 100, shares: 100 });
  const [add1, setAdd1] = useState<Leg>({ price: 0, shares: 0 });
  const [add2, setAdd2] = useState<Leg>({ price: 0, shares: 0 });
  const [add3, setAdd3] = useState<Leg>({ price: 0, shares: 0 });
  const [stopPrice, setStopPrice] = useState(95);
  const [currentPrice, setCurrentPrice] = useState(110);

  const r = useMemo(() => {
    const legs = [
      { label: 'Initial', ...initial },
      { label: 'Add #1', ...add1 },
      { label: 'Add #2', ...add2 },
      { label: 'Add #3', ...add3 },
    ];
    const activeLegs = legs.filter(l => l.shares > 0 && l.price > 0);
    const totalShares = activeLegs.reduce((s, l) => s + l.shares, 0);
    const totalCost = activeLegs.reduce((s, l) => s + l.price * l.shares, 0);
    const avgEntry = totalShares > 0 ? totalCost / totalShares : 0;
    const isLong = direction === 'long';
    const riskFromStop = totalShares > 0
      ? (isLong ? avgEntry - stopPrice : stopPrice - avgEntry) * totalShares
      : 0;
    const unrealizedPnL = totalShares > 0
      ? (isLong ? currentPrice - avgEntry : avgEntry - currentPrice) * totalShares
      : 0;
    const riskPct = totalCost > 0 ? (riskFromStop / totalCost) * 100 : 0;

    return {
      legs, activeLegs, totalShares, totalCost, avgEntry,
      riskFromStop, unrealizedPnL, riskPct, isLong,
    };
  }, [direction, initial, add1, add2, add3, stopPrice, currentPrice]);

  // Price visualization range
  const allPrices = [
    ...r.activeLegs.map(l => l.price),
    stopPrice,
    currentPrice,
    r.avgEntry || 0,
  ].filter(p => p > 0);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const span = maxP - minP || 1;
  const pad = span * 0.1;
  const lo = minP - pad;
  const hi = maxP + pad;
  const xPct = (p: number) => ((p - lo) / (hi - lo)) * 100;

  const legColors = ['#22c55e', '#16a34a', '#15803d', '#166534'];

  return (
    <CalculatorShell
      title="Pyramiding"
      description="Plan adding to a winner — track average entry, stop risk, and breakeven."
      inputs={
        <>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['long', 'short'] as Direction[]).map(opt => (
                <Button
                  key={opt}
                  type="button"
                  variant={direction === opt ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection(opt)}
                  className={cn('w-full capitalize', direction === opt && 'font-semibold')}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Symbol (optional)</Label>
            <Input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
            />
          </div>

          {([
            { name: 'Initial', leg: initial, set: setInitial },
            { name: 'Add #1', leg: add1, set: setAdd1 },
            { name: 'Add #2', leg: add2, set: setAdd2 },
            { name: 'Add #3', leg: add3, set: setAdd3 },
          ]).map(row => (
            <div key={row.name} className="space-y-2 pt-2 border-t first:border-t-0 first:pt-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {row.name}
              </p>
              <NumInput
                label="Price"
                value={row.leg.price}
                onChange={v => row.set({ ...row.leg, price: v })}
                min={0}
                step={0.01}
                prefix="$"
              />
              <NumInput
                label="Shares"
                value={row.leg.shares}
                onChange={v => row.set({ ...row.leg, shares: v })}
                min={0}
                step={1}
                help={row.name !== 'Initial' ? 'Set to 0 to skip this leg' : undefined}
              />
            </div>
          ))}

          <NumInput
            label="Stop Price"
            value={stopPrice}
            onChange={setStopPrice}
            min={0}
            step={0.01}
            prefix="$"
            help={r.isLong ? 'Below avg entry for longs' : 'Above avg entry for shorts'}
          />
          <NumInput
            label="Current Price"
            value={currentPrice}
            onChange={setCurrentPrice}
            min={0}
            step={0.01}
            prefix="$"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="Avg Entry"
              value={r.totalShares > 0 ? fmtDollar(r.avgEntry) : '—'}
              sub={symbol || 'Per share'}
            />
            <StatBox
              label="Total Position"
              value={r.totalShares > 0 ? `${r.totalShares.toLocaleString()} sh` : '—'}
              sub={r.totalCost > 0 ? `Cost ${fmtDollar(r.totalCost)}` : ''}
            />
            <StatBox
              label="Risk from Stop"
              value={r.totalShares > 0 ? `-${fmtDollar(Math.abs(r.riskFromStop))}` : '—'}
              sub={`${r.riskPct.toFixed(1)}% of notional`}
              highlight={r.riskFromStop > 0 ? 'negative' : 'warning'}
            />
            <StatBox
              label="Unrealized P&L"
              value={r.totalShares > 0 ? fmtDollar(r.unrealizedPnL) : '—'}
              sub={`At ${fmtDollar(currentPrice)}`}
              highlight={r.unrealizedPnL >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Position Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase">
                      <th className="text-left py-2 font-medium">Leg</th>
                      <th className="text-right py-2 font-medium">Price</th>
                      <th className="text-right py-2 font-medium">Shares</th>
                      <th className="text-right py-2 font-medium">Cost</th>
                      <th className="text-right py-2 font-medium">% of Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.legs.map((l, i) => {
                      const cost = l.price * l.shares;
                      const weight = r.totalCost > 0 ? (cost / r.totalCost) * 100 : 0;
                      const inactive = l.shares <= 0 || l.price <= 0;
                      return (
                        <tr
                          key={l.label}
                          className={cn(
                            'border-b last:border-b-0',
                            inactive && 'text-muted-foreground/60',
                          )}
                        >
                          <td className="py-1.5 font-medium">{l.label}</td>
                          <td className="py-1.5 text-right">
                            {l.price > 0 ? fmtDollar(l.price) : '—'}
                          </td>
                          <td className="py-1.5 text-right">
                            {l.shares > 0 ? l.shares.toLocaleString() : '—'}
                          </td>
                          <td className="py-1.5 text-right">
                            {cost > 0 ? fmtDollar(cost) : '—'}
                          </td>
                          <td className="py-1.5 text-right">
                            {inactive ? '—' : `${weight.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                    {r.totalShares > 0 && (
                      <tr className="font-semibold bg-muted/30">
                        <td className="py-1.5">Total</td>
                        <td className="py-1.5 text-right">{fmtDollar(r.avgEntry)}</td>
                        <td className="py-1.5 text-right">{r.totalShares.toLocaleString()}</td>
                        <td className="py-1.5 text-right">{fmtDollar(r.totalCost)}</td>
                        <td className="py-1.5 text-right">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Price Map</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              {r.totalShares > 0 ? (
                <>
                  <div className="relative h-16 rounded-md border border-border bg-muted/20 overflow-hidden">
                    {/* shaded zones relative to avg entry */}
                    {(() => {
                      const entryX = xPct(r.avgEntry);
                      const profitOnLeft = !r.isLong; // shorts profit as price falls
                      return (
                        <>
                          <div
                            className={cn(
                              'absolute inset-y-0',
                              profitOnLeft ? 'bg-success/15' : 'bg-destructive/15',
                            )}
                            style={{ left: 0, width: `${entryX}%` }}
                          />
                          <div
                            className={cn(
                              'absolute inset-y-0',
                              profitOnLeft ? 'bg-destructive/15' : 'bg-success/15',
                            )}
                            style={{ left: `${entryX}%`, width: `${100 - entryX}%` }}
                          />
                          <div
                            className="absolute inset-y-0 w-0.5 bg-foreground"
                            style={{ left: `${entryX}%` }}
                          />
                        </>
                      );
                    })()}

                    {/* leg markers */}
                    {r.activeLegs.map((l, i) => (
                      <div
                        key={i}
                        className="absolute top-2 w-2 h-2 -translate-x-1/2 rounded-full border border-background"
                        style={{
                          left: `${xPct(l.price)}%`,
                          backgroundColor: legColors[i] ?? '#22c55e',
                        }}
                        title={`${l.label} @ ${fmtDollar(l.price)}`}
                      />
                    ))}

                    {/* stop marker */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-destructive"
                      style={{ left: `${xPct(stopPrice)}%` }}
                    />

                    {/* current price marker */}
                    <div
                      className="absolute bottom-2 w-3 h-3 -translate-x-1/2 rounded-full bg-blue-500 border-2 border-background"
                      style={{ left: `${xPct(currentPrice)}%` }}
                      title={`Current ${fmtDollar(currentPrice)}`}
                    />
                  </div>
                  <div className="relative mt-2 h-5 text-[11px] text-muted-foreground tabular-nums">
                    <span className="absolute left-0">{fmtDollar(lo)}</span>
                    <span
                      className="absolute -translate-x-1/2 font-semibold text-foreground"
                      style={{ left: `${xPct(r.avgEntry)}%` }}
                    >
                      Avg {fmtDollar(r.avgEntry)}
                    </span>
                    <span className="absolute right-0">{fmtDollar(hi)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Entries
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-0.5 bg-destructive" /> Stop {fmtDollar(stopPrice)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Current{' '}
                      {fmtDollar(currentPrice)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter at least one leg with positive price and shares to view the price map.
                </p>
              )}
            </CardContent>
          </Card>

          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            Adding to a winner reduces your risk-to-reward because you're paying higher prices on
            later legs. Make sure the new stop at{' '}
            <strong className="text-foreground">{fmtDollar(stopPrice)}</strong> still gives you
            acceptable total risk —
            currently <strong className="text-foreground">{fmtDollar(Math.abs(r.riskFromStop))}</strong>
            {' '}({r.riskPct.toFixed(1)}% of notional).
          </Callout>
        </>
      }
    />
  );
}
