import { BarChart2, TrendingUp, Flame, Users, Percent } from 'lucide-react';
import { useEodhdMacro } from '@/hooks/useEodhdMacro';
import { cn } from '@/lib/utils';

interface MacroSnapshot {
  gdpGrowth:    { value: number | null; date: string | null };
  inflation:    { value: number | null; date: string | null };
  unemployment: { value: number | null; date: string | null };
  interestRate: { value: number | null; date: string | null };
}

interface MetricCardProps {
  label: string;
  value: number | null;
  date: string | null;
  icon: React.ReactNode;
}

function valueColor(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

function formatYear(date: string | null): string | null {
  if (!date) return null;
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : date;
}

function MetricCard({ label, value, date, icon }: MetricCardProps) {
  const displayValue = value !== null ? `${value.toFixed(1)}%` : '--';
  const year = formatYear(date);

  return (
    <div className="bg-muted/40 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <span className={cn('text-lg font-bold leading-tight', valueColor(value))}>
        {displayValue}
      </span>
      {year && (
        <span className="text-[11px] text-muted-foreground leading-none">{year}</span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-muted/40 rounded-lg p-3 flex flex-col gap-2 animate-pulse">
      <div className="h-3 w-2/3 bg-muted rounded" />
      <div className="h-5 w-1/2 bg-muted rounded" />
      <div className="h-2.5 w-1/3 bg-muted rounded" />
    </div>
  );
}

interface MacroSnapshotProps {
  iso2: string;
}

export function MacroSnapshot({ iso2 }: MacroSnapshotProps) {
  const { data, isLoading } = useEodhdMacro(iso2);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <SectionHeader />
        <div className="grid grid-cols-2 gap-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { gdpGrowth, inflation, unemployment, interestRate } = data;
  const allNull =
    gdpGrowth.value === null &&
    inflation.value === null &&
    unemployment.value === null &&
    interestRate.value === null;

  if (allNull) return null;

  return (
    <div className="space-y-2">
      <SectionHeader />
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="GDP Growth"
          value={gdpGrowth.value}
          date={gdpGrowth.date}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Inflation"
          value={inflation.value}
          date={inflation.date}
          icon={<Flame className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Unemployment"
          value={unemployment.value}
          date={unemployment.date}
          icon={<Users className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Interest Rate"
          value={interestRate.value}
          date={interestRate.date}
          icon={<Percent className="w-3.5 h-3.5" />}
        />
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <BarChart2 className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        Economic Indicators · EODHD
      </span>
    </div>
  );
}
