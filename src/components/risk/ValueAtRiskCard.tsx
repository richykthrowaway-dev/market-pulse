import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeVaR, type VarMetrics } from './riskMath';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

function fmtCurrency(v: number) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) { return v.toFixed(2) + '%'; }

interface Props {
  portfolioValue: number;
  returns?: number[];        // daily log returns from useBeta
  spyReturns?: number[];     // benchmark for comparison
  isLoading: boolean;
}

type Confidence = '95' | '99';
type Horizon = '1d' | '10d';

export function ValueAtRiskCard({ portfolioValue, returns, spyReturns, isLoading }: Props) {
  const [confidence, setConfidence] = useState<Confidence>('95');
  const [horizon, setHorizon] = useState<Horizon>('1d');

  const portMetrics: VarMetrics = useMemo(
    () => returns && returns.length >= 30 ? computeVaR(returns) : computeVaR([]),
    [returns],
  );
  const spyMetrics: VarMetrics = useMemo(
    () => spyReturns && spyReturns.length >= 30 ? computeVaR(spyReturns) : computeVaR([]),
    [spyReturns],
  );

  // Histogram bins for return distribution
  const histogram = useMemo(() => {
    if (!returns || returns.length === 0) return [];
    const sorted = [...returns].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;
    if (range === 0) return [];
    const BIN_COUNT = 25;
    const binWidth = range / BIN_COUNT;
    const bins: { binStart: number; binCenter: number; count: number; isTail: boolean }[] = [];
    const var95 = portMetrics.historical95;
    for (let i = 0; i < BIN_COUNT; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;
      const count = returns.filter(r => r >= binStart && (i === BIN_COUNT - 1 ? r <= binEnd : r < binEnd)).length;
      bins.push({ binStart, binCenter, count, isTail: binCenter <= -var95 });
    }
    return bins;
  }, [returns, portMetrics.historical95]);

  // Has data?
  const hasData = returns && returns.length >= 30;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Value at Risk (VaR)</CardTitle>
              <CardDescription>Loading return data…</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Computing daily return distribution…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Value at Risk (VaR)</CardTitle>
              <CardDescription>Statistical estimate of potential loss</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Info className="h-4 w-4 text-amber-500 shrink-0" />
            <p>
              Return-series data not yet available. The <code className="text-[11px]">api-beta</code> edge function
              needs to be redeployed with the new portfolio-returns export. Once deployed, VaR, CVaR, and historical
              drawdown will populate automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pick the right pair of metrics based on user selection
  const isParametric = horizon === '10d'; // 10d only available parametrically
  const portVarDecimal = isParametric
    ? (confidence === '95' ? portMetrics.tenDay95 : portMetrics.tenDay99)
    : (confidence === '95' ? portMetrics.historical95 : portMetrics.historical99);
  const portCvarDecimal = confidence === '95' ? portMetrics.cvar95 : portMetrics.cvar99;
  const spyVarDecimal = isParametric
    ? (confidence === '95' ? spyMetrics.tenDay95 : spyMetrics.tenDay99)
    : (confidence === '95' ? spyMetrics.historical95 : spyMetrics.historical99);

  const portVarDollar = portfolioValue * portVarDecimal;
  const portCvarDollar = portfolioValue * portCvarDecimal;
  const spyVarPct = spyVarDecimal * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Value at Risk (VaR)</CardTitle>
            <CardDescription>
              Statistical estimate of potential portfolio loss based on the last {returns.length} trading days
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            {(['95', '99'] as const).map(c => (
              <button
                key={c}
                onClick={() => setConfidence(c)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  confidence === c ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80',
                )}
              >
                {c}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">Horizon:</span>
            {(['1d', '10d'] as const).map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  horizon === h ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80',
                )}
              >
                {h === '1d' ? '1 day' : '10 days'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">VaR ({confidence}%, {horizon})</p>
            <p className="text-xl font-bold font-mono mt-0.5 text-destructive">−{fmtCurrency(portVarDollar)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{fmtPct(portVarDecimal * 100)} of portfolio</p>
          </div>
          <div className="rounded-lg border bg-card p-3" title="Conditional VaR: average loss when VaR threshold is breached">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CVaR ({confidence}%, 1d)</p>
            <p className="text-xl font-bold font-mono mt-0.5 text-destructive">−{fmtCurrency(portCvarDollar)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">expected loss in tail</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SPY {confidence}% {horizon}</p>
            <p className="text-xl font-bold font-mono mt-0.5">{fmtPct(spyVarPct)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">benchmark</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Relative</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${portVarDecimal * 100 > spyVarPct ? 'text-destructive' : 'text-green-500'}`}>
              {portVarDecimal * 100 > spyVarPct ? '+' : '−'}{fmtPct(Math.abs(portVarDecimal * 100 - spyVarPct))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">vs SPY tail risk</p>
          </div>
        </div>

        {/* Return distribution histogram */}
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs font-medium mb-2">
            Daily return distribution
            <span className="text-muted-foreground font-normal ml-2">
              red = tail beyond {confidence}% VaR ({fmtPct(portMetrics.historical95 * 100)} loss threshold)
            </span>
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <XAxis
                  dataKey="binCenter"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={v => (v * 100).toFixed(1) + '%'}
                />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={32} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v: number) => [`${v} days`, 'Frequency']}
                  labelFormatter={(v: number) => `Return: ${(v * 100).toFixed(2)}%`}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <ReferenceLine x={-portMetrics.historical95} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: 'VaR 95%', fontSize: 9, fill: 'hsl(var(--destructive))', position: 'insideTopRight' }} />
                <Bar dataKey="count">
                  {histogram.map((d, i) => (
                    <Cell key={i} fill={d.isTail ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} fillOpacity={d.isTail ? 0.7 : 0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interpretation */}
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            On a typical {horizon === '1d' ? 'day' : '10-day period'}, your portfolio is expected to lose no more than
            {' '}<strong className="text-destructive">{fmtCurrency(portVarDollar)}</strong> ({fmtPct(portVarDecimal * 100)})
            with <strong>{confidence}% confidence</strong>. In the worst {100 - +confidence}% of days, the average loss
            (CVaR) is <strong className="text-destructive">{fmtCurrency(portCvarDollar)}</strong>.
            {portVarDecimal * 100 > spyVarPct && (
              <> Your tail risk is <strong>{fmtPct(portVarDecimal * 100 - spyVarPct)}</strong> larger than SPY.</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
