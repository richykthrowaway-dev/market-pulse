import { useMemo } from 'react';
import { AlertTriangle, ExternalLink, X, Bell, Skull } from 'lucide-react';
import type { ConflictEvent } from '@/hooks/useConflictEvents';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';

/**
 * ConflictEventDialog — modal shown when a conflict-event ring is clicked.
 *
 * The headline feature: "Affects" panel listing commodities that this event
 * could plausibly impact, derived from the event's country vs. each
 * commodity's top producers list.  Each row has a placeholder "Set Alert"
 * button — the seed UI for the alerts/notifications system.
 */

interface Props {
  event: ConflictEvent | null;
  onClose: () => void;
  onSetAlert?: (commodityId: string) => void;
}

export function ConflictEventDialog({ event, onClose, onSetAlert }: Props) {
  const affected = useMemo(
    () =>
      event
        ? getMaterialAffectedCommodities(event.countryIso2, { minShare: 3, maxRank: 5 })
        : [],
    [event],
  );

  if (!event) return null;

  const countryName = COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2 ?? 'Unknown location';
  const dateLabel   = new Date(event.date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  // Non-modal floating card: anchored to the bottom-left of the globe area,
  // no backdrop, no blur — user can still drag/zoom the globe while it's open.
  return (
    <div
      className="fixed bottom-6 left-6 z-[400] w-[400px] max-h-[78vh] overflow-y-auto bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl pointer-events-auto"
      // Stop pointer events on the card itself from propagating up to the
      // globe's drag/wheel handlers, but the rest of the screen remains free.
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 border-b border-border">
          <div className="shrink-0 w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {event.eventType} · {dateLabel}
            </div>
            <div className="text-sm font-semibold text-foreground mt-0.5">
              {countryName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── Notes / description ────────────────────────────────── */}
        {event.notes && (
          <p className="px-4 pt-3 text-xs leading-relaxed text-foreground/80">
            {event.notes}
          </p>
        )}

        {/* ── Fatalities (if present) ────────────────────────────── */}
        {event.fatalities > 0 && (
          <div className="px-4 pt-3 flex items-center gap-2 text-xs">
            <Skull className="w-3.5 h-3.5 text-red-400" />
            <span className="font-medium text-red-400 tabular-nums">
              {event.fatalities} reported {event.fatalities === 1 ? 'fatality' : 'fatalities'}
            </span>
          </div>
        )}

        {/* ── Affected commodities ───────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-purple-400/80 mb-2">
            Could affect supply of
          </div>

          {affected.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">
              {event.countryIso2
                ? `${countryName} is not a top-5 producer of any tracked commodity.`
                : 'Country could not be resolved for this event.'}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {affected.map(({ commodity, share, rank }) => (
                <li
                  key={commodity.id}
                  className="flex items-center gap-2 text-xs py-1 px-2 rounded-md hover:bg-accent/50 transition-colors group"
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground w-4 text-right">
                    #{rank}
                  </span>
                  <span className="font-medium text-foreground/90 flex-1 truncate">
                    {commodity.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0 w-12 text-right">
                    {share.toFixed(1)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetAlert?.(commodity.id)}
                    className="shrink-0 ml-1 p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-purple-500/15 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Set alert for ${commodity.label}`}
                    title="Alert me about events affecting this commodity"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Source link ────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-4 flex items-center justify-between border-t border-border/50 mt-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Source: {event.source.toUpperCase()}
          </span>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Read article <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
  );
}
