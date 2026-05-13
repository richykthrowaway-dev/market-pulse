// src/components/calculators/options/OptionsPnl.tsx
import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';

type OptionType = 'call' | 'put';
type Direction = 'long' | 'short';

function ToggleGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn('w-full', value === opt.value && 'font-semibold')}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function OptionsPnl() {
  const [optionType, setOptionType] = useState<OptionType>('call');
  const [direction, setDirection] = useState<Direction>('long');
  const [strike, setStrike] = useState(100);
  const [premium, setPremium] = useState(5);
  const [current, setCurrent] = useState(100);
  const [contracts, setContracts] = useState(1);

  const r = useMemo(() => {
    const shares = contracts * 100;
    const totalPremium = premium * shares;
    const isCall = optionType === 'call';
    const isLong = direction === 'long';

    const payoff = (P: number): number => {
      const intrinsic = isCall ? Math.max(0, P - strike) : Math.max(0, strike - P);
      const longPnl = (intrinsic - premium) * shares;
      return isLong ? longPnl : -longPnl;
    };

    const breakEven = isCall ? strike + premium : strike - premium;

    const maxGain = isLong
      ? (isCall ? Infinity : (strike - premium) * shares)
      : totalPremium;
    const maxLoss = isLong
      ? -totalPremium
      : (isCall ? -Infinity : -(strike - premium) * shares);

    const currentIntrinsic =
      (isCall ? Math.max(0, current - strike) : Math.max(0, strike - current)) * shares;
    const currentPnl = payoff(current);

    const movePct = current > 0 ? ((breakEven - current) / current) * 100 : 0;

    const series: { price: number; pnl: number }[] = [];
    const max = Math.max(strike * 2, current * 1.5, 1);
    const step = max / 40;
    for (let p = 0; p <= max + 1e-9; p += step) {
      series.push({ price: Number(p.toFixed(2)), pnl: Math.round(payoff(p)) });
    }

    return {
      shares, totalPremium, isCall, isLong,
      breakEven, maxGain, maxLoss, currentIntrinsic, currentPnl, movePct, series,
    };
  }, [optionType, direction, strike, premium, current, contracts]);

  const fmtUnlimited = (v: number) =>
    !isFinite(v) ? (v > 0 ? 'Unlimited' : 'Unlimited Loss') : fmtDollar(v);

  const moveDir = r.movePct >= 0 ? 'up' : 'down';
  const moveAbs = Math.abs(r.movePct);

  return (
    <CalculatorShell
      title="Options P&L"
      description="Visualize the payoff diagram and profit/loss profile of a single-leg options trade at expiry."
      inputs={
        <>
          <ToggleGroup
            label="Option Type"
            value={optionType}
            onChange={setOptionType}
            options={[
              { value: 'call', label: 'Call' },
              { value: 'put', label: 'Put' },
            ]}
          />
          <ToggleGroup
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'long', label: 'Long (Buy)' },
              { value: 'short', label: 'Short (Sell)' },
            ]}
          />
          <NumInput
            label="Strike Price"
            value={strike}
            onChange={setStrike}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Premium per Share"
            value={premium}
            onChange={setPremium}
            min={0}
            step={0.25}
            prefix="$"
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
            help="Each contract = 100 shares"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox
              label="Break-even"
              value={fmtDollar(r.breakEven)}
              sub="Underlying price"
            />
            <StatBox
              label="Max Gain"
              value={fmtUnlimited(r.maxGain)}
              sub="At expiry"
              highlight="positive"
            />
            <StatBox
              label="Max Loss"
              value={fmtUnlimited(r.maxLoss)}
              sub="At expiry"
              highlight="negative"
            />
            <StatBox
              label="Current Intrinsic"
              value={fmtDollar(r.currentIntrinsic)}
              sub="If exercised now"
            />
            <StatBox
              label="Current P&L"
              value={fmtDollar(r.currentPnl)}
              sub="At today's price"
              highlight={r.currentPnl >= 0 ? 'positive' : 'negative'}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Payoff Diagram at Expiry
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="price"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${v}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(128,128,128,0.5)" strokeWidth={1} />
                  <ReferenceLine
                    x={r.breakEven}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: 'Break-even', position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <ReferenceLine
                    x={current}
                    stroke="#3b82f6"
                    strokeDasharray="4 3"
                    label={{ value: 'Current', position: 'top', fontSize: 10, fill: '#3b82f6' }}
                  />
                  <Line
                    type="linear"
                    dataKey="pnl"
                    name="P&L at Expiry"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            Break-even at{' '}
            <strong className="text-foreground">{fmtDollar(r.breakEven)}</strong> — underlying needs
            to move{' '}
            <strong className="text-foreground">
              {moveAbs.toFixed(2)}% {moveDir}
            </strong>{' '}
            from here for this trade to be profitable.
          </Callout>
        </>
      }
    />
  );
}
