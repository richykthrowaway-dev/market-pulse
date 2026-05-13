import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TradeEntry, TradeSide, ExitReason } from '@/hooks/useTradeJournal';
import { useJournalSettings } from '@/hooks/useJournalSettings';
import { SetupCombobox } from './SetupCombobox';
import { MistakeMultiSelect } from './MistakeMultiSelect';
import { ScreenshotPaster } from './ScreenshotPaster';

// Empty strings from <input type="number"> should become undefined for optional numeric fields.
const optionalPositiveNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.number().positive().optional(),
);

const schema = z.object({
  symbol: z.string().min(1, 'Required').transform(v => v.toUpperCase()),
  side: z.enum(['long', 'short']),
  quantity: z.coerce.number().positive('Must be > 0'),
  entryPrice: z.coerce.number().positive('Must be > 0'),
  exitPrice: z.coerce.number().positive('Must be > 0'),
  entryDate: z.string().min(1, 'Required'),
  exitDate: z.string().min(1, 'Required'),
  fees: z.coerce.number().min(0).default(0),
  notes: z.string().default(''),
  tags: z.string().default(''),
  // NEW — Wave 1
  stopLoss: optionalPositiveNumber,
  target: optionalPositiveNumber,
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  setup: z.string().optional(),
  mistakes: z.array(z.string()).default([]),
  exitReason: z.enum(['target', 'stop', 'time', 'discretion', 'panic']).optional(),
  inPlaybook: z.boolean().default(true),
  screenshot: z.string().optional(),
});

type FormValues = z.input<typeof schema>;

interface TradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (trade: Omit<TradeEntry, 'id' | 'createdAt'>) => void;
  initialValues?: TradeEntry | null;
  mode: 'add' | 'edit';
}

