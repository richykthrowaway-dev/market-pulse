// src/components/calculators/wealth/InflationAdjusted.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

export function InflationAdjusted() {
  const [start,     setStart]     = useState(100_000);
  const [nominal,   setNominal]   = useState(8);
  const [inflation, setInflation] = useState(3);
  const [years,     setYears]     = useState(30);
  const [contrib,   setContrib]   = useState(0);

  const r = useMemo(() => {
    const nom = nominal / 100;
    const inf = inflation / 100;
    const realR = (1 + nom) / (1 + inf) - 1;

    const series: { year: number; nominal: number; real: number }[] = [];
    let nomBal = start;
    for (let y = 0; y <= years; y++) {
      const realBal = nomBal / Math.pow(1 + inf, y);
      series.push({
        year: y,
        nominal: Math.round(nomBal),
        real: Math.round(realBal),
      });
      nomBal = nomBal * (1 + nom) + contrib;
    }

    const nomFinal  = series[series.length - 1].nominal;
    const realFinal = series[series.length - 1].real;
    const loss      = nomFinal - realFinal;
    const lossPct   = nomFinal > 0 ? (loss / nomFinal) * 100 : 0;

    return {
      series,
      nomFinal,
      realFinal,
      loss,
      lossPct,
      realReturnPct: realR * 100,
    };
  }, [start, nominal, inflation, years, contrib]);

  return (
    <CalculatorShell
      title="Inflation-Adjusted Returns"
      description="See the gap between nominal returns and real purchasing power."
      inputs={
        <>
          <NumInput
            label="Starting Amount"
            value={start}
            onChange={setStart}
            min={0}
            step={1000}
            prefix="$"
          />
          <NumInput
            label="Nominal Annual Return"
            value={nominal}
            onChange={setNominal}
            min={0}
            max={30}
            step={0.5}
            suffix="%"
          />
          <NumInput
            label="Inflation Rate"
            value={inflation}
            onChange={setInflation}
            min={0}
            max={20}
            step={0.1}
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
          <NumInput
            label="Annual Contribution"
            value={contrib}
            onChange={setContrib}
            min={0}
            step={500}
            prefix="$"
            help="Optional — added each year"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Nominal Future Value"
              value={fmtCompact(r.nomFinal)}
              sub={`Headline number after ${years} yrs`}
              highlight="positive"
            />
            <StatBox
              label="Real Future Value"
              value={fmtCompact(r.realFinal)}
              sub="In today's dollars"
              highlight="warning"
            />
            <StatBox
              label="Real Return Rate"
              value={`${r.realReturnPct.toFixed(2)}%`}
              sub={`${nominal}% − ${inflation}% inflation`}
            />
            <StatBox
              label="Purchasing Power Lost"
              value={fmtCompact(r.loss)}
              sub={`${r.lossPct.toFixed(0)}% of nominal value`}
              highlight="negative"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Nominal vs Real Value Over {years} Years
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
                    dataKey="nominal"
                    name="Nominal Value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    name="Real Value (today's $)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Callout icon={<TrendingDown className="h-4 w-4 text-amber-500" />}>
            Your <strong className="text-foreground">{fmtDollar(r.nomFinal)}</strong> nominal value{' '}
            {years} years out will only buy what{' '}
            <strong className="text-foreground">{fmtDollar(r.realFinal)}</strong> buys today.
            Inflation quietly ate{' '}
            <strong className="text-foreground">{r.lossPct.toFixed(0)}%</strong> of your gains.
          </Callout>
        </>
      }
    />
  );
}
