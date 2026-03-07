import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TradeEntry } from '@/hooks/useTradeJournal';
import { computePnL } from '@/hooks/useTradeJournal';

type SortField = 'exitDate' | 'symbol' | 'pnl' | 'side';

interface TradeLogTableProps {
  trades: TradeEntry[];
  onEdit: (trade: TradeEntry) => void;
  onDelete: (id: string) => void;
}

function fmtCurrency(v: number) {
  const s = Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return v < 0 ? `-${s}` : `+${s}`;
}

export function TradeLogTable({ trades, onEdit, onDelete }: TradeLogTableProps) {
  const [sortField, setSortField] = useState<SortField>('exitDate');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...trades];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'exitDate': cmp = a.exitDate.localeCompare(b.exitDate); break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'pnl': cmp = computePnL(a) - computePnL(b); break;
        case 'side': cmp = a.side.localeCompare(b.side); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [trades, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <p className="text-sm">No trades logged yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('exitDate')}>
              <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('symbol')}>
              <span className="flex items-center gap-1">Symbol <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('side')}>
              <span className="flex items-center gap-1">Side <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Entry</TableHead>
            <TableHead className="text-right">Exit</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('pnl')}>
              <span className="flex items-center gap-1 justify-end">P/L <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(t => {
            const pnl = computePnL(t);
            return (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.exitDate}</TableCell>
                <TableCell className="font-semibold">{t.symbol}</TableCell>
                <TableCell>
                  <Badge variant={t.side === 'long' ? 'default' : 'destructive'} className="text-[10px]">
                    {t.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                <TableCell className="text-right font-mono">${t.entryPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">${t.exitPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">${t.fees.toFixed(2)}</TableCell>
                <TableCell className={cn('text-right font-mono font-semibold', pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {fmtCurrency(pnl)}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground" title={t.notes}>
                  {t.notes || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      if (confirm(`Delete ${t.symbol} trade?`)) onDelete(t.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
