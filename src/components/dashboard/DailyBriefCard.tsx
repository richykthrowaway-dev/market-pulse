import { useState } from 'react';
import { format, isToday, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDailyBrief, type MarketRegime } from '@/hooks/useDailyBrief';

// ── Helpers ───────────────────────────────────────────────────────────────────

function regimeLabel(r: MarketRegime): string {
  const MAP: Record<MarketRegime, string> = {
    trending_up: 'Trending Up',
    range_bound: 'Range-Bound',
    volatile:    'Volatile',
    risk_off:    'Risk-Off',
  };
  return MAP[r] ?? r;
}

function regimeCls(r: MarketRegime): string {
  const MAP: Record<MarketRegime, string> = {
    trending_up: 'bg-success/15 text-success border border-success/30',
    range_bound: 'bg-primary/15 text-primary border border-primary/30',
    volatile:    'bg-warning/15 text-warning border border-warning/30',
    risk_off:    'bg-danger/15 text-danger border border-danger/30',
  };
  return MAP[r] ?? 'bg-muted text-muted-foreground border border-border';
}

function sentimentCls(score: number): string {
  if (score > 60) return 'bg-success/15 text-success border border-success/30';
  if (score >= 40) return 'bg-warning/15 text-warning border border-warning/30';
  return 'bg-danger/15 text-danger border border-danger/30';
}

const LS_KEY = 'brief-expanded-v1';
function getInitialExpanded(): boolean {
  try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
}
function saveExpanded(v: boolean) {
  try { localStorage.setItem(LS_KEY, String(v)); } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyBriefCard() {
  const { data: brief, isLoading, isError } = useDailyBrief();
  const [expanded, setExpanded] = useState<boolean>(getInitialExpanded);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    saveExpanded(next);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-4" />
        </div>
        <Skeleton className="h-3 w-3/4 mt-2" />
      </div>
    );
  }

  if (isError || !brief) return null;

  const briefDate = parseISO(brief.date);
  const isPreviousSession = !isToday(briefDate);
  const formattedDate = format(briefDate, 'EEE d MMM yyyy');

  return (
    <div className="rounded-xl border border-border bg-card shadow-card mb-4 overflow-hidden">

      {/* ── Collapsed header ── */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        aria-expanded={expanded}
        aria-label="Toggle daily market brief"
      >
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Daily Brief</span>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {isPreviousSession && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                Previous session
              </span>
            )}
            <span className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
              regimeCls(brief.market_regime),
            )}>
              {regimeLabel(brief.market_regime)}
            </span>
            <span className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 font-mono tabular-nums',
              sentimentCls(brief.sentiment_score),
            )}>
              {brief.fear_greed.label || 'Neutral'} · {brief.sentiment_score}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {brief.headline}
            </p>
          )}
        </div>

        {expanded
          ? <ChevronUp  className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        }
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 text-sm border-t border-border pt-4">

          {brief.summary && (
            <p className="text-foreground leading-relaxed">{brief.summary}</p>
          )}

          {/* Fear & Greed + VIX */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Market Sentiment
                </p>
                <p className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  brief.sentiment_score > 60 ? 'text-success' :
                  brief.sentiment_score >= 40 ? 'text-warning' : 'text-danger',
                )}>
                  {brief.fear_greed.label || 'Neutral'} · {brief.sentiment_score}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
                </p>
              </div>
              {brief.vix != null && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    VIX
                  </p>
                  <p className={cn(
                    'text-lg font-bold font-mono tabular-nums',
                    brief.vix > 25 ? 'text-danger' : brief.vix > 18 ? 'text-warning' : 'text-success',
                  )}>
                    {brief.vix.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
            {brief.fear_greed.interpretation && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {brief.fear_greed.interpretation}
              </p>
            )}
          </div>

          {/* All 11 Sectors */}
          {brief.sectors.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Sector Performance
              </h4>
              <div className="space-y-1.5">
                {brief.sectors.map((sector) => {
                  const pct = sector.pct_change;
                  const isUp = pct != null && pct >= 0;
                  const barWidth = pct != null ? Math.min(Math.abs(pct) / 3 * 100, 100) : 0;

                  return (
                    <div key={sector.symbol} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">
                        {sector.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', isUp ? 'bg-success' : 'bg-danger')}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-mono tabular-nums w-14 text-right shrink-0',
                        pct == null ? 'text-muted-foreground' : isUp ? 'text-success' : 'text-danger',
                      )}>
                        {pct != null ? `${isUp ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Events */}
          {brief.current_events && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Current Events
              </h4>
              <p className="text-xs text-foreground leading-relaxed">{brief.current_events}</p>
            </div>
          )}

          {/* Economic Calendar */}
          {brief.calendar.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                On the Calendar Today
              </h4>
              <div className="space-y-1">
                {brief.calendar.map((item, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-xs">
                    <span className="text-muted-foreground font-mono tabular-nums w-20 shrink-0">
                      {item.time}
                    </span>
                    <span className="text-foreground font-medium">{item.name}</span>
                    {item.estimate && (
                      <span className="text-muted-foreground">Est. {item.estimate}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watch Today */}
          {brief.watch_today && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                Watch Today
              </h4>
              <p className="text-xs text-foreground leading-relaxed">{brief.watch_today}</p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/60 text-right">
            Generated {format(parseISO(brief.generated_at), 'h:mm a')} ET
          </p>
        </div>
      )}
    </div>
  );
}
