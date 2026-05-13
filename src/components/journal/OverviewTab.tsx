import { useMemo } from 'react';
import { JournalStats, TradeEntry } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';
import { KillSwitchBanner } from './KillSwitchBanner';
import { GoalProgressCard } from './GoalProgressCard';
import { InsightCard } from './InsightCard';
import { OutlierLossList } from './OutlierLossList';
import {
  computeDayOfWeekInsight,
  computeAfterLossInsight,
  computeOutlierLosses,
} from './computeInsights';

interface Props {
  stats: JournalStats;
  trades: TradeEntry[];
  settings: JournalSettings;
  openEditTrade?: (id: string) => void;
}

export function OverviewTab({ stats, trades, settings, openEditTrade }: Props) {
  const dowInsight = useMemo(() => computeDayOfWeekInsight(trades), [trades]);
  const afterLossInsight = useMemo(() => computeAfterLossInsight(trades), [trades]);
  const outliers = useMemo(() => computeOutlierLosses(trades), [trades]);

  return (
    <div className="space-y-6">
      <KillSwitchBanner trades={trades} settings={settings} />
      <GoalProgressCard trades={trades} settings={settings} />

      {(dowInsight || afterLossInsight) && (
        <div className="space-y-3">
          {dowInsight && <InsightCard insight={dowInsight} />}
          {afterLossInsight && <InsightCard insight={afterLossInsight} />}
        </div>
      )}

      <OutlierLossList outliers={outliers} onClick={openEditTrade} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
        <p className="text-sm text-muted-foreground">{trades.length} trades logged.</p>
        {stats.totalTrades === 0 && (
          <p className="text-sm text-muted-foreground mt-2">Log your first trade or import an IBKR statement to populate this tab.</p>
        )}
      </Card>
    </div>
  );
}
