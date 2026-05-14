import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, Info } from 'lucide-react';
import { computeDrawdown, annualVolatility, sharpe, sortino, annualReturn } from './riskMath';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

function fmtCurrency(v: number) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) { return v.toFixed(2) + '%'; }

interface Props {
  portfolioValue: number;
  returns?: number[];
  spyReturns?: number[];
  dates?: string[];
  isLoading: boolean;
}

export function HistoricalDrawdownCard({ portfolioValue, returns, spyReturns, dates, isLoading }: Props) {
  const portDD = useMemo(
    () => returns && dates && returns.length === dates.length ? computeDrawdown(returns, dates) : null,
    [returns, dates],
  );
  const spyDD = useMemo(
    () => spyReturns && dates && spyReturns.length === dates.length ? computeDrawdown(spyReturns, dates) : null,
    [spyReturns, dates],
  );

  const sharpeP = returns ? sharpe(returns) : 0;
  const sortinoP = returns ? sortino(returns) : 0;
  const volP = returns ? annualVolatility(returns) : 0;
  const annRet = returns ? annualReturn(returns) : 0;

  const sharpeSpy = spyReturns ? sharpe(spyReturns) : 0;
  const volSpy = spyReturns ? annualVolatility(spyReturns) : 0;

  const calmar = portDD && portDD.maxDrawdownPct > 0
    ? annRet / portDD.maxDrawdownPct
    : 0;

  const hasData = returns && returns.length >= 30 && portDD;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Historical Drawdown</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Calculating portfolio drawdown history…
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
            <TrendingDown className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Historical Drawdown</CardTitle>
              <CardDescription>Peak-to-trough loss based on your actual holdings over the last year</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Info className="h-4 w-4 text-amber-500 shrink-0" />
            <p>
              Return-series data not yet available. The <code className="text-[11px]">api-beta</code> edge function
              needs to be redeployed with the new portfolio-returns export.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build chart data: side-by-side portfolio + SPY drawdown lines
  const chartData = portDD.series.map((p, i) => ({
    date: p.date,
    portfolio: p.drawdown * 100,           // negative %
    spy: spyDD?.series[i]?.drawdown ? spyDD.series[i].drawdown * 100 : 0,
  }));

  const maxDDDollar = portfolioValue * portDD.maxDrawdownPct;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Historical Drawdown &amp; Risk-Adjusted Returns</CardTitle>
            <CardDescription>
              Your portfolio's peak-to-trough history over the last {portDD.series.length} trading days, vs SPY
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Max Drawdown</p>
            <p className="text-xl font-bold font-mono mt-0.5 text-destructive">−{fmtPct(portDD.maxDrawdownPct * 100)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">−{fmtCurrency(maxDDDollar)} · on {portDD.maxDrawdownDate}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SPY Max DD</p>
            <p className="text-xl font-bold font-mono mt-0.5">−{spyDD ? fmtPct(spyDD.maxDrawdownPct * 100) : '—'}</p>
            <p className={`text-[10px] mt-1 ${portDD.maxDrawdownPct > (spyDD?.maxDrawdownPct ?? 0) ? 'text-destructive' : 'text-green-500'}`}>
              {portDD.maxDrawdownPct > (spyDD?.maxDrawdownPct ?? 0) ? 'Worse than SPY' : 'Better than SPY'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Current Drawdown</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${portDD.currentDrawdownPct > 0.05 ? 'text-amber-500' : ''}`}>
              −{fmtPct(portDD.currentDrawdownPct * 100)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">below peak</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Trough Duration</p>
            <p className="text-xl font-bold font-mono mt-0.5">{portDD.maxDrawdownDuration} <span className="text-sm">days</span></p>
            <p className="text-[10px] text-muted-foreground mt-1">peak → trough</p>
          </div>
        </div>

        {/* Risk-adjusted return stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sharpe (1Y)</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${sharpeP < 0 ? 'text-destructive' : sharpeP < 1 ? '' : 'text-green-500'}`}>
              {sharpeP.toFixed(2)}
            </p>
            <p className={`text-[10px] mt-1 ${sharpeP > sharpeSpy ? 'text-green-500' : 'text-destructive'}`}>
              SPY: {sharpeSpy.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3" title="Sortino: like Sharpe but penalises only downside volatility">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sortino</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${sortinoP < 0 ? 'text-destructive' : sortinoP < 1.5 ? '' : 'text-green-500'}`}>
              {sortinoP.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">downside-adjusted</p>
          </div>
          <div className="rounded-lg border bg-card p-3" title="Calmar: annual return divided by max drawdown">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Calmar</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${calmar < 0 ? 'text-destructive' : calmar < 1 ? 'text-amber-500' : 'text-green-500'}`}>
              {isFinite(calmar) ? calmar.toFixed(2) : '∞'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">return / max DD</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Annual Vol</p>
            <p className="text-xl font-bold font-mono mt-0.5">{fmtPct(volP * 100)}</p>
            <p className={`text-[10px] mt-1 ${volP > volSpy ? 'text-destructive' : 'text-green-500'}`}>
              SPY: {fmtPct(volSpy * 100)}
            </p>
          </div>
        </div>

        {/* Drawdown chart */}
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs font-medium mb-2">
            Drawdown trajectory <span className="text-muted-foreground font-normal">— underwater plot vs SPY</span>
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="portDDGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="spyDDGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={v => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={v => `${v.toFixed(0)}%`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name === 'portfolio' ? 'Portfolio' : 'SPY']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="spy"
                  name="SPY"
                  stroke="hsl(var(--muted-foreground))"
                  fill="url(#spyDDGrad)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke="hsl(var(--destructive))"
                  fill="url(#portDDGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interpretation */}
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            Your portfolio's worst trough over the last year was <strong className="text-destructive">−{fmtPct(portDD.maxDrawdownPct * 100)}</strong>
            {' '}({fmtCurrency(maxDDDollar)} loss equivalent). It took <strong>{portDD.maxDrawdownDuration} days</strong> to
            reach the bottom from the prior peak. Sharpe of <strong>{sharpeP.toFixed(2)}</strong> means you earn{' '}
            <strong>{sharpeP.toFixed(2)}</strong> units of return for every unit of risk taken — SPY's benchmark is <strong>{sharpeSpy.toFixed(2)}</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