export function TradeFormDialog({ open, onOpenChange, onSubmit, initialValues, mode }: TradeFormDialogProps) {
  const { settings } = useJournalSettings();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symbol: '',
      side: 'long',
      quantity: '' as any,
      entryPrice: '' as any,
      exitPrice: '' as any,
      entryDate: '',
      exitDate: '',
      fees: 0,
      notes: '',
      tags: '',
      stopLoss: '' as any,
      target: '' as any,
      entryTime: '',
      exitTime: '',
      setup: undefined,
      mistakes: [],
      exitReason: undefined,
      inPlaybook: true,
      screenshot: undefined,
    },
  });

  // Pre-allocate UUID for new trades so the screenshot can be keyed before save.
  // In edit mode, use the existing trade id.
  const tradeId = useMemo(
    () => initialValues?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialValues?.id, open],
  );

  useEffect(() => {
    if (open && initialValues) {
      reset({
        symbol: initialValues.symbol,
        side: initialValues.side,
        quantity: initialValues.quantity,
        entryPrice: initialValues.entryPrice,
        exitPrice: initialValues.exitPrice,
        entryDate: initialValues.entryDate,
        exitDate: initialValues.exitDate,
        fees: initialValues.fees,
        notes: initialValues.notes,
        tags: initialValues.tags.join(', '),
        stopLoss: (initialValues.stopLoss ?? '') as any,
        target: (initialValues.target ?? '') as any,
        entryTime: initialValues.entryTime ?? '',
        exitTime: initialValues.exitTime ?? '',
        setup: initialValues.setup,
        mistakes: initialValues.mistakes ?? [],
        exitReason: initialValues.exitReason,
        inPlaybook: initialValues.inPlaybook ?? true,
        screenshot: initialValues.screenshot,
      });
    } else if (open) {
      reset({
        symbol: '', side: 'long', quantity: '' as any, entryPrice: '' as any,
        exitPrice: '' as any, entryDate: '', exitDate: '', fees: 0, notes: '', tags: '',
        stopLoss: '' as any, target: '' as any, entryTime: '', exitTime: '',
        setup: undefined, mistakes: [], exitReason: undefined, inPlaybook: true, screenshot: undefined,
      });
    }
  }, [open, initialValues, reset]);

  const onFormSubmit = (data: FormValues) => {
    const parsed = schema.parse(data);
    onSubmit({
      symbol: parsed.symbol,
      side: parsed.side as TradeSide,
      quantity: parsed.quantity,
      entryPrice: parsed.entryPrice,
      exitPrice: parsed.exitPrice,
      entryDate: parsed.entryDate,
      exitDate: parsed.exitDate,
      fees: parsed.fees,
      notes: parsed.notes,
      tags: parsed.tags ? parsed.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      stopLoss: parsed.stopLoss,
      target: parsed.target,
      entryTime: parsed.entryTime || undefined,
      exitTime: parsed.exitTime || undefined,
      setup: parsed.setup || undefined,
      mistakes: parsed.mistakes,
      exitReason: parsed.exitReason,
      inPlaybook: parsed.inPlaybook,
      screenshot: parsed.screenshot,
    });
    onOpenChange(false);
  };

  const sideValue = watch('side');
  const slWatch = watch('stopLoss');
  const epWatch = watch('entryPrice');
  const qtyWatch = watch('quantity');

  // Live risk computation (non-hook, safe in render body since settings is from top-level hook)
  let riskNode: React.ReactNode = null;
  const slNum = Number(slWatch);
  const epNum = Number(epWatch);
  const qNum = Number(qtyWatch);
  if (slWatch !== '' && slWatch !== undefined && epWatch !== '' && epWatch !== undefined && qtyWatch !== '' && qtyWatch !== undefined && !isNaN(slNum) && !isNaN(epNum) && !isNaN(qNum) && slNum > 0 && epNum > 0 && qNum > 0) {
    const risk = Math.abs(epNum - slNum) * qNum;
    const pct = settings.accountSize ? (risk / settings.accountSize) * 100 : null;
    riskNode = (
      <p className="text-xs text-muted-foreground">
        Risk: ${risk.toFixed(2)}{pct !== null ? ` (${pct.toFixed(2)}% of account)` : ''}
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Trade' : 'Log Trade'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" placeholder="AAPL" {...register('symbol')} className="uppercase" />
              {errors.symbol && <p className="text-xs text-destructive mt-0.5">{errors.symbol.message}</p>}
            </div>
            <div>
              <Label htmlFor="side">Side</Label>
              <Select
                value={sideValue}
                onValueChange={(v) => setValue('side', v as TradeSide)}
              >
                <SelectTrigger id="side">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" step="any" placeholder="100" {...register('quantity')} />
              {errors.quantity && <p className="text-xs text-destructive mt-0.5">{errors.quantity.message}</p>}
            </div>
            <div>
              <Label htmlFor="fees">Fees ($)</Label>
              <Input id="fees" type="number" step="0.01" placeholder="0" {...register('fees')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input id="entryPrice" type="number" step="any" placeholder="150.00" {...register('entryPrice')} />
              {errors.entryPrice && <p className="text-xs text-destructive mt-0.5">{errors.entryPrice.message}</p>}
            </div>
            <div>
              <Label htmlFor="exitPrice">Exit Price</Label>
              <Input id="exitPrice" type="number" step="any" placeholder="155.00" {...register('exitPrice')} />
              {errors.exitPrice && <p className="text-xs text-destructive mt-0.5">{errors.exitPrice.message}</p>}
            </div>
          </div>

          {/* Risk section */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stopLoss">Stop Loss (optional)</Label>
                <Input id="stopLoss" type="number" step="any" placeholder="e.g. 145" {...register('stopLoss')} />
              </div>
              <div>
                <Label htmlFor="target">Target (optional)</Label>
                <Input id="target" type="number" step="any" placeholder="e.g. 160" {...register('target')} />
              </div>
            </div>
            {riskNode}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entryDate">Entry Date</Label>
              <Input id="entryDate" type="date" {...register('entryDate')} />
              {errors.entryDate && <p className="text-xs text-destructive mt-0.5">{errors.entryDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="exitDate">Exit Date</Label>
              <Input id="exitDate" type="date" {...register('exitDate')} />
              {errors.exitDate && <p className="text-xs text-destructive mt-0.5">{errors.exitDate.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="setup">Setup</Label>
            <SetupCombobox
              value={watch('setup')}
              onChange={v => setValue('setup', v)}
            />
          </div>

          <div>
            <Label>Mistakes</Label>
            <MistakeMultiSelect
              values={watch('mistakes') ?? []}
              onChange={v => setValue('mistakes', v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exitReason">Exit Reason</Label>
              <Select
                value={watch('exitReason') ?? ''}
                onValueChange={v => setValue('exitReason', (v || undefined) as ExitReason | undefined)}
              >
                <SelectTrigger id="exitReason"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="target">Hit target</SelectItem>
                  <SelectItem value="stop">Stopped out</SelectItem>
                  <SelectItem value="time">Time stop</SelectItem>
                  <SelectItem value="discretion">Discretionary</SelectItem>
                  <SelectItem value="panic">Panic exit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="inPlaybook" className="cursor-pointer text-sm">In playbook?</Label>
              <input
                id="inPlaybook"
                type="checkbox"
                checked={watch('inPlaybook') ?? true}
                onChange={e => setValue('inPlaybook', e.target.checked)}
                className="h-4 w-4"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entryTime">Entry Time (optional)</Label>
              <Input id="entryTime" type="time" {...register('entryTime')} />
            </div>
            <div>
              <Label htmlFor="exitTime">Exit Time (optional)</Label>
              <Input id="exitTime" type="time" {...register('exitTime')} />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" placeholder="swing, earnings, breakout" {...register('tags')} />
          </div>

          <div>
            <Label>Screenshot (optional)</Label>
            <ScreenshotPaster
              tradeId={tradeId}
              screenshotKey={watch('screenshot')}
              onChange={v => setValue('screenshot', v)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Trade rationale, lessons learned..." rows={3} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{mode === 'edit' ? 'Save Changes' : 'Log Trade'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
