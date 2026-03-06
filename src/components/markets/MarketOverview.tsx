
import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, GlobeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Flag } from '@/components/ui/Flag';
import { MarketIndex, formatPercentage } from '@/utils/stocksApi';

interface MarketOverviewProps {
  indices: MarketIndex[];
  className?: string;
}

function CompactIndexCard({ index }: { index: MarketIndex }) {
  const isPositive = index.changePercent >= 0;
  return (
    <div className="group relative bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-1.5 min-w-0 transition-colors hover:bg-accent/30">
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[3px] rounded-t-lg transition-opacity",
          isPositive ? "bg-success" : "bg-danger",
          "opacity-60 group-hover:opacity-100"
        )}
      />
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <Flag code={index.region} size={24} className="shrink-0" />
          <span className="font-semibold text-sm truncate">{index.name}</span>
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
          {index.symbol}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold leading-tight">
          {index.value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 font-mono text-xs font-medium shrink-0",
            isPositive ? "text-success" : "text-danger"
          )}
        >
          {isPositive ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
          {formatPercentage(index.changePercent)}
        </span>
      </div>
    </div>
  );
}

export function MarketOverview({ indices, className }: MarketOverviewProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <GlobeIcon className="h-4 w-4 text-primary" />
        Global Markets
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {indices.map((index) => (
          <CompactIndexCard key={index.symbol} index={index} />
        ))}
      </div>
    </div>
  );
}
