// src/components/calculators/options/VerticalSpread.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

type Strategy = 'bull_call' | 'bear_call' | 'bull_put' | 'bear_put';

const STRATEGY_LABELS: Record<Strategy, string> = {
  bull_call: 'Bull Call',
  bear_call: 'Bear Call',
  bull_put: 'Bull Put',
  bear_put: 'Bear Put',
};

const STRATEGY_KIND: Record<Strategy, 'debit' | 'credit'> = {
  bull_call: 'debit',
  bear_call: 'credit',
  bull_put: 'credit',
  bear_put: 'debit',
};

interface ComputeArgs {
  strategy: Strategy;
  lower: number;
  higher: number;
  lowerPrem: number;
  higherPrem: number;
  contracts: number;
  current: number;
}

function payoffAt(strategy: Strategy, P: number, lower: number, higher: number, lowerPrem: number, higherPrem: number, contracts: number): number {
  const mult = 100 * contracts;
  switch (strategy) {
    case 'bull_call': {
      // long lower call, short higher call
      const longLeg = Math.max(P - lower, 0) - lowerPrem;
      const shortLeg = higherPrem - Math.max(P - higher, 0);
      return (longLeg + shortLeg) * mult;
    }
    case 'bear_call': {
      // short lower call, long higher call
      const shortLeg = lowerPrem - Math.max(P - lower, 0);
      const longLeg = Math.max(P - higher, 0) - higherPrem;
      return (shortLeg + longLeg) * mult;
    }
    case 'bull_put': {
      // long lower put, short higher put
      const longLeg = Math.max(lower - P, 0) - lowerPrem;
      const shortLeg = higherPrem - Math.max(higher - P, 0);
      return (longLeg + shortLeg) * mult;
    }
    case 'bear_put': {
      // short lower put, long higher put
      const shortLeg = lowerPrem - Math.max(lower - P, 0);
      const longLeg = Math.max(higher - P, 0) - higherPrem;
      return (shortLeg + longLeg) * mult;
    }
  }
}

function compute(args: ComputeArgs) {
  const { strategy, lower, higher, lowerPrem, higherPrem, contracts, current } = args;
  const width = Math.max(higher - lower, 0);
  const mult = 100 * contracts;
  const kind = STRATEGY_KIND[strategy];

  let netDebit = 0; // positive = pay, negative = receive
  let maxProfit = 0;
  let maxLoss = 0;
  let breakeven = 0;
  let capitalRequired = 0;

  switch (strategy) {
    case 'bull_call': {
      netDebit = (lowerPrem - higherPrem) * mult;
      maxProfit = width * mult - netDebit;
      maxLoss = netDebit;
      breakeven = lower + (lowerPrem - higherPrem);
      capitalRequired = netDebit;
      break;
    }
    case 'bear_call': {
      // short lower call (collect lowerPrem), long higher call (pay higherPrem)
      const netCredit = (lowerPrem - higherPrem) * mult;
      netDebit = -netCredit;
      maxProfit = netCredit;
      maxLoss = width * mult - netCredit;
      breakeven = lower + (lowerPrem - higherPrem);
      capitalRequired = width * mult - netCredit;
      break;
    }
    case 'bull_put': {
      // short higher put (collect higherPrem), long lower put (pay lowerPrem)
      const netCredit = (higherPrem - lowerPrem) * mult;
      netDebit = -netCredit;
      maxProfit = netCredit;
      maxLoss = width * mult - netCredit;
      breakeven = higher - (higherPrem - lowerPrem);
      capitalRequired = width * mult - netCredit;
      break;
    }
    case 'bear_put': {
      // long higher put, short lower put
      netDebit = (higherPrem - lowerPrem) * mult;
      maxProfit = width * mult - netDebit;
      maxLoss = netDebit;
      breakeven = higher - (higherPrem - lowerPrem);
      capitalRequired = netDebit;
      break;
    }
  }

  const riskReward = maxLoss > 0 ? maxProfit / Math.abs(maxLoss) : 0;

  // Chart series
  const pMin = Math.max(0, lower - 10);
  const pMax = higher + 10;
  const steps = 80;
  const series: { price: number; pnl: number; profit: number | null; loss: number | null }[] = [];
  for (let i = 0; i <= steps; i++) {
    const P = pMin + ((pMax - pMin) * i) / steps;
    const pnl = payoffAt(strategy, P, lower, higher, lowerPrem, higherPrem, contracts);
    series.push({
      price: +P.toFixed(2),
      pnl: Math.round(pnl),
      profit: pnl >= 0 ? Math.round(pnl) : null,
      loss: pnl < 0 ? Math.round(pnl) : null,
    });
  }

  return {
    kind,
    netDebit, // sign convention: positive = debit (cost), negative = credit (received)
    maxProfit,
    maxLoss,
    breakeven,
    riskReward,
    capitalRequired,
    width,
    series,
    pMin,
    pMax,
    current,
  };
}

