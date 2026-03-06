import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Zap, TrendingDown, AlertTriangle, Lightbulb, Info, ChevronDown, ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  STRESS_SCENARIOS,
  runStressTest,
  generateInsights,
  type StressScenario,
  type StressPosition,
  type StressTestResult,
  type StressInsight,
} from '@/services/stressTestEngine';

/* ─── formatters (reuse pattern from RiskAnalysis) ─── */
function fmtCurrency(v: number) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) {
  return (v * 100).toFixed(1) + '%';
}

/* ─── Scenario severity colors ─── */
const SCENARIO_STYLES: Record<string, { border: string; bg: string; text: string; accent: string }> = {
  minor:    { border: 'border-warning/40', bg: 'bg-warning/5', text: 'text-warning', accent: 'hsl(var(--warning))' },
  moderate: { border: 'border-warning/50', bg: 'bg-warning/8', text: 'text-warning', accent: 'hsl(38 80% 45%)' },
  crash:    { border: 'border-danger/40',  bg: 'bg-danger/5',  text: 'text-danger',  accent: 'hsl(var(--danger))' },
  severe:   { border: 'border-danger/60',  bg: 'bg-danger/10', text: 'text-danger',  accent: 'hsl(0 70% 45%)' },
};

const INSIGHT_ICON: Record<StressInsight['type'], React.ReactNode> = {
  info:    <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />,
  danger:  <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />,
};

/* ─── Props ─── */
interface StressTestSectionProps {
  holdings: Array<{
    ticker: string;
    name: string;
    shares: number;
    closePrice: number;
    marketValue: number;
  }>;
  betas: Record<string, number>;
  isBetaLoading: boolean;
}

