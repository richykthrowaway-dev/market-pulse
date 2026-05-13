# Calculators Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `FeeCalculators.tsx` with a unified Calculators Hub containing 19 calculators across 6 categories, using a left sidebar nav and shared layout components.

**Architecture:** New `src/pages/Calculators.tsx` hub page with sidebar nav tracking active calculator via URL hash. Shared `CalculatorShell` wrapper provides the 1/3 inputs + 2/3 results layout. All 19 calculator components live in `src/components/calculators/`. The 3 existing fee calculators are migrated as-is; 16 new calculators are added. All pure client-side math — no new API routes.

**Tech Stack:** React, TypeScript, Recharts, Tailwind CSS, shadcn/ui (Card, Input, Label, Badge, Separator), `usePortfolio()` + defeatbeta backend for live data pre-population.

---

## Task 1: Extract shared utilities from FeeCalculators.tsx

**Files:**
- Create: `src/components/calculators/calcUtils.ts`
- Create: `src/components/calculators/NumInput.tsx`
- Create: `src/components/calculators/StatBox.tsx`
- Create: `src/components/calculators/ChartTooltip.tsx`

**Step 1: Create `calcUtils.ts`**

```ts
// src/components/calculators/calcUtils.ts

export const fmtDollar = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: 'compact', maximumFractionDigits: 2,
  }).format(n);

export const yFmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v.toFixed(0)}`;

export const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Year-by-year portfolio growth. netPct already has fee deducted. */
export function growSeries(initial: number, contrib: number, netPct: number, years: number): number[] {
  const rate = Math.max(0, netPct) / 100;
  const vals = [initial];
  for (let y = 1; y <= years; y++) vals.push(vals[y - 1] * (1 + rate) + contrib);
  return vals;
}
```

**Step 2: Create `NumInput.tsx`**

```tsx
// src/components/calculators/NumInput.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clamp } from './calcUtils';

interface NumInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  help?: string;
}

