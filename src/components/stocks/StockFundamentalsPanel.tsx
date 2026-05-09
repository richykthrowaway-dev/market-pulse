import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchFinnhubRecommendations,
  fetchFinnhubEarnings,
} from '@/services/finnhubApi';
import type {
  FinnhubRecommendation,
  FinnhubEarning,
} from '@/services/finnhubApi';
import {
  fetchEodFundamentals,
  eodQuarterlyEarnings,
  eodTtmEps,
} from '@/services/eodhdApi';
import { fetchAVOverview, avNum } from '@/services/alphaVantageApi';
import {
  fetchFMPProfile,
  fetchFMPKeyMetrics,
  fetchFMPAnalystRecs,
  fmpRecsToConsensus,
  parseFMPRange,
} from '@/services/fmpApi';
import { format, subDays } from 'date-fns';

interface StockFundamentalsPanelProps {
  symbol: string;
  name?: string;
  /** Current price — needed to compute P/E from TTM EPS */
  currentPrice?: number;
}

// ---------------------------------------------------------------------------
// Section 1 — Key Metrics
// ---------------------------------------------------------------------------

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide leading-none">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function KeyMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse bg-muted rounded-md" />
      ))}
    </div>
  );
}

function KeyMetricsSection({ symbol, currentPrice }: { symbol: string; currentPrice?: number }) {
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.US`;

  // ── Layer 1 (primary): EODHD fundamentals — All-in-One plan ─────────────────
  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ['eodhd', 'fundamentals', eodSymbol],
    queryFn:  () => fetchEodFundamentals(eodSymbol),
    staleTime: 12 * 60 * 60_000,
    gcTime:    12 * 60 * 60_000,
    enabled: !!symbol,
  });

  // ── Layer 2: FMP — fires only when EODHD returns null ───────────────────────
  const needFMP = !fundLoading && fund == null;

  const { data: fmpProfile,  isLoading: fmpProfLoading  } = useQuery({
    queryKey: ['fmp', 'profile', symbol],
    queryFn:  () => fetchFMPProfile(symbol),
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
    enabled: needFMP,
  });
  const { data: fmpMetrics, isLoading: fmpMetLoading } = useQuery({
    queryKey: ['fmp', 'key-metrics-ttm', symbol],
    queryFn:  () => fetchFMPKeyMetrics(symbol),
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
    enabled: needFMP,
  });

  // ── Layer 3: AV — only when both EODHD + FMP are empty ───────────────────────
  const fmpDone  = !needFMP || (!fmpProfLoading && !fmpMetLoading);
  const needAV   = fmpDone && !fmpProfile && !fmpMetrics && needFMP;

  const { data: avOverview, isLoading: avLoading } = useQuery({
    queryKey: ['alphavantage', 'overview', symbol],
    queryFn:  () => fetchAVOverview(symbol),
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
    enabled: needAV,
  });

  const isLoading =
    fundLoading ||
    (needFMP && (fmpProfLoading || fmpMetLoading)) ||
    (needAV && avLoading);

  if (isLoading) return <KeyMetricsSkeleton />;

  // ── Extract metrics — EODHD first, then FMP, then AV ─────────────────────────
  let high52:   number | null = null;
  let low52:    number | null = null;
  let epsTtm:   number | null = null;
  let pe:       number | null = null;
  let beta:     number | null = null;
  let divYield: number | null = null;

  if (fund) {
    // EODHD Technicals has pre-computed 52W range and beta
    const t = fund.Technicals;
    high52   = t?.['52WeekHigh'] || null;
    low52    = t?.['52WeekLow']  || null;
    beta     = t?.Beta           || null;

    // Highlights has P/E, EPS TTM, dividend yield directly
    const h  = fund.Highlights;
    pe       = h?.PERatio       || null;
    divYield = h?.DividendYield || null;
    epsTtm   = eodTtmEps(fund);
  } else {
    // FMP fallback
    if (fmpProfile?.range) {
      const p = parseFMPRange(fmpProfile.range);
      if (p) { high52 = p.high; low52 = p.low; }
    }
    if (fmpProfile?.beta)                         beta     = fmpProfile.beta;
    if (fmpMetrics?.peRatioTTM)                   pe       = fmpMetrics.peRatioTTM;
    if (fmpMetrics?.dividendYieldTTM)             divYield = fmpMetrics.dividendYieldTTM;
    if (fmpMetrics?.netIncomePerShareTTM)         epsTtm   = fmpMetrics.netIncomePerShareTTM;

    // AV last resort
    if (avOverview) {
      if (!high52)   high52   = avNum(avOverview['52WeekHigh']);
      if (!low52)    low52    = avNum(avOverview['52WeekLow']);
      if (!beta)     beta     = avNum(avOverview.Beta);
      if (!pe)       pe       = avNum(avOverview.PERatio);
      if (!divYield) divYield = avNum(avOverview.DividendYield);
      if (!epsTtm)   epsTtm   = avNum(avOverview.EPS);
    }
  }

  // Derive P/E from price + EPS when not directly available
  if (!pe && epsTtm && epsTtm > 0 && currentPrice && currentPrice > 0) {
    pe = currentPrice / epsTtm;
  }

  // ── Format ────────────────────────────────────────────────────────────────────
  const fmt$ = (n: number | null) => n != null ? '$' + n.toFixed(2) : '—';
  const fmtN = (n: number | null, dp = 1) => n != null ? n.toFixed(dp) : '—';
  const fmtPct = (n: number | null) => n != null ? (n * 100).toFixed(2) + '%' : '—';

  const metrics = [
    { label: 'P/E Ratio',   value: fmtN(pe) },
    { label: 'EPS (TTM)',   value: fmt$(epsTtm) },
    { label: '52W High',    value: fmt$(high52) },
    { label: '52W Low',     value: fmt$(low52) },
    {
      label: 'From 52W Hi',
      value: high52 != null && currentPrice != null
        ? (((currentPrice - high52) / high52) * 100).toFixed(1) + '%'
        : '—',
    },
    { label: 'Beta',        value: fmtN(beta, 2) },
    { label: 'Div Yield',   value: fmtPct(divYield) },
    { label: 'Current',     value: fmt$(currentPrice ?? null) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <MetricChip key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Analyst Consensus
// ---------------------------------------------------------------------------

function RecommendationSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-24 animate-pulse bg-muted rounded" />
      <div className="h-4 animate-pulse bg-muted rounded" />
      <div className="h-4 w-40 animate-pulse bg-muted rounded" />
    </div>
  );
}

function consensusLabel(
  sb: number,
  b: number,
  h: number,
  s: number,
  ss: number,
): { text: string; color: string } {
  const total = sb + b + h + s + ss;
  if (total === 0) return { text: 'N/A', color: 'text-muted-foreground' };
  const buyPct = (sb + b) / total;
  const holdPct = h / total;
  if (buyPct > 0.6) return { text: 'Strong Buy', color: 'text-green-500' };
  if (buyPct > 0.4) return { text: 'Buy', color: 'text-green-400' };
  if (holdPct > 0.4) return { text: 'Hold', color: 'text-yellow-400' };
  return { text: 'Sell', color: 'text-red-400' };
}

function RecommendationSection({ symbol }: { symbol: string }) {
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.US`;

  // Layer 1 (primary): EODHD AnalystRatings — already fetched by KeyMetricsSection,
  // React Query deduplicates — zero extra network calls.
  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ['eodhd', 'fundamentals', eodSymbol],
    queryFn:  () => fetchEodFundamentals(eodSymbol),
    staleTime: 12 * 60 * 60_000,
    gcTime:    12 * 60 * 60_000,
    enabled: !!symbol,
  });

  // Layer 2: Finnhub — fires when EODHD has no AnalystRatings
  const eodRatings  = fund?.AnalystRatings;
  const eodHasRecs  = !fundLoading && eodRatings &&
    (eodRatings.StrongBuy + eodRatings.Buy + eodRatings.Hold +
     eodRatings.Sell + eodRatings.StrongSell) > 0;

  const { data: finnhubRecs, isLoading: finnhubLoading } =
    useQuery<FinnhubRecommendation[]>({
      queryKey: ['finnhub', 'recommendation', symbol],
      queryFn: () => fetchFinnhubRecommendations(symbol),
      staleTime: 24 * 60 * 60_000,
      enabled: !fundLoading && !eodHasRecs,
    });

  // Layer 3: FMP — fires only when both EODHD + Finnhub return nothing
  const finnhubEmpty = !finnhubLoading && (!finnhubRecs || finnhubRecs.length === 0);
  const needFMP      = !eodHasRecs && !fundLoading && finnhubEmpty;

  const { data: fmpRecs, isLoading: fmpRecsLoading } = useQuery({
    queryKey: ['fmp', 'analyst-recs', symbol],
    queryFn:  () => fetchFMPAnalystRecs(symbol),
    staleTime: 24 * 60 * 60_000,
    gcTime:    24 * 60 * 60_000,
    enabled: needFMP,
  });

  const isLoading = fundLoading || finnhubLoading || (needFMP && fmpRecsLoading);
  if (isLoading) return <RecommendationSkeleton />;

  // Normalise into { sb, b, h, s, ss, period }
  let sb = 0, b = 0, h = 0, s = 0, ss = 0, period = '';

  if (eodHasRecs) {
    sb = eodRatings!.StrongBuy;
    b  = eodRatings!.Buy;
    h  = eodRatings!.Hold;
    s  = eodRatings!.Sell;
    ss = eodRatings!.StrongSell;
  } else if (finnhubRecs && finnhubRecs.length > 0) {
    const rec = finnhubRecs[0];
    sb = rec.strongBuy ?? 0;
    b  = rec.buy       ?? 0;
    h  = rec.hold      ?? 0;
    s  = rec.sell      ?? 0;
    ss = rec.strongSell ?? 0;
    period = rec.period ?? '';
  } else if (fmpRecs && fmpRecs.length > 0) {
    const consensus = fmpRecsToConsensus(fmpRecs);
    if (consensus) {
      ({ strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss, period } = consensus);
    }
  }

  const total = sb + b + h + s + ss;
  if (total === 0) return <p className="text-sm text-muted-foreground">No analyst data.</p>;

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const label = consensusLabel(sb, b, h, s, ss);

  const segments: { value: number; bg: string; title: string }[] = [
    { value: pct(sb), bg: 'bg-green-700', title: 'Strong Buy' },
    { value: pct(b), bg: 'bg-green-500', title: 'Buy' },
    { value: pct(h), bg: 'bg-yellow-400', title: 'Hold' },
    { value: pct(s), bg: 'bg-orange-400', title: 'Sell' },
    { value: pct(ss), bg: 'bg-red-500', title: 'Strong Sell' },
  ];

  return (
    <div className="space-y-3">
      {/* Consensus label */}
      <span className={`text-xl font-bold ${label.color}`}>{label.text}</span>

      {/* Stacked bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full border">
        {segments.map((seg) =>
          seg.value > 0 ? (
            <div
              key={seg.title}
              title={`${seg.title}: ${seg.value.toFixed(0)}%`}
              style={{ width: `${seg.value}%` }}
              className={`h-full ${seg.bg} transition-all`}
            />
          ) : null,
        )}
      </div>

      {/* Counts */}
      <p className="text-xs text-muted-foreground tabular-nums">
        <span className="text-green-700 dark:text-green-500 font-medium">SB: {sb}</span>
        {'  '}
        <span className="text-green-500 font-medium">B: {b}</span>
        {'  '}
        <span className="text-yellow-400 font-medium">H: {h}</span>
        {'  '}
        <span className="text-orange-400 font-medium">S: {s}</span>
        {'  '}
        <span className="text-red-400 font-medium">SS: {ss}</span>
      </p>

      {/* Period */}
      {period && (
        <p className="text-right text-[11px] text-muted-foreground">{period}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Earnings History
// ---------------------------------------------------------------------------

function EarningsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse bg-muted rounded-md" />
      ))}
    </div>
  );
}

