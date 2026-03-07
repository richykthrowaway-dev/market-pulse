import React from 'react';
import { StatsCard } from '@/components/ui/StatsCard';
import { DollarSign, Target, TrendingUp, BarChart3 } from 'lucide-react';
import type { JournalStats } from '@/hooks/useTradeJournal';

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

interface JournalStatsRowProps {
  stats: JournalStats;
}

export function JournalStatsRow({ stats }: JournalStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard
        title="Total P/L"
        value={fmtCurrency(stats.totalPnL)}
        icon={<DollarSign className="h-4 w-4" />}
        valueClassName={stats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}
        description={`${stats.totalTrades} trades`}
      />
      <StatsCard
        title="Win Rate"
        value={`${(stats.winRate * 100).toFixed(1)}%`}
        icon={<Target className="h-4 w-4" />}
        description={`${stats.winCount}W / ${stats.lossCount}L`}
      />
      <StatsCard
        title="Profit Factor"
        value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
        icon={<TrendingUp className="h-4 w-4" />}
        description="Gross wins / losses"
      />
      <StatsCard
        title="Avg Win / Loss"
        value={`${fmtCurrency(stats.avgWin)}`}
        icon={<BarChart3 className="h-4 w-4" />}
        description={`Loss: ${fmtCurrency(stats.avgLoss)}`}
      />
    </div>
  );
}
