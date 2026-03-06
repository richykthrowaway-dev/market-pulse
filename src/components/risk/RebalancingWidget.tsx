import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Scale, ChevronDown, ChevronUp, AlertTriangle, Info, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectorBadge } from '@/components/ui/SectorBadge';
import { getGicsSectorColor } from '@/lib/gicsColors';

/* ─── types ─── */
export interface RebalanceHolding {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  shares: number;
  closePrice: number;
  marketValue: number;
}

type TargetMode = 'equal' | 'position' | 'sector' | 'country';

interface PersistedTargets {
  mode: TargetMode;
  tolerance: number;
  customWeights: Record<string, number>; // ticker → target %
  sectorWeights: Record<string, number>; // sector → target %
  countryWeights: Record<string, number>; // country → target %
}

interface RebalanceRow {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  shares: number;
  closePrice: number;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  targetValue: number;
  deviation: number;
  sharesToTrade: number; // positive = buy, negative = sell
  actionRecommended: boolean;
}

/* ─── persistence ─── */
const STORAGE_KEY = 'rebalance-targets-v1';

function readTargets(): PersistedTargets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { mode: 'equal', tolerance: 0.5, customWeights: {}, sectorWeights: {}, countryWeights: {} };
}

function writeTargets(t: PersistedTargets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* noop */ }
}

/* ─── formatters ─── */
function fmtCurrency(v: number) {
  const sign = v < 0 ? '−' : '';
  return sign + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) {
  return v.toFixed(2) + '%';
}

