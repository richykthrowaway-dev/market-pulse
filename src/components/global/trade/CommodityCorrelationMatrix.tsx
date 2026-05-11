import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useCommodityPrices } from '@/hooks/useCommodityPrices';
import { cn } from '@/lib/utils';

// ── Math helpers ──────────────────────────────────────────────────────────────

/** Log returns from a raw close array (no dates needed). */
function logReturnsArr(vals: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    out.push(vals[i - 1] > 0 && vals[i] > 0 ? Math.log(vals[i] / vals[i - 1]) : 0);
  }
  return out;
}

/** Pearson r over the last `window` entries of two arrays. */
function pearson(x: number[], y: number[], window = 60): number | null {
  const n = Math.min(x.length, y.length, window);
  if (n < 5) return null;
  const xs = x.slice(-n);
  const ys = y.slice(-n);
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i];
    sx2 += xs[i] * xs[i]; sy2 += ys[i] * ys[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  if (den === 0 || !Number.isFinite(den)) return null;
  return num / den;
}

// ── Colour mapping ────────────────────────────────────────────────────────────
function cellStyle(r: number | null, isDiag: boolean) {
  if (isDiag) return 'bg-muted/30 text-muted-foreground/50';
  if (r === null) return 'bg-muted/10 text-muted-foreground/30';
  if (r >  0.7) return 'bg-emerald-500/80 text-white font-bold';
  if (r >  0.4) return 'bg-emerald-500/40 text-emerald-300';
  if (r >  0.1) return 'bg-emerald-500/15 text-emerald-400/80';
  if (r < -0.7) return 'bg-red-500/80 text-white font-bold';
  if (r < -0.4) return 'bg-red-500/40 text-red-300';
  if (r < -0.1) return 'bg-red-500/15 text-red-400/80';
  return 'bg-muted/10 text-muted-foreground/50';
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function CommodityCorrelationMatrix() {
  const { data, isLoading } = useCommodityPrices();
  const prices = data?.prices ?? [];

  // Build return series for all 9 commodities once, then compute all pairs.
  // Uses the 252-bar sparkline array already in the React Query cache.
  const { returns, matrix } = useMemo(() => {
    if (prices.length === 0) return { returns: [], matrix: [] };
    const ret = prices.map(p => logReturnsArr(p.sparkline ?? []));
    const mat = ret.map((rx, i) =>
      ret.map((ry, j) => (i === j ? null : pearson(rx, ry, 60))),
    );
    return { returns: ret, matrix: mat };
  }, [prices]);

  // Short labels that fit in the cell width
  const labels = useMemo(() =>
    prices.map(p => p.label.split(/\s+/)[0].slice(0, 5).toUpperCase()),
    [prices],
  );

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Computing correlations…
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <p className="px-4 py-4 text-center text-xs text-muted-foreground/60 italic">
        No price data available.
      </p>
    );
  }

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        60-day Pearson correlation between all commodity ETF daily returns.{' '}
        <span className="text-emerald-400">Green</span> = move together ·{' '}
        <span className="text-red-400">Red</span> = move opposite.
        Darker = stronger signal.
      </p>

      {/* Scrollable wrapper in case the panel is narrow */}
      <div className="px-4 pb-3 overflow-x-auto">
        <table className="text-[8px] border-separate border-spacing-[2px]">
          <thead>
            <tr>
              {/* Top-left empty corner */}
              <th className="w-7" />
              {labels.map((l, j) => (
                <th key={j} className="w-7 text-center font-medium text-muted-foreground/50 pb-1">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map((p, i) => (
              <tr key={p.id}>
                {/* Row label */}
                <td className="text-right pr-1 text-muted-foreground/50 font-medium whitespace-nowrap">
                  {labels[i]}
                </td>
                {matrix[i]?.map((r, j) => (
                  <td
                    key={j}
                    className={cn(
                      'rounded text-center tabular-nums font-mono w-7 h-6 align-middle cursor-default',
                      cellStyle(r, i === j),
                    )}
                    title={
                      i === j
                        ? p.label
                        : `${prices[i].label} vs ${prices[j].label}: r=${r != null ? r.toFixed(2) : 'n/a'}`
                    }
                  >
                    {i === j ? '—' : r != null ? r.toFixed(2) : '?'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 pb-2 flex items-center gap-3 text-[9px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/70 inline-block" /> +1 perfect correlation
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/70 inline-block" /> −1 inverse
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted/20 inline-block" /> ~0 independent
        </span>
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        252-bar sparkline returns · window = 60 trading days · updated hourly
      </p>
    </>
  );
}
