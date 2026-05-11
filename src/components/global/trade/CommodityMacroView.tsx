import { useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEodhdBarsForChart } from '@/hooks/useEodhdBarsForChart';
import { logReturns, rollingCorrelation } from '@/lib/correlation';
import { getCommodity } from '@/data/tradeInfrastructure/commodities';
import { COMMODITY_ETF_PROXY } from '@/data/tradeInfrastructure/commodityEtfProxies';
import { cn } from '@/lib/utils';

/**
 * CommodityMacroView — sensitivity scorecard for the selected commodity.
 *
 * Shows rolling Pearson correlation vs three universal macro drivers at
 * two time horizons (30-day = current regime, 90-day = medium-term):
 *
 *   UUP  → Dollar strength  (commodities are USD-priced → usually inverse)
 *   TIP⁻¹ → Real yields     (sign-inverted TIP — gold's key driver)
 *   SPY  → Risk appetite    (equities proxy — matters most for copper/oil)
 *
 * UUP/TIP/SPY bars are already cached by CommodityDriverBlock for any
 * commodity the user has clicked above — zero extra network requests in
 * the common case.
 */

const DRIVERS = [
  {
    symbol: 'UUP',
    label:  'USD Strength',
    sublabel: 'Dollar Index — commodities priced in USD',
    invert: false,
    insight: (r: number) =>
      r < -0.5 ? 'Strong inverse — USD rallies hit this hard'  :
      r >  0.5 ? 'Unusual: moves WITH dollar (defensive demand?)' :
                 'Moderate or mixed USD sensitivity',
  },
  {
    symbol: 'TIP',
    label:  'Real Yields',
    sublabel: 'TIPS ETF inverted — key for gold, silver',
    invert: true,   // TIP rises when real yields fall; we invert so +r = moves WITH yields
    insight: (r: number) =>
      r < -0.5 ? 'Falls when real yields rise (classic gold/silver pattern)' :
      r >  0.5 ? 'Rises with real yields — unusual, check macro context'    :
                 'Limited real-yield sensitivity',
  },
  {
    symbol: 'SPY',
    label:  'Risk Appetite',
    sublabel: 'S&P 500 — industrial metals track risk-on',
    invert: false,
    insight: (r: number) =>
      r >  0.5 ? 'Strongly risk-on — sells off in equity drawdowns'  :
      r < -0.5 ? 'Counter-cyclical safe-haven behaviour'              :
                 'Moderate equity correlation',
  },
] as const;

// ── Correlation badge ──────────────────────────────────────────────────────────
function CorrBadge({ r }: { r: number | null }) {
  if (r === null) {
    return (
      <span className="w-14 flex items-center justify-center text-[10px] text-muted-foreground/40 bg-muted/20 rounded px-1 py-0.5">
        —
      </span>
    );
  }

  const abs = Math.abs(r);
  const pos = r >  0.05;
  const neg = r < -0.05;
  const mod = abs >= 0.3;

  const color =
    !mod      ? 'bg-muted/20 text-muted-foreground' :
    pos       ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-red-500/20 text-red-400';

  return (
    <span className={cn(
      'w-14 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded',
      'text-[10px] font-mono font-semibold tabular-nums',
      color,
    )}>
      {pos && mod && <TrendingUp   className="w-2.5 h-2.5 shrink-0" />}
      {neg && mod && <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
      {!pos && !neg && <Minus className="w-2.5 h-2.5 shrink-0 opacity-40" />}
      {r > 0 ? '+' : ''}{r.toFixed(2)}
    </span>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export function CommodityMacroView({ selectedId }: { selectedId: string }) {
  const etf       = COMMODITY_ETF_PROXY[selectedId];
  const commodity = getCommodity(selectedId);

  const { data: commBars = [], isLoading: cL } = useEodhdBarsForChart(etf?.symbol ?? null, etf?.exchange ?? 'US');
  const { data: uupBars  = [], isLoading: uL } = useEodhdBarsForChart('UUP', 'US');
  const { data: tipBars  = [], isLoading: tL } = useEodhdBarsForChart('TIP', 'US');
  const { data: spyBars  = [], isLoading: sL } = useEodhdBarsForChart('SPY', 'US');

  const isLoading = cL || uL || tL || sL;

  const commReturns = useMemo(() => logReturns(commBars), [commBars]);
  const driverData  = useMemo(() => ({
    UUP: logReturns(uupBars),
    TIP: logReturns(tipBars),
    SPY: logReturns(spyBars),
  }), [uupBars, tipBars, spyBars]);

  const rows = useMemo(() => {
    if (commReturns.length === 0) return [];
    return DRIVERS.map(d => {
      const dr   = driverData[d.symbol];
      const r30  = rollingCorrelation(commReturns, dr, 30);
      const r90  = rollingCorrelation(commReturns, dr, 90);
      const disp30 = r30 != null && d.invert ? -r30 : r30;
      const disp90 = r90 != null && d.invert ? -r90 : r90;
      return { ...d, r30: disp30, r90: disp90 };
    });
  }, [commReturns, driverData]);

  if (!etf) {
    return (
      <p className="px-4 py-4 text-center text-xs text-muted-foreground/60 italic">
        No ETF proxy for {commodity?.label ?? selectedId} — macro sensitivity unavailable.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Computing macro sensitivity…
      </div>
    );
  }

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Rolling Pearson correlation between <span className="font-medium text-foreground/80">{etf.symbol}</span> and
        key macro drivers at two horizons.
      </p>

      {/* Column headers */}
      <div className="px-4 pb-1 grid grid-cols-[1fr_auto_auto] gap-2 text-[9px] uppercase tracking-wide text-muted-foreground/50">
        <span>Driver</span>
        <span className="w-14 text-center">30-day</span>
        <span className="w-14 text-center">90-day</span>
      </div>

      <ul className="px-4 pb-2 space-y-2.5">
        {rows.map(d => (
          <li key={d.symbol} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground/85">{d.label}</p>
              <p className="text-[9px] text-muted-foreground/60 truncate">{d.sublabel}</p>
              {/* Contextual insight for the 30-day number */}
              {d.r30 != null && (
                <p className={cn(
                  'text-[9px] mt-0.5 italic',
                  Math.abs(d.r30) >= 0.5 ? (d.r30 > 0 ? 'text-emerald-400/70' : 'text-red-400/70') :
                                            'text-muted-foreground/50',
                )}>
                  {d.insight(d.r30)}
                </p>
              )}
            </div>
            <CorrBadge r={d.r30} />
            <CorrBadge r={d.r90} />
          </li>
        ))}
      </ul>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        EODHD 5Y daily bars · UUP = DXY proxy, TIP⁻¹ = Real Yields, SPY = Equities
      </p>
    </>
  );
}
