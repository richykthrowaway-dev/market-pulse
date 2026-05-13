// src/components/calculators/wealth/MortgageVsInvest.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Home } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

function compute(extraPayment: number, balance: number, mortgageRate: number, yearsRemaining: number, investReturn: number) {
  const monthlyMortRate = mortgageRate / 100 / 12;
  const monthlyInvestRate = investReturn / 100 / 12;
  const totalMonths = yearsRemaining * 12;

  if (totalMonths <= 0) {
    return { series: [], finalInvest: 0, finalSaved: 0, netDiff: 0, investWins: false, breakEvenYear: null };
  }

  const stdPayment = balance > 0 && monthlyMortRate > 0
    ? balance * (monthlyMortRate * Math.pow(1 + monthlyMortRate, totalMonths))
      / (Math.pow(1 + monthlyMortRate, totalMonths) - 1)
    : balance / totalMonths;

  let balA = balance, balBase = balance;
  let totalInterestA = 0, totalInterestBase = 0;
  let investPortfolio = 0;

  const series: { year: number; mortgageSavings: number; investValue: number }[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    const intBase = balBase * monthlyMortRate;
    totalInterestBase += intBase;
    balBase = Math.max(0, balBase - (stdPayment - intBase));

    const hadBalance = balA > 0;
    const intA = balA * monthlyMortRate;
    totalInterestA += intA;
    const extra = hadBalance ? extraPayment : 0;
    const principalA = Math.min(balA, stdPayment - intA + extra);
    balA = Math.max(0, balA - principalA);

    investPortfolio = investPortfolio * (1 + monthlyInvestRate) + (hadBalance ? extraPayment : 0);

    if (m % 12 === 0) {
      series.push({
        year: m / 12,
        mortgageSavings: Math.round(totalInterestBase - totalInterestA),
        investValue: Math.round(investPortfolio),
      });
    }
  }

  const finalInvest = Math.round(investPortfolio);
  const finalSaved = Math.round(totalInterestBase - totalInterestA);
  const netDiff = finalInvest - finalSaved;
  const investWins = netDiff > 0;
  const breakEvenYear = series.find(s => s.investValue > s.mortgageSavings)?.year ?? null;

  return { series, finalInvest, finalSaved, netDiff, investWins, breakEvenYear };
}

export function MortgageVsInvest() {
  const [extraPayment,   setExtraPayment]   = useState(500);
  const [balance,        setBalance]        = useState(300_000);
  const [mortgageRate,   setMortgageRate]   = useState(5.5);
  const [yearsRemaining, setYearsRemaining] = useState(25);
  const [investReturn,   setInvestReturn]   = useState(8);

  const r = useMemo(
    () => compute(extraPayment, balance, mortgageRate, yearsRemaining, investReturn),
    [extraPayment, balance, mortgageRate, yearsRemaining, investReturn],
  );

  return (
    <CalculatorShell
      title="Mortgage vs Invest"
      description="Should your extra monthly cash pay down your mortgage or go into the market?"
      inputs={<>
        <NumInput label="Extra Monthly Payment"        value={extraPayment}    onChange={setExtraPayment}   min={1}    step={100}   prefix="$" help="The amount you can deploy each month" />
        <NumInput label="Current Mortgage Balance"     value={balance}         onChange={setBalance}        min={0}    step={10_000} prefix="$" />
        <NumInput label="Mortgage Interest Rate"       value={mortgageRate}    onChange={setMortgageRate}   min={0}    max={20}     step={0.1} suffix="%" />
        <NumInput label="Years Remaining on Mortgage"  value={yearsRemaining}  onChange={setYearsRemaining} min={1}    max={40}     step={1}   suffix="yrs" />
        <NumInput label="Expected Investment Return"   value={investReturn}    onChange={setInvestReturn}   min={0}    max={30}     step={0.5} suffix="%" />
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Interest Saved"    value={fmtCompact(r.finalSaved)}    sub="By paying extra"      highlight={!r.investWins ? 'positive' : undefined} />
          <StatBox label="Investment Value"  value={fmtCompact(r.finalInvest)}   sub="By investing instead" highlight={r.investWins ? 'positive' : undefined} />
          <StatBox label="Net Difference"    value={fmtCompact(Math.abs(r.netDiff))}
            sub={r.investWins ? 'Investing wins by' : 'Mortgage wins by'}
            highlight={r.investWins ? 'positive' : 'negative'}
          />
          <StatBox label="Break-Even"        value={r.breakEvenYear !== null ? `Yr ${r.breakEvenYear}` : 'N/A'} sub="Investing overtakes mortgage savings" />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cumulative Impact Over {yearsRemaining} Years
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="mortgageSavings" name="Mortgage Interest Saved" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="investValue"     name="Investment Portfolio"    stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Callout icon={r.investWins ? <TrendingUp className="h-4 w-4 text-green-500" /> : <Home className="h-4 w-4 text-amber-500" />}>
          {r.investWins ? (
            <>
              Investing your extra{' '}
              <strong className="text-foreground">${extraPayment.toLocaleString()}/month</strong> beats
              mortgage paydown by{' '}
              <strong className="text-foreground">{fmtDollar(r.netDiff)}</strong> over {yearsRemaining} years
              given these rates.
            </>
          ) : (
            <>
              Paying extra on your mortgage saves{' '}
              <strong className="text-foreground">{fmtDollar(Math.abs(r.netDiff))}</strong> more than
              investing over {yearsRemaining} years given a{' '}
              <strong className="text-foreground">{mortgageRate}%</strong> mortgage rate vs{' '}
              <strong className="text-foreground">{investReturn}%</strong> investment return.
            </>
          )}
        </Callout>
      </>}
    />
  );
}
