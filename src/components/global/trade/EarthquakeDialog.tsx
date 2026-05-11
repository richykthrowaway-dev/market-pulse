import { useRef, useState, useEffect } from 'react';
import { ExternalLink, X, Bell, Waves, AlertTriangle, GripHorizontal } from 'lucide-react';
import type { EarthquakeEvent } from '@/hooks/useEarthquakes';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';

/**
 * EarthquakeDialog — modal shown when a seismic-event ring is clicked.
 *
 * Shows magnitude, depth, place description, tsunami flag, and the same
 * "Could affect supply of" panel used by ConflictEventDialog — derived
 * from the event's country vs. each commodity's top-producer list.
 *
 * The card is draggable: grab the grip bar at the top to reposition.
 * Position resets to the default bottom-left anchor when a new event opens.
 */

interface Props {
  event:       EarthquakeEvent | null;
  onClose:     () => void;
  onSetAlert?: (commodityId: string) => void;
}

/** Magnitude → label + color */
function magMeta(mag: number): { label: string; color: string; bg: string } {
  if (mag >= 7.0) return { label: 'Major',    color: 'text-red-400',    bg: 'bg-red-500/15' };
  if (mag >= 6.0) return { label: 'Strong',   color: 'text-orange-400', bg: 'bg-orange-500/15' };
  if (mag >= 5.0) return { label: 'Moderate', color: 'text-amber-400',  bg: 'bg-amber-500/15' };
  if (mag >= 4.0) return { label: 'Light',    color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
  return            { label: 'Minor',    color: 'text-sky-400',    bg: 'bg-sky-500/15' };
}

export function EarthquakeDialog({ event, onClose, onSetAlert }: Props) {
  const affectedRef = useRef<ReturnType<typeof getMaterialAffectedCommodities>>([]);
  affectedRef.current = event?.countryIso2
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

  const { label: magLabel, color: magColor, bg: magBg } = magMeta(event.magnitude);
  const countryName = COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2 ?? 'Unknown location';
  const dateLabel   = new Date(event.time).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const timeLabel   = new Date(event.time).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const affected = affectedRef.current;

  return (
    <div
      ref={cardRef}
      // PERF: removed `backdrop-blur-md` — it forced a per-frame gaussian
      // recomputation over the animated globe behind the card, dropping
      // the globe's frame rate when many event rings were on screen.
      // The `bg-card` solid fill (with 95% theme alpha) gives the same
      // visual weight without the GPU cost.
      className={`fixed z-[400] w-[400px] max-h-[78vh] overflow-y-auto bg-card border border-border rounded-lg shadow-2xl pointer-events-auto select-none${pos ? '' : ' bottom-6 left-6'}`}
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
          <div className={`shrink-0 w-9 h-9 rounded-full ${magBg} flex items-center justify-center`}>
            {/* Magnitude badge */}
            <span className={`text-xs font-bold tabular-nums ${magColor}`}>
              M{event.magnitude.toFixed(1)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <span className={`font-semibold ${magColor}`}>{magLabel}</span>
              <span>·</span>
              <span>{dateLabel}</span>
              <span>·</span>
              <span>{timeLabel}</span>
            </div>
            <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {event.place || countryName}
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

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div className="px-4 pt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground/80">Depth</span>
            <span className="tabular-nums">{event.depth.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground/80">Sig</span>
            <span className="tabular-nums">{event.sig}</span>
          </div>
          {event.tsunami && (
            <div className="flex items-center gap-1 text-cyan-400 font-medium">
              <Waves className="w-3.5 h-3.5" />
              Tsunami warning
            </div>
          )}
        </div>

        {/* ── Affected commodities ───────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-sky-400/80 mb-2">
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
                    className="shrink-0 ml-1 p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-sky-500/15 transition-colors opacity-0 group-hover:opacity-100"
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

        {/* ── Depth context note ────────────────────────────────── */}
        {event.depth < 70 && event.magnitude >= 5.0 && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Shallow quake ({event.depth.toFixed(0)} km depth) — surface damage
              to infrastructure more likely than a deeper event of the same magnitude.
            </span>
          </div>
        )}

        {/* ── Source link ────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-4 flex items-center justify-between border-t border-border/50 mt-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Source: USGS
          </span>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              USGS event page <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
  );
}
