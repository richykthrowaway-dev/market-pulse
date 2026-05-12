import { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Layers,
  Newspaper, LineChart as LineChartIcon, Loader2,
  ExternalLink,
} from 'lucide-react';
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

  // Intraday data — only fetched when the user switches to the 1D tab.
  // `enabled` gates the network call so we don't burn 45 EODHD credits
  // on every panel mount.
  const { data: intradayData, isLoading: intradayLoading } =
    useCommodityIntraday(sparkRange === '1D');
  const intradayMap = useMemo(
    () => buildIntradayMap(intradayData?.intraday ?? []),
    [intradayData],
  );

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
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-14 rounded bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : prices.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Loading commodity data…</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {prices.map((p) => {
            const selected = p.id === selectedId;

            // 1D → use hourly intraday closes (may still be loading on first select).
            // All other ranges → slice the trailing N bars from the 252-bar EOD array.
            const sparkValues: number[] | null =
              sparkRange === '1D'
                ? (intradayMap.get(p.id) ?? null)
                : (p.sparkline && p.sparkline.length >= 2
                    ? p.sparkline.slice(-SPARK_BARS[sparkRange])
                    : null);

            // Derive the gain % from the visible sparkline bars so the number
            // always matches the selected range.
            //   formula: (last − first) / first × 100
            // Falls back to the API's 1-day changeP only when sparkValues is not
            // yet available (e.g. intraday still loading, or insufficient history).
            const sparkGainP =
              sparkValues && sparkValues.length >= 2 && sparkValues[0] !== 0
                ? ((sparkValues[sparkValues.length - 1] - sparkValues[0]) / sparkValues[0]) * 100
                : null;

            const displayChangeP = sparkGainP ?? p.changeP;
            const up = displayChangeP > 0;
            const dn = displayChangeP < 0;

            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={cn(
                  'group relative text-left rounded border bg-muted/30 transition-colors duration-100 overflow-hidden',
                  'px-3 py-2',
                  selected
                    ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/30'
                    : 'border-border/40 hover:border-primary/30 hover:bg-muted/50',
                )}
              >
                {/* Sparkline as background — fills the right side of the tile.
                    1D → hourly intraday bars (fetched lazily on first select).
                    All others → EOD slice from the 252-bar array.
                    pointer-events-none so clicks pass through to the button. */}
                {sparkRange === '1D' && intradayLoading ? (
                  /* Subtle pulse placeholder while intraday loads */
                  <div className="pointer-events-none absolute right-2 top-2 bottom-2 w-[55%] flex items-center justify-end opacity-30">
                    <div className="w-full h-5 rounded bg-muted-foreground/20 animate-pulse" />
                  </div>
                ) : sparkValues && sparkValues.length >= 2 ? (
                  <div className="pointer-events-none absolute right-2 top-2 bottom-2 w-[55%] flex items-center justify-end">
                    <Sparkline
                      values={sparkValues}
                      width={160}
                      height={40}
                      color={up ? '#34d399' : dn ? '#f87171' : '#94a3b8'}
                      showFill
                      showLastDot
                      label={`${p.label} · ${sparkRange}${sparkRange === '1D' ? ' · hourly' : ''}`}
                      className="opacity-70 group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                ) : sparkRange === '1D' ? (
                  /* Markets closed / no intraday data available */
                  <div className="pointer-events-none absolute right-2 top-2 bottom-2 w-[55%] flex items-center justify-end pr-1">
                    <span className="text-[8px] text-muted-foreground/40 italic">mkt closed</span>
                  </div>
                ) : null}

                {/* Foreground stack — text content sits on top of the sparkline */}
                <div className="relative z-10">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                    {p.label}
                  </p>
                  <p className="text-base font-semibold font-mono tabular-nums mt-0.5">
                    ${p.price.toFixed(2)}
                  </p>
                  <p
                    className={cn(
                      'text-[11px] flex items-center gap-0.5 font-medium tabular-nums mt-0.5',
                      up ? 'text-emerald-400' : dn ? 'text-red-400' : 'text-muted-foreground',
                    )}
                  >
                    {up ? <TrendingUp className="w-3 h-3" /> : dn ? <TrendingDown className="w-3 h-3" /> : null}
                    {up ? '+' : ''}{displayChangeP.toFixed(2)}%
                    <span className="text-[8px] font-normal opacity-50 ml-0.5">{sparkRange}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Price chart ──────────────────────────────────────────────────────────────

function CommodityPriceChart({ price }: { price: CommodityPrice }) {
  const [range, setRange] = useState<Range>('1Y');

  // Ticker is EODHD format e.g. "GLD.US" — split into symbol + exchange.
  const [symbol, exchange] = useMemo(() => {
    const parts = price.ticker.split('.');
    return [parts[0] ?? price.ticker, parts[1] ?? 'US'];
  }, [price.ticker]);

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
  // Use the full EODHD ticker (e.g. "GLD.US") as the symbol filter.
  const { data: articles = [], isLoading } = useEodhdNews({
    symbol: price.ticker,
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
