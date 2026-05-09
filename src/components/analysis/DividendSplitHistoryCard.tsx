import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Banknote, GitMerge } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';

/**
 * Dividend & Split History — visualises the dividend stream + key
 * dividend-policy metrics (forward yield, payout ratio, ex-date) and a
 * simple split history. Sourced from `data.SplitsDividends` and
 * `data.Highlights` — 0 extra EODHD credits.
 *
 * Useful at-a-glance reads:
 *   • Steady-and-rising bars = traditional dividend grower
 *   • Drop-to-zero year = dividend cut (recession, distress)
 *   • Payout ratio > 1.0 = paying out more than earnings (dangerous,
 *     unsustainable unless temporary)
 *   • Forward yield much higher than 5y avg = either a dividend trap
 *     (price collapsed) or a value opportunity (sentiment-driven sale)
 */

interface Props { data: EodFundamentals }

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  return `$${v.toFixed(3)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

export function DividendSplitHistoryCard({ data }: Props) {
  const sd = data.SplitsDividends;
  const h  = data.Highlights;

  const yearlyData = useMemo(() => {
    if (!sd?.NumberDividendsByYear) return [];
    return Object.values(sd.NumberDividendsByYear)
      .filter((y) => y && y.Year)
      .sort((a, b) => a.Year - b.Year)
      .slice(-15)
      .map((y) => ({ year: y.Year, count: y.Count }));
  }, [sd]);

  // Render nothing if there's no dividend signal at all
  const hasYield     = (sd?.ForwardAnnualDividendYield ?? h?.DividendYield ?? 0) > 0;
  const hasHistory   = yearlyData.length > 0;
  const hasSplit     = !!sd?.LastSplitFactor;
  if (!hasYield && !hasHistory && !hasSplit) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Banknote className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Dividend & Split History
        </span>
      </div>

      {/* Summary stats */}
      {(hasYield || hasSplit) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Forward Yield"    value={fmtPct(sd?.ForwardAnnualDividendYield)} />
          <Stat label="Forward Rate"     value={fmtUsd(sd?.ForwardAnnualDividendRate)} />
          <Stat
            label="Payout Ratio"
            value={fmtPct(sd?.PayoutRatio)}
            valueClass={
              sd?.PayoutRatio == null ? undefined
              : sd.PayoutRatio > 1   ? 'text-red-400'
              : sd.PayoutRatio > 0.7 ? 'text-amber-400'
              : sd.PayoutRatio > 0   ? 'text-emerald-400'
                                     : undefined
            }
          />
          <Stat label="Ex-Dividend"      value={sd?.ExDividendDate?.slice(0, 10) ?? '—'} />
        </div>
      )}

      {/* Dividend payments per year — last 15 years */}
      {hasHistory && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">
            Dividend payments per year — last {yearlyData.length}y
          </p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 4, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Last split */}
      {hasSplit && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <GitMerge className="w-3.5 h-3.5" />
          Last split: <span className="text-foreground font-medium">{sd!.LastSplitFactor}</span>
          {sd!.LastSplitDate && (
            <span>· {sd!.LastSplitDate}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2">
      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold font-mono tabular-nums leading-tight mt-0.5 ${valueClass ?? ''}`}>
        {value}
      </p>
    </div>
  );
}
