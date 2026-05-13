// src/components/calculators/tax/CapitalGainsTax.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';
import { cn } from '@/lib/utils';

type Holding = 'short' | 'long';
type Country = 'US' | 'CA';
const US_BRACKETS = [10, 12, 22, 24, 32, 35, 37] as const;
const CA_BRACKETS = [15, 20.5, 26, 29, 33] as const;

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

export function CapitalGainsTax() {
  const [country, setCountry] = useState<Country>('US');
  const [purchasePrice, setPurchasePrice] = useState(100);
  const [salePrice, setSalePrice] = useState(150);
  const [shares, setShares] = useState(100);
  const [holding, setHolding] = useState<Holding>('short');
  const [bracket, setBracket] = useState<number>(22);
  const [stateRate, setStateRate] = useState(0);
  const [holdingDays, setHoldingDays] = useState(180);

  const r = useMemo(() => {
    const grossProceeds = salePrice * shares;
    const costBasis = purchasePrice * shares;
    const capitalGain = grossProceeds - costBasis;

    let federalRate = 0;
    let longTermRate = 0;
    let isLongTerm = false;
    let taxableGain = 0;
    let federalTax = 0;
    let stateTax = 0;

    if (country === 'US') {
      longTermRate = bracket <= 12 ? 0 : bracket <= 32 ? 15 : 20;
      isLongTerm = holding === 'long';
      federalRate = isLongTerm ? longTermRate : bracket;
      taxableGain = Math.max(0, capitalGain);
      federalTax = taxableGain * (federalRate / 100);
      stateTax = taxableGain * (stateRate / 100);
    } else {
      // Canada: 50% inclusion rate
      taxableGain = Math.max(0, capitalGain) * 0.5;
      federalRate = bracket;
      federalTax = taxableGain * (federalRate / 100);
      stateTax = taxableGain * (stateRate / 100);
    }

    const totalTax = federalTax + stateTax;
    const netProceeds = grossProceeds - totalTax;
    const netGain = capitalGain - totalTax;
    const effectiveTaxRate = capitalGain > 0 ? (totalTax / capitalGain) * 100 : 0;

    const stSavings = country === 'US' && capitalGain > 0 && !isLongTerm
      ? capitalGain * ((bracket - longTermRate) / 100)
      : 0;

    return {
      grossProceeds, costBasis, capitalGain, federalTax, stateTax,
      totalTax, netProceeds, netGain, effectiveTaxRate, taxableGain,
      longTermRate, federalRate, isLongTerm, stSavings,
    };
  }, [country, purchasePrice, salePrice, shares, holding, bracket, stateRate]);

  const isCA = country === 'CA';
  const brackets = isCA ? CA_BRACKETS : US_BRACKETS;
  const bracketLabel = isCA ? 'Federal Tax Bracket' : 'Federal Income Bracket';
  const stateRateLabel = isCA ? 'Provincial Tax Rate' : 'State Tax Rate';
  const stateTaxName = isCA ? 'Provincial Tax' : 'State Tax';

  const chartData = [{
    name: 'Sale Proceeds',
    costBasis: r.costBasis,
    netGain: Math.max(0, r.netGain),
    federalTax: r.federalTax,
    stateTax: r.stateTax,
  }];

  const showShortTermWarning =
    country === 'US' && holding === 'short' && holdingDays < 365 && r.capitalGain > 0;

  // ensure bracket value is valid when switching countries
  const bracketValid = (brackets as readonly number[]).includes(bracket);
  const bracketValue = bracketValid ? bracket : brackets[0];

  return (
    <CalculatorShell
      title="Capital Gains Tax"
      description="Estimate federal and state/provincial taxes on stock sale gains."
      inputs={
        <>
          <ToggleGroup<Country>
            label="Country"
            value={country}
            options={[
              { value: 'US', label: '🇺🇸 US' },
              { value: 'CA', label: '🇨🇦 Canada' },
            ]}
            onChange={(v) => {
              setCountry(v);
              // reset bracket to first valid for the new country
              setBracket(v === 'CA' ? 26 : 22);
              if (v === 'CA' && stateRate === 0) setStateRate(10);
            }}
          />
          <NumInput
            label="Purchase Price"
            value={purchasePrice}
            onChange={setPurchasePrice}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Sale Price"
            value={salePrice}
            onChange={setSalePrice}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Shares"
            value={shares}
            onChange={setShares}
            min={1}
            step={1}
          />
          {!isCA && (
            <ToggleGroup<Holding>
              label="Holding Period"
              value={holding}
              options={[
                { value: 'short', label: 'Short-term' },
                { value: 'long',  label: 'Long-term' },
              ]}
              onChange={setHolding}
            />
          )}
          {!isCA && holding === 'short' && (
            <NumInput
              label="Days Held"
              value={holdingDays}
              onChange={setHoldingDays}
              min={1}
              max={364}
              step={1}
              suffix="days"
              help="Long-term treatment requires holding > 365 days"
            />
          )}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{bracketLabel}</Label>
            <select
              value={bracketValue}
              onChange={e => setBracket(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {brackets.map(b => (
                <option key={b} value={b}>{b}%</option>
              ))}
            </select>
          </div>
          <NumInput
            label={stateRateLabel}
            value={stateRate}
            onChange={setStateRate}
            min={0}
            max={25}
            step={0.1}
            suffix="%"
            help={isCA ? 'Default ~10% (Ontario approximation)' : 'Optional — leave at 0 for no-tax states'}
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatBox
              label="Gross Proceeds"
              value={fmtDollar(r.grossProceeds)}
              sub={`${shares} sh × ${fmtDollar(salePrice)}`}
            />
            <StatBox
              label="Cost Basis"
              value={fmtDollar(r.costBasis)}
              sub={`${shares} sh × ${fmtDollar(purchasePrice)}`}
            />
            <StatBox
              label="Capital Gain"
              value={fmtDollar(r.capitalGain)}
              sub={
                isCA && r.capitalGain > 0
                  ? `Taxable: ${fmtDollar(r.taxableGain)} (50%)`
                  : r.capitalGain >= 0 ? 'Taxable gain' : 'Capital loss'
              }
              highlight={r.capitalGain >= 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Federal Tax"
              value={`-${fmtDollar(r.federalTax)}`}
              sub={
                isCA
                  ? `${r.federalRate}% on 50% incl.`
                  : `${r.federalRate}% ${r.isLongTerm ? 'LTCG' : 'ordinary'}`
              }
              highlight="negative"
            />
            <StatBox
              label={stateTaxName}
              value={`-${fmtDollar(r.stateTax)}`}
              sub={`${stateRate}% ${isCA ? 'provincial' : 'state'} rate`}
              highlight="negative"
            />
            <StatBox
              label="Net Proceeds"
              value={fmtDollar(r.netProceeds)}
              sub={`Effective tax: ${r.effectiveTaxRate.toFixed(1)}% of capital gain`}
              highlight="positive"
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Where Your Sale Proceeds Go
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="costBasis"  stackId="a" name="Cost Basis"   fill="#94a3b8" />
                  <Bar dataKey="netGain"    stackId="a" name="Net Gain"     fill="#22c55e" />
                  <Bar dataKey="federalTax" stackId="a" name="Federal Tax"  fill="#ef4444" />
                  <Bar dataKey="stateTax"   stackId="a" name={stateTaxName} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            {isCA && r.capitalGain > 0 ? (
              <>
                Canada uses a <strong className="text-foreground">50% inclusion rate</strong>: only{' '}
                <strong className="text-foreground">{fmtDollar(r.taxableGain)}</strong> of your{' '}
                <strong className="text-foreground">{fmtDollar(r.capitalGain)}</strong> gain is taxable.
                Total tax: <strong className="text-foreground">{fmtDollar(r.totalTax)}</strong>.
              </>
            ) : showShortTermWarning && r.stSavings > 0 ? (
              <>
                Waiting <strong className="text-foreground">{365 - holdingDays} more days</strong>{' '}
                to qualify for long-term rates saves you{' '}
                <strong className="text-foreground">{fmtDollar(r.stSavings)}</strong> in federal taxes
                (long-term rate would be <strong className="text-foreground">{r.longTermRate}%</strong>{' '}
                vs your ordinary <strong className="text-foreground">{bracket}%</strong>).
                {bracket <= 12 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Note: LTCG 0% rate only applies if your total income stays under $47,025 (2024 single filer).
                    If this gain pushes you over, part is taxed at 15%.
                  </div>
                )}
              </>
            ) : r.capitalGain <= 0 ? (
              <>
                You have a capital loss of{' '}
                <strong className="text-foreground">{fmtDollar(Math.abs(r.capitalGain))}</strong> —
                no tax is owed{!isCA && ', and you may be able to offset other gains or up to $3,000 of ordinary income'}.
              </>
            ) : (
              <>
                You'll keep{' '}
                <strong className="text-foreground">{fmtDollar(r.netProceeds)}</strong> of the{' '}
                {fmtDollar(r.grossProceeds)} sale —{' '}
                <strong className="text-foreground">{fmtDollar(r.totalTax)}</strong> goes to taxes
                at an effective rate of{' '}
                <strong className="text-foreground">{r.effectiveTaxRate.toFixed(1)}%</strong> of your gain.
                {!isCA && bracket <= 12 && holding === 'long' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Note: LTCG 0% rate only applies if your total income stays under $47,025 (2024 single filer).
                    If this gain pushes you over, part is taxed at 15%.
                  </div>
                )}
              </>
            )}
          </Callout>
        </>
      }
    />
  );
}
