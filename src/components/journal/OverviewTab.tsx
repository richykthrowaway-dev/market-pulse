import { JournalStats, TradeEntry } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';
import { KillSwitchBanner } from './KillSwitchBanner';
import { GoalProgressCard } from './GoalProgressCard';

interface Props {
  stats: JournalStats;
  trades: TradeEntry[];
  settings: JournalSettings;
  openEditTrade?: (id: string) => void;
}

export function OverviewTab({ stats, trades, settings }: Props) {
  return (
    <div className="space-y-6">
      <KillSwitchBanner trades={trades} settings={settings} />
      <GoalProgressCard trades={trades} settings={settings} />
      {/* Slot 3: InsightCards — Task 24 */}
      {/* Slot 4: OutlierLossList — Task 24 */}

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
