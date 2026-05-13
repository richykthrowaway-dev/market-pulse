import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TradeEntry } from '@/hooks/useTradeJournal';
import { useStatement } from '@/contexts/StatementContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTrades: TradeEntry[];
  onImport: (drafts: Omit<TradeEntry, 'id' | 'createdAt'>[]) => void;
}

export function IbkrImportDialog({ open, onOpenChange, existingTrades, onImport }: Props) {
  const { parsedStatement } = useStatement();

  const existingKeys = useMemo(() => new Set(
    existingTrades.map(t => `${t.symbol}|${t.entryDate}|${t.exitDate}|${t.quantity}`)
  ), [existingTrades]);

  const drafts = useMemo(() => {
    if (!parsedStatement) return [];
    const closings = parsedStatement.trades.filter(t =>
      t.assetCategory === 'STK' &&
      (t.realizedPL !== 0 || (t.codes ?? '').includes('C'))
    );
    return closings
      .map(t => {
        const qty = Math.abs(t.quantity);
        if (qty === 0) return null;
        const entryPrice = Math.abs(t.costBasis / t.quantity);
        const exitDate = t.dateTime.slice(0, 10);
        return {
          symbol: t.symbol,
          side: 'long' as const,
          quantity: qty,
          entryPrice: Number(entryPrice.toFixed(4)),
          exitPrice: Number(t.tradePrice.toFixed(4)),
          entryDate: exitDate,
          exitDate,
          fees: Math.abs(t.commission),
          notes: '',
          tags: ['Imported'],
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .filter(d => !existingKeys.has(`${d.symbol}|${d.entryDate}|${d.exitDate}|${d.quantity}`));
  }, [parsedStatement, existingKeys]);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(drafts.map((_, i) => i)));
  }, [open, drafts]);

  function toggle(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  }

  function handleImport() {
    const chosen = drafts.filter((_, i) => selected.has(i));
    onImport(chosen);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from IBKR statement</DialogTitle>
        </DialogHeader>

        {!parsedStatement ? (
          <p className="text-sm text-muted-foreground">
            No IBKR statement loaded. Upload one on the Portfolio page first, then come back here.
          </p>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No new trades detected. All closed positions in the current statement are already in your journal, or the statement contains no closing trades.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {drafts.length} new trade{drafts.length !== 1 ? 's' : ''} detected. {selected.size} selected for import.
              <br />
              <span className="text-xs">
                Note: entry date is approximated from the closing date since IBKR statements don't directly link opening + closing fills. Imported trades are tagged "Imported" and can be edited.
              </span>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th></th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Entry $</th>
                  <th>Exit $</th>
                  <th>Date</th>
                  <th>Fees</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td><Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} /></td>
                    <td className="py-1 font-mono font-medium">{d.symbol}</td>
                    <td>{d.side}</td>
                    <td>{d.quantity}</td>
                    <td>${d.entryPrice.toFixed(2)}</td>
                    <td>${d.exitPrice.toFixed(2)}</td>
                    <td className="text-xs text-muted-foreground">{d.exitDate}</td>
                    <td className="text-xs text-muted-foreground">${d.fees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={drafts.length === 0 || selected.size === 0}
            onClick={handleImport}
          >
            Import {selected.size} trade{selected.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
