import { Landmark, Loader2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { useWorldBankFiscal, type FiscalDataPoint } from '@/hooks/useWorldBankFiscal';
import { cn } from '@/lib/utils';

/**
 * FiscalHealthCard — two stacked rows showing:
 *   1. Government debt / GDP — current value + a 0–200% color-coded gauge
 *      with risk-threshold markers (60 / 100 / 150) and a trend sparkline.
 *   2. Fiscal balance / GDP — current value (signed) + trend sparkline.
 *
 * Data source: useWorldBankFiscal (direct World Bank API, free + CORS).
 */

interface Props {
  iso2: string;
}

// ── Color logic ─────────────────────────────────────────────────────────────
// IMF / EU risk bands for general-government debt-to-GDP:
//   <60%   compliant with EU Maastricht criterion (green)
//   60–100 elevated (amber)
//   100–150 high concern (orange)
//   >150   crisis territory (red)
function debtColor(value: number): string {
  if (value < 60)  return 'text-emerald-400';
  if (value < 100) return 'text-amber-400';
  if (value < 150) return 'text-orange-400';
  return 'text-red-400';
}

function debtBarBgGradient(): string {
  // 0%   = full green
  // 60%  = green→amber
  // 100% = amber→orange
  // 150% = orange→red
  // 200% = full red
  return 'bg-gradient-to-r from-emerald-500/40 via-amber-500/40 via-50% to-red-500/40';
}

function balanceColor(value: number): string {
  if (value >= 0)   return 'text-emerald-400';
  if (value > -3)   return 'text-amber-400';
  if (value > -6)   return 'text-orange-400';
  return 'text-red-400';
}

// ── Sparkline ──────────────────────────────────────────────────────────────
function MiniSpark({ series, color, height = 28 }: {
  series: FiscalDataPoint[];
  color:  string;
  height?: number;
}) {
  if (series.length < 2) return <div className="h-7" />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          {/* Invisible YAxis just so Recharts auto-scales properly */}
          <YAxis hide domain={['auto', 'auto']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FiscalHealthCard({ iso2 }: Props) {
  const { data, isLoading } = useWorldBankFiscal(iso2);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground h-28">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading fiscal data…
      </div>
    );
  }

  const debt    = data?.latestDebt;
  const balance = data?.latestBalance;
  const debtSeries    = data?.debtGdp       ?? [];
  const balanceSeries = data?.fiscalBalance ?? [];

  const debtValue    = debt?.value;
  const balanceValue = balance?.value;

  // Gauge: clamp debt to 0–200% range for the indicator dot position.
  const gaugeMax = 200;
  const gaugePct = debtValue != null
    ? Math.max(0, Math.min(100, (debtValue / gaugeMax) * 100))
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
        <Landmark className="w-3.5 h-3.5 text-primary" />
        Fiscal Health
      </h3>

      {/* ── Government Debt / GDP ─────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Govt Debt / GDP</span>
          {debtValue != null ? (
            <span className={cn('text-lg font-bold tabular-nums', debtColor(debtValue))}>
              {debtValue.toFixed(0)}<span className="text-xs opacity-60">%</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>

        {debtValue != null && (
          <>
            {/* Gauge bar with risk-threshold markers */}
            <div className="relative h-2 rounded-full overflow-hidden bg-muted/30">
              <div className={cn('absolute inset-0 opacity-50', debtBarBgGradient())} />
              {/* Marker for current value */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                style={{ left: `${gaugePct}%` }}
              />
              {/* Reference markers at 60 / 100 / 150 */}
              {[60, 100, 150].map(t => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 w-px bg-foreground/30"
                  style={{ left: `${(t / gaugeMax) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-0.5 text-[8px] text-muted-foreground/50 tabular-nums">
              <span>0%</span>
              <span title="EU Maastricht criterion">60%</span>
              <span title="IMF concern">100%</span>
              <span title="Crisis territory">150%</span>
              <span>200%</span>
            </div>
          </>
        )}

        {debtSeries.length > 1 && (
          <div className="mt-1.5">
            <MiniSpark series={debtSeries} color="#f59e0b" />
            <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
              <span>{debtSeries[0].date}</span>
              <span>{debt?.date ?? ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Fiscal Balance / GDP ──────────────────────────────────────── */}
      <div className="border-t border-border/40 pt-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Fiscal Balance / GDP</span>
          {balanceValue != null ? (
            <span className={cn('text-lg font-bold tabular-nums', balanceColor(balanceValue))}>
              {balanceValue > 0 ? '+' : ''}{balanceValue.toFixed(1)}<span className="text-xs opacity-60">%</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>

        {balanceSeries.length > 1 && (
          <div className="mt-1">
            <MiniSpark series={balanceSeries} color="#60a5fa" />
            <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
              <span>{balanceSeries[0].date}</span>
              <span>{balance?.date ?? ''}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/50 leading-snug">
        World Bank WDI · debt figures may lag 1–2 years.
      </p>
    </div>
  );
}
