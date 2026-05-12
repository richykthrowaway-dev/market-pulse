import { TrendingUp, TrendingDown, Activity, Shield, BarChart2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/ui/StatsCard';
import type { PerformanceSummary } from '@/lib/performanceTypes';

interface PerformanceKpiGridProps {
  summary: PerformanceSummary | null;
  isLoading: boolean;
}

function fmt(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

export function PerformanceKpiGrid({ summary, isLoading }: PerformanceKpiGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      title: 'YTD Return',
      value: fmt(summary.ytdReturnPct),
      trend: summary.ytdVsBenchmarkPct,
      trendLabel: `vs ${summary.benchmarkLabel}`,
      valueClassName: summary.ytdReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: summary.ytdReturnPct >= 0 ? <TrendingUp /> : <TrendingDown />,
    },
    {
      title: '1Y Return',
      value: fmt(summary.oneYearReturnPct),
      trend: summary.oneYearVsBenchmarkPct,
      trendLabel: `vs ${summary.benchmarkLabel}`,
      valueClassName: summary.oneYearReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: summary.oneYearReturnPct >= 0 ? <TrendingUp /> : <TrendingDown />,
    },
    {
      title: 'Since Inception',
      value: fmt(summary.sinceInceptionReturnPct),
      description: 'Total return',
      valueClassName: summary.sinceInceptionReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
      icon: <Activity />,
    },
    {
      title: 'Volatility (1Y)',
      value: `${summary.volatility1YPct.toFixed(2)}%`,
      description: 'Annualized std dev',
      icon: <BarChart2 />,
    },
    {
      title: 'Sharpe (1Y)',
      value: summary.sharpe1Y.toFixed(2),
      description: summary.sharpe1Y >= 1 ? 'Good risk-adjusted return' : summary.sharpe1Y >= 0 ? 'Positive' : 'Below risk-free',
      valueClassName: summary.sharpe1Y >= 1 ? 'text-[hsl(var(--success))]' : summary.sharpe1Y < 0 ? 'text-[hsl(var(--danger))]' : undefined,
      icon: <Shield />,
    },
    {
      title: 'Max Drawdown',
      value: `${summary.maxDrawdownPct.toFixed(2)}%`,
      description: 'Peak to trough',
      valueClassName: 'text-[hsl(var(--danger))]',
      icon: <AlertTriangle />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(card => (
        <StatsCard
          key={card.title}
          title={card.title}
          value={card.value}
          description={card.description}
          trend={card.trend}
          trendLabel={card.trendLabel}
          valueClassName={card.valueClassName}
          icon={card.icon}
        />
      ))}
    </div>
  );
}
