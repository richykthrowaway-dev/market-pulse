import { useRef, useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ExternalLink, X, Bell, Skull, GripHorizontal, Newspaper } from 'lucide-react';
import type { ConflictEvent } from '@/hooks/useConflictEvents';
import { useConflictNews } from '@/hooks/useConflictNews';
import { getMaterialAffectedCommodities } from '@/lib/conflicts/affectedCommodities';
import { COUNTRY_META } from '@/data/countryMeta';

interface Props {
  event: ConflictEvent | null;
  onClose: () => void;
  onSetAlert?: (commodityId: string) => void;
}

function fmtPubDate(pubDate: string): string {
  if (!pubDate) return '';
  try {
    return new Date(pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

export function ConflictEventDialog({ event, onClose, onSetAlert }: Props) {
  const affected = useMemo(
    () => event ? getMaterialAffectedCommodities(event.countryIso2, { minShare: 3, maxRank: 5 }) : [],
    [event],
  );

  const { data: newsArticles = [], isLoading: newsLoading } = useConflictNews(event);

  // ── Drag state ──────────────────────────────────────────────────────────
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
  // ───────────────────────────────────────────────────────────────────────

  if (!event) return null;

  const countryName = COUNTRY_META[event.countryIso2]?.name ?? event.countryIso2 ?? 'Unknown location';
  const dateLabel = new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div
      ref={cardRef}
      className={`fixed z-[400] w-[400px] max-h-[82vh] overflow-y-auto bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl pointer-events-auto select-none${pos ? '' : ' bottom-6 left-6'}`}
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
        <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {event.eventType} · {dateLabel}
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5 leading-tight">
            {countryName}
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

      {/* ── Notes / description ─────────────────────────────────────────── */}
      {event.notes && (
        <p className="px-3 pt-2.5 text-xs leading-relaxed text-foreground/80">
          {event.notes}
        </p>
      )}

      {/* ── Fatalities ──────────────────────────────────────────────────── */}
      {event.fatalities > 0 && (
        <div className="px-3 pt-2 flex items-center gap-1.5 text-xs">
          <Skull className="w-3 h-3 text-red-400" />
          <span className="font-medium text-red-400 tabular-nums">
            {event.fatalities} reported {event.fatalities === 1 ? 'fatality' : 'fatalities'}
          </span>
        </div>
      )}

      {/* ── Affected commodities ────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-purple-400/80 mb-1.5">
          Could affect supply of
        </div>
        {affected.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            {event.countryIso2
              ? `${countryName} is not a top-5 producer of any tracked commodity.`
              : 'Country could not be resolved for this event.'}
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


      {/* ── Recent news ─────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-orange-400/80 mb-1.5 flex items-center gap-1">
          <Newspaper className="w-3 h-3" />
          Recent coverage
        </div>

        {newsLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded bg-accent/30 animate-pulse" />
            ))}
          </div>
        ) : newsArticles.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">No recent articles found.</div>
        ) : (
          <ul className="space-y-0.5">
            {newsArticles.map((article) => (
              <li key={article.url}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs py-1 px-2 rounded hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground/90 leading-snug line-clamp-2">
                      {article.title}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                      <span className="truncate max-w-[150px]">{article.source}</span>
                      <span>·</span>
                      <span className="shrink-0">{fmtPubDate(article.pubDate)}</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground/40 group-hover:text-orange-400 transition-colors mt-0.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Source footer ────────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-3 flex items-center justify-between border-t border-border/50 mt-2">
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
