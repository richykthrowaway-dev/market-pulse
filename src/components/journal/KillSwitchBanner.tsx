import { TradeEntry, computePnL } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { AlertTriangle, Ban } from 'lucide-react';

export function KillSwitchBanner({ trades, settings }: { trades: TradeEntry[]; settings: JournalSettings }) {
  if (!settings.goals.dailyMaxLoss) return null;
  const today = new Date().toISOString().slice(0, 10);
  const todayPnL = trades.filter(t => t.exitDate === today).reduce((s, t) => s + computePnL(t), 0);
  if (todayPnL >= 0) return null;

  const max = settings.goals.dailyMaxLoss;
  const ratio = Math.abs(todayPnL) / max;

  if (ratio >= 1) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 flex items-start gap-3">
        <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">Daily max loss hit</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's loss: {fmtDollar(todayPnL)} reached your limit of {fmtDollar(-max)}. Step away from the screen.
          </p>
        </div>
      </div>
    );
  }

  if (ratio >= 0.8) {
    return (
      <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-500">Approaching daily max loss</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's loss: {fmtDollar(todayPnL)} of {fmtDollar(-max)} limit ({(ratio * 100).toFixed(0)}%). Consider stopping.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// Pure helper exported for the Log Trade interceptor in TradeJournal.tsx
export function isDailyMaxLossHit(trades: TradeEntry[], settings: JournalSettings): boolean {
  if (!settings.goals.dailyMaxLoss) return false;
  const today = new Date().toISOString().slice(0, 10);
  const todayPnL = trades.filter(t => t.exitDate === today).reduce((s, t) => s + computePnL(t), 0);
  return todayPnL <= -settings.goals.dailyMaxLoss;
}
