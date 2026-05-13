// src/components/calculators/trading/ShortSelling.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

export function ShortSelling() {
  const [entry, setEntry] = useState(100);
  const [exit, setExit] = useState(80);
  const [shares, setShares] = useState(100);
  const [borrowRate, setBorrowRate] = useState(2);
  const [days, setDays] = useState(30);

  const stats = useMemo(() => {
    const grossPnl = shares * (entry - exit);
    const borrowCost = (entry * shares) * (borrowRate / 100) * (days / 365);
    const netPnl = grossPnl - borrowCost;
    const breakEven = shares > 0 ? entry - (borrowCost / shares) : 0;
    const notional = entry * shares;
    const returnPct = notional > 0 ? (netPnl / notional) * 100 : 0;
    const annualizedReturn = days > 0 ? returnPct * (365 / days) : 0;
    return { grossPnl, borrowCost, netPnl, breakEven, returnPct, annualizedReturn };
  }, [entry, exit, shares, borrowRate, days]);

  const series = useMemo(() => {
    const points: { price: number; pnl: number }[] = [];
    const max = entry * 2;
    const step = max / 20;
    if (step <= 0) return points;
    for (let p = 0; p <= max + 1e-9; p += step) {
      const pnl = shares * (entry - p) - stats.borrowCost;
      points.push({ price: Number(p.toFixed(2)), pnl: Math.round(pnl * 100) / 100 });
    }
    return points;
  }, [entry, shares, stats.borrowCost]);

  return (
    <CalculatorShell
      title="Short Selling"
      description="Project P&L and break-even on a short position, including borrow costs."
      inputs={
        <>
          <NumInput
            label="Entry (Short) Price"
            value={entry}
            onChange={setEntry}
            min={0.01}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Current / Target Exit Price"
            value={exit}
            onChange={setExit}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Shares Shorted"
            value={shares}
            onChange={setShares}
            min={0}
            step={1}
            suffix="shares"
          />
          <NumInput
            label="Borrow Rate"
            value={borrowRate}
            onChange={setBorrowRate}
            min={0}
            max={100}
            step={0.1}
            suffix="%/yr"
            help="Annualized cost to borrow the shares"
          />
          <NumInput
            label="Days Held"
            value={days}
            onChange={setDays}
            min={1}
            max={3650}
            step={1}
            suffix="days"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox
              label="Net P&L"
              value={fmtCompact(stats.netPnl)}
              sub={`Gross ${fmtDollar(stats.grossPnl)}`}
              highlight={stats.netPnl >= 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Borrow Cost"
              value={fmtCompact(-Math.abs(stats.borrowCost))}
              sub={`${borrowRate}% × ${days}d`}
              highlight="negative"
            />
            <StatBox
              label="Break-even Price"
              value={fmtDollar(stats.breakEven)}
              sub="Net P&L = $0"
            />
            <StatBox
              label="Return"
              value={`${stats.returnPct.toFixed(2)}%`}
              sub="On notional"
              highlight={stats.returnPct >= 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Annualized Return"
              value={`${stats.annualizedReturn.toFixed(2)}%`}
              sub={`Over ${days} days`}
              highlight={stats.annualizedReturn >= 0 ? 'positive' : 'negative'}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                P&L vs. Exit Price
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="price"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${v}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <ReferenceLine
                    x={Number(stats.breakEven.toFixed(2))}
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    label={{ value: 'Break-even', fontSize: 10, fill: '#f59e0b', position: 'top' }}
                  />
                  <ReferenceLine
                    x={Number(entry.toFixed(2))}
                    stroke="#3b82f6"
                    strokeDasharray="4 2"
                    label={{ value: 'Entry', fontSize: 10, fill: '#3b82f6', position: 'top' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    name="P&L"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            Borrow costs of{' '}
            <strong className="text-foreground">{fmtDollar(stats.borrowCost)}</strong> over{' '}
            <strong className="text-foreground">{days}</strong> days shift your break-even from{' '}
            <strong className="text-foreground">{fmtDollar(entry)}</strong> to{' '}
            <strong className="text-foreground">{fmtDollar(stats.breakEven)}</strong>.
          </Callout>
        </>
      }
    />
  );
}