export function NumInput({
  label, value, onChange, min = 0, max, step = 1, prefix, suffix, help,
}: NumInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none select-none z-10">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(clamp(v, min, max ?? Infinity));
          }}
          className={`w-full ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 text-muted-foreground text-sm pointer-events-none select-none whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
```

**Step 3: Create `StatBox.tsx`**

```tsx
// src/components/calculators/StatBox.tsx
import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  highlight?: 'positive' | 'negative' | 'warning';
}

export function StatBox({ label, value, sub, className, highlight }: StatBoxProps) {
  return (
    <div className={cn(
      'rounded-xl border bg-card px-4 py-3',
      highlight === 'positive' && 'border-green-500/40',
      highlight === 'negative' && 'border-destructive/40',
      highlight === 'warning'  && 'border-amber-500/40',
      className,
    )}>
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
```

**Step 4: Create `ChartTooltip.tsx`**

```tsx
// src/components/calculators/ChartTooltip.tsx
import { fmtDollar } from './calcUtils';

interface TooltipPayload {
  dataKey: string;
  name: string;
  color: string;
  value: number;
}

interface Props {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  labelPrefix?: string;
  formatter?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, labelPrefix = 'Year', formatter = fmtDollar }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1.5">{labelPrefix} {label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums text-xs">
          {p.name}: {formatter(p.value)}
        </p>
      ))}
    </div>
  );
}
```

**Step 5: Commit**
```bash
git add src/components/calculators/
git commit -m "feat: add shared calculator utility components"
```

---

## Task 2: Create CalculatorShell wrapper

**Files:**
- Create: `src/components/calculators/CalculatorShell.tsx`

```tsx
// src/components/calculators/CalculatorShell.tsx
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface CalculatorShellProps {
  title: string;
  description: string;
  inputs: ReactNode;
  results: ReactNode;
}

export function CalculatorShell({ title, description, inputs, results }: CalculatorShellProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Inputs */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{inputs}</CardContent>
        </Card>
        {/* Results */}
        <div className="lg:col-span-2 space-y-4">{results}</div>
      </div>
    </div>
  );
}

/** Amber insight callout — matches existing fee calculator style */
export function Callout({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/calculators/CalculatorShell.tsx
git commit -m "feat: add CalculatorShell layout wrapper"
```

---

## Task 3: Create the Calculators hub page

**Files:**
- Create: `src/pages/Calculators.tsx`

The hub page manages which calculator is active via URL hash. All 19 calculator components are imported and rendered in a registry. The left sidebar lists them by category.

```tsx
// src/pages/Calculators.tsx
import { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Calculator, TrendingUp, BarChart2, Layers, Receipt, DollarSign, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Wealth
import { CompoundInterest }       from '@/components/calculators/wealth/CompoundInterest';
import { DollarCostAveraging }    from '@/components/calculators/wealth/DollarCostAveraging';
import { FireRetirement }         from '@/components/calculators/wealth/FireRetirement';
import { MortgageVsInvest }       from '@/components/calculators/wealth/MortgageVsInvest';
// ── Trading
import { PositionSizing }         from '@/components/calculators/trading/PositionSizing';
import { RiskReward }             from '@/components/calculators/trading/RiskReward';
import { MarginLeverage }         from '@/components/calculators/trading/MarginLeverage';
import { ShortSelling }           from '@/components/calculators/trading/ShortSelling';
// ── Options
import { OptionsPnl }             from '@/components/calculators/options/OptionsPnl';
import { CoveredCall }            from '@/components/calculators/options/CoveredCall';
import { CashSecuredPut }         from '@/components/calculators/options/CashSecuredPut';
// ── Tax
import { CapitalGainsTax }        from '@/components/calculators/tax/CapitalGainsTax';
import { TaxLossHarvesting }      from '@/components/calculators/tax/TaxLossHarvesting';
import { CostBasisMethods }       from '@/components/calculators/tax/CostBasisMethods';
// ── Income
import { DividendIncomeProjector } from '@/components/calculators/income/DividendIncomeProjector';
import { DividendGrowthModel }    from '@/components/calculators/income/DividendGrowthModel';
// ── Fees (migrated)
import { AdvisorFee }             from '@/components/calculators/fees/AdvisorFee';
import { MerExpenses }            from '@/components/calculators/fees/MerExpenses';
import { AllInComparison }        from '@/components/calculators/fees/AllInComparison';

// ── Registry ──────────────────────────────────────────────────────────────────
interface CalcEntry {
  id: string;
  label: string;
  component: React.ComponentType;
}

interface CalcCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: CalcEntry[];
}

const CATEGORIES: CalcCategory[] = [
  {
    id: 'wealth', label: 'Wealth Building', icon: TrendingUp,
    items: [
      { id: 'compound-interest',   label: 'Compound Interest',   component: CompoundInterest },
      { id: 'dca',                 label: 'Dollar-Cost Averaging', component: DollarCostAveraging },
      { id: 'fire',                label: 'FIRE / Retirement',   component: FireRetirement },
      { id: 'mortgage-vs-invest',  label: 'Mortgage vs Invest',  component: MortgageVsInvest },
    ],
  },
  {
    id: 'trading', label: 'Trading', icon: BarChart2,
    items: [
      { id: 'position-sizing', label: 'Position Sizing',   component: PositionSizing },
      { id: 'risk-reward',     label: 'Risk / Reward',     component: RiskReward },
      { id: 'margin-leverage', label: 'Margin & Leverage', component: MarginLeverage },
      { id: 'short-selling',   label: 'Short Selling',     component: ShortSelling },
    ],
  },
  {
    id: 'options', label: 'Options', icon: Layers,
    items: [
      { id: 'options-pnl',      label: 'Options P&L',       component: OptionsPnl },
      { id: 'covered-call',     label: 'Covered Call',      component: CoveredCall },
      { id: 'cash-secured-put', label: 'Cash-Secured Put',  component: CashSecuredPut },
    ],
  },
  {
    id: 'tax', label: 'Tax & Cost', icon: Receipt,
    items: [
      { id: 'capital-gains',      label: 'Capital Gains Tax',    component: CapitalGainsTax },
      { id: 'tax-loss-harvest',   label: 'Tax-Loss Harvesting',  component: TaxLossHarvesting },
      { id: 'cost-basis-methods', label: 'Cost Basis Methods',   component: CostBasisMethods },
    ],
  },
  {
    id: 'income', label: 'Income', icon: DollarSign,
    items: [
      { id: 'dividend-projector',   label: 'Dividend Projector',    component: DividendIncomeProjector },
      { id: 'dividend-growth-model', label: 'Dividend Growth Model', component: DividendGrowthModel },
    ],
  },
  {
    id: 'fees', label: 'Fees', icon: Percent,
    items: [
      { id: 'advisor-fee',     label: 'Advisor / Manager Fee', component: AdvisorFee },
      { id: 'mer-expenses',    label: 'MER / Fund Expenses',   component: MerExpenses },
      { id: 'all-in-comparison', label: 'All-In Comparison',   component: AllInComparison },
    ],
  },
];

const ALL_ITEMS = CATEGORIES.flatMap(c => c.items);
const DEFAULT_ID = 'compound-interest';

function getActiveId(): string {
  if (typeof window === 'undefined') return DEFAULT_ID;
  const hash = window.location.hash.replace('#', '');
  return ALL_ITEMS.find(i => i.id === hash) ? hash : DEFAULT_ID;
}

export default function Calculators() {
  const [activeId, setActiveId] = useState<string>(getActiveId);

  // Sync hash → state on back/forward navigation
  useEffect(() => {
    const onHash = () => setActiveId(getActiveId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(id: string) {
    window.location.hash = id;
    setActiveId(id);
  }

  const ActiveComponent = ALL_ITEMS.find(i => i.id === activeId)?.component ?? CompoundInterest;

  return (
    <PageLayout title="Calculators">
      {/* Page header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Calculators</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial tools to model investments, trades, taxes, and retirement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* ── Sidebar ── */}
        <nav className="lg:col-span-1 rounded-xl border bg-card p-3 space-y-1">
          {CATEGORIES.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </div>
              {cat.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                    activeId === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Active calculator ── */}
        <div className="lg:col-span-3">
          <ActiveComponent />
        </div>
      </div>
    </PageLayout>
  );
}
```

**Step 2: Commit**
```bash
git add src/pages/Calculators.tsx
git commit -m "feat: add Calculators hub page with sidebar nav"
```

---

## Task 4: Wire up routing and update nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MobileShell.tsx`

**Step 1: Update `App.tsx`**

Replace line 38:
```tsx
// OLD
const FeeCalculators = lazy(() => import("./pages/FeeCalculators"));
// NEW
const Calculators = lazy(() => import("./pages/Calculators"));
```

Replace line 79:
```tsx
// OLD
<Route path="/fee-calculators" element={<FeeCalculators />} />
// NEW — keep old route as redirect so bookmarks don't break
<Route path="/fee-calculators" element={<Navigate to="/calculators" replace />} />
<Route path="/calculators" element={<Calculators />} />
```

Add `Navigate` to the react-router-dom import at the top of App.tsx if not already there:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
```

**Step 2: Update `Sidebar.tsx` line 43**
```tsx
// OLD
{ title: 'Fee Calculators', icon: Calculator, href: '/fee-calculators' },
// NEW
{ title: 'Calculators', icon: Calculator, href: '/calculators' },
```

**Step 3: Update `MobileShell.tsx` line 30**
```tsx
// OLD
'/fee-calculators': 'Fee Calculators',
// NEW
'/calculators': 'Calculators',
```

**Step 4: Commit**
```bash
git add src/App.tsx src/components/layout/Sidebar.tsx src/components/layout/MobileShell.tsx
git commit -m "feat: replace fee-calculators route with /calculators hub"
```

---

## Task 5: Migrate AdvisorFee calculator

**Files:**
- Create: `src/components/calculators/fees/AdvisorFee.tsx`

Extract the Advisor tab from `FeeCalculators.tsx`. Copy `computeAdvisor()` function and all JSX from `<TabsContent value="advisor">`. Wrap in `CalculatorShell`. Export as named export `AdvisorFee`.

```tsx
// src/components/calculators/fees/AdvisorFee.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt, growSeries } from '../calcUtils';

function computeAdvisor(initial: number, contrib: number, grossPct: number, feePct: number, years: number) {
  const noA = growSeries(initial, contrib, grossPct, years);
  const wiA = growSeries(initial, contrib, grossPct - feePct, years);
  let approxFeesPaid = 0;
  for (let y = 1; y <= years; y++) approxFeesPaid += wiA[y - 1] * (feePct / 100);
  return {
    series: noA.map((v, i) => ({ year: i, noAdvisor: Math.round(v), withAdvisor: Math.round(wiA[i]) })),
    finalNoAdvisor: Math.round(noA[years]),
    finalWithAdvisor: Math.round(wiA[years]),
    opportunityCost: Math.round(noA[years] - wiA[years]),
    approxFeesPaid: Math.round(approxFeesPaid),
  };
}

export function AdvisorFee() {
  const [initial, setInitial] = useState(100_000);
  const [contrib, setContrib] = useState(12_000);
  const [ret, setRet]         = useState(7);
  const [fee, setFee]         = useState(1.0);
  const [years, setYears]     = useState(25);
  const r = useMemo(() => computeAdvisor(initial, contrib, ret, fee, years), [initial, contrib, ret, fee, years]);

  return (
    <CalculatorShell
      title="Advisor / Manager Fee"
      description="See how an annual AUM fee compounds into significant drag on long-term returns."
      inputs={<>
        <NumInput label="Starting Portfolio Value" value={initial} onChange={setInitial} min={1000} step={5000} prefix="$" />
        <NumInput label="Annual Contribution" value={contrib} onChange={setContrib} min={0} step={1000} prefix="$" help="Added at year-end each year" />
        <NumInput label="Expected Return (Gross)" value={ret} onChange={setRet} min={0} max={30} step={0.5} suffix="%" help="Before any fees" />
        <Separator />
        <NumInput label="Advisor / Manager Fee" value={fee} onChange={setFee} min={0} max={5} step={0.1} suffix="% AUM/yr" help="Typical range: 0.5%–2.0%" />
        <NumInput label="Investment Horizon" value={years} onChange={setYears} min={1} max={50} step={1} suffix="years" />
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="No Advisor" value={fmtCompact(r.finalNoAdvisor)} sub={`After ${years} yrs`} />
          <StatBox label={`With ${fee}% Advisor`} value={fmtCompact(r.finalWithAdvisor)} sub={`After ${years} yrs`} />
          <StatBox label="Compounding Drag" value={fmtCompact(r.opportunityCost)} sub="Opportunity cost" highlight="negative" />
          <StatBox label="Fees Paid (est.)" value={fmtCompact(r.approxFeesPaid)} sub="Direct AUM charges" />
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Portfolio Growth Over {years} Years</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="noAdvisor" name="Self-Directed" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withAdvisor" name={`With ${fee}% Advisor`} stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          A <strong className="text-foreground">{fee}% annual advisor fee</strong> results in{' '}
          <strong className="text-foreground">{fmtDollar(r.opportunityCost)}</strong> in compounding drag over {years} years —{' '}
          that's <strong className="text-foreground">
            {r.finalNoAdvisor > 0 ? ((r.opportunityCost / r.finalNoAdvisor) * 100).toFixed(1) : 0}%
          </strong> of what you would have had fee-free.
        </Callout>
      </>}
    />
  );
}
```

**Step 2: Commit**
```bash
git add src/components/calculators/fees/AdvisorFee.tsx
git commit -m "feat: migrate AdvisorFee calculator to hub"
```

---

## Task 6: Migrate MerExpenses and AllInComparison

**Files:**
- Create: `src/components/calculators/fees/MerExpenses.tsx`
- Create: `src/components/calculators/fees/AllInComparison.tsx`

Follow the exact same pattern as Task 5 — extract the computation function and JSX from `FeeCalculators.tsx` tabs `"mer"` and `"allin"`, wrap in `CalculatorShell`, export as named export.

For **MerExpenses**, copy `computeMer()` from FeeCalculators lines 102–119 and the `<TabsContent value="mer">` JSX.

For **AllInComparison**, copy `computeAllIn()` from lines 130–149 and `<TabsContent value="allin">` JSX. The All-In tab uses a `BarChart` — keep that as-is.

Both files follow the same import pattern as `AdvisorFee.tsx`.

**Step 2: Commit**
```bash
git add src/components/calculators/fees/
git commit -m "feat: migrate MerExpenses and AllInComparison calculators"
```

---

## Task 7: Build CompoundInterest calculator

**Files:**
- Create: `src/components/calculators/wealth/CompoundInterest.tsx`

```tsx
// src/components/calculators/wealth/CompoundInterest.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

function compute(principal: number, contrib: number, ratePct: number, years: number, monthly: boolean, inflationPct: number) {
  const periods = monthly ? years * 12 : years;
  const r = (ratePct / 100) / (monthly ? 12 : 1);
  const inf = (inflationPct / 100) / (monthly ? 12 : 1);

  let balance = principal;
  const series: { year: number; principal: number; contributions: number; value: number; real: number }[] = [];
  let totalContrib = principal;

  for (let p = 1; p <= periods; p++) {
    balance = balance * (1 + r) + contrib;
    totalContrib += contrib;
    if (monthly ? p % 12 === 0 : true) {
      const yr = monthly ? p / 12 : p;
      const real = balance / Math.pow(1 + inf * (monthly ? 12 : 1), yr);
      series.push({
        year: yr,
        principal: Math.round(principal),
        contributions: Math.round(totalContrib),
        value: Math.round(balance),
        real: Math.round(real),
      });
    }
  }

  const final = balance;
  const totalInterest = final - totalContrib;
  const real = final / Math.pow(1 + inflationPct / 100, years);
  return { series, final, totalContrib, totalInterest, real };
}

export function CompoundInterest() {
  const [principal, setPrincipal] = useState(10_000);
  const [contrib,   setContrib]   = useState(500);
  const [rate,      setRate]      = useState(8);
  const [years,     setYears]     = useState(30);
  const [monthly,   setMonthly]   = useState(false);
  const [inflation, setInflation] = useState(2.5);
  const [showReal,  setShowReal]  = useState(false);

  const r = useMemo(() => compute(principal, contrib, rate, years, monthly, inflation),
    [principal, contrib, rate, years, monthly, inflation]);

  const moneyPct = r.totalContrib > 0
    ? ((r.totalInterest / r.final) * 100).toFixed(0)
    : '0';

  return (
    <CalculatorShell
      title="Compound Interest"
      description="Model how an investment grows over time with regular contributions."
      inputs={<>
        <NumInput label="Starting Principal" value={principal} onChange={setPrincipal} min={0} step={1000} prefix="$" />
        <NumInput label={`${monthly ? 'Monthly' : 'Annual'} Contribution`} value={contrib} onChange={setContrib} min={0} step={100} prefix="$" />
        <NumInput label="Annual Return Rate" value={rate} onChange={setRate} min={0} max={50} step={0.5} suffix="%" />
        <NumInput label="Years" value={years} onChange={setYears} min={1} max={60} step={1} suffix="yrs" />
        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="monthly" checked={monthly} onChange={e => setMonthly(e.target.checked)} className="h-4 w-4" />
          <label htmlFor="monthly" className="text-sm">Monthly compounding</label>
        </div>
        <NumInput label="Inflation Rate (optional)" value={inflation} onChange={setInflation} min={0} max={20} step={0.1} suffix="%" help="Used to calculate real value" />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="showReal" checked={showReal} onChange={e => setShowReal(e.target.checked)} className="h-4 w-4" />
          <label htmlFor="showReal" className="text-sm">Show inflation-adjusted</label>
        </div>
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Final Value" value={fmtCompact(r.final)} sub={`After ${years} yrs`} highlight="positive" />
          <StatBox label="Total Contributed" value={fmtCompact(r.totalContrib)} sub="Principal + deposits" />
          <StatBox label="Interest Earned" value={fmtCompact(r.totalInterest)} sub="Compounding gains" highlight="positive" />
          {showReal && <StatBox label="Real Value" value={fmtCompact(r.real)} sub={`Inflation-adj. (${inflation}%)`} />}
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Portfolio Growth Over {years} Years</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `Yr ${v}`} interval="preserveStartEnd" />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="contributions" name="Total Contributed" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="value" name="Portfolio Value" stroke="#22c55e" strokeWidth={2} dot={false} />
                {showReal && <Line type="monotone" dataKey="real" name="Real Value" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          Compound interest does <strong className="text-foreground">{moneyPct}%</strong> of the work —
          your money earns <strong className="text-foreground">{fmtDollar(r.totalInterest)}</strong> without
          you lifting a finger over {years} years.
        </Callout>
      </>}
    />
  );
}
```

**Step 2: Commit**
```bash
git add src/components/calculators/wealth/CompoundInterest.tsx
git commit -m "feat: add CompoundInterest calculator"
```

---

## Task 8: Build DollarCostAveraging calculator

**Files:**
- Create: `src/components/calculators/wealth/DollarCostAveraging.tsx`

**Computation logic:**
```ts
function compute(
  periodicAmount: number,
  frequency: 'weekly' | 'monthly' | 'quarterly',
  startDate: string,
  endDate: string,
  prices: { date: string; close: number }[], // from defeatbeta /api/prices
) {
  const freqDays = { weekly: 7, monthly: 30, quarterly: 91 }[frequency];
  let totalInvested = 0;
  let totalShares = 0;
  const series: { date: string; invested: number; value: number }[] = [];
  let nextBuyDate = new Date(startDate);
  const end = new Date(endDate);

  for (const bar of prices) {
    const d = new Date(bar.date);
    if (d < new Date(startDate) || d > end) continue;
    if (d >= nextBuyDate) {
      const shares = periodicAmount / bar.close;
      totalShares += shares;
      totalInvested += periodicAmount;
      nextBuyDate = new Date(d.getTime() + freqDays * 86_400_000);
    }
    series.push({ date: bar.date, invested: Math.round(totalInvested), value: Math.round(totalShares * bar.close) });
  }
  const lastPrice = prices[prices.length - 1]?.close ?? 0;
  const currentValue = totalShares * lastPrice;
  const avgCost = totalShares > 0 ? totalInvested / totalShares : 0;
  return { series, totalInvested, currentValue, totalShares, avgCost, lastPrice, returnPct: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0 };
}
```

**Key implementation details:**
- Ticker input with a text field; on submit fetch from defeatbeta `GET /api/prices?symbol={ticker}&days=1825`
- Show a loading spinner while fetching
- If no portfolio data, start blank with `AAPL` as placeholder
- Auto-populate ticker from a holdings dropdown if `usePortfolio()` returns data
- AreaChart: `totalInvested` as filled area (grey), `value` as line (green)
- StatBox row: Total Invested, Current Value, Avg Cost/Share, Total Return %
- Callout: "Your avg cost of $X vs current price of $Y = Z% gain/loss per share"
- Frequency selector: pill buttons (Weekly / Monthly / Quarterly)
- Date pickers for start/end: use `<Input type="date" />`

```tsx
// src/components/calculators/wealth/DollarCostAveraging.tsx
import { useState, useMemo, useEffect } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStatement } from '@/contexts/StatementContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

