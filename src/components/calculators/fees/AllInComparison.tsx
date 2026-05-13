// src/components/calculators/fees/AllInComparison.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { fmtDollar, yFmt, growSeries } from '../calcUtils';

interface AllInScenario {
  name: string;
  totalFee: number;
  label: string;
  final: number;
  color: string;
}

function computeAllIn(
  initial: number,
  contrib: number,
  grossPct: number,
  years: number,
  advisorFee: number,
  etfMer: number,
  mfMer: number,
): AllInScenario[] {
  const scenarios = [
    { name: 'DIY + ETF',     totalFee: etfMer,                label: `${etfMer}% MER only`,                     color: '#22c55e' },
    { name: 'ETF + Advisor', totalFee: etfMer + advisorFee,   label: `${etfMer}% MER + ${advisorFee}% advisor`, color: '#3b82f6' },
    { name: 'Mutual Fund',   totalFee: mfMer,                 label: `${mfMer}% MER only`,                      color: '#f59e0b' },
    { name: 'MF + Advisor',  totalFee: mfMer + advisorFee,    label: `${mfMer}% MER + ${advisorFee}% advisor`,  color: '#ef4444' },
  ];
  return scenarios.map(s => {
    const vals = growSeries(initial, contrib, grossPct - s.totalFee, years);
    return { ...s, final: Math.round(vals[years]) };
  });
}

export function AllInComparison() {
  const [initial,    setInitial]    = useState(100_000);
  const [contrib,    setContrib]    = useState(12_000);
  const [ret,        setRet]        = useState(7);
  const [years,      setYears]      = useState(25);
  const [advisorFee, setAdvisorFee] = useState(1.0);
  const [etfMer,     setEtfMer]     = useState(0.20);
  const [mfMer,      setMfMer]      = useState(2.0);

  const result = useMemo(
    () => computeAllIn(initial, contrib, ret, years, advisorFee, etfMer, mfMer),
    [initial, contrib, ret, years, advisorFee, etfMer, mfMer],
  );

  return (
    <CalculatorShell
      title="All-In Cost Comparison"
      description="Compare four common investment setups side-by-side: from low-cost DIY to a fully managed mutual fund portfolio."
      inputs={<>
        <NumInput label="Starting Portfolio Value" value={initial}    onChange={setInitial}    min={1_000} step={5_000} prefix="$" />
        <NumInput label="Annual Contribution"      value={contrib}    onChange={setContrib}    min={0}     step={1_000} prefix="$" />
        <NumInput label="Expected Gross Return"    value={ret}        onChange={setRet}        min={0}     max={30}     step={0.5} suffix="%" />
        <NumInput label="Investment Horizon"       value={years}      onChange={setYears}      min={1}     max={50}     step={1}   suffix="years" />
        <Separator />
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Customise Assumptions
        </p>
        <NumInput label="Advisor / Manager Fee" value={advisorFee} onChange={setAdvisorFee} min={0} max={5}   step={0.1}  suffix="% AUM/yr" />
        <NumInput label="ETF MER"               value={etfMer}     onChange={setEtfMer}     min={0} max={3}   step={0.01} suffix="%" />
        <NumInput label="Mutual Fund MER"       value={mfMer}      onChange={setMfMer}      min={0} max={5}   step={0.1}  suffix="%" />
      </>}
      results={<>
        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Final Portfolio Value After {years} Years</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={result} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as AllInScenario;
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{d.label}</p>
                        <p className="font-bold mt-1 tabular-nums">{fmtDollar(d.final)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="final" name="Final Value" radius={[5, 5, 0, 0]}>
                  {result.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Breakdown table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scenario Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y text-sm">
              {result.map((s, i) => {
                const best       = result[0].final;
                const costVsBest = best - s.final;
                const pctLost    = best > 0 ? (costVsBest / best) * 100 : 0;
                return (
                  <div key={i} className="py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums">{fmtDollar(s.final)}</p>
                      {costVsBest > 0 ? (
                        <p className="text-xs text-destructive tabular-nums">
                          −{fmtDollar(costVsBest)}{' '}
                          <span className="text-muted-foreground">({pctLost.toFixed(1)}% less)</span>
                        </p>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 mt-0.5">
                          Best outcome
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Insight */}
        <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          The worst-case scenario (Mutual Fund + Advisor) costs{' '}
          <strong className="text-foreground">
            {fmtDollar(result[0].final - result[result.length - 1].final)}
          </strong>{' '}
          more than DIY + ETF over {years} years — a{' '}
          <strong className="text-foreground">
            {result[0].final > 0
              ? (((result[0].final - result[result.length - 1].final) / result[0].final) * 100).toFixed(1)
              : '0'}%
          </strong>{' '}
          reduction in final wealth driven entirely by fees.
        </Callout>
      </>}
    />
  );
}
