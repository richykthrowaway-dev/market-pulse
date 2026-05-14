// src/components/calculators/wealth/RothVsTraditional.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

function fvAnnuity(annual: number, ratePct: number, years: number): number {
  const r = ratePct / 100;
  if (r === 0) return annual * years;
  return annual * ((Math.pow(1 + r, years) - 1) / r);
}

export function RothVsTraditional() {
  const [currentAge, setCurrentAge] = useState(30);
  const [retireAge,  setRetireAge]  = useState(65);
  const [contrib,    setContrib]    = useState(6500);
  const [currTax,    setCurrTax]    = useState(24);
  const [retTax,     setRetTax]     = useState(22);
  const [rate,       setRate]       = useState(7);

  const r = useMemo(() => {
    const years = Math.max(0, retireAge - currentAge);
    const grossFV = fvAnnuity(contrib, rate, years);

    // Roth: contribute post-tax, withdraw tax-free
    const rothFinal = grossFV;

    // Traditional: contribute pre-tax, withdraw taxed
    const tradMain = grossFV * (1 - retTax / 100);

    // Side savings from up-front tax savings (X * currTax%), invested taxably,
    // approximated by taxing the final value at retirement rate.
    const sideAnnual = contrib * (currTax / 100);
    const sideGross  = fvAnnuity(sideAnnual, rate, years);
    const sideFinal  = sideGross * (1 - retTax / 100);

    const tradTotal = tradMain + sideFinal;
    const diff = rothFinal - tradTotal;

    return {
      years,
      rothFinal,
      tradMain,
      sideFinal,
      tradTotal,
      diff,
      breakevenRetTax: currTax,
    };
  }, [currentAge, retireAge, contrib, currTax, retTax, rate]);

  const chartData = useMemo(() => ([
    {
      name: 'Roth IRA',
      main: Math.round(r.rothFinal),
      side: 0,
    },
    {
      name: 'Traditional IRA',
      main: Math.round(r.tradMain),
      side: Math.round(r.sideFinal),
    },
  ]), [r]);

  const rothWins = r.diff > 0;
  const tradWins = r.diff < 0;

  let recommendation: React.ReactNode;
  if (currTax > retTax) {
    recommendation = (
      <>
        <strong className="text-foreground">Traditional likely wins</strong> — you save tax now at{' '}
        <strong className="text-foreground">{currTax}%</strong> and pay later at only{' '}
        <strong className="text-foreground">{retTax}%</strong>.
      </>
    );
  } else if (currTax < retTax) {
    recommendation = (
      <>
        <strong className="text-foreground">Roth likely wins</strong> — you pay tax now at{' '}
        <strong className="text-foreground">{currTax}%</strong> instead of a higher{' '}
        <strong className="text-foreground">{retTax}%</strong> in retirement.
      </>
    );
  } else {
    recommendation = (
      <>
        <strong className="text-foreground">Mathematically equivalent</strong> in the simple case.
        Roth wins on flexibility — no RMDs and qualified withdrawals are tax-free.
      </>
    );
  }

  return (
    <CalculatorShell
      title="Roth vs Traditional IRA"
      description="Compare after-tax retirement wealth between Roth and Traditional IRA contributions."
      inputs={
        <>
          <NumInput
            label="Current Age"
            value={currentAge}
            onChange={setCurrentAge}
            min={18}
            max={80}
            step={1}
            suffix="yrs"
          />
          <NumInput
            label="Retirement Age"
            value={retireAge}
            onChange={setRetireAge}
            min={currentAge + 1}
            max={90}
            step={1}
            suffix="yrs"
          />
          <NumInput
            label="Annual Contribution"
            value={contrib}
            onChange={setContrib}
            min={0}
            max={50_000}
            step={500}
            prefix="$"
            help="2024 Roth IRA limit is $7,000 ($8,000 if 50+)"
          />
          <NumInput
            label="Current Marginal Tax Rate"
            value={currTax}
            onChange={setCurrTax}
            min={0}
            max={50}
            step={1}
            suffix="%"
          />
          <NumInput
            label="Retirement Tax Rate"
            value={retTax}
            onChange={setRetTax}
            min={0}
            max={50}
            step={1}
            suffix="%"
            help="Your expected marginal rate in retirement"
          />
          <NumInput
            label="Expected Annual Return"
            value={rate}
            onChange={setRate}
            min={0}
            max={20}
            step={0.5}
            suffix="%"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Years to Retirement"
              value={`${r.years}`}
              sub={`Age ${currentAge} → ${retireAge}`}
            />
            <StatBox
              label="Roth Final (after-tax)"
              value={fmtCompact(r.rothFinal)}
              sub="Tax-free withdrawal"
              highlight={rothWins ? 'positive' : undefined}
            />
            <StatBox
              label="Traditional Total"
              value={fmtCompact(r.tradTotal)}
              sub="Main + side savings"
              highlight={tradWins ? 'positive' : undefined}
            />
            <StatBox
              label={r.diff >= 0 ? 'Roth Advantage' : 'Traditional Advantage'}
              value={fmtCompact(Math.abs(r.diff))}
              sub={`Breakeven at ${r.breakevenRetTax}% ret tax`}
              highlight={r.diff === 0 ? 'warning' : 'positive'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                After-Tax Value at Retirement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip labelPrefix="" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="main" name="Account Value" stackId="a" fill="#22c55e">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#22c55e' : '#3b82f6'} />
                    ))}
                  </Bar>
                  <Bar dataKey="side" name="Side Savings (after-tax)" stackId="a" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Callout icon={<Scale className="h-4 w-4 text-amber-500" />}>
            {recommendation} Over {r.years} years, the difference is{' '}
            <strong className="text-foreground">{fmtDollar(Math.abs(r.diff))}</strong>.
          </Callout>

          <p className="text-[11px] text-muted-foreground italic">
            US IRA accounts. Canadians: see TFSA vs RRSP (similar logic).
          </p>
        </>
      }
    />
  );
}
