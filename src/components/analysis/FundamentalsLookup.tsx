import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, BarChart3, TrendingUp, Users, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { fetchEodFundamentals, type EodFundamentals } from '@/services/eodhdApi';
import { EarningsBeatsChart } from './EarningsBeatsChart';
import { PeerComparison } from './PeerComparison';
import { cn } from '@/lib/utils';

// ── Format helpers ────────────────────────────────────────────────────

/** Compact USD: "$3.45T", "$890.2B", "$45.1M". */
function fmtCompactUsd(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !isFinite(value) || value === 0) return '—';
  const abs = Math.abs(value);
  const sym = currency === 'USD' ? '$' : '';
  if (abs >= 1e12) return `${sym}${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sym}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sym}${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3)  return `${sym}${(value / 1e3).toFixed(0)}K`;
  return `${sym}${value.toFixed(0)}`;
}

function fmtPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null || !isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** EODHD reports some percentages as already-multiplied values (e.g. 24.8 for 24.8%, NOT 0.248). */
function fmtRawPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

function fmtRatio(value: number | null | undefined, decimals = 2): string {
  if (value == null || !isFinite(value) || value === 0) return '—';
  return value.toFixed(decimals);
}

function fmtPrice(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !isFinite(value)) return '—';
  const sym = currency === 'USD' ? '$' : '';
  return `${sym}${value.toFixed(2)}`;
}

/** Map EODHD's numeric AnalystRating (1=Strong Buy ... 5=Strong Sell) to a label. */
function recommendationLabel(rating: number | null | undefined): string {
  if (rating == null || !isFinite(rating)) return '—';
  if (rating <= 1.5) return 'Strong Buy';
  if (rating <= 2.5) return 'Buy';
  if (rating <= 3.5) return 'Hold';
  if (rating <= 4.5) return 'Sell';
  return 'Strong Sell';
}

function recommendationColor(rating: number | null | undefined): string {
  if (rating == null || !isFinite(rating)) return 'text-muted-foreground';
  if (rating <= 2.5) return 'text-emerald-500';
  if (rating <= 3.5) return 'text-amber-400';
  return 'text-red-500';
}

// ── Sub-components ────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  value: string;
  /** Optional — color the value, e.g. for rating or growth. */
  valueClass?: string;
}

function MetricRow({ label, value, valueClass }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums font-medium', valueClass)}>{value}</span>
    </div>
  );
}

interface MetricGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function MetricGroup({ title, icon, children }: MetricGroupProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Visual 52-week range bar with markers for current/50DMA/200DMA. */
function FiftyTwoWeekBar({
  low, high, current, fiftyDayMA, twoHundredDayMA, currency,
}: {
  low: number | null | undefined;
  high: number | null | undefined;
  current: number | null | undefined;
  fiftyDayMA: number | null | undefined;
  twoHundredDayMA: number | null | undefined;
  currency: string;
}) {
  if (!low || !high || high <= low) return null;
  const range = high - low;
  const pct = (v: number | null | undefined) =>
    v != null && isFinite(v) ? Math.max(0, Math.min(100, ((v - low) / range) * 100)) : null;
  const cp = pct(current ?? fiftyDayMA);
  const ma50 = pct(fiftyDayMA);
  const ma200 = pct(twoHundredDayMA);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>52w Low</span>
        <span className="text-foreground/80">52w Range</span>
        <span>52w High</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500/20 via-amber-400/20 to-emerald-500/20 overflow-visible">
        {ma200 != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-muted-foreground/60"
            style={{ left: `${ma200}%` }}
            title={`200-day MA: ${fmtPrice(twoHundredDayMA, currency)}`}
          />
        )}
        {ma50 != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/80"
            style={{ left: `${ma50}%` }}
            title={`50-day MA: ${fmtPrice(fiftyDayMA, currency)}`}
          />
        )}
        {cp != null && (
          <div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-md"
            style={{ left: `${cp}%`, transform: 'translate(-50%, -50%)' }}
            title={`Recent: ${fmtPrice(current ?? fiftyDayMA, currency)}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{fmtPrice(low, currency)}</span>
        <span className="text-foreground/80">{fmtPrice(current ?? fiftyDayMA, currency)}</span>
        <span>{fmtPrice(high, currency)}</span>
      </div>
    </div>
  );
}

// ── Main result card ──────────────────────────────────────────────────

