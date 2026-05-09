import { Leaf, AlertOctagon } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * ESG Scores Card — Sustainalytics-style risk scores from EODHD's
 * fundamentals payload. Lower is BETTER (lower risk). 0–10 negligible,
 * 10–20 low, 20–30 medium, 30–40 high, 40+ severe.
 *
 * Sourced from `data.ESGScores` — 0 extra EODHD credits.
 *
 * Caveats:
 *   • Only ~1500 large/mid-cap stocks have ESG coverage from EODHD's
 *     vendor. Renders null cleanly if missing.
 *   • Percentile is "rank within industry" — 1st percentile = best
 *     risk-managed in industry.
 *   • ControversyLevel: 0 (none) → 5 (severe). 4–5 reflects ongoing
 *     legal / environmental / governance scandals.
 */

interface Props { data: EodFundamentals }

function riskBand(score: number | undefined): { label: string; cls: string } {
  if (score == null || !isFinite(score)) return { label: '—', cls: 'text-muted-foreground' };
  if (score < 10) return { label: 'Negligible', cls: 'text-emerald-400' };
  if (score < 20) return { label: 'Low',         cls: 'text-emerald-300' };
  if (score < 30) return { label: 'Medium',      cls: 'text-amber-400' };
  if (score < 40) return { label: 'High',        cls: 'text-red-400' };
  return { label: 'Severe', cls: 'text-red-500' };
}

function controversyLabel(level: number | undefined): { label: string; cls: string } {
  if (level == null) return { label: '—',         cls: 'text-muted-foreground' };
  if (level === 0)   return { label: 'None',      cls: 'text-emerald-400' };
  if (level === 1)   return { label: 'Low',       cls: 'text-emerald-300' };
  if (level === 2)   return { label: 'Moderate',  cls: 'text-amber-400' };
  if (level === 3)   return { label: 'Significant', cls: 'text-amber-300' };
  if (level === 4)   return { label: 'High',      cls: 'text-red-400' };
  return { label: 'Severe', cls: 'text-red-500' };
}

function PillarBar({ label, score, percentile }: {
  label:      string;
  score:      number | undefined;
  percentile: number | undefined;
}) {
  const band = riskBand(score);
  const pct  = score != null ? Math.min(100, (score / 50) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium tabular-nums', band.cls)}>
          {score != null ? score.toFixed(1) : '—'}
          {percentile != null && (
            <span className="text-muted-foreground ml-1">· {percentile.toFixed(0)}%ile</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            score == null ? 'bg-muted'
            : score < 10 ? 'bg-emerald-500'
            : score < 20 ? 'bg-emerald-400'
            : score < 30 ? 'bg-amber-400'
            : score < 40 ? 'bg-red-400'
                         : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ESGScoresCard({ data }: Props) {
  const e = data.ESGScores;
  if (!e || e.TotalEsg == null) return null;

  const total = riskBand(e.TotalEsg);
  const ctrl  = controversyLabel(e.ControversyLevel);

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Leaf className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            ESG Risk · {e.RatingDate?.slice(0, 7) ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span>
            Total: <span className={cn('font-semibold tabular-nums', total.cls)}>
              {e.TotalEsg.toFixed(1)} · {total.label}
            </span>
          </span>
          {e.ControversyLevel != null && e.ControversyLevel > 0 && (
            <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-current/30', ctrl.cls)}>
              <AlertOctagon className="w-2.5 h-2.5" />
              Controversy: {ctrl.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PillarBar label="Environmental" score={e.EnvironmentScore} percentile={e.EnvironmentScorePercentile} />
        <PillarBar label="Social"        score={e.SocialScore}      percentile={e.SocialScorePercentile} />
        <PillarBar label="Governance"    score={e.GovernanceScore}  percentile={e.GovernanceScorePercentile} />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Lower scores = lower ESG risk. Percentile is rank within industry (1 = best). Source: Sustainalytics via EODHD.
      </p>
    </div>
  );
}
