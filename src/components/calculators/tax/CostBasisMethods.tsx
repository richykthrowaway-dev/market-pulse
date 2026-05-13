// src/components/calculators/tax/CostBasisMethods.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, Plus, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

type Lot = { date: string; shares: number; price: number };

type MethodResult = {
  method: string;
  proceeds: number;
  basis: number;
  gain: number;
  tax: number;
};

function calcMethod(
  lots: Lot[],
  sharesToSell: number,
  salePrice: number,
  sortFn: (a: Lot, b: Lot) => number,
) {
  const sorted = [...lots].sort(sortFn);
  let remaining = sharesToSell;
  let basis = 0;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.shares);
    basis += take * lot.price;
    remaining -= take;
  }
  const proceeds = sharesToSell * salePrice;
  const gain = proceeds - basis;
  return { proceeds, basis, gain };
}

function calcAverage(lots: Lot[], sharesToSell: number, salePrice: number) {
  const totalShares = lots.reduce((s, l) => s + l.shares, 0);
  const totalCost = lots.reduce((s, l) => s + l.shares * l.price, 0);
  const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
  const basis = sharesToSell * avgPrice;
  const proceeds = sharesToSell * salePrice;
  const gain = proceeds - basis;
  return { proceeds, basis, gain };
}

export function CostBasisMethods() {
  const [lots, setLots] = useState<Lot[]>([
    { date: '2022-01-15', shares: 50, price: 100 },
    { date: '2023-06-10', shares: 30, price: 120 },
    { date: '2024-03-22', shares: 20, price: 90 },
  ]);
  const [salePrice, setSalePrice] = useState(130);
  const [sharesToSell, setSharesToSell] = useState(60);
  const [taxRate, setTaxRate] = useState(22);

  const updateLot = (i: number, patch: Partial<Lot>) => {
    setLots(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const removeLot = (i: number) => {
    setLots(prev => prev.filter((_, idx) => idx !== i));
  };
  const addLot = () => {
    setLots(prev => [
      ...prev,
      { date: new Date().toISOString().slice(0, 10), shares: 10, price: 100 },
    ]);
  };

  const results: MethodResult[] = useMemo(() => {
    const totalAvailable = lots.reduce((s, l) => s + l.shares, 0);
    const sell = Math.min(sharesToSell, totalAvailable);
    const apply = (label: string, r: { proceeds: number; basis: number; gain: number }) => ({
      method: label,
      proceeds: r.proceeds,
      basis: r.basis,
      gain: r.gain,
      tax: Math.max(0, r.gain) * (taxRate / 100),
    });
    return [
      apply('FIFO',         calcMethod(lots, sell, salePrice, (a, b) => a.date.localeCompare(b.date))),
      apply('LIFO',         calcMethod(lots, sell, salePrice, (a, b) => b.date.localeCompare(a.date))),
      apply('Highest Cost', calcMethod(lots, sell, salePrice, (a, b) => b.price - a.price)),
      apply('Lowest Cost',  calcMethod(lots, sell, salePrice, (a, b) => a.price - b.price)),
      apply('Average Cost', calcAverage(lots, sell, salePrice)),
    ];
  }, [lots, sharesToSell, salePrice, taxRate]);

  const { bestMethod, worstMethod, diff } = useMemo(() => {
    if (!results.length) return { bestMethod: '', worstMethod: '', diff: 0 };
    const sorted = [...results].sort((a, b) => a.tax - b.tax);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return {
      bestMethod: best.method,
      worstMethod: worst.method,
      diff: worst.tax - best.tax,
    };
  }, [results]);

  const chartData = results.map(r => ({
    name: r.method,
    tax: Math.round(r.tax),
    isBest: r.method === bestMethod,
  }));

  return (
    <CalculatorShell
      title="Cost-Basis Methods"
      description="Compare how FIFO, LIFO, Highest/Lowest Cost, and Average Cost affect the tax bill on a single sale."
      inputs={
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Tax Lots</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium pb-1">Date</th>
                    <th className="text-left font-medium pb-1">Shares</th>
                    <th className="text-left font-medium pb-1">Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot, i) => (
                    <tr key={i}>
                      <td className="pr-1 py-1">
                        <Input
                          type="date"
                          value={lot.date}
                          onChange={e => updateLot(i, { date: e.target.value })}
                          className="h-8 text-xs px-2"
                        />
                      </td>
                      <td className="pr-1 py-1">
                        <Input
                          type="number"
                          value={lot.shares}
                          onChange={e => updateLot(i, { shares: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs px-2 w-16"
                        />
                      </td>
                      <td className="pr-1 py-1">
                        <Input
                          type="number"
                          value={lot.price}
                          onChange={e => updateLot(i, { price: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs px-2 w-20"
                        />
                      </td>
                      <td className="py-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => removeLot(i)}
                          aria-label="Remove lot"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="outline" onClick={addLot} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Lot
            </Button>
          </div>
          <NumInput
            label="Sale Price (per share)"
            value={salePrice}
            onChange={setSalePrice}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Shares to Sell"
            value={sharesToSell}
            onChange={setSharesToSell}
            min={0}
            step={1}
          />
          <NumInput
            label="Tax Rate"
            value={taxRate}
            onChange={setTaxRate}
            min={0}
            max={60}
            step={1}
            suffix="%"
          />
        </>
      }
      results={
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Method Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left font-semibold py-2">Method</th>
                      <th className="text-right font-semibold py-2">Proceeds</th>
                      <th className="text-right font-semibold py-2">Cost Basis</th>
                      <th className="text-right font-semibold py-2">Gain / Loss</th>
                      <th className="text-right font-semibold py-2">Est. Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const isBest = r.method === bestMethod;
                      return (
                        <tr
                          key={r.method}
                          className={`border-b last:border-0 ${isBest ? 'bg-green-500/5' : ''}`}
                        >
                          <td className="py-2 font-medium">
                            {r.method}
                            {isBest && (
                              <span className="ml-2 text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase">
                                Best
                              </span>
                            )}
                          </td>
                          <td className="text-right tabular-nums py-2">{fmtDollar(r.proceeds)}</td>
                          <td className="text-right tabular-nums py-2">{fmtDollar(r.basis)}</td>
                          <td
                            className={`text-right tabular-nums py-2 ${
                              r.gain >= 0 ? 'text-foreground' : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {fmtDollar(r.gain)}
                          </td>
                          <td className="text-right tabular-nums py-2 font-medium">
                            {fmtDollar(r.tax)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Estimated Tax by Method</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip labelPrefix="" />} />
                  <Bar dataKey="tax" name="Est. Tax" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isBest ? '#22c55e' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<Scale className="h-4 w-4 text-amber-500" />}>
            Using <strong className="text-foreground">{bestMethod}</strong> instead of{' '}
            <strong className="text-foreground">{worstMethod}</strong> saves you{' '}
            <strong className="text-foreground">{fmtDollar(diff)}</strong> in taxes on this sale.
          </Callout>
        </>
      }
    />
  );
}
