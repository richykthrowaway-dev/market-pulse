import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TradeEntry } from '@/hooks/useTradeJournal';
import { computePnL } from '@/hooks/useTradeJournal';

interface DayDetailDialogProps {
  date: string | null;
  trades: TradeEntry[];
  onClose: () => void;
  onEdit: (trade: TradeEntry) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function DayDetailDialog({ date, trades, onClose, onEdit }: DayDetailDialogProps) {
  if (!date) return null;

  const totalPnL = trades.reduce((acc, t) => acc + computePnL(t), 0);

  return (
    <Dialog open={!!date} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trades on {formatDate(date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {trades.map(t => {
            const pnl = computePnL(t);
            return (
              <div key={t.id} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.symbol}</span>
                    <Badge variant={t.side === 'long' ? 'default' : 'destructive'} className="text-[10px]">
                      {t.side.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('font-mono font-bold text-sm', pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>{t.quantity} shares</span>
                  <span>Entry: ${t.entryPrice.toFixed(2)}</span>
                  <span>Exit: ${t.exitPrice.toFixed(2)}</span>
                  {t.fees > 0 && <span>Fees: ${t.fees.toFixed(2)}</span>}
                </div>
                {t.notes && (
                  <p className="text-xs text-muted-foreground/80 italic mt-1">{t.notes}</p>
                )}
              </div>
            );
          })}
        </div>
        {trades.length > 1 && (
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Day Total</span>
            <span className={cn('font-mono font-bold', totalPnL >= 0 ? 'text-green-500' : 'text-red-500')}>
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
