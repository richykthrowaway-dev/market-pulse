import { useMemo, useState } from 'react';
import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Top Holders Card — institutional + mutual-fund top holders, with a
 * tab toggle. Sourced from `data.Holders` in the existing fundamentals
 * payload — 0 extra EODHD credits.
 *
 * What you can read from this:
 *   • Concentration risk: if the top 5 hold >40% of float, even a
 *     small reallocation moves price a lot.
 *   • Smart-money flow: change_p > 0 = increasing position;
 *     change_p < 0 = trimming. Cluster trimming across multiple top
 *     holders is a yellow flag.
 *   • New positions show up as change_p ≈ 100% with totalShares > 0.
 */

interface Props { data: EodFundamentals }

function fmtSharesM(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

type Tab = 'institutions' | 'funds';

export function TopHoldersCard({ data }: Props) {
  const [tab, setTab] = useState<Tab>('institutions');

  const inst = useMemo(() => {
    if (!data.Holders?.Institutions) return [];
    return Object.values(data.Holders.Institutions)
      .filter((h) => h?.name)
      .sort((a, b) => (b.totalShares ?? 0) - (a.totalShares ?? 0))
      .slice(0, 10);
  }, [data]);

  const funds = useMemo(() => {
    if (!data.Holders?.Funds) return [];
    return Object.values(data.Holders.Funds)
      .filter((h) => h?.name)
      .sort((a, b) => (b.totalShares ?? 0) - (a.totalShares ?? 0))
      .slice(0, 10);
  }, [data]);

  if (inst.length === 0 && funds.length === 0) return null;

  const list = tab === 'institutions' ? inst : funds;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Top Holders
          </span>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
          <button
            onClick={() => setTab('institutions')}
            className={cn(
              'px-2 py-0.5 transition-colors',
              tab === 'institutions' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              inst.length === 0 && 'opacity-40 cursor-not-allowed',
            )}
            disabled={inst.length === 0}
          >
            Institutions ({inst.length})
          </button>
          <button
            onClick={() => setTab('funds')}
            className={cn(
              'px-2 py-0.5 transition-colors',
              tab === 'funds' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              funds.length === 0 && 'opacity-40 cursor-not-allowed',
            )}
            disabled={funds.length === 0}
          >
            Funds ({funds.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="text-left  py-1 font-medium">Holder</th>
              <th className="text-right py-1 font-medium">% Held</th>
              <th className="text-right py-1 font-medium hidden sm:table-cell">Shares</th>
              <th className="text-right py-1 font-medium">Δ vs prev</th>
              <th className="text-left  py-1 font-medium hidden md:table-cell">As of</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h, i) => {
              const change = h.change_p ?? 0;
              const ChangeIcon = change > 0.5 ? TrendingUp : change < -0.5 ? TrendingDown : Minus;
              const changeColor = change > 0.5
                ? 'text-emerald-400'
                : change < -0.5 ? 'text-red-400' : 'text-muted-foreground';
              return (
                <tr key={`${h.name}-${i}`} className="border-b border-border/30 last:border-0">
                  <td className="py-1 truncate max-w-[14rem]" title={h.name}>{h.name}</td>
                  <td className="py-1 text-right font-medium">{(h.totalShares ?? 0).toFixed(2)}%</td>
                  <td className="py-1 text-right text-muted-foreground hidden sm:table-cell">
                    {fmtSharesM(h.currentShares ?? 0)}
                  </td>
                  <td className={cn('py-1 text-right inline-flex items-center justify-end gap-0.5 w-full', changeColor)}>
                    <ChangeIcon className="w-3 h-3" />
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </td>
                  <td className="py-1 text-muted-foreground hidden md:table-cell">{h.date?.slice(0, 10) ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
