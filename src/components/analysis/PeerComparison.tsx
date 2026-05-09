import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, Users2, Loader2 } from 'lucide-react';
import { fetchEodFundamentals, type EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

// ── Format helpers (mirror FundamentalsLookup; kept local to avoid coupling) ──

function fmtCompactUsd(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || value === 0) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function fmtRatio(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || value === 0) return '—';
  return `${value.toFixed(1)}×`;
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

// ── Metric definitions ────────────────────────────────────────────────
//
// Each row in the comparison table is described declaratively so the
// rendering loop is dumb. `direction` tells the coloring logic which
// way "good" is:
//   'higher'  → green for max, red for min (ROE, margins, growth)
//   'lower'   → green for min, red for max (P/E, EV/EBITDA, P/S, P/B)
//   'neutral' → no coloring (size metrics, sector labels)

type Direction = 'higher' | 'lower' | 'neutral';

interface MetricDef {
  label:     string;
  direction: Direction;
  /** Pull a number out of fundamentals; null = "no data". */
  extract:   (f: EodFundamentals) => number | null;
  /** Format the number for display. */
  format:    (v: number | null) => string;
}

const METRICS: MetricDef[] = [
  {
    label: 'Market Cap', direction: 'neutral',
    extract: (f) => f.Highlights?.MarketCapitalization ?? null,
    format:  fmtCompactUsd,
  },
  {
    label: 'Revenue (TTM)', direction: 'neutral',
    extract: (f) => f.Highlights?.RevenueTTM ?? null,
    format:  fmtCompactUsd,
  },
  {
    label: 'P/E (TTM)', direction: 'lower',
    extract: (f) => f.Highlights?.PERatio ?? null,
    format:  fmtRatio,
  },
  {
    label: 'Forward P/E', direction: 'lower',
    extract: (f) => f.Valuation?.ForwardPE ?? null,
    format:  fmtRatio,
  },
  {
    label: 'PEG', direction: 'lower',
    extract: (f) => f.Highlights?.PEGRatio ?? null,
    format:  (v) => v != null && isFinite(v) ? v.toFixed(2) : '—',
  },
  {
    label: 'P/S (TTM)', direction: 'lower',
    extract: (f) => f.Valuation?.PriceSalesTTM ?? null,
    format:  fmtRatio,
  },
  {
    label: 'EV / EBITDA', direction: 'lower',
    extract: (f) => f.Valuation?.EnterpriseValueEbitda ?? null,
    format:  fmtRatio,
  },
  {
    label: 'Profit Margin', direction: 'higher',
    extract: (f) => f.Highlights?.ProfitMargin ?? null,
    format:  fmtPercent,
  },
  {
    label: 'ROE (TTM)', direction: 'higher',
    extract: (f) => f.Highlights?.ReturnOnEquityTTM ?? null,
    format:  fmtPercent,
  },
  {
    label: 'Revenue YoY', direction: 'higher',
    extract: (f) => f.Highlights?.QuarterlyRevenueGrowthYOY ?? null,
    format:  fmtPercent,
  },
  {
    label: 'EPS YoY', direction: 'higher',
    extract: (f) => f.Highlights?.QuarterlyEarningsGrowthYOY ?? null,
    format:  fmtPercent,
  },
  {
    label: 'Dividend Yield', direction: 'higher',
    extract: (f) => f.Highlights?.DividendYield ?? null,
    format:  fmtPercent,
  },
  {
    label: 'Avg Target', direction: 'neutral',
    extract: (f) => f.AnalystRatings?.TargetPrice ?? f.Highlights?.WallStreetTargetPrice ?? null,
    format:  fmtPrice,
  },
];

// ── Single-peer fetch hook ────────────────────────────────────────────

function usePeerFundamentals(ticker: string | null) {
  return useQuery<EodFundamentals | null>({
    queryKey: ['eod-fundamentals', ticker],
    queryFn:  () => fetchEodFundamentals(ticker!),
    enabled:  !!ticker,
    staleTime: 12 * 60 * 60_000,
  });
}

// ── Component ─────────────────────────────────────────────────────────

interface PeerComparisonProps {
  /** Primary stock data (already loaded by the outer FundamentalsLookup). */
  primary: EodFundamentals;
  /** Primary ticker normalized (e.g. "AAPL.US") — used for the localStorage key. */
  primaryTicker: string;
}

export function PeerComparison({ primary, primaryTicker }: PeerComparisonProps) {
  const STORAGE_KEY = `peer-tickers:${primaryTicker}`;

  // Restore peers from localStorage (per-primary scoping).
  const [peers, setPeers] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');

  // Re-init peers when the primary changes (different ticker = different peer set).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setPeers(raw ? JSON.parse(raw) : []);
    } catch { setPeers([]); }
  }, [STORAGE_KEY]);

  // Persist peer list whenever it changes.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(peers)); } catch { /* ignore */ }
  }, [peers, STORAGE_KEY]);

  // Normalize: bare "AAPL" → "AAPL.US"; uppercase; preserve explicit suffix.
  const normalize = (raw: string): string => {
    const upper = raw.trim().toUpperCase();
    if (!upper) return '';
    return upper.includes('.') ? upper : `${upper}.US`;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalize(input);
    if (!norm) return;
    if (norm === primaryTicker) return; // don't add the primary as its own peer
    if (peers.includes(norm)) return;
    if (peers.length >= 4) return; // max 4 peers + primary = 5 columns total
    setPeers([...peers, norm]);
    setInput('');
  };

  const handleRemove = (ticker: string) => {
    setPeers(peers.filter((t) => t !== ticker));
  };

  // Fire one query per peer (cached 12h via React Query + fetchCached L2).
  // Hooks-in-loop pattern is fine here because peers.length is bounded ≤ 4
  // and the keys are stable per-ticker — React Query handles the dedup.
  const peerQueries = peers.map((t) => usePeerFundamentals(t));

  // Combine primary + loaded peers into a single column list for rendering.
  const columns = useMemo(() => {
    const all: Array<{ ticker: string; data: EodFundamentals; isPrimary: boolean }> = [
      { ticker: primaryTicker, data: primary, isPrimary: true },
    ];
    peerQueries.forEach((q, i) => {
      if (q.data) all.push({ ticker: peers[i], data: q.data, isPrimary: false });
    });
    return all;
  }, [primary, primaryTicker, peers, peerQueries]);

  // Pre-extract the metric value from each column for efficient row rendering.
  const valuesByMetric = useMemo(() => {
    return METRICS.map((m) => columns.map((c) => m.extract(c.data)));
  }, [columns]);

  // Per-row min/max for coloring. Only counts numeric, finite values; null
  // and 0 (which often means "no data" not "actually zero") are excluded
  // from the min/max computation but still rendered as "—".
  const minMaxByRow = useMemo(() => {
    return METRICS.map((m, i) => {
      if (m.direction === 'neutral') return { min: null, max: null };
      const finite = valuesByMetric[i].filter(
        (v): v is number => v != null && isFinite(v) && v !== 0,
      );
      if (finite.length < 2) return { min: null, max: null };
      return { min: Math.min(...finite), max: Math.max(...finite) };
    });
  }, [valuesByMetric]);

  // No peers added yet — render only the add-peer prompt + helper text.
  const anyLoading = peerQueries.some((q) => q.isLoading);

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      {/* Header + add-peer form */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Peer Comparison
          </span>
          <span className="text-[10px]">
            {peers.length}/4 peers
          </span>
        </div>
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add peer (e.g. MSFT)"
            disabled={peers.length >= 4}
            className="px-2 py-1 rounded-md border border-border bg-background text-xs w-40 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || peers.length >= 4}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </form>
      </div>

      {/* No peers yet — invite the user with a one-liner */}
      {peers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">
          Add up to 4 tickers to compare {primaryTicker} side-by-side on
          valuation, profitability, growth, and analyst targets. Each peer
          costs 10 EODHD credits on first lookup; 12h cached after.
        </p>
      ) : (
        // Comparison table — sticky first column, horizontal scroll for peers
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/30 text-left font-semibold uppercase tracking-wide text-[10px] text-muted-foreground px-3 py-2 border-r border-border">
                  Metric
                </th>
                {columns.map((col) => (
                  <th
                    key={col.ticker}
                    className={cn(
                      'text-right font-mono font-semibold px-3 py-2 whitespace-nowrap',
                      col.isPrimary && 'bg-primary/10',
                    )}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{col.ticker}</span>
                      {!col.isPrimary && (
                        <button
                          onClick={() => handleRemove(col.ticker)}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                          aria-label={`Remove ${col.ticker}`}
                          title={`Remove ${col.ticker}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {/* Show loading-skeleton columns for in-flight peer fetches
                    so the user gets feedback before they resolve. */}
                {anyLoading && peerQueries.filter((q) => q.isLoading).map((_, i) => (
                  <th key={`loading-${i}`} className="text-right font-semibold px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                  </th>
                ))}
              </tr>
              {/* Sector row — sub-header, not part of the colored metrics */}
              <tr className="border-t border-border">
                <th className="sticky left-0 z-10 bg-muted/30 text-left font-medium text-muted-foreground px-3 py-1.5 border-r border-border">
                  Sector
                </th>
                {columns.map((col) => (
                  <td
                    key={col.ticker}
                    className={cn(
                      'text-right text-muted-foreground px-3 py-1.5 truncate max-w-[140px]',
                      col.isPrimary && 'bg-primary/10',
                    )}
                    title={col.data.General?.GicSector || col.data.General?.Sector || ''}
                  >
                    {col.data.General?.GicSector || col.data.General?.Sector || '—'}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric, i) => {
                const { min, max } = minMaxByRow[i];
                return (
                  <tr key={metric.label} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card text-muted-foreground font-medium px-3 py-1.5 border-r border-border whitespace-nowrap">
                      {metric.label}
                    </td>
                    {columns.map((col, ci) => {
                      const v = valuesByMetric[i][ci];
                      // Best/worst coloring — only when ≥2 peers have data
                      // for this metric AND the metric has a "good" direction.
                      let valueClass = '';
                      if (v != null && isFinite(v) && v !== 0 && min != null && max != null && min !== max) {
                        if (metric.direction === 'higher') {
                          if (v === max) valueClass = 'text-emerald-500 font-semibold';
                          else if (v === min) valueClass = 'text-red-500';
                        } else if (metric.direction === 'lower') {
                          if (v === min) valueClass = 'text-emerald-500 font-semibold';
                          else if (v === max) valueClass = 'text-red-500';
                        }
                      }
                      return (
                        <td
                          key={col.ticker}
                          className={cn(
                            'text-right font-mono tabular-nums px-3 py-1.5 whitespace-nowrap',
                            col.isPrimary && 'bg-primary/10',
                            valueClass,
                          )}
                        >
                          {metric.format(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Failed peer fetches — show as inline alerts */}
      {peers.map((t, i) => {
        const q = peerQueries[i];
        if (q.isError || (q.data === null && !q.isLoading)) {
          return (
            <div key={t} className="flex items-center justify-between gap-2 text-xs text-red-400 px-1">
              <span>Could not load {t} — check ticker / quota.</span>
              <button
                onClick={() => handleRemove(t)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
