import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGicsSectorColor } from '@/lib/gicsColors';
import type { HoldingMin } from './riskMath';

function fmtCurrency(v: number) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) { return v.toFixed(2) + '%'; }

interface CrashScenario {
  id: string;
  sector: string;       // GICS-normalised sector to match
  label: string;
  decline: number;      // negative decimal, e.g. -0.30
  historical: string;   // brief context
}

// Historically-anchored sector crash scenarios
const SECTOR_CRASHES: CrashScenario[] = [
  { id: 'tech-30',     sector: 'Information Technology', label: 'Tech −30%',         decline: -0.30, historical: 'Like Q4 2018 or COVID March 2020' },
  { id: 'tech-50',     sector: 'Information Technology', label: 'Tech −50% (dot-com)', decline: -0.50, historical: 'Like the 2000–2002 NASDAQ collapse' },
  { id: 'fin-40',      sector: 'Financials',             label: 'Financials −40%',    decline: -0.40, historical: 'Like the 2008 GFC' },
  { id: 'energy-50',   sector: 'Energy',                 label: 'Energy −50%',        decline: -0.50, historical: 'Like 2014 oil crash or 2020 COVID' },
  { id: 'health-25',   sector: 'Health Care',            label: 'Healthcare −25%',    decline: -0.25, historical: 'Policy / regulatory shock' },
  { id: 'real-35',     sector: 'Real Estate',            label: 'Real Estate −35%',   decline: -0.35, historical: 'Like 2007–2009 housing crisis' },
  { id: 'cons-30',     sector: 'Consumer Discretionary', label: 'Consumer Disc −30%', decline: -0.30, historical: 'Recessionary pullback' },
  { id: 'commun-40',   sector: 'Communication Services', label: 'Comm Services −40%', decline: -0.40, historical: 'Dot-com / media disruption' },
];

interface Props { holdings: HoldingMin[]; }

export function SectorCrashCard({ holdings }: Props) {
  const [selectedId, setSelectedId] = useState<string>('tech-30');
  const selected = SECTOR_CRASHES.find(s => s.id === selectedId) ?? SECTOR_CRASHES[0];

  // Build sector buckets
  const { total, sectorMap, impacted, notImpacted } = useMemo(() => {
    const total = holdings.reduce((s, h) => s + h.marketValue, 0);
    const sectorMap = new Map<string, number>();
    for (const h of holdings) {
      sectorMap.set(h.sector || 'Other', (sectorMap.get(h.sector || 'Other') ?? 0) + h.marketValue);
    }
    const impactedValue = sectorMap.get(selected.sector) ?? 0;
    return {
      total,
      sectorMap,
      impacted: impactedValue,
      notImpacted: total - impactedValue,
    };
  }, [holdings, selected]);

  if (total === 0) return null;

  const exposurePct = (impacted / total) * 100;
  const projectedLoss = impacted * selected.decline; // negative
  const projectedLossPct = (projectedLoss / total) * 100; // negative
  const newTotal = total + projectedLoss;

  // List only holdings hit by this scenario
  const hitHoldings = useMemo(
    () => holdings
      .filter(h => h.sector === selected.sector)
      .map(h => ({
        ...h,
        loss: h.marketValue * selected.decline, // negative
        newValue: h.marketValue * (1 + selected.decline),
      }))
      .sort((a, b) => a.loss - b.loss),
    [holdings, selected],
  );

  // Decide tone
  const tone = exposurePct < 5  ? { label: 'Low exposure',     bg: 'bg-green-500/10',     border: 'border-green-500/40',     text: 'text-green-500' }
             : exposurePct < 15 ? { label: 'Moderate exposure', bg: 'bg-amber-500/10',    border: 'border-amber-500/40',     text: 'text-amber-500' }
             :                    { label: 'High exposure',     bg: 'bg-destructive/10',  border: 'border-destructive/40',   text: 'text-destructive' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Sector Crash Scenarios</CardTitle>
            <CardDescription>
              Simulate sector-specific shocks instead of market-wide drawdowns
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Scenario buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {SECTOR_CRASHES.map(s => {
            const isSel = s.id === selectedId;
            const sectorExposure = (sectorMap.get(s.sector) ?? 0) / total * 100;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  isSel
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/50'
                    : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <p className="text-xs font-semibold truncate">{s.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.historical}</p>
                <p className="text-[10px] mt-1">
                  <span className="text-muted-foreground">Your exposure: </span>
                  <span className={sectorExposure > 15 ? 'text-destructive font-semibold' : sectorExposure > 5 ? 'text-amber-500 font-semibold' : 'text-foreground'}>
                    {sectorExposure.toFixed(1)}%
                  </span>
                </p>
              </button>
            );
          })}
        </div>

        {/* Summary band */}
        <Card className={cn('border-2 mb-4', tone.border)}>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sector exposure</p>
                <p className="text-2xl font-bold font-mono mt-0.5">{fmtPct(exposurePct)}</p>
                <Badge variant="outline" className={`text-[10px] mt-1 ${tone.text} border-current`}>{tone.label}</Badge>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sector value</p>
                <p className="text-2xl font-bold font-mono mt-0.5">{fmtCurrency(impacted)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">at risk</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Projected loss</p>
                <p className={`text-2xl font-bold font-mono mt-0.5 ${tone.text}`}>−{fmtCurrency(projectedLoss)}</p>
                <p className={`text-[10px] mt-1 ${tone.text}`}>{fmtPct(projectedLossPct)} of portfolio</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Post-shock value</p>
                <p className="text-2xl font-bold font-mono mt-0.5">{fmtCurrency(newTotal)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">vs {fmtCurrency(total)} today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hit holdings */}
        {hitHoldings.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {hitHoldings.length} position{hitHoldings.length !== 1 ? 's' : ''} affected
            </p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {hitHoldings.map(h => (
                <div key={h.ticker} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5">
                  <div className="w-2 h-8 rounded-sm shrink-0" style={{ backgroundColor: getGicsSectorColor(h.sector) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold font-mono">{h.ticker}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{h.sector}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-muted-foreground">{fmtCurrency(h.marketValue)}</p>
                    <p className="text-xs font-mono font-semibold text-destructive">
                      {fmtCurrency(h.loss)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            No positions in {selected.sector}. This scenario has no direct portfolio impact.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
