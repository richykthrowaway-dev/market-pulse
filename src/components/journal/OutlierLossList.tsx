import { Flame } from 'lucide-react';
import { OutlierLossEntry } from './computeInsights';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { Card } from '@/components/ui/card';

export function OutlierLossList({ outliers, onClick }: { outliers: OutlierLossEntry[]; onClick?: (id: string) => void }) {
  if (!outliers.length) return null;
  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Flame className="h-4 w-4 text-destructive" /> Trades to review
      </h4>
      <ul className="space-y-1.5">
        {outliers.map(o => (
          <li key={o.tradeId}>
            <button
              type="button"
              onClick={() => onClick?.(o.tradeId)}
              disabled={!onClick}
              className="w-full text-left text-sm hover:bg-muted rounded p-1.5 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="text-muted-foreground">{o.date}</span> · <strong>{o.symbol}</strong>: <span className="text-destructive">{fmtDollar(o.loss)}</span> <span className="text-xs text-muted-foreground">({o.multiplier.toFixed(1)}× your median loss)</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