const BACKEND = import.meta.env.DEV ? 'http://localhost:4400' : '/_/backend';
type Freq = 'weekly' | 'monthly' | 'quarterly';
const FREQ_DAYS: Record<Freq, number> = { weekly: 7, monthly: 30, quarterly: 91 };

function compute(amount: number, freq: Freq, startDate: string, endDate: string, prices: {date:string;close:number}[]) {
  let totalInvested = 0, totalShares = 0;
  const series: {date:string;invested:number;value:number}[] = [];
  let nextBuy = new Date(startDate);
  const end = new Date(endDate);
  for (const bar of prices) {
    const d = new Date(bar.date);
    if (d < new Date(startDate) || d > end) continue;
    if (d >= nextBuy) {
      totalShares += amount / bar.close;
      totalInvested += amount;
      nextBuy = new Date(d.getTime() + FREQ_DAYS[freq] * 86_400_000);
    }
    series.push({ date: bar.date, invested: Math.round(totalInvested), value: Math.round(totalShares * bar.close) });
  }
  const lastPrice = prices.at(-1)?.close ?? 0;
  const currentValue = totalShares * lastPrice;
  const avgCost = totalShares > 0 ? totalInvested / totalShares : 0;
  const returnPct = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
  return { series, totalInvested, currentValue, totalShares, avgCost, lastPrice, returnPct };
}

