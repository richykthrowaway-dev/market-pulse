// src/components/calculators/fees/AdvisorFee.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt, growSeries } from '../calcUtils';

function computeAdvisor(initial: number, contrib: number, grossPct: number, feePct: number, years: number) {
  const noA = growSeries(initial, contrib, grossPct, years);
  const wiA = growSeries(initial, contrib, grossPct - feePct, years);
  let approxFeesPaid = 0;
  for (let y = 1; y <= years; y++) approxFeesPaid += wiA[y - 1] * (feePct / 100);
  return {
    series: noA.map((v, i) => ({ year: i, noAdvisor: Math.round(v), withAdvisor: Math.round(wiA[i]) })),
    finalNoAdvisor: Math.round(noA[years]),
    finalWithAdvisor: Math.round(wiA[years]),
    opportunityCost: Math.round(noA[years] - wiA[years]),
    approxFeesPaid: Math.round(approxFeesPaid),
  };
}

export function AdvisorFee() {
  const [initial, setInitial] = useState(100_000);
  const [contrib, setContrib] = useState(12_000);
  const [ret,     setRet]     = useState(7);
  const [fee,     setFee]     = useState(1.0);
  const [years,   setYears]   = useState(25);

  const r = useMemo(
    () => computeAdvisor(initial, contrib, ret, fee, years),
    [initial, contrib, ret, fee, years],
  );

  return (
    <CalculatorShell
      title="Advisor / Manager Fee"
      description="See how an annual AUM fee compounds into significant drag on long-term returns."
      inputs={<>
        <NumInput label="Starting Portfolio Value" value={initial} onChange={setInitial} min={1000} step={5000} prefix="$" />
        <NumInput label="Annual Contribution" value={contrib} onChange={setContrib} min={0} step={1000} prefix="$" help="Added at year-end each year" />
        <NumInput label="Expected Return (Gross)" value={ret} onChange={setRet} min={0} max={30} step={0.5} suffix="%" help="Before any fees" />
        <Separator />
        <NumInput label="Advisor / Manager Fee" value={fee} onChange={setFee} min={0} max={5} step={0.1} suffix="% AUM/yr" help="Typical range: 0.5%–2.0%" />
        <NumInput label="Investment Horizon" value={years} onChange={setYears} min={1} max={50} step={1} suffix="years" />
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="No Advisor"           value={fmtCompact(r.finalNoAdvisor)}   sub={`After ${years} yrs`} />
          <StatBox label={`With ${fee}% Advisor`} value={fmtCompact(r.finalWithAdvisor)} sub={`After ${years} yrs`} />
          <StatBox label="Compounding Drag"     value={fmtCompact(r.opportunityCost)}  sub="Opportunity cost" highlight="negative" />
          <StatBox label="Fees Paid (est.)"     value={fmtCompact(r.approxFeesPaid)}   sub="Direct AUM charges" />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Growth Over {years} Years</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="noAdvisor"   name="Self-Directed"          stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withAdvisor" name={`With ${fee}% Advisor`} stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          A <strong className="text-foreground">{fee}% annual advisor fee</strong> results in{' '}
          <strong className="text-foreground">{fmtDollar(r.opportunityCost)}</strong> in compounding drag
          over {years} years — that&apos;s{' '}
          <strong className="text-foreground">
            {r.finalNoAdvisor > 0 ? ((r.opportunityCost / r.finalNoAdvisor) * 100).toFixed(1) : 0}%
          </strong>{' '}
          of what you would have had fee-free.
        </Callout>
      </>}
    />
  );
}
