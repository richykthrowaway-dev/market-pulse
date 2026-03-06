import React from 'react';
import { getGicsSectorColor, getGicsSectorBg, getGicsSectorBorder, normalizeSector } from '@/lib/gicsColors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface GicsDetail {
  sector?: string | null;
  industryGroup?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
}

interface SectorBadgeProps {
  sector: string | null | undefined;
  dotOnly?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTooltip?: boolean;
  /** Full GICS hierarchy to display on hover */
  gicsDetail?: GicsDetail;
}

function GicsTooltipContent({ detail, fallback, color }: { detail?: GicsDetail; fallback: string; color: string }) {
  if (!detail?.sector) {
    return <span>{fallback}</span>;
  }

  const subLevels = [
    { label: 'Industry Group', value: detail.industryGroup },
    { label: 'Industry', value: detail.industry },
    { label: 'Sub-Industry', value: detail.subIndustry },
  ].filter(l => l.value);

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      {/* Sector header */}
      <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
        <span className="rounded-full h-2.5 w-2.5 shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold">{detail.sector}</span>
      </div>
      {/* Sub-classifications */}
      {subLevels.length > 0 ? (
        <div className="flex flex-col gap-1.5 pl-1">
          {subLevels.map((l, i) => (
            <div key={l.label} className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{l.label}</span>
              <span className={cn('text-xs', i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {l.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground italic">No sub-classification data</span>
      )}
    </div>
  );
}

/**
 * Universal GICS sector badge with consistent color coding.
 * Colors come from the centralized SECTOR_COLORS map in gicsColors.ts.
 * When gicsDetail is provided, hovering shows the full GICS hierarchy.
 */
export function SectorBadge({ sector, dotOnly = false, size = 'sm', className, showTooltip = true, gicsDetail }: SectorBadgeProps) {
  const normalized = sector === 'ETFs' ? 'ETFs' : normalizeSector(sector ?? '');
  const color = getGicsSectorColor(normalized);
  const bg = getGicsSectorBg(normalized);
  const border = getGicsSectorBorder(normalized);

  const dotSize = size === 'xs' ? 'h-1.5 w-1.5' : size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const textSize = size === 'xs' ? 'text-[9px]' : size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'xs' ? 'px-1.5 py-0' : size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  const badge = dotOnly ? (
    <span
      className={cn('inline-block rounded-full flex-shrink-0', dotSize, className)}
      style={{ backgroundColor: color }}
    />
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap cursor-default',
        textSize, padding, className,
      )}
      style={{
        backgroundColor: bg,
        color: color,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <span className={cn('rounded-full flex-shrink-0', dotSize)} style={{ backgroundColor: color }} />
      {normalized}
    </span>
  );

  // Show tooltip when: dotOnly always, or when gicsDetail is available
  const shouldShowTooltip = showTooltip && (dotOnly || !!gicsDetail);

  if (!shouldShowTooltip) return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="p-3 max-w-[320px]"
        >
          <GicsTooltipContent detail={gicsDetail} fallback={normalized} color={color} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Sector dot for inline use (e.g., in lists/tables).
 */
export function SectorDot({ sector, size = 'sm', className, gicsDetail }: { sector: string | null | undefined; size?: 'xs' | 'sm' | 'md'; className?: string; gicsDetail?: GicsDetail }) {
  return <SectorBadge sector={sector} dotOnly size={size} className={className} showTooltip gicsDetail={gicsDetail} />;
}
