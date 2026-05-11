import { useRef, useState, useEffect } from 'react';
import { Calendar, ExternalLink, X, GripHorizontal, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { EconomicEvent } from '@/hooks/useEconomicEvents';
import { COUNTRY_META } from '@/data/countryMeta';

interface Props {
  event: EconomicEvent | null;
  onClose: () => void;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(2) + 'K';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Importance badge color */
function importanceColor(imp: EconomicEvent['importance']): string {
  return imp === 'high'   ? 'text-red-400 bg-red-500/15 border-red-500/25'
       : imp === 'medium' ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25'
       :                    'text-muted-foreground bg-muted/30 border-border';
}

function SurpriseIcon({ actual, estimate }: { actual: number | null; estimate: number | null }) {
  if (actual === null || estimate === null) return null;
  if (actual > estimate)  return <TrendingUp  className="w-3.5 h-3.5 text-emerald-400" />;
  if (actual < estimate)  return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

export function EconomicEventDialog({ event, onClose }: Props) {
  // ── Drag state ───────────────────────────────────────────────────────────
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
      setPos({ x: dragRef.current.origX + (ev.clientX - dragRef.current.startX), y: dragRef.current.origY + (ev.clientY - dragRef.current.startY) });
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  if (!event) return null;

  const countryName = COUNTRY_META[event.country]?.name ?? event.country;
  const isReleased  = event.actual !== null;
  const hasEstimate = event.estimate !== null;

  return (
    <div
      ref={cardRef}
      // PERF: removed `backdrop-blur-md` — see EarthquakeDialog for rationale.
      className={`fixed z-[400] w-[360px] bg-card border border-border rounded-lg shadow-2xl pointer-events-auto select-none${pos ? '' : ' bottom-6 left-6'}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center h-4 cursor-grab active:cursor-grabbing rounded-t-lg hover:bg-accent/40 transition-colors"
        onPointerDown={onDragHandlePointerDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/35" />
      </div>

      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 pb-3 border-b border-border">
        <div className="shrink-0 w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${importanceColor(event.importance)}`}>
              {event.importance}
            </span>
            <span className="text-[10px] text-muted-foreground">{countryName}</span>
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 leading-tight">
            {event.type}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fmtDateTime(event.date)}{event.period ? ` · ${event.period}` : ''}
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

      {/* Data rows */}
      <div className="px-3 py-2.5 space-y-1.5">
        {/* Actual — shown with surprise indicator if estimate exists */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Actual</span>
          <span className={`flex items-center gap-1 font-semibold tabular-nums ${isReleased ? 'text-foreground' : 'text-muted-foreground/50'}`}>
            {isReleased ? (
              <>
                <SurpriseIcon actual={event.actual} estimate={event.estimate} />
                {fmtNum(event.actual)}
                {event.comparison ? <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{event.comparison}</span> : null}
              </>
            ) : (
              <span className="italic text-[11px]">Not yet released</span>
            )}
          </span>
        </div>

        {/* Estimate */}
        {hasEstimate && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Estimate</span>
            <span className="tabular-nums text-foreground/80">
              {fmtNum(event.estimate)}
              {event.comparison ? <span className="text-[10px] text-muted-foreground ml-0.5">{event.comparison}</span> : null}
            </span>
          </div>
        )}

        {/* Previous */}
        {event.previous !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Previous</span>
            <span className="tabular-nums text-foreground/60">
              {fmtNum(event.previous)}
              {event.comparison ? <span className="text-[10px] text-muted-foreground ml-0.5">{event.comparison}</span> : null}
            </span>
          </div>
        )}

        {/* Surprise callout — only when actual is released */}
        {isReleased && hasEstimate && event.actual !== null && event.estimate !== null && (
          <div className={`mt-1.5 px-2.5 py-1.5 rounded text-[11px] leading-snug ${
            event.actual > event.estimate
              ? 'bg-emerald-500/8 border border-emerald-500/20 text-emerald-400'
              : event.actual < event.estimate
              ? 'bg-red-500/8 border border-red-500/20 text-red-400'
              : 'bg-muted/30 border border-border text-muted-foreground'
          }`}>
            {event.actual > event.estimate
              ? `Beat estimate by ${fmtNum(Math.abs(event.actual - event.estimate))} — potential bullish signal.`
              : event.actual < event.estimate
              ? `Missed estimate by ${fmtNum(Math.abs(event.actual - event.estimate))} — potential bearish signal.`
              : 'Matched estimate — in-line with expectations.'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pt-1 pb-3 flex items-center justify-between border-t border-border/50">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Source: EODHD
        </span>
        <a
          href={`https://eodhd.com/economic-calendar/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          Calendar <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