export function DollarCostAveraging() {
  const { data: holdings = [] } = usePortfolio();
  const { parsedStatement } = useStatement();

  // Build ticker list from holdings for dropdown
  const tickers = useMemo(() => {
    const csvTickers = parsedStatement?.openPositions?.filter(p => p.assetCategory === 'STK' && p.quantity > 0).map(p => p.symbol) ?? [];
    const dbTickers = (holdings as any[]).map((h: any) => h.ticker);
    return [...new Set([...csvTickers, ...dbTickers])];
  }, [holdings, parsedStatement]);

  const [ticker,    setTicker]    = useState('AAPL');
  const [amount,    setAmount]    = useState(500);
  const [freq,      setFreq]      = useState<Freq>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 5); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [prices,  setPrices]  = useState<{date:string;close:number}[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchPrices(sym: string) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/prices?symbol=${sym}&days=1825`);
      const json = await res.json();
      const bars = (json.data ?? []).map((b: any) => ({ date: b.report_date, close: b.close }));
      setPrices(bars);
    } catch { setPrices([]); } finally { setLoading(false); }
  }

  useEffect(() => { fetchPrices(ticker); }, []); // eslint-disable-line

  const r = useMemo(() => {
    if (prices.length === 0) return null;
    return compute(amount, freq, startDate, endDate, prices);
  }, [prices, amount, freq, startDate, endDate]);

  const positive = (r?.returnPct ?? 0) >= 0;

  return (
    <CalculatorShell
      title="Dollar-Cost Averaging"
      description="Model the result of investing a fixed amount at regular intervals."
      inputs={<>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Ticker Symbol</Label>
          <div className="flex gap-2">
            <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" className="flex-1" />
            <button onClick={() => fetchPrices(ticker)} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Go</button>
          </div>
          {tickers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tickers.slice(0, 8).map(t => (
                <Badge key={t} variant="outline" className="cursor-pointer text-xs" onClick={() => { setTicker(t); fetchPrices(t); }}>{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <NumInput label="Periodic Investment" value={amount} onChange={setAmount} min={1} step={100} prefix="$" />
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Frequency</Label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['weekly','monthly','quarterly'] as Freq[]).map(f => (
              <button key={f} onClick={() => setFreq(f)} className={`flex-1 py-1.5 text-xs font-medium transition-colors capitalize ${freq === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </>}
      results={<>
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading price data…</div>}
        {!loading && r && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Invested" value={fmtCompact(r.totalInvested)} />
            <StatBox label="Current Value" value={fmtCompact(r.currentValue)} highlight={positive ? 'positive' : 'negative'} />
            <StatBox label="Avg Cost / Share" value={`$${r.avgCost.toFixed(2)}`} sub={`vs $${r.lastPrice.toFixed(2)} now`} />
            <StatBox label="Total Return" value={`${r.returnPct >= 0 ? '+' : ''}${r.returnPct.toFixed(1)}%`} highlight={positive ? 'positive' : 'negative'} />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">DCA: Invested vs Portfolio Value</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dcaGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dcaGrey" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0,7)} interval="preserveStartEnd" />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip content={<props => <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">{props.payload?.map(p => <p key={p.dataKey} style={{color:p.color}} className="text-xs tabular-nums">{p.name}: {fmtDollar(p.value as number)}</p>)}</div>} />}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="invested" name="Total Invested" stroke="#94a3b8" fill="url(#dcaGrey)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="value" name="Portfolio Value" stroke="#22c55e" fill="url(#dcaGreen)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Callout icon={positive ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}>
            Your average cost of <strong className="text-foreground">${r.avgCost.toFixed(2)}</strong> vs current price of{' '}
            <strong className="text-foreground">${r.lastPrice.toFixed(2)}</strong> ={' '}
            <strong className={positive ? 'text-green-500' : 'text-destructive'}>{r.returnPct >= 0 ? '+' : ''}{r.returnPct.toFixed(1)}%</strong> gain per share.
          </Callout>
        </>}
      </>}
    />
  );
}
```

**Step 2: Commit**
```bash
git add src/components/calculators/wealth/DollarCostAveraging.tsx
git commit -m "feat: add DollarCostAveraging calculator with live price data"
```

---

## Task 9: Build FireRetirement calculator

**Files:**
- Create: `src/components/calculators/wealth/FireRetirement.tsx`

**Computation logic:**
```ts
function compute(savings: number, monthlyContrib: number, returnPct: number, swrPct: number, monthlyExpenses: number, currentAge: number) {
  const fireNumber = (monthlyExpenses * 12) / (swrPct / 100);
  const monthlyRate = returnPct / 100 / 12;
  // FV of savings + FV of annuity: find months until balance >= fireNumber
  const series: { year: number; balance: number; target: number }[] = [];
  let balance = savings;
  let months = 0;
  while (balance < fireNumber && months < 600) {
    balance = balance * (1 + monthlyRate) + monthlyContrib;
    months++;
    if (months % 12 === 0) series.push({ year: months / 12, balance: Math.round(balance), target: Math.round(fireNumber) });
  }
  const yearsToFire = months / 12;
  const fireAge = currentAge + yearsToFire;
  const monthlyPassiveIncome = (balance * (swrPct / 100)) / 12;
  return { fireNumber, yearsToFire, fireAge, monthlyPassiveIncome, series, reached: months < 600 };
}
```

**UI details:**
- Inputs: Current savings $, monthly contribution $, expected return % (default 7), SWR % (default 4), monthly expenses in retirement $, current age
- Stats: FIRE number needed, years to reach it, projected FIRE age, monthly passive income
- Chart: LineChart — `balance` line crossing the flat `target` (FIRE number) ReferenceLine; annotate the crossover year
- Callout: dynamic based on `reached` — either "At current rate, FIRE in X years at age Y" or "At current rate, FIRE is not reached within 50 years — increase contributions or reduce expenses"

**Step 2: Commit**
```bash
git add src/components/calculators/wealth/FireRetirement.tsx
git commit -m "feat: add FIRE/Retirement calculator"
```

---

## Task 10: Build MortgageVsInvest calculator

**Files:**
- Create: `src/components/calculators/wealth/MortgageVsInvest.tsx`

**Computation logic:**
```ts
function compute(extraPayment: number, balance: number, mortgageRate: number, yearsRemaining: number, investReturn: number) {
  const monthlyMortRate = mortgageRate / 100 / 12;
  const monthlyInvestRate = investReturn / 100 / 12;
  const series: { year: number; interestSaved: number; investValue: number }[] = [];

  // Compute interest saved by paying extra
  let balWithExtra = balance, balNormal = balance;
  let interestSavedCumulative = 0;
  let investPortfolio = 0;

  for (let m = 1; m <= yearsRemaining * 12; m++) {
    const intNormal = balNormal * monthlyMortRate;
    const intWithExtra = balWithExtra > 0 ? balWithExtra * monthlyMortRate : 0;
    balNormal -= (balNormal > 0 ? 0 : 0); // simplified — interest saved concept
    interestSavedCumulative += Math.max(0, intNormal - intWithExtra);
    balWithExtra = Math.max(0, balWithExtra - extraPayment);
    investPortfolio = investPortfolio * (1 + monthlyInvestRate) + extraPayment;

    if (m % 12 === 0) {
      series.push({
        year: m / 12,
        interestSaved: Math.round(interestSavedCumulative),
        investValue: Math.round(investPortfolio),
      });
    }
  }

  const finalInvest = investPortfolio;
  const finalSaved = interestSavedCumulative;
  const breakEvenYear = series.find(s => s.investValue > s.interestSaved)?.year ?? null;
  return { series, finalInvest, finalSaved, breakEvenYear, netDiff: finalInvest - finalSaved };
}
```

**UI:** LineChart with two lines (mortgage savings vs invest value), StatBox row with 4 stats, callout explaining which strategy wins.

**Step 2: Commit**
```bash
git add src/components/calculators/wealth/MortgageVsInvest.tsx
git commit -m "feat: add MortgageVsInvest calculator"
```

---

## Task 11: Build PositionSizing calculator

**Files:**
- Create: `src/components/calculators/trading/PositionSizing.tsx`

**Computation logic:**
```ts
function compute(portfolioValue: number, riskPct: number, entryPrice: number, stopPrice: number) {
  const maxRiskDollars = portfolioValue * (riskPct / 100);
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const shares = riskPerShare > 0 ? Math.floor(maxRiskDollars / riskPerShare) : 0;
  const positionValue = shares * entryPrice;
  const positionPct = portfolioValue > 0 ? (positionValue / portfolioValue) * 100 : 0;
  return { maxRiskDollars, riskPerShare, shares, positionValue, positionPct };
}
```

**Key implementation details:**
- Portfolio value auto-populated from `usePortfolio()`: sum of `shares × avg_cost_basis` for all holdings. Show "Auto-populated" badge when live. Manual override field always available.
- StatBox: Max Shares, Position Value $, Max $ Risk, Position as % of Portfolio
- Chart: Horizontal stacked BarChart with one bar showing [position size] + [rest of portfolio]; colour the "at risk" slice red

**Step 2: Commit**
```bash
git add src/components/calculators/trading/PositionSizing.tsx
git commit -m "feat: add PositionSizing calculator with portfolio auto-populate"
```

---

## Task 12: Build RiskReward calculator

**Files:**
- Create: `src/components/calculators/trading/RiskReward.tsx`

**Computation logic:**
```ts
function compute(entry: number, target: number, stop: number, shares: number) {
  const gain = (target - entry) * shares;
  const loss = (entry - stop) * shares;
  const rr = loss > 0 ? gain / loss : 0;
  const breakEvenWinRate = rr > 0 ? (1 / (1 + rr)) * 100 : 50;
  const ev = rr > 0 ? (rr * (100 - breakEvenWinRate) - breakEvenWinRate) / 100 : 0;
  return { gain, loss, rr, breakEvenWinRate, ev };
}
```

**Chart:** Custom horizontal bar component (CSS, no recharts needed) showing:
```
[STOP ████████] entry [████████████████ TARGET]
  red zone              green zone