export function VerticalSpread() {
  const [strategy, setStrategy] = useState<Strategy>('bull_call');
  const [lower, setLower] = useState(100);
  const [higher, setHigher] = useState(105);
  const [lowerPrem, setLowerPrem] = useState(3.5);
  const [higherPrem, setHigherPrem] = useState(1.5);
  const [contracts, setContracts] = useState(1);
  const [current, setCurrent] = useState(102);

  const r = useMemo(
    () => compute({ strategy, lower, higher, lowerPrem, higherPrem, contracts, current }),
    [strategy, lower, higher, lowerPrem, higherPrem, contracts, current],
  );

  const isCredit = r.kind === 'credit';

  const calloutText = (() => {
    switch (strategy) {
      case 'bull_call':
        return `Profits when stock rises above $${r.breakeven.toFixed(2)}. Gains cap at $${higher} but risk is limited to ${fmtDollar(r.maxLoss)}.`;
      case 'bear_call':
        return `Profits when stock stays below $${r.breakeven.toFixed(2)}. Keeps full credit of ${fmtDollar(r.maxProfit)} if expires below $${lower}; max loss ${fmtDollar(r.maxLoss)}.`;
      case 'bull_put':
        return `Profits when stock stays above $${r.breakeven.toFixed(2)}. Keeps full credit of ${fmtDollar(r.maxProfit)} if expires above $${higher}; max loss ${fmtDollar(r.maxLoss)}.`;
      case 'bear_put':
        return `Profits when stock falls below $${r.breakeven.toFixed(2)}. Gains cap at $${lower} but risk is limited to ${fmtDollar(r.maxLoss)}.`;
    }
  })();

  return (
    <CalculatorShell
      title="Vertical Spread"
      description="Two-leg call or put spread — defined risk, defined reward."
      inputs={
        <>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Strategy</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STRATEGY_LABELS) as Strategy[]).map(s => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={strategy === s ? 'default' : 'outline'}
                  onClick={() => setStrategy(s)}
                  className="text-xs h-8"
                >
                  {STRATEGY_LABELS[s]}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {STRATEGY_KIND[strategy] === 'debit' ? 'Debit spread — pay net premium' : 'Credit spread — collect net premium'}
            </p>
          </div>
          <NumInput label="Lower Strike" value={lower} onChange={setLower} min={0} step={1} prefix="$" />
          <NumInput label="Higher Strike" value={higher} onChange={setHigher} min={0} step={1} prefix="$" />
          <NumInput label="Lower-Strike Premium / Share" value={lowerPrem} onChange={setLowerPrem} min={0} step={0.05} prefix="$" />
          <NumInput label="Higher-Strike Premium / Share" value={higherPrem} onChange={setHigherPrem} min={0} step={0.05} prefix="$" />
          <NumInput label="Contracts" value={contracts} onChange={setContracts} min={1} step={1} help="100 shares per contract" />
          <NumInput label="Current Stock Price" value={current} onChange={setCurrent} min={0} step={1} prefix="$" />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox
              label={isCredit ? 'Net Credit' : 'Net Debit'}
              value={fmtDollar(Math.abs(r.netDebit))}
              sub={isCredit ? 'Cash received' : 'Cash paid'}
              highlight={isCredit ? 'positive' : 'negative'}
            />
            <StatBox
              label="Max Profit"
              value={fmtDollar(r.maxProfit)}
              sub={`${fmtDollar(r.maxProfit / Math.max(contracts, 1))} / contract`}
              highlight="positive"
            />
            <StatBox
              label="Max Loss"
              value={fmtDollar(r.maxLoss)}
              sub={`${fmtDollar(r.maxLoss / Math.max(contracts, 1))} / contract`}
              highlight="negative"
            />
            <StatBox
              label="Breakeven"
              value={`$${r.breakeven.toFixed(2)}`}
              sub="Stock price at expiry"
            />
            <StatBox
              label="Risk : Reward"
              value={r.riskReward > 0 ? `1 : ${r.riskReward.toFixed(2)}` : '—'}
              sub="Profit per $1 risked"
              highlight={r.riskReward >= 1 ? 'positive' : 'warning'}
            />
            <StatBox
              label="Capital Required"
              value={fmtDollar(r.capitalRequired)}
              sub={isCredit ? 'Margin = width − credit' : 'Net debit paid'}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payoff at Expiry</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="price"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${Number(v).toFixed(0)}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip labelPrefix="Price $" />} />
                  <ReferenceLine y={0} stroke="rgba(128,128,128,0.5)" strokeWidth={1} />
                  <ReferenceLine
                    x={r.breakeven}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: 'Breakeven', position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <ReferenceLine
                    x={current}
                    stroke="#3b82f6"
                    strokeDasharray="2 2"
                    label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="loss"
                    name="Loss"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            {calloutText}
          </Callout>
        </>
      }
    />
  );
}
