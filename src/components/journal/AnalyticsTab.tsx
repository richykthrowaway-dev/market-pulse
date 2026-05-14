import { TradeEntry } from '@/hooks/useTradeJournal';
import { EdgeQualityRow } from './EdgeQualityRow';
import { TradeAnatomyCards } from './TradeAnatomyCards';
import { BehavioralCard } from './BehavioralCard';
import { FeeImpactCard } from './FeeImpactCard';
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
      {/* ── Edge quality top row — the “is my strategy real?” metrics ───── */}
      <EdgeQualityRow trades={trades} />

      {/* ── Trade anatomy: typical winner vs typical loser ──────────────── */}
      <TradeAnatomyCards trades={trades} />

      {/* ── Behavioural & cost: compliance + fees, side-by-side ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BehavioralCard trades={trades} />
        <FeeImpactCard trades={trades} />
      </div>

      {/* ── Existing breakdowns ─────────────────────────────────────────── */}
      <BySetupTable trades={trades} />
      <BySymbolTable trades={trades} />
      <ByMistakeTable trades={trades} />
      <ByExitReasonChart trades={trades} />
    </div>
  );
}