```
Built with divs: stop-to-entry = red, entry-to-target = green, widths proportional.

**Step 2: Commit**
```bash
git add src/components/calculators/trading/RiskReward.tsx
git commit -m "feat: add RiskReward calculator"
```

---

## Task 13: Build MarginLeverage calculator

**Files:**
- Create: `src/components/calculators/trading/MarginLeverage.tsx`

**Computation:**
```ts
function compute(equity: number, leverage: number, assetPrice: number, units: number) {
  const exposure = assetPrice * units;
  const marginRequired = exposure / leverage;
  // Margin call when equity eroded to maintenance margin (assume 30% of exposure)
  const maintenanceMargin = exposure * 0.3;
  const marginCallPrice = assetPrice * (1 - (equity - maintenanceMargin) / exposure);
  const liquidationPrice = assetPrice * (1 - equity / exposure);
  const lossAtMarginCall = equity - maintenanceMargin;
  return { exposure, marginRequired, marginCallPrice, liquidationPrice, lossAtMarginCall };
}
```

**Chart:** AreaChart — x-axis is price moves from -50% to +50%, y-axis is portfolio equity. Two `ReferenceLine`s: margin call price (amber) and liquidation price (red).

**Step 2: Commit**
```bash
git add src/components/calculators/trading/MarginLeverage.tsx
git commit -m "feat: add MarginLeverage calculator"
```

---

## Task 14: Build ShortSelling calculator

**Files:**
- Create: `src/components/calculators/trading/ShortSelling.tsx`

**Computation:**
```ts
function compute(entryPrice: number, exitPrice: number, shares: number, borrowRatePct: number, days: number) {
  const pnl = (entryPrice - exitPrice) * shares;
  const borrowCost = (entryPrice * shares) * (borrowRatePct / 100) * (days / 365);
  const netPnl = pnl - borrowCost;
  const breakEven = entryPrice - (borrowCost / shares);
  const returnPct = (entryPrice * shares) > 0 ? (netPnl / (entryPrice * shares)) * 100 : 0;
  const annualizedReturn = days > 0 ? returnPct * (365 / days) : 0;

  // P&L chart across exit price range
  const priceRange = Array.from({ length: 41 }, (_, i) => {
    const price = entryPrice * (0.5 + i * 0.025);
    const p = (entryPrice - price) * shares - borrowCost;
    return { price: parseFloat(price.toFixed(2)), pnl: Math.round(p) };
  });
  return { pnl, borrowCost, netPnl, breakEven, returnPct, annualizedReturn, priceRange };
}
```

**Chart:** LineChart of `pnl` vs `price`; `ReferenceLine` at `breakEven` and `entryPrice`.

**Step 2: Commit**
```bash
git add src/components/calculators/trading/ShortSelling.tsx
git commit -m "feat: add ShortSelling calculator"
```

---

## Task 15: Build OptionsPnl calculator

**Files:**
- Create: `src/components/calculators/options/OptionsPnl.tsx`

**Computation:**
```ts
type OptionType = 'call' | 'put';
type Direction = 'long' | 'short';

