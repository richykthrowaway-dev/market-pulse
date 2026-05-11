import { useMemo } from 'react';
import { Anchor } from 'lucide-react';
import { SEAPORTS } from '@/data/tradeInfrastructure/seaports';
import type { Seaport } from '@/data/tradeInfrastructure/types';
import type { PortMetric } from '@/hooks/useAisDerivedMetrics';
import { cn } from '@/lib/utils';

/**
 * PortStressBoard — top 10 ports by current vessel-nearby count.
 *
 * Each row: flag (via CountryISO2) + port name + bar + raw count + TEU
 * context.  Bar widths scale to the busiest port in the current snapshot,
 * not 0-100% absolute, so relative pressure jumps out even when overall
 * counts are low.
 *
 * Interpretation: a port with a sustained high count vs others suggests
 * congestion or anchor queuing — useful during disruption events.  Note
 * that absolute counts also reflect a port's normal throughput (Shanghai
 * is always busy), so this is best read as "which ports are unusually
 * busy *for them*."  A future improvement is to normalize by TEU/year.
 */

interface Props {
  /** Map of port id → { total, anchored } vessel breakdown. */
  portMetrics: Map<string, PortMetric>;
  /** Whether AIS is connected and feeding data. */
  aisLive: boolean;
  /** Optional click handler — wires the row to camera-fly on the globe. */
  onSelect?: (port: Seaport) => void;
}

interface Row {
  port:     Seaport;
  total:    number;
  anchored: number;
}

function getFlagSrc(iso2: string): string {
  return `https://flagcdn.com/w20/${iso2.toLowerCase()}.png`;
}

export function PortStressBoard({ portMetrics, aisLive, onSelect }: Props) {
  const rows = useMemo<Row[]>(() => {
    return SEAPORTS
      .map(port => {
        const m = portMetrics.get(port.id);
        return { port, total: m?.total ?? 0, anchored: m?.anchored ?? 0 };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [portMetrics]);

  const maxCount = rows[0]?.total ?? 0;

  return (
    <div className="px-4 py-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Anchor className="w-3 h-3" />
        Port Stress (live AIS)
      </h3>

      {!aisLive ? (
        <p className="text-[10px] italic text-muted-foreground/70">
          Enable Live Vessels (Intelligence overlay) to populate port traffic.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[10px] italic text-muted-foreground/70">
          No vessels detected near tracked ports yet — waiting for AIS coverage.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ port, total, anchored }) => {
            // Bar width scales to the BUSIEST port for relative pressure.
            const widthPct    = maxCount > 0 ? Math.round((total    / maxCount) * 100) : 0;
            // Inside the bar, the anchored segment is rendered in amber/red
            // (congestion) — a high anchored:total ratio means many vessels
            // are sitting still rather than working cargo.
            const anchoredPct = total > 0 && widthPct > 0
              ? Math.round((anchored / total) * widthPct)
              : 0;
            const anchoredRatio = total > 0 ? anchored / total : 0;
            // Color tint for the "anchored" caption — > 50% stationary is
            // worth flagging as a congestion signal.
            const captionTone =
              anchoredRatio >= 0.7 ? 'text-red-400'   :
              anchoredRatio >= 0.4 ? 'text-amber-400' :
                                     'text-muted-foreground/60';

            return (
              <li
                key={port.id}
                onClick={() => onSelect?.(port)}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto] gap-2 items-center px-2 py-1 rounded transition-colors',
                  onSelect && 'cursor-pointer hover:bg-muted/30',
                )}
              >
                {/* Flag */}
                {port.countryISO2 ? (
                  <img
                    src={getFlagSrc(port.countryISO2)}
                    alt={port.countryISO2}
                    width={14}
                    height={10}
                    className="shrink-0 rounded-[2px] ring-1 ring-border/40 object-cover"
                  />
                ) : (
                  <span className="w-3.5 h-2.5 shrink-0" />
                )}

                {/* Name + bar */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium truncate text-foreground/90" title={port.name}>
                      {port.name}
                    </span>
                    {port.metrics?.cargo_throughput_teu && (
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums shrink-0">
                        {port.metrics.cargo_throughput_teu.toFixed(1)}M TEU/yr
                      </span>
                    )}
                  </div>
                  {/* Stacked bar: amber = stationary, sky = under way */}
                  <div className="mt-0.5 h-1 rounded-full bg-muted/40 overflow-hidden flex">
                    {anchoredPct > 0 && (
                      <div className="h-full bg-amber-400/80" style={{ width: `${anchoredPct}%` }} />
                    )}
                    <div className="h-full bg-sky-400/80" style={{ width: `${Math.max(0, widthPct - anchoredPct)}%` }} />
                  </div>
                  {/* Anchored caption — only when meaningfully high */}
                  {anchored > 0 && (
                    <div className={cn('mt-0.5 text-[9px] tabular-nums', captionTone)}>
                      {anchored} anchored ({Math.round(anchoredRatio * 100)}%)
                    </div>
                  )}
                </div>

                {/* Total count */}
                <span className="text-[11px] tabular-nums font-semibold text-foreground/85 w-8 text-right">
                  {total}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground/50 leading-snug">
        Vessels within 50 km of each port · live AIS · top 10 by current count.
      </p>
    </div>
  );
}
