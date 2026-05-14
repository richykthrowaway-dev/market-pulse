import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { computeRiskScore, computeConcentration, type HoldingMin } from './riskMath';

interface Props {
  holdings: HoldingMin[];
  portfolioBeta: number;
  annualVol?: number;
  maxDrawdownPct?: number;
}

function tone(score: number) {
  if (score <= 3) return { label: 'Conservative', color: 'text-green-500',     bg: 'bg-green-500/10',     border: 'border-green-500/40' };
  if (score <= 5) return { label: 'Balanced',     color: 'text-blue-500',      bg: 'bg-blue-500/10',      border: 'border-blue-500/40' };
  if (score <= 7) return { label: 'Aggressive',   color: 'text-amber-500',     bg: 'bg-amber-500/10',     border: 'border-amber-500/40' };
  return                  { label: 'High risk',   color: 'text-destructive',   bg: 'bg-destructive/10',   border: 'border-destructive/40' };
}

export function RiskScoreCard({ holdings, portfolioBeta, annualVol, maxDrawdownPct }: Props) {
  if (holdings.length === 0) return null;

  const conc = computeConcentration(holdings);

  // Sector HHI for the score
  const total = holdings.reduce((s, h) => s + h.marketValue, 0);
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    sectorMap.set(h.sector, (sectorMap.get(h.sector) ?? 0) + h.marketValue);
  }
  const sectorWeights = [...sectorMap.values()].map(v => v / total);
  const sectorHhi = sectorWeights.reduce((s, w) => s + w * w, 0) * 10000;

  const result = computeRiskScore({
    portfolioBeta,
    hhi: conc.hhi,
    largestPct: conc.largestPct,
    sectorHhi,
    positionCount: conc.positionCount,
    annualVol,
    maxDrawdownPct,
  });

  const t = tone(result.score);
  // Convert score 1-10 → arc angle 0-180°
  const arcPct = (result.score / 10) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Risk Score</CardTitle>
            <CardDescription>
              Composite 1–10 score from beta, concentration, sector tilt
              {annualVol !== undefined ? ', volatility' : ''}
              {maxDrawdownPct !== undefined ? ', and drawdown history' : ''}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Gauge */}
          <div className={`relative flex-shrink-0 w-44 h-28 rounded-lg ${t.bg} border ${t.border} flex flex-col items-center justify-center p-3`}>
            <span className={`text-5xl font-bold tabular-nums ${t.color} leading-none`}>
              {result.score}
            </span>
            <span className="text-xs text-muted-foreground mt-1">out of 10</span>
            <span className={`text-xs font-semibold mt-1 ${t.color}`}>{t.label}</span>
            {/* horizontal scale at bottom */}
            <div className="absolute left-3 right-3 bottom-1.5 h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div className={`h-full ${t.color.replace('text-', 'bg-')}`} style={{ width: `${arcPct}%` }} />
            </div>
          </div>

          {/* Breakdown bars */}
          <div className="flex-1 w-full space-y-1.5 min-w-0">
            <p className="text-xs text-muted-foreground mb-1.5">
              Top driver: <strong className="text-foreground">{result.topDriver}</strong>
            </p>
            {result.breakdown.map(c => {
              const componentScore = c.rawScore;
              return (
                <div key={c.name} className="flex items-center gap-3 text-xs">
                  <span className="w-32 text-muted-foreground shrink-0">{c.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        componentScore <= 3 ? 'bg-green-500'
                        : componentScore <= 5 ? 'bg-blue-500'
                        : componentScore <= 7 ? 'bg-amber-500'
                        : 'bg-destructive'
                      }`}
                      style={{ width: `${componentScore * 10}%` }}
                    />
                  </div>
                  <span className="w-14 text-right tabular-nums">
                    {componentScore.toFixed(1)} <span className="text-muted-foreground">({(c.weight * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