function compute(type: OptionType, dir: Direction, strike: number, premium: number, contracts: number, currentPrice: number) {
  const mult = contracts * 100;
  const sign = dir === 'long' ? 1 : -1;
  const breakEven = type === 'call' ? strike + premium : strike - premium;
  const maxGain = dir === 'long'
    ? (type === 'call' ? Infinity : (strike - premium) * mult)
    : premium * mult;
  const maxLoss = dir === 'long'
    ? premium * mult
    : (type === 'call' ? Infinity : (strike - premium) * mult);

  const intrinsic = type === 'call'
    ? Math.max(0, currentPrice - strike)
    : Math.max(0, strike - currentPrice);
  const currentPnl = (intrinsic - premium) * sign * mult;

  const priceRange = Array.from({ length: 51 }, (_, i) => {
    const price = strike * (0.5 + i * 0.02);
    const payoff = type === 'call'
      ? Math.max(0, price - strike) - premium
      : Math.max(0, strike - price) - premium;
    return { price: parseFloat(price.toFixed(2)), pnl: Math.round(payoff * sign * mult) };
  });

  return { breakEven, maxGain, maxLoss, currentPnl, intrinsic, priceRange };
}
```

**UI details:**
- Option type toggle: Call / Put pill
- Direction toggle: Long / Short pill
- Inputs: Strike, premium, contracts (default 1), current price (auto-fetch from defeatbeta if ticker provided)
- Chart: LineChart payoff diagram; `ReferenceLine` at `breakEven` (dashed amber) and `currentPrice` (dashed blue); x-axis = underlying price
- Stats: Break-Even Price, Max Gain, Max Loss, Current P&L

**Step 2: Commit**
```bash
git add src/components/calculators/options/OptionsPnl.tsx
git commit -m "feat: add Options P&L calculator"
```

---

## Task 16: Build CoveredCall and CashSecuredPut

**Files:**
- Create: `src/components/calculators/options/CoveredCall.tsx`
- Create: `src/components/calculators/options/CashSecuredPut.tsx`

**CoveredCall computation:**
```ts
function compute(shares: number, stockPrice: number, strike: number, premium: number, daysToExpiry: number) {
  const income = premium * shares;
  const annualizedYield = (premium / stockPrice) * (365 / daysToExpiry) * 100;
  const effectiveSellPrice = strike + premium;
  const downsideProtection = (premium / stockPrice) * 100;
  const maxProfit = (strike - stockPrice + premium) * shares;

  const priceRange = Array.from({ length: 41 }, (_, i) => {
    const price = stockPrice * (0.6 + i * 0.02);
    const covered = Math.min(price, strike) - stockPrice + premium;
    const uncovered = price - stockPrice;
    return { price: parseFloat(price.toFixed(2)), covered: Math.round(covered * shares), uncovered: Math.round(uncovered * shares) };
  });
  return { income, annualizedYield, effectiveSellPrice, downsideProtection, maxProfit, priceRange };
}
```

**CashSecuredPut computation:**
```ts
function compute(strike: number, premium: number, daysToExpiry: number, currentPrice: number, contracts: number) {
  const mult = contracts * 100;
  const capitalRequired = strike * mult;
  const maxGain = premium * mult;
  const breakEven = strike - premium;
  const effectiveBuyPrice = strike - premium;
  const discountPct = currentPrice > 0 ? ((currentPrice - effectiveBuyPrice) / currentPrice) * 100 : 0;
  const annualizedYield = (premium / strike) * (365 / daysToExpiry) * 100;

  const priceRange = Array.from({ length: 41 }, (_, i) => {
    const price = strike * (0.5 + i * 0.025);
    const pnl = price >= strike ? premium * mult : (price - strike + premium) * mult;
    return { price: parseFloat(price.toFixed(2)), pnl: Math.round(pnl) };
  });
  return { capitalRequired, maxGain, breakEven, effectiveBuyPrice, discountPct, annualizedYield, priceRange };
}
```

Both follow the same CalculatorShell + LineChart payoff diagram pattern.
Holdings dropdown auto-populates ticker for CoveredCall.

**Step 2: Commit**
```bash
git add src/components/calculators/options/
git commit -m "feat: add CoveredCall and CashSecuredPut calculators"
```

---

## Task 17: Build CapitalGainsTax calculator

**Files:**
- Create: `src/components/calculators/tax/CapitalGainsTax.tsx`

**Computation:**
```ts
const FEDERAL_LTCG_RATES: Record<string, number> = {
  '10': 0, '12': 0, '22': 15, '24': 15, '32': 15, '35': 20, '37': 20,
};
const FEDERAL_STCG_RATES: Record<string, number> = {
  '10': 10, '12': 12, '22': 22, '24': 24, '32': 32, '35': 35, '37': 37,
};

