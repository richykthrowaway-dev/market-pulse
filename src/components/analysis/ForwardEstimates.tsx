import { useMemo } from 'react';
import { Telescope } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────
//
// EODHD's Earnings.Trend isn't typed (declared as Record<string, unknown>
// in our service module) but the actual shape is documented and stable.
// Each entry is keyed by a "period code" — "0q" = current quarter,
// "+1q" = next quarter, "0y" = current year, "+1y" = next year — and
// returns analyst-consensus estimates plus the year-ago actual for each.

interface TrendPeriod {
  date?:                                  string;
  period?:                                string;
  growth?:                                string;
  earningsEstimateAvg?:                   string;
  earningsEstimateLow?:                   string;
  earningsEstimateHigh?:                  string;
  earningsEstimateYearAgoEps?:            string;
  earningsEstimateNumberOfAnalysts?:      string;
  earningsEstimateGrowth?:                string;
  revenueEstimateAvg?:                    string;
  revenueEstimateLow?:                    string;
  revenueEstimateHigh?:                   string;
  revenueEstimateYearAgoSales?:           string;
  revenueEstimateNumberOfAnalysts?:       string;
  revenueEstimateGrowth?:                 string;
}

interface PeriodCard {
  key:        string;
  label:      string;
  epsAvg:     number | null;
  epsLow:     number | null;
  epsHigh:    number | null;
  epsGrowth:  number | null;
  revAvg:     number | null;
  revGrowth:  number | null;
  analysts:   number | null;
}

// ── Format helpers ────────────────────────────────────────────────────

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function fmtUsd(v: number | null): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(2)}`;
}

function fmtEps(v: number | null): string {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}

function fmtPct(v: number | null, signed = true): string {
  if (v == null) return '—';
  const pct = v * 100;
  const sign = signed && pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ── Component ─────────────────────────────────────────────────────────

interface ForwardEstimatesProps {
  data: EodFundamentals;
}

/**
 * Forward analyst estimates card — what the consensus expects for the
 * next two quarters and two years.
 *
 * Reads from the Earnings.Trend slot of the existing fundamentals
 * payload, so this section costs zero extra EODHD credits. Renders
 * null automatically if the trend data is missing or empty (common
 * for ETFs and recent IPOs).
 */
export function ForwardEstimates({ data }: ForwardEstimatesProps) {
  const periods = useMemo<PeriodCard[]>(() => {
    const trend = (data.Earnings as any)?.Trend as Record<string, TrendPeriod> | undefined;
    if (!trend) return [];

    const periodOrder: Array<{ key: string; label: string }> = [
      { key: '0q',  label: 'This Quarter' },
      { key: '+1q', label: 'Next Quarter' },
      { key: '0y',  label: 'This Year'    },
      { key: '+1y', label: 'Next Year'    },
    ];

    return periodOrder
      .map(({ key, label }) => {
        const t = trend[key];
        if (!t) return null;
        return {
          key,
          label,
          epsAvg:    num(t.earningsEstimateAvg),
          epsLow:    num(t.earningsEstimateLow),
          epsHigh:   num(t.earningsEstimateHigh),
          epsGrowth: num(t.earningsEstimateGrowth),
          revAvg:    num(t.revenueEstimateAvg),
          revGrowth: num(t.revenueEstimateGrowth),
          analysts:  num(t.earningsEstimateNumberOfAnalysts) ?? num(t.revenueEstimateNumberOfAnalysts),
        };
      })
      .filter((p): p is PeriodCard => p !== null && (p.epsAvg !== null || p.revAvg !== null));
  }, [data]);

  if (periods.length === 0) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Telescope className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Forward Estimates · Analyst Consensus
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {periods.map((p) => (
          <PeriodCardView key={p.key} card={p} />
        ))}
      </div>
    </div>
  );
}

function PeriodCardView({ card }: { card: PeriodCard }) {
  // Color the growth %s green/red. EPS growth color also tints the EPS row
  // so positive expectations read at a glance.
  const epsColor = card.epsGrowth == null
    ? '' : card.epsGrowth >= 0 ? 'text-emerald-500' : 'text-red-500';
  const revColor = card.revGrowth == null
    ? '' : card.revGrowth >= 0 ? 'text-emerald-500' : 'text-red-500';

  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {card.label}
        </span>
        {card.analysts != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {card.analysts} an.
          </span>
        )}
      </div>

      {/* EPS row */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">EPS</span>
          <span className="font-mono font-semibold tabular-nums text-sm">
            {fmtEps(card.epsAvg)}
          </span>
        </div>
        {card.epsGrowth != null && (
          <p className={cn('text-[10px] text-right tabular-nums', epsColor)}>
            {fmtPct(card.epsGrowth)} YoY
          </p>
        )}
        {card.epsLow != null && card.epsHigh != null && card.epsLow !== card.epsHigh && (
          <p className="text-[9px] text-right text-muted-foreground tabular-nums">
            range {fmtEps(card.epsLow)}–{fmtEps(card.epsHigh)}
          </p>
        )}
      </div>

      {/* Revenue row */}
      <div className="pt-1 border-t border-border/50">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">Revenue</span>
          <span className="font-mono font-semibold tabular-nums text-sm">
            {fmtUsd(card.revAvg)}
          </span>
        </div>
        {card.revGrowth != null && (
          <p className={cn('text-[10px] text-right tabular-nums', revColor)}>
            {fmtPct(card.revGrowth)} YoY
          </p>
        )}
      </div>
    </div>
  );
}
