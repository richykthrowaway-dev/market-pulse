// src/components/calculators/tax/TaxLossHarvesting.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

export function TaxLossHarvesting() {
  const [currentValue, setCurrentValue] = useState(8000);
  const [costBasis, setCostBasis] = useState(10000);
  const [taxRate, setTaxRate] = useState(25);
  const [returnPct, setReturnPct] = useState(7);
  const [years, setYears] = useState(10);

  const r = useMemo(() => {
    const harvestableLoss = Math.max(0, costBasis - currentValue);
    const immediateTaxSaving = harvestableLoss * (taxRate / 100);
    const futureValue = immediateTaxSaving * Math.pow(1 + returnPct / 100, years);
    const washSaleCost = currentValue * (returnPct / 100) * (30 / 365) * (taxRate / 100);
    const totalBenefit = futureValue - washSaleCost;
    return {
      harvestableLoss,
      immediateTaxSaving,
      futureValue,
      washSaleCost,
      totalBenefit,
    };
  }, [currentValue, costBasis, taxRate, returnPct, years]);

  const chartData = [
    { name: 'Immediate Tax Saving', value: Math.round(r.immediateTaxSaving), color: '#22c55e' },
    { name: 'Wash-Sale Cost',       value: Math.round(r.washSaleCost),       color: '#f59e0b' },
    { name: 'Long-Term Benefit',    value: Math.round(r.futureValue),        color: '#16a34a' },
  ];

  return (
    <CalculatorShell
      title="Tax-Loss Harvesting"
      description="Estimate the value of selling a losing position to offset taxes — and the compounded benefit of reinvesting the savings."
      inputs={
        <>
          <NumInput
            label="Current Value"
            value={currentValue}
            onChange={setCurrentValue}
            min={0}
            step={500}
            prefix="$"
          />
          <NumInput
            label="Cost Basis"
            value={costBasis}
            onChange={setCostBasis}
            min={0}
            step={500}
            prefix="$"
          />
          <NumInput
            label="Marginal Tax Rate"
            value={taxRate}
            onChange={setTaxRate}
            min={0}
            max={60}
            step={1}
            suffix="%"
          />
          <NumInput
            label="Expected Annual Market Return"
            value={returnPct}
            onChange={setReturnPct}
            min={0}
            max={30}
            step={0.5}
            suffix="%"
          />
          <NumInput
            label="Years to Reinvest"
            value={years}
            onChange={setYears}
            min={1}
            max={50}
            step={1}
            suffix="yrs"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Harvestable Loss"
              value={fmtCompact(-r.harvestableLoss)}
              sub="Cost basis − current value"
              highlight={r.harvestableLoss > 0 ? 'negative' : undefined}
            />
            <StatBox
              label="Immediate Tax Saving"
              value={fmtCompact(r.immediateTaxSaving)}
              sub={`At ${taxRate}% marginal rate`}
              highlight="positive"
            />
            <StatBox
              label="Future Value"
              value={fmtCompact(r.futureValue)}
              sub={`Reinvested ${years} yrs @ ${returnPct}%`}
              highlight="positive"
            />
            <StatBox
              label="Wash-Sale Window"
              value="30"
              sub="days from today"
              highlight="warning"
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Benefit Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingDown className="h-4 w-4 text-amber-500" />}>
            Harvesting this{' '}
            <strong className="text-foreground">{fmtDollar(r.harvestableLoss)}</strong> loss saves{' '}
            <strong className="text-foreground">{fmtDollar(r.immediateTaxSaving)}</strong> today.
            Reinvested at <strong className="text-foreground">{returnPct}%</strong>, that saving
            grows to <strong className="text-foreground">{fmtDollar(r.futureValue)}</strong> by year{' '}
            {years}.
          </Callout>
        </>
      }
    />
  );
}
