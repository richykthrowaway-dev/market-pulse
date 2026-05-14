import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Layers } from 'lucide-react';
import { computeConcentration, type HoldingMin } from './riskMath';

function fmtPct(v: number) { return v.toFixed(1) + '%'; }

interface Props { holdings: HoldingMin[]; }

export function ConcentrationRiskCard({ holdings }: Props) {
  const m = computeConcentration(holdings);
  if (m.positionCount === 0) return null;

  // HHI interpretation (standard antitrust scale, adapted for portfolios)
  //   < 1500 = well diversified
  //   1500-2500 = moderate concentration
  //   > 2500 = highly concentrated
  const hhiLabel = m.hhi < 1500 ? 'Well diversified'
                 : m.hhi < 2500 ? 'Moderate concentration'
                 : 'Highly concentrated';
  const hhiTone = m.hhi < 1500 ? 'default'
                : m.hhi < 2500 ? 'secondary'
                : 'destructive';

  const diversificationRatio = m.effectiveN / m.positionCount;
  const diversificationLabel = diversificationRatio >= 0.7 ? 'Even distribution'
                              : diversificationRatio >= 0.4 ? 'Uneven'
                              : 'Top-heavy';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Concentration Risk</CardTitle>
            <CardDescription>How concentrated your portfolio is in a small number of positions</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Top-row stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">HHI</p>
            <p className="text-xl font-bold font-mono mt-0.5">{Math.round(m.hhi).toLocaleString()}</p>
            <Badge variant={hhiTone} className="text-[10px] mt-1">{hhiLabel}</Badge>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Effective holdings</p>
            <p className="text-xl font-bold font-mono mt-0.5">{m.effectiveN.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              of {m.positionCount} actual · <span className="font-medium">{diversificationLabel}</span>
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Largest position</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${m.largestPct > 25 ? 'text-destructive' : m.largestPct > 15 ? 'text-amber-500' : ''}`}>
              {fmtPct(m.largestPct)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">single holding</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top-5 concentration</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${m.top5Pct > 75 ? 'text-destructive' : m.top5Pct > 60 ? 'text-amber-500' : ''}`}>
              {fmtPct(m.top5Pct)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Top-10: {fmtPct(m.top10Pct)}</p>
          </div>
        </div>

        {/* Visualization: top-N stacked bar */}
        <div className="rounded-lg bg-muted/30 p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Distribution
            </span>
            <span className="text-xs text-muted-foreground">
              Top 1 / Top 5 / Top 10 / Rest
            </span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
            <div className="bg-destructive" style={{ width: `${m.largestPct}%` }} title={`Largest: ${fmtPct(m.largestPct)}`} />
            <div className="bg-amber-500" style={{ width: `${Math.max(0, m.top5Pct - m.largestPct)}%` }} title={`Next 4: ${fmtPct(m.top5Pct - m.largestPct)}`} />
            <div className="bg-primary" style={{ width: `${Math.max(0, m.top10Pct - m.top5Pct)}%` }} title={`Next 5: ${fmtPct(m.top10Pct - m.top5Pct)}`} />
            <div className="bg-muted-foreground/40" style={{ width: `${Math.max(0, 100 - m.top10Pct)}%` }} title={`Rest: ${fmtPct(100 - m.top10Pct)}`} />
          </div>
        </div>

        {/* Conditional callouts */}
        {m.largestPct > 25 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p>
              Your largest position is <strong>{fmtPct(m.largestPct)}</strong> of the portfolio — a single-name event
              could materially impact your total wealth.
            </p>
          </div>
        )}
        {m.hhi > 2500 && m.largestPct <= 25 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              HHI above 2,500 indicates concentrated positioning. Effective diversification:
              {' '}<strong>{m.effectiveN.toFixed(1)}</strong> positions vs {m.positionCount} actual.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
