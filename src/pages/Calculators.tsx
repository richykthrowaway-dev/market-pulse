// src/pages/Calculators.tsx
import { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Calculator, TrendingUp, BarChart2, Layers, Receipt, DollarSign, Percent, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Wealth
import { CompoundInterest }        from '@/components/calculators/wealth/CompoundInterest';
import { DollarCostAveraging }     from '@/components/calculators/wealth/DollarCostAveraging';
import { FireRetirement }          from '@/components/calculators/wealth/FireRetirement';
import { MortgageVsInvest }        from '@/components/calculators/wealth/MortgageVsInvest';
import { RothVsTraditional }       from '@/components/calculators/wealth/RothVsTraditional';
import { InflationAdjusted }       from '@/components/calculators/wealth/InflationAdjusted';
import { AssetAllocation }         from '@/components/calculators/wealth/AssetAllocation';
// ── Trading
import { PositionSizing }          from '@/components/calculators/trading/PositionSizing';
import { RiskReward }              from '@/components/calculators/trading/RiskReward';
import { MarginLeverage }          from '@/components/calculators/trading/MarginLeverage';
import { ShortSelling }            from '@/components/calculators/trading/ShortSelling';
import { DrawdownRecovery }        from '@/components/calculators/trading/DrawdownRecovery';
import { TradeExpectancy }         from '@/components/calculators/trading/TradeExpectancy';
import { KellyCriterion }          from '@/components/calculators/trading/KellyCriterion';
import { Pyramiding }              from '@/components/calculators/trading/Pyramiding';
// ── Options
import { OptionsPnl }              from '@/components/calculators/options/OptionsPnl';
import { CoveredCall }             from '@/components/calculators/options/CoveredCall';
import { CashSecuredPut }          from '@/components/calculators/options/CashSecuredPut';
import { VerticalSpread }          from '@/components/calculators/options/VerticalSpread';
import { BlackScholes }            from '@/components/calculators/options/BlackScholes';
// ── Real Estate
import { RentalCashFlow }          from '@/components/calculators/realestate/RentalCashFlow';
// ── Tax
import { CapitalGainsTax }         from '@/components/calculators/tax/CapitalGainsTax';
import { TaxLossHarvesting }       from '@/components/calculators/tax/TaxLossHarvesting';
import { CostBasisMethods }        from '@/components/calculators/tax/CostBasisMethods';
// ── Income
import { DividendIncomeProjector } from '@/components/calculators/income/DividendIncomeProjector';
import { DividendGrowthModel }     from '@/components/calculators/income/DividendGrowthModel';
// ── Fees (migrated)
import { AdvisorFee }              from '@/components/calculators/fees/AdvisorFee';
import { MerExpenses }             from '@/components/calculators/fees/MerExpenses';
import { AllInComparison }         from '@/components/calculators/fees/AllInComparison';

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
      { id: 'compound-interest',   label: 'Compound Interest',    component: CompoundInterest },
      { id: 'dca',                 label: 'Dollar-Cost Averaging', component: DollarCostAveraging },
      { id: 'fire',                label: 'FIRE / Retirement',    component: FireRetirement },
      { id: 'mortgage-vs-invest',  label: 'Mortgage vs Invest',   component: MortgageVsInvest },
      { id: 'roth-vs-traditional', label: 'Roth vs Traditional',  component: RothVsTraditional },
      { id: 'inflation-adjusted',  label: 'Inflation-Adjusted',   component: InflationAdjusted },
      { id: 'asset-allocation',    label: 'Asset Allocation',     component: AssetAllocation },
    ],
  },
  {
    id: 'trading', label: 'Trading', icon: BarChart2,
    items: [
      { id: 'position-sizing',    label: 'Position Sizing',    component: PositionSizing },
      { id: 'risk-reward',        label: 'Risk / Reward',      component: RiskReward },
      { id: 'margin-leverage',    label: 'Margin & Leverage',  component: MarginLeverage },
      { id: 'short-selling',      label: 'Short Selling',      component: ShortSelling },
      { id: 'drawdown-recovery',  label: 'Drawdown Recovery',  component: DrawdownRecovery },
      { id: 'trade-expectancy',   label: 'Trade Expectancy',   component: TradeExpectancy },
      { id: 'kelly-criterion',    label: 'Kelly Criterion',    component: KellyCriterion },
      { id: 'pyramiding',         label: 'Pyramiding',         component: Pyramiding },
    ],
  },
  {
    id: 'options', label: 'Options', icon: Layers,
    items: [
      { id: 'options-pnl',      label: 'Options P&L',      component: OptionsPnl },
      { id: 'covered-call',     label: 'Covered Call',     component: CoveredCall },
      { id: 'cash-secured-put', label: 'Cash-Secured Put', component: CashSecuredPut },
      { id: 'vertical-spread',  label: 'Vertical Spread',  component: VerticalSpread },
      { id: 'black-scholes',    label: 'Black-Scholes',    component: BlackScholes },
    ],
  },
  {
    id: 'realestate', label: 'Real Estate', icon: Home,
    items: [
      { id: 'rental-cash-flow', label: 'Rental Cash Flow', component: RentalCashFlow },
    ],
  },
  {
    id: 'tax', label: 'Tax & Cost', icon: Receipt,
    items: [
      { id: 'capital-gains',      label: 'Capital Gains Tax',   component: CapitalGainsTax },
      { id: 'tax-loss-harvest',   label: 'Tax-Loss Harvesting', component: TaxLossHarvesting },
      { id: 'cost-basis-methods', label: 'Cost Basis Methods',  component: CostBasisMethods },
    ],
  },
  {
    id: 'income', label: 'Income', icon: DollarSign,
    items: [
      { id: 'dividend-projector',    label: 'Dividend Projector',    component: DividendIncomeProjector },
      { id: 'dividend-growth-model', label: 'Dividend Growth Model', component: DividendGrowthModel },
    ],
  },
  {
    id: 'fees', label: 'Fees', icon: Percent,
    items: [
      { id: 'advisor-fee',       label: 'Advisor / Manager Fee', component: AdvisorFee },
      { id: 'mer-expenses',      label: 'MER / Fund Expenses',   component: MerExpenses },
      { id: 'all-in-comparison', label: 'All-In Comparison',     component: AllInComparison },
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
        <nav className="lg:col-span-1 rounded-xl border bg-card p-3 space-y-1" aria-label="Calculator navigation">
          {CATEGORIES.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <cat.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {cat.label}
              </div>
              {cat.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  aria-current={activeId === item.id ? 'page' : undefined}
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