function SurpriseChip({ surprisePercent }: { surprisePercent: number | null | undefined }) {
  if (surprisePercent == null) return null;
  if (surprisePercent > 0)
    return (
      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-500">
        Beat +{surprisePercent.toFixed(1)}%
      </span>
    );
  if (surprisePercent < 0)
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
        Miss {surprisePercent.toFixed(1)}%
      </span>
    );
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      In-line
    </span>
  );
}

function EarningsSection({ symbol }: { symbol: string }) {
  const eodSymbol = symbol.includes('.') ? symbol : `${symbol}.US`;

  // Layer 1: EODHD fundamentals (same query key — zero extra calls)
  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ['eodhd', 'fundamentals', eodSymbol],
    queryFn:  () => fetchEodFundamentals(eodSymbol),
    staleTime: 12 * 60 * 60_000,
    gcTime:    12 * 60 * 60_000,
    enabled: !!symbol,
  });

  // Layer 2: Finnhub — fires only when EODHD has no earnings history
  const eodEarnings   = fund ? eodQuarterlyEarnings(fund, 4) : [];
  const eodHasEarnings = !fundLoading && eodEarnings.length > 0;

  const { data: finnhubData, isLoading: finnhubLoading } = useQuery<FinnhubEarning[]>({
    queryKey: ['finnhub', 'earnings', symbol],
    queryFn:  () => fetchFinnhubEarnings(symbol),
    staleTime: 24 * 60 * 60_000,
    enabled: !fundLoading && !eodHasEarnings,
  });

  const isLoading = fundLoading || (!eodHasEarnings && finnhubLoading);
  if (isLoading) return <EarningsSkeleton />;

  // Normalise into a flat row shape
  interface EarningsRow {
    label:          string;
    estimate:       number | null;
    actual:         number | null;
    surprisePercent: number | null;
  }

  let rows: EarningsRow[] = [];

  if (eodHasEarnings) {
    rows = eodEarnings.map((q) => ({
      label:          q.date.slice(0, 7), // "YYYY-MM"
      estimate:       q.epsEstimate,
      actual:         q.epsActual,
      surprisePercent: q.surprisePercent,
    }));
  } else if (finnhubData && finnhubData.length > 0) {
    rows = finnhubData.slice(0, 4).map((q, idx) => ({
      label: q.quarter != null && q.year != null
        ? `Q${q.quarter} ${q.year}`
        : q.period ?? `Quarter ${idx + 1}`,
      estimate:       q.estimate ?? null,
      actual:         q.actual ?? null,
      surprisePercent: q.surprisePercent ?? null,
    }));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No earnings data.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((q, idx) => (
          <div
            key={q.label + idx}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium w-16 shrink-0">{q.label}</span>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Est:{' '}
                <span className="font-semibold text-foreground">
                  {q.estimate != null ? '$' + q.estimate.toFixed(2) : '—'}
                </span>
              </span>
              <span>
                Act:{' '}
                <span className="font-semibold text-foreground">
                  {q.actual != null ? '$' + q.actual.toFixed(2) : '—'}
                </span>
              </span>
            </div>

            <SurpriseChip surprisePercent={q.surprisePercent} />
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StockFundamentalsPanel({ symbol, name, currentPrice }: StockFundamentalsPanelProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">
          {name ?? symbol} — Fundamentals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Section 1 — Key Metrics */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Key Metrics
            </h4>
            <KeyMetricsSection symbol={symbol} currentPrice={currentPrice} />
          </div>

          {/* Section 2 — Analyst Consensus */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Analyst Consensus
            </h4>
            <RecommendationSection symbol={symbol} />
          </div>

          {/* Section 3 — Earnings History */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Earnings History
            </h4>
            <EarningsSection symbol={symbol} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
