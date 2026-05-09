import { TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────

function fmtCompactShares(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtPctRaw(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return '—';
  return `${v.toFixed(decimals)}%`;
}

function fmtRatio(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(decimals);
}

// ── Component ─────────────────────────────────────────────────────────

interface ShortInterestCardProps {
  data: EodFundamentals;
}

/**
 * Short Interest Tracker — current short position size and how it's
 * trending month-over-month.
 *
 * Sources from Technicals.SharesShort, SharesShortPriorMonth,
 * ShortRatio, ShortPercent in the existing fundamentals payload —
 * zero extra EODHD credits.
 *
 * Why this matters at a glance:
 *   • Short percent of float >5% is "elevated", >15% is "heavily shorted"
 *   • Days-to-cover (ShortRatio) >5 is meaningful; >10 is risky for shorts
 *     because a price spike forces them to buy back into a thin ask
 *   • Month-over-month rising short interest = bears actively building
 *     a position; falling short = capitulation / cover. The DIRECTION
 *     of the change is the actionable signal.
 *
 * Renders null if no short data is reported (international stocks,
 * private companies recently public, etc.).
 */
export function ShortInterestCard({ data }: ShortInterestCardProps) {
  const t = data.Technicals;
  if (!t) return null;

  const current   = t.SharesShort;
  const prior     = t.SharesShortPriorMonth;
  const ratio     = t.ShortRatio;       // days to cover
  const pctFloat  = t.ShortPercent;     // % of float (already in % units)

  // Skip rendering if we have no usable data at all
  if (
    (current == null || !isFinite(current) || current === 0) &&
    (pctFloat == null || !isFinite(pctFloat) || pctFloat === 0)
  ) {
    return null;
  }

  // Month-over-month change in shares short (absolute and %).
  const momChange = current != null && prior != null && prior !== 0
    ? current - prior
    : null;
  const momChangePct = momChange != null && prior != null && prior !== 0
    ? (momChange / prior) * 100
    : null;

  // Severity tier for the short-percent badge.
  const severity = pctFloat == null
    ? 'unknown'
    : pctFloat >= 15 ? 'heavy'
    : pctFloat >=  5 ? 'elevated'
    : 'normal';

  const severityLabel = {
    unknown:  '—',
    normal:   'Normal',
    elevated: 'Elevated',
    heavy:    'Heavily Shorted',
  }[severity];

  const severityClass = {
    unknown:  'text-muted-foreground bg-muted/30 border-border',
    normal:   'text-muted-foreground bg-muted/30 border-border',
    elevated: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    heavy:    'text-red-300 bg-red-500/10 border-red-500/30',
  }[severity];

  // MoM change icon + color. Note: rising short interest is BEARISH for
  // bulls, so we color rising = red, falling = green (from the perspective
  // of the long shareholder reading this card).
  const momIcon = momChangePct == null ? Minus
    : momChangePct >  0.5 ? TrendingUp
    : momChangePct < -0.5 ? TrendingDown
    : Minus;
  const momColor = momChangePct == null ? 'text-muted-foreground'
    : momChangePct >  0.5 ? 'text-red-400'    // rising short = bearish
    : momChangePct < -0.5 ? 'text-emerald-400' // falling short = bullish
    : 'text-muted-foreground';

  const MomIcon = momIcon;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Short Interest
          </span>
        </div>
        {severity !== 'unknown' && severity !== 'normal' && (
          <span className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded border tabular-nums',
            severityClass,
          )}>
            {severityLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat
          label="% of Float"
          value={fmtPctRaw(pctFloat)}
          subText="shorted"
        />
        <Stat
          label="Days to Cover"
          value={fmtRatio(ratio)}
          subText="short ratio"
        />
        <Stat
          label="Shares Short"
          value={fmtCompactShares(current)}
          subText="this month"
        />
        <Stat
          label="MoM Change"
          value={momChangePct != null
            ? `${momChangePct >= 0 ? '+' : ''}${momChangePct.toFixed(1)}%`
            : '—'}
          valueClass={momColor}
          subText={momChange != null
            ? `${momChange >= 0 ? '+' : ''}${fmtCompactShares(Math.abs(momChange))} ${momChange >= 0 ? 'more' : 'fewer'}`
            : 'vs prior month'}
          icon={<MomIcon className="w-3 h-3" />}
        />
      </div>
    </div>
  );
}

interface StatProps {
  label:      string;
  value:      string;
  valueClass?: string;
  subText?:   string;
  icon?:      React.ReactNode;
}

function Stat({ label, value, valueClass, subText, icon }: StatProps) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={cn('text-base font-semibold font-mono tabular-nums leading-tight mt-1 flex items-center gap-1', valueClass)}>
        {icon}
        {value}
      </p>
      {subText && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{subText}</p>
      )}
    </div>
  );
}