function compute(purchasePrice: number, salePrice: number, shares: number, isLongTerm: boolean, bracket: string, stateTaxPct: number) {
  const proceeds = salePrice * shares;
  const costBasis = purchasePrice * shares;
  const gain = proceeds - costBasis;
  const fedRate = isLongTerm ? FEDERAL_LTCG_RATES[bracket] : FEDERAL_STCG_RATES[bracket];
  const federalTax = Math.max(0, gain * (fedRate / 100));
  const stateTax = Math.max(0, gain * (stateTaxPct / 100));
  const totalTax = federalTax + stateTax;
  const netProceeds = proceeds - totalTax;
  const effectiveRate = gain > 0 ? (totalTax / gain) * 100 : 0;
  return { proceeds, costBasis, gain, federalTax, stateTax, totalTax, netProceeds, effectiveRate };
}
```

**UI:**
- Holding period: Long-term / Short-term pill toggle
- Income bracket: `<select>` dropdown with 7 options
- State tax: NumInput (default 0, optional)
- Chart: StackedBarChart with 4 segments: cost basis (grey) / net gain (green) / federal tax (amber) / state tax (red)
- Callout: when short-term, calculate days needed to qualify for long-term and the tax saving from switching

**Step 2: Commit**
```bash
git add src/components/calculators/tax/CapitalGainsTax.tsx
git commit -m "feat: add CapitalGainsTax calculator"
```

---

## Task 18: Build TaxLossHarvesting and CostBasisMethods

**Files:**
- Create: `src/components/calculators/tax/TaxLossHarvesting.tsx`
- Create: `src/components/calculators/tax/CostBasisMethods.tsx`

**TaxLossHarvesting computation:**
```ts
function compute(currentValue: number, costBasis: number, marginalTaxRate: number, returnPct: number, years: number) {
  const harvestableLoss = Math.max(0, costBasis - currentValue);
  const taxSaving = harvestableLoss * (marginalTaxRate / 100);
  const futureValueOfSaving = taxSaving * Math.pow(1 + returnPct / 100, years);
  const washSaleDate = new Date(Date.now() + 31 * 86_400_000).toLocaleDateString('en-US');
  return { harvestableLoss, taxSaving, futureValueOfSaving, washSaleDate };
}
```

Auto-populate `currentValue` and `costBasis` from a holdings dropdown (IBKR statement data or `usePortfolio()`).

**CostBasisMethods:**
- Lot table: rows of `{ date, shares, price }` — add/remove row functionality
- For each method (FIFO, LIFO, Highest Cost, Lowest Cost), compute which lots are sold
- Sale inputs: sale price $, shares to sell
- Output table: one row per method with proceeds, basis, gain/loss, estimated tax
- Chart: GroupedBarChart comparing tax for each method

**Step 2: Commit**
```bash
git add src/components/calculators/tax/
git commit -m "feat: add TaxLossHarvesting and CostBasisMethods calculators"
```

---

## Task 19: Build DividendIncomeProjector

**Files:**
- Create: `src/components/calculators/income/DividendIncomeProjector.tsx`

**Data model:**
```ts
interface DivHolding {
  ticker: string;
  shares: number;
  annualDividend: number; // $ per share per year
  yield: number;          // %
}
```

Auto-populate from `usePortfolio()`. For dividend data, fetch `GET /api/dividends?symbol={ticker}` from defeatbeta backend — sum last 4 quarterly dividends for annual figure.

**Computation:**
```ts
function project(holdings: DivHolding[], growthPct: number, years: number, drip: boolean) {
  const series: { year: number; income: number; dripIncome: number }[] = [];
  let totalShares = holdings.map(h => ({ ...h }));

  for (let y = 1; y <= years; y++) {
    const annualIncome = totalShares.reduce((s, h) => s + h.shares * h.annualDividend, 0);
    const dripShares = totalShares.reduce((s, h) => {
      // Approximate current price from yield: price ≈ annualDiv / (yield/100)
      const price = h.yield > 0 ? (h.annualDividend / (h.yield / 100)) : 0;
      return s + (price > 0 ? (h.shares * h.annualDividend) / price : 0);
    }, 0);
    if (drip) totalShares = totalShares.map((h, i) => ({ ...h, shares: h.shares + (dripShares / totalShares.length) }));
    totalShares = totalShares.map(h => ({ ...h, annualDividend: h.annualDividend * (1 + growthPct / 100) }));
    const dripAnnual = totalShares.reduce((s, h) => s + h.shares * h.annualDividend, 0);
    series.push({ year: y, income: Math.round(annualIncome), dripIncome: Math.round(drip ? dripAnnual : annualIncome) });
  }
  return series;
}
```

**Chart:** BarChart — annual income bars; if DRIP enabled, show two bar series side by side (no DRIP vs DRIP).

**Step 2: Commit**
```bash
git add src/components/calculators/income/DividendIncomeProjector.tsx
git commit -m "feat: add DividendIncomeProjector calculator"
```

---

## Task 20: Build DividendGrowthModel calculator

**Files:**
- Create: `src/components/calculators/income/DividendGrowthModel.tsx`

**Computation:**
```ts
function compute(annualDividend: number, growthPct: number, discountPct: number) {
  // Gordon Growth Model: V = D1 / (r - g)
  const D1 = annualDividend * (1 + growthPct / 100);
  const r = discountPct / 100;
  const g = growthPct / 100;
  const intrinsic = r > g ? D1 / (r - g) : null; // null if r <= g (model undefined)

  // Sensitivity grid: 5 growth rates × 5 discount rates
  const growthRates = [growthPct - 2, growthPct - 1, growthPct, growthPct + 1, growthPct + 2];
  const discountRates = [discountPct - 2, discountPct - 1, discountPct, discountPct + 1, discountPct + 2];
  const grid = growthRates.map(g => discountRates.map(r => {
    const d1 = annualDividend * (1 + g / 100);
    const rv = r / 100; const gv = g / 100;
    return rv > gv ? parseFloat((d1 / (rv - gv)).toFixed(2)) : null;
  }));

  return { intrinsic, D1, grid, growthRates, discountRates };
}
```

**Chart:** CSS grid heatmap (not recharts) — 5×5 table of intrinsic values. Cells are colour-coded: green when value > currentPrice, red when value < currentPrice. Current inputs row/column highlighted with a border.

**Auto-populate:** Ticker input → fetch dividends from defeatbeta, auto-fill `annualDividend`. Current price auto-fetched for premium/discount display.

**Step 2: Commit**
```bash
git add src/components/calculators/income/DividendGrowthModel.tsx
git commit -m "feat: add DividendGrowthModel calculator"
```

---

## Task 21: Smoke test and final cleanup

**Step 1:** Run the dev server
```bash
cd C:\Users\PC\Downloads\market-pulse
npm run dev
```
Navigate to `http://localhost:5173/calculators` and verify:
- Sidebar renders all 6 categories with correct items
- Clicking each item switches the main panel
- URL hash updates on navigation (e.g. `#risk-reward`)
- `/fee-calculators` redirects to `/calculators`
- Sidebar nav entry shows "Calculators" (not "Fee Calculators")

