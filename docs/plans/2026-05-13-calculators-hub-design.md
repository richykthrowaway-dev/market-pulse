# Design: Calculators Hub
**Date:** 2026-05-13
**Status:** Approved — ready for implementation

---

## Overview

Replace the existing `FeeCalculators` page with a unified **Calculators Hub** containing 19 calculators across 6 categories. The 3 existing fee calculators are migrated in unchanged. 16 new calculators are added.

---

## Decisions Made

| Question | Decision |
|---|---|
| Where do they live? | New `/calculators` route replaces `/fee-calculators` (redirect added) |
| Navigation | Left sidebar nav with collapsible category groups |
| Layout per calculator | 1/3 inputs card + 2/3 results (stats + chart + callout) — matches existing fee calculators exactly |
| Live data | Auto-populate from portfolio/holdings where available; all fields manually overridable |
| Visual output | Recharts charts wherever useful; same green/amber color scheme as existing calculators |

---

## Route Change

```
/fee-calculators  →  <Navigate to="/calculators" replace />
/calculators      →  Calculators.tsx (new hub page)
```

Sidebar nav entry: rename "Fee Calculators" → "Calculators".

---

## File Structure

```
src/
  pages/
    Calculators.tsx                         ← hub page (replaces FeeCalculators.tsx)
  components/calculators/
    CalculatorShell.tsx                     ← shared layout wrapper
    NumInput.tsx                            ← migrated from FeeCalculators (already exists inline)
    StatBox.tsx                             ← migrated from FeeCalculators (already exists inline)
    wealth/
      CompoundInterest.tsx
      DollarCostAveraging.tsx
      FireRetirement.tsx
      MortgageVsInvest.tsx
    trading/
      PositionSizing.tsx
      RiskReward.tsx
      MarginLeverage.tsx
      ShortSelling.tsx
    options/
      OptionsPnl.tsx
      CoveredCall.tsx
      CashSecuredPut.tsx
    tax/
      CapitalGainsTax.tsx
      TaxLossHarvesting.tsx
      CostBasisMethods.tsx
    income/
      DividendIncomeProjector.tsx
      DividendGrowthModel.tsx
    fees/
      AdvisorFee.tsx                        ← migrated from FeeCalculators.tsx
      MerExpenses.tsx                       ← migrated from FeeCalculators.tsx
      AllInComparison.tsx                   ← migrated from FeeCalculators.tsx
```

---

## Hub Page — `Calculators.tsx`

- Left sidebar (lg:col-span-1): collapsible category groups, each listing calculator names. Active item highlighted with primary accent.
- Right main panel (lg:col-span-2 or lg:col-span-3): renders active `<CalculatorComponent />`
- Active calculator tracked in URL hash (`/calculators#compound-interest`) — shareable and bookmarkable
- Default: opens `CompoundInterest` on first load
- Page header: Calculator icon + "Calculators" title + subtitle

### Sidebar categories & order
1. **Wealth Building** — Compound Interest, DCA, FIRE / Retirement, Mortgage vs Invest
2. **Trading** — Position Sizing, Risk / Reward, Margin & Leverage, Short Selling
3. **Options** — Options P&L, Covered Call, Cash-Secured Put
4. **Tax & Cost** — Capital Gains Tax, Tax-Loss Harvesting, Cost Basis Methods
5. **Income** — Dividend Income Projector, Dividend Growth Model
6. **Fees** — Advisor / Manager Fee, MER / Fund Expenses, All-In Comparison

---

## Shared Components

### `CalculatorShell`
Props: `title`, `description`, `inputs` (ReactNode), `results` (ReactNode)

```
┌─────────────────────────────────────────────────────┐
│ title + description                                  │
├──────────────────────────┬──────────────────────────┤
│  INPUTS card             │  RESULTS                 │
│  (lg:col-span-1)         │  (lg:col-span-2)         │
│  Card + CardHeader       │  StatBox row (4 boxes)   │
│  + CardContent           │  Chart card              │
│  NumInput fields         │  Insight callout         │
└──────────────────────────┴──────────────────────────┘
```

On mobile: inputs stack above results (flex-col).

### `NumInput` (extracted from FeeCalculators)
Props: `label`, `value`, `onChange`, `min?`, `max?`, `step?`, `prefix?`, `suffix?`, `help?`

### `StatBox` (extracted from FeeCalculators)
Props: `label`, `value`, `sub?`, `className?`
Renders a bordered card with large value + label + optional sub-text.

---

## Calculator Specs

### 1. Compound Interest / CAGR
**Inputs:** Principal $, annual contribution $, annual rate %, years, compounding frequency (annual/monthly), inflation rate % (optional toggle)
**Stats:** Final value, total contributed, total interest earned, real value (inflation-adjusted)
**Chart:** LineChart — principal line, total contributions line, total value line over time
**Callout:** "Your money does $X of the work — contributions only account for Y% of final value"

