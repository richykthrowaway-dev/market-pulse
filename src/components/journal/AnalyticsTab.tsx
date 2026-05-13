import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';

interface Props {
  trades: TradeEntry[];
}

export function AnalyticsTab({ trades }: Props) {
  return (
    <div className="space-y-6">
      {/* Slot: BySetupTable — Task 17 */}
      {/* Slot: BySymbolTable — Task 18 */}
      {/* Slot: ByMistakeTable — Task 19 */}
      {/* Slot: ByExitReasonChart — Task 20 */}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Analytics</h3>
        <p className="text-sm text-muted-foreground">
          {trades.length === 0 ? 'Log trades to see breakdowns by setup, symbol, mistake, and exit reason.' : `${trades.length} trades to analyze.`}
        </p>
      </Card>
    </div>
  );
}
