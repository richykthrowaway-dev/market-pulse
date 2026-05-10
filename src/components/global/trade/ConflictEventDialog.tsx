import { useRef, useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, X, Bell, Skull, GripHorizontal } from 'lucide-react';
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
 *
 * The card is draggable: grab the grip bar at the top to reposition.
 * Position resets to the default bottom-left anchor when a new event opens.
 */

interface Props {
  event: ConflictEvent | null;
  onClose: () => void;
  onSetAlert?: (commodityId: string) => void;
}

export function ConflictEventDialog({ event, onClose, onSetAlert }: Props) {
  const affected = useRef<ReturnType<typeof getMaterialAffectedCommodities>>([]);
  affected.current = event
    ? getMaterialAffectedCommodities(event.countryIso2, { minShare: 3, maxRank: 5 })
    : [];

  // pos === null  →  CSS anchor (bottom-6 left-6)
  // pos !== null  →  dragged, inline style takes over
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Reset position whenever a new event is opened
  useEffect(() => { setPos(null); }, [event]);

  function onDragHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX:  rect.left,
      origY:  rect.top,
    };
    // Snap from CSS-anchor to absolute coords so inline style works immediately
    setPos({ x: rect.left, y: rect.top });

    function onMove(ev: PointerEvent) {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
  }

  if (!event) return null;

  const countryName = COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2 ?? 'Unknown location';
  const dateLabel   = new Date(event.date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div
      ref={cardRef}
      className={`fixed z-[400] w-[400px] max-h-[78vh] overflow-y-auto bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl pointer-events-auto select-none${pos ? '' : ' bottom-6 left-6'}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
        {/* ── Drag handle ────────────────────────────────────── */}
        <div
          className="flex items-center justify-center h-5 cursor-grab active:cursor-grabbing rounded-t-lg hover:bg-accent/40 transition-colors"
          onPointerDown={onDragHandlePointerDown}
        >
          <GripHorizontal className="w-4 h-4 text-muted-foreground/40" />
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-4 pb-4 border-b border-border">
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

          {affected.current.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">
              {event.countryIso2
                ? `${countryName} is not a top-5 producer of any tracked commodity.`
                : 'Country could not be resolved for this event.'}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {affected.current.map(({ commodity, share, rank }) => (
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
