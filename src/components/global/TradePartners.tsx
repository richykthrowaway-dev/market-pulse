import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Globe, Package, Loader2 } from 'lucide-react';
import {
  useTradeBreakdown,
  type TradeProduct,
  type TradeDirection,
} from '@/hooks/useTradeBreakdown';
import { useBilateralStatic, lookupBilateral } from '@/hooks/useBilateralStatic';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { HS_CHAPTER_NAMES } from '@/lib/hsChapters';
import { COUNTRY_META } from '@/data/countryMeta';
import { Flag } from '@/components/ui/Flag';
import { cn } from '@/lib/utils';

interface TradePartnersProps {
  iso2: string;
}

// ── Number formatting ────────────────────────────────────────────────

function formatUsdCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

// HS chapter codes from Comtrade come back as bare 2-digit strings;
// map them to the WCO short title.
function displayChapterName(code: string): string {
  const padded = code.padStart(2, '0');
  return HS_CHAPTER_NAMES[padded] ?? `HS ${padded}`;
}

// Stable per-chapter palette — same hash so identical chapters render
// in the same colour across every panel they appear in.
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];
function colorFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Partner row with hover drill-down ────────────────────────────────

interface PartnerRowProps {
  partner: TradeProduct;
  /** Largest share in this list — used to scale all bars proportionally */
  maxShare: number;
  /** ISO2 of the reporter country (the country whose page we're on) */
  reporter: string;
  /** Direction relative to the reporter — exports row → 'exports' */
  ourDirection: TradeDirection;
}

