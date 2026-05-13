// src/components/calculators/options/CashSecuredPut.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

function compute(
  strike: number,
  premium: number,
  days: number,
  current: number,
  contracts: number,
) {
  const shares = contracts * 100;
  const totalPremium = premium * shares;
  const effectiveBuy = strike - premium;
  const annualizedYield =
    strike > 0 && days > 0 ? (premium / strike) * (365 / days) * 100 : 0;
  const maxGain = totalPremium;
  const breakEven = strike - premium;
  const capitalRequired = strike * shares;
  const discountPct = current > 0 ? ((current - effectiveBuy) / current) * 100 : 0;

  const payoff = (P: number) => {
    const intrinsic = Math.max(0, strike - P);
    return (premium - intrinsic) * shares;
  };

  const pMax = Math.max(current * 2, strike * 1.5, 1);
  const steps = 60;
  const series: { price: number; pnl: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const P = (pMax * i) / steps;
    series.push({ price: +P.toFixed(2), pnl: Math.round(payoff(P)) });
  }

  return {
    shares,
    effectiveBuy,
    annualizedYield,
    maxGain,
    breakEven,
    capitalRequired,
    discountPct,
    series,
  };
}

export function CashSecuredPut() {
  const [strike, setStrike]       = useState(95);
  const [premium, setPremium]     = useState(2);
  const [days, setDays]           = useState(30);
  const [current, setCurrent]     = useState(100);
  const [contracts, setContracts] = useState(1);

  const r = useMemo(
    () => compute(strike, premium, days, current, contracts),
    [strike, premium, days, current, contracts],
  );

  return (
    <CalculatorShell
      title="Cash-Secured Put"
      description="Sell put options backed by cash to collect premium and potentially buy shares at a discount."
      inputs={
        <>
          <NumInput
            label="Put Strike Price"
            value={strike}
            onChange={setStrike}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Premium Received per Share"
            value={premium}
            onChange={setPremium}
            min={0}
            step={0.1}
            prefix="$"
          />
          <NumInput
            label="Days to Expiry"
            value={days}
            onChange={setDays}
            min={1}
            max={730}
            step={1}
            suffix="days"
          />
          <NumInput
            label="Underlying Current Price"
            value={current}
            onChange={setCurrent}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Contracts"
            value={contracts}
            onChange={setContracts}
            min={1}
            step={1}
            help="1 contract = 100 shares"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox
              label="Effective Buy Price"
              value={fmtDollar(r.effectiveBuy)}
              sub="If assigned"
            />
            <StatBox
              label="Annualized Yield"
              value={`${r.annualizedYield.toFixed(2)}%`}
              sub="On strike capital"
              highlight={r.annualizedYield > 10 ? 'positive' : undefined}
            />
            <StatBox
              label="Max Gain"
              value={fmtDollar(r.maxGain)}
              sub="Premium kept"
              highlight="positive"
            />
            <StatBox
              label="Break-even Price"
              value={fmtDollar(r.breakEven)}
              sub="Below = loss"
            />
            <StatBox
              label="Capital Required"
              value={fmtDollar(r.capitalRequired)}
              sub="Cash secured"
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Payoff at Expiry
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="price"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${Number(v).toFixed(0)}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="rgba(128,128,128,0.5)" strokeWidth={1} />
                  <ReferenceLine
                    x={r.breakEven}
                    stroke="#ef4444"
                    strokeDasharray="4 3"
                    label={{ value: 'Break-even', position: 'top', fontSize: 10, fill: '#ef4444' }}
                  />
                  <ReferenceLine
                    x={strike}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: 'Strike (assign)', position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    name="Short Put P&L"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingDown className="h-4 w-4 text-amber-500" />}>
            If assigned, you'd own shares at{' '}
            <strong className="text-foreground">{fmtDollar(r.effectiveBuy)}</strong>{' '}
            effective cost —{' '}
            <strong className="text-foreground">{r.discountPct.toFixed(2)}%</strong>{' '}
            below current market price.
          </Callout>
        </>
      }
    />
  );
}
