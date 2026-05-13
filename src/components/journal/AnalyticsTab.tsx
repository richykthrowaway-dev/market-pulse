import { TradeEntry } from '@/hooks/useTradeJournal';
import { BySetupTable } from './BySetupTable';
import { BySymbolTable } from './BySymbolTable';
import { ByMistakeTable } from './ByMistakeTable';
import { ByExitReasonChart } from './ByExitReasonChart';

interface Props {
  trades: TradeEntry[];
}

export function AnalyticsTab({ trades }: Props) {
  return (
    <div className="space-y-6">
      <BySetupTable trades={trades} />
      <BySymbolTable trades={trades} />
      <ByMistakeTable trades={trades} />
      <ByExitReasonChart trades={trades} />
    </div>
  );
}
