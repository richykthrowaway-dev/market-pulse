import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { computeFeeImpact } from './computeAdvancedStats';
import { Receipt, AlertCircle, DollarSign } from 'lucide-react';

export function FeeImpactCard({ trades }: { trades: TradeEntry[] }) {
  const f = computeFeeImpact(trades);

  if (trades.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1">Fee Impact</h3>
        <p className="text-sm text-muted-foreground">No trades yet.</p>
      </Card>
    );
  }

  // Threshold heuristics:
  //  · >10% fee ratio = over-trading risk
  //  · >5% WR drop from gross → net = fees flipping outcomes
  const feeRatioTone =
    f.feeRatio === 0       ? 'neutral' :
    f.feeRatio > 15        ? 'destructive' :
    f.feeRatio > 8         ? 'amber' :
    'good';

  const wrDelta = f.grossWinRate - f.netWinRate;
  const wrDeltaTone =
    wrDelta >= 0.05 ? 'destructive' :
    wrDelta >= 0.02 ? 'amber' : 'neutral';

  const flippedTone =
    f.flippedTrades >= 5 ? 'destructive' :
    f.flippedTrades >= 1 ? 'amber' : 'neutral';

  const TONE: Record<string, string> = {
    destructive: 'text-destructive',
    amber:       'text-amber-500',
    good:        'text-green-500',
    neutral:     '',
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Fee Impact</h3>
      </div>

      <div className="space-y-3.5">
        {/* Total + avg */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Total fees paid
            </p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">
              {fmtDollar(f.totalFees)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Avg / trade
            </p>
            <p className="text-sm font-medium tabular-nums mt-0.5">
              {fmtDollar(f.avgFee)}
            </p>
          </div>
        </div>

        {/* Fees as % of gross wins */}
        <div className="rounded-md bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" />
              Fees as % of gross wins
            </span>
            <span className={`text-sm font-semibold tabular-nums ${TONE[feeRatioTone]}`}>
              {f.feeRatio.toFixed(1)}%
            </span>
          </div>
          {f.feeRatio > 15 && (
            <p className="text-[11px] text-destructive/80 mt-1">
              Fees are eating &gt;15% of your gross wins — likely over-trading.
            </p>
          )}
          {f.feeRatio > 8 && f.feeRatio <= 15 && (
            <p className="text-[11px] text-amber-500/80 mt-1">
              High fee load — review whether each trade was worth taking.
            </p>
          )}
        </div>

        {/* Win-rate impact (gross vs net) */}
        <div className="rounded-md bg-muted/30 px-3 py-2.5">
          <p className="text-xs mb-1.5">Win rate impact</p>
          <div className="flex items-center justify-between text-sm tabular-nums">
            <span className="text-muted-foreground">
              Gross: <span className="text-foreground font-medium">{(f.grossWinRate * 100).toFixed(1)}%</span>
            </span>
            <span className="text-muted-foreground">
              Net: <span className="text-foreground font-medium">{(f.netWinRate * 100).toFixed(1)}%</span>
            </span>
            <span className={`font-semibold ${TONE[wrDeltaTone]}`}>
              −{(wrDelta * 100).toFixed(1)}pp
            </span>
          </div>
        </div>

        {/* Flipped trades — trades that would've been winners w/o fees */}
        {f.flippedTrades > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${TONE[flippedTone]}`} />
            <p>
              <span className={`font-semibold ${TONE[flippedTone]}`}>{f.flippedTrades} trade{f.flippedTrades !== 1 ? 's' : ''}</span>
              {' '}would have been winners without fees.
              {f.flippedTrades >= 5 && (
                <span className="text-destructive/80"> Your broker is your most expensive trade.</span>
              )}
            </p>
          </div>
        )}

        {/* Net/Gross summary */}
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gross P&amp;L</span>
            <span className={`tabular-nums ${f.grossPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {f.grossPnL >= 0 ? '+' : ''}{fmtDollar(f.grossPnL)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold mt-1">
            <span>Net P&amp;L</span>
            <span className={`tabular-nums ${f.netPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {f.netPnL >= 0 ? '+' : ''}{fmtDollar(f.netPnL)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
