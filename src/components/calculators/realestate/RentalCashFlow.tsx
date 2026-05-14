// src/components/calculators/realestate/RentalCashFlow.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, XCircle, Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

function compute(
  price: number, downPct: number, rate: number, termYears: number, closingCosts: number,
  monthlyRent: number, vacancyPct: number,
  taxAnnual: number, insAnnual: number, hoaMonthly: number,
  maintPct: number, mgmtPct: number, utilities: number,
) {
  const loanAmount = price * (1 - downPct / 100);
  const downDollars = price * (downPct / 100);
  const totalCashNeeded = downDollars + closingCosts;

  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;

  let monthlyPI = 0;
  if (n > 0) {
    if (monthlyRate === 0) {
      monthlyPI = loanAmount / n;
    } else {
      monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))
        / (Math.pow(1 + monthlyRate, n) - 1);
    }
  }

  const effectiveMonthlyRent = monthlyRent * (1 - vacancyPct / 100);
  const vacancyAdj = monthlyRent - effectiveMonthlyRent;

  const monthlyTax = taxAnnual / 12;
  const monthlyIns = insAnnual / 12;
  const monthlyMaint = monthlyRent * (maintPct / 100);
  const monthlyMgmt = monthlyRent * (mgmtPct / 100);

  const totalMonthlyExpenses = monthlyPI + monthlyTax + monthlyIns
    + hoaMonthly + monthlyMaint + monthlyMgmt + utilities;

  const monthlyCashFlow = effectiveMonthlyRent - totalMonthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  const annualOpExpenses = (monthlyTax + monthlyIns + hoaMonthly + monthlyMaint + monthlyMgmt + utilities) * 12;
  const annualGrossRent = effectiveMonthlyRent * 12;
  const annualNOI = annualGrossRent - annualOpExpenses;

  const capRate = price > 0 ? (annualNOI / price) * 100 : 0;
  const cashOnCash = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;

  const onePctRule = price > 0 ? (monthlyRent / price) * 100 : 0;
  const onePctRulePass = onePctRule >= 1;

  const fiftyPctRule = annualGrossRent > 0 ? (annualOpExpenses / annualGrossRent) * 100 : 0;

  const expenseBars = [
    { name: 'Mortgage P&I', value: Math.round(monthlyPI) },
    { name: 'Property Tax', value: Math.round(monthlyTax) },
    { name: 'Insurance',    value: Math.round(monthlyIns) },
    { name: 'HOA',          value: Math.round(hoaMonthly) },
    { name: 'Maintenance',  value: Math.round(monthlyMaint) },
    { name: 'Mgmt',         value: Math.round(monthlyMgmt) },
    { name: 'Utilities',    value: Math.round(utilities) },
  ].filter(b => b.value > 0);

  return {
    loanAmount, downDollars, totalCashNeeded,
    monthlyPI, monthlyTax, monthlyIns, monthlyMaint, monthlyMgmt,
    effectiveMonthlyRent, vacancyAdj, totalMonthlyExpenses,
    monthlyCashFlow, annualCashFlow, annualNOI,
    capRate, cashOnCash, onePctRule, onePctRulePass, fiftyPctRule,
    expenseBars,
  };
}

const BAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#3b82f6', '#06b6d4', '#84cc16'];

