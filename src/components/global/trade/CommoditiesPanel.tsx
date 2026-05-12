import { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Layers,
  Newspaper, LineChart as LineChartIcon, Loader2,
  ExternalLink, Gem, Zap, Hammer, BatteryCharging, Sprout,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { subDays, format, parseISO } from 'date-fns';
import { useCommodityPrices, type CommodityPrice } from '@/hooks/useCommodityPrices';
import { useCommodityIntraday, buildIntradayMap } from '@/hooks/useCommodityIntraday';
import { useEodhdBarsForChart } from '@/hooks/useEodhdBarsForChart';
import { useEodhdNews } from '@/hooks/useEodhdNews';
import { useEodhdTechnicals } from '@/hooks/useEodhdTechnicals';
import { CommodityProducersCard } from './CommodityProducersCard';
import { ProductCompositionCard } from './ProductCompositionCard';
import { RareEarthsBreakdownCard } from './RareEarthsBreakdownCard';
import { CommodityCatalystStrip } from './CommodityCatalystStrip';
import { CommodityDriverBlock }   from './CommodityDriverBlock';
import { Sparkline }              from '@/components/ui/Sparkline';
import { cn } from '@/lib/utils';

// ── Chart range ──────────────────────────────────────────────────────────────
type Range = '1M' | '3M' | '1Y';
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, '1Y': 365 };

// ── Sparkline range (tile minicharts) ────────────────────────────────────────
type SparkRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
/**
 * How many trailing EOD closes to slice from the 252-bar sparkline array.
 * Using trading-day counts (≈252/yr) so each label reflects actual market
 * sessions rather than calendar days.
 *   1D →  2 bars (prev close + today) — shows today's single-day move
 *   1W →  5 bars (~one trading week)
 *   1M → 22 bars (~one trading month)
 *   3M → 63 bars (~one trading quarter)
 *   6M → 126 bars (~two quarters)
 *   1Y → 252 bars (full year of trading sessions)
 */
const SPARK_BARS: Record<SparkRange, number> = {
  '1D':   2,
  '1W':   5,
  '1M':  22,
  '3M':  63,
  '6M': 126,
  '1Y': 252,
};

// ── Commodity categorisation ────────────────────────────────────────────────
// Maps each commodity id (matches keys returned by the api-commodity-prices
// edge function) to a category label. Tiles are rendered grouped by category
// in the order listed in CATEGORY_ORDER.
type CommodityCategory =
  | 'Precious Metals'
  | 'Energy'
  | 'Industrial Metals'
  | 'Battery & Tech Metals'
  | 'Agriculture';

const CATEGORY_ORDER: CommodityCategory[] = [
  'Precious Metals',
  'Energy',
  'Industrial Metals',
  'Battery & Tech Metals',
  'Agriculture',
];

/**
 * Visual treatment per category. Each "bucket" renders with a tinted background
 * and a thick left accent bar so the groupings read at a glance.
 *
 * Colors picked to evoke the category:
 *   - Precious        → amber  (gold/silver shine)
 *   - Energy          → orange (flame/oil)
 *   - Industrial      → slate  (steel/concrete)
 *   - Battery & Tech  → violet (high-tech)
 *   - Agriculture     → emerald (crops)
 *
 * `tintBg` is applied at low alpha so the existing tile borders/contents still read.
 */
const CATEGORY_STYLE: Record<CommodityCategory, {
  icon:    LucideIcon;
  /** Tailwind classes for the bucket container — accent border + tinted bg. */
  bucket:  string;
  /** Tailwind classes for the heading text + icon color. */
  heading: string;
}> = {
  'Precious Metals': {
    icon:    Gem,
    bucket:  'bg-amber-500/[0.04] border-l-2 border-amber-500/60',
    heading: 'text-amber-400',
  },
  'Energy': {
    icon:    Zap,
    bucket:  'bg-orange-500/[0.04] border-l-2 border-orange-500/60',
    heading: 'text-orange-400',
  },
  'Industrial Metals': {
    icon:    Hammer,
    bucket:  'bg-slate-500/[0.05] border-l-2 border-slate-400/60',
    heading: 'text-slate-300',
  },
  'Battery & Tech Metals': {
    icon:    BatteryCharging,
    bucket:  'bg-violet-500/[0.04] border-l-2 border-violet-500/60',
    heading: 'text-violet-400',
  },
  'Agriculture': {
    icon:    Sprout,
    bucket:  'bg-emerald-500/[0.04] border-l-2 border-emerald-500/60',
    heading: 'text-emerald-400',
  },
};

