import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { computeAnatomy, fmtHoldTime, type TradeAnatomy } from './computeAdvancedStats';
import { TrendingUp, TrendingDown, Clock, Tag, AlertCircle, Compass, Activity } from 'lucide-react';

interface AnatomyCardProps {
  kind: 'winner' | 'loser';
  anatomy: TradeAnatomy;
}

function Row({
  icon: Icon, label, value, dim,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={`text-right ${dim ? 'text-muted-foreground' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function AnatomyCard({ kind, anatomy }: AnatomyCardProps) {
  const isWinner = kind === 'winner';
  const Icon = isWinner ? TrendingUp : TrendingDown;
  const accent = isWinner ? 'text-green-500' : 'text-destructive';
  const border = isWinner ? 'border-green-500/30' : 'border-destructive/30';

  if (anatomy.count === 0) {
    return (
      <Card className={`p-5 border ${border}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-4 w-4 ${accent}`} />
          <h3 className="text-sm font-semibold">
            Typical {isWinner ? 'winner' : 'loser'}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {isWinner ? 'No winning trades yet.' : 'No losing trades yet.'}
        </p>
      </Card>
    );
  }

  const sideStr = anatomy.longCount === anatomy.shortCount
    ? `${anatomy.longCount}L / ${anatomy.shortCount}S`
    : anatomy.longCount > anatomy.shortCount
      ? `Mostly LONG (${anatomy.longCount} of ${anatomy.count})`
      : `Mostly SHORT (${anatomy.shortCount} of ${anatomy.count})`;

  return (
    <Card className={`p-5 border ${border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} />
          <h3 className="text-sm font-semibold">
            Typical {isWinner ? 'winner' : 'loser'}
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {anatomy.count} trade{anatomy.count !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="divide-y divide-border/40">
        <Row
          icon={Activity}
          label="Avg P&L"
          value={
            <span className={`font-bold tabular-nums ${accent}`}>
              {anatomy.avgPnL >= 0 ? '+' : ''}{fmtDollar(anatomy.avgPnL)}
            </span>
          }
        />
        {anatomy.avgR !== null && (
          <Row
            icon={TrendingUp}
            label="Avg R"
            value={
              <span className={`tabular-nums ${anatomy.avgR >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {anatomy.avgR >= 0 ? '+' : ''}{anatomy.avgR.toFixed(2)}R
              </span>
            }
          />
        )}
        <Row
          icon={Clock}
          label="Avg hold time"
          value={anatomy.avgHoldMinutes !== null ? fmtHoldTime(anatomy.avgHoldMinutes) : <span className="text-muted-foreground">—</span>}
        />
        <Row
          icon={Compass}
          label="Direction"
          value={<span className="text-xs">{sideStr}</span>}
        />
        <Row
          icon={Tag}
          label="Top setup"
          value={anatomy.topSetup
            ? <span className="text-xs">{anatomy.topSetup.value} <span className="text-muted-foreground">×{anatomy.topSetup.count}</span></span>
            : <span className="text-muted-foreground text-xs">Untagged</span>
          }
        />
        {!isWinner && (
          <Row
            icon={AlertCircle}
            label="Top mistake"
            value={anatomy.topMistake
              ? <span className="text-xs text-destructive">{anatomy.topMistake.value} <span className="text-muted-foreground">×{anatomy.topMistake.count}</span></span>
              : <span className="text-muted-foreground text-xs">None tagged</span>
            }
          />
        )}
        <Row
          icon={isWinner ? TrendingUp : TrendingDown}
          label={isWinner ? 'Best trade' : 'Worst trade'}
          value={
            <span className={`tabular-nums ${accent}`}>
              {anatomy.largestAbs >= 0 ? '+' : ''}{fmtDollar(anatomy.largestAbs)}
            </span>
          }
        />
      </div>
    </Card>
  );
}

export function TradeAnatomyCards({ trades }: { trades: TradeEntry[] }) {
  const winners = computeAnatomy(trades, pnl => pnl > 0);
  const losers  = computeAnatomy(trades, pnl => pnl < 0);

  // Compare hold times — surface the "cutting winners short" warning
  const showCutWarning =
    winners.avgHoldMinutes !== null &&
    losers.avgHoldMinutes !== null &&
    winners.count >= 3 && losers.count >= 3 &&
    winners.avgHoldMinutes < losers.avgHoldMinutes * 0.6;  // winners held <60% as long as losers

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AnatomyCard kind="winner" anatomy={winners} />
        <AnatomyCard kind="loser"  anatomy={losers}  />
      </div>
      {showCutWarning && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex items-start gap-2.5 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-500">You may be cutting winners short</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your average winner is held for {fmtHoldTime(winners.avgHoldMinutes!)} but your average loser
              is held for {fmtHoldTime(losers.avgHoldMinutes!)}. Letting winners run typically improves expectancy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
