import { useRef, useState, useEffect, useMemo } from 'react';
import {
  ExternalLink, X, Bell, GripHorizontal,
  Flame, Wind, Mountain, Droplets, Route, Navigation, TrendingUp, Activity,
} from 'lucide-react';
import type { NaturalEvent, NaturalEventCategory } from '@/hooks/useNaturalEvents';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';
import { cn } from '@/lib/utils';

/**
 * Saffir-Simpson hurricane wind scale (in knots).  Used to translate raw
 * `magnitudeValue` (kts) into a familiar category label.
 *   <34   Tropical depression
 *   34-63 Tropical storm
 *   64-82 Cat 1
 *   83-95 Cat 2
 *   96-112 Cat 3
 *   113-136 Cat 4
 *   137+  Cat 5
 */
function stormCategoryLabel(kts: number): string {
  if (kts >= 137) return 'Cat 5';
  if (kts >= 113) return 'Cat 4';
  if (kts >= 96)  return 'Cat 3';
  if (kts >= 83)  return 'Cat 2';
  if (kts >= 64)  return 'Cat 1';
  if (kts >= 34)  return 'Tropical storm';
  return 'Tropical depression';
}

/** Bearing degrees → 8-point compass (N, NE, E, …) for readable storm motion. */
function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

/** Compact integer with thousands separator — "12,345 acres". */
function fmtCount(n: number): string {
  return Math.round(n).toLocaleString();
}

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
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>{style.label}</span>
            <span>·</span>
            <span>{dateLabel}</span>
            {/* Active vs Closed badge.  EONET's `closed` field is the
                authoritative status — null = still active. */}
            {event.closed === null ? (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-wide flex items-center gap-1">
                <Activity className="w-2.5 h-2.5" />
                Active
              </span>
            ) : (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted/40 text-muted-foreground border border-border uppercase tracking-wide">
                Closed
              </span>
            )}
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

      {/* ── Magnitude / motion stats ────────────────────────────────────── */}
      {/* Quantitative event data from EONET geometry.magnitudeValue/Unit
          plus derived growth-rate (acres-or-kts per day) and storm motion
          (translation speed + bearing) computed from the geometry track.
          Per category:
            wildfires    → "1,500 acres · +320/day"
            severeStorms → "120 kts (Cat 4) · Moving NW at 14 km/h · +18 kts/day"
            volcanoes/floods → usually no magnitude; section is skipped */}
      {(event.magnitudeValue != null || event.motionSpeedKmh != null) && (
        <div className="mx-3 mt-2.5 rounded-md border border-border bg-card/60 p-2 space-y-1">
          {/* Primary magnitude line */}
          {event.magnitudeValue != null && event.magnitudeUnit && (
            <div className="flex items-baseline gap-2">
              <span className={cn('text-base font-bold tabular-nums', style.iconFg)}>
                {fmtCount(event.magnitudeValue)}
              </span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {event.magnitudeUnit}
              </span>
              {/* Saffir-Simpson category label for storms — uses knots */}
              {event.category === 'severeStorms' && event.magnitudeUnit.toLowerCase() === 'kts' && (
                <span className="text-[10px] font-semibold text-foreground/70 px-1.5 py-0.5 rounded bg-muted/40">
                  {stormCategoryLabel(event.magnitudeValue)}
                </span>
              )}
            </div>
          )}

          {/* Growth rate — signed delta per day */}
          {event.growthRatePerDay != null && Math.abs(event.growthRatePerDay) >= 0.1 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <TrendingUp className={cn(
                'w-3 h-3',
                event.growthRatePerDay > 0 ? 'text-amber-400' : 'text-emerald-400',
              )} />
              <span>
                {event.growthRatePerDay > 0 ? '+' : ''}
                <span className="tabular-nums font-semibold text-foreground/80">
                  {fmtCount(event.growthRatePerDay)}
                </span>
                {' '}
                {event.magnitudeUnit ?? ''}/day
                <span className="ml-1 opacity-60">
                  {event.growthRatePerDay > 0 ? '(intensifying)' : '(weakening)'}
                </span>
              </span>
            </div>
          )}

          {/* Storm/event motion — translation across earth surface */}
          {event.motionSpeedKmh != null && event.motionSpeedKmh > 1 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Navigation
                className="w-3 h-3 text-foreground/70"
                style={event.bearingDeg != null
                  ? { transform: `rotate(${event.bearingDeg}deg)` }
                  : undefined}
              />
              <span>
                Moving{event.bearingDeg != null ? ` ${bearingToCompass(event.bearingDeg)}` : ''}
                {' at '}
                <span className="tabular-nums font-semibold text-foreground/80">
                  {event.motionSpeedKmh.toFixed(1)}
                </span>
                {' km/h'}
              </span>
            </div>
          )}
        </div>
      )}

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
      {/* Show all source agencies + deep-link to each.  Wildfires often have
          two sources (IRWIN incident report + NASA FIRMS satellite); storms
          may have NOAA NHC + others.  Each is independently linkable. */}
      <div className="px-3 pt-2 pb-3 border-t border-border/50 mt-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Source: NASA EONET
        </div>
        {event.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.sources.map(s => (
              <a
                key={s.id + s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-card text-[10px] transition-colors hover:opacity-80',
                  style.iconFg,
                )}
              >
                {s.id}
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
