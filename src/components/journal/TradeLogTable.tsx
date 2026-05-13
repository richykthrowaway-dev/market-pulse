import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, ArrowUpDown, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TradeEntry } from '@/hooks/useTradeJournal';
import { computePnL, computeR } from '@/hooks/useTradeJournal';
import { useJournalSettings } from '@/hooks/useJournalSettings';

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

  const [setupFilter, setSetupFilter] = useState<string | 'all'>('all');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [offScriptOnly, setOffScriptOnly] = useState(false);

  const { settings } = useJournalSettings();

  const filtered = useMemo(() => trades.filter(t => {
    if (setupFilter !== 'all' && (t.setup ?? '') !== setupFilter) return false;
    if (symbolQuery && !t.symbol.toLowerCase().includes(symbolQuery.toLowerCase())) return false;
    if (sideFilter !== 'all' && t.side !== sideFilter) return false;
    if (offScriptOnly && t.inPlaybook !== false) return false;
    return true;
  }), [trades, setupFilter, symbolQuery, sideFilter, offScriptOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
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
  }, [filtered, sortField, sortAsc]);

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

  const filterRow = (
    <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
      <Input
        placeholder="Search symbol…"
        value={symbolQuery}
        onChange={e => setSymbolQuery(e.target.value)}
        className="w-40 h-8"
      />
      <Select value={setupFilter} onValueChange={v => setSetupFilter(v)}>
        <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Setup" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All setups</SelectItem>
          {settings.setups.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sideFilter} onValueChange={v => setSideFilter(v as any)}>
        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sides</SelectItem>
          <SelectItem value="long">Long</SelectItem>
          <SelectItem value="short">Short</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={offScriptOnly} onChange={e => setOffScriptOnly(e.target.checked)} />
        Off-script only
      </label>
    </div>
  );

  if (filtered.length === 0) {
    return (
      <div>
        {filterRow}
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <p className="text-sm">No trades match the current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {filterRow}
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
              <TableHead className="text-right">R</TableHead>
              <TableHead>Setup</TableHead>
              <TableHead>Mistakes</TableHead>
              <TableHead className="text-center">
                <Camera className="h-3.5 w-3.5 inline-block" />
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
                  <TableCell className="text-right font-mono text-xs">
                    {(() => {
                      const r = computeR(t);
                      if (r === null) return <span className="text-muted-foreground">—</span>;
                      return <span className={cn('font-semibold', r >= 0 ? 'text-green-500' : 'text-red-500')}>
                        {r >= 0 ? '+' : ''}{r.toFixed(1)}R
                      </span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.setup ? <Badge variant="outline" className="text-[10px]">{t.setup}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {t.mistakes?.length ? (
                      <span className="inline-flex items-center gap-0.5" title={t.mistakes.join(', ')}>
                        {t.mistakes.slice(0, 3).map(m => <span key={m} className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />)}
                        {t.mistakes.length > 3 && <span className="text-[10px] text-muted-foreground ml-0.5">+{t.mistakes.length - 3}</span>}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.screenshot ? <Camera className="h-3.5 w-3.5 text-muted-foreground inline-block" /> : null}
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
    </div>
  );
}
