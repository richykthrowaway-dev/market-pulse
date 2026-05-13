// src/components/calculators/wealth/FireRetirement.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

function compute(savings: number, monthlyContrib: number, returnPct: number, swrPct: number, monthlyExpenses: number, currentAge: number) {
  const fireNumber = (monthlyExpenses * 12) / (swrPct / 100);
  if (swrPct <= 0) return { series: [], fireNumber: 0, yearsToFire: 0, fireAge: currentAge, monthlyPassiveIncome: 0, reached: false };
  const monthlyRate = returnPct / 100 / 12;
  let balance = savings;
  let months = 0;
  const series: { year: number; balance: number; target: number }[] = [
    { year: 0, balance: Math.round(savings), target: Math.round(fireNumber) },
  ];

  while (balance < fireNumber && months < 600) {
    balance = balance * (1 + monthlyRate) + monthlyContrib;
    months++;
    if (months % 12 === 0) {
      series.push({ year: months / 12, balance: Math.round(balance), target: Math.round(fireNumber) });
    }
  }

  const reached = months < 600;
  const yearsToFire = parseFloat((months / 12).toFixed(1));
  const fireAge = parseFloat((currentAge + yearsToFire).toFixed(1));
  const monthlyPassiveIncome = reached ? (balance * (swrPct / 100)) / 12 : 0;
  return { fireNumber, yearsToFire, fireAge, monthlyPassiveIncome, series, reached };
}

export function FireRetirement() {
  const [savings,     setSavings]     = useState(50_000);
  const [contrib,     setContrib]     = useState(2_000);
  const [ret,         setRet]         = useState(7);
  const [swr,         setSwr]         = useState(4);
  const [expenses,    setExpenses]    = useState(5_000);
  const [currentAge,  setCurrentAge]  = useState(30);
  const [targetAge,   setTargetAge]   = useState(65);

  const r = useMemo(
    () => compute(savings, contrib, ret, swr, expenses, currentAge),
    [savings, contrib, ret, swr, expenses, currentAge],
  );

  // Find the year where balance first crosses target
  const crossoverYear = r.reached ? Math.ceil(r.yearsToFire) : null;

  return (
    <CalculatorShell
      title="FIRE / Retirement"
      description="Find your financial independence number and how long until you reach it."
      inputs={<>
        <NumInput label="Current Savings"             value={savings}    onChange={setSavings}    min={0}   step={5_000}  prefix="$" />
        <NumInput label="Monthly Contribution"        value={contrib}    onChange={setContrib}    min={0}   step={100}    prefix="$" />
        <NumInput label="Expected Annual Return"      value={ret}        onChange={setRet}        min={0}   max={30}      step={0.5} suffix="%" />
        <NumInput label="Safe Withdrawal Rate"        value={swr}        onChange={setSwr}        min={0.5} max={10}      step={0.25} suffix="%" help="4% is the traditional FIRE guideline" />
        <NumInput label="Monthly Expenses in Retirement" value={expenses} onChange={setExpenses}  min={0}   step={500}    prefix="$" />
        <NumInput label="Current Age"                 value={currentAge} onChange={setCurrentAge} min={18}  max={80}      step={1} suffix="yrs" />
        <NumInput label="Target Retirement Age"       value={targetAge}  onChange={setTargetAge}  min={currentAge + 1} max={100} step={1} suffix="yrs" />
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="FIRE Number"    value={fmtCompact(r.fireNumber)}          sub="Portfolio target" />
          <StatBox label="Years to FIRE"  value={r.reached ? `${r.yearsToFire}` : '50+'} sub={r.reached ? 'At current rate' : 'Not reached'} highlight={r.reached ? 'positive' : 'negative'} />
          <StatBox label="Age at FIRE"    value={r.reached ? `${r.fireAge}`    : '—'}    sub={r.reached ? 'Projected' : '—'} />
          <StatBox label="Monthly Income" value={r.reached ? fmtCompact(r.monthlyPassiveIncome) : '—'} sub={r.reached ? `At ${swr}% SWR` : '—'} highlight={r.reached ? 'positive' : undefined} />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Glide Path to Financial Independence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {crossoverYear !== null && (
                  <ReferenceLine
                    x={crossoverYear}
                    stroke="#22c55e"
                    strokeDasharray="4 2"
                    label={{ value: `FIRE at Yr ${crossoverYear}`, position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
                  />
                )}
                <Line type="monotone" dataKey="target"  name="FIRE Target"       stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />
                <Line type="monotone" dataKey="balance" name="Portfolio Balance"  stroke="#22c55e" strokeWidth={2}   dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Callout icon={r.reached ? <TrendingUp className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}>
          {r.reached ? (
            r.fireAge <= targetAge ? (
              <>
                At your current savings rate you reach financial independence at age{' '}
                <strong className="text-foreground">{r.fireAge}</strong> —{' '}
                <strong className="text-foreground">{Math.round(targetAge - r.fireAge)} years</strong> ahead of your retirement target.
                Your FIRE number is <strong className="text-foreground">{fmtDollar(r.fireNumber)}</strong>.
              </>
            ) : (
              <>
                You reach FI at age{' '}
                <strong className="text-foreground">{r.fireAge}</strong> —{' '}
                <strong className="text-foreground">{Math.round(r.fireAge - targetAge)} years</strong> after your target retirement age.
                Your FIRE number is <strong className="text-foreground">{fmtDollar(r.fireNumber)}</strong>.
              </>
            )
          ) : (
            <>
              At current settings FIRE is not reached within 50 years. Try increasing contributions,
              reducing target expenses, or a higher expected return.
            </>
          )}
        </Callout>
      </>}
    />
  );
}
