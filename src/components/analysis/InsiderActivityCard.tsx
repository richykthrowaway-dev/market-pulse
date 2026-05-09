import { useMemo } from 'react';
import { ShieldAlert, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

/**
 * Insider Activity Card — recent SEC Form 4 transactions for the
 * primary ticker. Sourced from `data.InsiderTransactions` in the
 * existing fundamentals payload — 0 extra EODHD credits.
 *
 * Signal value:
 *   • Insider OPEN-MARKET BUYS are rare and bullish — they only have
 *     one reason to do them (they think the price is going up). Sales
 *     have many explanations (10b5-1 plans, taxes, diversification).
 *   • A net-buying cluster across multiple insiders is far stronger
 *     than a single transaction.
 *   • We classify by transactionAcquiredDisposed: "A" (acquired/buy)
 *     or "D" (disposed/sell), and by transactionCode: "P" = open-market
 *     purchase, "S" = open-market sale, "M" = option exercise, etc.
 */

interface Props { data: EodFundamentals }

function fmtShares(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function InsiderActivityCard({ data }: Props) {
  const txns = useMemo(() => {
    if (!data.InsiderTransactions) return [];
    try {
      return Object.values(data.InsiderTransactions)
        .filter((t) => t && (t.transactionAmount ?? 0) > 0)
        .sort((a, b) => {
          const da = a.transactionDate || a.date || '';
          const db = b.transactionDate || b.date || '';
          return db.localeCompare(da);
        })
        .slice(0, 8);
    } catch {
      return [];
    }
  }, [data]);

  const totals = useMemo(() => {
    if (!data.InsiderTransactions) return null;
    const all = Object.values(data.InsiderTransactions);
    let buyShares = 0, sellShares = 0, buyValue = 0, sellValue = 0;
    for (const t of all) {
      const value = (t.transactionAmount ?? 0) * (t.transactionPrice ?? 0);
      if (t.transactionAcquiredDisposed === 'A') {
        buyShares  += t.transactionAmount ?? 0;
        buyValue   += value;
      } else if (t.transactionAcquiredDisposed === 'D') {
        sellShares += t.transactionAmount ?? 0;
        sellValue  += value;
      }
    }
    return { buyShares, sellShares, buyValue, sellValue, count: all.length };
  }, [data]);

  if (txns.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Insider Activity · last {txns.length} of {totals?.count ?? 0}
          </span>
        </div>
        {totals && (
          <div className="flex items-center gap-3 text-[10px] tabular-nums">
            <span className="text-emerald-400">
              <ArrowUpRight className="w-3 h-3 inline" /> {fmtUsd(totals.buyValue)}
            </span>
            <span className="text-red-400">
              <ArrowDownRight className="w-3 h-3 inline" /> {fmtUsd(totals.sellValue)}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="text-left  py-1 font-medium">Date</th>
              <th className="text-left  py-1 font-medium">Insider</th>
              <th className="text-left  py-1 font-medium hidden sm:table-cell">Role</th>
              <th className="text-right py-1 font-medium">Shares</th>
              <th className="text-right py-1 font-medium hidden sm:table-cell">Price</th>
              <th className="text-right py-1 font-medium">Value</th>
              <th className="text-right py-1 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t, i) => {
              const isBuy   = t.transactionAcquiredDisposed === 'A';
              const value   = (t.transactionAmount ?? 0) * (t.transactionPrice ?? 0);
              const codeMap: Record<string, string> = {
                P: 'Buy', S: 'Sell', M: 'Opt Ex', A: 'Award', G: 'Gift', F: 'Tax', D: 'Sale to issuer',
              };
              const codeLabel = codeMap[t.transactionCode] ?? t.transactionCode ?? '—';
              return (
                <tr key={`${t.transactionDate}-${t.ownerName}-${i}`} className="border-b border-border/30 last:border-0">
                  <td className="py-1 text-muted-foreground">{(t.transactionDate || t.date)?.slice(0, 10)}</td>
                  <td className="py-1 truncate max-w-[10rem]" title={t.ownerName}>{t.ownerName}</td>
                  <td className="py-1 text-muted-foreground hidden sm:table-cell truncate max-w-[8rem]" title={t.ownerRelationship || t.ownerTitle}>
                    {t.ownerRelationship || t.ownerTitle || '—'}
                  </td>
                  <td className="py-1 text-right">{fmtShares(t.transactionAmount ?? 0)}</td>
                  <td className="py-1 text-right hidden sm:table-cell">
                    {t.transactionPrice ? `$${t.transactionPrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-1 text-right">{value > 0 ? fmtUsd(value) : '—'}</td>
                  <td className={cn('py-1 text-right font-medium', isBuy ? 'text-emerald-400' : 'text-red-400')}>
                    <span className="inline-flex items-center gap-0.5">
                      {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {codeLabel}
                      {t.secLink && (
                        <a href={t.secLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
