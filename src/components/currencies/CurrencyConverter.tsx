import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { CurrencyIcon } from '@/components/ui/CurrencyIcon';
import { cn } from '@/lib/utils';
import { CURRENCIES, type FxRate } from '@/hooks/useCurrencyRates';

interface CurrencyConverterProps {
  rates: Record<string, FxRate>;
  convert: (amount: number, from: string, to: string) => number | null;
  isLoading: boolean;
}

const CURRENCY_CODES = Object.keys(CURRENCIES);

export function CurrencyConverter({ rates, convert, isLoading }: CurrencyConverterProps) {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('1000');

  const numAmount = parseFloat(amount) || 0;

  const converted = useMemo(
    () => convert(numAmount, fromCurrency, toCurrency),
    [convert, numAmount, fromCurrency, toCurrency],
  );

  const rate = useMemo(
    () => convert(1, fromCurrency, toCurrency),
    [convert, fromCurrency, toCurrency],
  );

  const inverseRate = useMemo(
    () => convert(1, toCurrency, fromCurrency),
    [convert, toCurrency, fromCurrency],
  );

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const formatConverted = (val: number | null, currency: string) => {
    if (val == null) return '--';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(val);
    } catch {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowDownUp className="h-5 w-5 text-primary" />
          Currency Converter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
          {/* FROM */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
              <CurrencyIcon code={fromCurrency} size={28} />
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} - {CURRENCIES[code].name}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-2xl font-mono font-bold outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* SWAP BUTTON */}
          <div className="flex justify-center md:pb-4">
            <button
              onClick={handleSwap}
              className="rounded-full p-2.5 border border-border bg-muted hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 active:scale-95"
              title="Swap currencies"
            >
              <ArrowDownUp className="h-4 w-4 text-primary" />
            </button>
          </div>

          {/* TO */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
              <CurrencyIcon code={toCurrency} size={28} />
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} - {CURRENCIES[code].name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full rounded-lg border border-border bg-muted/50 px-3 py-3 text-2xl font-mono font-bold min-h-[52px] flex items-center">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <span className={cn(converted != null ? 'text-foreground' : 'text-muted-foreground')}>
                  {formatConverted(converted, toCurrency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rate info */}
        {rate != null && inverseRate != null && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
            <span>1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}</span>
            <span className="text-border">|</span>
            <span>1 {toCurrency} = {inverseRate.toFixed(4)} {fromCurrency}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