const CATEGORY_OF: Record<string, CommodityCategory> = {
  // Precious
  gold:        'Precious Metals',
  silver:      'Precious Metals',
  platinum:    'Precious Metals',
  palladium:   'Precious Metals',
  // Energy
  crude_oil:   'Energy',
  brent:       'Energy',
  natural_gas: 'Energy',
  heating_oil: 'Energy',
  gasoline:    'Energy',
  coal:        'Energy',
  uranium:     'Energy',
  hydrogen:    'Energy',
  carbon:      'Energy',
  // Industrial / base metals
  copper:      'Industrial Metals',
  aluminum:    'Industrial Metals',
  iron_ore:    'Industrial Metals',
  nickel:      'Industrial Metals',
  zinc:        'Industrial Metals',
  tin:         'Industrial Metals',
  steel:       'Industrial Metals',
  // Battery / tech
  lithium:     'Battery & Tech Metals',
  cobalt:      'Battery & Tech Metals',
  rare_earths: 'Battery & Tech Metals',
  // Agriculture (soft commodities + fertiliser + lumber)
  corn:        'Agriculture',
  wheat:       'Agriculture',
  soybeans:    'Agriculture',
  coffee:      'Agriculture',
  sugar:       'Agriculture',
  cotton:      'Agriculture',
  cocoa:       'Agriculture',
  phosphate:   'Agriculture',
  potash:      'Agriculture',
  lumber:      'Agriculture',
};

function categoryOf(p: CommodityPrice): CommodityCategory {
  return CATEGORY_OF[p.id] ?? 'Industrial Metals';
}

/**
 * CommoditiesPanel — dedicated "Commodities" tab on the Global page.
 *
 * Sections:
 *   1. Commodity price tiles — 9 ETF-proxy prices in a 3-col grid.
 *      Clicking any tile selects it and expands the chart + news below.
 *   2. Price chart — 1Y OHLC area chart for the selected commodity.
 *      Range toggle: 1M / 3M / 1Y.  Uses EODHD daily bars (same hook
 *      as the Stock Analysis page).
 *   3. News feed — latest 15 EODHD articles tagged to the ETF ticker,
 *      with AI-generated sentiment badge.
 *   4. Top Producers — existing card showing production share by country.
 */
export function CommoditiesPanel() {
  const [selectedPrice, setSelectedPrice] = useState<CommodityPrice | null>(null);

  const handleTileClick = (p: CommodityPrice) => {
    setSelectedPrice(prev => (prev?.id === p.id ? null : p));
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Commodities
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Prices via ETF proxies · click any tile for chart &amp; news · top producers below.
        </p>
      </div>

      {/* ── Price strip ─────────────────────────────────────────────────── */}
      <CommodityPriceStrip
        selectedId={selectedPrice?.id ?? null}
        onSelect={handleTileClick}
      />

      {/* ── Expandable chart + news for selected commodity ──────────────── */}
      {selectedPrice && (
        <>
          <CommodityCatalystStrip price={selectedPrice} />
          <CommodityPriceChart price={selectedPrice} />
          <CommodityDriverBlock price={selectedPrice} />
          <CommodityNewsFeed price={selectedPrice} />
        </>
      )}

      {/* ── Top producers lookup ─────────────────────────────────────────── */}
      <div className="border-t border-border">
        <CommodityProducersCard />
      </div>

      {/* ── Product → Commodity breakdown ─────────────────────────────────── */}
      <ProductCompositionCard />

      {/* ── Rare earths drill-down (17 elements behind the REMX tile) ───── */}
      <RareEarthsBreakdownCard />
    </div>
  );
}

// ── Price strip ──────────────────────────────────────────────────────────────

