import { useRef, useState, useEffect } from 'react';
import {
  ExternalLink, X, Bell, Waves, AlertTriangle, GripHorizontal,
  Users, Map, MessageSquare, BarChart,
} from 'lucide-react';
import type { EarthquakeEvent, PagerAlert } from '@/hooks/useEarthquakes';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';
import { cn } from '@/lib/utils';

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

/**
 * PAGER alert level metadata.
 * Source: https://earthquake.usgs.gov/data/pager/onepager.php
 *   green  → No fatalities expected
 *   yellow → Limited damage, isolated casualties possible
 *   orange → Significant damage, hundreds of fatalities possible
 *   red    → Catastrophic, thousands+ fatalities possible
 */
const PAGER_META: Record<PagerAlert, { label: string; classes: string; description: string }> = {
  green:  { label: 'GREEN',  classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', description: 'No fatalities expected' },
  yellow: { label: 'YELLOW', classes: 'bg-amber-500/15   text-amber-400   border-amber-500/30',   description: 'Limited damage, isolated casualties possible' },
  orange: { label: 'ORANGE', classes: 'bg-orange-500/15  text-orange-400  border-orange-500/30',  description: 'Significant damage, hundreds of fatalities possible' },
  red:    { label: 'RED',    classes: 'bg-red-500/15     text-red-400     border-red-500/30',     description: 'Catastrophic — thousands+ fatalities possible' },
};

/**
 * USGS product types → deep-link metadata.
 * Each product has its own subpath on the event detail page.
 */
const PRODUCT_LINKS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; path: string }> = [
  { key: 'shakemap',         label: 'ShakeMap',  icon: Map,           path: 'shakemap/intensity' },
  { key: 'dyfi',             label: 'Felt reports', icon: MessageSquare, path: 'dyfi' },
  { key: 'losspager',        label: 'PAGER loss', icon: BarChart,     path: 'pager' },
  { key: 'moment-tensor',    label: 'Focal mech.', icon: AlertTriangle, path: 'moment-tensor' },
];

/** Build a USGS event-page deep link for a given product. */
function productUrl(eventId: string, path: string): string {
  return `https://earthquake.usgs.gov/earthquakes/eventpage/${eventId}/${path}`;
}

/**
 * Horizontal intensity bar for CDI/MMI scales.  Width scales with `value/max`.
 * Color shifts to amber/red at the upper end so a 7+ MMI (very strong shaking)
 * pops visually.
 */
function IntensityBar({
  label, value, max, color,
}: {
  label: string;
  value: number;
  max: number;
  color: 'sky' | 'violet';
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // Severity tier — drives the bar fill color.  Roman intensity scales
  // become "strong" around 5-6 and "violent" by 8+.
  const severity =
    value >= 7 ? 'high' :
    value >= 5 ? 'mid'  : 'low';
  const fillClass =
    severity === 'high' ? 'bg-red-400'    :
    severity === 'mid'  ? 'bg-amber-400'  :
    color === 'sky'     ? 'bg-sky-400'    : 'bg-violet-400';
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-20 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', fillClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 tabular-nums text-right font-semibold text-foreground/85">
        {value.toFixed(1)}
      </span>
    </div>
  );
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span className={`font-semibold ${magColor}`}>{magLabel}</span>
              {/* MagType suffix — labels the magnitude scale (Mww, Mb, Ml…) */}
              {event.magType && (
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
                  {event.magType}
                </span>
              )}
              <span>·</span>
              <span>{dateLabel}</span>
              <span>·</span>
              <span>{timeLabel}</span>
              {/* Status pill — flags algorithmic-only solutions */}
              {event.status === 'automatic' && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tabular-nums bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  AUTO
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {event.place || countryName}
            </div>
            {/* Non-earthquake event type warning — quarry blasts etc. */}
            {event.type !== 'earthquake' && (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                Event type: {event.type}
              </div>
            )}
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

        {/* ── PAGER alert badge ─────────────────────────────────── */}
        {event.alert && (() => {
          const meta = PAGER_META[event.alert];
          return (
            <div className={cn(
              'mx-4 mt-3 px-3 py-2 rounded-md border flex items-center gap-2.5',
              meta.classes,
            )}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-bold">
                  PAGER · {meta.label}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90">
                  {meta.description}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div className="px-4 pt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground/80">Depth</span>
            <span className="tabular-nums">{event.depth.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground/80">Sig</span>
            <span className="tabular-nums">{event.sig}</span>
          </div>
          {/* "Felt by N" — citizen Did-You-Feel-It reports.
              Highly informative engagement signal: a 5.0 with 10 felt reports
              is in the middle of nowhere; a 5.0 with 5000 is in a city. */}
          {event.felt != null && event.felt > 0 && (
            <div className="flex items-center gap-1 text-foreground/80 font-medium" title="Did You Feel It? citizen reports">
              <Users className="w-3 h-3" />
              Felt by {event.felt.toLocaleString()}
            </div>
          )}
          {event.tsunami && (
            <div className="flex items-center gap-1 text-cyan-400 font-medium">
              <Waves className="w-3.5 h-3.5" />
              Tsunami warning
            </div>
          )}
        </div>

        {/* ── Intensity comparison: citizen vs instrument ────────── */}
        {/* CDI = Community Determined Intensity (DYFI crowd-sourced 1-12).
            MMI = Modified Mercalli Intensity (instrument-derived 1-10).
            Showing both lets the viewer compare "what people reported"
            against "what shaking the seismographs measured." */}
        {(event.cdi != null || event.mmi != null) && (
          <div className="px-4 pt-3">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">
              Shaking intensity
            </div>
            <div className="space-y-1.5">
              {event.cdi != null && (
                <IntensityBar label="Felt (CDI)"      value={event.cdi} max={12} color="sky" />
              )}
              {event.mmi != null && (
                <IntensityBar label="Measured (MMI)" value={event.mmi} max={10} color="violet" />
              )}
            </div>
          </div>
        )}

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

        {/* ── USGS product deep-links ─────────────────────────────── */}
        {/* `types[]` enumerates products available for this event.
            For each known product we render a quick-link button to its
            USGS event-page subpath (ShakeMap, DYFI, PAGER, focal mech). */}
        {(() => {
          const availableLinks = PRODUCT_LINKS.filter(p => event.types.includes(p.key));
          if (availableLinks.length === 0) return null;
          return (
            <div className="px-4 pt-3">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">
                Detailed reports
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableLinks.map(link => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.key}
                      href={productUrl(event.id, link.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card text-[11px] hover:border-sky-500/40 hover:text-sky-400 transition-colors"
                    >
                      <Icon className="w-3 h-3" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