function ResultCard({ data, primaryTicker }: { data: EodFundamentals; primaryTicker: string }) {
  const g  = data.General;
  const h  = data.Highlights;
  const t  = data.Technicals;
  const v  = data.Valuation;
  const ar = data.AnalystRatings;
  const ss = data.SharesStats;

  const currency = g.CurrencyCode ?? 'USD';
  const currentPrice = (t as any)['50DayMA'] as number | null;
  const target = ar?.TargetPrice ?? h.WallStreetTargetPrice;
  const upside = currentPrice && target && currentPrice > 0
    ? ((target - currentPrice) / currentPrice) * 100
    : null;

  const totalAnalysts = ar
    ? (ar.StrongBuy ?? 0) + (ar.Buy ?? 0) + (ar.Hold ?? 0) + (ar.Sell ?? 0) + (ar.StrongSell ?? 0)
    : 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {/* Header: Logo + Name + Mcap + Sector */}
      <div className="flex items-start gap-3">
        {g.LogoURL && (
          <img
            src={g.LogoURL.startsWith('http') ? g.LogoURL : `https://eodhd.com${g.LogoURL}`}
            alt=""
            className="w-10 h-10 rounded bg-white object-contain shrink-0"
            onError={(e) => { (e.currentTarget.style.display = 'none'); }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-lg font-bold truncate">{g.Name}</h3>
            <span className="text-xs font-mono text-muted-foreground">
              {g.Code}.{g.Exchange}
            </span>
            {g.WebURL && (
              <a
                href={g.WebURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title={g.WebURL}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {[g.GicSector || g.Sector, g.GicIndustry || g.Industry, g.CountryName]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market Cap</p>
          <p className="text-base font-bold tabular-nums">
            {fmtCompactUsd(h.MarketCapitalization, currency)}
          </p>
        </div>
      </div>

      {/* 52-week bar */}
      <FiftyTwoWeekBar
        low={t['52WeekLow']}
        high={t['52WeekHigh']}
        current={currentPrice}
        fiftyDayMA={t['50DayMA']}
        twoHundredDayMA={t['200DayMA']}
        currency={currency}
      />

      {/* Description (truncated) */}
      {g.Description && (
        <p className="text-xs text-muted-foreground line-clamp-2" title={g.Description}>
          {g.Description}
        </p>
      )}

      {/* Three-column metric grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
        <MetricGroup title="Valuation" icon={<BarChart3 className="w-3.5 h-3.5" />}>
          <MetricRow label="P/E (TTM)"     value={fmtRatio(h.PERatio)} />
          <MetricRow label="Forward P/E"   value={fmtRatio(v?.ForwardPE)} />
          <MetricRow label="PEG"           value={fmtRatio(h.PEGRatio)} />
          <MetricRow label="P/S (TTM)"     value={fmtRatio(v?.PriceSalesTTM)} />
          <MetricRow label="P/B (MRQ)"     value={fmtRatio(v?.PriceBookMRQ)} />
          <MetricRow label="EV / EBITDA"   value={fmtRatio(v?.EnterpriseValueEbitda)} />
          <MetricRow label="Dividend Yield" value={fmtPercent(h.DividendYield)} />
        </MetricGroup>

        <MetricGroup title="Profitability & Growth" icon={<TrendingUp className="w-3.5 h-3.5" />}>
          <MetricRow label="Profit Margin"     value={fmtPercent(h.ProfitMargin)} />
          <MetricRow label="Operating Margin"  value={fmtPercent(h.OperatingMarginTTM)} />
          <MetricRow label="ROE (TTM)"         value={fmtPercent(h.ReturnOnEquityTTM)} />
          <MetricRow label="ROA (TTM)"         value={fmtPercent(h.ReturnOnAssetsTTM)} />
          <MetricRow label="Revenue (TTM)"     value={fmtCompactUsd(h.RevenueTTM, currency)} />
          <MetricRow label="Revenue YoY"       value={fmtPercent(h.QuarterlyRevenueGrowthYOY)}
                     valueClass={h.QuarterlyRevenueGrowthYOY != null
                       ? (h.QuarterlyRevenueGrowthYOY >= 0 ? 'text-emerald-500' : 'text-red-500')
                       : undefined} />
          <MetricRow label="EPS YoY"           value={fmtPercent(h.QuarterlyEarningsGrowthYOY)}
                     valueClass={h.QuarterlyEarningsGrowthYOY != null
                       ? (h.QuarterlyEarningsGrowthYOY >= 0 ? 'text-emerald-500' : 'text-red-500')
                       : undefined} />
        </MetricGroup>

        <MetricGroup title="Analysts & Shareholders" icon={<Users className="w-3.5 h-3.5" />}>
          <MetricRow
            label="Consensus"
            value={ar?.Rating ? recommendationLabel(ar.Rating) : '—'}
            valueClass={recommendationColor(ar?.Rating)}
          />
          <MetricRow label="Avg Target"        value={fmtPrice(target, currency)} />
          <MetricRow
            label="Upside"
            value={upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%` : '—'}
            valueClass={upside != null ? (upside >= 0 ? 'text-emerald-500' : 'text-red-500') : undefined}
          />
          <MetricRow label="# Analysts"        value={totalAnalysts > 0 ? String(totalAnalysts) : '—'} />
          <MetricRow label="Beta"              value={fmtRatio(t?.Beta)} />
          <MetricRow label="Insiders"          value={fmtRawPercent(ss?.PercentInsiders)} />
          <MetricRow label="Institutions"      value={fmtRawPercent(ss?.PercentInstitutions)} />
        </MetricGroup>
      </div>

      {/* Earnings beats history — sourced from the same fundamentals
          payload above, so this section adds 0 EODHD credits. Renders
          null automatically if the company has insufficient earnings
          history (e.g. recent IPOs, ETFs). */}
      <EarningsBeatsChart data={data} />

      {/* Peer comparison — opt-in (user must add tickers). Each peer
          ticker added costs 10 EODHD credits on cold lookup; cached
          12h via the same fetchCached layer as the primary. */}
      <PeerComparison primary={data} primaryTicker={primaryTicker} />
    </div>
  );
}

// ── Main exported widget ──────────────────────────────────────────────

const STORAGE_KEY = 'fundamentals-lookup-ticker';

/**
 * Stock Fundamentals Lookup widget for the Analysis page.
 *
 * Search any EODHD-recognised ticker (e.g. AAPL, MSFT.US, RY.TO) and
 * see a comprehensive single-card view of valuation, profitability,
 * growth, analyst consensus, and shareholder mix — all sourced from
 * one fetchEodFundamentals() call (10 EODHD credits, then 12h cached
 * via the localStorage L2 layer in fetchCached).
 *
 * The last successfully-loaded ticker persists in localStorage so the
 * widget restores its state across page reloads — a small UX win that
 * matters because fundamentals lookups are intentional/curated, not
 * "fire and forget".
 */
export function FundamentalsLookup() {
  // Restore last ticker from localStorage on mount.
  const [submittedTicker, setSubmittedTicker] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [input, setInput] = useState<string>(submittedTicker ?? '');

  // Normalise: "aapl" → "AAPL.US"; "RY.TO" stays as-is; "MSFT.US" stays as-is.
  // EODHD requires the .EXCHANGE suffix, defaulting to .US matches the most
  // common case and keeps the input zero-friction for US users.
  const normalisedTicker = useMemo(() => {
    if (!submittedTicker) return null;
    const upper = submittedTicker.trim().toUpperCase();
    if (!upper) return null;
    return upper.includes('.') ? upper : `${upper}.US`;
  }, [submittedTicker]);

  const { data, isLoading, isError, error } = useQuery<EodFundamentals | null>({
    queryKey: ['eod-fundamentals', normalisedTicker],
    queryFn: () => fetchEodFundamentals(normalisedTicker!),
    enabled: !!normalisedTicker,
    staleTime: 12 * 60 * 60_000, // matches fetchCached's L2 TTL
  });

  // Persist last successful ticker to localStorage so reloads restore it.
  useEffect(() => {
    if (data && normalisedTicker) {
      localStorage.setItem(STORAGE_KEY, submittedTicker ?? normalisedTicker);
    }
  }, [data, normalisedTicker, submittedTicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setSubmittedTicker(trimmed);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Stock Fundamentals</h2>
        <span className="text-xs text-muted-foreground">· EODHD</span>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ticker (e.g. AAPL, MSFT.US, RY.TO, BMW.XETRA)"
            className="w-full pl-10 pr-3 py-2 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
        </button>
      </form>

      {/* Result card / loading / error states */}
      {!submittedTicker ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Search any global ticker for a single-page fundamentals snapshot.
          <br />
          <span className="text-xs">
            Costs 10 EODHD credits per first lookup; cached 12h for same-symbol re-views.
          </span>
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading fundamentals for {normalisedTicker}…
        </div>
      ) : isError || !data ? (
        <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">No fundamentals found for {normalisedTicker}.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as Error)?.message ||
                'Try a different ticker. EODHD requires the .EXCHANGE suffix (e.g. AAPL.US, BMW.XETRA, RY.TO). EODHD daily quota may also be exhausted.'}
            </p>
          </div>
        </div>
      ) : (
        <ResultCard data={data} primaryTicker={normalisedTicker!} />
      )}
    </div>
  );
}
