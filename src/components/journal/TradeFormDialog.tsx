import React, { useEffect } from 'react';
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
import type { TradeEntry, TradeSide } from '@/hooks/useTradeJournal';

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
    },
  });

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
      });
    } else if (open) {
      reset({
        symbol: '', side: 'long', quantity: '' as any, entryPrice: '' as any,
        exitPrice: '' as any, entryDate: '', exitDate: '', fees: 0, notes: '', tags: '',
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
    });
    onOpenChange(false);
  };

  const sideValue = watch('side');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" placeholder="swing, earnings, breakout" {...register('tags')} />
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
