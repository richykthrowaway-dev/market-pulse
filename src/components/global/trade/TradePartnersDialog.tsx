import { useRef, useState, useEffect } from 'react';
import {
  ArrowLeftRight, ArrowUpRight, ArrowDownRight, X, GripHorizontal, Loader2,
  Package,
} from 'lucide-react';
import { COUNTRY_META } from '@/data/countryMeta';
import {
  useTradeBreakdown,
  type TradeProduct,
  type TradeDirection,
} from '@/hooks/useTradeBreakdown';
import {
  useBilateralStatic,
  lookupBilateral,
} from '@/hooks/useBilateralStatic';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { HS_CHAPTER_NAMES } from '@/lib/hsChapters';
import { cn } from '@/lib/utils';

/**
 * Friendlier HS chapter display name.  Chapter codes from Comtrade
 * bilateral queries come back as bare 2-digit strings ("27", "84"),
 * which we map to their WCO short titles via HS_CHAPTER_NAMES.
 */
function displayChapterName(code: string): string {
  const padded = code.padStart(2, '0');
  return HS_CHAPTER_NAMES[padded] ?? `HS ${padded}`;
}

// Stable per-section palette — same hash trick TradeBreakdown uses,
// so the same product gets the same color anywhere it appears.
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];
function colorFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

interface Props {
  /** ISO2 of the selected country whose trade partners are shown. */
  selectedCountry: string | null;
  /** Top export-destination rows from useTradeBreakdown. */
  exportPartners: TradeProduct[];
  /** Top import-source rows from useTradeBreakdown. */
  importPartners: TradeProduct[];
  /** Annual data year (typically 1-2y lag). */
  year?: number | null;
  /** True while either WITS query is still in-flight. */
  isLoading?: boolean;
  /** Open/close — driven by the layer toggle in TradeInfrastructurePanel. */
  open: boolean;
  /** Called when the user clicks X — disables the layer. */
  onClose: () => void;
}

/**
 * TradePartnersDialog — small draggable, closeable card showing the
 * selected country's top export destinations and import sources.
 *
 * Mirrors the visual and interaction pattern of ConflictEventDialog
 * (drag handle, fixed positioning, z-[400], backdrop-blur card surface).
 * Closing the card turns the Trade Partners layer off.
 */
export function TradePartnersDialog({
  selectedCountry,
  exportPartners,
  importPartners,
  year,
  isLoading = false,
  open,
  onClose,
}: Props) {
  // ── Drag state ──────────────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number;
  } | null>(null);

  // Reset position when the country changes — re-anchors the card to its
  // initial bottom-left dock rather than wherever the user dragged it last.
  useEffect(() => { setPos(null); }, [selectedCountry]);

  function onDragHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: rect.left, origY: rect.top,
    };
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

  if (!open || !selectedCountry) return null;

  const countryMeta = COUNTRY_META[selectedCountry];
  const countryName = countryMeta?.name ?? selectedCountry;

  const topExports = exportPartners.slice(0, 6);
  const topImports = importPartners.slice(0, 6);
  const maxShare   = Math.max(
    topExports[0]?.share ?? 0,
    topImports[0]?.share ?? 0,
    0.001,
  );

  return (
    <div
      ref={cardRef}
      className={cn(
        'fixed z-[400] w-[300px] max-h-[80vh] overflow-y-auto',
        'bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl',
        'pointer-events-auto select-none',
        pos ? '' : 'bottom-20 left-6',
      )}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ── Drag handle ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center h-3.5 cursor-grab active:cursor-grabbing rounded-t-lg hover:bg-accent/40 transition-colors"
        onPointerDown={onDragHandlePointerDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/35" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 pb-2.5 border-b border-border">
        <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Top Trade Partners {year ? `· ${year}` : ''}
          </div>
          <div className="text-xs font-semibold text-foreground mt-0.5 leading-tight truncate">
            {countryName}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading partners…
        </div>
      ) : topExports.length === 0 && topImports.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 px-3 text-center">
          No partner data reported for this country.
        </p>
      ) : (
        <div className="px-3 py-2 space-y-3">
          <PartnersSection
            title="Exports to"
            icon={<ArrowUpRight className="w-3 h-3 text-emerald-400" />}
            color="bg-emerald-500"
            partners={topExports}
            maxShare={maxShare}
            ourDirection="exports"
            reporter={selectedCountry}
          />
          <PartnersSection
            title="Imports from"
            icon={<ArrowDownRight className="w-3 h-3 text-amber-400" />}
            color="bg-amber-500"
            partners={topImports}
            maxShare={maxShare}
            ourDirection="imports"
            reporter={selectedCountry}
          />
        </div>
      )}

      {/* ── Footer attribution ──────────────────────────────────────────── */}
      <p className="px-3 pb-2 text-[9px] text-muted-foreground/60">
        UN Comtrade · share of total {' '}
        {topExports.length > 0 && topImports.length > 0 ? 'trade' :
         topExports.length > 0 ? 'exports' : 'imports'}
      </p>
    </div>
  );
}

