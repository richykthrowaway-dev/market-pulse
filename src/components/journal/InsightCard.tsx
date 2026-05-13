import { Lightbulb, Brain } from 'lucide-react';
import { DayOfWeekInsight, AfterLossInsight } from './computeInsights';

export function InsightCard({ insight }: { insight: DayOfWeekInsight | AfterLossInsight }) {
  if (insight.kind === 'dayOfWeek') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p>You win <strong>{insight.bestWinRate.toFixed(0)}%</strong> of trades on <strong>{insight.bestDay}s</strong> vs <strong>{insight.worstWinRate.toFixed(0)}%</strong> on <strong>{insight.worstDay}s</strong>.</p>
          <p className="text-muted-foreground mt-1">Worst day: {insight.worstDay} ({insight.worstTradeCount} trades, ${insight.worstPnL.toFixed(0)} P&L). Consider sitting out {insight.worstDay}s.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4 flex items-start gap-3">
      <Brain className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p>After a loss, your win rate drops to <strong>{insight.afterLossWinRate.toFixed(0)}%</strong> (vs <strong>{insight.afterWinWinRate.toFixed(0)}%</strong> after a win).</p>
        <p className="text-muted-foreground mt-1">Consider a 1-trade cooldown after losses.</p>
      </div>
    </div>
  );
}
