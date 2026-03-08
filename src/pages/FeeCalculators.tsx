import React, { useState, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Calculator, AlertTriangle, Info } from 'lucide-react';

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtDollar = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n);

const yFmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Year-by-year portfolio growth. netPct already has fee deducted. */
function growSeries(initial: number, contrib: number, netPct: number, years: number): number[] {
  const rate = Math.max(0, netPct) / 100;
  const vals = [initial];
  for (let y = 1; y <= years; y++) {
    vals.push(vals[y - 1] * (1 + rate) + contrib);
  }
  return vals;
}

// ── Advisor calculator ───────────────────────────────────────────────────────
interface AdvisorResult {
  series: { year: number; noAdvisor: number; withAdvisor: number }[];
  finalNoAdvisor: number;
  finalWithAdvisor: number;
  opportunityCost: number;
  approxFeesPaid: number;
}

function computeAdvisor(
  initial: number,
  contrib: number,
  grossPct: number,
  feePct: number,
  years: number,
): AdvisorResult {
  const noA = growSeries(initial, contrib, grossPct, years);
  const wiA = growSeries(initial, contrib, grossPct - feePct, years);

  // Approximate cumulative fees: fee charged on beginning-of-period value each year
  let approxFeesPaid = 0;
  for (let y = 1; y <= years; y++) {
    approxFeesPaid += wiA[y - 1] * (feePct / 100);
  }

  const series = noA.map((v, i) => ({
    year: i,
    noAdvisor: Math.round(v),
    withAdvisor: Math.round(wiA[i]),
  }));

  return {
    series,
    finalNoAdvisor: Math.round(noA[years]),
    finalWithAdvisor: Math.round(wiA[years]),
    opportunityCost: Math.round(noA[years] - wiA[years]),
    approxFeesPaid: Math.round(approxFeesPaid),
  };
}

// ── MER calculator ───────────────────────────────────────────────────────────
interface MerResult {
  series: { year: number; fundA: number; fundB: number }[];
  finalA: number;
  finalB: number;
  difference: number;
}

function computeMer(
  initial: number,
  contrib: number,
  grossPct: number,
  merA: number,
  merB: number,
  years: number,
): MerResult {
  const serA = growSeries(initial, contrib, grossPct - merA, years);
  const serB = growSeries(initial, contrib, grossPct - merB, years);
  const series = serA.map((v, i) => ({ year: i, fundA: Math.round(v), fundB: Math.round(serB[i]) }));
  return {
    series,
    finalA: Math.round(serA[years]),
    finalB: Math.round(serB[years]),
    difference: Math.round(Math.abs(serA[years] - serB[years])),
  };
}

// ── All-in comparison ────────────────────────────────────────────────────────
interface AllInScenario {
  name: string;
  totalFee: number;
  label: string;
  final: number;
  color: string;
}

