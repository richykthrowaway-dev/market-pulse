// src/components/calculators/options/CoveredCall.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
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
  shares: number,
  current: number,
  strike: number,
  premium: number,
  days: number,
) {
  const premiumIncome = premium * shares;
  const annualizedYield =
    current > 0 && days > 0 ? (premium / current) * (365 / days) * 100 : 0;
  const effectiveSellPrice = strike + premium;
  const downsideProtection = current > 0 ? (premium / current) * 100 : 0;
  const maxProfit = (strike - current + premium) * shares;

  const coveredCallPayoff = (P: number) => {
    const stockPnl = (P - current) * shares;
    const capped = P > strike ? (strike - current) * shares : stockPnl;
    return capped + premiumIncome;
  };
  const uncoveredPayoff = (P: number) => (P - current) * shares;

  const pMax = Math.max(current * 2, strike * 1.2, 1);
  const steps = 60;
  const series: { price: number; covered: number; uncovered: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const P = (pMax * i) / steps;
    series.push({
      price: +P.toFixed(2),
      covered: Math.round(coveredCallPayoff(P)),
      uncovered: Math.round(uncoveredPayoff(P)),
    });
  }

  return {
    premiumIncome,
    annualizedYield,
    effectiveSellPrice,
    downsideProtection,
    maxProfit,
    series,
  };
}

export function CoveredCall() {
  const [shares, setShares]     = useState(100);
  const [current, setCurrent]   = useState(100);
  const [strike, setStrike]     = useState(110);
  const [premium, setPremium]   = useState(2);
  const [days, setDays]         = useState(30);

  const r = useMemo(
    () => compute(shares, current, strike, premium, days),
    [shares, current, strike, premium, days],
  );

  return (
    <CalculatorShell
      title="Covered Call"
      description="Sell call options against shares you own to generate premium income."
      inputs={
        <>
          <NumInput
            label="Shares Owned"
            value={shares}
            onChange={setShares}
            min={1}
            step={100}
          />
          <NumInput
            label="Current Stock Price"
            value={current}
            onChange={setCurrent}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Call Strike Price"
            value={strike}
            onChange={setStrike}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Call Premium per Share"
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
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox
              label="Premium Income"
              value={fmtDollar(r.premiumIncome)}
              sub="Cash received"
              highlight="positive"
            />
            <StatBox
              label="Annualized Yield"
              value={`${r.annualizedYield.toFixed(2)}%`}
              sub="From premium"
              highlight={r.annualizedYield > 10 ? 'positive' : undefined}
            />
            <StatBox
              label="Effective Sell Price"
              value={fmtDollar(r.effectiveSellPrice)}
              sub="If assigned"
            />
            <StatBox
              label="Downside Protection"
              value={`${r.downsideProtection.toFixed(2)}%`}
              sub="Premium cushion"
            />
            <StatBox
              label="Max Profit"
              value={fmtDollar(r.maxProfit)}
              sub="At/above strike"
              highlight="positive"
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
                    x={strike}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: 'Strike', position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uncovered"
                    name="Long Stock Only"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="covered"
                    name="Covered Call P&L"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            Selling this call generates{' '}
            <strong className="text-foreground">{r.annualizedYield.toFixed(2)}%</strong>{' '}
            annualized yield and provides{' '}
            <strong className="text-foreground">{r.downsideProtection.toFixed(2)}%</strong>{' '}
            downside buffer.
          </Callout>
        </>
      }
    />
  );
}
