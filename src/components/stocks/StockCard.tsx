
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon, WifiOff } from 'lucide-react';
import { Stock, formatCurrency, formatPercentage, formatNumber, formatDate } from '@/utils/stocksApi';
import { Sparkline } from '@/components/ui/sparkline';
import { StockLogo } from '@/components/stocks/StockLogo';
import { SectorBadge } from '@/components/ui/SectorBadge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface StockCardProps {
  stock: Stock;
  priceHistory?: number[];
  className?: string;
  onClick?: () => void;
  /** Exchange code — passed to StockLogo for non-US logo resolution. */
  exchange?: string;
  /** Explicit logo URL (e.g. from Finnhub profile). */
  logoUrl?: string;
  /** ISO 4217 currency code for formatting (e.g. 'CAD'). Defaults to 'USD'. */
  currency?: string;
  /** When false, shows a subtle indicator that live quote data is unavailable. */
  liveQuoteAvailable?: boolean;
  /** GICS sector for color-coded badge display. */
  sector?: string | null;
  /** Compact mode — tighter layout to fit more cards in a scrollable panel. */
  compact?: boolean;
}

export function StockCard({ stock, priceHistory, className, onClick, exchange, logoUrl, currency = 'USD', liveQuoteAvailable = true, sector, compact = false }: StockCardProps) {
  const isPositive = stock.change >= 0;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-md bg-card",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className={cn("flex flex-row items-center justify-between", compact ? "pb-1 pt-3 px-3" : "pb-2")}>
        <div className="flex items-center gap-2">
          <StockLogo ticker={stock.symbol} name={stock.name} size={compact ? "sm" : "md"} exchange={exchange} logoUrl={logoUrl} />
          <div className="space-y-0.5">
            <CardTitle className={cn("font-semibold leading-none", compact ? "text-sm" : "text-base")}>{stock.symbol}</CardTitle>
            <div className="flex items-center gap-1.5">
              <p className={cn("text-muted-foreground truncate", compact ? "text-[11px] max-w-[90px]" : "text-xs max-w-[120px]")}>{stock.name}</p>
              {sector && <SectorBadge sector={sector} size="xs" showTooltip={false} />}
            </div>
          </div>
          {!liveQuoteAvailable && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    <span>Delayed</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  Live quote unavailable due to API limits. Showing last known data.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? "px-3 pb-3 pt-1" : undefined}>
        <div className="grid grid-cols-2 gap-4">
          <div className={cn("space-y-1", compact ? "" : "space-y-2")}>
            <div className={cn("font-bold", compact ? "text-lg" : "text-2xl")}>{formatCurrency(stock.price, currency)}</div>
            <div className="flex items-center text-xs">
              <span className={cn(
                "inline-flex items-center",
                isPositive ? "text-success" : "text-danger"
              )}>
                {isPositive ?
                  <ArrowUpIcon className="h-3 w-3 mr-1" /> :
                  <ArrowDownIcon className="h-3 w-3 mr-1" />
                }
                {formatCurrency(Math.abs(stock.change), currency)} ({formatPercentage(stock.changePercent)})
              </span>
            </div>
            <div className={cn("grid grid-cols-2 gap-1", compact ? "text-[10px]" : "text-xs")}>
              <div className="text-muted-foreground">Volume:</div>
              <div className="text-right">{formatNumber(stock.volume, currency)}</div>
              <div className="text-muted-foreground">Mkt Cap:</div>
              <div className="text-right">{stock.marketCap > 0 ? formatNumber(stock.marketCap, currency) : 'N/A'}</div>
              {!compact && (
                <>
                  <div className="text-muted-foreground">Updated:</div>
                  <div className="text-right">{formatDate(stock.lastUpdated)}</div>
                </>
              )}
            </div>
          </div>
          <div className={compact ? "h-14" : "h-24"}>
            {priceHistory && priceHistory.length > 0 && (
              <Sparkline
                data={priceHistory}
                height={compact ? 56 : 96}
                highlightIndex={priceHistory.length - 1}
                ariaLabel={`${stock.symbol} price trend`}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
