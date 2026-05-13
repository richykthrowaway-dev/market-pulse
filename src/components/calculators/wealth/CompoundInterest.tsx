// src/components/calculators/wealth/CompoundInterest.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

function compute(
  principal: number,
  contrib: number,
  ratePct: number,
  years: number,
  monthly: boolean,
  inflationPct: number,
) {
  const periods = monthly ? years * 12 : years;
  const r = (ratePct / 100) / (monthly ? 12 : 1);

  let balance = principal;
  let totalContrib = principal;
  const series: { year: number; contributions: number; value: number; real: number }[] = [];

  for (let p = 1; p <= periods; p++) {
    balance = balance * (1 + r) + contrib;
    totalContrib += contrib;
    if (monthly ? p % 12 === 0 : true) {
      const yr = monthly ? p / 12 : p;
      const real = balance / Math.pow(1 + inflationPct / 100, yr);
      series.push({
        year: yr,
        contributions: Math.round(totalContrib),
        value: Math.round(balance),
        real: Math.round(real),
      });
    }
  }

  const totalInterest = balance - totalContrib;
  const real = balance / Math.pow(1 + inflationPct / 100, years);
  return {
    series,
    final: Math.round(balance),
    totalContrib: Math.round(totalContrib),
    totalInterest: Math.round(totalInterest),
    real: Math.round(real),
  };
}

export function CompoundInterest() {
  const [principal, setPrincipal] = useState(10_000);
  const [contrib,   setContrib]   = useState(500);
  const [rate,      setRate]      = useState(8);
  const [years,     setYears]     = useState(30);
  const [monthly,   setMonthly]   = useState(false);
  const [inflation, setInflation] = useState(2.5);
  const [showReal,  setShowReal]  = useState(false);

  const r = useMemo(
    () => compute(principal, contrib, rate, years, monthly, inflation),
    [principal, contrib, rate, years, monthly, inflation],
  );

  const interestPct = r.final > 0 ? ((r.totalInterest / r.final) * 100).toFixed(0) : '0';

  return (
    <CalculatorShell
      title="Compound Interest"
      description="Model how an investment grows over time with regular contributions."
      inputs={
        <>
          <NumInput
            label="Starting Principal"
            value={principal}
            onChange={setPrincipal}
            min={0}
            step={1000}
            prefix="$"
          />
          <NumInput
            label={`${monthly ? 'Monthly' : 'Annual'} Contribution`}
            value={contrib}
            onChange={setContrib}
            min={0}
            step={100}
            prefix="$"
          />
          <NumInput
            label="Annual Return Rate"
            value={rate}
            onChange={setRate}
            min={0}
            max={50}
            step={0.5}
            suffix="%"
          />
          <NumInput
            label="Years"
            value={years}
            onChange={setYears}
            min={1}
            max={60}
            step={1}
            suffix="yrs"
          />
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="monthly-compounding"
              checked={monthly}
              onChange={e => setMonthly(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="monthly-compounding" className="text-sm cursor-pointer">
              Monthly compounding
            </label>
          </div>
          <NumInput
            label="Inflation Rate"
            value={inflation}
            onChange={setInflation}
            min={0}
            max={20}
            step={0.1}
            suffix="%"
            help="Used to calculate real (inflation-adjusted) value"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-real"
              checked={showReal}
              onChange={e => setShowReal(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="show-real" className="text-sm cursor-pointer">
              Show inflation-adjusted line
            </label>
          </div>
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Final Value"
              value={fmtCompact(r.final)}
              sub={`After ${years} yrs`}
              highlight="positive"
            />
            <StatBox
              label="Total Contributed"
              value={fmtCompact(r.totalContrib)}
              sub="Principal + deposits"
            />
            <StatBox
              label="Interest Earned"
              value={fmtCompact(r.totalInterest)}
              sub="Compounding gains"
              highlight="positive"
            />
            {showReal && (
              <StatBox
                label="Real Value"
                value={fmtCompact(r.real)}
                sub={`Inflation-adj. (${inflation}%)`}
              />
            )}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Portfolio Growth Over {years} Years
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `Yr ${v}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="contributions"
                    name="Total Contributed"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Portfolio Value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  {showReal && (
                    <Line
                      type="monotone"
                      dataKey="real"
                      name="Real Value"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="6 3"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            Compound interest does{' '}
            <strong className="text-foreground">{interestPct}%</strong> of the work — your money
            earns <strong className="text-foreground">{fmtDollar(r.totalInterest)}</strong> without
            you lifting a finger over {years} years.
          </Callout>
        </>
      }
    />
  );
}
