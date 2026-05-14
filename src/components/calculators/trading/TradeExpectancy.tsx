// src/components/calculators/trading/TradeExpectancy.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

export function TradeExpectancy() {
  const [winRate, setWinRate] = useState(55);
  const [avgWin, setAvgWin] = useState(200);
  const [avgLoss, setAvgLoss] = useState(150);
  const [tradesPerMonth, setTradesPerMonth] = useState(20);

  const r = useMemo(() => {
    const wrFrac = winRate / 100;
    const expectancy = wrFrac * avgWin - (1 - wrFrac) * avgLoss;
    const denom = (100 - winRate) * avgLoss;
    const profitFactor = denom > 0 ? (winRate * avgWin) / denom : Infinity;
    const totalRR = avgWin + avgLoss;
    const breakEvenWR = totalRR > 0 ? (avgLoss / totalRR) * 100 : 0;
    const wrEdge = winRate - breakEvenWR;
    const monthlyExpected = expectancy * tradesPerMonth;
    const annualExpected = monthlyExpected * 12;
    const avgR = avgLoss > 0 ? avgWin / avgLoss : 0;

    const series: { month: number; pnl: number }[] = [];
    for (let m = 0; m <= 12; m++) {
      series.push({ month: m, pnl: monthlyExpected * m });
    }
    return {
      expectancy, profitFactor, breakEvenWR, wrEdge,
      monthlyExpected, annualExpected, avgR, series,
    };
  }, [winRate, avgWin, avgLoss, tradesPerMonth]);

  const positiveEdge = r.wrEdge >= 0 && r.expectancy > 0;

  return (
    <CalculatorShell
      title="Trade Expectancy"
      description="What is your edge mathematically worth per trade?"
      inputs={
        <>
          <NumInput
            label="Win Rate"
            value={winRate}
            onChange={setWinRate}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
          <NumInput
            label="Average Winner"
            value={avgWin}
            onChange={setAvgWin}
            min={0}
            step={10}
            prefix="$"
          />
          <NumInput
            label="Average Loser"
            value={avgLoss}
            onChange={setAvgLoss}
            min={0}
            step={10}
            prefix="$"
            help="Enter as a positive number"
          />
          <NumInput
            label="Trades / Month"
            value={tradesPerMonth}
            onChange={setTradesPerMonth}
            min={1}
            step={1}
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatBox
              label="Expectancy / Trade"
              value={fmtDollar(r.expectancy)}
              sub={`R-multiple ${r.avgR.toFixed(2)}`}
              highlight={r.expectancy > 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Profit Factor"
              value={isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : '∞'}
              sub="Gross win / gross loss"
              highlight={
                r.profitFactor < 1 ? 'warning'
                : r.profitFactor > 1.5 ? 'positive'
                : undefined
              }
            />
            <StatBox
              label="Break-even Win Rate"
              value={`${r.breakEvenWR.toFixed(1)}%`}
              sub="Required at this R:R"
            />
            <StatBox
              label="Win Rate Edge"
              value={`${r.wrEdge >= 0 ? '+' : ''}${r.wrEdge.toFixed(1)}%`}
              sub="Win rate − break-even"
              highlight={r.wrEdge >= 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Monthly Expected"
              value={fmtDollar(r.monthlyExpected)}
              sub={`${tradesPerMonth} trades`}
              highlight={r.monthlyExpected > 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Annual Expected"
              value={fmtDollar(r.annualExpected)}
              sub="If edge holds"
              highlight={r.annualExpected > 0 ? 'positive' : 'negative'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Projected Cumulative P&L (12 months)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-6">
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={r.series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={r.monthlyExpected >= 0 ? '#22c55e' : 'hsl(var(--destructive))'}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={r.monthlyExpected >= 0 ? '#22c55e' : 'hsl(var(--destructive))'}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={yFmt} tick={{ fontSize: 12 }} />
                    <RechartsTooltip content={<ChartTooltip labelPrefix="Month" />} />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      name="Cumulative P&L"
                      stroke={r.monthlyExpected >= 0 ? '#22c55e' : 'hsl(var(--destructive))'}
                      fill="url(#pnlGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            {positiveEdge ? (
              <>
                You have a positive edge of{' '}
                <strong className="text-foreground">{fmtDollar(r.expectancy)}</strong> per trade. At{' '}
                <strong className="text-foreground">{tradesPerMonth}</strong> trades / month, that's{' '}
                <strong className="text-foreground">{fmtDollar(r.annualExpected)}</strong> annually
                — assuming the edge holds and variance doesn't eat you alive.
              </>
            ) : (
              <>
                You're a losing trader at these stats. You need a win rate above{' '}
                <strong className="text-foreground">{r.breakEvenWR.toFixed(1)}%</strong> at this
                R:R, or you need to improve your average winner-to-loser ratio.
              </>
            )}
          </Callout>
        </>
      }
    />
  );
}