// ── Subcomponent — one direction's top-partners list ────────────────────────

function PartnersSection({
  title, icon, color, partners, maxShare, ourDirection, reporter,
}: {
  title:        string;
  icon:         React.ReactNode;
  color:        string;
  partners:     TradeProduct[];
  maxShare:     number;
  /** Direction relative to the SELECTED country — exports row → 'exports'. */
  ourDirection: TradeDirection;
  /** ISO2 of the selected country (the trade reporter for bilateral queries). */
  reporter:     string;
}) {
  if (partners.length === 0) {
    return (
      <div>
        <SectionHeader title={title} icon={icon} />
        <p className="text-[10px] text-muted-foreground/60 italic px-1 py-1">No data</p>
      </div>
    );
  }
  return (
    <div>
      <SectionHeader title={title} icon={icon} />
      <ul className="space-y-0.5 mt-1">
        {partners.map((p, i) => (
          <PartnerRow
            key={p.code}
            rank={i + 1}
            partner={p}
            maxShare={maxShare}
            barColor={color}
            ourDirection={ourDirection}
            reporter={reporter}
          />
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="w-3 h-3 shrink-0 flex items-center justify-center">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

function PartnerRow({
  rank, partner, maxShare, barColor, ourDirection, reporter,
}: {
  rank:         number;
  partner:      TradeProduct;
  maxShare:     number;
  barColor:     string;
  ourDirection: TradeDirection;
  reporter:     string;
}) {
  // Hover-gated fetch flag.  We let Radix own the open/close lifecycle
  // (uncontrolled HoverCard) and just listen via onOpenChange so the
  // WITS query is enabled exactly while the popover is open.
  const [open, setOpen] = useState(false);

  const barWidth = maxShare > 0 ? (partner.share / maxShare) * 100 : 0;
  const flagSrc  = `https://flagcdn.com/w40/${partner.code.toLowerCase()}.png`;
  const name     = partner.name || COUNTRY_META[partner.code]?.name || partner.code;

  return (
    <HoverCard openDelay={200} closeDelay={80} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <li
          tabIndex={0}
          className="flex items-center gap-1.5 group cursor-help rounded px-0.5 -mx-0.5 hover:bg-muted/30 focus:bg-muted/30 focus:outline-none transition-colors"
          title={`${name} — hover for breakdown`}
        >
          <span className="text-[9px] tabular-nums text-muted-foreground/40 w-3 shrink-0 text-right">
            {rank}
          </span>
          <img
            src={flagSrc}
            alt=""
            width={16}
            height={11}
            className="shrink-0 rounded-[1px] ring-1 ring-border/40 object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <span className="truncate min-w-0 flex-1 text-[10.5px] text-foreground/85">
            {name}
          </span>
          <span className="w-10 h-1 bg-muted/30 rounded-full overflow-hidden shrink-0">
            <span
              className={cn('block h-full rounded-full transition-[width] duration-300', barColor)}
              style={{ width: `${barWidth}%`, opacity: 0.7 }}
            />
          </span>
          <span className="tabular-nums shrink-0 w-9 text-right text-[10px] text-muted-foreground">
            {(partner.share * 100).toFixed(1)}%
          </span>
        </li>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        avoidCollisions
        className="w-72 p-3 z-[500]"
      >
        <PartnerBreakdown
          reporter={reporter}
          partnerIso2={partner.code}
          partnerName={name}
          ourDirection={ourDirection}
          fetchEnabled={open}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Hover-card body — TRUE BILATERAL product breakdown.
 *
 * Two-tier data fetching:
 *   1. STATIC (CDN) — `useBilateralStatic(reporter)` returns the pre-built
 *      JSON for our top-50 reporters, served from Vercel's edge CDN.  We
 *      pull this lazily on first hover and cache it for the whole session;
 *      every subsequent partner hover is a synchronous Map lookup (~0 ms).
 *   2. LIVE API (fallback) — when the reporter isn't in the static dataset
 *      (smaller economy) OR a specific partner isn't pre-fetched, we call
 *      `api-wits` in `level=bilateral` mode.  This guarantees full coverage
 *      while keeping the common case CDN-fast.
 *
 * Both tiers are hover-gated via `fetchEnabled` so opening the partners
 * card doesn't fire 12 background requests.  The live-API hook only runs
 * when static data is unavailable AND the hover is active.
 */
function PartnerBreakdown({
  reporter, partnerIso2, partnerName, ourDirection, fetchEnabled,
}: {
  /** ISO2 of the selected country (e.g. "US"). */
  reporter:     string;
  /** ISO2 of the partner this row represents (e.g. "CA"). */
  partnerIso2:  string;
  /** Display name of the partner ("Canada"). */
  partnerName:  string;
  /** Direction relative to the SELECTED country — exports row → 'exports'. */
  ourDirection: TradeDirection;
  fetchEnabled: boolean;
}) {
  // ── Tier 1: static CDN dataset ─────────────────────────────────────────
  // Fetches the reporter's JSON on first hover, caches per session.
  const { data: staticData, isLoading: staticLoading } =
    useBilateralStatic(fetchEnabled ? reporter : null);
  const staticEntry = lookupBilateral(staticData, partnerIso2, ourDirection);

  // ── Tier 2: live API fallback ──────────────────────────────────────────
  // Only triggers when (a) the popover is open, (b) static is done loading,
  // and (c) the static dataset didn't have this specific (reporter, partner).
  const needLiveFallback = fetchEnabled && !staticLoading && !staticEntry;
  const { data: liveData, isLoading: liveLoading } = useTradeBreakdown(
    needLiveFallback ? reporter : null,
    ourDirection,
    'bilateral',
    partnerIso2,
  );

  // ── Pick whichever source actually has data ────────────────────────────
  const isLoading   = staticLoading || (needLiveFallback && liveLoading);
  const source: 'static' | 'live' | null = staticEntry
    ? 'static'
    : (liveData?.products?.length ? 'live' : null);

  const products = source === 'static'
    ? staticEntry!.topChapters
    : (liveData?.products ?? []);
  const year = source === 'static' ? staticEntry!.year : liveData?.year ?? null;
  const totalUsd = source === 'static'
    ? staticEntry!.totalUsd
    : (liveData?.totalUsd ?? null);

  const reporterName = COUNTRY_META[reporter]?.name ?? reporter;
  const verbLabel =
    ourDirection === 'exports'
      ? `${reporterName} → ${partnerName}`
      : `${partnerName} → ${reporterName}`;

  const topChapters = products.slice(0, 6);
  const otherShare  = products.slice(6).reduce((s, p) => s + p.share, 0);
  const totalUsdB   = totalUsd != null ? totalUsd / 1e9 : null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5 min-w-0">
          <Package className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="font-semibold text-xs truncate">{verbLabel}</span>
        </div>
        {year != null && (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
            {year}
          </span>
        )}
      </div>

      {/* Subhead — total bilateral trade value + data source tag */}
      <p className="text-[10px] text-muted-foreground -mt-1 leading-snug flex items-center gap-1">
        {totalUsdB != null
          ? <span>${totalUsdB.toFixed(1)}B in total · top HS chapters</span>
          : <span>Bilateral product breakdown · UN Comtrade</span>}
        {source === 'static' && (
          <span
            className="ml-auto shrink-0 text-[8px] px-1 py-px rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-wider"
            title="Served from static CDN cache"
          >
            cached
          </span>
        )}
      </p>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 py-3 text-[10px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading bilateral trade…
        </div>
      ) : topChapters.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic py-1">
          No bilateral product data reported by Comtrade for this country pair.
        </p>
      ) : (
        <>
          {/* Stacked composition bar */}
          <div className="flex h-2 w-full overflow-hidden rounded bg-muted/30">
            {topChapters.map((p) => (
              <div
                key={p.code}
                style={{
                  width: `${p.share * 100}%`,
                  backgroundColor: colorFor(p.code),
                }}
                title={`${displayChapterName(p.code)}: ${(p.share * 100).toFixed(1)}%`}
              />
            ))}
            {otherShare > 0.001 && (
              <div
                style={{ width: `${otherShare * 100}%` }}
                className="bg-muted-foreground/40"
                title={`Other: ${(otherShare * 100).toFixed(1)}%`}
              />
            )}
          </div>

          {/* Legend list */}
          <ul className="space-y-0.5 mt-1">
            {topChapters.map((p) => (
              <li key={p.code} className="flex items-center gap-1.5 text-[10px]" title={displayChapterName(p.code)}>
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: colorFor(p.code) }}
                />
                <span className="font-mono text-[9px] text-muted-foreground/70 shrink-0 w-5">
                  {p.code.padStart(2, '0')}
                </span>
                <span className="truncate text-foreground/85 flex-1 min-w-0">
                  {displayChapterName(p.code)}
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {(p.share * 100).toFixed(1)}%
                </span>
              </li>
            ))}
            {otherShare > 0.001 && (
              <li className="flex items-center gap-1.5 text-[10px]">
                <span className="inline-block w-2 h-2 rounded-sm shrink-0 bg-muted-foreground/40" />
                <span className="w-5 shrink-0" />
                <span className="truncate text-muted-foreground flex-1 min-w-0">Other</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {(otherShare * 100).toFixed(1)}%
                </span>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