function CommodityPriceStrip({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (p: CommodityPrice) => void;
}) {
  const { data, isLoading } = useCommodityPrices();
  const prices = data?.prices ?? [];

  // Sparkline timeframe toggle.  Default 1M matches the previous view.
  const [sparkRange, setSparkRange] = useState<SparkRange>('1M');

  // Intraday data — fetched for 1D (1h bars) and 1W (aggregated to 4h bars).
  // `enabled` gates the network call so we don't burn 145 EODHD credits
  // on every panel mount when on longer-range tabs.
  const { data: intradayData, isLoading: intradayLoading } =
    useCommodityIntraday(sparkRange === '1D' || sparkRange === '1W');

  // 1h bars map — used as-is for the 1D sparkline.
  const intradayMap = useMemo(
    () => buildIntradayMap(intradayData?.intraday ?? []),
    [intradayData],
  );

  // 4h bars map — 1h bars grouped into 4-hour buckets for the 1W sparkline.
  // Takes the last close in each 4h window, giving ~8–10 points over 5 days.
  const intraday4hMap = useMemo(() => {
    const intraday = intradayData?.intraday ?? [];
    return new Map(
      intraday.map(d => {
        const buckets = new Map<number, number>();
        for (const bar of d.bars) {
          const bucket = Math.floor(bar.timestamp / (4 * 3600));
          buckets.set(bucket, bar.close);
        }
        const closes = Array.from(buckets.keys())
          .sort((a, b) => a - b)
          .map(k => buckets.get(k)!);
        return [d.id, closes] as [string, number[]];
      }),
    );
  }, [intradayData]);

  return (
    <div className="px-4 py-3">
      {/* Header row: label left, sparkline range toggle right */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="w-3 h-3" />
          Commodity Prices
          <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
            ETF proxies · EOD · click for chart
          </span>
        </h3>

        {/* Sparkline range toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mr-0.5 hidden sm:inline">
            Sparkline
          </span>
          <div className="flex rounded border border-border overflow-hidden text-[9px]">
            {(['1D', '1W', '1M', '3M', '6M', '1Y'] as SparkRange[]).map(r => (
              <button
                key={r}
                onClick={() => setSparkRange(r)}
                className={cn(
                  'px-1.5 py-0.5 transition-colors tabular-nums',
                  sparkRange === r
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-11 rounded bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : prices.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Loading commodity data…</p>
      ) : (
        /* Group tiles by commodity category — fixed category order, then
           alphabetical within each group. Categories with no matching prices
           are skipped (so a partial API response doesn't show empty headings). */
        (() => {
          const byCategory = new Map<CommodityCategory, CommodityPrice[]>();
          for (const p of prices) {
            const cat = categoryOf(p);
            if (!byCategory.has(cat)) byCategory.set(cat, []);
            byCategory.get(cat)!.push(p);
          }
          for (const arr of byCategory.values()) {
            arr.sort((a, b) => a.label.localeCompare(b.label));
          }
          return (
            <div className="space-y-1.5">
              {CATEGORY_ORDER.filter(c => byCategory.has(c)).map(cat => {
                const style = CATEGORY_STYLE[cat];
                const Icon  = style.icon;
                const items = byCategory.get(cat)!;
                return (
                  <section
                    key={cat}
                    className={cn(
                      'rounded-md pl-2 pr-1.5 pt-1 pb-1.5',
                      style.bucket,
                    )}
                  >
                    <header className="flex items-center mb-1">
                      <h4 className={cn(
                        'flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider',
                        style.heading,
                      )}>
                        <Icon className="w-2.5 h-2.5" />
                        {cat}
                      </h4>
                    </header>
                    <div className="grid grid-cols-4 gap-1">
                      {items.map(p => (
                        <CommodityTile
                          key={p.id}
                          price={p}
                          selected={p.id === selectedId}
                          sparkRange={sparkRange}
                          intradayMap={intradayMap}
                          intraday4hMap={intraday4hMap}
                          intradayLoading={intradayLoading}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}

// ── Tile (one commodity) ────────────────────────────────────────────────────

function CommodityTile({
  price: p,
  selected,
  sparkRange,
  intradayMap,
  intraday4hMap,
  intradayLoading,
  onSelect,
}: {
  price:           CommodityPrice;
  selected:        boolean;
  sparkRange:      SparkRange;
  intradayMap:     Map<string, number[]>;
  intraday4hMap:   Map<string, number[]>;
  intradayLoading: boolean;
  onSelect:        (p: CommodityPrice) => void;
}) {
  // 1D → 1h intraday closes.
  // 1W → 4h aggregated intraday closes (~8–10 points over 5 trading days).
  // All other ranges → slice the trailing N bars from the 252-bar EOD array.
  const sparkValues: number[] | null =
    sparkRange === '1D'
      ? (intradayMap.get(p.id) ?? null)
      : sparkRange === '1W'
        ? (intraday4hMap.get(p.id) ?? null)
        : (p.sparkline && p.sparkline.length >= 2
            ? p.sparkline.slice(-SPARK_BARS[sparkRange])
            : null);

  // Derive gain % from the visible sparkline so it always matches the range.
  const sparkGainP =
    sparkValues && sparkValues.length >= 2 && sparkValues[0] !== 0
      ? ((sparkValues[sparkValues.length - 1] - sparkValues[0]) / sparkValues[0]) * 100
      : null;

  const displayChangeP = sparkGainP ?? p.changeP;
  const up = displayChangeP > 0;
  const dn = displayChangeP < 0;

  return (
    <button
      onClick={() => onSelect(p)}
      title={`${p.label} (${p.ticker}) · ${up ? '+' : ''}${displayChangeP.toFixed(2)}% ${sparkRange}`}
      className={cn(
        'group relative text-left rounded border bg-muted/30 transition-colors duration-100 overflow-hidden',
        'px-1.5 py-1',
        selected
          ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/30'
          : 'border-border/40 hover:border-primary/30 hover:bg-muted/50',
      )}
    >
      {/* Sparkline sits as a faint background spanning the full tile width
          since we no longer split the tile into text/spark columns. */}
      {sparkValues && sparkValues.length >= 2 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end">
          <Sparkline
            values={sparkValues}
            width={120}
            height={28}
            color={up ? '#34d399' : dn ? '#f87171' : '#94a3b8'}
            showFill
            showLastDot={false}
            label={`${p.label} · ${sparkRange}`}
          />
        </div>
      ) : null}

      <div className="relative z-10 leading-tight">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground truncate">
          {p.label}
        </p>
        <p className="text-[12px] font-semibold font-mono tabular-nums">
          ${p.price.toFixed(2)}
        </p>
        <p
          className={cn(
            'text-[10px] flex items-center gap-0.5 font-medium tabular-nums',
            up ? 'text-emerald-400' : dn ? 'text-red-400' : 'text-muted-foreground',
          )}
        >
          {up ? <TrendingUp className="w-2.5 h-2.5" /> : dn ? <TrendingDown className="w-2.5 h-2.5" /> : null}
          {up ? '+' : ''}{displayChangeP.toFixed(2)}%
        </p>
      </div>
    </button>
  );
}

// ── Price chart ──────────────────────────────────────────────────────────────

function CommodityPriceChart({ price }: { price: CommodityPrice }) {
  const [range, setRange] = useState<Range>('1Y');

  // Use the EODHD ticker override for chart data (futures entries carry an
  // eodhdTicker like "GLD.US" so the chart keeps working after switching the
  // price source to Yahoo Finance futures).
  const chartTicker = price.eodhdTicker ?? price.ticker;
  const [symbol, exchange] = useMemo(() => {
    const parts = chartTicker.split('.');
    return [parts[0] ?? chartTicker, parts[1] ?? 'US'];
  }, [chartTicker]);

  const { data: bars = [], isLoading } = useEodhdBarsForChart(symbol, exchange);
  const { data: tech } = useEodhdTechnicals(symbol, exchange);

  // Slice client-side to the selected range — hook caches 5Y of bars once.
  const chartData = useMemo(() => {
    const cutoff = subDays(new Date(), RANGE_DAYS[range]).getTime();
    return bars
      .filter(b => parseISO(b.date).getTime() >= cutoff)
      .map(b => ({ date: b.date, close: b.close }));
  }, [bars, range]);

  // ── Key levels (52w high/low + ATH + recent breakout) ─────────────────────
  // Computed from the full bars dataset (5Y) so they're stable across range
  // toggles — switching to 1M doesn't make the 52w high disappear.
  const levels = useMemo(() => {
    if (bars.length === 0) return null;
    const oneYearAgo = subDays(new Date(), 365).getTime();
    const past52w = bars.filter(b => parseISO(b.date).getTime() >= oneYearAgo);
    if (past52w.length < 10) return null;

    const high52w = Math.max(...past52w.map(b => b.high ?? b.close));
    const low52w  = Math.min(...past52w.map(b => b.low  ?? b.close));
    const allTimeHigh = Math.max(...bars.map(b => b.high ?? b.close));

    // 50-day breakout: was last close > prior 50-day max?  Mark if so.
    let breakoutDate: string | null = null;
    if (bars.length > 52) {
      const last = bars[bars.length - 1];
      const prior50 = bars.slice(-52, -2);
      const prior50Max = Math.max(...prior50.map(b => b.high ?? b.close));
      if (last.close > prior50Max) breakoutDate = last.date;
    }

    return { high52w, low52w, allTimeHigh, breakoutDate };
  }, [bars]);

  const isUp = chartData.length >= 2
    ? chartData[chartData.length - 1].close >= chartData[0].close
    : true;

  const gradientId = `comm-grad-${symbol}`;
  const lineColor  = isUp ? '#34d399' : '#f87171'; // emerald vs red-400

  // Y-axis domain with 2% padding.  Include 52w levels in the domain so the
  // reference lines are never clipped off the top/bottom of the visible range.
  const [yMin, yMax] = useMemo(() => {
    if (!chartData.length) return [0, 1];
    const vals = chartData.map(d => d.close);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (levels) {
      // Only widen the visible window if the level is within ~15% of the
      // current range — otherwise (e.g. ATH from 5 years ago) keep the
      // chart focused on the visible-range price action.
      const range = hi - lo;
      if (levels.high52w > hi && (levels.high52w - hi) < range * 0.5) hi = levels.high52w;
      if (levels.low52w  < lo && (lo - levels.low52w)  < range * 0.5) lo = levels.low52w;
    }
    const pad = (hi - lo) * 0.05 || hi * 0.02;
    return [lo - pad, hi + pad];
  }, [chartData, levels]);

  // ── Technical state derivation for the badges ─────────────────────────────
  const techBadges = useMemo(() => {
    const last = chartData[chartData.length - 1]?.close ?? null;
    const trendAbove50  = tech?.sma50  != null && last != null ? last > tech.sma50  : null;
    const regimeAbove200 = tech?.sma200 != null && last != null ? last > tech.sma200 : null;
    return {
      rsi: tech?.rsi ?? null,
      trendAbove50,
      regimeAbove200,
    };
  }, [tech, chartData]);

  const fmtTick = (d: string) => {
    try { return format(parseISO(d), range === '1M' ? 'MMM d' : 'MMM yy'); } catch { return d; }
  };

  return (
    <div className="px-4 pb-3 border-t border-border">
      {/* Sub-header: label + tech badges + range toggle */}
      <div className="flex items-center justify-between mt-3 mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <LineChartIcon className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold truncate">{price.label}</span>
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{price.ticker}</span>
        </div>

        {/* Tech state badges */}
        <div className="flex items-center gap-1 ml-auto">
          {techBadges.trendAbove50 != null && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide flex items-center gap-0.5',
                techBadges.trendAbove50
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400',
              )}
              title={techBadges.trendAbove50 ? 'Above 50-day SMA — uptrend' : 'Below 50-day SMA — downtrend'}
            >
              {techBadges.trendAbove50 ? '▲' : '▼'} TREND
            </span>
          )}
          {techBadges.rsi != null && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold tabular-nums',
                techBadges.rsi >= 70 ? 'bg-amber-500/15 text-amber-400' :
                techBadges.rsi <= 30 ? 'bg-red-500/15   text-red-400'   :
                                       'bg-muted/40    text-muted-foreground',
              )}
              title={
                techBadges.rsi >= 70 ? 'RSI overbought (>70)' :
                techBadges.rsi <= 30 ? 'RSI oversold (<30)'   :
                                       'RSI neutral'
              }
            >
              RSI {techBadges.rsi.toFixed(0)}
            </span>
          )}
          {techBadges.regimeAbove200 != null && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide flex items-center gap-0.5',
                techBadges.regimeAbove200
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400',
              )}
              title={techBadges.regimeAbove200 ? 'Above 200-day SMA — bull regime' : 'Below 200-day SMA — bear regime'}
            >
              {techBadges.regimeAbove200 ? '▲' : '▼'} 200d
            </span>
          )}
        </div>

        {/* Range toggle */}
        <div className="flex rounded border border-border overflow-hidden text-[10px]">
          {(['1M', '3M', '1Y'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2 py-0.5 transition-colors',
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-36 gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading chart…
        </div>
      ) : chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-6 text-center">
          No price data available.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={fmtTick}
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={36}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 11,
                padding: '4px 8px',
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Close']}
              labelFormatter={(d: string) => {
                try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
              }}
            />
            {/* 52w high/low reference lines — dotted, only when they sit inside the visible y-domain */}
            {levels && levels.high52w >= yMin && levels.high52w <= yMax && (
              <ReferenceLine
                y={levels.high52w}
                stroke="#34d399"
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="hidden"
                label={{
                  value: `52w hi $${levels.high52w.toFixed(2)}`,
                  position: 'insideTopRight',
                  fill: '#34d399',
                  fontSize: 9,
                }}
              />
            )}
            {levels && levels.low52w >= yMin && levels.low52w <= yMax && (
              <ReferenceLine
                y={levels.low52w}
                stroke="#f87171"
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="hidden"
                label={{
                  value: `52w lo $${levels.low52w.toFixed(2)}`,
                  position: 'insideBottomRight',
                  fill: '#f87171',
                  fontSize: 9,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── News feed ────────────────────────────────────────────────────────────────

const SENTIMENT_STYLE = {
  Positive: 'text-emerald-400 bg-emerald-500/10',
  Negative: 'text-red-400 bg-red-500/10',
  Neutral:  'text-muted-foreground bg-muted/40',
} as const;

function CommodityNewsFeed({ price }: { price: CommodityPrice }) {
  // Use the EODHD ticker for news (futures entries carry eodhdTicker).
  const { data: articles = [], isLoading } = useEodhdNews({
    symbol: price.eodhdTicker ?? price.ticker,
    limit: 15,
  });

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return format(d, 'MMM d');
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className="px-4 pb-3 border-t border-border">
      <div className="flex items-center gap-1.5 mt-3 mb-2">
        <Newspaper className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">{price.label} News</span>
        <span className="ml-auto text-[9px] text-muted-foreground/60 uppercase tracking-wide">
          EODHD · AI sentiment
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No recent news found for {price.label}.
        </p>
      ) : (
        <ul className="space-y-1">
          {articles.map((a, i) => {
            const pol = a.sentiment?.polarity ?? 'Neutral';
            const sentStyle = SENTIMENT_STYLE[pol];
            return (
              <li key={i} className="group">
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors -mx-1 px-1"
                >
                  {/* Sentiment dot */}
                  <span className={cn(
                    'mt-0.5 shrink-0 text-[9px] font-medium px-1 py-0.5 rounded uppercase tracking-wide',
                    sentStyle,
                  )}>
                    {pol === 'Positive' ? '▲' : pol === 'Negative' ? '▼' : '—'}
                  </span>

                  {/* Title */}
                  <span className="flex-1 text-xs leading-snug text-foreground/85 line-clamp-2 group-hover:text-foreground transition-colors">
                    {a.title}
                  </span>

                  {/* Date + external link */}
                  <span className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {fmtDate(a.date)}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/40 group-hover:text-primary/60" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