export function StressTestSection({ holdings, betas, isBetaLoading }: StressTestSectionProps) {
  const [selectedScenario, setSelectedScenario] = useState<StressScenario>(STRESS_SCENARIOS[1]); // default: moderate
  const [isPositionsOpen, setIsPositionsOpen] = useState(true);

  /* ── build stress positions from existing holdings + beta data ── */
  const stressPositions: StressPosition[] = useMemo(() => {
    return holdings.map(h => ({
      symbol: h.ticker,
      name: h.name,
      quantity: h.shares,
      latestPrice: h.closePrice,
      beta: betas[h.ticker] ?? 1.0,
    }));
  }, [holdings, betas]);

  /* ── run stress test (pure computation, instant) ── */
  const result: StressTestResult | null = useMemo(() => {
    if (!stressPositions.length) return null;
    return runStressTest(stressPositions, selectedScenario);
  }, [stressPositions, selectedScenario]);

  const insights = useMemo(() => {
    if (!result) return [];
    return generateInsights(result);
  }, [result]);

  const maxLoss = useMemo(() => {
    if (!result) return 0;
    return Math.max(...result.positions.map(p => p.positionLoss), 1);
  }, [result]);

  /* ── empty state ── */
  if (!holdings.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Stress Test</CardTitle>
              <CardDescription>Upload a portfolio to simulate market stress scenarios</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No positions available for stress testing.
          </div>
        </CardContent>
      </Card>
    );
  }

  const style = SCENARIO_STYLES[selectedScenario.id];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── HEADER + SCENARIO SELECTOR ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Stress Test</CardTitle>
              <CardDescription>Simulate portfolio losses during market downturns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Market Stress Scenarios</p>
            <p className="text-[10px] text-muted-foreground">Analyze portfolio impact under different market conditions</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {STRESS_SCENARIOS.map(scenario => {
              const s = SCENARIO_STYLES[scenario.id];
              const isSelected = selectedScenario.id === scenario.id;
              return (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all duration-200',
                    s.border, s.bg,
                    'hover:scale-[1.02]',
                    isSelected && 'ring-2 ring-primary/50 shadow-md',
                  )}
                >
                  <p className="text-sm font-semibold">{scenario.name}</p>
                  <p className={cn('text-2xl font-bold font-mono mt-1', s.text)}>
                    {(scenario.marketReturn * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{scenario.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── LOADING STATE ── */}
      {isBetaLoading && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Calculating beta-adjusted impact…</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SUMMARY BAND ── */}
      {result && !isBetaLoading && (
        <Card className={cn('border-2 animate-fade-in', style.border)} style={{ borderColor: style.accent }}>
          <CardContent className="py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Current */}
              <div className="text-center sm:text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Current Portfolio Value</p>
                <p className="text-2xl font-bold font-mono mt-1">{fmtCurrency(result.currentPortfolioValue)}</p>
              </div>
              {/* Projected Loss */}
              <div className="text-center border-y sm:border-y-0 sm:border-x border-border/50 py-3 sm:py-0 sm:px-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Projected Loss</p>
                <p className={cn('text-2xl font-bold font-mono mt-1', style.text)}>
                  −{fmtCurrency(result.projectedLoss)}
                </p>
                <p className={cn('text-xs font-mono', style.text)}>
                  ({fmtPct(result.projectedLossPct)})
                </p>
              </div>
              {/* Post-crash */}
              <div className="text-center sm:text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Portfolio Value Post‑Crash</p>
                <p className="text-2xl font-bold font-mono mt-1">{fmtCurrency(result.projectedPortfolioValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── POSITION-BY-POSITION IMPACT ── */}
      {result && !isBetaLoading && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-danger" />
              <div>
                <CardTitle className="text-base">Position‑by‑Position Impact</CardTitle>
                <CardDescription>
                  Individual stock losses under {selectedScenario.name} ({(selectedScenario.marketReturn * 100).toFixed(0)}% decline)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Collapsible open={isPositionsOpen} onOpenChange={setIsPositionsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors">
                {isPositionsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {result.positions.length} positions
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
                  {result.positions.map((p, idx) => {
                    const barWidth = maxLoss > 0 ? (p.positionLoss / maxLoss) * 100 : 0;
                    const severity = p.positionLossPct > 0.2 ? 'danger' : p.positionLossPct > 0.1 ? 'warning' : 'muted-foreground';
                    return (
                      <div
                        key={p.symbol}
                        className="group flex items-center gap-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 p-2.5"
                        style={{ animationDelay: `${idx * 20}ms` }}
                      >
                        {/* Left: ticker/name */}
                        <div className="w-28 flex-shrink-0">
                          <p className="text-xs font-bold font-mono">{p.symbol}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {p.quantity} @ {fmtCurrency(p.latestPrice)}
                          </p>
                        </div>

                        {/* Center: bar */}
                        <div className="flex-1 relative h-5 bg-muted/50 rounded-full overflow-hidden">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(barWidth, 2)}%`,
                                    background: p.positionLossPct > 0.2
                                      ? 'hsl(var(--danger))'
                                      : p.positionLossPct > 0.1
                                        ? 'hsl(var(--warning))'
                                        : 'hsl(var(--primary))',
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                β = {p.beta.toFixed(2)} · Stress return = {(selectedScenario.marketReturn * p.beta * 100).toFixed(1)}%
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {/* Right: loss figures */}
                        <div className="w-24 text-right flex-shrink-0">
                          <p className={cn('text-xs font-bold font-mono', `text-${severity}`)}>
                            −{fmtCurrency(p.positionLoss)}
                          </p>
                          <p className={cn('text-[10px] font-mono', `text-${severity}`)}>
                            {fmtPct(p.positionLossPct)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* ── KEY INSIGHTS ── */}
      {insights.length > 0 && !isBetaLoading && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Key Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2.5 p-3 rounded-lg border',
                    insight.type === 'danger' ? 'bg-danger/5 border-danger/20' :
                    insight.type === 'warning' ? 'bg-warning/5 border-warning/20' :
                    'bg-primary/5 border-primary/20',
                  )}
                >
                  {INSIGHT_ICON[insight.type]}
                  <p className="text-sm leading-relaxed">{insight.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