function computeAllIn(
  initial: number,
  contrib: number,
  grossPct: number,
  years: number,
  advisorFee: number,
  etfMer: number,
  mfMer: number,
): AllInScenario[] {
  const scenarios = [
    { name: 'DIY + ETF',        totalFee: etfMer,                  label: `${etfMer}% MER only`,                      color: '#22c55e' },
    { name: 'ETF + Advisor',    totalFee: etfMer + advisorFee,     label: `${etfMer}% MER + ${advisorFee}% advisor`,  color: '#3b82f6' },
    { name: 'Mutual Fund',      totalFee: mfMer,                   label: `${mfMer}% MER only`,                       color: '#f59e0b' },
    { name: 'MF + Advisor',     totalFee: mfMer + advisorFee,      label: `${mfMer}% MER + ${advisorFee}% advisor`,   color: '#ef4444' },
  ];
  return scenarios.map(s => {
    const vals = growSeries(initial, contrib, grossPct - s.totalFee, years);
    return { ...s, final: Math.round(vals[years]) };
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────
function NumInput({
  label, value, onChange, min = 0, max, step = 1, prefix, suffix, help,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; help?: string;
}) {
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
          className={`${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
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

function StatBox({
  label, value, sub, className,
}: {
  label: string; value: string; sub?: string; className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${className ?? ''}`}>
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; name: string; color: string; value: number }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1.5">Year {label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums text-xs">
          {p.name}: {fmtDollar(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const FeeCalculators = () => {
  // --- Advisor tab state ---
  const [advInitial, setAdvInitial] = useState(100_000);
  const [advContrib, setAdvContrib]   = useState(12_000);
  const [advReturn, setAdvReturn]     = useState(7);
  const [advFee, setAdvFee]           = useState(1.0);
  const [advYears, setAdvYears]       = useState(25);

  // --- MER tab state ---
  const [merInitial, setMerInitial]   = useState(50_000);
  const [merContrib, setMerContrib]   = useState(6_000);
  const [merReturn, setMerReturn]     = useState(8);
  const [merA, setMerA]               = useState(2.0);
  const [merAName, setMerAName]       = useState('Active Fund');
  const [merB, setMerB]               = useState(0.20);
  const [merBName, setMerBName]       = useState('Index ETF');
  const [merYears, setMerYears]       = useState(30);

  // --- All-in tab state ---
  const [allInitial, setAllInitial]       = useState(100_000);
  const [allContrib, setAllContrib]       = useState(12_000);
  const [allReturn, setAllReturn]         = useState(7);
  const [allYears, setAllYears]           = useState(25);
  const [allAdvisorFee, setAllAdvisorFee] = useState(1.0);
  const [allEtfMer, setAllEtfMer]         = useState(0.20);
  const [allMfMer, setAllMfMer]           = useState(2.0);

  // --- Computations ---
  const advResult = useMemo(
    () => computeAdvisor(advInitial, advContrib, advReturn, advFee, advYears),
    [advInitial, advContrib, advReturn, advFee, advYears],
  );

  const merResult = useMemo(
    () => computeMer(merInitial, merContrib, merReturn, merA, merB, merYears),
    [merInitial, merContrib, merReturn, merA, merB, merYears],
  );

  const allInResult = useMemo(
    () => computeAllIn(allInitial, allContrib, allReturn, allYears, allAdvisorFee, allEtfMer, allMfMer),
    [allInitial, allContrib, allReturn, allYears, allAdvisorFee, allEtfMer, allMfMer],
  );

  return (
    <PageLayout
      title="Fee Calculators"
      description="Understand the long-term impact of advisor and fund management fees on your portfolio."
    >
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Investment Fee Calculators</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visualise how advisor fees and fund MERs compound into significant drag on your long-term returns.
            </p>
          </div>
        </div>

        <Tabs defaultValue="advisor" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="advisor">Advisor / Manager Fee</TabsTrigger>
            <TabsTrigger value="mer">MER / Fund Expenses</TabsTrigger>
            <TabsTrigger value="allin">All-In Comparison</TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 1 — Advisor Fee Impact
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="advisor">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Inputs ── */}
              <Card className="lg:col-span-1 h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inputs</CardTitle>
                  <CardDescription>
                    Your advisor charges an annual percentage of your assets under management (AUM).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NumInput
                    label="Starting Portfolio Value"
                    value={advInitial}
                    onChange={setAdvInitial}
                    min={1_000}
                    step={5_000}
                    prefix="$"
                  />
                  <NumInput
                    label="Annual Contribution"
                    value={advContrib}
                    onChange={setAdvContrib}
                    min={0}
                    step={1_000}
                    prefix="$"
                    help="Added at year-end each year"
                  />
                  <NumInput
                    label="Expected Return (Gross)"
                    value={advReturn}
                    onChange={setAdvReturn}
                    min={0}
                    max={30}
                    step={0.5}
                    suffix="%"
                    help="Before any fees are deducted"
                  />
                  <Separator />
                  <NumInput
                    label="Advisor / Manager Fee"
                    value={advFee}
                    onChange={setAdvFee}
                    min={0}
                    max={5}
                    step={0.1}
                    suffix="% AUM/yr"
                    help="Typical range: 0.5% – 2.0%"
                  />
                  <NumInput
                    label="Investment Horizon"
                    value={advYears}
                    onChange={setAdvYears}
                    min={1}
                    max={50}
                    step={1}
                    suffix="years"
                  />
                </CardContent>
              </Card>

              {/* ── Results ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Key stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox
                    label="No Advisor"
                    value={fmtCompact(advResult.finalNoAdvisor)}
                    sub={`After ${advYears} yrs`}
                  />
                  <StatBox
                    label={`With ${advFee}% Advisor`}
                    value={fmtCompact(advResult.finalWithAdvisor)}
                    sub={`After ${advYears} yrs`}
                  />
                  <StatBox
                    label="Compounding Drag"
                    value={fmtCompact(advResult.opportunityCost)}
                    sub="Total opportunity cost"
                    className="border-destructive/40"
                  />
                  <StatBox
                    label="Fees Paid (est.)"
                    value={fmtCompact(advResult.approxFeesPaid)}
                    sub="Direct AUM charges"
                  />
                </div>

                {/* Growth chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Portfolio Growth Over {advYears} Years
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart
                        data={advResult.series}
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
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
                        <Line
                          type="monotone"
                          dataKey="noAdvisor"
                          name="Self-Directed (no fee)"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="withAdvisor"
                          name={`With Advisor (${advFee}% fee)`}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="6 3"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Insight callout */}
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground leading-relaxed">
                    A{' '}
                    <strong className="text-foreground">{advFee}% annual advisor fee</strong> results in{' '}
                    <strong className="text-foreground">{fmtDollar(advResult.opportunityCost)}</strong> in
                    compounding drag over {advYears} years — that's{' '}
                    <strong className="text-foreground">
                      {advResult.finalNoAdvisor > 0
                        ? ((advResult.opportunityCost / advResult.finalNoAdvisor) * 100).toFixed(1)
                        : '0'}%
                    </strong>{' '}
                    of your potential portfolio value. This includes both the fees themselves and the
                    growth you forgo on those dollars.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 2 — MER / Fund Expenses
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="mer">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Inputs ── */}
              <Card className="lg:col-span-1 h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inputs</CardTitle>
                  <CardDescription>
                    Compare two funds with different Management Expense Ratios. MERs are deducted from
                    fund assets annually and reduce your net return.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NumInput
                    label="Starting Portfolio Value"
                    value={merInitial}
                    onChange={setMerInitial}
                    min={1_000}
                    step={5_000}
                    prefix="$"
                  />
                  <NumInput
                    label="Annual Contribution"
                    value={merContrib}
                    onChange={setMerContrib}
                    min={0}
                    step={1_000}
                    prefix="$"
                  />
                  <NumInput
                    label="Expected Gross Return"
                    value={merReturn}
                    onChange={setMerReturn}
                    min={0}
                    max={30}
                    step={0.5}
                    suffix="%"
                    help="Before MER deduction"
                  />
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Fund A Name</Label>
                    <Input
                      value={merAName}
                      onChange={e => setMerAName(e.target.value)}
                      placeholder="e.g. Active Mutual Fund"
                    />
                  </div>
                  <NumInput
                    label="Fund A MER"
                    value={merA}
                    onChange={setMerA}
                    min={0}
                    max={5}
                    step={0.01}
                    suffix="%"
                    help="Active mutual funds: 1.5% – 2.5%"
                  />
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Fund B Name</Label>
                    <Input
                      value={merBName}
                      onChange={e => setMerBName(e.target.value)}
                      placeholder="e.g. Index ETF"
                    />
                  </div>
                  <NumInput
                    label="Fund B MER"
                    value={merB}
                    onChange={setMerB}
                    min={0}
                    max={5}
                    step={0.01}
                    suffix="%"
                    help="Index ETFs: 0.05% – 0.30%"
                  />
                  <Separator />
                  <NumInput
                    label="Investment Horizon"
                    value={merYears}
                    onChange={setMerYears}
                    min={1}
                    max={50}
                    step={1}
                    suffix="years"
                  />
                </CardContent>
              </Card>

              {/* ── Results ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Key stats */}
                <div className="grid grid-cols-3 gap-3">
                  <StatBox
                    label={merAName}
                    value={fmtCompact(merResult.finalA)}
                    sub={`${merA}% MER`}
                  />
                  <StatBox
                    label={merBName}
                    value={fmtCompact(merResult.finalB)}
                    sub={`${merB}% MER`}
                  />
                  <StatBox
                    label="MER Gap (final value)"
                    value={fmtCompact(merResult.difference)}
                    sub={`${Math.abs(merA - merB).toFixed(2)}% annual drag`}
                    className="border-destructive/40"
                  />
                </div>

                {/* Growth chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Fund Growth Comparison Over {merYears} Years
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart
                        data={merResult.series}
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
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
                        <Line
                          type="monotone"
                          dataKey="fundA"
                          name={`${merAName} (${merA}%)`}
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="6 3"
                        />
                        <Line
                          type="monotone"
                          dataKey="fundB"
                          name={`${merBName} (${merB}%)`}
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* MER breakdown table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">What You Pay in MER Each Year</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y text-sm">
                      {[
                        { name: merAName, mer: merA, final: merResult.finalA, color: '#ef4444' },
                        { name: merBName, mer: merB, final: merResult.finalB, color: '#3b82f6' },
                      ].map((f, i) => {
                        const approxFirstYearFee = merInitial * (f.mer / 100);
                        const approxLastYearFee  = f.final * (f.mer / 100);
                        return (
                          <div key={i} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                              <div>
                                <p className="font-medium">{f.name}</p>
                                <p className="text-xs text-muted-foreground">{f.mer}% MER</p>
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground space-y-0.5">
                              <p>Year 1 fee: <strong className="text-foreground">{fmtDollar(approxFirstYearFee)}</strong></p>
                              <p>Year {merYears} fee: <strong className="text-foreground">{fmtDollar(approxLastYearFee)}</strong></p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Insight */}
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground leading-relaxed">
                    The{' '}
                    <strong className="text-foreground">{Math.abs(merA - merB).toFixed(2)}%</strong> MER
                    difference between <em>{merAName}</em> and <em>{merBName}</em> compounds into a{' '}
                    <strong className="text-foreground">{fmtDollar(merResult.difference)}</strong> gap
                    over {merYears} years. MERs are deducted silently from fund assets — you never see
                    a bill, but the drag is very real.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 3 — All-In Cost Comparison
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="allin">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Inputs ── */}
              <Card className="lg:col-span-1 h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inputs</CardTitle>
                  <CardDescription>
                    Compare four common investment setups side-by-side: from low-cost DIY to a fully
                    managed mutual fund portfolio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NumInput
                    label="Starting Portfolio Value"
                    value={allInitial}
                    onChange={setAllInitial}
                    min={1_000}
                    step={5_000}
                    prefix="$"
                  />
                  <NumInput
                    label="Annual Contribution"
                    value={allContrib}
                    onChange={setAllContrib}
                    min={0}
                    step={1_000}
                    prefix="$"
                  />
                  <NumInput
                    label="Expected Gross Return"
                    value={allReturn}
                    onChange={setAllReturn}
                    min={0}
                    max={30}
                    step={0.5}
                    suffix="%"
                  />
                  <NumInput
                    label="Investment Horizon"
                    value={allYears}
                    onChange={setAllYears}
                    min={1}
                    max={50}
                    step={1}
                    suffix="years"
                  />
                  <Separator />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Customise Assumptions
                  </p>
                  <NumInput
                    label="Advisor / Manager Fee"
                    value={allAdvisorFee}
                    onChange={setAllAdvisorFee}
                    min={0}
                    max={5}
                    step={0.1}
                    suffix="% AUM/yr"
                  />
                  <NumInput
                    label="ETF MER"
                    value={allEtfMer}
                    onChange={setAllEtfMer}
                    min={0}
                    max={3}
                    step={0.01}
                    suffix="%"
                  />
                  <NumInput
                    label="Mutual Fund MER"
                    value={allMfMer}
                    onChange={setAllMfMer}
                    min={0}
                    max={5}
                    step={0.1}
                    suffix="%"
                  />
                </CardContent>
              </Card>

              {/* ── Results ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Bar chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Final Portfolio Value After {allYears} Years
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={allInResult}
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as AllInScenario;
                            return (
                              <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
                                <p className="font-semibold">{d.name}</p>
                                <p className="text-muted-foreground text-xs mt-0.5">{d.label}</p>
                                <p className="font-bold mt-1 tabular-nums">{fmtDollar(d.final)}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="final" name="Final Value" radius={[5, 5, 0, 0]}>
                          {allInResult.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Breakdown table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Scenario Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y text-sm">
                      {allInResult.map((s, i) => {
                        const best         = allInResult[0].final;
                        const costVsBest   = best - s.final;
                        const pctLost      = best > 0 ? (costVsBest / best) * 100 : 0;
                        return (
                          <div key={i} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: s.color }}
                              />
                              <div className="min-w-0">
                                <p className="font-medium">{s.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold tabular-nums">{fmtDollar(s.final)}</p>
                              {costVsBest > 0 ? (
                                <p className="text-xs text-destructive tabular-nums">
                                  −{fmtDollar(costVsBest)}{' '}
                                  <span className="text-muted-foreground">({pctLost.toFixed(1)}% less)</span>
                                </p>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 mt-0.5">
                                  Best outcome
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Insight */}
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground leading-relaxed">
                    The worst-case scenario (Mutual Fund + Advisor) costs{' '}
                    <strong className="text-foreground">
                      {fmtDollar(allInResult[0].final - allInResult[allInResult.length - 1].final)}
                    </strong>{' '}
                    more than DIY + ETF over {allYears} years — a{' '}
                    <strong className="text-foreground">
                      {allInResult[0].final > 0
                        ? (((allInResult[0].final - allInResult[allInResult.length - 1].final) / allInResult[0].final) * 100).toFixed(1)
                        : '0'}%
                    </strong>{' '}
                    reduction in final wealth driven entirely by fees.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground text-center pb-2">
          For educational purposes only. Results assume constant annual returns and fees and do not constitute financial advice.
          Actual returns will vary. Consult a qualified financial professional before making investment decisions.
        </p>
      </div>
    </PageLayout>
  );
};

export default FeeCalculators;
