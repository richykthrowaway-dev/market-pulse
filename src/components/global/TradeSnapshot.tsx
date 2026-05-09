import { Scale, ArrowUpRight, ArrowDownRight, Cpu, Globe2 } from 'lucide-react';
import { useEodhdTrade } from '@/hooks/useEodhdTrade';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | null;
  date: string | null;
  icon: React.ReactNode;
  /** When true, value sign drives the color (green positive, red negative).
   *  When false (default), all values render in the muted text tone. */
  signedColor?: boolean;
}

function valueColor(value: number | null, signed: boolean): string {
  if (value === null) return 'text-muted-foreground';
  if (!signed) return 'text-foreground';
  if (value > 0) return 'text-emerald-500';
  if (value < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

function formatYear(date: string | null): string | null {
  if (!date) return null;
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : date;
}

function MetricCard({ label, value, date, icon, signedColor = false }: MetricCardProps) {
  // Trade percentages can range widely (-15% to +50%+ for current account in
  // outliers). 1 decimal is enough precision and keeps cards visually tight.
  const displayValue =
    value !== null
      ? `${value > 0 && signedColor ? '+' : ''}${value.toFixed(1)}%`
      : '--';
  const year = formatYear(date);

  return (
    <div className="bg-muted/40 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <span className={cn('text-lg font-bold leading-tight', valueColor(value, signedColor))}>
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

interface TradeSnapshotProps {
  iso2: string;
}

/**
 * Trade & external-sector snapshot card grid.
 *
 * Renders 4 EODHD-sourced indicators in a 2×2 layout matching the
 * existing MacroSnapshot component. Returns null when ALL four values
 * are unavailable (small countries that don't report to the World
 * Bank, or pre-fetch state).
 */
export function TradeSnapshot({ iso2 }: TradeSnapshotProps) {
  const { data, isLoading } = useEodhdTrade(iso2);

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

  const { currentAccount, exportsPctGdp, importsPctGdp, highTechExports } = data;
  const allNull =
    currentAccount.value   === null &&
    exportsPctGdp.value    === null &&
    importsPctGdp.value    === null &&
    highTechExports.value  === null;

  if (allNull) return null;

  return (
    <div className="space-y-2">
      <SectionHeader />
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Current Account"
          value={currentAccount.value}
          date={currentAccount.date}
          icon={<Scale className="w-3.5 h-3.5" />}
          signedColor
        />
        <MetricCard
          label="Exports"
          value={exportsPctGdp.value}
          date={exportsPctGdp.date}
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Imports"
          value={importsPctGdp.value}
          date={importsPctGdp.date}
          icon={<ArrowDownRight className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="High-Tech Exports"
          value={highTechExports.value}
          date={highTechExports.date}
          icon={<Cpu className="w-3.5 h-3.5" />}
        />
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Globe2 className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        Trade &amp; External Sector · EODHD
      </span>
    </div>
  );
}
