import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Technical Signals Card — derives 5 actionable signals from the
 * `Technicals` block already in the cached fundamentals payload.
 * 0 extra EODHD credits (the signals are computed client-side from
 * fields like 52WeekHigh, 50DayMA, 200DayMA, Beta).
 *
 * Why these 5 signals:
 *   1. **Position in 52w range** — pure mean-reversion / breakout cue.
 *      Near-high (>90%) means traders are paying up; near-low (<20%)
 *      either capitulation or value depending on fundamentals.
 *   2. **Price vs 50DMA** — short-term trend (1-quarter momentum).
 *   3. **Price vs 200DMA** — long-term trend (institutional bias).
 *   4. **Golden cross / Death cross** — 50DMA above 200DMA = "golden",
 *      below = "death". Famous trend-confirmation signal.
 *   5. **Beta band** — interprets the raw beta as low / market /
 *      high / inverse so the user doesn't have to know "1.0 = market".
 *
 * NOTE: We use 50DMA as a stand-in for "current price" because EODHD's
 * fundamentals payload doesn't include the most-recent close. This is
 * close enough for trend interpretation but the % distances are an
 * approximation, not realtime.
 */

interface Props { data: EodFundamentals }

interface Signal {
  label:   string;
  value:   string;
  detail:  string;
  tone:    'bull' | 'bear' | 'neutral';
}

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function classifyBeta(beta: number | null | undefined): { value: string; detail: string; tone: Signal['tone'] } {
  if (beta == null || !isFinite(beta)) return { value: '—', detail: 'Beta unavailable', tone: 'neutral' };
  if (beta < 0)        return { value: beta.toFixed(2), detail: 'Inverse — moves against market', tone: 'neutral' };
  if (beta < 0.5)      return { value: beta.toFixed(2), detail: 'Low — defensive vs market',       tone: 'bull' };
  if (beta < 0.85)     return { value: beta.toFixed(2), detail: 'Below market sensitivity',         tone: 'neutral' };
  if (beta <= 1.15)    return { value: beta.toFixed(2), detail: 'Tracks market closely',            tone: 'neutral' };
  if (beta <= 1.5)     return { value: beta.toFixed(2), detail: 'Amplifies market moves',           tone: 'neutral' };
  return                      { value: beta.toFixed(2), detail: 'High beta — very volatile',       tone: 'bear' };
}

export function TechnicalSignalsCard({ data }: Props) {
  const t = data.Technicals;
  if (!t) return null;

  const high   = t['52WeekHigh'];
  const low    = t['52WeekLow'];
  const ma50   = t['50DayMA'];
  const ma200  = t['200DayMA'];
  const beta   = t.Beta;

  // No useful data at all → render nothing
  if (!ma50 && !ma200 && !beta && !high && !low) return null;

  const signals: Signal[] = [];

  // 1. Position in 52w range (using 50DMA as price proxy)
  if (high && low && high > low && ma50) {
    const range = high - low;
    const pos = ((ma50 - low) / range) * 100;
    const tone: Signal['tone'] =
      pos > 80 ? 'bull' :
      pos < 20 ? 'bear' : 'neutral';
    signals.push({
      label: '52w Position',
      value: `${pos.toFixed(0)}%`,
      detail:
        pos > 90 ? 'Near 52w high — strength' :
        pos > 70 ? 'Upper third of range' :
        pos > 30 ? 'Mid-range' :
        pos > 10 ? 'Lower third of range' :
                   'Near 52w low — weakness',
      tone,
    });
  }

  // 2. Price vs 50DMA — we substitute 50DMA for price, so this is implicit
  //    Instead show 50DMA vs 52w midpoint (a proxy for short-term bias)
  if (ma50 && high && low) {
    const mid = (high + low) / 2;
    const distMid = ((ma50 - mid) / mid) * 100;
    signals.push({
      label: '50DMA vs Midpoint',
      value: pct(distMid),
      detail:
        distMid > 5  ? 'Trading above range midpoint' :
        distMid < -5 ? 'Trading below range midpoint' :
                       'Hovering around midpoint',
      tone: distMid > 5 ? 'bull' : distMid < -5 ? 'bear' : 'neutral',
    });
  }

  // 3. 50DMA vs 200DMA — golden / death cross
  if (ma50 && ma200) {
    const diff = ((ma50 - ma200) / ma200) * 100;
    const isGolden = diff > 0;
    signals.push({
      label: '50/200 DMA',
      value: isGolden ? 'Golden Cross' : 'Death Cross',
      detail: `50DMA ${pct(diff)} ${isGolden ? 'above' : 'below'} 200DMA`,
      tone: isGolden ? 'bull' : 'bear',
    });
  }

  // 4. 200DMA momentum proxy: price (50DMA) vs 200DMA
  if (ma50 && ma200) {
    const diff = ((ma50 - ma200) / ma200) * 100;
    signals.push({
      label: 'Long-term Trend',
      value: diff > 1 ? 'Uptrend' : diff < -1 ? 'Downtrend' : 'Sideways',
      detail: `Price proxy ${pct(diff)} vs 200DMA`,
      tone: diff > 1 ? 'bull' : diff < -1 ? 'bear' : 'neutral',
    });
  }

  // 5. Beta interpretation
  const b = classifyBeta(beta);
  signals.push({
    label:  'Beta',
    value:  b.value,
    detail: b.detail,
    tone:   b.tone,
  });

  if (signals.length === 0) return null;

  // Aggregate verdict
  const bullCount = signals.filter((s) => s.tone === 'bull').length;
  const bearCount = signals.filter((s) => s.tone === 'bear').length;
  const verdict =
    bullCount > bearCount + 1 ? { text: 'Bullish bias',  cls: 'text-emerald-400', icon: TrendingUp }   :
    bearCount > bullCount + 1 ? { text: 'Bearish bias',  cls: 'text-red-400',     icon: TrendingDown } :
                                 { text: 'Mixed signals', cls: 'text-muted-foreground', icon: Minus };

  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Technical Signals
          </span>
        </div>
        <span className={cn('text-[11px] font-medium inline-flex items-center gap-1', verdict.cls)}>
          <VerdictIcon className="w-3 h-3" />
          {verdict.text}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {signals.map((s) => {
          const toneClass = s.tone === 'bull' ? 'text-emerald-400'
                           : s.tone === 'bear' ? 'text-red-400'
                           : 'text-muted-foreground';
          const bgClass = s.tone === 'bull' ? 'bg-emerald-500/10 border-emerald-500/20'
                         : s.tone === 'bear' ? 'bg-red-500/10 border-red-500/20'
                         : 'bg-muted/40 border-border';
          return (
            <div key={s.label} className={cn('rounded-lg p-2 border', bgClass)}>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-tight">
                {s.label}
              </p>
              <p className={cn('text-sm font-semibold font-mono tabular-nums leading-tight mt-0.5', toneClass)}>
                {s.value}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight" title={s.detail}>
                {s.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