/* ─── compute engine ─── */
function computeRebalance(
  holdings: RebalanceHolding[],
  totalValue: number,
  mode: TargetMode,
  customWeights: Record<string, number>,
  sectorWeights: Record<string, number>,
  countryWeights: Record<string, number>,
  tolerance: number,
): RebalanceRow[] {
  if (!holdings.length || totalValue <= 0) return [];

  // Compute group-level target weights first
  const sectors = [...new Set(holdings.map(h => h.sector))];
  const countries = [...new Set(holdings.map(h => h.country))];

  return holdings.map(h => {
    const currentValue = h.marketValue;
    const currentWeight = (currentValue / totalValue) * 100;

    let targetWeight: number;
    if (mode === 'equal') {
      targetWeight = 100 / holdings.length;
    } else if (mode === 'position') {
      targetWeight = customWeights[h.ticker] ?? (100 / holdings.length);
    } else if (mode === 'sector') {
      const sectorTarget = sectorWeights[h.sector] ?? (100 / sectors.length);
      const sectorHoldings = holdings.filter(x => x.sector === h.sector);
      targetWeight = sectorTarget / sectorHoldings.length;
    } else {
      // country
      const countryTarget = countryWeights[h.country] ?? (100 / countries.length);
      const countryHoldings = holdings.filter(x => x.country === h.country);
      targetWeight = countryTarget / countryHoldings.length;
    }

    const targetValue = (targetWeight / 100) * totalValue;
    const deviation = currentWeight - targetWeight;
    const valueDiff = targetValue - currentValue;
    const sharesToTrade = h.closePrice > 0 ? Math.round(valueDiff / h.closePrice) : 0;
    const actionRecommended = Math.abs(deviation) > tolerance;

    return {
      ticker: h.ticker,
      name: h.name,
      sector: h.sector,
      country: h.country,
      shares: h.shares,
      closePrice: h.closePrice,
      currentValue,
      currentWeight,
      targetWeight,
      targetValue,
      deviation,
      sharesToTrade,
      actionRecommended,
    };
  }).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

/* ─── Mode button component ─── */
function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

/* ─── Group editor (sector / country) ─── */
function GroupWeightEditor({
  groups,
  weights,
  onChange,
}: {
  groups: string[];
  weights: Record<string, number>;
  onChange: (group: string, value: number) => void;
}) {
  const defaultW = groups.length ? 100 / groups.length : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
      {groups.map(g => (
        <div key={g} className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ backgroundColor: `${getGicsSectorColor(g)}11` }}>
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: getGicsSectorColor(g) }}
          />
          <span className="text-xs truncate flex-1 font-medium">{g}</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={weights[g] ?? Number(defaultW.toFixed(1))}
            onChange={e => onChange(g, parseFloat(e.target.value) || 0)}
            className="w-16 h-6 text-xs font-mono text-right px-1 py-0"
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN WIDGET
   ═══════════════════════════════════════════════ */
interface RebalancingWidgetProps {
  holdings: RebalanceHolding[];
}

export function RebalancingWidget({ holdings }: RebalancingWidgetProps) {
  const [targets, setTargets] = useState<PersistedTargets>(readTargets);
  const [isListOpen, setIsListOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persist on change
  useEffect(() => { writeTargets(targets); }, [targets]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.marketValue, 0), [holdings]);

  const sectors = useMemo(() => [...new Set(holdings.map(h => h.sector))].sort(), [holdings]);
  const countries = useMemo(() => [...new Set(holdings.map(h => h.country))].sort(), [holdings]);

  const rows = useMemo(
    () => computeRebalance(
      holdings, totalValue, targets.mode,
      targets.customWeights, targets.sectorWeights, targets.countryWeights,
      targets.tolerance,
    ),
    [holdings, totalValue, targets],
  );

  const actionCount = useMemo(() => rows.filter(r => r.actionRecommended).length, [rows]);
  const maxDeviation = useMemo(() => Math.max(...rows.map(r => Math.abs(r.deviation)), 0.01), [rows]);

  const updateMode = useCallback((mode: TargetMode) => {
    setTargets(prev => ({ ...prev, mode }));
  }, []);

  const updateTolerance = useCallback((tolerance: number) => {
    setTargets(prev => ({ ...prev, tolerance }));
  }, []);

  const updateCustomWeight = useCallback((ticker: string, value: number) => {
    setTargets(prev => ({
      ...prev,
      customWeights: { ...prev.customWeights, [ticker]: value },
    }));
  }, []);

  const updateSectorWeight = useCallback((sector: string, value: number) => {
    setTargets(prev => ({
      ...prev,
      sectorWeights: { ...prev.sectorWeights, [sector]: value },
    }));
  }, []);

  const updateCountryWeight = useCallback((country: string, value: number) => {
    setTargets(prev => ({
      ...prev,
      countryWeights: { ...prev.countryWeights, [country]: value },
    }));
  }, []);

  /* ── empty state ── */
  if (!holdings.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Rebalancing Analysis</CardTitle>
              <CardDescription>Upload a portfolio to view rebalancing recommendations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No positions available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const modeLabel: Record<TargetMode, string> = {
    equal: `Equal weight (${(100 / holdings.length).toFixed(1)}% each)`,
    position: 'Custom per-position targets',
    sector: 'Sector-weighted targets',
    country: 'Country-weighted targets',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── HEADER CARD with controls ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Rebalancing Analysis</CardTitle>
                <CardDescription>{modeLabel[targets.mode]}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {actionCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive-foreground animate-pulse" />
                  {actionCount} Action{actionCount > 1 ? 's' : ''} Recommended
                </Badge>
              )}
              <button
                onClick={() => setIsSettingsOpen(o => !o)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  isSettingsOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Rebalancing settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mode selector */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <ModeButton active={targets.mode === 'equal'} label="Equal Weight" onClick={() => updateMode('equal')} />
            <ModeButton active={targets.mode === 'position'} label="By Position" onClick={() => updateMode('position')} />
            <ModeButton active={targets.mode === 'sector'} label="By Sector" onClick={() => updateMode('sector')} />
            <ModeButton active={targets.mode === 'country'} label="By Country" onClick={() => updateMode('country')} />
          </div>

          {/* Settings panel */}
          {isSettingsOpen && (
            <div className="bg-muted/30 rounded-lg p-3 mb-3 animate-fade-in border border-border/50">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Tolerance Band
                  </label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-xs">
                        Holdings with deviation exceeding this threshold are flagged for action.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={targets.tolerance}
                    onChange={e => updateTolerance(parseFloat(e.target.value) || 0.5)}
                    className="w-20 h-7 text-xs font-mono text-right"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          )}

          {/* Group weight editors */}
          {targets.mode === 'sector' && (
            <GroupWeightEditor groups={sectors} weights={targets.sectorWeights} onChange={updateSectorWeight} />
          )}
          {targets.mode === 'country' && (
            <GroupWeightEditor groups={countries} weights={targets.countryWeights} onChange={updateCountryWeight} />
          )}

          {/* Summary stats band */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Value</p>
              <p className="text-lg font-bold font-mono mt-0.5">{fmtCurrency(totalValue)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Positions</p>
              <p className="text-lg font-bold font-mono mt-0.5">{holdings.length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Max Deviation</p>
              <p className={cn('text-lg font-bold font-mono mt-0.5', maxDeviation > 5 ? 'text-danger' : maxDeviation > 2 ? 'text-warning' : 'text-foreground')}>
                {fmtPct(maxDeviation)}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Actions Needed</p>
              <p className={cn('text-lg font-bold font-mono mt-0.5', actionCount > 0 ? 'text-danger' : 'text-success')}>
                {actionCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── POSITION LIST ── */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <Collapsible open={isListOpen} onOpenChange={setIsListOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full group">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm flex-1 text-left">Position Breakdown</CardTitle>
              {isListOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-0 pt-3 pb-0">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_90px_80px_90px] gap-2 px-4 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/40">
                  <span>Holding</span>
                  <span className="text-right">Current %</span>
                  <span className="text-right">Target %</span>
                  <span className="text-right">Deviation</span>
                  <span className="text-right">Target Value</span>
                  <span className="text-right">Shares Δ</span>
                  <span className="text-right">Status</span>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  {rows.map((r, idx) => {
                    const barPct = maxDeviation > 0 ? (Math.abs(r.deviation) / maxDeviation) * 100 : 0;
                    const isOver = r.deviation > 0;

                    return (
                      <div
                        key={r.ticker}
                        className={cn(
                          'group px-4 py-3 border-b border-border/20 transition-all duration-200',
                          'hover:bg-muted/40',
                          r.actionRecommended && 'bg-danger/[0.03]',
                        )}
                        style={{ animationDelay: `${idx * 15}ms` }}
                      >
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_90px_80px_90px] gap-2 items-center">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold font-mono">{r.ticker}</span>
                              <SectorBadge sector={r.sector} size="xs" />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground truncate">{r.name}</span>
                              {r.country && r.country !== 'Other' && (
                                <span className="text-[10px] text-muted-foreground">• {r.country}</span>
                              )}
                            </div>
                            {/* Deviation bar */}
                            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 w-full max-w-[200px]">
                              <div
                                className="absolute top-0 h-full w-0.5 bg-foreground/20 z-10"
                                style={{ left: '50%' }}
                              />
                              <div
                                className={cn(
                                  'absolute inset-y-0 rounded-full transition-all duration-500',
                                  isOver ? 'bg-danger/60' : 'bg-success/60',
                                )}
                                style={{
                                  width: `${Math.min(barPct / 2, 50)}%`,
                                  ...(isOver
                                    ? { left: '50%' }
                                    : { right: '50%', left: `${50 - Math.min(barPct / 2, 50)}%` }),
                                }}
                              />
                            </div>
                            {/* Custom target input when in position mode */}
                            {targets.mode === 'position' && (
                              <div className="flex items-center gap-1 mt-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={targets.customWeights[r.ticker] ?? Number(r.targetWeight.toFixed(1))}
                                  onChange={e => updateCustomWeight(r.ticker, parseFloat(e.target.value) || 0)}
                                  className="w-16 h-5 text-[10px] font-mono text-right px-1 py-0"
                                />
                                <span className="text-[9px] text-muted-foreground">% target</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono text-right">{fmtPct(r.currentWeight)}</span>
                          <span className="text-xs font-mono text-right text-muted-foreground">{fmtPct(r.targetWeight)}</span>
                          <span className={cn(
                            'text-xs font-mono font-semibold text-right',
                            r.actionRecommended
                              ? (isOver ? 'text-danger' : 'text-success')
                              : 'text-muted-foreground',
                          )}>
                            {isOver ? '+' : ''}{fmtPct(r.deviation)}
                          </span>
                          <span className="text-xs font-mono text-right">{fmtCurrency(r.targetValue)}</span>
                          <span className={cn(
                            'text-xs font-mono font-semibold text-right',
                            r.sharesToTrade > 0 ? 'text-success' : r.sharesToTrade < 0 ? 'text-danger' : 'text-muted-foreground',
                          )}>
                            {r.sharesToTrade > 0 ? '+' : ''}{r.sharesToTrade}
                          </span>
                          <div className="flex justify-end">
                            {r.actionRecommended ? (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[9px] gap-0.5',
                                        isOver
                                          ? 'border-danger/50 text-danger'
                                          : 'border-success/50 text-success',
                                      )}
                                    >
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      {isOver ? 'Sell' : 'Buy'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {isOver
                                      ? `Overweight by ${fmtPct(Math.abs(r.deviation))} — sell ~${Math.abs(r.sharesToTrade)} shares`
                                      : `Underweight by ${fmtPct(Math.abs(r.deviation))} — buy ~${Math.abs(r.sharesToTrade)} shares`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge variant="outline" className="text-[9px] border-border/50 text-muted-foreground">
                                OK
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-bold font-mono">{r.ticker}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">{r.name}</span>
                            </div>
                            {r.actionRecommended ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[9px] gap-0.5',
                                  isOver ? 'border-danger/50 text-danger' : 'border-success/50 text-success',
                                )}
                              >
                                {isOver ? 'Sell' : 'Buy'} {Math.abs(r.sharesToTrade)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">OK</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground block">Current</span>
                              <span className="font-mono font-medium">{fmtPct(r.currentWeight)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Target</span>
                              <span className="font-mono font-medium">{fmtPct(r.targetWeight)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Deviation</span>
                              <span className={cn('font-mono font-semibold', r.actionRecommended ? (isOver ? 'text-danger' : 'text-success') : '')}>
                                {isOver ? '+' : ''}{fmtPct(r.deviation)}
                              </span>
                            </div>
                          </div>
                          {/* Deviation bar mobile */}
                          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="absolute top-0 h-full w-0.5 bg-foreground/20 z-10" style={{ left: '50%' }} />
                            <div
                              className={cn('absolute inset-y-0 rounded-full', isOver ? 'bg-danger/60' : 'bg-success/60')}
                              style={{
                                width: `${Math.min(barPct / 2, 50)}%`,
                                ...(isOver ? { left: '50%' } : { right: '50%', left: `${50 - Math.min(barPct / 2, 50)}%` }),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>
    </div>
  );
}
