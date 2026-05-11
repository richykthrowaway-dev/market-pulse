import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Loader2 } from 'lucide-react';
import { useEodhdBarsForChart } from '@/hooks/useEodhdBarsForChart';
import type { CommodityPrice } from '@/hooks/useCommodityPrices';
import { logReturns, rollingCorrelation } from '@/lib/correlation';
import { cn } from '@/lib/utils';

/**
 * CommodityDriverBlock — answers "why is this moving right now?".
 *
 * Shows the 30-day rolling Pearson correlation between the selected
 * commodity and three universal macro drivers:
 *
 *   1. Dollar Index proxy (UUP)   — commodities are USD-priced, so they
 *      almost always inverse-correlate to the dollar.
 *   2. TIPS bond ETF (TIP), sign-inverted to read as "Real Yield" —
 *      gold's strongest fundamental driver.  TIP rises when real yields
 *      fall, so the correlation against TIP is the OPPOSITE sign of
 *      what trader intuition expects.  We invert the displayed number
 *      so a positive number means "moves WITH real yields".
 *   3. Broad equities (SPY)       — risk-on/off proxy.  Crucial for
 *      industrial metals (copper) and oil; less so for gold.
 *
 * All bars come from the existing useEodhdBarsForChart hook (5Y daily,
 * cached 30 min), so the block costs zero additional network requests
 * once the chart above has rendered.
 */

const DRIVERS = [
  {
    symbol: 'UUP',
    label:  'Dollar Index (UUP)',
    note:   'commodity vs USD strength',
    /** When true, flip the displayed sign so it reads in trader-intuitive direction. */
    invert: false,
  },
  {
    symbol: 'TIP',
    label:  'Real Yields',
    note:   'TIP bond ETF, inverted — gold\'s key driver',
    // TIP rises as real yields fall.  If commodity rises when TIP rises
    // (positive r vs TIP), that's actually inverse to real yields.  We
    // invert here so a "positive correlation" in the UI means the
    // commodity moves WITH real yields (rare and notable for gold).
    invert: true,
  },
  {
    symbol: 'SPY',
    label:  'Risk-on (SPY)',
    note:   'broad equities, risk appetite',
    invert: false,
  },
] as const;

export function CommodityDriverBlock({ price }: { price: CommodityPrice }) {
  // The selected commodity's bars — already cached by the chart above.
  const [commoditySym, commodityEx] = useMemo(() => {
    const parts = price.ticker.split('.');
    return [parts[0] ?? price.ticker, parts[1] ?? 'US'];
  }, [price.ticker]);
  const { data: commodityBars = [], isLoading: commodityLoading } =
    useEodhdBarsForChart(commoditySym, commodityEx);

  // Driver bars — fire in parallel.  Each hook is independently cached.
  // (Hooks must be called unconditionally and in the same order on every
  //  render — that's why we don't use a map over DRIVERS for these.)
  const dxy   = useEodhdBarsForChart('UUP', 'US');
  const tip   = useEodhdBarsForChart('TIP', 'US');
  const spy   = useEodhdBarsForChart('SPY', 'US');
  const driverQueries = [dxy, tip, spy];

  // Pre-compute the commodity's log return series once — reused for
  // each driver correlation below.
  const commodityReturns = useMemo(
    () => logReturns(commodityBars),
    [commodityBars],
  );

  const correlations = useMemo(() => {
    return DRIVERS.map((driver, i) => {
      const bars = driverQueries[i].data ?? [];
      const driverReturns = logReturns(bars);
      const r = rollingCorrelation(commodityReturns, driverReturns, 30);
      // Invert when the driver's "natural" direction is opposite to what
      // we want to display (TIP → real yields).
      const displayed = r != null && driver.invert ? -r : r;
      return {
        ...driver,
        r:        displayed,
        rawCount: Math.min(commodityReturns.length, driverReturns.length),
      };
    });
  }, [commodityReturns, dxy.data, tip.data, spy.data]);

  const anyLoading = commodityLoading || driverQueries.some((q) => q.isLoading);

  return (
    <div className="px-4 pt-3 pb-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Activity className="w-3 h-3" />
        Drivers
        <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
          30-day rolling correlation · what's moving this right now
        </span>
      </h3>

      {anyLoading ? (
        <div className="flex items-center justify-center gap-1.5 py-3 text-[10px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Computing correlations…
        </div>
      ) : (
        <ul className="space-y-1.5">
          {correlations.map((c) => (
            <DriverRow key={c.symbol} {...c} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Subcomponent: one driver row ─────────────────────────────────────────────

function DriverRow({
  label, note, r,
}: {
  label: string;
  note:  string;
  r:     number | null;
}) {
  // Strength buckets give the trader a quick visual read.  |r| >= 0.6 is
  // strong; 0.3-0.6 is moderate; below 0.3 is noise-level.
  const strength: 'strong' | 'moderate' | 'weak' = r == null
    ? 'weak'
    : Math.abs(r) >= 0.6 ? 'strong'
    : Math.abs(r) >= 0.3 ? 'moderate'
    : 'weak';

  const direction: 'pos' | 'neg' | 'flat' = r == null ? 'flat'
    : r > 0.05  ? 'pos'
    : r < -0.05 ? 'neg'
    : 'flat';

  const color =
    strength === 'weak' ? 'text-muted-foreground' :
    direction === 'pos' ? 'text-emerald-400' :
    direction === 'neg' ? 'text-red-400'     :
                          'text-muted-foreground';

  // Bar fills from center to indicate direction + magnitude.  Width is
  // |r| * 50% so a full-strength positive correlation reaches the right
  // edge and a full-strength negative reaches the left.
  const barWidth = r == null ? 0 : Math.min(Math.abs(r), 1) * 50;
  const barOffset = direction === 'neg' ? 50 - barWidth : 50;

  return (
    <li className="flex items-center gap-2 text-[11px]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/90 truncate">{label}</span>
        </div>
        <p className="text-[9px] text-muted-foreground/60 truncate" title={note}>
          {note}
        </p>
      </div>

      {/* Center-pivot bar */}
      <div className="relative w-20 h-1.5 bg-muted/30 rounded-full overflow-hidden shrink-0">
        {/* Center pivot tick */}
        <span className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {r != null && (
          <span
            className={cn(
              'absolute top-0 bottom-0 rounded-full opacity-80',
              direction === 'pos' ? 'bg-emerald-500' :
              direction === 'neg' ? 'bg-red-500'     :
                                    'bg-muted-foreground/50',
            )}
            style={{ left: `${barOffset}%`, width: `${barWidth}%` }}
          />
        )}
      </div>

      {/* r value with direction glyph */}
      <span className={cn('w-14 text-right tabular-nums font-mono shrink-0', color)}>
        {r == null
          ? '—'
          : (
            <>
              {direction === 'pos' && <TrendingUp   className="inline w-2.5 h-2.5 mr-0.5" />}
              {direction === 'neg' && <TrendingDown className="inline w-2.5 h-2.5 mr-0.5" />}
              {r > 0 ? '+' : ''}{r.toFixed(2)}
            </>
          )}
      </span>
    </li>
  );
}
