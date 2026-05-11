import { useRef, useState, useEffect, useMemo } from 'react';
import {
  ExternalLink, X, Bell, GripHorizontal,
  Flame, Wind, Mountain, Droplets, Route,
} from 'lucide-react';
import type { NaturalEvent, NaturalEventCategory } from '@/hooks/useNaturalEvents';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';

/**
 * NaturalEventDialog — draggable detail card for NASA EONET natural events.
 *
 * Mirrors the ConflictEventDialog pattern (same drag handle, same close-X,
 * same affected-commodities section).  Per-category icon + accent color so
 * the user immediately sees what kind of event they clicked.
 *
 * "Affected commodities" piggybacks on the existing producer-side mapping
 * in lib/conflicts/affectedCommodities — wildfires in Brazil affect coffee,
 * a typhoon over the Philippines affects palm oil, a volcano in Indonesia
 * affects nickel.  Same algorithm regardless of disaster type.
 */

interface Props {
  event: NaturalEvent | null;
  onClose: () => void;
  onSetAlert?: (commodityId: string) => void;
}

const CATEGORY_STYLE: Record<NaturalEventCategory, {
  label:    string;
  icon:     React.ComponentType<{ className?: string }>;
  iconBg:   string;
  iconFg:   string;
  accent:   string;
}> = {
  wildfires: {
    label:  'Wildfire',
    icon:   Flame,
    iconBg: 'bg-orange-500/15',
    iconFg: 'text-orange-400',
    accent: 'text-orange-400/80',
  },
  severeStorms: {
    label:  'Severe Storm',
    icon:   Wind,
    iconBg: 'bg-cyan-500/15',
    iconFg: 'text-cyan-400',
    accent: 'text-cyan-400/80',
  },
  volcanoes: {
    label:  'Volcano',
    icon:   Mountain,
    iconBg: 'bg-red-500/15',
    iconFg: 'text-red-400',
    accent: 'text-red-400/80',
  },
  floods: {
    label:  'Flood',
    icon:   Droplets,
    iconBg: 'bg-blue-500/15',
    iconFg: 'text-blue-400',
    accent: 'text-blue-400/80',
  },
};

export function NaturalEventDialog({ event, onClose, onSetAlert }: Props) {
  const affected = useMemo(
    () => event && event.countryIso2
      ? getMaterialAffectedCommodities(event.countryIso2, { minShare: 3, maxRank: 5 })
      : [],
    [event],
  );

  // ── Drag state (same pattern as ConflictEventDialog) ──────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => { setPos(null); }, [event]);

  function onDragHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
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
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
  // ───────────────────────────────────────────────────────────────────────

  if (!event) return null;

  const style       = CATEGORY_STYLE[event.category];
  const Icon        = style.icon;
  const countryName = event.countryIso2
    ? (COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2)
    : 'Open ocean / unattributed';
  const dateLabel = new Date(event.date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div
      ref={cardRef}
      // PERF: removed `backdrop-blur-md` — see EarthquakeDialog for rationale.
      // Solid `bg-card` avoids the per-frame GPU blur over the animated globe.
      className={`fixed z-[400] w-[400px] max-h-[82vh] overflow-y-auto bg-card border border-border rounded-lg shadow-2xl pointer-events-auto select-none${pos ? '' : ' bottom-6 left-6'}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ── Drag handle ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center h-4 cursor-grab active:cursor-grabbing rounded-t-lg hover:bg-accent/40 transition-colors"
        onPointerDown={onDragHandlePointerDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/35" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 px-3 pb-3 border-b border-border">
        <div className={`shrink-0 w-8 h-8 rounded-full ${style.iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${style.iconFg}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {style.label} · {dateLabel}
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 leading-tight">
            {event.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* ── Location + track length ─────────────────────────────────────── */}
      <div className="px-3 pt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate" title={countryName}>
          Nearest country: <span className="text-foreground/80">{countryName}</span>
        </span>
        {event.geometryCount > 1 && (
          <span className="flex items-center gap-1 shrink-0" title="Track length — number of position reports">
            <Route className="w-3 h-3" />
            {event.geometryCount} points
          </span>
        )}
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      {event.description && (
        <p className="px-3 pt-2 text-xs leading-relaxed text-foreground/80">
          {event.description}
        </p>
      )}

      {/* ── Affected commodities ────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <div className={`text-[10px] uppercase tracking-widest font-semibold ${style.accent} mb-1.5`}>
          Could affect supply of
        </div>
        {affected.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            {event.countryIso2
              ? `${countryName} is not a top-5 producer of any tracked commodity.`
              : 'Event is in open ocean / unattributed — no producer-side impact.'}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {affected.map(({ commodity, share, rank }) => (
              <li
                key={commodity.id}
                className="flex items-center gap-2 text-xs py-0.5 px-2 rounded hover:bg-accent/50 transition-colors group"
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
                  className="shrink-0 ml-1 p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-purple-500/15 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Set alert for ${commodity.label}`}
                  title="Alert me about events affecting this commodity"
                >
                  <Bell className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Source footer ────────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-3 flex items-center justify-between border-t border-border/50 mt-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Source: NASA EONET{event.sourceName ? ` · ${event.sourceName}` : ''}
        </span>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[11px] ${style.iconFg} hover:opacity-80 flex items-center gap-1`}
          >
            View source <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
