// src/components/calculators/fees/MerExpenses.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt, growSeries } from '../calcUtils';

interface MerResult {
  series: { year: number; fundA: number; fundB: number }[];
  finalA: number;
  finalB: number;
  difference: number;
}

function computeMer(
  initial: number,
  contrib: number,
  grossPct: number,
  merA: number,
  merB: number,
  years: number,
): MerResult {
  const serA = growSeries(initial, contrib, grossPct - merA, years);
  const serB = growSeries(initial, contrib, grossPct - merB, years);
  const series = serA.map((v, i) => ({ year: i, fundA: Math.round(v), fundB: Math.round(serB[i]) }));
  return {
    series,
    finalA: Math.round(serA[years]),
    finalB: Math.round(serB[years]),
    difference: Math.round(Math.abs(serA[years] - serB[years])),
  };
}

export function MerExpenses() {
  const [initial,  setInitial]  = useState(50_000);
  const [contrib,  setContrib]  = useState(6_000);
  const [ret,      setRet]      = useState(8);
  const [merA,     setMerA]     = useState(2.0);
  const [merAName, setMerAName] = useState('Active Fund');
  const [merB,     setMerB]     = useState(0.20);
  const [merBName, setMerBName] = useState('Index ETF');
  const [years,    setYears]    = useState(30);

  const r = useMemo(
    () => computeMer(initial, contrib, ret, merA, merB, years),
    [initial, contrib, ret, merA, merB, years],
  );

  return (
    <CalculatorShell
      title="MER / Fund Expenses"
      description="Compare two funds with different Management Expense Ratios and see how the gap compounds over time."
      inputs={<>
        <NumInput label="Starting Portfolio Value" value={initial} onChange={setInitial} min={1_000} step={5_000} prefix="$" />
        <NumInput label="Annual Contribution"      value={contrib} onChange={setContrib} min={0}     step={1_000} prefix="$" />
        <NumInput label="Expected Gross Return"    value={ret}     onChange={setRet}     min={0}     max={30}     step={0.5} suffix="%" help="Before MER deduction" />
        <Separator />
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Fund A Name</Label>
          <Input value={merAName} onChange={e => setMerAName(e.target.value)} placeholder="e.g. Active Mutual Fund" />
        </div>
        <NumInput label="Fund A MER" value={merA} onChange={setMerA} min={0} max={5} step={0.01} suffix="%" help="Active mutual funds: 1.5% – 2.5%" />
        <Separator />
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Fund B Name</Label>
          <Input value={merBName} onChange={e => setMerBName(e.target.value)} placeholder="e.g. Index ETF" />
        </div>
        <NumInput label="Fund B MER" value={merB} onChange={setMerB} min={0} max={5} step={0.01} suffix="%" help="Index ETFs: 0.05% – 0.30%" />
        <Separator />
        <NumInput label="Investment Horizon" value={years} onChange={setYears} min={1} max={50} step={1} suffix="years" />
      </>}
      results={<>
        {/* Key stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatBox label={merAName}         value={fmtCompact(r.finalA)}     sub={`${merA}% MER`} />
          <StatBox label={merBName}         value={fmtCompact(r.finalB)}     sub={`${merB}% MER`} />
          <StatBox label="MER Gap (final value)" value={fmtCompact(r.difference)} sub={`${Math.abs(merA - merB).toFixed(2)}% annual drag`} highlight="negative" />
        </div>

        {/* Growth chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fund Growth Comparison Over {years} Years</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="fundA" name={`${merAName} (${merA}%)`} stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                <Line type="monotone" dataKey="fundB" name={`${merBName} (${merB}%)`} stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* MER breakdown table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">What You Pay in MER Each Year</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y text-sm">
              {[
                { name: merAName, mer: merA, final: r.finalA, color: '#ef4444' },
                { name: merBName, mer: merB, final: r.finalB, color: '#3b82f6' },
              ].map((f, i) => {
                const approxFirstYearFee = initial * (f.mer / 100);
                const approxLastYearFee  = f.final * (f.mer / 100);
                return (
                  <div key={i} className="py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.mer}% MER</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      <p>Year 1 fee: <strong className="text-foreground">{fmtDollar(approxFirstYearFee)}</strong></p>
                      <p>Year {years} fee: <strong className="text-foreground">{fmtDollar(approxLastYearFee)}</strong></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Insight */}
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            The{' '}
            <strong className="text-foreground">{Math.abs(merA - merB).toFixed(2)}%</strong> MER
            difference between <em>{merAName}</em> and <em>{merBName}</em> compounds into a{' '}
            <strong className="text-foreground">{fmtDollar(r.difference)}</strong> gap
            over {years} years. MERs are deducted silently from fund assets — you never see
            a bill, but the drag is very real.
          </p>
        </div>
      </>}
    />
  );
}
