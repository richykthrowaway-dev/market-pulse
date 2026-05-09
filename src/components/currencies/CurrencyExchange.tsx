
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, ArrowRightIcon, DollarSignIcon } from 'lucide-react';
import { CurrencyPair, formatDate } from '@/utils/stocksApi';
import { cn } from '@/lib/utils';
import { CurrencyIcon } from '@/components/ui/CurrencyIcon';

interface CurrencyExchangeProps {
  currencies: CurrencyPair[];
  className?: string;
}

export function CurrencyExchange({ currencies, className }: CurrencyExchangeProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center">
          <DollarSignIcon className="h-5 w-5 mr-2" />
          Currency Exchange
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {currencies.map((currency) => (
            <div 
              key={currency.symbol}
              className="flex items-center justify-between p-3 rounded-md bg-secondary/40"
            >
              <div className="flex items-center">
                <CurrencyIcon code={currency.fromCurrency} size={34} className="mr-3" />
                <span className="text-xs font-semibold text-foreground mr-1">{currency.fromCurrency}</span>
                <ArrowRightIcon className="h-4 w-4 mx-2 text-muted-foreground" />
                <CurrencyIcon code={currency.toCurrency} size={34} className="mr-3" />
                <span className="text-xs font-semibold text-foreground">{currency.toCurrency}</span>
              </div>
              
              <div className="text-right">
                <div className="font-medium">{currency.rate.toFixed(4)}</div>
                <div className={cn(
                  "flex items-center text-xs justify-end",
                  currency.change >= 0 ? "text-success" : "text-danger"
                )}>
                  {currency.change >= 0 ? 
                    <ArrowUpIcon className="h-3 w-3 mr-1" /> : 
                    <ArrowDownIcon className="h-3 w-3 mr-1" />
                  }
                  {currency.change.toFixed(4)} ({(currency.changePercent).toFixed(2)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-right mt-4 text-muted-foreground">
          Updated: {formatDate(new Date())}
        </div>
      </CardContent>
    </Card>
  );
}