export function RentalCashFlow() {
  // Purchase
  const [price,         setPrice]         = useState(350_000);
  const [downPct,       setDownPct]       = useState(25);
  const [rate,          setRate]          = useState(7.0);
  const [termYears,     setTermYears]     = useState(30);
  const [closingCosts,  setClosingCosts]  = useState(5_000);
  // Income
  const [monthlyRent,   setMonthlyRent]   = useState(2_400);
  const [vacancyPct,    setVacancyPct]    = useState(5);
  // Operating
  const [taxAnnual,     setTaxAnnual]     = useState(4_200);
  const [insAnnual,     setInsAnnual]     = useState(1_400);
  const [hoaMonthly,    setHoaMonthly]    = useState(0);
  const [maintPct,      setMaintPct]      = useState(8);
  const [mgmtPct,       setMgmtPct]       = useState(0);
  const [utilities,     setUtilities]     = useState(0);

  const r = useMemo(
    () => compute(price, downPct, rate, termYears, closingCosts,
      monthlyRent, vacancyPct, taxAnnual, insAnnual, hoaMonthly,
      maintPct, mgmtPct, utilities),
    [price, downPct, rate, termYears, closingCosts,
     monthlyRent, vacancyPct, taxAnnual, insAnnual, hoaMonthly,
     maintPct, mgmtPct, utilities],
  );

  const cashFlowHighlight: 'positive' | 'warning' | 'negative' =
    r.monthlyCashFlow > 200 ? 'positive'
    : r.monthlyCashFlow >= 0 ? 'warning'
    : 'negative';

  const capHighlight: 'positive' | 'warning' | undefined =
    r.capRate > 8 ? 'positive'
    : r.capRate < 4 ? 'warning'
    : undefined;

  const cocHighlight: 'positive' | 'negative' | undefined =
    r.cashOnCash > 8 ? 'positive'
    : r.cashOnCash < 0 ? 'negative'
    : undefined;

  const strongDeal = r.onePctRulePass && r.capRate > 8 && r.monthlyCashFlow > 0;
  const failsButCashFlowing = !r.onePctRulePass && r.monthlyCashFlow > 0;
  const negativeCashFlow = r.monthlyCashFlow < 0;

  const sectionTitle = (t: string) => (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">{t}</p>
  );

  return (
    <CalculatorShell
      title="Rental Cash Flow"
      description="Model monthly cash flow, cap rate, and cash-on-cash return for a rental property."
      inputs={<>
        {sectionTitle('Purchase')}
        <NumInput label="Purchase Price"      value={price}        onChange={setPrice}        min={0} step={5_000} prefix="$" />
        <NumInput label="Down Payment"        value={downPct}      onChange={setDownPct}      min={0} max={100} step={1}    suffix="%" />
        <NumInput label="Mortgage Rate"       value={rate}         onChange={setRate}         min={0} max={20}  step={0.1}  suffix="%" />
        <NumInput label="Loan Term"           value={termYears}    onChange={setTermYears}    min={1} max={40}  step={1}    suffix="yrs" />
        <NumInput label="Closing Costs"       value={closingCosts} onChange={setClosingCosts} min={0} step={500} prefix="$" />

        {sectionTitle('Income')}
        <NumInput label="Monthly Rent"        value={monthlyRent}  onChange={setMonthlyRent}  min={0} step={50}   prefix="$" />
        <NumInput label="Vacancy Rate"        value={vacancyPct}   onChange={setVacancyPct}   min={0} max={100} step={1}    suffix="%" help="Share of the year the unit sits empty" />

        {sectionTitle('Operating Expenses')}
        <NumInput label="Property Tax (Annual)" value={taxAnnual}  onChange={setTaxAnnual}    min={0} step={100}  prefix="$" />
        <NumInput label="Insurance (Annual)"    value={insAnnual}  onChange={setInsAnnual}    min={0} step={100}  prefix="$" />
        <NumInput label="HOA / Fees (Monthly)"  value={hoaMonthly} onChange={setHoaMonthly}   min={0} step={25}   prefix="$" />
        <NumInput label="Maintenance Reserve"   value={maintPct}   onChange={setMaintPct}     min={0} max={50}  step={1}    suffix="% of rent" />
        <NumInput label="Property Management"   value={mgmtPct}    onChange={setMgmtPct}      min={0} max={50}  step={1}    suffix="% of rent" help="0 if self-managed; typical 8–10%" />
        <NumInput label="Utilities (Monthly)"   value={utilities}  onChange={setUtilities}    min={0} step={25}   prefix="$" help="Only if paid by landlord" />
      </>}
      results={<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatBox
            label="Monthly Cash Flow"
            value={fmtDollar(r.monthlyCashFlow)}
            sub="After all expenses"
            highlight={cashFlowHighlight}
          />
          <StatBox
            label="Annual Cash Flow"
            value={fmtDollar(r.annualCashFlow)}
            sub="Monthly × 12"
            highlight={r.annualCashFlow > 0 ? 'positive' : r.annualCashFlow < 0 ? 'negative' : undefined}
          />
          <StatBox
            label="Cap Rate"
            value={`${r.capRate.toFixed(2)}%`}
            sub="NOI ÷ price"
            highlight={capHighlight}
          />
          <StatBox
            label="Cash-on-Cash"
            value={`${r.cashOnCash.toFixed(2)}%`}
            sub="Annual CF ÷ cash in"
            highlight={cocHighlight}
          />
          <StatBox
            label="1% Rule"
            value={r.onePctRulePass ? 'Pass' : 'Fail'}
            sub={`${r.onePctRule.toFixed(2)}% of price`}
            highlight={r.onePctRulePass ? 'positive' : 'warning'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  <tr>
                    <td className="py-1 text-muted-foreground">Rent (gross)</td>
                    <td className="py-1 text-right">{fmtDollar(monthlyRent)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Vacancy adjustment</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.vacancyAdj)}</td>
                  </tr>
                  <tr className="border-t border-border/60">
                    <td className="py-1 text-muted-foreground italic">Effective rent</td>
                    <td className="py-1 text-right italic">{fmtDollar(r.effectiveMonthlyRent)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Mortgage P&I</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.monthlyPI)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Property tax</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.monthlyTax)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Insurance</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.monthlyIns)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">HOA</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(hoaMonthly)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Maintenance</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.monthlyMaint)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Property mgmt</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(r.monthlyMgmt)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Utilities</td>
                    <td className="py-1 text-right text-destructive">−{fmtDollar(utilities)}</td>
                  </tr>
                  <tr className="border-t border-border/60">
                    <td className="py-1 text-muted-foreground italic">Total expenses</td>
                    <td className="py-1 text-right italic">{fmtDollar(r.totalMonthlyExpenses)}</td>
                  </tr>
                  <tr className="border-t-2 border-border">
                    <td className="py-2 font-bold">Net monthly cash flow</td>
                    <td className={`py-2 text-right font-bold ${r.monthlyCashFlow >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      {fmtDollar(r.monthlyCashFlow)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Capital Required</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  <tr>
                    <td className="py-1 text-muted-foreground">Loan amount</td>
                    <td className="py-1 text-right">{fmtDollar(r.loanAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Down payment</td>
                    <td className="py-1 text-right">{fmtDollar(r.downDollars)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Closing costs</td>
                    <td className="py-1 text-right">{fmtDollar(closingCosts)}</td>
                  </tr>
                  <tr className="border-t-2 border-border">
                    <td className="py-2 font-bold">Total cash needed</td>
                    <td className="py-2 text-right font-bold">{fmtDollar(r.totalCashNeeded)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 pt-4 border-t border-border/60 space-y-1.5 text-sm tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual NOI</span>
                  <span>{fmtDollar(r.annualNOI)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">50% rule (opex / gross rent)</span>
                  <span>{r.fiftyPctRule.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={r.expenseBars} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Monthly $" radius={[4, 4, 0, 0]}>
                  {r.expenseBars.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {strongDeal && (
          <Callout icon={<TrendingUp className="h-4 w-4 text-green-500" />}>
            <strong className="text-foreground">Strong rental property</strong> — passes the 1% rule
            ({r.onePctRule.toFixed(2)}%), cap rate of <strong className="text-foreground">{r.capRate.toFixed(2)}%</strong>{' '}
            is healthy, and monthly cash flow is positive at{' '}
            <strong className="text-foreground">{fmtDollar(r.monthlyCashFlow)}</strong>.
          </Callout>
        )}

        {failsButCashFlowing && (
          <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            Fails the 1% rule ({r.onePctRule.toFixed(2)}% vs 1% target) but still cash-flowing at{' '}
            <strong className="text-foreground">{fmtDollar(r.monthlyCashFlow)}/mo</strong>.
            Less margin for repairs, vacancy, or rate hikes.
          </Callout>
        )}

        {negativeCashFlow && (
          <Callout icon={<XCircle className="h-4 w-4 text-destructive" />}>
            <strong className="text-foreground">Negative cash flow</strong> of{' '}
            <strong className="text-foreground">{fmtDollar(r.monthlyCashFlow)}/mo</strong>. You're
            betting purely on appreciation — most rental investors avoid this.
          </Callout>
        )}

        <Callout icon={<Info className="h-4 w-4 text-amber-500" />}>
          Operating expenses are <strong className="text-foreground">{r.fiftyPctRule.toFixed(1)}%</strong>{' '}
          of gross rent. A common rule of thumb expects ~50% — anything below means you may be
          underestimating real costs (deferred maintenance, capex, turnover).
        </Callout>
      </>}
    />
  );
}
