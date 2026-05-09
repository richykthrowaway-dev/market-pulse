import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { CurrencyConverter } from '@/components/currencies/CurrencyConverter';
import { TradingViewForexRates, TradingViewForexHeatmap } from '@/components/tradingview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyIcon } from '@/components/ui/CurrencyIcon';
import { ArrowUpIcon, ArrowDownIcon, ArrowRightIcon, TrendingUp, Loader2, Globe, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyRates, POPULAR_PAIRS, CURRENCIES } from '@/hooks/useCurrencyRates';

const Currencies = () => {
  const { rates, convert, getRate, isLoading, isError, timestamp } = useCurrencyRates();

  const hasRates = Object.keys(rates).length > 1; // more than just USD

  return (
    <PageLayout title="Currency Exchange">
      <div className="space-y-6">

        {/* Popular Pairs Grid */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Live Exchange Rates
              </CardTitle>
              {timestamp && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Updated {new Date(timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading live rates...</span>
              </div>
            ) : isError || !hasRates ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-sm text-muted-foreground">Unable to load rates. Try refreshing.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {POPULAR_PAIRS.map(({ from, to }) => {
                  const rateData = rates[from === 'USD' ? to : from];
                  if (!rateData) return null;

                  const displayRate = getRate(from, to);
                  const isPositive = rateData.changePct >= 0;

                  return (
                    <div
                      key={`${from}${to}`}
                      className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
                    >
                      {/* Pair header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center -space-x-1">
                          <CurrencyIcon code={from} size={24} />
                          <CurrencyIcon code={to} size={24} />
                        </div>
                        <span className="text-sm font-semibold">{from}/{to}</span>
                      </div>

                      {/* Rate */}
                      <div className="text-xl font-bold font-mono">
                        {displayRate != null ? displayRate.toFixed(4) : '--'}
                      </div>

                      {/* Change */}
                      <div className={cn(
                        'flex items-center gap-1 text-xs font-mono mt-1',
                        isPositive ? 'text-emerald-500' : 'text-red-500',
                      )}>
                        {isPositive
                          ? <ArrowUpIcon className="h-3 w-3" />
                          : <ArrowDownIcon className="h-3 w-3" />
                        }
                        <span>{rateData.change >= 0 ? '+' : ''}{rateData.change.toFixed(4)}</span>
                        <span>({rateData.changePct >= 0 ? '+' : ''}{rateData.changePct.toFixed(2)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Currency Converter */}
        <CurrencyConverter
          rates={rates}
          convert={convert}
          isLoading={isLoading}
        />

        {/* TradingView Forex Cross Rates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" />
              Forex Cross Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-lg">
            <TradingViewForexRates
              height={420}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* TradingView Forex Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-primary" />
              Forex Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-lg">
            <TradingViewForexHeatmap
              height={500}
              className="w-full"
            />
          </CardContent>
        </Card>

      </div>
    </PageLayout>
  );
};

export default Currencies;
