// src/components/calculators/income/DividendIncomeProjector.tsx
import { useState, useMemo, useEffect } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

interface Holding { ticker: string; shares: number; dividend: number; }

const DEFAULT_HOLDINGS: Holding[] = [
  { ticker: 'AAPL', shares: 50, dividend: 0.96 },
  { ticker: 'MSFT', shares: 30, dividend: 3.00 },
  { ticker: 'JNJ',  shares: 40, dividend: 4.96 },
];

const DRIP_YIELD_ASSUMPTION = 0.04; // 4% baseline yield assumed reinvested

interface PortfolioHolding {
  ticker?: string;
  symbol?: string;
  shares?: number;
  quantity?: number;
  dividend_per_share?: number;
  annual_dividend?: number;
}

function compute(holdings: Holding[], growthPct: number, years: number, drip: boolean) {
  const currentAnnualIncome = holdings.reduce((s, h) => s + h.shares * h.dividend, 0);
  const series: { year: number; noDrip: number; drip: number }[] = [];

  let noDripIncome = currentAnnualIncome;
  let dripIncome = currentAnnualIncome;
  let totalDividends = 0;

  for (let y = 1; y <= years; y++) {
    noDripIncome = noDripIncome * (1 + growthPct / 100);
    dripIncome = dripIncome * (1 + growthPct / 100) * (1 + DRIP_YIELD_ASSUMPTION);
    const point = {
      year: y,
      noDrip: Math.round(noDripIncome),
      drip: drip ? Math.round(dripIncome) : Math.round(noDripIncome),
    };
    series.push(point);
    totalDividends += drip ? dripIncome : noDripIncome;
  }

  const projectedYearN = series.length > 0
    ? (drip ? series[series.length - 1].drip : series[series.length - 1].noDrip)
    : 0;

  // Yield on Holdings: annual income / estimated cost basis
  // Assume avg share price = annual dividend / 0.025 (2.5% reference yield) per holding
  const estimatedCost = holdings.reduce((s, h) => {
    const estPrice = h.dividend > 0 ? h.dividend / 0.025 : 0;
    return s + h.shares * estPrice;
  }, 0);
  const yieldOnHoldings = estimatedCost > 0 ? (currentAnnualIncome / estimatedCost) * 100 : 0;

  return {
    currentAnnualIncome,
    monthlyIncome: currentAnnualIncome / 12,
    projectedYearN,
    yieldOnHoldings,
    totalDividends,
    series,
  };
}

export function DividendIncomeProjector() {
  const { data: portfolioRaw = [] } = usePortfolio();

  const [holdings, setHoldings] = useState<Holding[]>(DEFAULT_HOLDINGS);
  const [seeded, setSeeded] = useState(false);
  const [drip, setDrip] = useState(true);
  const [growth, setGrowth] = useState(5);
  const [years, setYears] = useState(10);

  // Auto-populate from portfolio once
  useEffect(() => {
    if (seeded) return;
    const portfolio = portfolioRaw as PortfolioHolding[];
    if (portfolio && portfolio.length > 0) {
      const mapped: Holding[] = portfolio
        .map(p => ({
          ticker: p.ticker ?? p.symbol ?? '',
          shares: Number(p.shares ?? p.quantity ?? 0),
          dividend: Number(p.dividend_per_share ?? p.annual_dividend ?? 0),
        }))
        .filter(h => h.ticker && h.shares > 0);
      if (mapped.length > 0) {
        setHoldings(mapped);
        setSeeded(true);
      }
    }
  }, [portfolioRaw, seeded]);

  const r = useMemo(() => compute(holdings, growth, years, drip), [holdings, growth, years, drip]);

  const effectiveGrowth = drip ? growth + DRIP_YIELD_ASSUMPTION * 100 : growth;
  const doublingYears = effectiveGrowth > 0 ? 72 / effectiveGrowth : Infinity;

  function updateRow(i: number, patch: Partial<Holding>) {
    setHoldings(prev => prev.map((h, idx) => idx === i ? { ...h, ...patch } : h));
  }
  function addRow() {
    setHoldings(prev => [...prev, { ticker: '', shares: 0, dividend: 0 }]);
  }
  function removeRow(i: number) {
    setHoldings(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <CalculatorShell
      title="Dividend Income Projector"
      description="Project future dividend income from your holdings with optional DRIP reinvestment."
      inputs={<>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Holdings</Label>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_70px_80px_28px] gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
              <span>Ticker</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Div/Sh</span>
              <span />
            </div>
            {holdings.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_80px_28px] gap-1.5 items-center">
                <Input
                  value={h.ticker}
                  onChange={e => updateRow(i, { ticker: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={h.shares}
                  min={0}
                  step={1}
                  onChange={e => updateRow(i, { shares: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm text-right"
                />
                <Input
                  type="number"
                  value={h.dividend}
                  min={0}
                  step={0.01}
                  onChange={e => updateRow(i, { dividend: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm text-right"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeRow(i)}
                  disabled={holdings.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-1 h-8"
              onClick={addRow}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Holding
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="drip-toggle"
            checked={drip}
            onChange={e => setDrip(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor="drip-toggle" className="text-sm cursor-pointer">
            Enable DRIP (reinvest dividends)
          </label>
        </div>

        <NumInput
          label="Annual Dividend Growth Rate"
          value={growth}
          onChange={setGrowth}
          min={0}
          max={30}
          step={0.5}
          suffix="%"
        />
        <NumInput
          label="Years to Project"
          value={years}
          onChange={setYears}
          min={1}
          max={50}
          step={1}
          suffix="yrs"
        />
      </>}
      results={<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBox
            label="Current Annual Income"
            value={fmtCompact(r.currentAnnualIncome)}
            highlight="positive"
          />
          <StatBox
            label="Monthly Income"
            value={fmtCompact(r.monthlyIncome)}
            sub="At current rate"
          />
          <StatBox
            label={`Projected Year ${years}`}
            value={fmtCompact(r.projectedYearN)}
            sub={drip ? 'With DRIP' : 'No DRIP'}
            highlight="positive"
          />
          <StatBox
            label="Yield on Holdings"
            value={`${r.yieldOnHoldings.toFixed(2)}%`}
            sub="Est. on cost basis"
          />
          <StatBox
            label={`Total Dividends (${years}y)`}
            value={fmtCompact(r.totalDividends)}
            highlight="positive"
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Annual Dividend Income — {years} Year Projection
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `Yr ${v}`}
                  interval="preserveStartEnd"
                />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {drip ? (
                  <>
                    <Bar dataKey="noDrip" name="No DRIP" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="drip"   name="With DRIP" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey="noDrip" name="Annual Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Callout icon={<TrendingUp className="h-4 w-4 text-green-500" />}>
          At <strong className="text-foreground">{growth}%</strong> annual dividend growth
          {drip ? ' with DRIP enabled' : ''}, your income doubles in approximately{' '}
          <strong className="text-foreground">
            {isFinite(doublingYears) ? doublingYears.toFixed(1) : '∞'}
          </strong>{' '}
          years (Rule of 72). That turns <strong className="text-foreground">{fmtDollar(r.currentAnnualIncome)}</strong>{' '}
          today into <strong className="text-foreground">{fmtDollar(r.projectedYearN)}</strong> per year by year {years}.
        </Callout>
      </>}
    />
  );
}