**Step 2:** Run the TypeScript build
```bash
npm run build
```
Expected: clean build, no TS errors.

**Step 3:** Verify auto-populate works
- Upload an IBKR CSV statement on Portfolio page
- Navigate to `/calculators#position-sizing` — confirm portfolio value pre-fills
- Navigate to `#dca` — confirm holdings dropdown populates with IBKR tickers
- Navigate to `#dividend-projector` — confirm holdings table populates

**Step 4:** Final commit
```bash
git add -A
git commit -m "feat: complete Calculators Hub with 19 calculators"
```

---

## Implementation Order Summary

| # | Task | Est. Time |
|---|---|---|
| 1 | Shared utilities (calcUtils, NumInput, StatBox, ChartTooltip) | 20 min |
| 2 | CalculatorShell + Callout | 10 min |
| 3 | Calculators hub page | 20 min |
| 4 | Route + nav updates | 10 min |
| 5 | Migrate AdvisorFee | 15 min |
| 6 | Migrate MerExpenses + AllInComparison | 20 min |
| 7 | CompoundInterest | 20 min |
| 8 | DollarCostAveraging | 30 min |
| 9 | FireRetirement | 20 min |
| 10 | MortgageVsInvest | 20 min |
| 11 | PositionSizing | 20 min |
| 12 | RiskReward | 15 min |
| 13 | MarginLeverage | 20 min |
| 14 | ShortSelling | 15 min |
| 15 | OptionsPnl | 25 min |
| 16 | CoveredCall + CashSecuredPut | 25 min |
| 17 | CapitalGainsTax | 20 min |
| 18 | TaxLossHarvesting + CostBasisMethods | 30 min |
| 19 | DividendIncomeProjector | 30 min |
| 20 | DividendGrowthModel | 25 min |
| 21 | Smoke test + cleanup | 15 min |
| **Total** | | **~6.5 hrs** |
