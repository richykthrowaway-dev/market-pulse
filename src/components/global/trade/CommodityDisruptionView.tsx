import { useMemo } from 'react';
import { Loader2, AlertTriangle, Zap, ExternalLink, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useConflictEvents }          from '@/hooks/useConflictEvents';
import { useEarthquakes }             from '@/hooks/useEarthquakes';
import { getCommodity }               from '@/data/tradeInfrastructure/commodities';
import { COUNTRY_META }               from '@/data/countryMeta';
import { cn }                         from '@/lib/utils';

/**
 * CommodityDisruptionView — real-time supply disruption radar.
 *
 * Cross-references the selected commodity's top-producer countries against:
 *   - Live conflict events (ACLED + GDELT via api-conflicts, 14 days)
 *   - Recent significant earthquakes (USGS M5.0+, 7 days)
 *
 * Alerts are ranked by a simple risk score:
 *   risk = producerShare × (event severity / maxSeverity)
 *
 * This component only mounts when the Disruptions view is active, so the
 * underlying hooks only fire their network calls at that point.
 */

interface DisruptionAlert {
  id:            string;
  type:          'conflict' | 'earthquake';
  iso2:          string;
  producerShare: number;
  riskScore:     number;
  headline:      string;
  detail:        string;
  date:          string;
  url:           string;
}

function getFlagSrc(iso2: string) {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

function timeAgo(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return iso.slice(0, 10); }
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function CommodityDisruptionView({ selectedId }: { selectedId: string }) {
  // Both hooks only fire because this component is only rendered when
  // `view === 'disruptions'` — no explicit `enabled` prop needed.
  const { data: conflictData, isLoading: conflictLoading } = useConflictEvents(true);
  const { data: quakes = [],  isLoading: quakeLoading    } = useEarthquakes(true);

  const commodity    = getCommodity(selectedId);
  const isLoading    = conflictLoading || quakeLoading;
  const conflicts    = conflictData?.events ?? [];

  // Build a set of producer ISO2 codes with their share, for fast lookup.
  const producerMap = useMemo(() =>
    new Map((commodity?.producers ?? []).map(p => [p.iso2, p.share])),
    [commodity],
  );

  const alerts: DisruptionAlert[] = useMemo(() => {
    if (!commodity || producerMap.size === 0) return [];

    const out: DisruptionAlert[] = [];

    // ── Conflict events ────────────────────────────────────────────────
    for (const ev of conflicts) {
      const share = producerMap.get(ev.countryIso2);
      if (share == null || share < 1) continue;  // only top producers matter

      const fatScore = Math.min(ev.fatalities / 100, 1); // normalise 0-1
      const severity = 0.4 + fatScore * 0.6;             // base weight + fatalities

      out.push({
        id:            `conflict-${ev.id}`,
        type:          'conflict',
        iso2:          ev.countryIso2,
        producerShare: share,
        riskScore:     share * severity,
        headline:      `${ev.eventType} in ${COUNTRY_META[ev.countryIso2]?.name ?? ev.countryIso2}`,
        detail:        ev.fatalities > 0
          ? `${ev.fatalities} fatalities · ${ev.notes.slice(0, 80)}${ev.notes.length > 80 ? '…' : ''}`
          : ev.notes.slice(0, 100) + (ev.notes.length > 100 ? '…' : ''),
        date:          ev.date,
        url:           ev.sourceUrl,
      });
    }

    // ── Significant earthquakes (M5.0+) ───────────────────────────────
    for (const eq of quakes) {
      if (eq.magnitude < 5.0) continue;
      const share = producerMap.get(eq.countryIso2);
      if (share == null || share < 1) continue;

      const magScore = Math.min((eq.magnitude - 5.0) / 4.0, 1); // 5→0, 9→1
      const severity = 0.3 + magScore * 0.7;

      out.push({
        id:            `eq-${eq.id}`,
        type:          'earthquake',
        iso2:          eq.countryIso2,
        producerShare: share,
        riskScore:     share * severity,
        headline:      `M${eq.magnitude.toFixed(1)} earthquake — ${COUNTRY_META[eq.countryIso2]?.name ?? eq.countryIso2}`,
        detail:        eq.place,
        date:          eq.date,
        url:           eq.sourceUrl,
      });
    }

    // Sort by risk score descending, deduplicate if same area shows twice
    return out
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 12); // cap at 12 to keep UI clean
  }, [commodity, producerMap, conflicts, quakes]);

  if (!commodity) return null;

  return (
    <>
      <p className="px-4 pb-2 text-[11px] leading-snug text-muted-foreground italic">
        Live disruption alerts in top-producing countries for{' '}
        <span className="font-medium text-foreground/80">{commodity.label}</span>.
        Ranked by (producer share × event severity).
      </p>

      {isLoading && (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Fetching live events…
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="px-4 py-4 text-center">
          <ShieldAlert className="w-6 h-6 text-emerald-500/50 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground/70 font-medium">No active disruptions detected</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            No significant conflicts or M5.0+ earthquakes in top-producing countries (last 7–14 days).
          </p>
        </div>
      )}

      {!isLoading && alerts.length > 0 && (
        <ul className="px-4 pb-2 space-y-2">
          {alerts.map(a => {
            const countryName = COUNTRY_META[a.iso2]?.name ?? a.iso2;
            return (
              <li
                key={a.id}
                className={cn(
                  'rounded-md border p-2 text-xs',
                  a.type === 'conflict'
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-amber-500/20 bg-amber-500/5',
                )}
              >
                <div className="flex items-start gap-2">
                  {/* Icon */}
                  {a.type === 'conflict'
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    : <Zap          className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  }

                  <div className="flex-1 min-w-0">
                    {/* Headline row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <img
                        src={getFlagSrc(a.iso2)}
                        alt={countryName}
                        width={14}
                        height={10}
                        className="shrink-0 rounded-[2px] ring-1 ring-border/40 object-cover"
                      />
                      <span className="font-medium text-foreground/90">{a.headline}</span>
                      {/* Producer share badge */}
                      <span className={cn(
                        'ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded font-semibold',
                        a.type === 'conflict'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400',
                      )}>
                        {a.producerShare.toFixed(0)}% of supply
                      </span>
                    </div>

                    {/* Detail */}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">
                      {a.detail}
                    </p>

                    {/* Footer: time + link */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-muted-foreground/50">{timeAgo(a.date)}</span>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground/40 hover:text-primary/60 transition-colors"
                        >
                          Source <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        ACLED + GDELT (14d) · USGS M5.0+ (7d) · ranked by producer share × severity
      </p>
    </>
  );
}
