// src/components/calculators/income/DividendGrowthModel.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar } from '../calcUtils';

// Intrinsic value V = D1 / (r - g) where D1 = D0 * (1 + g)
function gordonValue(dividend: number, growthPct: number, requiredPct: number): number {
  const g = growthPct / 100;
  const r = requiredPct / 100;
  if (r <= g) return Infinity;
  const D1 = dividend * (1 + g);
  return D1 / (r - g);
}

// price = D*(1+g) / (r-g) => g = (price*r - D) / (D + price)
function impliedGrowth(dividend: number, requiredPct: number, marketPrice: number): number {
  const r = requiredPct / 100;
  return ((marketPrice * r - dividend) / (dividend + marketPrice)) * 100;
}

export function DividendGrowthModel() {
  const [dividend, setDividend] = useState(4.0);
  const [growthRate, setGrowthRate] = useState(5);
  const [requiredReturn, setRequiredReturn] = useState(10);
  const [currentPrice, setCurrentPrice] = useState(80);

  const intrinsic = useMemo(
    () => gordonValue(dividend, growthRate, requiredReturn),
    [dividend, growthRate, requiredReturn],
  );

  const premiumPct = useMemo(() => {
    if (!isFinite(intrinsic) || currentPrice <= 0) return 0;
    return ((intrinsic - currentPrice) / currentPrice) * 100;
  }, [intrinsic, currentPrice]);

  const implied = useMemo(
    () => impliedGrowth(dividend, requiredReturn, currentPrice),
    [dividend, requiredReturn, currentPrice],
  );

  const undervalued = intrinsic > currentPrice;

  const growthValues = useMemo(
    () => [-2, -1, 0, 1, 2].map(d => growthRate + d),
    [growthRate],
  );
  const returnValues = useMemo(
    () => [-2, -1, 0, 1, 2].map(d => requiredReturn + d),
    [requiredReturn],
  );

  const matrix = useMemo(
    () => growthValues.map(g => returnValues.map(r => gordonValue(dividend, g, r))),
    [growthValues, returnValues, dividend],
  );

  const { minV, maxV } = useMemo(() => {
    const flat = matrix.flat().filter(v => isFinite(v));
    return {
      minV: flat.length ? Math.min(...flat) : 0,
      maxV: flat.length ? Math.max(...flat) : 0,
    };
  }, [matrix]);

  function cellColor(v: number): string {
    if (!isFinite(v)) return 'bg-muted text-muted-foreground';
    const norm = (v - minV) / (maxV - minV || 1);
    if (norm < 0.33) return 'bg-destructive/30';
    if (norm < 0.66) return 'bg-amber-500/30';
    return 'bg-green-500/30';
  }

  return (
    <CalculatorShell
      title="Dividend Growth Model"
      description="Estimate fair value of a dividend-paying stock using the Gordon Growth Model."
      inputs={
        <>
          <NumInput
            label="Current Annual Dividend (per share)"
            value={dividend}
            onChange={setDividend}
            min={0}
            step={0.25}
            prefix="$"
          />
          <NumInput
            label="Dividend Growth Rate"
            value={growthRate}
            onChange={setGrowthRate}
            min={-10}
            max={50}
            step={0.5}
            suffix="%"
            help="Expected perpetual annual growth rate (g)"
          />
          <NumInput
            label="Required Rate of Return"
            value={requiredReturn}
            onChange={setRequiredReturn}
            min={0}
            max={50}
            step={0.5}
            suffix="%"
            help="Your discount rate (r). Must exceed growth rate."
          />
          <NumInput
            label="Current Market Price"
            value={currentPrice}
            onChange={setCurrentPrice}
            min={0.01}
            step={1}
            prefix="$"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox
              label="Intrinsic Value"
              value={isFinite(intrinsic) ? fmtDollar(intrinsic) : '∞'}
              sub="Gordon Growth fair value"
              highlight="positive"
            />
            <StatBox
              label="Market Price"
              value={fmtDollar(currentPrice)}
              sub="What you'd pay today"
            />
            <StatBox
              label={undervalued ? 'Discount to Intrinsic' : 'Premium to Intrinsic'}
              value={
                isFinite(intrinsic)
                  ? `${premiumPct >= 0 ? '+' : ''}${premiumPct.toFixed(1)}%`
                  : '—'
              }
              sub={undervalued ? 'Undervalued' : 'Overvalued'}
              highlight={undervalued ? 'positive' : 'negative'}
            />
            <StatBox
              label="Implied Growth Rate"
              value={`${implied.toFixed(2)}%`}
              sub="At current market price"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Sensitivity Heatmap — Intrinsic Value
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-6 gap-1 text-xs">
                <div></div>
                {returnValues.map(r => (
                  <div key={r} className="text-center font-semibold p-1 text-muted-foreground">
                    {r}% req
                  </div>
                ))}
                {growthValues.map((g, i) => (
                  <React.Fragment key={g}>
                    <div className="font-semibold p-1 text-muted-foreground flex items-center">
                      {g}% gr
                    </div>
                    {returnValues.map((r, j) => {
                      const v = matrix[i][j];
                      const isCurrent = g === growthRate && r === requiredReturn;
                      return (
                        <div
                          key={`${i}-${j}`}
                          className={`${cellColor(v)} ${
                            isCurrent ? 'ring-2 ring-foreground' : ''
                          } p-2 text-center rounded tabular-nums font-medium`}
                        >
                          {isFinite(v) ? `$${v.toFixed(0)}` : '—'}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Rows: growth rate (g). Columns: required return (r). Highlighted cell = your inputs.
                Cells where r ≤ g are undefined (model breaks down).
              </p>
            </CardContent>
          </Card>

          <Callout icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            At current price of{' '}
            <strong className="text-foreground">{fmtDollar(currentPrice)}</strong>, the market is
            pricing in{' '}
            <strong className="text-foreground">{implied.toFixed(2)}%</strong> perpetual dividend
            growth.
          </Callout>
        </>
      }
    />
  );
}
