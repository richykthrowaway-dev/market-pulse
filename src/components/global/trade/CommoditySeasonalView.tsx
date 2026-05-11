import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useEodhdBarsForChart } from '@/hooks/useEodhdBarsForChart';
import { getCommodity } from '@/data/tradeInfrastructure/commodities';
import { COMMODITY_ETF_PROXY } from '@/data/tradeInfrastructure/commodityEtfProxies';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface MonthStats {
  month:     number;   // 1-12
  avgReturn: number;   // % (first→last bar of month, averaged over years)
  winRate:   number;   // 0-1 fraction of years with positive return
  count:     number;   // how many years of data
}

function computeSeasonality(bars: { date: string; close: number }[]): MonthStats[] {
  // Group into year-month buckets, sorting each bucket by date.
  const byYearMonth = new Map<string, { date: string; close: number }[]>();
  for (const b of bars) {
    const key = b.date.slice(0, 7); // "YYYY-MM"
    if (!byYearMonth.has(key)) byYearMonth.set(key, []);
    byYearMonth.get(key)!.push(b);
  }
  // Sort every bucket so [0] = first trading day, [last] = last trading day.
  for (const [key, arr] of byYearMonth)
    byYearMonth.set(key, arr.sort((a, b) => a.date.localeCompare(b.date)));

  // Keys in calendar order — needed to look up the prior month's last close.
  const sortedKeys = [...byYearMonth.keys()].sort();

  // Standard calendar-month return: prev month's last close → this month's
  // last close.  This is the correct base for seasonal analysis because it
  // captures the full first-day gap-open move that using first-of-month as
  // the base would drop.  For the first key in the dataset we fall back to
  // the intra-month return (no prior month available).
  const byMonth: Record<number, { ret: number; win: number }[]> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = [];

  for (let i = 0; i < sortedKeys.length; i++) {
    const key      = sortedKeys[i];
    const thisBars = byYearMonth.get(key)!;
    const last     = thisBars[thisBars.length - 1].close;

    let base: number;
    if (i === 0) {
      // No prior-month data — use this month's first bar as fallback.
      base = thisBars[0].close;
    } else {
      const prevBars = byYearMonth.get(sortedKeys[i - 1])!;
      base = prevBars[prevBars.length - 1].close;
    }

    if (base <= 0) continue;
    const ret   = (last / base - 1) * 100;
    const month = parseInt(key.slice(5, 7), 10); // "YYYY-MM"[5..6] = month
    byMonth[month].push({ ret, win: ret > 0 ? 1 : 0 });
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m    = i + 1;
    const data = byMonth[m];
    const avg  = data.length > 0 ? data.reduce((s, d) => s + d.ret, 0) / data.length : 0;
    const win  = data.length > 0 ? data.reduce((s, d) => s + d.win, 0) / data.length : 0;
    return { month: m, avgReturn: avg, winRate: win, count: data.length };
  });
}

// ── Month cell ────────────────────────────────────────────────────────────────
function MonthCell({ s, maxAbs }: { s: MonthStats; maxAbs: number }) {
  const up        = s.avgReturn > 0;
  const intensity = Math.min(Math.abs(s.avgReturn) / Math.max(maxAbs, 0.01), 1);
  return (
    <div
      className={cn(
        'rounded p-1.5 text-center cursor-default select-none transition-colors',
        up ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'bg-red-500/10 hover:bg-red-500/20',
      )}
      style={{ opacity: 0.35 + intensity * 0.65 }}
      title={`${MONTH_LABELS[s.month - 1]}: avg ${s.avgReturn > 0 ? '+' : ''}${s.avgReturn.toFixed(2)}%  ·  ${(s.winRate * 100).toFixed(0)}% of years positive`}
    >
      <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wide leading-none">
        {MONTH_LABELS[s.month - 1]}
      </p>
      <p className={cn(
        'text-[11px] font-bold tabular-nums mt-1 leading-none',
        up ? 'text-emerald-400' : 'text-red-400',
      )}>
        {s.avgReturn > 0 ? '+' : ''}{s.avgReturn.toFixed(1)}%
      </p>
      <p className="text-[8px] text-muted-foreground/50 mt-0.5 leading-none">
        {(s.winRate * 100).toFixed(0)}%↑
      </p>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function CommoditySeasonalView({ selectedId }: { selectedId: string }) {
  const etf       = COMMODITY_ETF_PROXY[selectedId];
  const commodity = getCommodity(selectedId);

  const { data: bars = [], isLoading } = useEodhdBarsForChart(
    etf?.symbol  ?? null,
    etf?.exchange ?? 'US',
  );

  const seasonality = useMemo(() => computeSeasonality(bars), [bars]);

  const maxAbs = useMemo(
    () => Math.max(...seasonality.map(s => Math.abs(s.avgReturn)), 0.1),
    [seasonality],
  );

  const best  = useMemo(() => seasonality.reduce((a, b) => a.avgReturn > b.avgReturn ? a : b), [seasonality]);
  const worst = useMemo(() => seasonality.reduce((a, b) => a.avgReturn < b.avgReturn ? a : b), [seasonality]);

  if (!etf) {
    return (
      <p className="px-4 py-4 text-center text-xs text-muted-foreground/60 italic">
        No exchange-traded proxy for {commodity?.label ?? selectedId} — seasonal data unavailable.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading 5Y bars for seasonality…
      </div>
    );
  }

  const yearsOfData = seasonality[0]?.count ?? 0;

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Average whole-month return for <span className="font-medium text-foreground/80">{etf.symbol}</span>{' '}
        over {yearsOfData} years.{' '}
        Best: <span className="text-emerald-400 font-medium">{MONTH_LABELS[best.month - 1]} ({best.avgReturn > 0 ? '+' : ''}{best.avgReturn.toFixed(1)}%)</span>
        {' '}· Worst: <span className="text-red-400 font-medium">{MONTH_LABELS[worst.month - 1]} ({worst.avgReturn.toFixed(1)}%)</span>
      </p>

      {/* 12 month cells in two rows of 6 */}
      <div className="px-4 pb-3 space-y-1">
        <div className="grid grid-cols-6 gap-1">
          {seasonality.slice(0, 6).map(s => <MonthCell key={s.month} s={s} maxAbs={maxAbs} />)}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {seasonality.slice(6, 12).map(s => <MonthCell key={s.month} s={s} maxAbs={maxAbs} />)}
        </div>
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        EODHD · {etf.symbol} EOD · {yearsOfData}Y monthly returns · hover for win-rate
      </p>
    </>
  );
}
