// src/components/calculators/tax/TaxLossHarvesting.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';

type Country = 'US' | 'CA';

function ToggleGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn('w-full', value === opt.value && 'font-semibold')}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function TaxLossHarvesting() {
  const [country, setCountry] = useState<Country>('US');
  const [currentValue, setCurrentValue] = useState(8000);
  const [costBasis, setCostBasis] = useState(10000);
  const [capitalGainsThisYear, setCapitalGainsThisYear] = useState(0);
  const [taxRate, setTaxRate] = useState(25);
  const [returnPct, setReturnPct] = useState(7);
  const [years, setYears] = useState(10);

  const r = useMemo(() => {
    const harvestableLoss = Math.max(0, costBasis - currentValue);
    const inclusionRate = country === 'US' ? 1.0 : 0.5;

    let offsetAgainstGains = 0;
    let offsetAgainstOrdinary = 0;
    let carryforward = 0;
    let allowableLoss = 0;

    if (country === 'US') {
      const taxableLoss = harvestableLoss * inclusionRate;
      allowableLoss = taxableLoss;
      offsetAgainstGains = Math.min(taxableLoss, capitalGainsThisYear);
      const excessLoss = taxableLoss - offsetAgainstGains;
      offsetAgainstOrdinary = Math.min(excessLoss, 3000); // US-only $3k cap
      carryforward = excessLoss - offsetAgainstOrdinary;
    } else {
      // CA: 50% inclusion; no ordinary-income offset
      allowableLoss = harvestableLoss * inclusionRate;
      const allowableGains = capitalGainsThisYear * inclusionRate;
      offsetAgainstGains = Math.min(allowableLoss, allowableGains);
      carryforward = allowableLoss - offsetAgainstGains;
    }

    const immediateTaxSaving =
      (offsetAgainstGains + offsetAgainstOrdinary) * (taxRate / 100);
    const carryforwardSaving = carryforward * (taxRate / 100);
    const futureValue = immediateTaxSaving * Math.pow(1 + returnPct / 100, years);
    // 61-day wash-sale window (30 before + 30 after)
    const washSaleCost = currentValue * (returnPct / 100) * (61 / 365) * (taxRate / 100);
    const totalBenefit = futureValue - washSaleCost;

    return {
      harvestableLoss,
      inclusionRate,
      allowableLoss,
      offsetAgainstGains,
      offsetAgainstOrdinary,
      carryforward,
      immediateTaxSaving,
      carryforwardSaving,
      futureValue,
      washSaleCost,
      totalBenefit,
    };
  }, [country, currentValue, costBasis, capitalGainsThisYear, taxRate, returnPct, years]);

  const chartData = [
    { name: 'Immediate Saving',   value: Math.round(r.immediateTaxSaving),  color: '#22c55e' },
    { name: 'Carryforward Saving',value: Math.round(r.carryforwardSaving),  color: '#0ea5e9' },
    { name: 'Wash-Sale Cost',     value: Math.round(r.washSaleCost),        color: '#f59e0b' },
    { name: 'Long-Term Benefit',  value: Math.round(r.futureValue),         color: '#16a34a' },
  ];

  return (
    <CalculatorShell
      title="Tax-Loss Harvesting"
      description="Estimate the value of selling a losing position to offset taxes — and the compounded benefit of reinvesting the savings."
      inputs={
        <>
          <ToggleGroup<Country>
            label="Country"
            value={country}
            onChange={setCountry}
            options={[
              { value: 'US', label: '🇺🇸 US' },
              { value: 'CA', label: '🇨🇦 Canada' },
            ]}
          />
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
            label="Capital Gains This Year"
            value={capitalGainsThisYear}
            onChange={setCapitalGainsThisYear}
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox
              label="Harvestable Loss"
              value={fmtCompact(-r.harvestableLoss)}
              sub="Cost basis − current value"
              highlight={r.harvestableLoss > 0 ? 'negative' : undefined}
            />
            <StatBox
              label="Immediate Tax Saving"
              value={fmtCompact(r.immediateTaxSaving)}
              sub={
                country === 'US'
                  ? `Gains + up to $3k ordinary @ ${taxRate}%`
                  : `Against gains @ ${taxRate}% (50% incl.)`
              }
              highlight="positive"
            />
            <StatBox
              label="Carryforward Saving"
              value={fmtCompact(r.carryforwardSaving)}
              sub={
                country === 'US'
                  ? 'Future tax saving (indefinite)'
                  : '3yr back / indefinite forward'
              }
              highlight={r.carryforwardSaving > 0 ? 'positive' : undefined}
            />
            <StatBox
              label="Future Value"
              value={fmtCompact(r.futureValue)}
              sub={`Reinvested ${years} yrs @ ${returnPct}%`}
              highlight="positive"
            />
            <StatBox
              label="Wash-Sale Window"
              value="61"
              sub="days (30 before + 30 after)"
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
            {country === 'US' ? (
              <>
                Harvesting this{' '}
                <strong className="text-foreground">{fmtDollar(r.harvestableLoss)}</strong> loss
                saves{' '}
                <strong className="text-foreground">{fmtDollar(r.immediateTaxSaving)}</strong> now
                (offsetting{' '}
                <strong className="text-foreground">{fmtDollar(r.offsetAgainstGains)}</strong> of
                gains +{' '}
                <strong className="text-foreground">{fmtDollar(r.offsetAgainstOrdinary)}</strong>{' '}
                of ordinary income, capped at $3,000/yr).{' '}
                <strong className="text-foreground">{fmtDollar(r.carryforward)}</strong> carries
                forward indefinitely.
              </>
            ) : (
              <>
                Canada uses a 50% inclusion rate: only{' '}
                <strong className="text-foreground">{fmtDollar(r.allowableLoss)}</strong> is
                deductible, saving{' '}
                <strong className="text-foreground">{fmtDollar(r.immediateTaxSaving)}</strong>{' '}
                against capital gains.{' '}
                <strong className="text-foreground">{fmtDollar(r.carryforward)}</strong> carries
                forward (3-year carryback, indefinite forward — capital gains only, no ordinary
                income offset).
              </>
            )}
          </Callout>
        </>
      }
    />
  );
}
