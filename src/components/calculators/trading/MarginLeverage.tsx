// src/components/calculators/trading/MarginLeverage.tsx
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

export function MarginLeverage() {
  const [equity, setEquity] = useState(10_000);
  const [leverage, setLeverage] = useState(5);
  const [price, setPrice] = useState(100);
  const [units, setUnits] = useState(500);
  const [unitsTouched, setUnitsTouched] = useState(false);

  // Auto-derive units from equity/leverage/price until the user edits units manually
  useEffect(() => {
    if (!unitsTouched && price > 0) {
      setUnits(Math.max(0, Math.floor((equity * leverage) / price)));
    }
  }, [equity, leverage, price, unitsTouched]);

  const handleUnitsChange = (v: number) => {
    setUnitsTouched(true);
    setUnits(v);
  };

  const maintenanceMargin = 0.25;

  const stats = useMemo(() => {
    const totalExposure = units * price;
    const marginRequired = leverage > 0 ? totalExposure / leverage : 0;
    const marginCallPrice = units > 0
      ? (units * price - equity) / (units * (1 - maintenanceMargin))
      : 0;
    const liquidationPrice = units > 0 ? price - equity / units : 0;
    const lossAtMarginCall = Math.abs((marginCallPrice - price) * units);
    const dropPct = price > 0 ? ((price - marginCallPrice) / price) * 100 : 0;
    return {
      totalExposure,
      marginRequired,
      marginCallPrice,
      liquidationPrice,
      lossAtMarginCall,
      dropPct,
    };
  }, [equity, leverage, price, units]);

  const series = useMemo(() => {
    const points: { pct: number; equity: number; price: number }[] = [];
    for (let pct = -50; pct <= 50; pct += 5) {
      const newPrice = price * (1 + pct / 100);
      const newEquity = equity + units * (newPrice - price);
      points.push({
        pct,
        equity: Math.max(0, Math.round(newEquity)),
        price: Math.round(newPrice * 100) / 100,
      });
    }
    return points;
  }, [equity, units, price]);

  const marginCallPct = price > 0 ? ((stats.marginCallPrice - price) / price) * 100 : 0;
  const liquidationPct = price > 0 ? ((stats.liquidationPrice - price) / price) * 100 : 0;

  return (
    <CalculatorShell
      title="Margin / Leverage"
      description="See how leverage amplifies gains and where a margin call or liquidation hits."
      inputs={
        <>
          <NumInput
            label="Account Equity"
            value={equity}
            onChange={setEquity}
            min={0}
            step={500}
            prefix="$"
          />
          <NumInput
            label="Leverage Ratio"
            value={leverage}
            onChange={setLeverage}
            min={1}
            max={10}
            step={0.5}
            suffix="x"
          />
          <NumInput
            label="Asset Price"
            value={price}
            onChange={setPrice}
            min={0.01}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Position Size"
            value={units}
            onChange={handleUnitsChange}
            min={0}
            step={1}
            suffix="units"
            help="Defaults to floor(equity × leverage / price). Edit to override."
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Total Exposure"
              value={fmtCompact(stats.totalExposure)}
              sub={`${units} units × ${fmtDollar(price)}`}
            />
            <StatBox
              label="Margin Required"
              value={fmtCompact(stats.marginRequired)}
              sub={`At ${leverage}x leverage`}
            />
            <StatBox
              label="Margin Call Price"
              value={fmtDollar(stats.marginCallPrice)}
              sub={`${maintenanceMargin * 100}% maintenance`}
              highlight="warning"
            />
            <StatBox
              label="Liquidation Price"
              value={fmtDollar(stats.liquidationPrice)}
              sub="Equity hits $0"
              highlight="negative"
            />
            <StatBox
              label="Loss at Margin Call"
              value={`-${fmtCompact(stats.lossAtMarginCall)}`}
              sub={`${stats.dropPct.toFixed(1)}% drop from now`}
              highlight="negative"
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Equity vs. Price Movement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="pct"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    name="Equity"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#equityFill)"
                  />
                  <ReferenceLine
                    x={0}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label={{ value: 'Now', fontSize: 10, fill: '#94a3b8', position: 'top' }}
                  />
                  {marginCallPct >= -50 && marginCallPct <= 50 && (
                    <ReferenceLine
                      x={Math.round(marginCallPct)}
                      stroke="#f59e0b"
                      strokeDasharray="4 2"
                      label={{ value: 'Margin Call', fontSize: 10, fill: '#f59e0b', position: 'top' }}
                    />
                  )}
                  {liquidationPct >= -50 && liquidationPct <= 50 && (
                    <ReferenceLine
                      x={Math.round(liquidationPct)}
                      stroke="#ef4444"
                      strokeDasharray="4 2"
                      label={{ value: 'Liquidation', fontSize: 10, fill: '#ef4444', position: 'top' }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            A <strong className="text-foreground">{stats.dropPct.toFixed(1)}%</strong> drop
            triggers your margin call at{' '}
            <strong className="text-foreground">{fmtDollar(stats.marginCallPrice)}</strong> —
            only <strong className="text-foreground">{stats.dropPct.toFixed(1)}%</strong> below
            the current price of {fmtDollar(price)}.
          </Callout>
        </>
      }
    />
  );
}