function PartnerRow({ partner, maxShare, reporter, ourDirection }: PartnerRowProps) {
  // Bar scaled to the leading partner's share so visual length spans
  // the full available width (top partners rarely above ~25% absolute).
  const barWidth = maxShare > 0 ? (partner.share / maxShare) * 100 : 0;

  // Hover-gated fetch: Radix HoverCard owns the open lifecycle and we
  // just enable the bilateral query while the popover is visible.
  const [open, setOpen] = useState(false);

  const partnerName = partner.name || COUNTRY_META[partner.code]?.name || partner.code;

  return (
    <HoverCard openDelay={200} closeDelay={80} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <div
          tabIndex={0}
          className={cn(
            'flex items-center gap-2 py-1 rounded px-1 -mx-1',
            'cursor-help hover:bg-muted/30 focus:bg-muted/30',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'transition-colors',
          )}
          aria-label={`${partnerName} — hover for product breakdown`}
        >
          <Flag code={partner.code} size={20} className="shrink-0" />
          <span className="text-xs text-foreground/90 truncate w-24 shrink-0">
            {partnerName}
          </span>
          <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-12 text-right">
            {(partner.share * 100).toFixed(1)}%
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        avoidCollisions
        className="w-80 p-3 z-[500]"
      >
        <PartnerBreakdown
          reporter={reporter}
          partnerIso2={partner.code}
          partnerName={partnerName}
          ourDirection={ourDirection}
          headlineValueUsd={partner.valueUsd}
          headlineSharePct={partner.share * 100}
          fetchEnabled={open}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

// ── Bilateral product breakdown (popover body) ───────────────────────

/**
 * Two-tier fetch strategy:
 *   1. STATIC CDN — `useBilateralStatic(reporter)` pulls the pre-built JSON
 *      for top-50 reporters from Vercel's edge CDN. First hover triggers
 *      the fetch; every subsequent hover is a synchronous Map lookup.
 *   2. LIVE API fallback — when the reporter isn't in the static set or
 *      the specific (reporter, partner) pair isn't pre-fetched, call the
 *      `api-wits` edge function in `level=bilateral` mode.
 *
 * Both tiers are gated by `fetchEnabled` so opening the panel doesn't
 * fire 16 background bilateral queries.
 */
function PartnerBreakdown({
  reporter, partnerIso2, partnerName, ourDirection,
  headlineValueUsd, headlineSharePct, fetchEnabled,
}: {
  reporter:        string;
  partnerIso2:     string;
  partnerName:     string;
  ourDirection:    TradeDirection;
  /** USD value of the headline row — shown above the chapter list */
  headlineValueUsd: number;
  /** Share % from the parent list — shown next to the value */
  headlineSharePct: number;
  fetchEnabled:    boolean;
}) {
  // Tier 1: static CDN dataset
  const { data: staticData, isLoading: staticLoading } =
    useBilateralStatic(fetchEnabled ? reporter : null);
  const staticEntry = lookupBilateral(staticData, partnerIso2, ourDirection);

  // Tier 2: live-API fallback when the static dataset doesn't cover this pair
  const needLiveFallback = fetchEnabled && !staticLoading && !staticEntry;
  const { data: liveData, isLoading: liveLoading } = useTradeBreakdown(
    needLiveFallback ? reporter : null,
    ourDirection,
    'bilateral',
    partnerIso2,
  );

  const isLoading = staticLoading || (needLiveFallback && liveLoading);
  const source: 'static' | 'live' | null = staticEntry
    ? 'static'
    : (liveData?.products?.length ? 'live' : null);

  const products = source === 'static'
    ? staticEntry!.topChapters
    : (liveData?.products ?? []);
  const year = source === 'static' ? staticEntry!.year : liveData?.year ?? null;
  const bilateralTotalUsd = source === 'static'
    ? staticEntry!.totalUsd
    : (liveData?.totalUsd ?? null);

  const reporterName = COUNTRY_META[reporter]?.name ?? reporter;
  const verbLabel = ourDirection === 'exports'
    ? `${reporterName} → ${partnerName}`
    : `${partnerName} → ${reporterName}`;

  const topChapters = products.slice(0, 6);
  const otherShare  = products.slice(6).reduce((s, p) => s + p.share, 0);

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

      {/* Headline numbers — value + share of total trade */}
      <div className="flex items-baseline justify-between -mt-1 gap-2">
        <span className="text-[10px] text-muted-foreground">
          {headlineSharePct.toFixed(1)}% of total {ourDirection}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatUsdCompact(headlineValueUsd)}
        </span>
      </div>

      {/* Bilateral total + source tag */}
      <p className="text-[10px] text-muted-foreground leading-snug flex items-center gap-1">
        {bilateralTotalUsd != null
          ? <span>{formatUsdCompact(bilateralTotalUsd)} bilateral · top HS chapters</span>
          : <span>Bilateral product breakdown</span>}
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

// ── Panel + main ─────────────────────────────────────────────────────

interface PartnersPanelProps {
  title: string;
  icon: React.ReactNode;
  iso2: string;
  direction: TradeDirection;
}

function PartnersPanel({ title, icon, iso2, direction }: PartnersPanelProps) {
  const { data, isLoading } = useTradeBreakdown(iso2, direction, 'partners');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1 animate-pulse">
              <div className="h-4 w-5 rounded bg-muted/40 shrink-0" />
              <div className="h-3 w-20 bg-muted/40 rounded" />
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full" />
              <div className="h-3 w-10 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <p className="text-xs text-muted-foreground italic px-1">
          Partner data not reported for this country.
        </p>
      </div>
    );
  }

  const top = data.products.slice(0, 8);
  const maxShare = top[0]?.share ?? 1;

  return (
    <div className="space-y-2">
      <PanelHeader
        title={title}
        icon={icon}
        year={data.year}
        total={data.totalUsd ?? undefined}
      />
      <div className="space-y-0">
        {top.map((p) => (
          <PartnerRow
            key={p.code}
            partner={p}
            maxShare={maxShare}
            reporter={iso2}
            ourDirection={direction}
          />
        ))}
      </div>
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  icon: React.ReactNode;
  year?: number | null;
  total?: number;
}

function PanelHeader({ title, icon, year, total }: PanelHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide truncate">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {total != null && total > 0 && <span>{formatUsdCompact(total)}</span>}
        {year != null && (
          <span className="px-1 rounded bg-muted/50 border border-border">{year}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Side-by-side visualization of a country's top trading partners.
 *
 * Each row hovers to reveal a TRUE BILATERAL product breakdown (which HS
 * chapters flow between the two countries), backed by a two-tier fetch:
 *   1. STATIC CDN — pre-built JSON for the top-50 reporters; <0 ms after
 *      the reporter's file lands.
 *   2. LIVE FALLBACK — `api-wits` in bilateral mode for any reporter or
 *      partner not in the static set.
 *
 * Both tiers are gated by the hover so opening the panel does not fire
 * 16 background requests.
 */
export function TradePartners({ iso2 }: TradePartnersProps) {
  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground pb-1">
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Top Trading Partners · UN Comtrade
        </span>
        <span className="text-[9px] text-muted-foreground/60 italic ml-auto">
          hover a row for product breakdown
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3">
        <PartnersPanel
          title="Top Export Destinations"
          icon={<ArrowUpRight className={cn('w-3.5 h-3.5 text-emerald-500')} />}
          iso2={iso2}
          direction="exports"
        />
        <PartnersPanel
          title="Top Import Sources"
          icon={<ArrowDownRight className={cn('w-3.5 h-3.5 text-amber-500')} />}
          iso2={iso2}
          direction="imports"
        />
      </div>
    </div>
  );
}