---

### 2. Dollar-Cost Averaging (DCA)
**Inputs:** Ticker (text, auto-populate from holdings dropdown), periodic amount $, frequency (weekly/monthly/quarterly), start date, end date
**Stats:** Total invested, current value, average cost per share, total shares, total return %
**Chart:** AreaChart — total invested (filled area) vs portfolio value (line) over time
**Callout:** "Your average cost of $X vs current price of $Y = Z% gain per share"
**Live data:** Holdings dropdown pre-populates ticker; current price auto-fetched via defeatbeta `/api/prices`

---

### 3. FIRE / Retirement Number
**Inputs:** Current savings $, monthly contribution $, expected return % (default 7%), safe withdrawal rate % (default 4%), monthly expenses in retirement $, current age, target retirement age
**Stats:** FIRE number needed, years to reach it, projected FIRE age, monthly passive income at target
**Chart:** LineChart — portfolio glide path with horizontal FIRE target line; crossover point annotated
**Callout:** "At your current savings rate you reach financial independence at age X — Y years from now"

---

### 4. Mortgage vs. Invest
**Inputs:** Extra monthly payment $, mortgage balance $, mortgage rate %, years remaining, expected market return %
**Stats:** Interest saved by paying down mortgage, projected investment value, net difference $, break-even year
**Chart:** LineChart — mortgage paydown savings vs investment portfolio value over time
**Callout:** "Investing your extra $X/month beats mortgage paydown by $Y over Z years at these rates"

---

### 5. Position Sizing
**Inputs:** Portfolio value $ (auto-populated from holdings total), risk per trade % (default 1%), entry price $, stop-loss price $
**Stats:** Max shares, position value $, max dollar risk, risk as % of portfolio
**Chart:** BarChart — portfolio sliced into: position size / rest of portfolio / amount at risk
**Callout:** "Risking 1% of your $X portfolio = $Y max loss → Z shares at $P entry with stop at $S"
**Live data:** Portfolio value pre-filled from `usePortfolio()` total market value

---

### 6. Risk / Reward
**Inputs:** Entry price $, target price $, stop-loss price $, position size (shares)
**Stats:** R/R ratio, potential gain $, potential loss $, break-even win rate %, expected value per trade
**Chart:** Custom horizontal range bar — stop zone (red) / entry point / target zone (green)
**Callout:** "You need to win X% of these trades just to break even — your R/R of Y:1 requires a Z% win rate"

---

### 7. Margin / Leverage
**Inputs:** Account equity $, leverage ratio (1x–10x), asset price $, position size (units)
**Stats:** Total exposure $, margin required $, margin call price $, liquidation price $, loss at margin call $
**Chart:** AreaChart — portfolio equity value at price moves from -50% to +50%, with margin call and liquidation lines as ReferenceLine
**Callout:** "A X% drop triggers your margin call at $Y — only Z% below current price"

---

### 8. Short Selling
**Inputs:** Entry (short) price $, current / target exit price $, shares shorted, borrow rate % per year (default 2%), days held
**Stats:** P&L $, borrow cost $, break-even price, return %, annualized return %
**Chart:** LineChart — P&L across exit price range ($0 to 2× entry), break-even and entry marked as ReferenceLines
**Callout:** "Borrow costs of $X over Y days shift your break-even from $P to $Q"

---

### 9. Options P&L at Expiry
**Inputs:** Option type (Call / Put), direction (Long / Short), strike price $, premium per share $ (paid or received), underlying current price $ (auto from quote), contracts (default 1 = 100 shares)
**Stats:** Break-even price, max gain, max loss, current intrinsic value, current P&L
**Chart:** LineChart payoff diagram — P&L across underlying prices at expiry; break-even and current price as ReferenceLines
**Callout:** "Break-even at $X — underlying needs to move Y% from here for this trade to be profitable"

---

### 10. Covered Call Income
**Inputs:** Shares owned, current stock price $ (auto from holdings), call strike $, call premium per share $, days to expiry
**Stats:** Premium income $, annualized yield %, effective sell price $, downside protection %, max profit $
**Chart:** LineChart payoff diagram at expiry — covered call P&L vs uncovered (long stock only) P&L
**Callout:** "Selling this call generates X% annualized yield and provides Y% downside buffer"
**Live data:** Holdings dropdown pre-populates shares + current price

---

### 11. Cash-Secured Put
**Inputs:** Put strike $, premium received per share $, days to expiry, underlying current price $ (auto from quote), contracts
**Stats:** Effective buy price if assigned $, annualized yield %, max gain $, break-even price $, capital required $
**Chart:** LineChart payoff diagram — P&L across underlying prices at expiry; break-even and assignment zone marked
**Callout:** "If assigned, you'd own shares at $X effective cost — Y% below current market price"

---

