
import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  className?: string;
  valueClassName?: string;
  onClick?: () => void;
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  className,
  valueClassName,
  onClick,
}: StatsCardProps) {
  const formattedTrend = trend !== undefined ? (trend > 0 ? `+${trend.toFixed(2)}%` : `${trend.toFixed(2)}%`) : null;
  const isTrendPositive = trend !== undefined ? trend > 0 : null;
  
  return (
    <Card 
      className={cn(
        "transition-all duration-300 hover:shadow-md overflow-hidden",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-1 pb-0.5 pt-2 px-2.5 space-y-0">
        <CardTitle className="text-[10px] font-medium text-muted-foreground truncate min-w-0">{title}</CardTitle>
        {icon && <div className="h-3 w-3 text-muted-foreground shrink-0">{icon}</div>}
      </CardHeader>
      <CardContent className="px-2.5 pb-2 pt-0 min-w-0">
        <div className="text-base font-bold tracking-tight truncate leading-tight">
          <span className={valueClassName}>{value}</span>
        </div>

        {(description || trend !== undefined) && (
          <div className="flex items-center text-[10px] mt-0.5 min-w-0">
            {trend !== undefined && (
              <span className={cn(
                "inline-flex items-center mr-1 shrink-0",
                isTrendPositive ? "text-success" : "text-danger"
              )}>
                {isTrendPositive ? <ArrowUpIcon className="h-2 w-2 mr-0.5" /> : <ArrowDownIcon className="h-2 w-2 mr-0.5" />}
                {formattedTrend}
              </span>
            )}
            {trendLabel && <span className="text-muted-foreground ml-1 truncate">{trendLabel}</span>}
            {description && (
              <p className={cn("text-muted-foreground truncate", trend !== undefined ? "ml-1" : "")}>
                {description}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
