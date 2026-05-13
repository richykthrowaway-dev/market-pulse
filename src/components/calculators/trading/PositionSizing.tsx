// src/components/calculators/trading/PositionSizing.tsx
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';
import { usePortfolio } from '@/hooks/usePortfolio';

export function PositionSizing() {
  const [portfolioValue, setPortfolioValue] = useState(100_000);
  const [riskPct, setRiskPct]               = useState(1);
  const [entry, setEntry]                   = useState(100);
  const [stopLoss, setStopLoss]             = useState(95);
  const [autoFilled, setAutoFilled]         = useState(false);

  const { data: holdings } = usePortfolio();

  const portfolioTotal = useMemo(() => {
    return (holdings ?? []).reduce(
      (s: number, h: any) => s + (Number(h?.market_value) || 0),
      0,
    );
  }, [holdings]);

  useEffect(() => {
    if (portfolioTotal > 0 && portfolioValue === 100_000 && !autoFilled) {
      setPortfolioValue(Math.round(portfolioTotal));
      setAutoFilled(true);
    }
  }, [portfolioTotal, portfolioValue, autoFilled]);

  const {
    perShareRisk,
    maxDollarRisk,
    maxShares,
    positionValue,
    actualRiskPct,
    remaining,
  } = useMemo(() => {
    const perShareRisk = Math.abs(entry - stopLoss);
    const maxDollarRisk = portfolioValue * (riskPct / 100);
    const maxShares = perShareRisk > 0 ? Math.floor(maxDollarRisk / perShareRisk) : 0;
    const positionValue = maxShares * entry;
    const actualRiskPct =
      portfolioValue > 0 ? (maxShares * perShareRisk / portfolioValue) * 100 : 0;
    const remaining = Math.max(0, portfolioValue - positionValue);
    return { perShareRisk, maxDollarRisk, maxShares, positionValue, actualRiskPct, remaining };
  }, [portfolioValue, riskPct, entry, stopLoss]);

  // Stacked bar: one row, segments = Position Value, Remaining Cash, Amount at Risk overlay
  const chartData = useMemo(
    () => [
      {
        name: 'Portfolio',
        position: Math.max(0, positionValue - maxDollarRisk),
        risk: Math.min(positionValue, maxDollarRisk),
        remaining,
      },
    ],
    [positionValue, maxDollarRisk, remaining],
  );

  return (
    <CalculatorShell
      title="Position Sizing"
      description="Calculate the right share count so a single trade never risks more than your chosen % of capital."
      inputs={
        <>
          <NumInput
            label="Portfolio Value"
            value={portfolioValue}
            onChange={v => { setPortfolioValue(v); setAutoFilled(false); }}
            min={0}
            step={1000}
            prefix="$"
            help={autoFilled ? 'Auto-filled from your portfolio' : undefined}
          />
          <NumInput
            label="Risk Per Trade"
            value={riskPct}
            onChange={setRiskPct}
            min={0.1}
            max={10}
            step={0.1}
            suffix="%"
            help="Most pros risk 0.5%–2% per trade"
          />
          <NumInput
            label="Entry Price"
            value={entry}
            onChange={setEntry}
            min={0}
            step={0.5}
            prefix="$"
          />
          <NumInput
            label="Stop-Loss Price"
            value={stopLoss}
            onChange={setStopLoss}
            min={0}
            step={0.5}
            prefix="$"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Max Shares"
              value={maxShares.toLocaleString()}
              sub={`at ${fmtDollar(entry)} entry`}
              highlight="positive"
            />
            <StatBox
              label="Position Value"
              value={fmtCompact(positionValue)}
              sub={`${portfolioValue > 0 ? ((positionValue / portfolioValue) * 100).toFixed(1) : '0'}% of portfolio`}
            />
            <StatBox
              label="Max Dollar Risk"
              value={fmtCompact(maxDollarRisk)}
              sub={`${fmtDollar(perShareRisk)} / share`}
              highlight="negative"
            />
            <StatBox
              label="Risk % of Portfolio"
              value={`${actualRiskPct.toFixed(2)}%`}
              sub={actualRiskPct > 2 ? 'Above 2% — high risk' : 'Within safe range'}
              highlight={actualRiskPct > 2 ? 'warning' : 'positive'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Capital Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  stackOffset="sign"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={yFmt}
                    tick={{ fontSize: 11 }}
                    domain={[0, Math.max(portfolioValue, 1)]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="risk" name="Amount at Risk" stackId="a" fill="#ef4444" />
                  <Bar dataKey="position" name="Position (safe)" stackId="a" fill="#22c55e" />
                  <Bar dataKey="remaining" name="Remaining Cash" stackId="a" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            Risking <strong className="text-foreground">{riskPct}%</strong> of your{' '}
            <strong className="text-foreground">{fmtDollar(portfolioValue)}</strong> portfolio ={' '}
            <strong className="text-foreground">{fmtDollar(maxDollarRisk)}</strong> max loss →{' '}
            <strong className="text-foreground">{maxShares.toLocaleString()}</strong> shares at{' '}
            <strong className="text-foreground">{fmtDollar(entry)}</strong> entry with stop at{' '}
            <strong className="text-foreground">{fmtDollar(stopLoss)}</strong>.
          </Callout>
        </>
      }
    />
  );
}