### 12. Capital Gains Tax
**Inputs:** Purchase price $, sale price $, shares, holding period toggle (short-term / long-term), federal income bracket (dropdown: 10/12/22/24/32/35/37%), state tax rate % (optional, default 0)
**Stats:** Gross proceeds $, cost basis $, capital gain $, federal tax $, state tax $, net proceeds $, effective tax rate %
**Chart:** StackedBarChart — cost basis / net gain after tax / federal tax / state tax
**Callout:** "Waiting X more days to qualify for long-term rates saves you $Y in federal taxes" (shown when holding period < 365 days)

---

### 13. Tax-Loss Harvesting
**Inputs:** Current value $, cost basis $ (auto from holdings), marginal tax rate %, expected annual market return %, years to reinvest proceeds
**Stats:** Harvestable loss $, immediate tax saving $, future value of tax saving reinvested, wash-sale window (30 days from today)
**Chart:** BarChart — immediate tax saving vs opportunity cost of 30-day wash-sale window vs long-term net benefit
**Callout:** "Harvesting this $X loss saves $Y today. Reinvested at Z%, that saving grows to $W by year N"
**Live data:** Holdings table pre-populated; user selects which lot to harvest

---

### 14. Cost Basis Methods
**Inputs:** Lot table — rows of (date, shares, price per share); add/remove rows; auto-populated from holdings. Sale price $, shares to sell.
**Stats:** Table comparing FIFO / LIFO / Highest Cost / Lowest Cost / Specific ID — for each: proceeds, cost basis, gain/loss $, estimated tax $
**Chart:** GroupedBarChart — estimated tax owed for each method side by side
**Callout:** "Using Highest Cost instead of FIFO saves you $X in taxes on this sale"
**Live data:** Lot table auto-populated from parsed IBKR statement cost basis data when available

---

### 15. Dividend Income Projector
**Inputs:** Holdings table (ticker, shares, annual dividend per share, yield % — auto-populated from portfolio); DRIP toggle; annual dividend growth rate % (default 5%); years to project (default 10)
**Stats:** Current annual income $, monthly income $, projected income in year N $, yield on cost %, total dividends over period $
**Chart:** BarChart — annual dividend income per year; DRIP vs no-DRIP shown as two bar series when DRIP toggled
**Callout:** "At X% annual dividend growth with DRIP enabled, your income doubles in Y years"
**Live data:** Holdings auto-populated; dividend data fetched from defeatbeta `/api/dividends`

---

### 16. Dividend Growth Model (Gordon Growth)
**Inputs:** Current annual dividend $ (auto from defeatbeta dividends), dividend growth rate % per year, required rate of return % (default: 10-year Treasury + risk premium)
**Stats:** Intrinsic value $, current market price $ (auto from quote), premium/discount to intrinsic %, implied growth rate at current price
**Chart:** Heatmap grid (CSS grid, no recharts needed) — intrinsic value across growth rate (rows) × discount rate (columns) combinations; current price cell highlighted
**Callout:** "At current price of $X, the market is pricing in Y% perpetual dividend growth"

---

### 17–19. Migrated Fee Calculators (unchanged)
- **Advisor / Manager Fee** — migrated as-is from `FeeCalculators.tsx`
- **MER / Fund Expenses** — migrated as-is
- **All-In Comparison** — migrated as-is

All internal state, computations, charts, and callout text remain identical. Only change: wrapped in `CalculatorShell` to share the layout pattern.

---

## Data Sources

| Calculator | Live data needed | Source |
|---|---|---|
| DCA | Historical prices | defeatbeta `/api/prices` |
| Position Sizing | Portfolio total value | `usePortfolio()` |
| Covered Call | Holdings + current prices | `usePortfolio()` + defeatbeta `/api/prices` |
| Tax-Loss Harvesting | Holdings cost basis | IBKR statement / `usePortfolio()` |
| Cost Basis Methods | Lot-level cost basis | IBKR statement |
| Dividend Income Projector | Holdings + dividend data | `usePortfolio()` + defeatbeta `/api/dividends` |
| Dividend Growth Model | Current price + dividends | defeatbeta `/api/prices` + `/api/dividends` |
| Options (all) | Current underlying price | defeatbeta `/api/prices` (real-time quote) |

All live data fields show an "Auto-populated" badge and remain manually overridable.

---

## Implementation Notes

- Extract `NumInput` and `StatBox` from `FeeCalculators.tsx` into `src/components/calculators/` before migrating fee calculators
- All calculators are pure client-side math — no new API routes needed beyond existing defeatbeta backend
- Recharts color conventions: green (`#22c55e`) for gains/positive, amber (`#f59e0b`) for costs/warnings, destructive for losses
- All monetary inputs use `NumInput` with `prefix="$"`; percentage inputs use `suffix="%"`
- Every calculator renders correctly with no portfolio loaded (falls back to placeholder defaults)
